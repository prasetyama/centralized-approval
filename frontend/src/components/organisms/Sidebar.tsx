import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Inbox,
    Users,
    GitBranch,
    LogOut,
    History,
    ChevronLeft,
    ChevronRight,
    X,
    Play,
    Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Approval Inbox', href: '/approval', icon: Inbox },
    { name: 'History', href: '/history', icon: History, userOnly: true },
    { name: 'Workflows', href: '/admin/workflows', icon: GitBranch, adminOnly: true },
    { name: 'User Management', href: '/admin/users', icon: Users, adminOnly: true },
    { name: 'Simulator', href: '/admin/workflow/simulator', icon: Play, adminOnly: true },
    { name: 'Master Data', href: '/admin/master-data', icon: Settings, adminOnly: true },
];

type SidebarProps = {
    isExpanded?: boolean;
    setIsExpanded?: (expanded: boolean) => void;
    isMobileOpen: boolean;
    setIsMobileOpen: (open: boolean) => void;
};

export const Sidebar = ({ isExpanded = false, setIsExpanded, isMobileOpen, setIsMobileOpen }: SidebarProps) => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-40 h-screen border-r border-slate-200 bg-white shadow-sm transition-all duration-300 flex flex-col",
                isExpanded ? "w-64" : "w-20",
                isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}
        >
            <div className="flex flex-col flex-1 h-0 px-3 py-4">
                <div className={cn("mb-4 flex items-center py-4", isExpanded ? "px-2" : "justify-center")}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                        <GitBranch size={24} />
                    </div>
                    {isExpanded && (
                        <span className="ml-3 text-xl font-bold tracking-tight text-slate-900 overflow-hidden whitespace-nowrap">
                            Approval <span className="text-blue-600">HUB</span>
                        </span>
                    )}

                    <button
                        className="ml-auto lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        onClick={() => setIsMobileOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className={cn(
                    "flex items-center mb-2 transition-all duration-300",
                    isExpanded ? "justify-between px-4" : "justify-center px-2"
                )}>
                    <h2 className={cn(
                        "text-[11px] font-bold text-slate-400 uppercase tracking-wider transition-all duration-300 whitespace-nowrap",
                        !isExpanded ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                    )}>
                        Main Menu
                    </h2>
                    <button
                        onClick={() => setIsExpanded?.(!isExpanded)}
                        className="hidden lg:flex p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
                        title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                        {isExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                    </button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
                    {navItems.map((item) => {
                        if (item.adminOnly && user?.role_code !== 'ADMIN') return null;
                        if (item.userOnly && user?.role_code === 'ADMIN') return null;

                        return (
                            <NavLink
                                key={item.href}
                                to={item.href}
                                onClick={() => setIsMobileOpen(false)}
                                title={!isExpanded ? item.name : undefined}
                                className={({ isActive }) =>
                                    cn(
                                        'group flex items-center rounded-lg py-2.5 transition-all duration-200',
                                        isExpanded ? 'px-3' : 'justify-center px-0',
                                        isActive
                                            ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/50'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    )
                                }
                            >
                                <item.icon
                                    size={20}
                                    className={cn(
                                        'shrink-0 transition-colors',
                                        isExpanded ? 'mr-3' : '',
                                        'group-hover:text-blue-600'
                                    )}
                                />
                                {isExpanded && <span className="truncate">{item.name}</span>}
                            </NavLink>
                        );
                    })}
                </nav>
            </div>

            <div className="border-t border-slate-200 p-3 bg-white">
                <div className={cn("mb-4 mt-2 flex items-center", isExpanded ? "px-2" : "justify-center")}>
                    <div className="h-9 w-9 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold border border-slate-200">
                        {user?.username?.[0]?.toUpperCase()}
                    </div>
                    {isExpanded && (
                        <div className="ml-3 overflow-hidden">
                            <p className="truncate text-sm font-semibold text-slate-900">
                                {user?.first_name} {user?.last_name}
                            </p>
                            <p className="truncate text-xs text-slate-500 font-medium">{user?.role_name}</p>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleLogout}
                    title={!isExpanded ? "Logout" : undefined}
                    className={cn(
                        "flex w-full items-center rounded-lg py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors",
                        isExpanded ? "px-3" : "justify-center px-0"
                    )}
                >
                    <LogOut size={20} className={cn("shrink-0", isExpanded ? "mr-3" : "")} />
                    {isExpanded && "Logout"}
                </button>
            </div>
        </aside>
    );
};
