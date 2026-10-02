import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Image as ImageIcon, Upload, Download, Folder, RotateCcw, AlertTriangle, Edit3, Trash2, Check, X, AlertCircle, Lock, Layers, Plus, Sun } from 'lucide-react';
import { ocrService, LogSheetEntry, LogSheetParseResult, entryNeedsReview, ContactFieldKey } from '@/services/ocr';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { exportService } from '@/services/export';
import { googleSheets } from '@/services/googleSheets';
import { Contact } from '@/types/contact';
import { Batch } from '@/types/batch';
import { EventTemplate, ColumnMapping } from '@/types/eventTemplate';
import { checkDuplicate, DuplicateResult } from '@/services/duplicateDetection';
import { useAuth } from '@/contexts/AuthContext';
import UpgradePrompt from '@/components/UpgradePrompt';
import BatchNamingModal from '@/components/BatchNamingModal';
import ColumnMappingPanel from '@/components/ColumnMappingPanel';
import { compressForOCR } from '@/utils/compressPhoto';
import {
    applyColumnMappingsToAll,
    buildTemplatePromptHint,
} from '@/services/columnMapping';
import { listEventTemplates } from '@/services/eventTemplateStorage';
import { remapEntries, mappingsEqual } from '@/services/logSheetMapping';
import type { LogSheetColumnMapping, LogSheetParseMeta } from '@/types/logSheet';
import ColumnMappingConfirm from '@/components/ColumnMappingConfirm';
import LogSheetGuidedCamera from '@/components/LogSheetGuidedCamera';
import LogSheetFramingOverlay from '@/components/LogSheetFramingOverlay';

type ReviewFilter = 'needs-review' | 'all' | 'ready';

const FIELD_LABELS: Record<ContactFieldKey, string> = {
    name: 'Name',
    company: 'Company',
    position: 'Position',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    notes: 'Notes',
};

