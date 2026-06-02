import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import authService from '../api/authService';

const AuthContext = createContext(null);

/**
 * AuthProvider Component
 * Manages global authentication state using secure HTTP-only cookies.
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Verify session on mount
    const verifySession = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('access_token');
            if (token) {
                const userData = await authService.getCurrentUser();
                setUser(userData);
            } else {
                setUser(null);
            }
        } catch (err) {
            setUser(null);
            localStorage.removeItem('access_token');
            localStorage.removeItem('access_token');
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
        try {
            const data = await authService.login(email, password);
            if (data.requires_mfa) {
                return { requiresMfa: true, mfaToken: data.mfa_token };
            }

            if (data.access_token) {
                localStorage.setItem('access_token', data.access_token);
            }

            const userData = await authService.getCurrentUser();
            setUser(userData);
            return { success: true, user: userData };
        } catch (err) {
            const message = err.response?.data?.detail || "Login failed. Please check your credentials.";
            throw new Error(message);
        }
    };

    /**
     * MFA Verification Handler
     */
    const verifyMfa = async (mfaToken, code) => {
        try {
            const data = await authService.verifyMfa(mfaToken, code);
            if (data.access_token) {
                localStorage.setItem('access_token', data.access_token);
            }
            const userData = await authService.getCurrentUser();
            setUser(userData);
            return { success: true, user: userData };
        } catch (err) {
            const message = err.response?.data?.detail || "Invalid MFA code.";
            throw new Error(message);
        }
    };

    /**
     * Logout handler
     */
    const logout = async () => {
        try {
            await authService.logout();
        } catch (e) {
            console.error("Logout API error:", e);
        } finally {
            localStorage.removeItem('access_token');
            setUser(null);
        }
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
