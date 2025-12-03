'use client';
import React, { useEffect, useState } from 'react';
import Button from './Button';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    if (saved === 'dark' || saved === 'light') setTheme(saved as any);
    else if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
  }, []);

  function toggle() {
    const nt = theme === 'dark' ? 'light' : 'dark';
    setTheme(nt);
    document.documentElement.classList.toggle('dark', nt === 'dark');
    try { localStorage.setItem('theme', nt); } catch (e) {}
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      leftIcon={theme === 'dark' ? '🌙' : '🌞'}
    />
  );
}
