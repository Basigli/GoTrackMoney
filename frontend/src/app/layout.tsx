import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

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
    <html lang="en" suppressHydrationWarning>
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
