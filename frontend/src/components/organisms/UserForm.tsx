import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X } from 'lucide-react';
import api from '@/services/api';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';

interface UserFormProps {
    initialData?: any;
    onClose: () => void;
}

interface User {
    id?: number;
    username: string;
    password: string;
    email: string;
    first_name: string;
    last_name: string;
    role: number;
    is_active: boolean;
    department: string;
    is_approver: boolean;

}

export const UserForm: React.FC<UserFormProps> = ({ initialData, onClose }) => {

    const queryClient = useQueryClient();
    const isEdit = !!initialData;

    const [formData, setFormData] = useState<User>({
        username: initialData?.username || '',
        password: initialData?.password || '',
        email: initialData?.email || '',
        first_name: initialData?.first_name || '',
        last_name: initialData?.last_name || '',
        role: initialData?.role || '',
        is_active: initialData?.is_active || true,
        department: initialData?.department || '',
        is_approver: initialData?.is_approver || false,
    });

    const { data: roles } = useQuery<any>({
        queryKey: ['admin-roles'],
        queryFn: () => api.get('/admin/roles'),
    });

    const mutation = useMutation({
        mutationFn: (data: any) => {
            if (isEdit) {
                return api.put(`/admin/users/${initialData.id}/`, data);
            }
            return api.post('/admin/users/', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            onClose();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({
            ...formData,
            role: formData.role,
            department: formData.department,
        });
    };

    const roleOptions = ((roles as any)?.results || []).map((r: any) => ({ value: r.id, label: r.name }));

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit User' : 'Create New User'}</h2>
                    <p className="text-slate-500 text-sm">Define the user information and roles.</p>
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={onClose} className="gap-2">
                        <X size={16} /> Cancel
                    </Button>
                    <Button type="submit" disabled={mutation.isPending} className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Save size={16} /> {mutation.isPending ? 'Saving...' : 'Save User'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="p-6 space-y-4 lg:col-span-1 border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Basic Information</h3>
                    <Input
                        label="Username"
                        placeholder="e.g. john.doe"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        required
                    />
                    <Input
                        label="Email"
                        placeholder="[EMAIL_ADDRESS]"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                    />
                    <Input
                        label="First Name"
                        placeholder="John"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        required
                    />
                    <Input
                        label="Last Name"
                        placeholder="Doe"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        required
                    />
                    <Input
                        label="Password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required={!isEdit}
                    />
                </Card>

                <Card className="p-6 space-y-4 lg:col-span-2 border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Role & Permissions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Role"
                            options={[{ value: '', label: 'Select Role' }, ...roleOptions]}
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: parseInt(e.target.value) })}
                            required
                        />
                        <Input
                            label="Department"
                            placeholder="Warehouse"
                            value={formData.department}
                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            required
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                            Active User
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_approver"
                            checked={formData.is_approver}
                            onChange={(e) => setFormData({ ...formData, is_approver: e.target.checked })}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="is_approver" className="text-sm font-medium text-slate-700">
                            Is Approver
                        </label>
                    </div>
                </Card>
            </div>
        </form>
    );
};