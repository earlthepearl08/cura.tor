import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Layers, Plus, Save, Trash2 } from 'lucide-react';
import { LogSheetEntry } from '@/services/ocr';
import {
    ColumnMapping,
    ColumnMappingTarget,
    EventTemplate,
    STANDARD_FIELD_OPTIONS,
    StandardContactField,
} from '@/types/eventTemplate';
import { detectHeaders, suggestMappings } from '@/services/columnMapping';
import { deleteEventTemplate, listEventTemplates, saveEventTemplate } from '@/services/eventTemplateStorage';

interface ColumnMappingPanelProps {
    entries: LogSheetEntry[];
    mappings: ColumnMapping[];
    onMappingsChange: (mappings: ColumnMapping[]) => void;
    selectedTemplateId: string | null;
    onTemplateSelected: (template: EventTemplate | null) => void;
    onApply: () => void;
}

function targetToSelectValue(target: ColumnMappingTarget): string {
    if (target.kind === 'ignore') return 'ignore';
    if (target.kind === 'standard') return `standard:${target.field}`;
    return `custom:${target.key}`;
}

function selectValueToTarget(value: string, sourceLabel: string): ColumnMappingTarget {
    if (value === 'ignore') return { kind: 'ignore' };
    if (value.startsWith('standard:')) {
        return { kind: 'standard', field: value.slice('standard:'.length) as StandardContactField };
    }
    if (value.startsWith('custom:')) {
        const key = value.slice('custom:'.length).trim() || sourceLabel;
        return { kind: 'custom', key };
    }
    return { kind: 'custom', key: sourceLabel };
}

