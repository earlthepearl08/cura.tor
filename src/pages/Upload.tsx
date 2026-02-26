import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Trash2, ArrowLeft, Play, CheckCircle, AlertCircle, Loader2, Edit3, Save, Users, Square, CheckSquare, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storage } from '@/services/storage';
import { ocrService, OCRResult } from '@/services/ocr';
import { Contact } from '@/types/contact';
import ContactReview from '@/components/ContactReview';
import { checkDuplicate } from '@/services/duplicateDetection';

interface QueuedFile {
    id: string;
    file: File;
    preview: string;
    dataURL: string;
    status: 'queued' | 'processing' | 'completed' | 'error';
    error?: string;
    ocrResult?: OCRResult;
}

/** Convert a File to a base64 data URL */
const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

const Uploader: React.FC = () => {
    const [queue, setQueue] = useState<QueuedFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedCount, setProcessedCount] = useState(0);
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [duplicateIds, setDuplicateIds] = useState<Map<string, string>>(new Map()); // id -> reason
    const navigate = useNavigate();

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const newFiles: QueuedFile[] = [];
        for (const file of acceptedFiles) {
            const dataURL = await fileToDataURL(file);
            newFiles.push({
                id: crypto.randomUUID(),
                file,
                preview: URL.createObjectURL(file),
                dataURL,
                status: 'queued' as const
            });
        }
        setQueue(prev => [...prev, ...newFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png']
        },
        disabled: isProcessing
    });

    const removeFile = (id: string) => {
        if (isProcessing) return;
        setQueue(prev => {
            const filtered = prev.filter(item => item.id !== id);
            const removed = prev.find(item => item.id === id);
            if (removed) URL.revokeObjectURL(removed.preview);
            return filtered;
        });
    };

    const processOneItem = async (item: QueuedFile): Promise<{ id: string; ocrResult: OCRResult } | null> => {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing', error: undefined } : q));
        try {
            const result = await ocrService.processImage(item.dataURL);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed', ocrResult: result } : q));
            setSelectedIds(prev => new Set(prev).add(item.id));
            setProcessedCount(prev => prev + 1);
            return { id: item.id, ocrResult: result };
        } catch (error: any) {
            const errorMsg = error?.message || 'Processing failed';
            console.error(`Failed to process ${item.file.name}:`, error);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: errorMsg } : q));
            setProcessedCount(prev => prev + 1);
            return null;
        }
    };

    const startProcessing = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setProcessedCount(0);

        const items = [...queue].filter(item => item.status !== 'completed');
        const BATCH_SIZE = 3;
        const completedResults: Array<{ id: string; ocrResult: OCRResult }> = [];

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map(item => processOneItem(item)));
            for (const r of results) {
                if (r) completedResults.push(r);
            }
        }

        setIsProcessing(false);
        runDuplicateCheck(completedResults);
    };

    const runDuplicateCheck = async (completedResults: Array<{ id: string; ocrResult: OCRResult }>) => {
        const existingContacts = await storage.getAllContacts();
        const dupes = new Map<string, string>();
        const seenInBatch: Array<{ id: string; ocrResult: OCRResult }> = [];

        console.log(`[DupeCheck] Checking ${completedResults.length} results against ${existingContacts.length} stored contacts`);

        for (const item of completedResults) {
            const r = item.ocrResult;
            const asPartialContact = {
                name: r.name,
                email: r.email,
                phone: r.phone,
                company: r.company,
            };

            console.log(`[DupeCheck] Item: "${r.name}" | company: "${r.company}" | emails: [${r.email}] | phones: [${r.phone}]`);

            // Check against existing stored contacts
            const storedResult = checkDuplicate(asPartialContact, existingContacts);
            console.log(`[DupeCheck] vs stored → score: ${storedResult.matchScore}, isDupe: ${storedResult.isDuplicate}, reasons: [${storedResult.matchReasons}]`);
            if (storedResult.isDuplicate) {
                dupes.set(item.id, `Duplicate of "${storedResult.matchedContact?.name}"`);
                continue;
            }

            // Check against earlier items in this batch
            let batchDupeFound = false;
            for (const seen of seenInBatch) {
                const batchResult = checkDuplicate(asPartialContact, [{
                    id: seen.id,
                    name: seen.ocrResult.name,
                    email: seen.ocrResult.email,
                    phone: seen.ocrResult.phone,
                    company: seen.ocrResult.company,
                } as any]);
                console.log(`[DupeCheck] vs batch "${seen.ocrResult.name}" → score: ${batchResult.matchScore}, isDupe: ${batchResult.isDuplicate}`);
                if (batchResult.isDuplicate) {
                    dupes.set(item.id, `Same as "${seen.ocrResult.name}" in this batch`);
                    batchDupeFound = true;
                    break;
                }
            }

            if (!batchDupeFound) {
                seenInBatch.push(item);
            }
        }

        console.log(`[DupeCheck] Result: ${dupes.size} duplicates found`, [...dupes.entries()]);

        setDuplicateIds(dupes);

        // Auto-deselect duplicates
        if (dupes.size > 0) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                for (const id of dupes.keys()) next.delete(id);
                return next;
            });
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const completedIds = queue.filter(q => q.status === 'completed' && q.ocrResult).map(q => q.id);
        const allSelected = completedIds.every(id => selectedIds.has(id));
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(completedIds));
        }
    };

    const saveAndContinue = async () => {
        const completed = queue.filter(q => q.status === 'completed' && q.ocrResult && selectedIds.has(q.id));
        for (const item of completed) {
            const result = item.ocrResult!;
            const contact: Contact = {
                id: item.id,
                name: result.name,
                position: result.position,
                company: result.company,
                phone: result.phone,
                email: result.email,
                address: result.address,
                rawText: result.rawText,
                imageData: item.dataURL,
                confidence: result.confidence,
                isVerified: false,
                notes: '',
                folder: 'Uncategorized',
                createdAt: Date.now()
            };
            await storage.saveContact(contact);
        }
        navigate('/contacts');
    };

    const totalItems = queue.length;
    const completedItems = queue.filter(q => q.status === 'completed').length;
    const errorItems = queue.filter(q => q.status === 'error').length;
    const selectedCount = queue.filter(q => q.status === 'completed' && selectedIds.has(q.id)).length;
    const hasResults = !isProcessing && completedItems > 0;

    const getStatusDisplay = (item: QueuedFile) => {
        switch (item.status) {
            case 'processing':
                return <span className="text-sky-400">Processing...</span>;
            case 'completed':
                return <span className="text-emerald-400">{item.ocrResult?.name || 'Done'}</span>;
            case 'error':
                return <span className="text-red-400">{item.error || 'Failed'}</span>;
            default:
                return <span className="text-brand-500">Queued</span>;
        }
    };

    const getStatusIcon = (item: QueuedFile) => {
        switch (item.status) {
            case 'processing':
                return <Loader2 size={20} className="text-sky-400 animate-spin" />;
            case 'completed':
                return <CheckCircle size={20} className="text-emerald-400" />;
            case 'error':
                return <AlertCircle size={20} className="text-red-400" />;
            default:
                return null;
        }
    };

    // Find the item being reviewed
    const reviewItem = reviewingId ? queue.find(q => q.id === reviewingId) : null;

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 glass sticky top-0 z-10">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">Upload Cards</h1>
                <div className="w-10" />
            </div>

            <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
                {/* Dropzone */}
                <div
                    {...getRootProps()}
                    className={`relative border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center
            ${isProcessing ? 'opacity-50 pointer-events-none border-brand-800' :
                        isDragActive
                            ? 'border-brand-400 bg-brand-400/10 scale-[1.02]'
                            : 'border-brand-700 hover:border-brand-500 glass'}`}
                >
                    <input {...getInputProps()} />
                    <div className="p-6 rounded-full bg-brand-500/10 text-brand-400 mb-4">
                        <Upload size={48} />
                    </div>
                    <h2 className="text-xl font-medium mb-2">Drop your cards here</h2>
                    <p className="text-brand-500 text-sm">Supports JPG, PNG (Bulk upload available)</p>
                </div>

                {/* Queue Management */}
                {queue.length > 0 && (
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-brand-500">
                                {isProcessing
                                    ? `Processing ${processedCount} of ${totalItems}...`
                                    : hasResults
                                        ? `${completedItems}/${totalItems} ready for review${errorItems > 0 ? ` (${errorItems} failed)` : ''}`
                                        : `Process Queue (${totalItems})`
                                }
                            </h3>
                            {!hasResults && (
                                <button
                                    onClick={startProcessing}
                                    disabled={isProcessing}
                                    className="flex items-center gap-2 px-4 py-2 bg-brand-100 text-brand-950 rounded-xl font-semibold hover:bg-white transition-all shadow-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Play size={16} fill="currentColor" />
                                            Process All
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Progress Bar */}
                        {isProcessing && (
                            <div className="w-full h-1.5 bg-brand-800 rounded-full mb-4 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-sky-500 to-brand-400 rounded-full transition-all duration-500"
                                    style={{ width: `${(processedCount / totalItems) * 100}%` }}
                                />
                            </div>
                        )}

                        <div className="space-y-3">
                            {queue.map((item) => (
                                <div
                                    key={item.id}
                                    className={`flex items-center p-3 glass rounded-2xl group transition-all ${
                                        item.status === 'processing' ? 'border border-sky-500/30' :
                                        item.status === 'completed' && duplicateIds.has(item.id) ? 'border border-amber-500/30' :
                                        item.status === 'completed' ? 'border border-emerald-500/20' :
                                        item.status === 'error' ? 'border border-red-500/30' :
                                        'border border-transparent'
                                    }`}
                                >
                                    {/* Selection checkbox for completed cards */}
                                    {item.status === 'completed' ? (
                                        <button
                                            onClick={() => toggleSelect(item.id)}
                                            className="mr-3 flex-shrink-0 text-emerald-400 hover:text-emerald-300 transition-colors"
                                        >
                                            {selectedIds.has(item.id)
                                                ? <CheckSquare size={20} />
                                                : <Square size={20} className="text-brand-600" />
                                            }
                                        </button>
                                    ) : null}
                                    <div
                                        className={`w-20 aspect-[1.586/1] rounded-lg overflow-hidden border border-brand-700 mr-4 flex-shrink-0 ${item.status === 'completed' ? 'cursor-pointer' : ''}`}
                                        onClick={() => item.status === 'completed' && setReviewingId(item.id)}
                                    >
                                        <img src={item.preview} alt="preview" className="h-full w-full object-cover" />
                                    </div>
                                    <div
                                        className={`flex-1 min-w-0 ${item.status === 'completed' ? 'cursor-pointer' : ''}`}
                                        onClick={() => item.status === 'completed' && setReviewingId(item.id)}
                                    >
                                        <p className="text-sm font-medium truncate">
                                            {item.status === 'completed' && item.ocrResult?.name
                                                ? item.ocrResult.name
                                                : item.file.name}
                                        </p>
                                        <p className="text-[10px] uppercase">
                                            {item.status === 'completed' && item.ocrResult
                                                ? duplicateIds.has(item.id)
                                                    ? <span className="text-amber-400 normal-case flex items-center gap-1"><AlertTriangle size={10} />{duplicateIds.get(item.id)}</span>
                                                    : <span className="text-slate-500 normal-case">{item.ocrResult.company || 'No company'}</span>
                                                : <>{(item.file.size / 1024).toFixed(1)} KB &bull; {getStatusDisplay(item)}</>
                                            }
                                        </p>
                                    </div>
                                    {item.status === 'completed' ? (
                                        <button
                                            onClick={() => setReviewingId(item.id)}
                                            className="p-2 text-brand-400 hover:text-white transition-all"
                                            title="Review & edit"
                                        >
                                            <Edit3 size={18} />
                                        </button>
                                    ) : getStatusIcon(item) || (
                                        <button
                                            onClick={() => removeFile(item.id)}
                                            className={`p-2 text-brand-600 hover:text-red-400 transition-all ${isProcessing ? 'invisible' : 'opacity-0 group-hover:opacity-100'}`}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Review & Save section */}
                        {hasResults && (
                            <div className="mt-6 space-y-3">
                                {duplicateIds.size > 0 && (
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
                                        <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
                                        <p className="text-sm text-amber-400">
                                            {duplicateIds.size} duplicate{duplicateIds.size > 1 ? 's' : ''} detected and deselected. You can still select them manually to save.
                                        </p>
                                    </div>
                                )}
                                <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl flex items-center gap-3">
                                    <Edit3 size={18} className="text-sky-400 flex-shrink-0" />
                                    <p className="text-sm text-sky-400">
                                        Tap any card to review and edit before saving. Use checkboxes to choose which to save.
                                    </p>
                                </div>
                                <div className="flex items-center justify-between px-1">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="flex items-center gap-2 text-xs font-medium text-brand-400 hover:text-white transition-colors"
                                    >
                                        {selectedCount === completedItems
                                            ? <CheckSquare size={16} />
                                            : <Square size={16} />
                                        }
                                        {selectedCount === completedItems ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <span className="text-xs text-slate-500">
                                        {selectedCount} of {completedItems} selected
                                    </span>
                                </div>
                                <button
                                    onClick={saveAndContinue}
                                    disabled={selectedCount === 0}
                                    className="w-full py-4 bg-brand-100 text-brand-950 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Save size={20} />
                                    {selectedCount === completedItems
                                        ? `Save All ${completedItems} Contact${completedItems > 1 ? 's' : ''}`
                                        : `Save ${selectedCount} Selected Contact${selectedCount > 1 ? 's' : ''}`
                                    }
                                </button>
                            </div>
                        )}

                        {!isProcessing && errorItems > 0 && completedItems === 0 && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                                <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
                                <p className="text-sm text-red-400">
                                    All images failed to process. Check your internet connection and try again.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <footer className="p-6 text-center text-xs text-brand-600">
                Images are processed sequentially using Cloud Vision + Gemini AI.
            </footer>

            {/* ContactReview modal for individual card editing */}
            {reviewItem && reviewItem.ocrResult && (
                <ContactReview
                    reviewOnly
                    ocrResult={reviewItem.ocrResult}
                    imageData={reviewItem.dataURL}
                    onCancel={() => setReviewingId(null)}
                    onSave={(contact) => {
                        // Update the queue item's OCR result with edited data
                        setQueue(prev => prev.map(q => q.id === reviewItem.id ? {
                            ...q,
                            ocrResult: {
                                ...q.ocrResult!,
                                name: contact.name,
                                position: contact.position,
                                company: contact.company,
                                phone: contact.phone,
                                email: contact.email,
                                address: contact.address,
                            }
                        } : q));
                        setReviewingId(null);
                    }}
                />
            )}
        </div>
    );
};

export default Uploader;
