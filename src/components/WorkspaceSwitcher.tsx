import React, { useState, useRef, useEffect } from 'react';
import { User, Users, ChevronDown, Check } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const WorkspaceSwitcher: React.FC = () => {
    const { mode, organization, canSwitchWorkspace, switchTo } = useWorkspace();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [isOpen]);

    if (!canSwitchWorkspace) return null;

    const currentLabel = mode === 'team' && organization
        ? organization.name
        : 'Personal';
    const Icon = mode === 'team' ? Users : User;

    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 glass border border-brand-800 rounded-xl text-sm font-medium hover:border-brand-600 transition-colors"
            >
                <Icon size={16} className={mode === 'team' ? 'text-emerald-400' : 'text-brand-400'} />
                <span className="text-slate-200 max-w-[120px] truncate">{currentLabel}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 right-0 z-50 w-64 glass border border-brand-800 rounded-xl shadow-xl overflow-hidden">
                    <button
                        onClick={() => { switchTo('personal'); setIsOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-900/40 transition-colors text-left"
                    >
                        <User size={16} className="text-brand-400" />
                        <div className="flex-1">
                            <div className="text-sm font-medium text-slate-200">Personal</div>
                            <div className="text-xs text-slate-500">Your private contacts</div>
                        </div>
                        {mode === 'personal' && <Check size={16} className="text-emerald-400" />}
                    </button>
                    {organization && (
                        <button
                            onClick={() => { switchTo('team'); setIsOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-900/40 transition-colors text-left border-t border-brand-800"
                        >
                            <Users size={16} className="text-emerald-400" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-200 truncate">{organization.name}</div>
                                <div className="text-xs text-slate-500">Team workspace</div>
                            </div>
                            {mode === 'team' && <Check size={16} className="text-emerald-400" />}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default WorkspaceSwitcher;
