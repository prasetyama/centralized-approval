import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const MainLayout = () => {
    return (
        <div className="min-h-screen bg-slate-50/50">
            <Sidebar />
            <div className="pl-64">
                <Header />
                <main className="p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
