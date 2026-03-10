import React, { createContext, useState, useEffect, useContext } from 'react';

const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/v1/auth`
    : "/api/v1/auth";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem('access_token');
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setUser(data);
                } else {
                    localStorage.removeItem('access_token');
                }
            } catch (err) {
                localStorage.removeItem('access_token');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, []);

    const login = async (email, password) => {
        const formData = new URLSearchParams();
        formData.append('username', email); // OAuth2
        formData.append('password', password);

        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Login failed");
        }

        const data = await response.json();
        if (data.access_token) {
            localStorage.setItem('access_token', data.access_token);
            // Fetch user info
            const userRes = await fetch(`${API_BASE}/me`, {
                headers: { 'Authorization': `Bearer ${data.access_token}` }
            });
            if (userRes.ok) {
                const userData = await userRes.json();
                setUser(userData);
                return userData;
            }
        }
        throw new Error("Login completed but failed to retrieve user data.");
    };

    const register = async (userData) => {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Registration failed");
        }
        return await response.json();
    };

    const logout = async () => {
        try {
            await fetch(`${API_BASE}/logout`, { method: 'POST' });
        } catch (e) {
            // Ignore error on logout
        }
        localStorage.removeItem('access_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, register, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
