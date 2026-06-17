import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../services/authService';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: () => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const redirectToSSO = () => {
        window.location.href = `${import.meta.env.VITE_SSO_URL}/login?redirect_url=${encodeURIComponent(window.location.origin + window.location.pathname)}`;
    };

    const performLogout = () => {
        localStorage.removeItem('auth_token');
        window.location.href = `${import.meta.env.VITE_SSO_URL}/logout?redirect_url=${encodeURIComponent(window.location.origin + window.location.pathname)}`;
    };

    useEffect(() => {
        // Check URL for token (redirected from SSO)
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');

        if (tokenFromUrl) {
            localStorage.setItem('auth_token', tokenFromUrl);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const token = localStorage.getItem('auth_token');

        if (token) {
            try {
                // Decode JWT payload (base64)
                const payloadBase64 = token.split('.')[1];
                const payload = JSON.parse(atob(payloadBase64));

                // Check expiration
                const currentTime = Math.floor(Date.now() / 1000);
                if (payload.exp && payload.exp < currentTime) {
                    throw new Error('Token expired');
                }

                // Check approval module access
                if (!payload.module_access || (!payload.module_access['approval'] && !payload.module_access['APPROVAL'])) {
                    throw new Error('Unauthorized: no approval module access');
                }

                // Extract user info
                const nameParts = (payload.name || '').split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                const approvalRole = payload.module_roles?.['APPROVAL'] || payload.module_roles?.['approval'];
                const isApprover = !!approvalRole && approvalRole.toLowerCase() !== 'viewer';

                setUser({
                    id: payload.user_id,
                    username: payload.email,
                    email: payload.email,
                    first_name: firstName,
                    last_name: lastName,
                    name: payload.name,
                    role_name: approvalRole || 'User',
                    role_code: approvalRole || 'USER',
                    role_level: payload.role,
                    department: payload.department,
                    image: payload.image,
                    is_approver: isApprover,
                    is_superuser: false,
                    is_staff: false,
                    title: payload.title,
                    role: 1,
                    is_active: true
                } as any);
                setIsAuthenticated(true);
            } catch (error) {
                console.error('SSO Error:', error);
                localStorage.removeItem('auth_token');
                redirectToSSO();
            }
        } else {
            redirectToSSO();
        }
        setLoading(false);
    }, []);

    // Listen for logout from other tabs via BroadcastChannel (same-origin)
    useEffect(() => {
        const logoutChannel = new BroadcastChannel('logout_channel_approval');

        logoutChannel.onmessage = (event) => {
            if (event.data === 'logout') {
                performLogout();
            }
        };

        return () => logoutChannel.close();
    }, []);

    // Fallback: listen for localStorage changes from other tabs
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'auth_token' && event.newValue === null) {
                performLogout();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const login = () => {
        redirectToSSO();
    };

    const logout = () => {
        const logoutChannel = new BroadcastChannel('logout_channel_approval');
        logoutChannel.postMessage('logout');
        logoutChannel.close();

        performLogout();
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                logout,
                isAuthenticated,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
