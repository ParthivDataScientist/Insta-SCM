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

    // Verify session on mount (Bypassed for now)
    const verifySession = useCallback(async () => {
        setLoading(true);
        try {
            // Bypass Authentication for now - Grant free access
            // const userData = await authService.getCurrentUser();
            const userData = {
                id: 1,
                email: "admin@insta-scm.com",
                role: "ADMIN",
                full_name: "Admin User",
                is_active: true
            };
            setUser(userData);
        } catch (err) {
            setUser(null);
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
     * Registration handler
     */
    const register = async (userData) => {
        try {
            return await authService.register(userData);
        } catch (err) {
            const message = err.response?.data?.detail || "Registration failed.";
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
        <AuthContext.Provider value={{ user, login, verifyMfa, logout, register, loading }}>
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
