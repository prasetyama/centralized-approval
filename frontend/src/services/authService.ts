import api from './api';

export interface User {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    name: string;
    role_name: string;
    role_code: string;
    role_level: string;
    department: string;
    title: string;
    is_approver: boolean;
    is_superuser: boolean;
    is_staff: boolean;
    role: number
    image: string
}

export interface LoginResponse {
    success: boolean;
    data: {
        token: string;
        expires_in: number;
        user: User;
    };
}

const getCookieDomain = () => {
    return window.location.hostname.includes('ceresnl.com') ? '.ceresnl.com' : window.location.hostname;
};

const removeCookie = (name: string) => {
    const domain = getCookieDomain();
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;domain=" + domain + ";path=/";
};

/**
 * Auth Service.
 * Manages authentication API calls and token storage.
 * Uses cookies (sso_token) instead of localStorage.
 */
export const authService = {
    login: async (credentials: any): Promise<LoginResponse> => {
        const response: any = await api.post('/auth/login', credentials);
        // Token is managed via SSO cookie, no need to store manually
        return response;
    },

    logout: async () => {
        try {
            await api.post('/auth/logout');
        } finally {
            removeCookie('sso_token');
        }
    },

    getCurrentUser: async (): Promise<{ success: boolean; data: User }> => {
        return api.get('/auth/me') as any;
    },
};
