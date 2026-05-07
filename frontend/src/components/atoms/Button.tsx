import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', loading, children, ...props }, ref) => {
        const variants: Record<string, string> = {
            primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200',
            secondary: 'bg-slate-900 text-white hover:bg-slate-800',
            outline: 'border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700',
            ghost: 'bg-transparent hover:bg-slate-100 text-slate-600',
            danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-200',
        };

        const sizes: Record<string, string> = {
            sm: 'h-8 px-3 text-xs',
            md: 'h-10 px-4 py-2 text-sm',
            lg: 'h-12 px-8 text-base',
            icon: 'w-10',
        };

        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
                    variants[variant] || variants.primary,
                    sizes[size] || sizes.md,
                    className
                )}
                disabled={loading || props.disabled}
                {...props}
            >
                {loading ? (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : null}
                {children}
            </button>
        );
    }
);
