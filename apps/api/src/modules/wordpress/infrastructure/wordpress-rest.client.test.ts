import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WordPressRestClient } from './wordpress-rest.client.js';

describe('WordPressRestClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('authenticates with application passwords and fetches posts', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'x-wp-total': '0', 'x-wp-totalpages': '0' },
      }),
    );
    const client = new WordPressRestClient();

    const result = await client.fetchPosts(
      {
        siteUrl: 'https://example.com',
        username: 'editor',
        applicationPassword: 'abc 123 app pass',
      },
      { page: 1, perPage: 10 },
    );

    expect(result.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/wp-json/wp/v2/posts?page=1&per_page=10&_embed=1',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('editor:abc 123 app pass').toString('base64')}`,
        }),
      }),
    );
  });

  it('retries failed transient requests', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('temporary', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
    const client = new WordPressRestClient();

    const promise = client.fetchPost(
      {
        siteUrl: 'https://example.com',
        username: 'editor',
        applicationPassword: 'password',
      },
      1,
    );

    await vi.advanceTimersByTimeAsync(150);
    const result = await promise;

    expect(result.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
