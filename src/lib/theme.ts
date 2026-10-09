import { useCallback, useEffect, useState } from "react";

const KEY = "oli-theme";

export type Theme = "light" | "dark";

let current: Theme =
  typeof window !== "undefined" && window.localStorage.getItem(KEY) === "dark"
    ? "dark"
    : "light";

const listeners = new Set<() => void>();

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  window.localStorage.setItem(KEY, theme);
}

function setTheme(theme: Theme) {
  current = theme;
  apply(theme);
  listeners.forEach((l) => l());
}

/** Applied before first paint so a dark-mode reload never flashes white. */
export function bootTheme() {
  apply(current);
}

/**
 * Light/dark toggle shared across every component that renders it — one
 * module-level store, so the top bar and the toaster never disagree.
 */
export function useTheme() {
  const [, force] = useState(0);

  useEffect(() => {
    // Re-apply on mount so the persisted choice lands on first paint.
    apply(current);
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const toggle = useCallback(
    () => setTheme(current === "dark" ? "light" : "dark"),
    [],
  );

  return { theme: current, toggle, isDark: current === "dark" };
}
