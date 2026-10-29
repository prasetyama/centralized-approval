import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../services/authService';
import api from '../services/api';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: () => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getCookieDomain = () => {
    return window.location.hostname.includes('ceresnl.com') ? '.ceresnl.com' : window.location.hostname;
};

const getCookie = (name: string) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
};

const removeCookie = (name: string) => {
    const domain = getCookieDomain();
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;domain=" + domain + ";path=/";
};

export interface SSOModule {
    code: string;
    name: string;
    redirect_url: string;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const redirectToSSO = () => {
        window.location.href = `${import.meta.env.VITE_SSO_URL}/login?redirect_url=${encodeURIComponent(window.location.origin + window.location.pathname)}`;
    };

    const performLogout = () => {
        window.location.href = `${import.meta.env.VITE_SSO_URL}/logout?redirect_url=${encodeURIComponent(window.location.origin + window.location.pathname)}`;
    };

    useEffect(() => {
        const initAuth = async () => {
            // Check URL for token (redirected from SSO)
            const urlParams = new URLSearchParams(window.location.search);
            const tokenFromUrl = urlParams.get('token');

            if (tokenFromUrl) {
                // In a shared cookie setup, SSO already set the cookie.
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            const token = getCookie('sso_token');

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

                    const moduleAccess = payload.module_access || {};
                    const modules = Object.keys(moduleAccess).filter((key) => moduleAccess[key] === 'EQ');

                    // Ambil detail user dari backend (table aw_organization_structure & aw_department sesuai aw_user id)
                    let dbUser: any = null;
                    try {
                        const meRes: any = await api.get('/auth/me');
                        dbUser = meRes?.data || meRes;
                    } catch (err) {
                        console.warn('Could not fetch user details from /auth/me:', err);
                    }

                    setUser({
                        id: dbUser?.id || payload.user_id,
                        username: dbUser?.username || payload.email,
                        email: payload.email,
                        first_name: dbUser?.first_name || firstName,
                        last_name: dbUser?.last_name || lastName,
                        name: payload.name || dbUser?.first_name || '',
                        role_name: dbUser?.role_name || approvalRole || 'User',
                        role_code: dbUser?.role_code || approvalRole || 'USER',
                        role_level: payload.role,
                        department: dbUser?.department || payload.department || '',
                        department_id: dbUser?.department_id || null,
                        company: (typeof dbUser?.company === 'object' ? dbUser?.company?.name : dbUser?.company) || payload.company || '',
                        company_id: dbUser?.company_id || (typeof dbUser?.company === 'object' ? dbUser?.company?.id : null),
                        company_code: dbUser?.company_code || (typeof dbUser?.company === 'object' ? dbUser?.company?.code : ''),
                        company_details: dbUser?.company_details || (typeof dbUser?.company === 'object' ? dbUser?.company : null),
                        image: payload.image,
                        is_approver: dbUser?.is_approver ?? isApprover,
                        is_superuser: dbUser?.is_superuser || false,
                        is_staff: dbUser?.is_staff || false,
                        title: payload.title,
                        role: dbUser?.role || 1,
                        is_active: true,
                        modules: modules
                    } as any);
                    setIsAuthenticated(true);
                } catch (error) {
                    console.error('SSO Error:', error);
                    removeCookie('sso_token');
                    redirectToSSO();
                }
            } else {
                redirectToSSO();
            }
            setLoading(false);
        };

        initAuth();
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

    // Poll cookie for global logout (cross-domain SSO logout detection)
    useEffect(() => {
        if (!isAuthenticated) return;
        const interval = setInterval(() => {
            const token = getCookie('sso_token');
            if (!token) {
                setIsAuthenticated(false);
                setUser(null);
                window.location.href = `${import.meta.env.VITE_SSO_URL}/login?redirect_url=${encodeURIComponent(window.location.origin + window.location.pathname)}`;
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [isAuthenticated]);

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
