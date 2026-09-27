import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GoTrackMoney",
  description: "Your financial dashboard",
};

import Providers from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `
          try {
            var userId = localStorage.getItem('app_theme_active_user');
            if (localStorage.getItem('auth_token') && userId && localStorage.getItem('app_theme:' + userId) === 'dark') {
              document.documentElement.dataset.theme = 'dark';
            }
          } catch (_) {}
        ` }} />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
