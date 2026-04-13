import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'insta_theme';

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light');

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, theme);
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
        document.documentElement.dataset.theme = theme;
    }, [theme]);

    const value = useMemo(() => ({
        theme,
        isDark: theme === 'dark',
        toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark'),
        setTheme,
    }), [theme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}
