import { Bell, Menu, FlaskConical } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AppDrawer from '@/components/atoms/AppDrawer';
import { GlobalSearch } from '@/components/molecules/GlobalSearch';

export const Header = ({ onMenuClick }: { onMenuClick?: () => void }) => {
    const { user } = useAuth();

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b-2 border-orange-400 bg-orange-50/95 px-4 lg:px-8 backdrop-blur-md shadow-xs">
            <div className="flex flex-1 items-center gap-3 max-w-2xl">
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="p-2 text-orange-800 hover:bg-orange-100 rounded-lg lg:hidden"
                        title="Open Menu"
                    >
                        <Menu size={20} />
                    </button>
                )}

                <div
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-extrabold tracking-wider text-white uppercase shadow-xs ring-1 ring-orange-700/20"
                    title="Lingkungan Pengujian (SIT Environment)"
                >
                    <FlaskConical size={14} className="shrink-0" />
                    <span>SIT</span>
                </div>

                <GlobalSearch />
            </div>

            <div className="flex items-center space-x-4">
                <span className="hidden md:inline-flex items-center rounded-full border border-orange-300 bg-orange-100/90 px-3 py-1 text-xs font-bold tracking-wide text-orange-900">
                    SIT Testing Environment
                </span>
                <button className="relative rounded-full p-2 text-orange-800 hover:bg-orange-100 hover:text-orange-950 transition-colors">
                    <Bell size={20} />
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-orange-50"></span>
                </button>
                <AppDrawer />
                <div className="h-8 w-px bg-orange-200"></div>
                <div className="flex items-center space-x-3 px-2">
                    <span className="text-sm font-semibold text-orange-950">
                        {user?.department}
                    </span>
                    <div className="h-2 w-2 rounded-full bg-orange-500" title="SIT Mode Active"></div>
                </div>
            </div>
        </header>
    );
};
