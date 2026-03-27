import { useQuery } from '@tanstack/react-query';
import {
    CheckCircle2,
    Clock,
    XCircle,
    RefreshCcw,
    ArrowUpRight,
    ShoppingCart,
    Wallet,
    Users
} from 'lucide-react';
import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/utils';

export const DashboardPage = () => {
    const { user } = useAuth();

    const { data: summary, isLoading } = useQuery({
        queryKey: ['dashboard-summary'],
        queryFn: () => api.get('/dashboard/summary'),
    });

    if (isLoading) {
        return (
            <div className="space-y-8 animate-pulse">
                <div className="h-10 w-48 bg-slate-200 rounded-md"></div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-slate-100 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    const stats = [
        {
            title: 'Waiting for Me',
            value: summary?.data?.inbox_count || 0,
            icon: Clock,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
        },
        {
            title: 'Approved Requests',
            value: summary?.data?.status_counts?.approved || 0,
            icon: CheckCircle2,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
        },
        {
            title: 'Rejected Requests',
            value: summary?.data?.status_counts?.rejected || 0,
            icon: XCircle,
            color: 'text-red-600',
            bg: 'bg-red-50',
        },
        {
            title: 'In Progress',
            value: summary?.data?.status_counts?.in_progress || 0,
            icon: RefreshCcw,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
        },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                    Hello, {user?.first_name}!
                </h1>
                <p className="mt-1 text-slate-500 font-medium">
                    Here's what's happening with your approvals today.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title} className="group hover:border-blue-200 hover:shadow-md transition-all">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-semibold text-slate-600">
                                {stat.title}
                            </CardTitle>
                            <div className={`${stat.bg} p-2 rounded-lg transition-colors group-hover:scale-110`}>
                                <stat.icon className={stat.color} size={20} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-7">
                <Card className="lg:col-span-4 overflow-hidden border-slate-100">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Recent Activity</CardTitle>
                            <p className="text-sm text-slate-500 mt-1">Latest actions in the approval engine</p>
                        </div>
                        <Button variant="ghost" size="sm" className="group">
                            View All <ArrowUpRight size={16} className="ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {(summary?.data?.recent_activity || []).map((activity: any) => (
                                <div key={activity.id} className="flex items-start space-x-4">
                                    <div className="mt-1 rounded-full bg-slate-100 p-2 border border-slate-200">
                                        {activity.action === 'SUBMITTED' ? (
                                            <ArrowUpRight className="text-blue-600" size={16} />
                                        ) : activity.action === 'APPROVED' ? (
                                            <CheckCircle2 className="text-emerald-600" size={16} />
                                        ) : (
                                            <XCircle className="text-red-500" size={16} />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-semibold text-slate-900 leading-none">
                                            {activity.actor_name} <span className="text-slate-500 font-normal">
                                                {activity.action.toLowerCase().replace('_', ' ')}
                                            </span>
                                        </p>
                                        <p className="text-xs text-slate-400">{formatDate(activity.timestamp)}</p>
                                        <div className="mt-2 rounded-lg bg-slate-50/50 p-3 border border-slate-100 italic text-sm text-slate-600">
                                            "{activity.details}"
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!summary?.data?.recent_activity || summary.data.recent_activity.length === 0) && (
                                <div className="text-center py-12 text-slate-400">
                                    <Clock className="mx-auto h-12 w-12 opacity-20 mb-3" />
                                    <p>No recent activity found.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 border-slate-100 bg-slate-50/30">
                    <CardHeader>
                        <CardTitle>Module Summary</CardTitle>
                        <p className="text-sm text-slate-500 mt-1">Request distribution by source</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(summary?.data?.module_counts || [
                            { name: 'E-Order', code: 'EORDER', icon: ShoppingCart, color: 'bg-blue-100 text-blue-700' },
                            { name: 'Finance', code: 'FINANCE', icon: Wallet, color: 'bg-emerald-100 text-emerald-700' },
                            { name: 'HR', code: 'HR', icon: Users, color: 'bg-purple-100 text-purple-700' },
                        ]).map((mod: any) => {
                            const Icon = mod.icon || (mod.code === 'EORDER' ? ShoppingCart : mod.code === 'FINANCE' ? Wallet : Users);
                            return (
                                <div key={mod.name} className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
                                    <div className="flex items-center space-x-3">
                                        <div className={`p-2 rounded-lg ${mod.color || 'bg-slate-100 text-slate-700'}`}>
                                            <Icon size={20} />
                                        </div>
                                        <span className="font-semibold text-slate-700">{mod.name}</span>
                                    </div>
                                    <Badge variant="secondary" className="px-3 py-1 font-bold">
                                        {mod.count || 0}
                                    </Badge>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
