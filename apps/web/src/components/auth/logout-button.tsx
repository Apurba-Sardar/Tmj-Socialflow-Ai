'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getApiBaseUrl } from '@/lib/env';

export function LogoutButton() {
  const router = useRouter();

  async function logout(): Promise<void> {
    await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    router.replace('/login');
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      onClick={() => {
        void logout();
      }}
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
