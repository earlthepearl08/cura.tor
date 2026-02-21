import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Trash2, ArrowLeft, Play, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storage } from '@/services/storage';
import { ocrService } from '@/services/ocr';
import { Contact } from '@/types/contact';

interface QueuedFile {
    id: string;
    file: File;
    preview: string;
    status: 'queued' | 'processing' | 'completed' | 'error';
    error?: string;
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
    const navigate = useNavigate();
    const successCountRef = useRef(0);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const newFiles = acceptedFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            preview: URL.createObjectURL(file),
            status: 'queued' as const
        }));
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

    const startProcessing = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setProcessedCount(0);
        successCountRef.current = 0;

        const items = [...queue].filter(item => item.status !== 'completed');
        const total = items.length;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            setProcessedCount(i + 1);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing', error: undefined } : q));

            try {
                // Convert File to base64 data URL (Cloud Vision needs base64, not blob URLs)
                const dataURL = await fileToDataURL(item.file);
                const result = await ocrService.processImage(dataURL);
                const contact: Contact = {
                    id: item.id,
                    name: result.name,
                    position: result.position,
                    company: result.company,
                    phone: result.phone,
                    email: result.email,
                    address: result.address,
                    rawText: result.rawText,
                    imageData: dataURL,
                    confidence: result.confidence,
                    isVerified: false,
                    notes: '',
                    createdAt: Date.now()
                };

                await storage.saveContact(contact);
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed' } : q));
                successCountRef.current++;
            } catch (error: any) {
                const errorMsg = error?.message || 'Processing failed';
                console.error(`Failed to process ${item.file.name}:`, error);
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: errorMsg } : q));
            }
        }

        setIsProcessing(false);

        if (successCountRef.current > 0) {
            setTimeout(() => navigate('/contacts'), 1500);
        }
    };

    const totalItems = queue.length;
    const completedItems = queue.filter(q => q.status === 'completed').length;
    const errorItems = queue.filter(q => q.status === 'error').length;

    const getStatusDisplay = (item: QueuedFile) => {
        switch (item.status) {
            case 'processing':
                return <span className="text-sky-400">Processing...</span>;
            case 'completed':
                return <span className="text-emerald-400">Done</span>;
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
                                    : completedItems > 0
                                        ? `${completedItems}/${totalItems} completed${errorItems > 0 ? ` (${errorItems} failed)` : ''}`
                                        : `Process Queue (${totalItems})`
                                }
                            </h3>
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
                                        item.status === 'completed' ? 'border border-emerald-500/20 opacity-70' :
                                        item.status === 'error' ? 'border border-red-500/30' :
                                        'border border-transparent'
                                    }`}
                                >
                                    <div className="w-20 aspect-[1.586/1] rounded-lg overflow-hidden border border-brand-700 mr-4 flex-shrink-0">
                                        <img src={item.preview} alt="preview" className="h-full w-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.file.name}</p>
                                        <p className="text-[10px] uppercase">
                                            {(item.file.size / 1024).toFixed(1)} KB &bull; {getStatusDisplay(item)}
                                        </p>
                                    </div>
                                    {getStatusIcon(item) || (
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

                        {/* Completion message */}
                        {!isProcessing && completedItems > 0 && (
                            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                                <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
                                <p className="text-sm text-emerald-400">
                                    {completedItems} contact{completedItems > 1 ? 's' : ''} saved! Redirecting to contacts...
                                </p>
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
        </div>
    );
};

export default Uploader;
