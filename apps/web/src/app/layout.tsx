import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SessionKeepAlive } from '@/components/auth/session-keep-alive';
import { ThemeScript } from '@/components/theme/theme-script';

import './globals.css';

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <SessionKeepAlive />
        {children}
      </body>
    </html>
  );
}
