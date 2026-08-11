import { NextResponse } from 'next/server';

const productionApiTarget = 'https://socialflowapi-production.up.railway.app';

const apiBaseUrl = () => {
  const configured = (process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  const fallback =
    process.env.NODE_ENV === 'production' ? productionApiTarget : 'http://localhost:4000';

  try {
    const target = new URL(configured || fallback);
    if (!['http:', 'https:'].includes(target.protocol) || !target.hostname) {
      throw new Error('Invalid API proxy protocol.');
    }
    target.pathname = target.pathname.replace(/\/api\/?$/, '');
    target.search = '';
    target.hash = '';
    return target.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
};

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

async function proxyAuth(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const upstreamUrl = `${apiBaseUrl()}/api/auth/${path.join('/')}`;
  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  const contentType = request.headers.get('content-type');

  if (cookie) {
    headers.set('cookie', cookie);
  }
  if (contentType) {
    headers.set('content-type', contentType);
  }

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.arrayBuffer(),
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  const responseContentType = upstream.headers.get('content-type');
  if (responseContentType) {
    responseHeaders.set('content-type', responseContentType);
  }

  const setCookies = upstream.headers.getSetCookie();
  for (const setCookie of setCookies) {
    responseHeaders.append('set-cookie', setCookie);
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxyAuth;
export const POST = proxyAuth;
export const PATCH = proxyAuth;
export const PUT = proxyAuth;
export const DELETE = proxyAuth;
