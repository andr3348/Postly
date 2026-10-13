import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/shared/context/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Postly — Social Media Orchestration",
  description: "AI-Powered Omnichannel Social Media Orchestration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[#e9edf2] dark:bg-[#151922] transition-colors duration-200">
        {/* Aplica .dark antes de hidratar: evita el destello claro en
            usuarios con tema oscuro. Solo toca la clase de <html> (ya con
            suppressHydrationWarning), nunca el árbol React. */}
        <Script
          id="postly-theme"
          strategy="beforeInteractive"
        >{`(function(){try{var s=localStorage.getItem("postly-theme"),d=s==="dark"||(s!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})();`}</Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
