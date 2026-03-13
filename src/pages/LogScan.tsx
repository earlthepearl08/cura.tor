import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Image as ImageIcon, Upload, Download, Folder, RotateCcw, AlertTriangle } from 'lucide-react';
import { ocrService, LogSheetEntry } from '@/services/ocr';
import { storage } from '@/services/storage';
import { exportService } from '@/services/export';
import { Contact } from '@/types/contact';
import { useAuth } from '@/contexts/AuthContext';
import UpgradePrompt from '@/components/UpgradePrompt';

const LogScan: React.FC = () => {
    const navigate = useNavigate();
    const camRef = useRef<HTMLInputElement>(null);
    const galRef = useRef<HTMLInputElement>(null);
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
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const reader = new FileReader();
        reader.onload = () => {
            const data = reader.result as string;
            setImageData(data);
            processLogSheet(data);
        };
        reader.readAsDataURL(file);
    };

    const processLogSheet = async (base64Image: string) => {
        if (!canPerformScan()) {
            setShowUpgradePrompt(true);
            return;
        }

        setIsProcessing(true);
        setError(null);
        setEntries(null);

        try {
            const results = await ocrService.parseLogSheet(base64Image);
            await incrementScanCount();
            setEntries(results);
            if (results.length === 0) {
                setError('No entries found. Make sure the log sheet is clearly visible.');
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

    const handleImport = async () => {
        if (!entries) return;
        setIsImporting(true);
        await storage.batchSave(entriesToContacts(entries));
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
                        <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

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
                            <p className="text-sm text-brand-400 font-medium">Analyzing log sheet...</p>
                            <p className="text-xs text-brand-600">This may take a moment for large sheets</p>
                        </div>
                    </div>
                )}

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
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-brand-300">
                                        {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} found
                                    </p>
                                    <button onClick={reset} className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-400">
                                        <RotateCcw size={12} />
                                        Scan Another
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
                                    {entries.map((e, i) => (
                                        <div key={i} className="glass border border-brand-800 rounded-xl p-3">
                                            <p className="font-medium text-sm text-slate-100 truncate">{e.name || 'No name'}</p>
                                            {e.company && <p className="text-xs text-brand-400 truncate">{e.company}</p>}
                                            {e.position && <p className="text-xs text-slate-500 truncate">{e.position}</p>}
                                            {e.phone && <p className="text-xs text-slate-500 truncate">{e.phone}</p>}
                                            {e.email && <p className="text-xs text-slate-500 truncate">{e.email}</p>}
                                            {e.notes && <p className="text-xs text-amber-400/70 truncate mt-1">{e.notes}</p>}
                                        </div>
                                    ))}
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
                        disabled={isImporting}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                    >
                        {isImporting ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <Upload size={16} />
                        )}
                        Import {entries.length} Contact{entries.length !== 1 ? 's' : ''}
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
        </div>
    );
};

export default LogScan;
