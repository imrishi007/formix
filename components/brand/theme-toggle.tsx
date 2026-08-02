"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

/*
 * components/brand/theme-toggle.tsx
 * Persistent light/dark switch (design.md §Theme Toggle — v2 spec):
 *   - A single icon-only glass pill (sun ↔ moon), NOT two labeled halves and
 *     no literal "LIGHT"/"DARK" text on hover.
 *   - No native browser `title` tooltip. The only affordance is a custom
 *     small glass tooltip, delayed ~500ms, positioned below the pill — never
 *     overlapping the button itself.
 *   - Glass pill: --bg-surface-glass + blur, --radius-md, sits in the nav
 *     next to the primary CTA.
 *   - 200ms crossfade on the swap: both icons are stacked absolutely and the
 *     inactive one rotates + fades out rather than being replaced abruptly.
 *   - Respects system preference (prefers-color-scheme) on first visit via
 *     next-themes' "system" theme, then persists the explicit choice.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState(false);

  // next-themes stores the choice on <html>; until mounted we don't know
  // which theme is active, so render nothing to avoid a hydration mismatch.
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  const toggle = () => {
    // Animate the swap: add the crossfade class just long enough for the
    // 200ms background/color/border transition to complete.
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    window.setTimeout(() => root.classList.remove("theme-transitioning"), 220);

    setTheme(isDark ? "light" : "dark");
  };

  if (!mounted) {
    // Stable placeholder with the same footprint so layout never shifts.
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="glass-panel inline-flex h-10 w-10 items-center justify-center rounded-(--radius-md) text-(--ink-secondary)"
        disabled
      >
        <Sun className="h-4.5 w-4.5 opacity-0" />
      </button>
    );
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={toggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        className="glass-panel inline-flex h-10 w-10 items-center justify-center rounded-(--radius-md) text-(--ink-secondary) transition-colors duration-150 hover:text-(--ink-primary)"
      >
        {/* Both icons stacked; the active one fades/rotates in over 200ms
            (design.md Motion — no abrupt swap, no spring overshoot). */}
        <span className="relative block h-4.5 w-4.5">
          <Sun
            className={`absolute inset-0 h-4.5 w-4.5 transition-all duration-200 ease-out ${
              isDark
                ? "rotate-90 scale-50 opacity-0"
                : "rotate-0 scale-100 opacity-100"
            }`}
          />
          <Moon
            className={`absolute inset-0 h-4.5 w-4.5 transition-all duration-200 ease-out ${
              isDark
                ? "rotate-0 scale-100 opacity-100"
                : "-rotate-90 scale-50 opacity-0"
            }`}
          />
        </span>
      </button>

      {/* Custom glass tooltip — delayed ~500ms, below the pill, never
          overlapping it (design.md). Uses the same glass-panel treatment as
          the button so it reads as part of the design system. */}
      <span
        aria-hidden="true"
        className={`glass-panel pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-(--radius-sm) px-2.5 py-1 text-[11px] font-medium text-(--ink-primary) transition-all duration-150 ease-out ${
          hover
            ? "translate-y-0 opacity-100"
            : "translate-y-1 opacity-0"
        }`}
        style={{ transitionDelay: hover ? "500ms" : "0ms" }}
      >
        {isDark ? "Light theme" : "Dark theme"}
      </span>
    </span>
  );
}
