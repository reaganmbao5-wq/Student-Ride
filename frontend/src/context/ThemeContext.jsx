import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ACCENT_COLORS = {
  default: { label: 'Default', hex: '#808080', tailwind: 'bg-zinc-500' },
  blue: { label: 'Blue', hex: '#3B82F6', tailwind: 'bg-blue-500' },
  green: { label: 'Green', hex: '#22C55E', tailwind: 'bg-green-500' },
  yellow: { label: 'Yellow', hex: '#EAB308', tailwind: 'bg-yellow-500' },
  pink: { label: 'Pink', hex: '#EC4899', tailwind: 'bg-pink-500' },
  orange: { label: 'Orange', hex: '#F97316', tailwind: 'bg-orange-500' },
  purple: { label: 'Purple', hex: '#A855F7', tailwind: 'bg-purple-500' },
  black: { label: 'Black', hex: '#000000', tailwind: 'bg-black dark:bg-white' },
};

export const ThemeProvider = ({ children }) => {
  // themeMode: 'system' | 'light' | 'dark'
  const [themeMode, setThemeModeState] = useState(() => {
    return localStorage.getItem('mulu_theme_mode') || 'system';
  });

  // Effective theme: 'dark' | 'light'
  const [theme, setTheme] = useState('dark');

  // Accent Color: 'default' | 'blue' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple' | 'black'
  const [accentColor, setAccentColorState] = useState(() => {
    return localStorage.getItem('mulu_accent_color') || 'default';
  });

  // Calculate effective theme based on themeMode
  useEffect(() => {
    const getSystemTheme = () => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    const updateEffectiveTheme = () => {
      const effective = themeMode === 'system' ? getSystemTheme() : themeMode;
      setTheme(effective);

      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(effective);
    };

    updateEffectiveTheme();
    localStorage.setItem('mulu_theme_mode', themeMode);

    // Listen to system theme changes when in 'system' mode
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateEffectiveTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  // Apply accent color CSS custom variable
  useEffect(() => {
    localStorage.setItem('mulu_accent_color', accentColor);
    const root = window.document.documentElement;
    const colorObj = ACCENT_COLORS[accentColor] || ACCENT_COLORS.default;

    let hexColor = colorObj.hex;
    if (accentColor === 'black') {
      hexColor = theme === 'dark' ? '#FFFFFF' : '#000000';
    } else if (accentColor === 'default') {
      hexColor = '#EAB308'; // Default gold accent
    }

    root.style.setProperty('--color-accent', hexColor);
    root.style.setProperty('--color-gold', hexColor);
  }, [accentColor, theme]);

  const setThemeMode = (mode) => {
    setThemeModeState(mode);
  };

  const setAccentColor = (color) => {
    setAccentColorState(color);
  };

  const toggleTheme = () => {
    setThemeModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        setThemeMode,
        accentColor,
        setAccentColor,
        toggleTheme,
        ACCENT_COLORS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
