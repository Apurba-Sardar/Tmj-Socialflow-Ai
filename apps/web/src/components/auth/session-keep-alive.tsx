'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { getApiBaseUrl } from '@/lib/env';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function SessionKeepAlive() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/login') {
      return;
    }

    const refreshSession = async () => {
      try {
        await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        });
      } catch {
        // A later focus or interval refresh can recover a temporary network failure.
      }
    };

    void refreshSession();
    const intervalId = window.setInterval(() => {
      void refreshSession();
    }, REFRESH_INTERVAL_MS);
    const handleFocus = () => {
      void refreshSession();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [pathname]);

  return null;
}
