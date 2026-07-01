import type { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: Role;
  emailVerified: boolean;
}
