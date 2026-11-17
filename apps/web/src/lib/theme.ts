import { useCallback, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

function current(): Theme {
  const stored = localStorage.getItem('lumen-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('lumen-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((value) => (value === 'dark' ? 'light' : 'dark')), []);

  return { theme, setTheme, toggle };
}
