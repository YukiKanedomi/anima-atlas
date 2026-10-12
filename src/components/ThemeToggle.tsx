import { useState } from "react";
import { currentTheme, setTheme, type Theme } from "../lib/theme";

// 昼／夜の切替ボタン（ヘッダー右端）。太陽と月の線画、押すたびに反転。
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, set] = useState<Theme>(() => currentTheme());
  const toggle = () => {
    const t: Theme = theme === "dark" ? "light" : "dark";
    setTheme(t);
    set(t);
  };
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "昼の配色にする" : "夜の配色にする"}
      title={dark ? "昼の配色にする" : "夜の配色にする"}
      className={
        "flex h-8 w-8 items-center justify-center rounded-full text-mut transition-colors hover:bg-soft hover:text-ink " + className
      }
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
          </g>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M13.2 10.2A5.6 5.6 0 0 1 5.8 2.8a5.6 5.6 0 1 0 7.4 7.4z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
