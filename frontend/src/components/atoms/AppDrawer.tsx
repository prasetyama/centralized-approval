import { useState, useRef, useEffect } from 'react';
import { ExternalLink, LayoutGrid } from 'lucide-react';
import { cn } from '@/components/ui/UI';
import type { SSOModule } from '@/context/AuthContext';
import { ssoApi } from '@/services/api';

interface AppDrawerProps {
    modules?: SSOModule[];
    currentModuleCode?: string;
}

/** Google-style app drawer grid showing SSO modules */
const AppDrawer = ({ modules: initialModules = [], currentModuleCode = 'APPROVAL' }: AppDrawerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [fetchedModules, setFetchedModules] = useState<SSOModule[]>(initialModules);
    const ref = useRef<HTMLDivElement>(null);

    // Fetch modules from API
    useEffect(() => {
        const fetchModules = async () => {
            try {
                const response = await ssoApi.getModules();
                if (response.modules) {
                    const mappedModules = response.modules.map((m: any) => ({
                        code: m.module,
                        name: m.name || m.module,
                        redirect_url: m.redirect_url || ''
                    }));
                    setFetchedModules(mappedModules);
                }
            } catch (error) {
                console.error("Failed to fetch modules", error);
            }
        };

        fetchModules();
    }, []);

    // Close on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const handleModuleClick = (mod: SSOModule) => {
        console.log(mod);
        if (mod.code === currentModuleCode) {
            setIsOpen(false);
            return;
        }
        const token = localStorage.getItem('sso_token');
        if (mod.redirect_url && token) {
            const separator = mod.redirect_url.includes('?') ? '&' : '?';
            window.location.href = `${mod.redirect_url}${separator}token=${token}`;
        }
    };

    const ssoUrl = import.meta.env.VITE_SSO_URL;

    return (
        <div ref={ref} className="relative">
            {/* Trigger — 3×3 dot grid icon */}
            <button
                onClick={() => setIsOpen((o) => !o)}
                className="p-2 rounded-full hover:bg-white/15 transition-colors cursor-pointer"
                title="Applications"
            >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="3.5" cy="3.5" r="1.8" fill="currentColor" />
                    <circle cx="9" cy="3.5" r="1.8" fill="currentColor" />
                    <circle cx="14.5" cy="3.5" r="1.8" fill="currentColor" />
                    <circle cx="3.5" cy="9" r="1.8" fill="currentColor" />
                    <circle cx="9" cy="9" r="1.8" fill="currentColor" />
                    <circle cx="14.5" cy="9" r="1.8" fill="currentColor" />
                    <circle cx="3.5" cy="14.5" r="1.8" fill="currentColor" />
                    <circle cx="9" cy="14.5" r="1.8" fill="currentColor" />
                    <circle cx="14.5" cy="14.5" r="1.8" fill="currentColor" />
                </svg>
            </button>

            {/* Drawer panel */}
            {isOpen && (
                <>
                    {/* Invisible backdrop — click to close */}
                    <div
                        className="fixed inset-0 z-40"
                        aria-hidden="true"
                        onClick={() => setIsOpen(false)}
                    />

                    <div
                        className={cn(
                            "absolute right-0 mt-2 z-50",
                            "w-[280px] bg-white rounded-2xl shadow-2xl border border-neutral-200/80",
                            "origin-top-right",
                            "animate-[drawerIn_0.18s_ease-out]"
                        )}
                    >
                        {/* Header */}
                        <div className="px-5 pt-4 pb-3">
                            <h3 className="text-[11px] font-black text-neutral-400 uppercase tracking-widest">
                                Applications
                            </h3>
                        </div>

                        {/* Module grid */}
                        <div className="px-3 pb-3 grid grid-cols-3 gap-1">
                            {fetchedModules.map((mod) => {
                                const isCurrent = mod.code === currentModuleCode;
                                return (
                                    <button
                                        key={mod.code}
                                        onClick={() => handleModuleClick(mod)}
                                        className={cn(
                                            "flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200 cursor-pointer group",
                                            isCurrent
                                                ? "bg-neutral-100 ring-1 ring-neutral-300"
                                                : "hover:bg-neutral-50"
                                        )}
                                        title={mod.name || mod.code}
                                    >
                                        {/* App icon circle */}
                                        <LayoutGrid size={42} color='#000' />
                                        {/* App name */}
                                        <span className="text-[11px] font-medium text-neutral-600 text-center leading-tight line-clamp-2 w-full">
                                            {mod.name || mod.code}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer — link to SSO Dashboard */}
                        {ssoUrl && (
                            <div className="border-t border-neutral-100 px-4 py-3 flex justify-center">
                                <a
                                    href={ssoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[#3032DC] hover:text-[#7a1119] font-semibold flex items-center gap-1.5 transition-colors"
                                >
                                    SSO Dashboard
                                    <ExternalLink size={12} />
                                </a>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default AppDrawer;
