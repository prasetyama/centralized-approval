import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const MainLayout = () => {
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50/50">
            <Sidebar 
                isExpanded={isSidebarExpanded} 
                setIsExpanded={setIsSidebarExpanded}
                isMobileOpen={isMobileOpen}
                setIsMobileOpen={setIsMobileOpen}
            />
            
            <div className={`transition-all duration-300 ${isSidebarExpanded ? 'lg:pl-64' : 'lg:pl-20'} pl-0`}>
                <Header onMenuClick={() => setIsMobileOpen(true)} />
                <main className="p-4 lg:p-8">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}
        </div>
    );
};
