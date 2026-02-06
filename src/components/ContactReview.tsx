import React, { useState, useEffect } from 'react';
import { Check, X, User, Building2, Briefcase, Phone, Mail, MapPin, Save, StickyNote, AlertTriangle, Edit3, FileText, ChevronDown, ChevronUp, RotateCcw, Sparkles } from 'lucide-react';
import { OCRResult, ocrService } from '@/services/ocr';
import { Contact } from '@/types/contact';
import { storage } from '@/services/storage';
import { checkDuplicate, DuplicateResult } from '@/services/duplicateDetection';

interface ContactReviewProps {
    ocrResult: OCRResult;
    imageData: string;
    onCancel: () => void;
    onSave: (contact: Contact) => void;
}

const ContactReview: React.FC<ContactReviewProps> = ({ ocrResult, imageData, onCancel, onSave }) => {
    const [formData, setFormData] = useState({
        name: ocrResult.name,
        position: ocrResult.position,
        company: ocrResult.company,
        phone: ocrResult.phone.join(', '),
        email: ocrResult.email.join(', '),
        address: ocrResult.address,
        notes: '',
    });

    const [duplicateWarning, setDuplicateWarning] = useState<DuplicateResult | null>(null);
    const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
    const [isEditMode, setIsEditMode] = useState(true);
    const [showRawText, setShowRawText] = useState(false);
    const [rawText, setRawText] = useState(ocrResult.rawText);
    const [isReparsing, setIsReparsing] = useState(false);

    // Check for duplicates when form data changes
    useEffect(() => {
        const checkForDuplicates = async () => {
            const existingContacts = await storage.getAllContacts();
            const result = checkDuplicate(
                {
                    name: formData.name,
                    email: formData.email.split(',').map(e => e.trim()).filter(e => e),
                    phone: formData.phone.split(',').map(p => p.trim()).filter(p => p),
                    company: formData.company,
                },
                existingContacts
            );

            if (result.isDuplicate) {
                setDuplicateWarning(result);
            } else {
                setDuplicateWarning(null);
            }
        };

        const debounce = setTimeout(checkForDuplicates, 500);
        return () => clearTimeout(debounce);
    }, [formData.name, formData.email, formData.phone, formData.company]);

    const handleReparse = async () => {
        if (!rawText.trim()) return;
        setIsReparsing(true);
        try {
            // Try Gemini AI parsing first, then rule-based fallback
            let parsed;
            try {
                parsed = await ocrService.parseWithGemini(rawText);
            } catch {
                parsed = ocrService.parseText(rawText);
            }
            setFormData({
                ...formData,
                name: parsed.name || formData.name,
                position: parsed.position || formData.position,
                company: parsed.company || formData.company,
                phone: parsed.phone.length > 0 ? parsed.phone.join(', ') : formData.phone,
                email: parsed.email.length > 0 ? parsed.email.join(', ') : formData.email,
                address: parsed.address || formData.address,
            });
        } catch (error) {
            console.error('Reparse failed:', error);
        }
        setIsReparsing(false);
    };

    const handleSave = async (forceSave: boolean = false) => {
        // Show warning if duplicate detected and not forcing save
        if (duplicateWarning && !forceSave) {
            setShowDuplicateWarning(true);
            return;
        }

        const contact: Contact = {
            id: Math.random().toString(36).substr(2, 9),
            name: formData.name,
            position: formData.position,
            company: formData.company,
            phone: formData.phone.split(',').map(p => p.trim()).filter(p => p),
            email: formData.email.split(',').map(e => e.trim()).filter(e => e),
            address: formData.address,
            notes: formData.notes,
            rawText: rawText,
            imageData: imageData,
            confidence: ocrResult.confidence,
            isVerified: true,
            createdAt: Date.now()
        };

        await storage.saveContact(contact);
        onSave(contact);
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-brand-950 animate-in fade-in duration-300">
            <div className="p-4 glass flex items-center justify-between sticky top-0">
                <button onClick={onCancel} className="p-2 text-brand-600 hover:text-white"><X size={24} /></button>
                <h2 className="text-lg font-bold gradient-text">{isEditMode ? 'Edit Contact' : 'Verify Contact'}</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`p-2 transition-colors ${isEditMode ? 'text-brand-400' : 'text-brand-600 hover:text-brand-400'}`}
                        title={isEditMode ? 'View mode' : 'Edit mode'}
                    >
                        <Edit3 size={20} />
                    </button>
                    <button onClick={() => handleSave(false)} className="p-2 text-emerald-500 hover:text-emerald-400"><Save size={24} /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Duplicate Warning Banner */}
                {duplicateWarning && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                        <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="text-amber-400 font-medium text-sm">Possible duplicate detected</p>
                            <p className="text-amber-400/70 text-xs mt-1">
                                {duplicateWarning.matchReasons.join(', ')} with "{duplicateWarning.matchedContact?.name}"
                            </p>
                        </div>
                    </div>
                )}

                {/* Card Preview */}
                <div className="w-full aspect-[1.586/1] rounded-2xl overflow-hidden glass border border-brand-800 shadow-2xl">
                    <img src={imageData} alt="original card" className="w-full h-full object-cover" />
                </div>

                {/* Confidence + Raw Text Toggle */}
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            ocrResult.confidence >= 80
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : ocrResult.confidence >= 50
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                        }`}>
                            OCR Confidence {Math.round(ocrResult.confidence)}%
                        </span>
                    </div>
                    <button
                        onClick={() => setShowRawText(!showRawText)}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                    >
                        <FileText size={12} />
                        {showRawText ? 'Hide Raw' : 'View Raw'}
                        {showRawText ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                </div>

                {/* Raw OCR Text - Editable with Reparse */}
                {showRawText && (
                    <div className="space-y-2">
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            rows={6}
                            className="w-full glass border border-brand-800 rounded-xl p-4 text-xs text-slate-300 font-mono leading-relaxed resize-none focus:ring-1 focus:ring-brand-500"
                            placeholder="Raw OCR text..."
                        />
                        <button
                            onClick={handleReparse}
                            disabled={isReparsing}
                            className="w-full py-2.5 glass border border-brand-700 rounded-xl text-xs font-semibold text-brand-300 hover:bg-white/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isReparsing ? (
                                <>
                                    <div className="animate-spin h-3.5 w-3.5 border-2 border-brand-400 border-t-transparent rounded-full"></div>
                                    Reparsing...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} />
                                    Reparse with AI
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Contact Details Label */}
                <div className="px-1">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Contact Details</span>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-brand-500" size={18} />
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Full Name"
                            readOnly={!isEditMode}
                            className={`w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 ${!isEditMode ? 'opacity-75 cursor-default' : ''}`}
                        />
                    </div>

                    <div className="relative">
                        <Briefcase className="absolute left-3 top-3 text-brand-500" size={18} />
                        <input
                            type="text"
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            placeholder="Job Title"
                            readOnly={!isEditMode}
                            className={`w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 ${!isEditMode ? 'opacity-75 cursor-default' : ''}`}
                        />
                    </div>

                    <div className="relative">
                        <Building2 className="absolute left-3 top-3 text-brand-500" size={18} />
                        <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            placeholder="Company Name"
                            readOnly={!isEditMode}
                            className={`w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 ${!isEditMode ? 'opacity-75 cursor-default' : ''}`}
                        />
                    </div>

                    <div className="relative">
                        <Phone className="absolute left-3 top-3 text-brand-500" size={18} />
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="Phone Numbers (comma separated)"
                            readOnly={!isEditMode}
                            className={`w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 ${!isEditMode ? 'opacity-75 cursor-default' : ''}`}
                        />
                    </div>

                    <div className="relative">
                        <Mail className="absolute left-3 top-3 text-brand-500" size={18} />
                        <input
                            type="text"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="Email Addresses (comma separated)"
                            readOnly={!isEditMode}
                            className={`w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 ${!isEditMode ? 'opacity-75 cursor-default' : ''}`}
                        />
                    </div>

                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 text-brand-500" size={18} />
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Office Address"
                            rows={2}
                            readOnly={!isEditMode}
                            className={`w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 resize-none ${!isEditMode ? 'opacity-75 cursor-default' : ''}`}
                        />
                    </div>

                    {/* Notes Field */}
                    <div className="relative">
                        <StickyNote className="absolute left-3 top-3 text-brand-500" size={18} />
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Notes (e.g., what they're inquiring about, where you met them)"
                            rows={3}
                            readOnly={!isEditMode}
                            className={`w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 resize-none ${!isEditMode ? 'opacity-75 cursor-default' : ''}`}
                        />
                    </div>
                </div>
            </div>

            <div className="p-4 bg-brand-900 border-t border-brand-800">
                <button
                    onClick={() => handleSave(false)}
                    className="w-full py-4 bg-brand-100 text-brand-950 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] active:scale-95 transition-all"
                >
                    <Check size={20} />
                    Save Contact
                </button>
            </div>

            {/* Duplicate Warning Modal */}
            {showDuplicateWarning && duplicateWarning && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-6">
                    <div className="bg-brand-900 rounded-2xl p-6 max-w-sm w-full border border-brand-800 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 rounded-full bg-amber-500/20">
                                <AlertTriangle className="text-amber-400" size={24} />
                            </div>
                            <h3 className="text-lg font-bold">Duplicate Detected</h3>
                        </div>

                        <p className="text-brand-400 text-sm mb-4">
                            This contact appears to be similar to an existing contact:
                        </p>

                        <div className="p-3 rounded-xl bg-brand-800/50 mb-4">
                            <p className="font-medium">{duplicateWarning.matchedContact?.name}</p>
                            <p className="text-xs text-brand-500 mt-1">
                                Match: {duplicateWarning.matchReasons.join(', ')}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDuplicateWarning(false)}
                                className="flex-1 py-3 glass rounded-xl font-medium hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowDuplicateWarning(false);
                                    handleSave(true);
                                }}
                                className="flex-1 py-3 bg-amber-500 text-brand-950 rounded-xl font-bold hover:bg-amber-400 transition-colors"
                            >
                                Save Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContactReview;
