import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Filter, Mail, Phone, MapPin, Building2, MoreVertical, Trash2, Download, Edit3, X, Save, User, Briefcase, StickyNote, Folder, FolderPlus, FileDown, CheckSquare, Square, XCircle } from 'lucide-react';
import { storage } from '@/services/storage';
import { exportService } from '@/services/export';
import { Contact } from '@/types/contact';

const Contacts: React.FC = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<string>('all'); // 'all' or folder name
    const [showFolderDropdown, setShowFolderDropdown] = useState(false);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectMode, setSelectMode] = useState(false);
    const [editFormData, setEditFormData] = useState({
        name: '',
        position: '',
        company: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        folder: '',
    });
    const navigate = useNavigate();

    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        setIsLoading(true);
        try {
            const data = await storage.getAllContacts();
            setContacts(data.sort((a, b) => b.createdAt - a.createdAt));
        } catch (error) {
            console.error("Failed to load contacts:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = (type: 'csv' | 'excel' | 'vcard') => {
        const toExport = selectedIds.size > 0
            ? contacts.filter(c => selectedIds.has(c.id))
            : filteredContacts;
        if (type === 'csv') exportService.toCSV(toExport);
        else if (type === 'excel') exportService.toExcel(toExport);
        else if (type === 'vcard') exportService.toVCardAll(toExport);
        setShowExportOptions(false);
        if (selectedIds.size > 0) {
            setSelectedIds(new Set());
            setSelectMode(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredContacts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredContacts.map(c => c.id)));
        }
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedIds(new Set());
    };

    const deleteContact = async (id: string) => {
        if (window.confirm("Delete this contact?")) {
            await storage.deleteContact(id);
            loadContacts();
        }
    };

    const openEditModal = (contact: Contact) => {
        setEditingContact(contact);
        setEditFormData({
            name: contact.name,
            position: contact.position,
            company: contact.company,
            phone: contact.phone.join(', '),
            email: contact.email.join(', '),
            address: contact.address,
            notes: contact.notes || '',
            folder: contact.folder || 'Uncategorized',
        });
    };

    const closeEditModal = () => {
        setEditingContact(null);
    };

    const handleSaveEdit = async () => {
        if (!editingContact) return;

        const updatedContact: Contact = {
            ...editingContact,
            name: editFormData.name,
            position: editFormData.position,
            company: editFormData.company,
            phone: editFormData.phone.split(',').map((p: string) => p.trim()).filter((p: string) => p),
            email: editFormData.email.split(',').map((e: string) => e.trim()).filter((e: string) => e),
            address: editFormData.address,
            notes: editFormData.notes,
            folder: editFormData.folder || 'Uncategorized',
            updatedAt: Date.now(),
        };

        await storage.saveContact(updatedContact);
        setEditingContact(null);
        loadContacts();
    };

    // Get unique folders from contacts
    const folders = Array.from(new Set(contacts.map(c => c.folder || 'Uncategorized'))).sort();

    // Filter contacts by search and folder
    const filteredContacts = contacts.filter(c => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            c.name.toLowerCase().includes(q) ||
            c.company.toLowerCase().includes(q) ||
            c.position.toLowerCase().includes(q) ||
            c.address.toLowerCase().includes(q) ||
            (c.notes || '').toLowerCase().includes(q) ||
            c.phone.some(p => p.includes(q)) ||
            c.email.some(e => e.toLowerCase().includes(q));
        const matchesFolder = selectedFolder === 'all' || (c.folder || 'Uncategorized') === selectedFolder;
        return matchesSearch && matchesFolder;
    });

    const renderContactCard = (contact: Contact) => {
        const isSelected = selectedIds.has(contact.id);
        return (
        <div
            key={contact.id}
            className={`glass rounded-2xl overflow-hidden border transition-all group ${isSelected ? 'border-brand-400/50 bg-brand-500/5' : 'border-brand-800/10 hover:border-brand-500/20'}`}
            onClick={selectMode ? () => toggleSelect(contact.id) : undefined}
        >
            <div className="p-4 flex gap-4">
                {/* Checkbox (select mode) */}
                {selectMode && (
                    <div className="flex items-center flex-shrink-0">
                        {isSelected ? (
                            <CheckSquare size={22} className="text-brand-400" />
                        ) : (
                            <Square size={22} className="text-brand-600" />
                        )}
                    </div>
                )}

                {/* Image Preview */}
                <div className="w-24 aspect-[1.586/1] rounded-xl overflow-hidden bg-brand-900 flex-shrink-0 border border-brand-800">
                    <img src={contact.imageData} alt={contact.name} className="h-full w-full object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="mb-2">
                        <h3 className="font-bold text-slate-100 truncate">{contact.name}</h3>
                        <p className="text-xs text-brand-400 font-medium uppercase tracking-wider">{contact.position}</p>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1 mb-3">
                        <div className="flex items-center gap-2">
                            <Building2 size={12} className="text-brand-500" />
                            <span className="truncate">{contact.company}</span>
                        </div>
                        {contact.notes && (
                            <div className="flex items-center gap-2 text-amber-400/70">
                                <StickyNote size={12} className="text-amber-500/50" />
                                <span className="truncate">{contact.notes}</span>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    {!selectMode && (
                    <div className="grid grid-cols-3 gap-2">
                        {contact.phone[0] && (
                            <a
                                href={`tel:${contact.phone[0]}`}
                                className="flex items-center justify-center gap-1.5 px-2 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors active:scale-95"
                            >
                                <Phone size={14} className="text-emerald-400" />
                                <span className="text-xs font-medium text-emerald-400">Call</span>
                            </a>
                        )}
                        {contact.email[0] && (
                            <a
                                href={`mailto:${contact.email[0]}`}
                                className="flex items-center justify-center gap-1.5 px-2 py-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg transition-colors active:scale-95"
                            >
                                <Mail size={14} className="text-sky-400" />
                                <span className="text-xs font-medium text-sky-400">Email</span>
                            </a>
                        )}
                        <button
                            onClick={() => exportService.toVCard(contact)}
                            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 rounded-lg transition-colors active:scale-95"
                        >
                            <FileDown size={14} className="text-violet-400" />
                            <span className="text-xs font-medium text-violet-400">Save</span>
                        </button>
                        <button
                            onClick={() => openEditModal(contact)}
                            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-lg transition-colors active:scale-95"
                        >
                            <Edit3 size={14} className="text-brand-400" />
                            <span className="text-xs font-medium text-brand-400">Edit</span>
                        </button>
                        <button
                            onClick={() => deleteContact(contact.id)}
                            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors active:scale-95"
                        >
                            <Trash2 size={14} className="text-red-400" />
                            <span className="text-xs font-medium text-red-400">Delete</span>
                        </button>
                    </div>
                    )}
                </div>
            </div>
        </div>
        );
    };

    // Group contacts by folder
    const groupedContacts = filteredContacts.reduce((acc, contact) => {
        const folder = contact.folder || 'Uncategorized';
        if (!acc[folder]) acc[folder] = [];
        acc[folder].push(contact);
        return acc;
    }, {} as Record<string, Contact[]>);

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            {/* Header */}
            <div className="flex flex-col glass sticky top-0 z-10 p-4 gap-4">
                <div className="flex items-center justify-between">
                    <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-semibold gradient-text">My Contacts</h1>
                    <div className="flex items-center gap-1">
                        {/* Select Mode Toggle */}
                        <button
                            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                            className={`p-2 rounded-full transition-colors ${selectMode ? 'bg-brand-500/20 text-brand-400' : 'hover:bg-white/10 text-brand-400 hover:text-white'}`}
                        >
                            <CheckSquare size={20} />
                        </button>
                        {/* Export */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportOptions(!showExportOptions)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-brand-400 hover:text-white"
                            >
                                <Download size={20} />
                            </button>
                            {showExportOptions && (
                                <div className="absolute right-0 mt-2 w-48 bg-brand-900 rounded-xl border border-brand-800 shadow-2xl z-50 overflow-hidden">
                                    {selectedIds.size > 0 && (
                                        <div className="px-4 py-2 text-xs text-brand-400 border-b border-brand-800 bg-brand-500/10">
                                            {selectedIds.size} contact{selectedIds.size > 1 ? 's' : ''} selected
                                        </div>
                                    )}
                                    <button
                                        onClick={() => handleExport('csv')}
                                        className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors"
                                    >
                                        Export as CSV
                                    </button>
                                    <button
                                        onClick={() => handleExport('excel')}
                                        className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 border-t border-brand-800 transition-colors"
                                    >
                                        Export as Excel
                                    </button>
                                    <button
                                        onClick={() => handleExport('vcard')}
                                        className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 border-t border-brand-800 transition-colors"
                                    >
                                        Export as vCard (.vcf)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search contacts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-brand-900/50 border border-brand-800 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm"
                    />
                </div>

                {/* Folder Filter */}
                <div className="relative">
                    <button
                        onClick={() => setShowFolderDropdown(!showFolderDropdown)}
                        className="w-full flex items-center justify-between bg-brand-900/50 border border-brand-800 rounded-xl py-2.5 px-4 hover:bg-brand-900/70 transition-all text-sm"
                    >
                        <div className="flex items-center gap-2">
                            <Folder size={18} className="text-brand-500" />
                            <span>{selectedFolder === 'all' ? 'All Folders' : selectedFolder}</span>
                        </div>
                        <span className="text-brand-500 text-xs">{filteredContacts.length}</span>
                    </button>

                    {showFolderDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-brand-900 rounded-xl border border-brand-800 shadow-2xl z-50 max-h-64 overflow-y-auto">
                            <button
                                onClick={() => {
                                    setSelectedFolder('all');
                                    setShowFolderDropdown(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors ${selectedFolder === 'all' ? 'bg-brand-500/20 text-brand-400' : ''}`}
                            >
                                All Folders ({contacts.length})
                            </button>
                            {folders.map(folder => (
                                <button
                                    key={folder}
                                    onClick={() => {
                                        setSelectedFolder(folder);
                                        setShowFolderDropdown(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors border-t border-brand-800 ${selectedFolder === folder ? 'bg-brand-500/20 text-brand-400' : ''}`}
                                >
                                    {folder} ({contacts.filter(c => (c.folder || 'Uncategorized') === folder).length})
                                </button>
                            ))}
                            <button
                                onClick={() => {
                                    setShowFolderDropdown(false);
                                    setShowCreateFolder(true);
                                }}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors border-t border-brand-800 text-emerald-400 flex items-center gap-2"
                            >
                                <FolderPlus size={16} />
                                Create New Folder
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 p-4 space-y-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-400"></div>
                    </div>
                ) : filteredContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-brand-500">
                        <Building2 size={48} className="mb-4 opacity-20" />
                        <p>{searchQuery ? "No contacts match your search" : "No contacts scanned yet"}</p>
                    </div>
                ) : selectedFolder === 'all' ? (
                    // Show grouped by folders
                    Object.entries(groupedContacts).sort(([a], [b]) => a.localeCompare(b)).map(([folder, folderContacts]) => (
                        <div key={folder} className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                                <Folder size={16} className="text-brand-500" />
                                <h3 className="text-sm font-bold text-brand-400 uppercase tracking-wider">{folder}</h3>
                                <span className="text-xs text-brand-600">({folderContacts.length})</span>
                            </div>
                            <div className="space-y-4">
                                {folderContacts.map((contact) => renderContactCard(contact))}
                            </div>
                        </div>
                    ))
                ) : (
                    // Show flat list when folder is selected
                    filteredContacts.map((contact) => renderContactCard(contact))
                )}
            </div>

            {selectMode ? (
                <div className="sticky bottom-0 glass border-t border-brand-800 p-4 flex items-center justify-between gap-3 z-10">
                    <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 px-3 py-2 bg-brand-800/50 hover:bg-brand-800 rounded-xl text-sm transition-colors"
                    >
                        {selectedIds.size === filteredContacts.length ? <CheckSquare size={16} className="text-brand-400" /> : <Square size={16} className="text-brand-600" />}
                        <span>{selectedIds.size === filteredContacts.length ? 'Deselect All' : 'Select All'}</span>
                    </button>
                    <span className="text-xs text-brand-500">{selectedIds.size} selected</span>
                    <button
                        onClick={exitSelectMode}
                        className="p-2 hover:bg-white/10 rounded-full text-brand-500 transition-colors"
                    >
                        <XCircle size={20} />
                    </button>
                </div>
            ) : (
                <footer className="p-6 text-center text-[10px] text-brand-700 uppercase tracking-widest bg-brand-950">
                    Showing {filteredContacts.length} of {contacts.length} Contacts
                </footer>
            )}

            {/* Create Folder Modal */}
            {showCreateFolder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="bg-brand-900 rounded-2xl w-full max-w-sm border border-brand-800 shadow-2xl">
                        <div className="p-4 border-b border-brand-800">
                            <h3 className="text-lg font-bold gradient-text">Create New Folder</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="relative">
                                <FolderPlus className="absolute left-3 top-3 text-brand-500" size={18} />
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newFolderName.trim()) {
                                            setSelectedFolder(newFolderName.trim());
                                            setNewFolderName('');
                                            setShowCreateFolder(false);
                                        }
                                    }}
                                    placeholder="Folder name (e.g., Clients, Suppliers)"
                                    autoFocus
                                    className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-brand-800 flex gap-2">
                            <button
                                onClick={() => {
                                    setShowCreateFolder(false);
                                    setNewFolderName('');
                                }}
                                className="flex-1 py-2.5 bg-brand-800 hover:bg-brand-700 rounded-xl font-medium transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (newFolderName.trim()) {
                                        setSelectedFolder(newFolderName.trim());
                                        setNewFolderName('');
                                        setShowCreateFolder(false);
                                    }
                                }}
                                disabled={!newFolderName.trim()}
                                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Contact Modal */}
            {editingContact && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="bg-brand-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-brand-800 shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-brand-800 flex items-center justify-between sticky top-0 bg-brand-900">
                            <button onClick={closeEditModal} className="p-2 text-brand-600 hover:text-white">
                                <X size={20} />
                            </button>
                            <h3 className="text-lg font-bold gradient-text">Edit Contact</h3>
                            <button onClick={handleSaveEdit} className="p-2 text-emerald-500 hover:text-emerald-400">
                                <Save size={20} />
                            </button>
                        </div>

                        {/* Card Preview */}
                        <div className="p-4">
                            <div className="w-full aspect-[1.586/1] rounded-xl overflow-hidden bg-brand-800 border border-brand-700">
                                <img src={editingContact.imageData} alt="card" className="w-full h-full object-cover" />
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div className="p-4 space-y-4">
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-brand-500" size={18} />
                                <input
                                    type="text"
                                    value={editFormData.name}
                                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                    placeholder="Full Name"
                                    className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            <div className="relative">
                                <Briefcase className="absolute left-3 top-3 text-brand-500" size={18} />
                                <input
                                    type="text"
                                    value={editFormData.position}
                                    onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                                    placeholder="Job Title"
                                    className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            <div className="relative">
                                <Building2 className="absolute left-3 top-3 text-brand-500" size={18} />
                                <input
                                    type="text"
                                    value={editFormData.company}
                                    onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                                    placeholder="Company Name"
                                    className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            <div className="relative">
                                <Phone className="absolute left-3 top-3 text-brand-500" size={18} />
                                <input
                                    type="text"
                                    value={editFormData.phone}
                                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                                    placeholder="Phone Numbers (comma separated)"
                                    className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-brand-500" size={18} />
                                <input
                                    type="text"
                                    value={editFormData.email}
                                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                    placeholder="Email Addresses (comma separated)"
                                    className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-brand-500" size={18} />
                                <textarea
                                    value={editFormData.address}
                                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                                    placeholder="Office Address"
                                    rows={2}
                                    className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 resize-none"
                                />
                            </div>

                            <div className="relative">
                                <StickyNote className="absolute left-3 top-3 text-brand-500" size={18} />
                                <textarea
                                    value={editFormData.notes}
                                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                    placeholder="Notes (e.g., what they're inquiring about)"
                                    rows={3}
                                    className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 resize-none"
                                />
                            </div>

                            {/* Folder Selector */}
                            <div className="relative">
                                <Folder className="absolute left-3 top-3 text-brand-500" size={18} />
                                <select
                                    value={editFormData.folder}
                                    onChange={(e) => setEditFormData({ ...editFormData, folder: e.target.value })}
                                    className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 bg-brand-900"
                                >
                                    <option value="Uncategorized">Uncategorized</option>
                                    {folders.filter(f => f !== 'Uncategorized').map(folder => (
                                        <option key={folder} value={folder}>{folder}</option>
                                    ))}
                                    <option value="__new__">+ Create New Folder</option>
                                </select>
                            </div>

                            {/* New Folder Input (shown when "Create New Folder" is selected) */}
                            {editFormData.folder === '__new__' && (
                                <div className="relative">
                                    <FolderPlus className="absolute left-3 top-3 text-brand-500" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Enter new folder name..."
                                        onBlur={(e) => {
                                            const newFolder = e.target.value.trim();
                                            if (newFolder) {
                                                setEditFormData({ ...editFormData, folder: newFolder });
                                            } else {
                                                setEditFormData({ ...editFormData, folder: 'Uncategorized' });
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const newFolder = e.currentTarget.value.trim();
                                                if (newFolder) {
                                                    setEditFormData({ ...editFormData, folder: newFolder });
                                                } else {
                                                    setEditFormData({ ...editFormData, folder: 'Uncategorized' });
                                                }
                                            }
                                        }}
                                        autoFocus
                                        className="w-full glass border border-brand-500 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Save Button */}
                        <div className="p-4 border-t border-brand-800">
                            <button
                                onClick={handleSaveEdit}
                                className="w-full py-3 bg-brand-100 text-brand-950 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all"
                            >
                                <Save size={18} />
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contacts;
