import { useQuery } from '@tanstack/react-query';
import { Users, UserPlus, Shield, Mail, Building, MoreVertical, Edit2, Trash2, Search, Filter } from 'lucide-react';
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
import { useState, useEffect } from 'react';

export const AdminUserPage = () => {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const { data: users, isLoading: usersLoading } = useQuery({
        queryKey: ['admin-users', debouncedSearch],
        queryFn: () => api.get('/admin/users', { params: { search: debouncedSearch } }),
    });

    if (usersLoading) {
        return <div className="p-8 text-center text-slate-500 animate-pulse">Loading user management...</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">User Management</h1>
                    <p className="mt-1 text-slate-500">Manage system users, roles, and department assignments.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                        <Shield size={16} /> Manage Roles
                    </Button>
                    <Button className="gap-2">
                        <UserPlus size={16} /> Add User
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="p-6 bg-blue-50/30 border-blue-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-100/50 rounded-xl text-blue-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Users</p>
                        <p className="text-2xl font-black text-slate-900">{users?.count || 0}</p>
                    </div>
                </Card>
                {/* Additional summary cards can go here */}
            </div>

            <Card>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                        />
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                        <Filter size={14} /> Filter
                    </Button>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(users?.results || []).map((user: any) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                                            {user.first_name[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">{user.first_name} {user.last_name}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div>
                                        <p className="font-bold text-slate-900">{user.email}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="font-bold tracking-tight">
                                        {user.role_name}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-slate-600">
                                        <Building size={14} className="text-slate-400" />
                                        <span className="text-sm font-medium">{user.department || '-'}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={user.is_active ? 'success' : 'secondary'}>
                                        {user.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                                            <Edit2 size={16} />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600">
                                            <Trash2 size={16} />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                                            <MoreVertical size={16} />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
};