const ColumnMappingPanel: React.FC<ColumnMappingPanelProps> = ({
    entries,
    mappings,
    onMappingsChange,
    selectedTemplateId,
    onTemplateSelected,
    onApply,
}) => {
    const [open, setOpen] = useState(false);
    const [templates, setTemplates] = useState<EventTemplate[]>([]);
    const [saveName, setSaveName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [customKeyEdits, setCustomKeyEdits] = useState<Record<string, string>>({});

    const headers = useMemo(() => detectHeaders(entries), [entries]);
    const hasRawColumns = headers.length > 0;

    const refreshTemplates = async () => {
        try {
            const list = await listEventTemplates();
            setTemplates(list);
        } catch (err) {
            console.warn('Failed to load event templates:', err);
        }
    };

    useEffect(() => {
        refreshTemplates();
    }, []);

    // Seed mappings from detected headers when empty
    useEffect(() => {
        if (mappings.length === 0 && headers.length > 0) {
            onMappingsChange(suggestMappings(headers));
        }
    }, [headers, mappings.length, onMappingsChange]);

    // Auto-expand when we have raw columns and no template yet
    useEffect(() => {
        if (hasRawColumns && !selectedTemplateId) {
            setOpen(true);
        }
    }, [hasRawColumns, selectedTemplateId]);

    const handleSelectTemplate = (id: string) => {
        if (!id) {
            onTemplateSelected(null);
            if (headers.length > 0) onMappingsChange(suggestMappings(headers));
            return;
        }
        const t = templates.find(x => x.id === id);
        if (!t) return;
        onTemplateSelected(t);
        onMappingsChange(t.mappings);
        setSaveName(t.name);
        setStatusMsg(`Loaded template “${t.name}”`);
    };

    const updateMapping = (index: number, next: ColumnMapping) => {
        const copy = [...mappings];
        copy[index] = next;
        onMappingsChange(copy);
    };

    const handleTargetChange = (index: number, value: string) => {
        const sourceLabel = mappings[index].sourceLabel;
        if (value === 'custom:__new__') {
            const key = customKeyEdits[sourceLabel] || sourceLabel;
            updateMapping(index, { sourceLabel, target: { kind: 'custom', key } });
            return;
        }
        updateMapping(index, { sourceLabel, target: selectValueToTarget(value, sourceLabel) });
    };

    const handleSaveTemplate = async () => {
        if (mappings.length === 0) return;
        setIsSaving(true);
        setStatusMsg(null);
        try {
            const id = selectedTemplateId || crypto.randomUUID();
            const saved = await saveEventTemplate({
                id,
                name: saveName.trim() || `Event ${new Date().toLocaleDateString()}`,
                mappings,
            });
            await refreshTemplates();
            onTemplateSelected(saved);
            setSaveName(saved.name);
            setStatusMsg(`Saved template “${saved.name}”`);
            onApply();
        } catch (err: any) {
            setStatusMsg(err.message || 'Failed to save template');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTemplate = async () => {
        if (!selectedTemplateId) return;
        if (!confirm('Delete this event template?')) return;
        await deleteEventTemplate(selectedTemplateId);
        await refreshTemplates();
        onTemplateSelected(null);
        if (headers.length > 0) onMappingsChange(suggestMappings(headers));
        setSaveName('');
        setStatusMsg('Template deleted');
    };

    if (!hasRawColumns && templates.length === 0) {
        return null;
    }

    return (
        <div className="glass border border-brand-800 rounded-xl overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
            >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <Layers size={16} className="text-brand-400" />
                    Event column mapping
                    {selectedTemplateId && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold">
                            Template
                        </span>
                    )}
                </span>
                {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>

            {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-brand-800/80">
                    <p className="text-xs text-slate-500 pt-3">
                        Map sheet columns to contact fields once, save as an event template, and reuse next time.
                        Skipping this keeps the default OCR mapping.
                    </p>

                    {/* Template picker */}
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-brand-500 font-bold">Saved templates</label>
                        <select
                            value={selectedTemplateId || ''}
                            onChange={(e) => handleSelectTemplate(e.target.value)}
                            className="mt-1 w-full glass border border-brand-800 rounded-lg py-2 px-3 text-sm bg-brand-900"
                        >
                            <option value="">None (use suggested mapping)</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    {!hasRawColumns && (
                        <p className="text-xs text-amber-400/80">
                            No raw column headers were returned for this scan. You can still load a saved template for the next sheet.
                        </p>
                    )}

                    {mappings.length > 0 && (
                        <div className="space-y-2">
                            {mappings.map((m, i) => {
                                const selectVal = targetToSelectValue(m.target);
                                const isCustom = m.target.kind === 'custom';
                                return (
                                    <div key={`${m.sourceLabel}-${i}`} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2 items-start">
                                        <div className="text-xs text-slate-300 truncate pt-2" title={m.sourceLabel}>
                                            <span className="text-brand-500 font-mono text-[10px]">Col</span>{' '}
                                            {m.sourceLabel}
                                        </div>
                                        <div className="space-y-1">
                                            <select
                                                value={isCustom ? 'custom:__new__' : selectVal}
                                                onChange={(e) => handleTargetChange(i, e.target.value)}
                                                className="w-full glass border border-brand-800 rounded-lg py-2 px-2 text-xs bg-brand-900"
                                            >
                                                {STANDARD_FIELD_OPTIONS.map(opt => (
                                                    <option key={opt.field} value={`standard:${opt.field}`}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                                <option value="custom:__new__">Custom field…</option>
                                                <option value="ignore">Ignore</option>
                                            </select>
                                            {isCustom && m.target.kind === 'custom' && (
                                                <input
                                                    type="text"
                                                    value={customKeyEdits[m.sourceLabel] ?? m.target.key}
                                                    onChange={(e) => {
                                                        const key = e.target.value;
                                                        setCustomKeyEdits(prev => ({ ...prev, [m.sourceLabel]: key }));
                                                        updateMapping(i, {
                                                            sourceLabel: m.sourceLabel,
                                                            target: { kind: 'custom', key: key || m.sourceLabel },
                                                        });
                                                    }}
                                                    placeholder="Custom field name"
                                                    className="w-full glass border border-brand-700 rounded-lg py-1.5 px-2 text-xs"
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {hasRawColumns && mappings.length === 0 && (
                        <button
                            type="button"
                            onClick={() => onMappingsChange(suggestMappings(headers))}
                            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
                        >
                            <Plus size={12} /> Suggest mappings from detected columns
                        </button>
                    )}

                    <div className="space-y-2 pt-1">
                        <input
                            type="text"
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                            placeholder="Template name (e.g. Manila Trade Show)"
                            className="w-full glass border border-brand-800 rounded-lg py-2 px-3 text-sm"
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleSaveTemplate}
                                disabled={isSaving || mappings.length === 0}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/30 rounded-xl text-xs font-semibold text-brand-300 disabled:opacity-50"
                            >
                                <Save size={14} />
                                {selectedTemplateId ? 'Update & apply' : 'Save template & apply'}
                            </button>
                            <button
                                type="button"
                                onClick={onApply}
                                disabled={mappings.length === 0}
                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400 disabled:opacity-50"
                                title="Apply mapping without saving"
                            >
                                <Check size={14} />
                                Apply
                            </button>
                            {selectedTemplateId && (
                                <button
                                    type="button"
                                    onClick={handleDeleteTemplate}
                                    className="p-2.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                                    title="Delete template"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {statusMsg && (
                        <p className="text-[11px] text-emerald-400/90">{statusMsg}</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default ColumnMappingPanel;
