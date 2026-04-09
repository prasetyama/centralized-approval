import { useQuery } from '@tanstack/react-query';
import {
    Inbox,
    Filter,
    ArrowUpRight,
    ShoppingCart,
    Wallet,
    Users,
} from 'lucide-react';
import api from '@/services/api';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/atoms/Table';
import { formatDate } from '@/lib/utils';
import { Link } from 'react-router-dom';

export const HistoryPage = () => {
    const { data: history, isLoading } = useQuery<any>({
        queryKey: ['history'],
        queryFn: () => api.get('/history'),
    });

    const getModuleIcon = (code: string) => {
        switch (code) {
            case 'EORDER': return <ShoppingCart size={16} className="text-blue-600" />;
            case 'FINANCE': return <Wallet size={16} className="text-emerald-600" />;
            case 'HR': return <Users size={16} className="text-purple-600" />;
            default: return <Inbox size={16} className="text-slate-600" />;
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'URGENT': return <Badge variant="error" className="font-bold">URGENT</Badge>;
            case 'HIGH': return <Badge variant="warning">High</Badge>;
            case 'MEDIUM': return <Badge variant="info">Medium</Badge>;
            default: return <Badge variant="secondary">Low</Badge>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <Badge variant="success">Approved</Badge>;
            case 'REJECTED': return <Badge variant="error">Rejected</Badge>;
            case 'IN_PROGRESS': return <Badge variant="info">In Progress</Badge>;
            case 'REVISED': return <Badge variant="warning">Revised</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500 animate-pulse">Loading history...</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Approval History</h1>
                    <p className="mt-1 text-slate-500">Review your past approval actions across all departments.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                        <Filter size={16} /> Filters
                    </Button>
                    <Button className="gap-2">
                        Refresh
                    </Button>
                </div>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Module</TableHead>
                            <TableHead>Request Title</TableHead>
                            <TableHead>Requester</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date Received</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(history?.results || []).map((item: any) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                                            {getModuleIcon(item.module_code)}
                                        </div>
                                        <span className="font-medium text-xs text-slate-600">{item.module_name}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="space-y-1">
                                        <p className="font-semibold text-slate-900">{item.title}</p>
                                        <p className="text-xs text-slate-500">Ref: {item.reference_id}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                            {item.requester_name[0].toUpperCase()}
                                        </div>
                                        <span>{item.requester_name}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {getPriorityBadge(item.priority)}
                                </TableCell>
                                <TableCell>
                                    {getStatusBadge(item.status)}
                                </TableCell>
                                <TableCell className="text-slate-500 text-xs">
                                    {formatDate(item.created_at)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Link to={`/workflow/${item.id}`}>
                                        <Button variant="outline" size="sm" className="gap-2">
                                            View Details <ArrowUpRight size={14} />
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                        {(!history?.results || history.results.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <Inbox className="h-12 w-12 opacity-10 mb-4" />
                                        <p className="text-lg font-medium">No history</p>
                                        <p className="text-sm">You haven't processed any approval requests yet.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
};
