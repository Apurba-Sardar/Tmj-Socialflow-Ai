import { cookies } from 'next/headers';

import { ACCESS_TOKEN_COOKIE, DEV_OFFLINE_ACCESS_TOKEN } from './auth-constants';
import { getApiBaseUrl } from './env';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  emailVerified: boolean;
}

export const getCurrentUser = async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return null;
  }

  if (process.env.NODE_ENV === 'development' && accessToken === DEV_OFFLINE_ACCESS_TOKEN) {
    return {
      id: 'dev-offline-user',
      email: 'demo@socialflow.local',
      role: 'ADMIN',
      emailVerified: true,
    };
  }

  const response = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
    headers: {
      Cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { user: AuthenticatedUser };
  return payload.user;
};
