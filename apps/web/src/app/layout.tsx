import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ThemeScript } from '@/components/theme/theme-script';

import './globals.css';

export const metadata: Metadata = {
  applicationName: 'TMJ SocialFlow AI',
  title: 'TMJ SocialFlow AI',
  description: 'AI-powered WordPress content repurposing and social publishing automation.',
  icons: {
    icon: '/favicon.png',
    apple: '/pwa-192x192.png',
  },
  appleWebApp: {
    capable: true,
    title: 'TMJ SocialFlow AI',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
