import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cpu, Sparkles, Key, Check, AlertCircle } from 'lucide-react';
import { getOCREngine, setOCREngine, getGeminiApiKey, setGeminiApiKey, OCREngine } from '@/services/ocr';

const Settings = () => {
    const navigate = useNavigate();
    const [ocrEngine, setOcrEngineState] = useState<OCREngine>(getOCREngine());
    const [geminiApiKey, setGeminiApiKeyState] = useState(getGeminiApiKey() || '');
    const [showApiKey, setShowApiKey] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setOCREngine(ocrEngine);
        if (geminiApiKey.trim()) {
            setGeminiApiKey(geminiApiKey.trim());
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
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
                                AI multimodal vision. Handles ANY card design, ALL languages, stylized fonts. No OCR step needed.
                            </p>
                            <ul className="text-[10px] text-brand-600 space-y-0.5">
                                <li>✓ Best for international cards (Japanese, Thai, Chinese, Korean)</li>
                                <li>✓ Understands visual context (logos, layouts)</li>
                                <li>✓ Works with stylized/difficult fonts</li>
                            </ul>
                        </div>
                        {ocrEngine === 'gemini-vision' && (
                            <Check size={20} className="text-purple-400 flex-shrink-0" />
                        )}
                    </button>
                </div>

                {/* Gemini API Key Input */}
                {ocrEngine === 'gemini-vision' && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                            <Key size={16} className="text-purple-400" />
                            <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Gemini API Key</h2>
                        </div>

                        <div className="p-4 glass rounded-2xl border border-purple-500/30">
                            <div className="relative">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={geminiApiKey}
                                    onChange={(e) => setGeminiApiKeyState(e.target.value)}
                                    placeholder="Enter your Gemini API key..."
                                    className="w-full bg-brand-900/50 border border-brand-800 rounded-xl py-3 px-4 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-mono"
                                />
                                <button
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs text-brand-500 hover:text-white transition-colors"
                                >
                                    {showApiKey ? 'Hide' : 'Show'}
                                </button>
                            </div>

                            <div className="mt-3 p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                <p className="text-xs text-purple-400 flex items-start gap-2">
                                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                                    <span>
                                        Get your free API key from{' '}
                                        <a
                                            href="https://makersuite.google.com/app/apikey"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline hover:text-purple-300"
                                        >
                                            Google AI Studio
                                        </a>
                                        . Free tier: 1,500 requests/day.
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

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
