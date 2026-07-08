declare const process: {
  env: {
    NEXT_PUBLIC_API_BASE_URL?: string;
    VERCEL_URL?: string;
  };
};

export const getApiBaseUrl = (): string => {
  const explicitApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const fallbackApiBaseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';
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
