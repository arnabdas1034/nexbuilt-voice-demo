"use client";

import { useEffect, useState } from "react";

/**
 * Same shell as nexbuilt.in: sticky, blurred, wordmark left, and a theme
 * toggle that only appears once JavaScript has run.
 */
export default function Header() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    setTheme(stored === "light" ? "light" : "dark");
    setReady(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // A blocked storage API should not break the toggle.
    }
  }

  return (
    <header className="brand-header brand-hairline">
      <div className="mx-auto flex min-h-[78px] w-full max-w-6xl items-center justify-between gap-4 px-5 md:min-h-[100px] md:px-8">
        <a href="https://nexbuilt.in" className="flex items-center gap-2.5 text-ink">
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0">
            <path
              d="M3 20V4l13 16V4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M17.5 5.5 21 9l-3.5 3.5" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="wordmark text-[19px] md:text-[22px]">NexBuilt</span>
        </a>

        <div className="flex items-center gap-2 md:gap-4">
          <a
            href="https://nexbuilt.in"
            className="hidden text-[15px] text-muted underline decoration-current underline-offset-4 hover:text-ink sm:inline"
          >
            Back to NexBuilt
          </a>
          <button
            type="button"
            onClick={toggle}
            hidden={!ready}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="rounded-pill border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </header>
  );
}
