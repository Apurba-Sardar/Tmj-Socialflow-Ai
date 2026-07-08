declare const process: {
  env: {
    API_PROXY_TARGET?: string;
    NEXT_PUBLIC_API_BASE_URL?: string;
    VERCEL_URL?: string;
  };
};

export const getApiBaseUrl = (): string => {
  const explicitApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  let fallbackApiBaseUrl = 'http://localhost:3000';

  if (typeof window !== 'undefined') {
    fallbackApiBaseUrl = window.location.origin;
  } else if (process.env.API_PROXY_TARGET) {
    fallbackApiBaseUrl = process.env.API_PROXY_TARGET;
  } else if (process.env.VERCEL_URL) {
    fallbackApiBaseUrl = `https://${process.env.VERCEL_URL}`;
  }

  const configuredUrl =
    explicitApiBaseUrl && explicitApiBaseUrl.length > 0 ? explicitApiBaseUrl : fallbackApiBaseUrl;

  if (typeof window === 'undefined') {
    return configuredUrl.replace(/\/$/, '');
  }

  const configured = new URL(configuredUrl);
  const isLocalApiHost = configured.hostname === 'localhost' || configured.hostname === '127.0.0.1';
  const isLanAppHost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  if (isLocalApiHost && isLanAppHost) {
    configured.hostname = window.location.hostname;
  }

  return configured.toString().replace(/\/$/, '');
};
