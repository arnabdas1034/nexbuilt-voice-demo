import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Live AI voice receptionist — NexBuilt demo",
  description:
    "Talk to an AI receptionist for a demo dental clinic and watch the appointment appear as you book it. Built by NexBuilt.",
};

export const viewport: Viewport = {
  themeColor: "#0d1011",
};

/**
 * Applies the stored theme before first paint, so a light-theme visitor never
 * sees a dark flash. Mirrors the blocking inline script on nexbuilt.in.
 */
const THEME_SCRIPT = `
try {
  var t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
