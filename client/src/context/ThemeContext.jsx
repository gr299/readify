import { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'readify_theme';

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

const ThemeContext = createContext({ theme: 'light', setTheme: () => {}, toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-smooth');
    window.setTimeout(() => document.documentElement.classList.remove('theme-smooth'), 400);
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
