declare const process: {
  env: {
    NEXT_PUBLIC_API_BASE_URL?: string;
  };
};

export const getApiBaseUrl = (): string =>
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
