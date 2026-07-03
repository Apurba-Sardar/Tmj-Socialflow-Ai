declare const process: {
  env: {
    NEXT_PUBLIC_API_BASE_URL?: string;
  };
};

export const getApiBaseUrl = (): string => {
  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  if (typeof window === 'undefined') {
    return configuredUrl;
  }

  const configured = new URL(configuredUrl);
  const isLocalApiHost = configured.hostname === 'localhost' || configured.hostname === '127.0.0.1';
  const isLanAppHost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  if (isLocalApiHost && isLanAppHost) {
    configured.hostname = window.location.hostname;
  }

  return configured.toString().replace(/\/$/, '');
};
