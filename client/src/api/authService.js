import apiClient from './apiClient';

/**
 * Authentication Service
 * Handles login, logout, registration and session verification.
 */
const authService = {
    /**
     * Authenticates user and sets HTTP-only cookie + returns token.
     */
    login: async (email, password) => {
        const formData = new URLSearchParams();
        formData.append('username', email); // Form data for OAuth2
        formData.append('password', password);
        
        const response = await apiClient.post('/api/v1/auth/login', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        return response.data;
    },

    /**
     * Registers a new user.
     */
    register: async (userData) => {
        const response = await apiClient.post('/api/v1/auth/register', userData);
        return response.data;
    },

    /**
     * Verifies current session and returns user profile.
     */
    getCurrentUser: async () => {
        const response = await apiClient.get('/api/v1/auth/me');
        return response.data;
    },

    /**
     * Clears session cookies on the backend.
     */
    logout: async () => {
        const response = await apiClient.post('/api/v1/auth/logout');
        return response.data;
    },

    /**
     * MFA Verify
     */
    verifyMfa: async (mfa_token, code) => {
        const response = await apiClient.post('/api/v1/auth/mfa/verify', { mfa_token, code });
        return response.data;
    },

    setupMfa: async () => {
        const response = await apiClient.post('/api/v1/auth/mfa/setup');
        return response.data;
    },

    forgotPassword: async (email) => {
        const response = await apiClient.post('/api/v1/auth/forgot-password', { email });
        return response.data;
    },

    resetPassword: async (email, token, new_password) => {
        const response = await apiClient.post('/api/v1/auth/reset-password', { email, token, new_password });
        return response.data;
    }
};

export default authService;
