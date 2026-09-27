import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ascendium One — Ascendium Global Holdings",
    template: "%s — Ascendium One",
  },
  description:
    "The institutional operating system of Ascendium Global Holdings. One institution. One intelligence layer. One operating system.",
  icons: [{ rel: "icon", url: "/favicon.png" }],
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a1128" },
    { media: "(prefers-color-scheme: dark)", color: "#060b1d" },
  ],
  width: "device-width",
  initialScale: 1,
};

const themeInit = `(function(){try{var t=localStorage.getItem("ao-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          Ascendium One — the institutional operating system of Ascendium Global Holdings · Founded &amp; led by
          Leon Kayanda, Founder &amp; Group CEO
        </footer>
      </body>
    </html>
  );
}
