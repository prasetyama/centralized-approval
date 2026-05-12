import axios from 'axios';

/**
 * Axios instance for API calls.
 * Configured with base URL and interceptors for auth.
 */
const api = axios.create({
    baseURL: '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to add auth token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor to handle unauthorized errors
api.interceptors.response.use(
    (response: any) => response.data,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('auth_token');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        const errorData = error.response?.data;
        const errorMessage = errorData?.error || errorData?.detail || errorData?.message || error.message;
        return Promise.reject(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
    }
);

export default api;
