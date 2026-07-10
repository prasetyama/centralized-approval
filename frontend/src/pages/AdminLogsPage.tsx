import { useState, useEffect } from 'react';
import { RefreshCcw, Terminal, AlertCircle } from 'lucide-react';
import api from '../services/api';

export const AdminLogsPage = () => {
    const [logs, setLogs] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            setError(null);
            const response: any = await api.get('/admin/system-logs');
            setLogs(response.data || '');
        } catch (err: any) {
            setError(err || 'Failed to fetch logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Logs</h1>
                    <p className="text-sm text-slate-500 mt-1">View the latest system application logs.</p>
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                >
                    <RefreshCcw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div className="bg-[#1e1e1e] rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
                <div className="bg-[#2d2d2d] px-4 py-3 flex items-center border-b border-[#404040]">
                    <Terminal size={18} className="text-slate-400 mr-2" />
                    <span className="text-sm font-medium text-slate-200 font-mono">backend/logs/log.log</span>
                </div>
                
                <div className="flex-1 p-4 overflow-auto font-mono text-xs sm:text-sm text-slate-300 whitespace-pre-wrap">
                    {loading && !logs ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <RefreshCcw size={24} className="animate-spin mb-4" />
                            Loading logs...
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full text-red-400 bg-red-400/10 m-4 rounded-lg p-4">
                            <AlertCircle size={20} className="mr-2 shrink-0" />
                            {error}
                        </div>
                    ) : logs ? (
                        <div>{logs}</div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            No logs found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
