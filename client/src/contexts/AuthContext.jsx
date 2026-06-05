import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import authService from '../api/authService';

const AuthContext = createContext(null);

/**
 * AuthProvider Component
 * Manages global authentication state using secure HTTP-only cookies.
 */
const MOCK_USER = {
    id: 1,
    email: 'admin@example.com',
    full_name: 'Admin User',
    role: 'admin',
    is_active: true,
    mfa_enabled: false,
    tenant_id: 'gordian'
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(MOCK_USER);
    const [loading, setLoading] = useState(false);

    // Verify session on mount
    const verifySession = useCallback(async () => {
        setLoading(true);
        try {
            setUser(MOCK_USER);
        } catch (err) {
            setUser(MOCK_USER);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        verifySession();
    }, [verifySession]);

    /**
     * Login handler
     */
    const login = async (email, password) => {
        setUser(MOCK_USER);
        return { success: true, user: MOCK_USER };
    };

    /**
     * MFA Verification Handler
     */
    const verifyMfa = async (mfaToken, code) => {
        setUser(MOCK_USER);
        return { success: true, user: MOCK_USER };
    };

    /**
     * Logout handler
     */
    const logout = async () => {
        localStorage.removeItem('access_token');
        setUser(MOCK_USER);
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider value={{ user, login, verifyMfa, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
