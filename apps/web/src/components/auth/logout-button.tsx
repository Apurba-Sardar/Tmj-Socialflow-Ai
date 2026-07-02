'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth-constants';
import { getApiBaseUrl } from '@/lib/env';

export function LogoutButton() {
  const router = useRouter();

  async function logout(): Promise<void> {
    try {
      await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // The development fallback session is local to the browser.
    }

    document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    router.replace('/login');
    router.refresh();
  }

  return (
    <Button
      className="whitespace-nowrap"
      variant="outline"
      onClick={() => {
        void logout();
      }}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
