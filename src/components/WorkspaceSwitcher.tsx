import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Users, ChevronDown, Check, CalendarDays, Plus } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { isEventActive } from '@/services/eventService';

const WorkspaceSwitcher: React.FC = () => {
    const { mode, organization, event, events, canSwitchWorkspace, switchTo } = useWorkspace();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

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

    // Always show if user can switch OR we want a create-event entry — show when they have shared spaces OR always a compact entry from Home/Settings
    if (!canSwitchWorkspace && events.length === 0) return null;

    const currentLabel = mode === 'team' && organization
        ? organization.name
        : mode === 'event' && event
            ? event.name
            : 'Personal';
    const Icon = mode === 'event' ? CalendarDays : mode === 'team' ? Users : User;
    const iconColor = mode === 'event' ? 'text-amber-400' : mode === 'team' ? 'text-emerald-400' : 'text-brand-400';

    const activeEvents = events.filter((e) => isEventActive(e) || e.status === 'active');

    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 glass border border-brand-800 rounded-xl text-sm font-medium hover:border-brand-600 transition-colors"
            >
                <Icon size={16} className={iconColor} />
                <span className="text-slate-200 max-w-[140px] truncate">{currentLabel}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 right-0 z-50 w-72 glass border border-brand-800 rounded-xl shadow-xl overflow-hidden">
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
                                <div className="text-xs text-slate-500">Enterprise team</div>
                            </div>
                            {mode === 'team' && <Check size={16} className="text-emerald-400" />}
                        </button>
                    )}

                    {activeEvents.length > 0 && (
                        <div className="border-t border-brand-800">
                            <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                Event packs
                            </p>
                            {activeEvents.map((ev) => (
                                <button
                                    key={ev.id}
                                    onClick={() => { switchTo('event', ev.id); setIsOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-900/40 transition-colors text-left"
                                >
                                    <CalendarDays size={16} className="text-amber-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-200 truncate">{ev.name}</div>
                                        <div className="text-xs text-slate-500">
                                            {ev.writable ? 'Shared event' : 'Ended / expired'}
                                            {ev.isHost ? ' · Host' : ''}
                                        </div>
                                    </div>
                                    {mode === 'event' && event?.id === ev.id && (
                                        <Check size={16} className="text-emerald-400 shrink-0" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={() => { setIsOpen(false); navigate('/events'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-900/40 transition-colors text-left border-t border-brand-800"
                    >
                        <Plus size={16} className="text-amber-400" />
                        <div className="flex-1">
                            <div className="text-sm font-medium text-slate-200">Manage events</div>
                            <div className="text-xs text-slate-500">Create or join a show pack</div>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};

export default WorkspaceSwitcher;
