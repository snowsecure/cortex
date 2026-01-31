import { useState, useEffect } from "react";

const STORAGE_KEY = "cortex_dark_mode";

/**
 * Hook to manage dark mode state with localStorage persistence.
 * Respects system preference on first load if no saved preference exists.
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      return saved === "true";
    }
    // Fall back to system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(STORAGE_KEY, isDark.toString());
  }, [isDark]);

  const toggle = () => setIsDark((prev) => !prev);

  return [isDark, setIsDark, toggle];
}
