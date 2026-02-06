import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, Upload, Users, Settings, PenLine, ChevronRight } from 'lucide-react';
import { storage } from '@/services/storage';
import { getOCREngine } from '@/services/ocr';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';

const Home = () => {
    const [contactCount, setContactCount] = useState(0);
    const [ocrEngine, setOcrEngineState] = useState(getOCREngine());
    const { isConnected, user, isSyncing } = useGoogleDrive();
    const navigate = useNavigate();

    useEffect(() => {
        storage.getAllContacts().then(contacts => setContactCount(contacts.length));
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 page-enter">
            {/* Logo Section */}
            <div className="mb-12 text-center">
                <div className="mb-4 relative">
                    <svg viewBox="0 0 280 80" xmlns="http://www.w3.org/2000/svg" className="w-56 h-auto mx-auto">
                        <defs>
                            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style={{stopColor:'#38bdf8'}} />
                                <stop offset="50%" style={{stopColor:'#0ea5e9'}} />
                                <stop offset="100%" style={{stopColor:'#0284c7'}} />
                            </linearGradient>
                            <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style={{stopColor:'#0369a1'}} />
                                <stop offset="100%" style={{stopColor:'#075985'}} />
                            </linearGradient>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        {/* Icon */}
                        <g transform="translate(0, 10)" filter="url(#glow)">
                            <path d="M28 5 A22 22 0 1 0 28 49" stroke="url(#logoGrad)" strokeWidth="5" fill="none" strokeLinecap="round"/>
                            <rect x="14" y="18" width="26" height="17" rx="3" fill="url(#cardGrad)"/>
                            <rect x="18" y="24" width="14" height="2" rx="1" fill="white" opacity="0.9"/>
                            <rect x="18" y="29" width="9" height="2" rx="1" fill="white" opacity="0.5"/>
                        </g>
                        {/* Text */}
                        <text x="60" y="42" fontFamily="Inter, sans-serif" fontSize="28" fontWeight="800" fill="#ffffff" letterSpacing="-1">CURA</text>
                        <text x="138" y="42" fontFamily="Inter, sans-serif" fontSize="28" fontWeight="800" fill="url(#logoGrad)" letterSpacing="-1">.TOR</text>
                    </svg>
                    <div className="absolute -top-1 right-8 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">
                        NEW
                    </div>
                </div>
                <p className="text-slate-500 text-xs tracking-widest uppercase">Smart Contact Curation</p>
            </div>

            {/* Primary Actions */}
            <div className="w-full max-w-md mb-6">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-3 px-1">Quick Actions</p>
                <div className="grid grid-cols-3 gap-3">
                    <Link
                        to="/scan"
                        className="card-elevated rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <div className="w-12 h-12 bg-gradient-to-br from-sky-500/20 to-blue-600/20 rounded-xl flex items-center justify-center">
                            <Camera className="w-5 h-5 text-sky-400" />
                        </div>
                        <span className="font-semibold text-sm text-white">Scan</span>
                        <span className="text-[10px] text-slate-500">Camera</span>
                    </Link>

                    <Link
                        to="/upload"
                        className="card-elevated rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-xl flex items-center justify-center">
                            <Upload className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="font-semibold text-sm text-white">Upload</span>
                        <span className="text-[10px] text-slate-500">Images</span>
                    </Link>

                    <Link
                        to="/manual"
                        className="card-elevated rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-500/20 to-purple-600/20 rounded-xl flex items-center justify-center">
                            <PenLine className="w-5 h-5 text-violet-400" />
                        </div>
                        <span className="font-semibold text-sm text-white">Manual</span>
                        <span className="text-[10px] text-slate-500">Entry</span>
                    </Link>
                </div>
            </div>

            {/* Secondary Actions */}
            <div className="w-full max-w-md mb-8">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-3 px-1">Manage</p>
                <div className="grid grid-cols-2 gap-3">
                    <Link
                        to="/contacts"
                        className="card-elevated rounded-2xl p-4 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-11 h-11 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl flex items-center justify-center">
                                <Users className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div className="text-left">
                                <span className="font-semibold text-sm text-white block">Contacts</span>
                                <span className="text-xs text-slate-500">{contactCount} saved</span>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                    </Link>

                    <Link
                        to="/settings"
                        className="card-elevated rounded-2xl p-4 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-11 h-11 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-xl flex items-center justify-center">
                                <Settings className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="text-left">
                                <span className="font-semibold text-sm text-white block">Settings</span>
                                <span className="text-xs text-slate-500">Configure</span>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                    </Link>
                </div>
            </div>

            {/* Status Bar */}
            <div className="w-full max-w-md card-elevated rounded-2xl p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
                        <div>
                            <p className="text-xs font-medium text-slate-300">
                                {isConnected ? 'Synced to Google Drive' : 'Local Storage'}
                            </p>
                            {isConnected && isSyncing && (
                                <p className="text-[10px] text-slate-500">Syncing...</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="px-2 py-1 bg-slate-800/50 rounded-md">
                            {ocrEngine === 'gemini-vision' ? 'Gemini Vision' : 'Tesseract'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
