import { Bell, Search, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AppDrawer from '@/components/atoms/AppDrawer';

export const Header = ({ onMenuClick }: { onMenuClick?: () => void }) => {
    const { user } = useAuth();

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/80 px-4 lg:px-8 backdrop-blur-md">
            <div className="flex flex-1 items-center max-w-xl">
                {onMenuClick && (
                    <button 
                        onClick={onMenuClick}
                        className="mr-4 p-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden"
                    >
                        <Menu size={20} />
                    </button>
                )}
                <div className="relative w-full hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search approvals, reference IDs..."
                        className="w-full rounded-full border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-sm outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                    />
                </div>
            </div>

            <div className="flex items-center space-x-4">
                <AppDrawer />
                <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                    <Bell size={20} />
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                </button>
                <div className="h-8 w-px bg-slate-200"></div>
                <div className="flex items-center space-x-3 px-2">
                    <span className="text-sm font-semibold text-slate-700">
                        {user?.department}
                    </span>
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                </div>
            </div>
        </header>
    );
};