const LogScan: React.FC = () => {
    const navigate = useNavigate();
    const camRef = useRef<HTMLInputElement>(null);
    const galRef = useRef<HTMLInputElement>(null);
    const addMoreCamRef = useRef<HTMLInputElement>(null);
    const addMoreGalRef = useRef<HTMLInputElement>(null);
    const { canPerformScan, incrementScanCount, canExportCSV, canExportExcel, canExportGoogleSheets, canUseBulkScan } = useAuth();
    const { storage } = useWorkspace();

    const [imageData, setImageData] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [entries, setEntries] = useState<LogSheetEntry[] | null>(null);
    const [importFolder, setImportFolder] = useState('Uncategorized');
    const [folders, setFolders] = useState<string[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [isExportingSheets, setIsExportingSheets] = useState(false);
    const [upgradeFeature, setUpgradeFeature] = useState<'bulk-scan' | 'scan' | 'export' | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{ name: string; company: string; position: string; phone: string; email: string; address: string; notes: string }>({ name: '', company: '', position: '', phone: '', email: '', address: '', notes: '' });
    const [duplicateMap, setDuplicateMap] = useState<Map<number, DuplicateResult>>(new Map());
    const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
    const [sheetCount, setSheetCount] = useState(0);
    const [processingProgress, setProcessingProgress] = useState<string | null>(null);
    const [showBatchNaming, setShowBatchNaming] = useState(false);
    const [scanTimestamp, setScanTimestamp] = useState<number>(Date.now());
    const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
    const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('needs-review');
    const [importWarning, setImportWarning] = useState<string | null>(null);
    // Event template / column mapping (optional — happy path skips this)
    const [templates, setTemplates] = useState<EventTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [activeMappings, setActiveMappings] = useState<ColumnMapping[]>([]);
    const selectedTemplateRef = useRef<EventTemplate | null>(null);
    // Guided capture + ambiguous-header confirm (#15)
    const [showGuidedCamera, setShowGuidedCamera] = useState(false);
    const [guidedAppend, setGuidedAppend] = useState(false);
    const [showAddNextPrompt, setShowAddNextPrompt] = useState(false);
    const [pendingMapping, setPendingMapping] = useState<{
        meta: LogSheetParseMeta;
        entries: LogSheetEntry[];
        append: boolean;
        sample: LogSheetEntry | null;
    } | null>(null);
    const [confirmedMapping, setConfirmedMapping] = useState<LogSheetColumnMapping | null>(null);
    const [mappingBanner, setMappingBanner] = useState<string | null>(null);

    useEffect(() => {
        const loadFolders = async () => {
            const existingContacts = await storage.getAllContacts();
            const contactFolders = existingContacts.map(c => c.folder || 'Uncategorized');
            const persistedFolders = await storage.getAllFolders();
            setFolders(Array.from(new Set([...contactFolders, ...persistedFolders])).sort());
        };
        loadFolders();
        listEventTemplates().then(setTemplates).catch(() => {});
    }, []);

    const getParseOptions = useCallback(() => {
        const opts: { columnMapping?: LogSheetColumnMapping; templateHint?: string } = {};
        if (confirmedMapping) opts.columnMapping = confirmedMapping;
        const tmpl = selectedTemplateRef.current;
        const hint = tmpl ? buildTemplatePromptHint(tmpl.mappings) : '';
        if (hint) opts.templateHint = hint;
        return Object.keys(opts).length ? opts : undefined;
    }, [confirmedMapping]);

    const applyMappingsIfAny = useCallback((list: LogSheetEntry[], mappings?: ColumnMapping[]): LogSheetEntry[] => {
        const maps = mappings ?? selectedTemplateRef.current?.mappings ?? activeMappings;
        if (!maps || maps.length === 0) return list;
        return applyColumnMappingsToAll(list, maps);
    }, [activeMappings]);

    /** Run parse; if headers ambiguous on first sheet (no confirmed mapping yet), pause for confirm. */
    const handleParseResult = async (
        result: LogSheetParseResult,
        append: boolean,
    ): Promise<LogSheetEntry[] | null> => {
        const { entries: nextEntries, meta } = result;

        const shouldConfirm =
            meta.headersAmbiguous &&
            !confirmedMapping &&
            nextEntries.length > 0 &&
            (!append || sheetCount === 0);

        if (shouldConfirm) {
            setPendingMapping({
                meta,
                entries: nextEntries,
                append,
                sample: nextEntries[0] || null,
            });
            return null;
        }

        if (meta.suggestedMapping && Object.keys(meta.suggestedMapping).length > 0 && !confirmedMapping) {
            setConfirmedMapping(meta.suggestedMapping);
        }

        return nextEntries;
    };

    const finishWithEntries = async (
        nextEntries: LogSheetEntry[],
        append: boolean,
        opts?: { promptAddNext?: boolean; openBatchNaming?: boolean },
    ) => {
        const mapped = applyMappingsIfAny(nextEntries);
        if (append) {
            const combined = [...(entries || []), ...mapped];
            setEntries(combined);
            setSheetCount(prev => prev + 1);
            await checkEntriesForDuplicates(combined);
            if (opts?.promptAddNext !== false) setShowAddNextPrompt(true);
        } else {
            setEntries(mapped);
            setSheetCount(1);
            await checkEntriesForDuplicates(mapped);
            const timestamp = Date.now();
            setScanTimestamp(timestamp);
            if (opts?.openBatchNaming !== false) setShowBatchNaming(true);
            if (opts?.promptAddNext !== false) setShowAddNextPrompt(true);
        }
    };

    const reviewStats = useMemo(() => {
        if (!entries) return { needsReview: 0, ready: 0, total: 0 };
        let needsReview = 0;
        for (const e of entries) {
            if (entryNeedsReview(e.needsReviewFields, e.confidence, e.reviewResolved)) needsReview++;
        }
        return { needsReview, ready: entries.length - needsReview, total: entries.length };
    }, [entries]);

    /** Display order: uncertain rows first, then by ascending confidence. Indices stay original. */
    const displayedIndices = useMemo(() => {
        if (!entries) return [] as number[];
        const idxs = entries.map((_, i) => i);
        const filtered = idxs.filter(i => {
            const e = entries[i];
            const needs = entryNeedsReview(e.needsReviewFields, e.confidence, e.reviewResolved);
            if (reviewFilter === 'needs-review') return needs;
            if (reviewFilter === 'ready') return !needs;
            return true;
        });
        return filtered.sort((a, b) => {
            const ea = entries[a];
            const eb = entries[b];
            const na = entryNeedsReview(ea.needsReviewFields, ea.confidence, ea.reviewResolved) ? 0 : 1;
            const nb = entryNeedsReview(eb.needsReviewFields, eb.confidence, eb.reviewResolved) ? 0 : 1;
            if (na !== nb) return na - nb;
            return ea.confidence - eb.confidence;
        });
    }, [entries, reviewFilter]);

    // Prefer Needs review tab when uncertain rows appear; fall back to All if none
    useEffect(() => {
        if (!entries) return;
        if (reviewStats.needsReview === 0 && reviewFilter === 'needs-review') {
            setReviewFilter('all');
        }
    }, [entries, reviewStats.needsReview, reviewFilter]);

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const fileArr = Array.from(files);
        e.target.value = '';

        if (!canUseBulkScan()) {
            setUpgradeFeature('bulk-scan');
            return;
        }

        if (fileArr.length === 1) {
            const data = await compressForOCR(fileArr[0]);
            setImageData(data);
            processLogSheet(data);
        } else {
            processMultipleSheets(fileArr, false);
        }
    };

    const handleAddMoreImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const fileArr = Array.from(files);
        e.target.value = '';

        if (!canUseBulkScan()) {
            setUpgradeFeature('bulk-scan');
            return;
        }

        if (fileArr.length === 1) {
            const data = await compressForOCR(fileArr[0]);
            setImageData(data);
            processLogSheetAppend(data);
        } else {
            processMultipleSheets(fileArr, true);
        }
    };

    /** Wrap a promise with a hard timeout so we never get stuck */
    const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
        Promise.race([
            promise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms))
        ]);

    const processMultipleSheets = async (files: File[], append: boolean) => {
        if (!canPerformScan()) {
            setUpgradeFeature('scan');
            return;
        }

        setIsProcessing(true);
        setError(null);
        if (!append) {
            setEntries(null);
            setDuplicateMap(new Map());
            setSelectedEntries(new Set());
        }

        // Compress first image immediately so the spinner is visible
        setProcessingProgress(`Preparing ${files.length} sheets...`);
        const firstData = await compressForOCR(files[0]);
        setImageData(firstData);

        let allEntries = append ? [...(entries || [])] : [];
        let sheetsProcessed = append ? sheetCount : 0;
        const failedIndices: number[] = [];

        for (let i = 0; i < files.length; i++) {
            setProcessingProgress(`Analyzing sheet ${i + 1} of ${files.length}...`);
            try {
                const data = i === 0 ? firstData : await compressForOCR(files[i]);
                setImageData(data);
                // 60-second hard timeout per sheet so we never get stuck
                const result = await withTimeout(
                    ocrService.parseLogSheet(data, getParseOptions()),
                    60000,
                    `Sheet ${i + 1}`
                );
                if (result.entries.length > 0) {
                    await incrementScanCount();
                    allEntries = [...allEntries, ...result.entries];
                    sheetsProcessed++;
                }
            } catch (err: any) {
                failedIndices.push(i);
                console.error(`Failed to process sheet ${i + 1}:`, err?.message || err);
            }
            // Progressive delay: longer waits for later sheets to respect Gemini rate limits
            if (i < files.length - 1) {
                const baseDelay = failedIndices.length > 0 ? 10000 : 6000;
                const progressiveDelay = baseDelay + (i * 2000); // +2s per sheet
                setProcessingProgress(`Preparing next sheet...`);
                await new Promise(r => setTimeout(r, progressiveDelay));
            }
        }

        // Auto-retry failed sheets up to 3 times with increasing delays
        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES && failedIndices.length > 0 && failedIndices.length < files.length; attempt++) {
            const retryDelay = 10000 + (attempt * 4000); // 14s, 18s, 22s
            for (let r = failedIndices.length - 1; r >= 0; r--) {
                const idx = failedIndices[r];
                setProcessingProgress(`Re-analyzing sheet ${idx + 1}... (attempt ${attempt + 1})`);
                await new Promise(res => setTimeout(res, retryDelay));
                try {
                    const data = await compressForOCR(files[idx]);
                    const result = await withTimeout(
                        ocrService.parseLogSheet(data, getParseOptions()),
                        60000,
                        `Sheet ${idx + 1} retry ${attempt}`
                    );
                    if (result.entries.length > 0) {
                        await incrementScanCount();
                        allEntries = [...allEntries, ...result.entries];
                        sheetsProcessed++;
                        failedIndices.splice(r, 1);
                    }
                } catch (err: any) {
                    console.error(`Retry ${attempt} failed for sheet ${idx + 1}:`, err?.message || err);
                }
            }
        }

        setProcessingProgress(null);
        setSheetCount(sheetsProcessed);
        if (allEntries.length > 0) {
            setEntries(allEntries);
            if (failedIndices.length > 0) {
                const nums = failedIndices.map(i => i + 1);
                setError(`partial:Sheet${nums.length > 1 ? 's' : ''} ${nums.join(', ')} couldn't be read. You can add them again later.`);
            }
            await checkEntriesForDuplicates(allEntries);
            const timestamp = Date.now();
            setScanTimestamp(timestamp);
            setShowBatchNaming(true);
        } else {
            setEntries(null);
            setError(failedIndices.length > 0
                ? 'The server is busy right now. Try again in a moment, or try fewer sheets at a time.'
                : 'No entries found on any sheet.');
        }
        setIsProcessing(false);
    };

    const checkEntriesForDuplicates = async (entryList: LogSheetEntry[]) => {
        const existingContacts = await storage.getAllContacts();
        const dupMap = new Map<number, DuplicateResult>();
        const selected = new Set<number>();

        entryList.forEach((entry, index) => {
            const result = checkDuplicate(
                {
                    name: entry.name,
                    email: entry.email,
                    phone: entry.phone,
                    company: entry.company,
                },
                existingContacts
            );
            if (result.isDuplicate) {
                dupMap.set(index, result);
            } else {
                selected.add(index); // Auto-select non-duplicates
            }
        });

        setDuplicateMap(dupMap);
        setSelectedEntries(selected);
    };

    const friendlyError = (err: unknown): string => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('timed out') || msg.includes('abort'))
            return 'The server took too long to respond. Tap retry to try again.';
        if (msg.includes('429') || msg.includes('rate') || msg.includes('quota'))
            return 'The server is busy right now. Please wait a moment and try again.';
        if (msg.includes('500') || msg.includes('503'))
            return 'The server encountered a temporary issue. Tap retry to try again.';
        return msg;
    };

    /** Try parsing with up to 2 silent retries before surfacing an error */
    const parseWithRetry = async (base64Image: string): Promise<LogSheetParseResult> => {
        const MAX_SILENT_RETRIES = 2;
        for (let attempt = 0; attempt <= MAX_SILENT_RETRIES; attempt++) {
            try {
                return await withTimeout(ocrService.parseLogSheet(base64Image, getParseOptions()), 60000, `Sheet attempt ${attempt + 1}`);
            } catch (err) {
                console.log(`[LogScan] Attempt ${attempt + 1} failed:`, err);
                if (attempt < MAX_SILENT_RETRIES) {
                    setProcessingProgress(attempt === 0 ? 'Still working...' : 'Almost there...');
                    await new Promise(r => setTimeout(r, 8000 + attempt * 4000));
                } else {
                    throw err;
                }
            }
        }
        throw new Error('All attempts failed');
    };

        const processLogSheetAppend = async (base64Image: string) => {
        if (!canPerformScan()) {
            setUpgradeFeature('scan');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setShowAddNextPrompt(false);

        try {
            const result = await parseWithRetry(base64Image);
            if (result.entries.length === 0) {
                setError('No entries found on this sheet.');
            } else {
                await incrementScanCount();
                const resolved = await handleParseResult(result, true);
                if (resolved) {
                    await finishWithEntries(resolved, true);
                }
            }
        } catch (err) {
            setError(friendlyError(err));
        } finally {
            setProcessingProgress(null);
            setIsProcessing(false);
        }
    };

        const processLogSheet = async (base64Image: string) => {
        if (!canPerformScan()) {
            setUpgradeFeature('scan');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setEntries(null);
        setDuplicateMap(new Map());
        setSelectedEntries(new Set());
        setShowAddNextPrompt(false);

        try {
            const result = await parseWithRetry(base64Image);
            if (result.entries.length === 0) {
                setEntries(null);
                setError('No entries found. Make sure the log sheet is clearly visible and aligned in the frame.');
            } else {
                await incrementScanCount();
                const resolved = await handleParseResult(result, false);
                if (resolved) {
                    await finishWithEntries(resolved, false);
                }
            }
        } catch (err) {
            setError(friendlyError(err));
        } finally {
            setProcessingProgress(null);
            setIsProcessing(false);
        }
    };

    const onMappingConfirm = async (mapping: LogSheetColumnMapping) => {
        if (!pendingMapping) return;
        const { entries: pendingEntries, append, meta } = pendingMapping;
        const remapped = remapEntries(pendingEntries, meta.suggestedMapping, mapping);
        setConfirmedMapping(mapping);
        setMappingBanner(
            mappingsEqual(mapping, meta.suggestedMapping)
                ? 'Column mapping confirmed for this batch.'
                : 'Column mapping updated — applied to current rows and next sheets.'
        );
        setPendingMapping(null);
        await finishWithEntries(remapped, append);
    };

    const onMappingSkip = async () => {
        if (!pendingMapping) return;
        const { entries: pendingEntries, append, meta } = pendingMapping;
        if (Object.keys(meta.suggestedMapping).length > 0) {
            setConfirmedMapping(meta.suggestedMapping);
        }
        setMappingBanner('Using suggested column mapping.');
        setPendingMapping(null);
        await finishWithEntries(pendingEntries, append);
    };

    const openGuidedCamera = (append: boolean) => {
        if (!canUseBulkScan()) {
            setUpgradeFeature('bulk-scan');
            return;
        }
        setGuidedAppend(append);
        setShowGuidedCamera(true);
        setShowAddNextPrompt(false);
    };

    const onGuidedCapture = (data: string) => {
        setShowGuidedCamera(false);
        setImageData(data);
        if (guidedAppend) processLogSheetAppend(data);
        else processLogSheet(data);
    };

    const entriesToContacts = (list: LogSheetEntry[]): Contact[] =>
        list.map(e => ({
            id: crypto.randomUUID(),
            name: e.name,
            position: e.position,
            company: e.company,
            phone: e.phone,
            email: e.email,
            address: e.address,
            notes: e.notes,
            customFields: e.customFields && Object.keys(e.customFields).length > 0
                ? { ...e.customFields }
                : undefined,
            folder: importFolder || 'Uncategorized',
            rawText: '',
            imageData: '',
            confidence: e.confidence,
            isVerified: false,
            createdAt: Date.now(),
            batchId: currentBatchId || undefined,
        }));

    const toggleEntrySelection = (index: number) => {
        setSelectedEntries(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const handleImport = async (force = false) => {
        if (!entries) return;
        const toImport = entries.filter((_, i) => selectedEntries.has(i));
        if (toImport.length === 0) return;

        const unresolved = toImport.filter(e =>
            entryNeedsReview(e.needsReviewFields, e.confidence, e.reviewResolved)
        );
        if (unresolved.length > 0 && !force) {
            setImportWarning(
                `${unresolved.length} selected entr${unresolved.length === 1 ? 'y still needs' : 'ies still need'} review. Fix highlighted fields first, or import anyway.`
            );
            setReviewFilter('needs-review');
            return;
        }

        setImportWarning(null);
        setIsImporting(true);
        await storage.batchSave(entriesToContacts(toImport));
        if (importFolder !== 'Uncategorized') {
            await storage.saveFolder(importFolder);
        }
        setIsImporting(false);
        navigate('/contacts');
    };

    const handleExport = (type: 'csv' | 'excel' | 'crm-csv') => {
        if (!entries) return;
        if (type === 'csv' && !canExportCSV()) { setUpgradeFeature('export'); return; }
        if (type === 'excel' && !canExportExcel()) { setUpgradeFeature('export'); return; }
        if (type === 'crm-csv' && !canExportGoogleSheets()) { setUpgradeFeature('export'); return; }
        const selected = entries.filter((_, i) => selectedEntries.has(i));
        const contacts = entriesToContacts(selected.length > 0 ? selected : entries);
        if (type === 'csv') exportService.toCSV(contacts);
        else if (type === 'excel') exportService.toExcel(contacts);
        else exportService.toCRMCSV(contacts);
        setShowExportOptions(false);
    };

    const handleGoogleSheetsExport = async () => {
        if (!entries) return;
        if (!canExportGoogleSheets()) { setUpgradeFeature('export'); return; }
        const selected = entries.filter((_, i) => selectedEntries.has(i));
        const contacts = entriesToContacts(selected.length > 0 ? selected : entries);
        setIsExportingSheets(true);
        setShowExportOptions(false);
        try {
            const result = await googleSheets.exportContacts(contacts, undefined, 'Cura.Tor Log Sheet');
            if (result.spreadsheetUrl) {
                window.open(result.spreadsheetUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (err: any) {
            setError(err?.message || 'Google Sheets export failed');
        } finally {
            setIsExportingSheets(false);
        }
    };

    const handleSaveBatch = async (name: string) => {
        if (!entries) return;

        const batchId = crypto.randomUUID();
        const batch: Batch = {
            id: batchId,
            name,
            scanType: 'log-sheet',
            scannedAt: scanTimestamp,
            totalContacts: entries.length,
            successCount: selectedEntries.size,
            errorCount: duplicateMap.size,
            thumbnailData: imageData || undefined,
        };

        await storage.saveBatch(batch);
        setCurrentBatchId(batchId);
        setShowBatchNaming(false);
    };

    const handleSkipBatch = () => {
        setCurrentBatchId(null);
        setShowBatchNaming(false);
    };

    const reset = () => {
        setImageData(null);
        setEntries(null);
        setError(null);
        setIsProcessing(false);
        setEditingIndex(null);
        setDuplicateMap(new Map());
        setSelectedEntries(new Set());
        setSheetCount(0);
        setShowBatchNaming(false);
        setCurrentBatchId(null);
        setReviewFilter('needs-review');
        setImportWarning(null);
            // Keep selected template for the next scan; clear ephemeral mappings only if no template
        if (!selectedTemplateId) {
            setActiveMappings([]);
        }
        setShowAddNextPrompt(false);
        setPendingMapping(null);
        setConfirmedMapping(null);
        setMappingBanner(null);
        setShowGuidedCamera(false);
    };


    const openEntryEdit = (index: number) => {
        setEditingIndex(index);
        const e = entries![index];
        setEditForm({
            name: e.name,
            company: e.company,
            position: e.position,
            phone: e.phone.join(', '),
            email: e.email.join(', '),
            address: e.address,
            notes: e.notes,
        });
    };

    const splitCsv = (s: string): string[] => s.split(',').map(p => p.trim()).filter(Boolean);

    const fieldNeedsReview = (entry: LogSheetEntry, field: ContactFieldKey): boolean => {
        if (entry.reviewResolved) return false;
        return (entry.needsReviewFields || []).includes(field);
    };

    const markEntryReviewed = (index: number) => {
        if (!entries) return;
        const updated = [...entries];
        updated[index] = {
            ...updated[index],
            needsReviewFields: [],
            reviewResolved: true,
            confidence: Math.max(updated[index].confidence, 90),
        };
        setEntries(updated);
    };

    const saveEntryEdit = () => {
        if (editingIndex === null || !entries) return;
        const updated = [...entries];
        const original = entries[editingIndex];
        updated[editingIndex] = {
            ...original,
            name: editForm.name,
            company: editForm.company,
            position: editForm.position,
            phone: splitCsv(editForm.phone),
            email: splitCsv(editForm.email),
            address: editForm.address,
            notes: editForm.notes,
            // User corrected the row — clear review queue for this entry
            needsReviewFields: [],
            reviewResolved: true,
            confidence: Math.max(original.confidence, 90),
        };
        setEntries(updated);
        setEditingIndex(null);
        setImportWarning(null);
    };

    const editInputClass = (entry: LogSheetEntry, field: ContactFieldKey) =>
        `w-full glass border rounded-lg py-2 px-3 text-sm ${
            fieldNeedsReview(entry, field)
                ? 'border-amber-500/60 ring-1 ring-amber-500/30 bg-amber-500/5'
                : 'border-brand-700'
        }`;



    const handleTemplateSelected = (template: EventTemplate | null) => {
        selectedTemplateRef.current = template;
        setSelectedTemplateId(template?.id ?? null);
        if (template) {
            setActiveMappings(template.mappings);
            listEventTemplates().then(setTemplates).catch(() => {});
        }
    };

    const handleApplyMappings = () => {
        if (!entries || activeMappings.length === 0) return;
        const mapped = applyColumnMappingsToAll(entries, activeMappings);
        setEntries(mapped);
        checkEntriesForDuplicates(mapped);
    };

    const deleteEntry = (index: number) => {
        if (!entries) return;
        const updated = entries.filter((_, i) => i !== index);
        setEntries(updated.length > 0 ? updated : null);
        if (updated.length === 0) {
            setError('All entries removed. Scan another sheet or start over.');
        }
        if (editingIndex === index) {
            setEditingIndex(null);
        } else if (editingIndex !== null && editingIndex > index) {
            setEditingIndex(editingIndex - 1);
        }

        // Rebuild index-based maps to account for shifted indices
        const newSelected = new Set<number>();
        const newDupMap = new Map<number, DuplicateResult>();
        for (let i = 0; i < entries.length; i++) {
            if (i === index) continue;
            const newIdx = i < index ? i : i - 1;
            if (selectedEntries.has(i)) newSelected.add(newIdx);
            if (duplicateMap.has(i)) newDupMap.set(newIdx, duplicateMap.get(i)!);
        }
        setSelectedEntries(newSelected);
        setDuplicateMap(newDupMap);
    };

    if (!canUseBulkScan()) {
        return (
            <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
                <div className="flex items-center justify-between glass sticky top-0 z-10 p-4">
                    <button onClick={() => navigate('/app')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-semibold gradient-text">Log Sheet Scan</h1>
                    <div className="w-10" />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-4">
                        <Lock className="w-8 h-8 text-amber-400" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Premium Feature</h2>
                    <p className="text-sm text-slate-400 mb-6 max-w-xs">Log Sheet Scan is available for Pioneer and Pro users. Enter an access code to unlock.</p>
                    <button
                        onClick={() => navigate('/settings')}
                        className="px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl text-sm font-semibold"
                    >
                        Go to Settings
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between glass sticky top-0 z-10 p-4">
                <button onClick={() => navigate('/app')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">Log Sheet Scan</h1>
                <div className="w-10" />
            </div>

            <div className="flex-1 p-4">
                {/* Stage 1: Capture with framing guide */}
                {!imageData && (
                    <div className="flex flex-col items-center justify-center gap-5 py-8">
                        <div className="text-center space-y-2">
                            <h2 className="text-xl font-bold text-slate-100">Scan a Log Sheet</h2>
                            <p className="text-sm text-brand-400 max-w-xs mx-auto">
                                Align the table in the frame. Each row becomes a contact — add more pages after the first sheet.
                            </p>
                        </div>

                        <div className="w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden relative border-2 border-brand-500/40 bg-gradient-to-b from-brand-900 to-brand-950">
                            <LogSheetFramingOverlay compact />
                            <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none">
                                <span className="px-2.5 py-1 rounded-full bg-black/50 text-[10px] font-bold uppercase tracking-wider text-brand-200 border border-brand-500/30">
                                    Framing guide
                                </span>
                            </div>
                        </div>

                        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
                        <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />

                        <div className="w-full max-w-sm space-y-3">
                            <div className="glass border border-brand-800 rounded-xl p-3 text-left">
                                <label className="flex items-center gap-1.5 text-[10px] text-brand-500 uppercase tracking-wider font-bold mb-1.5">
                                    <Layers size={11} />
                                    Event template (optional)
                                </label>
                                <select
                                    value={selectedTemplateId || ''}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        if (!id) {
                                            handleTemplateSelected(null);
                                            setActiveMappings([]);
                                            return;
                                        }
                                        const t = templates.find(x => x.id === id) || null;
                                        handleTemplateSelected(t);
                                    }}
                                    className="w-full glass border border-brand-800 rounded-lg py-2 px-3 text-sm bg-brand-900"
                                >
                                    <option value="">None — default OCR mapping</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={() => openGuidedCamera(false)}
                                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-brand-500/20 to-emerald-500/15 hover:from-brand-500/30 hover:to-emerald-500/25 border border-brand-400/40 rounded-2xl transition-colors active:scale-95"
                            >
                                <Camera size={22} className="text-emerald-400" />
                                <span className="font-semibold text-brand-100">Guided camera</span>
                            </button>
                            <button
                                onClick={() => camRef.current?.click()}
                                className="w-full flex items-center justify-center gap-3 py-3.5 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-2xl transition-colors active:scale-95"
                            >
                                <Camera size={20} className="text-brand-400" />
                                <span className="font-semibold text-brand-300">System camera</span>
                            </button>
                            <button
                                onClick={() => galRef.current?.click()}
                                className="w-full flex items-center justify-center gap-3 py-3.5 bg-brand-800/50 hover:bg-brand-800 border border-brand-800 rounded-2xl transition-colors active:scale-95"
                            >
                                <ImageIcon size={20} className="text-brand-400" />
                                <span className="font-semibold text-brand-300">Gallery (multi-page OK)</span>
                            </button>
                        </div>

                        <div className="glass border border-brand-800 rounded-xl p-4 max-w-sm w-full space-y-2">
                            <p className="text-[10px] text-brand-500 uppercase tracking-wider font-bold">Capture tips</p>
                            <ul className="text-xs text-brand-400 space-y-1.5">
                                <li className="flex gap-2"><Layers size={12} className="mt-0.5 flex-shrink-0 text-brand-500" /> Fill the frame with the full table — headers + all rows</li>
                                <li className="flex gap-2"><Sun size={12} className="mt-0.5 flex-shrink-0 text-amber-400" /> Avoid glare; tilt slightly if the sheet is glossy</li>
                                <li className="flex gap-2"><Plus size={12} className="mt-0.5 flex-shrink-0 text-emerald-400" /> Multi-page? Capture one sheet, then tap Add next sheet</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Stage 2: Processing */}
                {imageData && isProcessing && (
                    <div className="flex flex-col items-center gap-6 py-8">
                        <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-brand-800">
                            <img src={imageData} alt="Log sheet" className="w-full object-contain max-h-48" />
                        </div>
                        <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-400" />
                            <p className="text-sm text-brand-400 font-medium">{processingProgress || 'Analyzing log sheet...'}</p>
                            <p className="text-xs text-brand-600">This may take a moment for large sheets</p>
                        </div>
                    </div>
                )}

                {/* Hidden inputs for "Add More Sheet" */}
                <input ref={addMoreCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAddMoreImage} />
                <input ref={addMoreGalRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddMoreImage} />

                {/* Stage 3: Results */}
                {imageData && !isProcessing && (entries || error || pendingMapping) && (
                    <div className="space-y-4">
                        <div className="w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-brand-800">
                            <img src={imageData} alt="Log sheet" className="w-full object-contain max-h-32" />
                        </div>

                        {mappingBanner && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30">
                                <Check size={14} className="text-sky-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-sky-200 flex-1">{mappingBanner}</p>
                                <button type="button" onClick={() => setMappingBanner(null)} className="text-sky-400/70 hover:text-sky-200" aria-label="Dismiss">
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {error && (() => {
                            const isPartial = error.startsWith('partial:');
                            const displayMsg = isPartial ? error.slice(8) : error;
                            return (
                                <div className={`flex items-center gap-3 p-4 rounded-xl ${isPartial ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                                    <AlertTriangle size={20} className={`flex-shrink-0 ${isPartial ? 'text-amber-400' : 'text-red-400'}`} />
                                    <div>
                                        <p className={`text-sm ${isPartial ? 'text-amber-300' : 'text-red-300'}`}>{displayMsg}</p>
                                        {!isPartial && (
                                            <button onClick={() => entries && entries.length > 0 ? processLogSheetAppend(imageData!) : processLogSheet(imageData!)} className="text-xs text-red-400 underline mt-1">
                                                Retry
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {entries && entries.length > 0 && (
                            <>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-brand-300">
                                                {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} found
                                                {sheetCount > 1 && <span className="text-brand-500"> from {sheetCount} sheets</span>}
                                            </p>
                                            {duplicateMap.size > 0 && (
                                                <p className="text-xs text-amber-400 mt-0.5">
                                                    {duplicateMap.size} duplicate{duplicateMap.size !== 1 ? 's' : ''} detected — deselected by default
                                                </p>
                                            )}
                                        </div>
                                        <button onClick={reset} className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-400">
                                            <RotateCcw size={12} />
                                            Start Over
                                        </button>
                                    </div>

                                    {/* Review queue summary */}
                                    {reviewStats.needsReview > 0 && (
                                        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                                            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                            <div className="min-w-0">
                                                <p className="text-sm text-amber-200 font-medium">
                                                    {reviewStats.needsReview} entr{reviewStats.needsReview === 1 ? 'y needs' : 'ies need'} review
                                                </p>
                                                <p className="text-xs text-amber-400/80 mt-0.5">
                                                    Uncertain rows are listed first. Check highlighted fields before import.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Filter tabs */}
                                    <div className="flex gap-1 p-1 glass border border-brand-800 rounded-xl">
                                        {([
                                            { id: 'needs-review' as const, label: `Review (${reviewStats.needsReview})` },
                                            { id: 'all' as const, label: `All (${reviewStats.total})` },
                                            { id: 'ready' as const, label: `Ready (${reviewStats.ready})` },
                                        ]).map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setReviewFilter(tab.id)}
                                                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                                                    reviewFilter === tab.id
                                                        ? tab.id === 'needs-review'
                                                            ? 'bg-amber-500/20 text-amber-300'
                                                            : 'bg-brand-500/20 text-brand-200'
                                                        : 'text-brand-500 hover:text-brand-300'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openGuidedCamera(true)}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-colors text-sm font-medium text-emerald-300 active:scale-95"
                                        >
                                            <Camera size={15} />
                                            Guided add
                                        </button>
                                        <button
                                            onClick={() => addMoreGalRef.current?.click()}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-xl transition-colors text-sm font-medium text-brand-300 active:scale-95"
                                        >
                                            <ImageIcon size={15} />
                                            Add via Gallery
                                        </button>
                                    </div>
                                </div>

                                {/* Folder picker */}
                                <div className="relative">
                                    <Folder className="absolute left-3 top-3 text-brand-500" size={18} />
                                    <select
                                        value={importFolder}
                                        onChange={(e) => setImportFolder(e.target.value)}
                                        className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 bg-brand-900"
                                    >
                                        <option value="Uncategorized">Uncategorized</option>
                                        {folders.filter(f => f !== 'Uncategorized').map(f => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Column mapping / event templates — optional */}
                                <ColumnMappingPanel
                                    entries={entries}
                                    mappings={activeMappings}
                                    onMappingsChange={setActiveMappings}
                                    selectedTemplateId={selectedTemplateId}
                                    onTemplateSelected={handleTemplateSelected}
                                    onApply={handleApplyMappings}
                                />

                                {importWarning && (
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40">
                                        <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-amber-200">{importWarning}</p>
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    onClick={() => handleImport(true)}
                                                    className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/30"
                                                >
                                                    Import anyway
                                                </button>
                                                <button
                                                    onClick={() => setImportWarning(null)}
                                                    className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-brand-800 text-brand-300"
                                                >
                                                    Keep reviewing
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Entry list — uncertain first via displayedIndices */}
                                <div className="space-y-2 max-h-[45vh] overflow-y-auto">
                                    {displayedIndices.length === 0 && (
                                        <div className="text-center py-8 text-sm text-brand-500">
                                            {reviewFilter === 'needs-review'
                                                ? 'No rows need review — ready to import.'
                                                : reviewFilter === 'ready'
                                                ? 'No ready rows yet — fix uncertain fields first.'
                                                : 'No entries.'}
                                        </div>
                                    )}
                                    {displayedIndices.map((i) => {
                                        const e = entries[i];
                                        const isDup = duplicateMap.has(i);
                                        const isSelected = selectedEntries.has(i);
                                        const needs = entryNeedsReview(e.needsReviewFields, e.confidence, e.reviewResolved);
                                        const uncertainLabels = (e.needsReviewFields || [])
                                            .map(f => FIELD_LABELS[f])
                                            .filter(Boolean);
                                        return (
                                        <div
                                            key={i}
                                            className={`glass border rounded-xl p-3 transition-all ${
                                                needs
                                                    ? 'border-amber-500/50 bg-amber-500/[0.04]'
                                                    : isDup && !isSelected
                                                    ? 'border-amber-500/30 opacity-60'
                                                    : isSelected
                                                    ? 'border-brand-800'
                                                    : 'border-brand-800 opacity-60'
                                            }`}
                                        >
                                            {editingIndex === i ? (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
                                                        Correct uncertain fields, then save
                                                    </p>
                                                    <input type="text" value={editForm.name} onChange={(ev) => setEditForm({...editForm, name: ev.target.value})} placeholder="Name" className={editInputClass(e, 'name')} />
                                                    <input type="text" value={editForm.company} onChange={(ev) => setEditForm({...editForm, company: ev.target.value})} placeholder="Company" className={editInputClass(e, 'company')} />
                                                    <input type="text" value={editForm.position} onChange={(ev) => setEditForm({...editForm, position: ev.target.value})} placeholder="Position" className={editInputClass(e, 'position')} />
                                                    <input type="text" value={editForm.phone} onChange={(ev) => setEditForm({...editForm, phone: ev.target.value})} placeholder="Phone" className={editInputClass(e, 'phone')} />
                                                    <input type="text" value={editForm.email} onChange={(ev) => setEditForm({...editForm, email: ev.target.value})} placeholder="Email" className={editInputClass(e, 'email')} />
                                                    <input type="text" value={editForm.address} onChange={(ev) => setEditForm({...editForm, address: ev.target.value})} placeholder="Address" className={editInputClass(e, 'address')} />
                                                    <input type="text" value={editForm.notes} onChange={(ev) => setEditForm({...editForm, notes: ev.target.value})} placeholder="Notes" className={editInputClass(e, 'notes')} />
                                                    <div className="flex gap-2 pt-1">
                                                        <button onClick={saveEntryEdit} className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-400">
                                                            <Check size={12} /> Save & mark reviewed
                                                        </button>
                                                        <button onClick={() => setEditingIndex(null)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-brand-800 rounded-lg text-xs font-medium text-slate-400">
                                                            <X size={12} /> Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-2">
                                                    {/* Selection checkbox */}
                                                    <button onClick={() => toggleEntrySelection(i)} className="flex-shrink-0 mt-0.5">
                                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-brand-500 border-brand-500' : 'border-brand-600'}`}>
                                                            {isSelected && <Check size={12} className="text-white" />}
                                                        </div>
                                                    </button>
                                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEntryEdit(i)}>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-medium text-sm text-slate-100 truncate">{e.name || 'No name'}</p>
                                                            {needs && (
                                                                <span className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] font-bold text-amber-400">
                                                                    <AlertTriangle size={9} />
                                                                    REVIEW
                                                                </span>
                                                            )}
                                                            {isDup && (
                                                                <span className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] font-bold text-amber-400">
                                                                    <AlertCircle size={9} />
                                                                    DUP
                                                                </span>
                                                            )}
                                                            <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                                e.confidence >= 80
                                                                    ? 'bg-emerald-500/15 text-emerald-400'
                                                                    : e.confidence >= 50
                                                                    ? 'bg-amber-500/15 text-amber-400'
                                                                    : 'bg-red-500/15 text-red-400'
                                                            }`}>
                                                                {Math.round(e.confidence)}%
                                                            </span>
                                                        </div>
                                                        {needs && uncertainLabels.length > 0 && (
                                                            <p className="text-[10px] text-amber-400/80 mt-0.5">
                                                                Check: {uncertainLabels.join(', ')}
                                                            </p>
                                                        )}
                                                        {isDup && duplicateMap.get(i) && (
                                                            <p className="text-[10px] text-amber-400/70 truncate">
                                                                Matches "{duplicateMap.get(i)!.matchedContact?.name}" — {duplicateMap.get(i)!.matchReasons.join(', ')}
                                                            </p>
                                                        )}
                                                        {e.company && (
                                                            <p className={`text-xs truncate ${fieldNeedsReview(e, 'company') ? 'text-amber-300' : 'text-brand-400'}`}>
                                                                {e.company}
                                                            </p>
                                                        )}
                                                        {e.position && <p className={`text-xs truncate ${fieldNeedsReview(e, 'position') ? 'text-amber-300' : 'text-slate-500'}`}>{e.position}</p>}
                                                        {e.phone.length > 0 && <p className={`text-xs truncate ${fieldNeedsReview(e, 'phone') ? 'text-amber-300' : 'text-slate-500'}`}>{e.phone.join(', ')}</p>}
                                                        {e.email.length > 0 && <p className={`text-xs truncate ${fieldNeedsReview(e, 'email') ? 'text-amber-300' : 'text-slate-500'}`}>{e.email.join(', ')}</p>}
                                                        {e.notes && <p className="text-xs text-amber-400/70 truncate mt-1">{e.notes}</p>}
                                                        {e.customFields && Object.keys(e.customFields).length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {Object.entries(e.customFields).map(([k, v]) => (
                                                                    <span
                                                                        key={k}
                                                                        className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/90 border border-sky-500/20 truncate max-w-full"
                                                                        title={`${k}: ${v}`}
                                                                    >
                                                                        {k}: {v}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-1 flex-shrink-0">
                                                        {needs && (
                                                            <button
                                                                onClick={() => markEntryReviewed(i)}
                                                                title="Mark as reviewed"
                                                                className="p-1.5 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                            >
                                                                <Check size={14} className="text-emerald-400" />
                                                            </button>
                                                        )}
                                                        <button onClick={() => openEntryEdit(i)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                                                            <Edit3 size={14} className="text-brand-400" />
                                                        </button>
                                                        <button onClick={() => deleteEntry(i)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors">
                                                            <Trash2 size={14} className="text-red-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom action bar */}
            {entries && entries.length > 0 && !isProcessing && (
                <div className="sticky bottom-0 glass border-t border-brand-800 p-4 space-y-2 z-10">
                    <button
                        onClick={() => handleImport()}
                        disabled={isImporting || selectedEntries.size === 0}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                    >
                        {isImporting ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <Upload size={16} />
                        )}
                        Import {selectedEntries.size} of {entries.length} Contact{entries.length !== 1 ? 's' : ''}
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowExportOptions(!showExportOptions)}
                            className="w-full py-2.5 bg-brand-800 hover:bg-brand-700 rounded-xl font-medium text-sm text-brand-300 transition-colors flex items-center justify-center gap-2"
                        >
                            <Download size={16} />
                            Export Instead
                        </button>
                        {showExportOptions && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 bg-brand-900 rounded-xl border border-brand-800 shadow-2xl overflow-hidden">
                                <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors">
                                    Export as CSV
                                </button>
                                <button onClick={() => handleExport('excel')} className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 border-t border-brand-800 transition-colors">
                                    Export as Excel
                                </button>
                                <button onClick={() => handleExport('crm-csv')} className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 border-t border-brand-800 transition-colors">
                                    CRM-ready CSV
                                </button>
                                <button
                                    onClick={() => { void handleGoogleSheetsExport(); }}
                                    disabled={isExportingSheets}
                                    className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 border-t border-brand-800 transition-colors disabled:opacity-50"
                                >
                                    {isExportingSheets ? 'Exporting to Sheets…' : 'Google Sheets'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {upgradeFeature && (
                <UpgradePrompt feature={upgradeFeature} onDismiss={() => setUpgradeFeature(null)} />
            )}

            {showBatchNaming && entries && !pendingMapping && (
                <BatchNamingModal
                    scanType="log-sheet"
                    totalContacts={entries.length}
                    successCount={selectedEntries.size}
                    errorCount={duplicateMap.size}
                    timestamp={scanTimestamp}
                    onSave={handleSaveBatch}
                    onSkip={handleSkipBatch}
                />
            )}

            {showAddNextPrompt && entries && !showBatchNaming && !pendingMapping && !isProcessing && (
                <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md glass border border-brand-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
                        <div className="text-center space-y-1">
                            <div className="w-11 h-11 mx-auto bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-2">
                                <Layers className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-100">Sheet {sheetCount} captured</h2>
                            <p className="text-xs text-brand-400">
                                {entries.length} rows ready. Add another page of the same log book, or continue to review.
                            </p>
                        </div>
                        <button
                            onClick={() => openGuidedCamera(true)}
                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                        >
                            <Plus size={16} />
                            Add next sheet
                        </button>
                        <button
                            onClick={() => setShowAddNextPrompt(false)}
                            className="w-full py-2.5 bg-brand-800 hover:bg-brand-700 rounded-xl font-medium text-sm text-brand-300"
                        >
                            Continue to review
                        </button>
                    </div>
                </div>
            )}

            {pendingMapping && (
                <ColumnMappingConfirm
                    meta={pendingMapping.meta}
                    sampleEntry={pendingMapping.sample}
                    onConfirm={onMappingConfirm}
                    onSkip={onMappingSkip}
                />
            )}

            {showGuidedCamera && (
                <LogSheetGuidedCamera
                    sheetNumber={guidedAppend ? sheetCount + 1 : 1}
                    onCapture={onGuidedCapture}
                    onClose={() => setShowGuidedCamera(false)}
                    onUseGallery={() => {
                        setShowGuidedCamera(false);
                        if (guidedAppend) addMoreGalRef.current?.click();
                        else galRef.current?.click();
                    }}
                />
            )}


        </div>
    );
};

export default LogScan;
