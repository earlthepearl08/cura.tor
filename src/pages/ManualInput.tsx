import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Building2, Briefcase, Phone, Mail, MapPin, StickyNote, Save, AlertTriangle } from 'lucide-react';
import { storage } from '@/services/storage';
import { checkDuplicate, DuplicateResult } from '@/services/duplicateDetection';
import { Contact } from '@/types/contact';

const ManualInput: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        position: '',
        company: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
    });

    const [duplicateWarning, setDuplicateWarning] = useState<DuplicateResult | null>(null);
    const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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

    const handleSave = async (forceSave: boolean = false) => {
        // Validate required fields
        if (!formData.name.trim()) {
            alert('Please enter a name');
            return;
        }

        // Show warning if duplicate detected and not forcing save
        if (duplicateWarning && !forceSave) {
            setShowDuplicateWarning(true);
            return;
        }

        setIsSaving(true);

        const contact: Contact = {
            id: Math.random().toString(36).substr(2, 9),
            name: formData.name.trim(),
            position: formData.position.trim(),
            company: formData.company.trim(),
            phone: formData.phone.split(',').map(p => p.trim()).filter(p => p),
            email: formData.email.split(',').map(e => e.trim()).filter(e => e),
            address: formData.address.trim(),
            notes: formData.notes.trim(),
            rawText: 'Manual Entry',
            imageData: '', // No image for manual entries
            confidence: 100, // Manual entry is 100% confident
            isVerified: true,
            createdAt: Date.now()
        };

        await storage.saveContact(contact);
        setIsSaving(false);
        navigate('/contacts');
    };

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            {/* Header */}
            <div className="p-4 glass flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => navigate('/')} className="p-2 text-brand-600 hover:text-white">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="text-lg font-bold gradient-text">Add Contact Manually</h2>
                <button
                    onClick={() => handleSave(false)}
                    disabled={isSaving}
                    className="p-2 text-emerald-500 hover:text-emerald-400 disabled:opacity-50"
                >
                    <Save size={24} />
                </button>
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

                {/* Info Banner */}
                <div className="p-4 rounded-xl bg-brand-800/50 border border-brand-700">
                    <p className="text-brand-400 text-sm">
                        Enter contact details manually. Use commas to separate multiple phone numbers or emails.
                    </p>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-brand-500" size={18} />
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Full Name *"
                            className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                        />
                    </div>

                    <div className="relative">
                        <Briefcase className="absolute left-3 top-3 text-brand-500" size={18} />
                        <input
                            type="text"
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            placeholder="Job Title"
                            className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                        />
                    </div>

                    <div className="relative">
                        <Building2 className="absolute left-3 top-3 text-brand-500" size={18} />
                        <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            placeholder="Company Name"
                            className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                        />
                    </div>

                    <div className="relative">
                        <Phone className="absolute left-3 top-3 text-brand-500" size={18} />
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="Phone Numbers (comma separated)"
                            className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                        />
                    </div>

                    <div className="relative">
                        <Mail className="absolute left-3 top-3 text-brand-500" size={18} />
                        <input
                            type="text"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="Email Addresses (comma separated)"
                            className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                        />
                    </div>

                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 text-brand-500" size={18} />
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Office Address"
                            rows={2}
                            className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 resize-none"
                        />
                    </div>

                    <div className="relative">
                        <StickyNote className="absolute left-3 top-3 text-brand-500" size={18} />
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Notes (e.g., what they're inquiring about, where you met them)"
                            rows={3}
                            className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="p-4 bg-brand-900 border-t border-brand-800">
                <button
                    onClick={() => handleSave(false)}
                    disabled={isSaving}
                    className="w-full py-4 bg-brand-100 text-brand-950 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
                >
                    <Save size={20} />
                    {isSaving ? 'Saving...' : 'Save Contact'}
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

export default ManualInput;
