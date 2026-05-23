import { useEffect, useState } from 'react';

export type ThemeState = 'light' | 'dark';

export function useTheme() {
  const [themeState, setThemeState] = useState<ThemeState>(() => {
    return (localStorage.getItem('safisa-theme') as ThemeState) || 'dark';
  });

  useEffect(() => {
    if (themeState === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
    localStorage.setItem('safisa-theme', themeState);
  }, [themeState]);

  const toggleTheme = () => {
    setThemeState(currentTheme => currentTheme === 'light' ? 'dark' : 'light');
  };

  return {
    themeState,
    setThemeState,
    toggleTheme
  };
}
