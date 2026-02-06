import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'app_theme';

export const getTheme = (): Theme => {
    return (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
};

export const useTheme = () => {
    const [theme, setThemeState] = useState<Theme>(getTheme());

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
    }, []);

    return { theme, toggleTheme };
};
