'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { getApiBaseUrl } from '@/lib/env';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

// Refresh tokens are rotated on every successful refresh. Keep one request
// in flight across component remounts so React Strict Mode, tab focus, and the
// interval cannot submit the same refresh token twice.
let refreshInFlight: Promise<Response> | null = null;

export function SessionKeepAlive() {
  const pathname = usePathname();
  const sessionExpiredRef = useRef(false);

  useEffect(() => {
    const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
    if (isAuthRoute) {
      sessionExpiredRef.current = false;
      return;
    }

    const refreshSession = async () => {
      if (sessionExpiredRef.current) {
        return;
      }

      if (refreshInFlight) {
        await refreshInFlight;
        return;
      }

      refreshInFlight = fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });

      try {
        const response = await refreshInFlight;
        if (response.status === 401) {
          sessionExpiredRef.current = true;
        } else if (response.ok) {
          sessionExpiredRef.current = false;
        }
      } catch {
        // A later focus or interval refresh can recover a temporary network failure.
      } finally {
        refreshInFlight = null;
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
