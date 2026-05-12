import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false
}: ConfirmationModalProps) => {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            iconBg: 'bg-red-50',
            iconText: 'text-red-600',
            ring: 'ring-red-50/50',
            button: 'bg-red-600 hover:bg-red-700 shadow-red-100',
            gradient: 'from-red-500 to-orange-500'
        },
        warning: {
            iconBg: 'bg-amber-50',
            iconText: 'text-amber-600',
            ring: 'ring-amber-50/50',
            button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-100',
            gradient: 'from-amber-500 to-orange-400'
        },
        info: {
            iconBg: 'bg-indigo-50',
            iconText: 'text-indigo-600',
            ring: 'ring-indigo-50/50',
            button: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100',
            gradient: 'from-indigo-500 to-blue-500'
        }
    };

    const style = variantStyles[variant];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <Card className="w-full max-w-md shadow-2xl border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 bg-white">
                {/* <div className={`p-1 h-1.5 bg-gradient-to-r ${style.gradient}`} /> */}
                <div className="p-8 space-y-6 text-center">
                    <div className="flex justify-center">
                        <div className={`p-4 rounded-2xl ${style.iconBg} ${style.iconText} ring-8 ${style.ring}`}>
                            <AlertTriangle size={32} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h3>
                        <p className="text-slate-500 font-medium leading-relaxed">
                            {description}
                        </p>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <Button
                            variant="ghost"
                            className="flex-1 rounded-xl h-12 font-bold text-slate-500 hover:bg-slate-100 transition-all"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {cancelText}
                        </Button>
                        <Button
                            variant="primary"
                            className={`flex-1 rounded-xl h-12 font-bold shadow-lg text-white transition-all ${style.button}`}
                            onClick={onConfirm}
                            loading={isLoading}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
