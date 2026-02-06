import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, Upload, Contact2, Settings, History, PenLine } from 'lucide-react';
import { storage } from '@/services/storage';

const Home = () => {
    const [contactCount, setContactCount] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        storage.getAllContacts().then(contacts => setContactCount(contacts.length));
    }, []);
    const menuItems = [
        { label: 'Scan Card', icon: Camera, path: '/scan', color: 'bg-indigo-500/20 text-indigo-400' },
        { label: 'Upload Image', icon: Upload, path: '/upload', color: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Manual Entry', icon: PenLine, path: '/manual', color: 'bg-violet-500/20 text-violet-400' },
        { label: 'All Contacts', icon: Contact2, path: '/contacts', color: 'bg-amber-500/20 text-amber-400' },
        { label: 'Recent Scans', icon: History, path: '/history', color: 'bg-sky-500/20 text-sky-400' },
        { label: 'Settings', icon: Settings, path: '/settings', color: 'bg-slate-500/20 text-slate-400' },
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
            <header className="text-center mb-12">
                <div className="relative inline-block">
                    <h1 className="text-4xl font-bold gradient-text mb-2">CURA.TOR</h1>
                    <div className="absolute -top-1 -right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">
                        NEW
                    </div>
                </div>
                <p className="text-brand-400">Smart Contact Curation</p>
            </header>

            <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                {menuItems.slice(0, 3).map((item) => (
                    <Link
                        key={item.label}
                        to={item.path}
                        className="flex flex-col items-center justify-center p-4 glass rounded-2xl transition-all hover:scale-105 active:scale-95"
                    >
                        <div className={`p-3 rounded-xl ${item.color} mb-3`}>
                            <item.icon size={28} />
                        </div>
                        <span className="font-semibold text-xs text-center">{item.label}</span>
                    </Link>
                ))}
            </div>

            <div className="flex flex-col gap-3 w-full max-w-md mt-4">
                {menuItems.slice(3).map((item) => (
                    <Link
                        key={item.label}
                        to={item.path}
                        className="flex items-center p-4 glass rounded-xl transition-all hover:translate-x-1 active:scale-98"
                    >
                        <div className={`p-2 rounded-lg ${item.color} mr-4`}>
                            <item.icon size={20} />
                        </div>
                        <span className="font-medium text-sm">{item.label}</span>
                        <div className="ml-auto text-brand-600">→</div>
                    </Link>
                ))}
            </div>

            <footer className="mt-auto pt-10 text-brand-600 text-[10px] uppercase tracking-widest">
                Local Storage • Client OCR • Privacy First
            </footer>
        </div>
    );
};

export default Home;
