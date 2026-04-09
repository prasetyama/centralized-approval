import api from './api';

export interface User {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role_name: string;
    role_code: string;
    department: string;
    is_approver: boolean;
    is_superuser: boolean;
    is_staff: boolean;
    role: number
}

export interface LoginResponse {
    success: boolean;
    data: {
        token: string;
        expires_in: number;
        user: User;
    };
}

/**
 * Auth Service.
 * Manages authentication API calls and token storage.
 */
export const authService = {
    login: async (credentials: any): Promise<LoginResponse> => {
        const response: any = await api.post('/auth/login', credentials);
        if (response.success) {
            localStorage.setItem('auth_token', response.data.token);
        }
        return response;
    },

    logout: async () => {
        try {
            await api.post('/auth/logout');
        } finally {
            localStorage.removeItem('auth_token');
        }
    },

    getCurrentUser: async (): Promise<{ success: boolean; data: User }> => {
        return api.get('/auth/me') as any;
    },
};
