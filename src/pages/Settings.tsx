import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cpu, Sparkles, Check, Cloud, CloudOff, RefreshCw, Link as LinkIcon, Unplug, Clock, ShieldCheck, Smartphone, Lock } from 'lucide-react';
import { getOCREngine, setOCREngine, OCREngine } from '@/services/ocr';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';

const Settings = () => {
    const navigate = useNavigate();
    const [ocrEngine, setOcrEngineState] = useState<OCREngine>(getOCREngine());
    const [saved, setSaved] = useState(false);
    const { isConnected, user, isSyncing, lastSyncTime, connect, disconnect, syncContacts, error } = useGoogleDrive();

    const handleSave = () => {
        setOCREngine(ocrEngine);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleConnect = async () => {
        try {
            await connect();
        } catch (err) {
            console.error('Failed to connect:', err);
        }
    };

    const handleSync = async () => {
        try {
            await syncContacts();
        } catch (err) {
            console.error('Failed to sync:', err);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 glass sticky top-0 z-10">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">Settings</h1>
                <div className="w-10" />
            </div>

            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                {/* OCR Engine Selection */}
                <div className="space-y-4">
                    <h2 className="text-sm font-bold text-brand-400 uppercase tracking-wider">OCR Engine</h2>

                    {/* Tesseract Option */}
                    <button
                        onClick={() => setOcrEngineState('tesseract')}
                        className={`w-full p-4 rounded-2xl transition-all flex items-start gap-4 ${
                            ocrEngine === 'tesseract'
                                ? 'glass border-2 border-brand-500/50'
                                : 'glass border border-brand-800/50 hover:border-brand-700/50'
                        }`}
                    >
                        <div className={`p-3 rounded-xl ${
                            ocrEngine === 'tesseract' ? 'bg-brand-500/20' : 'bg-brand-800/50'
                        }`}>
                            <Cpu size={20} className={ocrEngine === 'tesseract' ? 'text-brand-400' : 'text-brand-600'} />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">Tesseract.js</span>
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                                    FREE
                                </span>
                            </div>
                            <p className="text-xs text-brand-500">Runs locally in your browser. Good for clean, standard cards.</p>
                        </div>
                        {ocrEngine === 'tesseract' && (
                            <Check size={20} className="text-brand-400 flex-shrink-0" />
                        )}
                    </button>

                    {/* Gemini Vision Option */}
                    <button
                        onClick={() => setOcrEngineState('gemini-vision')}
                        className={`w-full p-4 rounded-2xl transition-all flex items-start gap-4 ${
                            ocrEngine === 'gemini-vision'
                                ? 'glass border-2 border-purple-500/50'
                                : 'glass border border-brand-800/50 hover:border-brand-700/50'
                        }`}
                    >
                        <div className={`p-3 rounded-xl ${
                            ocrEngine === 'gemini-vision' ? 'bg-purple-500/20' : 'bg-brand-800/50'
                        }`}>
                            <Sparkles size={20} className={ocrEngine === 'gemini-vision' ? 'text-purple-400' : 'text-brand-600'} />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">Gemini Vision</span>
                                <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                                    AI DIRECT
                                </span>
                                <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                                    BEST
                                </span>
                            </div>
                            <p className="text-xs text-brand-500 mb-2">
                                AI multimodal vision. Handles ANY card design, ALL languages, stylized fonts. No API key needed - powered by the app.
                            </p>
                            <ul className="text-[10px] text-brand-600 space-y-0.5">
                                <li>✓ Best for international cards (Japanese, Thai, Chinese, Korean)</li>
                                <li>✓ Understands visual context (logos, layouts)</li>
                                <li>✓ Works with stylized/difficult fonts</li>
                                <li>✓ Powered by server - no configuration required</li>
                            </ul>
                        </div>
                        {ocrEngine === 'gemini-vision' && (
                            <Check size={20} className="text-purple-400 flex-shrink-0" />
                        )}
                    </button>
                </div>

                {/* Google Drive Sync */}
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Cloud Backup</p>
                    <div className="card-elevated rounded-2xl p-4">
                        {isConnected ? (
                            <>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                        <Cloud className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm text-emerald-400">Connected</p>
                                        {user && <p className="text-xs text-slate-500">{user.email}</p>}
                                    </div>
                                    {isSyncing && (
                                        <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
                                    )}
                                </div>
                                {lastSyncTime && (
                                    <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Last synced: {new Date(lastSyncTime).toLocaleString()}
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSync}
                                        disabled={isSyncing}
                                        className="flex-1 py-3 text-sm glass rounded-xl disabled:opacity-50 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Sync Now
                                    </button>
                                    <button
                                        onClick={disconnect}
                                        className="py-3 px-4 text-sm bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
                                    >
                                        <Unplug className="w-4 h-4" />
                                    </button>
                                </div>
                                {error && (
                                    <p className="mt-3 text-xs text-red-400">{error}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center">
                                        <CloudOff className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">Google Drive Backup</p>
                                        <p className="text-xs text-slate-500">Keep your contacts safe in the cloud</p>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-4 px-1">
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                        <span>Survives browser cache clearing</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <Smartphone className="w-3 h-3 text-sky-400" />
                                        <span>Syncs across all your devices</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <Lock className="w-3 h-3 text-purple-400" />
                                        <span>Your data stays private</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleConnect}
                                    className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl text-sm font-semibold hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                                >
                                    <LinkIcon className="w-4 h-4" />
                                    Connect Google Drive
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Save Success Message */}
                {saved && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 animate-in fade-in duration-200">
                        <Check size={20} className="text-emerald-400" />
                        <span className="text-sm text-emerald-400">Settings saved successfully!</span>
                    </div>
                )}
            </div>

            {/* Save Button */}
            <div className="p-4 border-t border-brand-800/50 bg-brand-950/80 backdrop-blur">
                <button
                    onClick={handleSave}
                    className="w-full py-4 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2"
                >
                    <Check size={20} />
                    Save Settings
                </button>
            </div>
        </div>
    );
};

export default Settings;
