import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Outfit } from 'next/font/google';

import { SessionKeepAlive } from '@/components/auth/session-keep-alive';
import { ThemeScript } from '@/components/theme/theme-script';

import './globals.css';

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fontDisplay = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TMJ SocialFlow AI',
  description: 'Enterprise social workflow automation.',
  icons: {
    icon: '/favicon.png',
    apple: '/pwa-192x192.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontDisplay.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans antialiased">
        <SessionKeepAlive />
        {children}
      </body>
    </html>
  );
}
