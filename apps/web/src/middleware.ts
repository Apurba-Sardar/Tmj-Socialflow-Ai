import { NextResponse, type NextRequest } from 'next/server';

import { ACCESS_TOKEN_COOKIE } from '@/lib/auth-constants';

const protectedPrefixes = [
  '/dashboard',
  '/media-library',
  '/scheduler',
  '/wordpress-hub',
  '/campaigns',
  '/ai-pipeline',
  '/admin',
];

export function middleware(request: NextRequest) {
  const hasAccessToken = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
  const pathname = request.nextUrl.pathname;

  if (protectedPrefixes.some((prefix) => pathname.startsWith(prefix)) && !hasAccessToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/media-library/:path*',
    '/scheduler/:path*',
    '/wordpress-hub/:path*',
    '/campaigns/:path*',
    '/ai-pipeline/:path*',
    '/admin/:path*',
  ],
};
