import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GitBranch, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card';
import { useAuth } from '@/context/AuthContext';

export const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login({ username, password });
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err?.message || 'Invalid username or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                        <GitBranch size={28} />
                    </div>
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
                        Welcome Back
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Sign in to your centralized approval dashboard
                    </p>
                </div>

                <Card className="shadow-xl shadow-slate-200/50 border-slate-100">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-xl">Login</CardTitle>
                        <CardDescription>
                            Enter your credentials to access your account
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-600 border border-red-100 animate-in fade-in zoom-in duration-200">
                                    <AlertCircle size={18} />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-9 text-slate-400" size={18} />
                                    <Input
                                        label="Username"
                                        placeholder="e.g. john.staff"
                                        className="pl-10"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="relative">
                                    <Lock className="absolute left-3 top-9 text-slate-400" size={18} />
                                    <Input
                                        label="Password"
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-10"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                loading={loading}
                            >
                                Sign In
                            </Button>
                        </form>

                        <div className="mt-6 text-center text-xs text-slate-400">
                            <p>Demo accounts: john.staff, jane.spv, bob.mgr</p>
                            <p className="mt-1">Default password: password123</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
