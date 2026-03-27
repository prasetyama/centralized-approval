import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Inbox,
    Settings,
    Users,
    GitBranch,
    LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Unified Inbox', href: '/inbox', icon: Inbox },
    { name: 'Workflows', href: '/admin/workflows', icon: GitBranch, adminOnly: true },
    { name: 'User Management', href: '/admin/users', icon: Users, adminOnly: true },
    { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-200 bg-white shadow-sm">
            <div className="flex h-full flex-col px-3 py-4">
                <div className="mb-8 flex items-center px-2 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                        <GitBranch size={24} />
                    </div>
                    <span className="ml-3 text-xl font-bold tracking-tight text-slate-900">
                        Approval <span className="text-blue-600">HUB</span>
                    </span>
                </div>

                <nav className="flex-1 space-y-1">
                    {navItems.map((item) => {
                        if (item.adminOnly && user?.role_code !== 'ADMIN') return null;

                        return (
                            <NavLink
                                key={item.href}
                                to={item.href}
                                className={({ isActive }) =>
                                    cn(
                                        'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                                        isActive
                                            ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/50'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    )
                                }
                            >
                                <item.icon
                                    size={18}
                                    className={cn(
                                        'mr-3 transition-colors',
                                        'group-hover:text-blue-600'
                                    )}
                                />
                                {item.name}
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="mt-auto border-t border-slate-200 pt-4 px-2">
                    <div className="mb-4 flex items-center p-2">
                        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold border border-slate-200">
                            {user?.username?.[0]?.toUpperCase()}
                        </div>
                        <div className="ml-3 overflow-hidden">
                            <p className="truncate text-sm font-semibold text-slate-900">
                                {user?.first_name} {user?.last_name}
                            </p>
                            <p className="truncate text-xs text-slate-500 font-medium">{user?.role_name}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut size={18} className="mr-3" />
                        Logout
                    </button>
                </div>
            </div>
        </aside>
    );
};
