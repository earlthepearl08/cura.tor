import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileImage, Trash2, ArrowLeft, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storage } from '@/services/storage';
import { ocrService } from '@/services/ocr';
import { Contact } from '@/types/contact';

interface QueuedFile {
    id: string;
    file: File;
    preview: string;
    status: 'queued' | 'processing' | 'completed' | 'error';
}

const Uploader: React.FC = () => {
    const [queue, setQueue] = useState<QueuedFile[]>([]);
    const navigate = useNavigate();

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
        }
    });

    const removeFile = (id: string) => {
        setQueue(prev => {
            const filtered = prev.filter(item => item.id !== id);
            // Clean up object URLs to prevent memory leaks
            const removed = prev.find(item => item.id === id);
            if (removed) URL.revokeObjectURL(removed.preview);
            return filtered;
        });
    };

    const startProcessing = async () => {
        for (const item of queue) {
            if (item.status === 'completed') continue;

            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));

            try {
                const result = await ocrService.processImage(item.preview);
                const contact: Contact = {
                    id: item.id,
                    name: result.name,
                    position: result.position,
                    company: result.company,
                    phone: result.phone,
                    email: result.email,
                    address: result.address,
                    rawText: result.rawText,
                    imageData: item.preview,
                    confidence: result.confidence,
                    isVerified: false, // Bulk uploads are unverified until edited
                    notes: '',
                    createdAt: Date.now()
                };

                await storage.saveContact(contact);
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed' } : q));
            } catch (error) {
                console.error(`Failed to process ${item.file.name}:`, error);
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error' } : q));
            }
        }
        // Auto-navigate after completion if at least one was successful
        if (queue.some(item => item.status === 'completed' || item.status === 'processing')) {
            setTimeout(() => navigate('/contacts'), 1000);
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
            ${isDragActive
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
                    <div className="mt-12">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-brand-500">
                                Process Queue ({queue.length})
                            </h3>
                            <button
                                onClick={startProcessing}
                                className="flex items-center gap-2 px-4 py-2 bg-brand-100 text-brand-950 rounded-xl font-semibold hover:bg-white transition-all shadow-lg text-sm"
                            >
                                <Play size={16} fill="currentColor" />
                                Process All
                            </button>
                        </div>

                        <div className="space-y-3">
                            {queue.map((item) => (
                                <div key={item.id} className="flex items-center p-3 glass rounded-2xl group">
                                    <div className="h-12 w-12 rounded-lg overflow-hidden border border-brand-700 mr-4">
                                        <img src={item.preview} alt="preview" className="h-full w-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.file.name}</p>
                                        <p className="text-[10px] text-brand-500 uppercase">{(item.file.size / 1024).toFixed(1)} KB • Queued</p>
                                    </div>
                                    <button
                                        onClick={() => removeFile(item.id)}
                                        className="p-2 text-brand-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <footer className="p-6 text-center text-xs text-brand-600">
                Bulk upload processes images sequentially to maintain offline performance.
            </footer>
        </div>
    );
};

export default Uploader;
