import { cookies } from 'next/headers';

import { ACCESS_TOKEN_COOKIE } from './auth-constants';
import { getApiBaseUrl } from './env';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role:
    | 'USER'
    | 'ADMIN'
    | 'SUPER_ADMIN'
    | 'MANAGER'
    | 'CONTENT_WRITER'
    | 'DESIGNER'
    | 'REVIEWER'
    | 'PUBLISHER'
    | 'VIEWER';
  emailVerified: boolean;
}

export const getCurrentUser = async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return null;
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

  try {
    const payload = (await response.json()) as { user?: AuthenticatedUser };
    return payload.user ?? null;
  } catch {
    return null;
  }
};
