import { Camera, Image as ImageIcon, Trash2, X } from 'lucide-react';

interface PhotoActionSheetProps {
    isOpen: boolean;
    label: string;
    hasPhoto: boolean;
    onTakePhoto: () => void;
    onChooseGallery: () => void;
    onRemovePhoto: () => void;
    onClose: () => void;
}

const PhotoActionSheet: React.FC<PhotoActionSheetProps> = ({
    isOpen, label, hasPhoto, onTakePhoto, onChooseGallery, onRemovePhoto, onClose,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60" />
            <div
                className="relative w-full max-w-md bg-brand-900 rounded-t-2xl border-t border-brand-800 p-4 pb-8 space-y-1"
                onClick={(e) => e.stopPropagation()}
            >
                <p className="text-xs text-brand-500 font-medium uppercase tracking-wider text-center mb-3">{label}</p>

                <button
                    onClick={onTakePhoto}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                    <Camera size={20} className="text-brand-400" />
                    <span className="text-sm font-medium text-slate-200">Take Photo</span>
                </button>

                <button
                    onClick={onChooseGallery}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                    <ImageIcon size={20} className="text-brand-400" />
                    <span className="text-sm font-medium text-slate-200">Choose from Gallery</span>
                </button>

                {hasPhoto && (
                    <button
                        onClick={onRemovePhoto}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-red-500/10 active:bg-red-500/20 transition-colors"
                    >
                        <Trash2 size={20} className="text-red-400" />
                        <span className="text-sm font-medium text-red-400">Remove Photo</span>
                    </button>
                )}

                <div className="pt-2">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-brand-800 hover:bg-brand-700 rounded-xl text-sm font-medium text-slate-300 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PhotoActionSheet;
