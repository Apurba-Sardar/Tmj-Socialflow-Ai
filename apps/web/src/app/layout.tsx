import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ThemeScript } from '@/components/theme/theme-script';

import './globals.css';

export const metadata: Metadata = {
  title: 'TMJ SocialFlow AI',
  description: 'Enterprise social workflow automation.',
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
