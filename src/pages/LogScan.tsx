import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Image as ImageIcon, Upload, Download, Folder, RotateCcw, AlertTriangle, Edit3, Trash2, Check, X, AlertCircle, Plus } from 'lucide-react';
import { ocrService, LogSheetEntry } from '@/services/ocr';
import { storage } from '@/services/storage';
import { exportService } from '@/services/export';
import { Contact } from '@/types/contact';
import { checkDuplicate, DuplicateResult } from '@/services/duplicateDetection';
import { useAuth } from '@/contexts/AuthContext';
import UpgradePrompt from '@/components/UpgradePrompt';
import { compressForOCR } from '@/utils/compressPhoto';

const LogScan: React.FC = () => {
    const navigate = useNavigate();
    const camRef = useRef<HTMLInputElement>(null);
    const galRef = useRef<HTMLInputElement>(null);
    const addMoreCamRef = useRef<HTMLInputElement>(null);
    const addMoreGalRef = useRef<HTMLInputElement>(null);
    const { canPerformScan, incrementScanCount, canExportCSV, canExportExcel } = useAuth();

    const [imageData, setImageData] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [entries, setEntries] = useState<LogSheetEntry[] | null>(null);
    const [importFolder, setImportFolder] = useState('Uncategorized');
    const [folders, setFolders] = useState<string[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<LogSheetEntry>({ name: '', company: '', position: '', phone: '', email: '', address: '', notes: '' });
    const [duplicateMap, setDuplicateMap] = useState<Map<number, DuplicateResult>>(new Map());
    const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
    const [sheetCount, setSheetCount] = useState(0);
    const [showAddMoreSheet, setShowAddMoreSheet] = useState(false);
    const [processingProgress, setProcessingProgress] = useState<string | null>(null);

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

        if (fileArr.length === 1) {
            const data = await compressForOCR(fileArr[0]);
            setImageData(data);
            processLogSheetAppend(data);
        } else {
            processMultipleSheets(fileArr, true);
        }
    };

    const processMultipleSheets = async (files: File[], append: boolean) => {
        if (!canPerformScan()) {
            setShowUpgradePrompt(true);
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

        const compressedImages: string[] = [];
        for (let i = 0; i < files.length; i++) {
            setProcessingProgress(`Analyzing sheet ${i + 1} of ${files.length}...`);
            const data = i === 0 ? firstData : await compressForOCR(files[i]);
            compressedImages.push(data);
            setImageData(data);
            try {
                const results = await ocrService.parseLogSheet(data);
                if (results.length > 0) {
                    await incrementScanCount();
                    allEntries = [...allEntries, ...results];
                    sheetsProcessed++;
                }
            } catch (err: any) {
                failedIndices.push(i);
                console.error(`Failed to process sheet ${i + 1}:`, err?.message || err);
            }
            // Brief pause between API calls to avoid Gemini rate limits
            if (i < files.length - 1) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        // Retry failed sheets once with a longer delay
        if (failedIndices.length > 0 && failedIndices.length < files.length) {
            for (const idx of [...failedIndices]) {
                setProcessingProgress(`Retrying sheet ${idx + 1}...`);
                await new Promise(r => setTimeout(r, 3000));
                try {
                    const results = await ocrService.parseLogSheet(compressedImages[idx]);
                    if (results.length > 0) {
                        await incrementScanCount();
                        allEntries = [...allEntries, ...results];
                        sheetsProcessed++;
                        failedIndices.splice(failedIndices.indexOf(idx), 1);
                    }
                } catch (err: any) {
                    console.error(`Retry failed for sheet ${idx + 1}:`, err?.message || err);
                }
            }
        }

        setProcessingProgress(null);
        setSheetCount(sheetsProcessed);
        if (allEntries.length > 0) {
            setEntries(allEntries);
            if (failedIndices.length > 0) {
                const nums = failedIndices.map(i => i + 1);
                setError(`Sheet${nums.length > 1 ? 's' : ''} ${nums.join(', ')} failed to process.`);
            }
            await checkEntriesForDuplicates(allEntries);
        } else {
            setEntries(null);
            setError(failedIndices.length > 0
                ? `All ${files.length} sheets failed (${failedIndices.join(', ')}). Try selecting fewer sheets or use camera instead.`
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
                    email: entry.email ? [entry.email] : [],
                    phone: entry.phone ? [entry.phone] : [],
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

    const processLogSheetAppend = async (base64Image: string) => {
        if (!canPerformScan()) {
            setShowUpgradePrompt(true);
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const results = await ocrService.parseLogSheet(base64Image);
            if (results.length === 0) {
                setError('No entries found on this sheet.');
            } else {
                await incrementScanCount();
                const prevEntries = entries || [];
                const combined = [...prevEntries, ...results];
                setEntries(combined);
                setSheetCount(prev => prev + 1);
                await checkEntriesForDuplicates(combined);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process log sheet');
        } finally {
            setIsProcessing(false);
        }
    };

    const processLogSheet = async (base64Image: string) => {
        if (!canPerformScan()) {
            setShowUpgradePrompt(true);
            return;
        }

        setIsProcessing(true);
        setError(null);
        setEntries(null);
        setDuplicateMap(new Map());
        setSelectedEntries(new Set());

        try {
            const results = await ocrService.parseLogSheet(base64Image);
            setEntries(results);
            if (results.length === 0) {
                setError('No entries found. Make sure the log sheet is clearly visible.');
            } else {
                await incrementScanCount();
                setSheetCount(1);
                await checkEntriesForDuplicates(results);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process log sheet');
        } finally {
            setIsProcessing(false);
        }
    };

    const entriesToContacts = (list: LogSheetEntry[]): Contact[] =>
        list.map(e => ({
            id: crypto.randomUUID(),
            name: e.name,
            position: e.position,
            company: e.company,
            phone: e.phone ? [e.phone] : [],
            email: e.email ? [e.email] : [],
            address: e.address,
            notes: e.notes,
            folder: importFolder || 'Uncategorized',
            rawText: '',
            imageData: '',
            confidence: 85,
            isVerified: false,
            createdAt: Date.now(),
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
        if (type === 'csv' && !canExportCSV()) { setShowUpgradePrompt(true); return; }
        if (type === 'excel' && !canExportExcel()) { setShowUpgradePrompt(true); return; }
        const contacts = entriesToContacts(entries);
        if (type === 'csv') exportService.toCSV(contacts);
        else exportService.toExcel(contacts);
        setShowExportOptions(false);
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
    };

    const openEntryEdit = (index: number) => {
        setEditingIndex(index);
        setEditForm({ ...entries![index] });
    };

    const saveEntryEdit = () => {
        if (editingIndex === null || !entries) return;
        const updated = [...entries];
        updated[editingIndex] = { ...editForm };
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
        if (editingIndex === index) setEditingIndex(null);
    };

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between glass sticky top-0 z-10 p-4">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">Log Sheet Scan</h1>
                <div className="w-10" />
            </div>

            <div className="flex-1 p-4">
                {/* Stage 1: Capture */}
                {!imageData && (
                    <div className="flex flex-col items-center justify-center gap-6 py-12">
                        <div className="text-center space-y-2 mb-4">
                            <h2 className="text-xl font-bold text-slate-100">Scan a Log Sheet</h2>
                            <p className="text-sm text-brand-400 max-w-xs mx-auto">
                                Take a photo of an event sign-in sheet. Each row will be parsed into a separate contact.
                            </p>
                        </div>

                        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
                        <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />

                        <div className="w-full max-w-sm space-y-3">
                            <button
                                onClick={() => camRef.current?.click()}
                                className="w-full flex items-center justify-center gap-3 py-4 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-2xl transition-colors active:scale-95"
                            >
                                <Camera size={22} className="text-brand-400" />
                                <span className="font-semibold text-brand-300">Take Photo</span>
                            </button>
                            <button
                                onClick={() => galRef.current?.click()}
                                className="w-full flex items-center justify-center gap-3 py-4 bg-brand-800/50 hover:bg-brand-800 border border-brand-800 rounded-2xl transition-colors active:scale-95"
                            >
                                <ImageIcon size={22} className="text-brand-400" />
                                <span className="font-semibold text-brand-300">Choose from Gallery</span>
                            </button>
                        </div>

                        <div className="glass border border-brand-800 rounded-xl p-4 max-w-sm mt-4">
                            <p className="text-[10px] text-brand-500 uppercase tracking-wider font-bold mb-2">Tips</p>
                            <ul className="text-xs text-brand-400 space-y-1">
                                <li>- Ensure the sheet is flat and well-lit</li>
                                <li>- Printed sheets work best</li>
                                <li>- Include all rows in the frame</li>
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
                {imageData && !isProcessing && (entries || error) && (
                    <div className="space-y-4">
                        {/* Small image preview */}
                        <div className="w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-brand-800">
                            <img src={imageData} alt="Log sheet" className="w-full object-contain max-h-32" />
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-red-300">{error}</p>
                                    <button onClick={() => processLogSheet(imageData)} className="text-xs text-red-400 underline mt-1">
                                        Retry
                                    </button>
                                </div>
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
                                    <button
                                        onClick={() => setShowAddMoreSheet(true)}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-xl transition-colors text-sm font-medium text-brand-300"
                                    >
                                        <Plus size={16} />
                                        Add Another Sheet
                                    </button>
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

                                {/* Entry list */}
                                <div className="space-y-2 max-h-[45vh] overflow-y-auto">
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
                                                    {/* Selection checkbox */}
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
                                                        {e.phone && <p className="text-xs text-slate-500 truncate">{e.phone}</p>}
                                                        {e.email && <p className="text-xs text-slate-500 truncate">{e.email}</p>}
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

            {/* Bottom action bar */}
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

            {showUpgradePrompt && (
                <UpgradePrompt feature="export" onDismiss={() => setShowUpgradePrompt(false)} />
            )}

            {/* Add More Sheet Action Sheet */}
            {showAddMoreSheet && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setShowAddMoreSheet(false)}>
                    <div className="bg-brand-900 rounded-t-2xl w-full max-w-md border-t border-brand-800 p-4 space-y-2 animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="w-8 h-1 bg-brand-700 rounded-full mx-auto mb-3" />
                        <p className="text-sm font-semibold text-brand-300 text-center mb-2">Add Another Sheet</p>
                        <button
                            onClick={() => { addMoreCamRef.current?.click(); setShowAddMoreSheet(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 rounded-xl transition-colors"
                        >
                            <Camera size={20} className="text-brand-400" />
                            <span className="text-sm font-medium">Take Photo</span>
                        </button>
                        <button
                            onClick={() => { addMoreGalRef.current?.click(); setShowAddMoreSheet(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 rounded-xl transition-colors"
                        >
                            <ImageIcon size={20} className="text-brand-400" />
                            <span className="text-sm font-medium">Choose from Gallery</span>
                        </button>
                        <button
                            onClick={() => setShowAddMoreSheet(false)}
                            className="w-full py-3 bg-brand-800 hover:bg-brand-700 rounded-xl font-medium text-sm text-brand-400 transition-colors mt-2"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LogScan;
