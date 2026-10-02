import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Image as ImageIcon, Upload, Download, Folder, RotateCcw, AlertTriangle, Edit3, Trash2, Check, X, AlertCircle, Lock, Plus, Layers, Sun } from 'lucide-react';
import { ocrService, LogSheetEntry, LogSheetParseResult } from '@/services/ocr';
import { remapEntries, mappingsEqual } from '@/services/logSheetMapping';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { exportService } from '@/services/export';
import { Contact } from '@/types/contact';
import { Batch } from '@/types/batch';
import { LogSheetColumnMapping, LogSheetParseMeta } from '@/types/logSheet';
import { checkDuplicate, DuplicateResult } from '@/services/duplicateDetection';
import { useAuth } from '@/contexts/AuthContext';
import UpgradePrompt from '@/components/UpgradePrompt';
import BatchNamingModal from '@/components/BatchNamingModal';
import ColumnMappingConfirm from '@/components/ColumnMappingConfirm';
import LogSheetGuidedCamera from '@/components/LogSheetGuidedCamera';
import LogSheetFramingOverlay from '@/components/LogSheetFramingOverlay';
import { compressForOCR } from '@/utils/compressPhoto';

const LogScan: React.FC = () => {
    const navigate = useNavigate();
    const camRef = useRef<HTMLInputElement>(null);
    const galRef = useRef<HTMLInputElement>(null);
    const addMoreCamRef = useRef<HTMLInputElement>(null);
    const addMoreGalRef = useRef<HTMLInputElement>(null);
    const { canPerformScan, incrementScanCount, canExportCSV, canExportExcel, canUseBulkScan } = useAuth();
    const { storage } = useWorkspace();

    const [imageData, setImageData] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [entries, setEntries] = useState<LogSheetEntry[] | null>(null);
    const [importFolder, setImportFolder] = useState('Uncategorized');
    const [folders, setFolders] = useState<string[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [showExportOptions, setShowExportOptions] = useState(false);
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

    // Guided capture + column mapping
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
    }, []);

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

    const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
        Promise.race([
            promise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms))
        ]);

    const parseOpts = () =>
        confirmedMapping ? { columnMapping: confirmedMapping } : undefined;

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
            // Only interrupt on the first sheet of a batch (or when appending without a prior confirm)
            (!append || sheetCount === 0);

        if (shouldConfirm) {
            setPendingMapping({
                meta,
                entries: nextEntries,
                append,
                sample: nextEntries[0] || null,
            });
            return null; // caller should not finish yet
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
        if (append) {
            const combined = [...(entries || []), ...nextEntries];
            setEntries(combined);
            setSheetCount(prev => prev + 1);
            await checkEntriesForDuplicates(combined);
            if (opts?.promptAddNext !== false) setShowAddNextPrompt(true);
        } else {
            setEntries(nextEntries);
            setSheetCount(1);
            await checkEntriesForDuplicates(nextEntries);
            const timestamp = Date.now();
            setScanTimestamp(timestamp);
            if (opts?.openBatchNaming !== false) setShowBatchNaming(true);
            if (opts?.promptAddNext !== false) setShowAddNextPrompt(true);
        }
    };

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

        setProcessingProgress(`Preparing ${files.length} sheets...`);
        const firstData = await compressForOCR(files[0]);
        setImageData(firstData);

        let allEntries = append ? [...(entries || [])] : [];
        let sheetsProcessed = append ? sheetCount : 0;
        const failedIndices: number[] = [];
        let firstMeta: LogSheetParseMeta | null = null;

        for (let i = 0; i < files.length; i++) {
            setProcessingProgress(`Analyzing sheet ${i + 1} of ${files.length}...`);
            try {
                const data = i === 0 ? firstData : await compressForOCR(files[i]);
                setImageData(data);
                const result = await withTimeout(
                    ocrService.parseLogSheet(data, parseOpts()),
                    60000,
                    `Sheet ${i + 1}`
                );
                if (i === 0) firstMeta = result.meta;
                if (result.entries.length > 0) {
                    await incrementScanCount();
                    allEntries = [...allEntries, ...result.entries];
                    sheetsProcessed++;
                }
            } catch (err: any) {
                failedIndices.push(i);
                console.error(`Failed to process sheet ${i + 1}:`, err?.message || err);
            }
            if (i < files.length - 1) {
                const baseDelay = failedIndices.length > 0 ? 10000 : 6000;
                const progressiveDelay = baseDelay + (i * 2000);
                setProcessingProgress(`Preparing next sheet...`);
                await new Promise(r => setTimeout(r, progressiveDelay));
            }
        }

        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES && failedIndices.length > 0 && failedIndices.length < files.length; attempt++) {
            const retryDelay = 10000 + (attempt * 4000);
            for (let r = failedIndices.length - 1; r >= 0; r--) {
                const idx = failedIndices[r];
                setProcessingProgress(`Re-analyzing sheet ${idx + 1}... (attempt ${attempt + 1})`);
                await new Promise(res => setTimeout(res, retryDelay));
                try {
                    const data = await compressForOCR(files[idx]);
                    const result = await withTimeout(
                        ocrService.parseLogSheet(data, parseOpts()),
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
            // Multi-file: if first sheet headers were ambiguous and no mapping yet, confirm once
            if (firstMeta?.headersAmbiguous && !confirmedMapping && !append) {
                setPendingMapping({
                    meta: firstMeta,
                    entries: allEntries,
                    append: false,
                    sample: allEntries[0] || null,
                });
                setIsProcessing(false);
                return;
            }

            setEntries(allEntries);
            if (failedIndices.length > 0) {
                const nums = failedIndices.map(i => i + 1);
                setError(`partial:Sheet${nums.length > 1 ? 's' : ''} ${nums.join(', ')} couldn't be read. You can add them again later.`);
            }
            await checkEntriesForDuplicates(allEntries);
            const timestamp = Date.now();
            setScanTimestamp(timestamp);
            setShowBatchNaming(true);
            setShowAddNextPrompt(true);
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
                selected.add(index);
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

    const parseWithRetry = async (base64Image: string): Promise<LogSheetParseResult> => {
        const MAX_SILENT_RETRIES = 2;
        for (let attempt = 0; attempt <= MAX_SILENT_RETRIES; attempt++) {
            try {
                return await withTimeout(
                    ocrService.parseLogSheet(base64Image, parseOpts()),
                    60000,
                    `Sheet attempt ${attempt + 1}`
                );
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

    const handleImport = async () => {
        if (!entries) return;
        const toImport = entries.filter((_, i) => selectedEntries.has(i));
        if (toImport.length === 0) return;
        setIsImporting(true);
        await storage.batchSave(entriesToContacts(toImport));
        if (importFolder !== 'Uncategorized') {
            await storage.saveFolder(importFolder);
        }
        setIsImporting(false);
        navigate('/contacts');
    };

    const handleExport = (type: 'csv' | 'excel') => {
        if (!entries) return;
        if (type === 'csv' && !canExportCSV()) { setUpgradeFeature('export'); return; }
        if (type === 'excel' && !canExportExcel()) { setUpgradeFeature('export'); return; }
        const selected = entries.filter((_, i) => selectedEntries.has(i));
        const contacts = entriesToContacts(selected.length > 0 ? selected : entries);
        if (type === 'csv') exportService.toCSV(contacts);
        else exportService.toExcel(contacts);
        setShowExportOptions(false);
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
        };
        setEntries(updated);
        setEditingIndex(null);
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

                        {/* Static framing guide preview */}
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
                        <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-brand-800 relative">
                            <img src={imageData} alt="Log sheet" className="w-full object-contain max-h-48" />
                        </div>
                        <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-400" />
                            <p className="text-sm text-brand-400 font-medium">{processingProgress || 'Analyzing log sheet...'}</p>
                            <p className="text-xs text-brand-600">Reading table structure and rows</p>
                        </div>
                    </div>
                )}

                <input ref={addMoreCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAddMoreImage} />
                <input ref={addMoreGalRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddMoreImage} />

                {/* Stage 3: Results (or error while waiting on column mapping) */}
                {imageData && !isProcessing && (entries || error || pendingMapping) && (
                    <div className="space-y-4">
                        <div className="w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-brand-800">
                            <img src={imageData} alt="Log sheet" className="w-full object-contain max-h-32" />
                        </div>

                        {sheetCount > 0 && entries && (
                            <div className="flex items-center justify-center gap-2">
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-500/15 text-brand-300 border border-brand-500/30">
                                    {sheetCount} sheet{sheetCount !== 1 ? 's' : ''}
                                </span>
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                    {entries.length} row{entries.length !== 1 ? 's' : ''}
                                </span>
                                {confirmedMapping && (
                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                        Columns mapped
                                    </span>
                                )}
                            </div>
                        )}

                        {mappingBanner && (
                            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30">
                                <p className="text-xs text-sky-200">{mappingBanner}</p>
                                <button onClick={() => setMappingBanner(null)} className="text-sky-400 p-1">
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

                        {pendingMapping && !entries && (
                            <div className="text-center py-6 text-sm text-brand-400">
                                Waiting for column mapping confirm…
                            </div>
                        )}

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

                                    {/* Add next sheet — primary multi-page CTA */}
                                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Plus size={16} className="text-emerald-400" />
                                            <p className="text-sm font-semibold text-emerald-200">Add next sheet</p>
                                        </div>
                                        <p className="text-[11px] text-emerald-400/80">
                                            Page {sheetCount} done. Capture the next page of the same sign-in book — rows append to this batch.
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openGuidedCamera(true)}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl transition-colors text-sm font-medium text-emerald-200 active:scale-95"
                                            >
                                                <Camera size={15} />
                                                Guided
                                            </button>
                                            <button
                                                onClick={() => addMoreCamRef.current?.click()}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-xl transition-colors text-sm font-medium text-brand-300 active:scale-95"
                                            >
                                                <Camera size={15} />
                                                Camera
                                            </button>
                                            <button
                                                onClick={() => addMoreGalRef.current?.click()}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-xl transition-colors text-sm font-medium text-brand-300 active:scale-95"
                                            >
                                                <ImageIcon size={15} />
                                                Gallery
                                            </button>
                                        </div>
                                    </div>
                                </div>

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

                                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                                    {entries.map((e, i) => {
                                        const isDup = duplicateMap.has(i);
                                        const isSelected = selectedEntries.has(i);
                                        return (
                                        <div key={i} className={`glass border rounded-xl p-3 transition-all ${isDup && !isSelected ? 'border-amber-500/30 opacity-60' : isSelected ? 'border-brand-800' : 'border-brand-800 opacity-60'}`}>
                                            {editingIndex === i ? (
                                                <div className="space-y-2">
                                                    <input type="text" value={editForm.name} onChange={(ev) => setEditForm({...editForm, name: ev.target.value})} placeholder="Name" className="w-full glass border border-brand-700 rounded-lg py-2 px-3 text-sm" />
                                                    <input type="text" value={editForm.company} onChange={(ev) => setEditForm({...editForm, company: ev.target.value})} placeholder="Company" className="w-full glass border border-brand-700 rounded-lg py-2 px-3 text-sm" />
                                                    <input type="text" value={editForm.position} onChange={(ev) => setEditForm({...editForm, position: ev.target.value})} placeholder="Position" className="w-full glass border border-brand-700 rounded-lg py-2 px-3 text-sm" />
                                                    <input type="text" value={editForm.phone} onChange={(ev) => setEditForm({...editForm, phone: ev.target.value})} placeholder="Phone" className="w-full glass border border-brand-700 rounded-lg py-2 px-3 text-sm" />
                                                    <input type="text" value={editForm.email} onChange={(ev) => setEditForm({...editForm, email: ev.target.value})} placeholder="Email" className="w-full glass border border-brand-700 rounded-lg py-2 px-3 text-sm" />
                                                    <input type="text" value={editForm.address} onChange={(ev) => setEditForm({...editForm, address: ev.target.value})} placeholder="Address" className="w-full glass border border-brand-700 rounded-lg py-2 px-3 text-sm" />
                                                    <input type="text" value={editForm.notes} onChange={(ev) => setEditForm({...editForm, notes: ev.target.value})} placeholder="Notes" className="w-full glass border border-brand-700 rounded-lg py-2 px-3 text-sm" />
                                                    <div className="flex gap-2 pt-1">
                                                        <button onClick={saveEntryEdit} className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-400">
                                                            <Check size={12} /> Save
                                                        </button>
                                                        <button onClick={() => setEditingIndex(null)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-brand-800 rounded-lg text-xs font-medium text-slate-400">
                                                            <X size={12} /> Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-2">
                                                    <button onClick={() => toggleEntrySelection(i)} className="flex-shrink-0 mt-0.5">
                                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-brand-500 border-brand-500' : 'border-brand-600'}`}>
                                                            {isSelected && <Check size={12} className="text-white" />}
                                                        </div>
                                                    </button>
                                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEntryEdit(i)}>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-sm text-slate-100 truncate">{e.name || 'No name'}</p>
                                                            {isDup && (
                                                                <span className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] font-bold text-amber-400">
                                                                    <AlertCircle size={9} />
                                                                    DUP
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isDup && duplicateMap.get(i) && (
                                                            <p className="text-[10px] text-amber-400/70 truncate">
                                                                Matches "{duplicateMap.get(i)!.matchedContact?.name}" — {duplicateMap.get(i)!.matchReasons.join(', ')}
                                                            </p>
                                                        )}
                                                        {e.company && <p className="text-xs text-brand-400 truncate">{e.company}</p>}
                                                        {e.position && <p className="text-xs text-slate-500 truncate">{e.position}</p>}
                                                        {e.phone.length > 0 && <p className="text-xs text-slate-500 truncate">{e.phone.join(', ')}</p>}
                                                        {e.email.length > 0 && <p className="text-xs text-slate-500 truncate">{e.email.join(', ')}</p>}
                                                        {e.notes && <p className="text-xs text-amber-400/70 truncate mt-1">{e.notes}</p>}
                                                    </div>
                                                    <div className="flex flex-col gap-1 flex-shrink-0">
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

            {entries && entries.length > 0 && !isProcessing && (
                <div className="sticky bottom-0 glass border-t border-brand-800 p-4 space-y-2 z-10">
                    <button
                        onClick={handleImport}
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

            {/* Add-next-sheet prompt after first successful parse */}
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
