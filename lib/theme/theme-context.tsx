'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'pdrrmo-theme';
export const THEME_COOKIE_NAME = 'pdrrmo-theme';

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

function applyThemeToDOM(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
}

function persistThemePreference(mode: ThemeMode) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch {
    // Ignore storage errors
  }

  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${THEME_COOKIE_NAME}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
    }
  } catch {
    // Ignore cookie errors
  }
}

function readThemeCookieClient(): ThemeMode | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${THEME_COOKIE_NAME}=`));
    if (!match) return null;
    const val = match.split('=')[1];
    return val === 'dark' ? 'dark' : val === 'light' ? 'light' : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({
  children,
  initialTheme = 'light',
}: {
  children: React.ReactNode;
  initialTheme?: ThemeMode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    try {
      const cookieVal = readThemeCookieClient();
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;

      // One-time migration for existing users who had dark mode in localStorage before SSR cookies
      const resolved: ThemeMode =
        cookieVal ?? (saved === 'dark' ? 'dark' : 'light');

      setThemeState(resolved);
      applyThemeToDOM(resolved);
      if (cookieVal !== resolved || saved !== resolved) {
        persistThemePreference(resolved);
      }
    } catch {
      // Fallback if localStorage/cookies are restricted
    }
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    applyThemeToDOM(mode);
    persistThemePreference(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      applyThemeToDOM(next);
      persistThemePreference(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
