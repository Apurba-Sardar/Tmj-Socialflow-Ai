import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WordPressConnectionRecord, WordPressRawPost } from '../domain/wordpress.types.js';
import type { WordPressRepository } from '../infrastructure/wordpress.repository.js';
import type { WordPressRestClient } from '../infrastructure/wordpress-rest.client.js';
import { SocialContentGeneratorService } from './social-content-generator.service.js';
import { WordPressService } from './wordpress.service.js';

const connection: WordPressConnectionRecord = {
  id: 'wp_1',
  siteUrl: 'https://example.com',
  username: 'editor',
  applicationPassword: 'app-password',
};

const rawPost: WordPressRawPost = {
  id: 10,
  slug: 'hello-world',
  status: 'publish',
  link: 'https://example.com/hello-world',
  date_gmt: '2026-07-01T10:00:00',
  modified_gmt: '2026-07-01T11:00:00',
  author: 4,
  featured_media: 9,
  categories: [3],
  title: { rendered: '<strong>Hello world</strong>' },
  excerpt: { rendered: '<p>Short excerpt</p>' },
  content: { rendered: '<p>Full article</p>' },
};

describe('WordPressService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connects to WordPress and stores sanitized connection data', async () => {
    const repository = createRepositoryMock({
      saveConnection: vi.fn().mockResolvedValue(connection),
    });
    const client = createClientMock({
      validateConnection: vi.fn().mockResolvedValue(response({ ok: true })),
    });
    const service = new WordPressService(repository, client, new SocialContentGeneratorService());

    const result = await service.connect({
      siteUrl: 'https://example.com/',
      username: 'editor',
      applicationPassword: 'app-password',
    });

    expect(client.validateConnection).toHaveBeenCalledWith({
      siteUrl: 'https://example.com',
      username: 'editor',
      applicationPassword: 'app-password',
    });
    expect(repository.saveConnection).toHaveBeenCalledWith(
      expect.objectContaining({ siteUrl: 'https://example.com' }),
    );
    expect(result).toEqual({
      id: connection.id,
      siteUrl: connection.siteUrl,
      username: connection.username,
      connected: true,
    });
    expect(repository.logRequest).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('fetches paginated posts with author, image, category, and request logging', async () => {
    const repository = createRepositoryMock({
      findActiveConnection: vi.fn().mockResolvedValue(connection),
    });
    const client = createClientMock({
      fetchPosts: vi.fn().mockResolvedValue(
        response([rawPost], {
          'x-wp-total': '12',
          'x-wp-totalpages': '2',
        }),
      ),
      fetchAuthor: vi.fn().mockResolvedValue(
        response({
          id: 4,
          name: 'Editor',
          slug: 'editor',
          avatar_urls: { '96': 'https://example.com/avatar.png' },
        }),
      ),
      fetchFeaturedImage: vi.fn().mockResolvedValue(
        response({
          id: 9,
          source_url: 'https://example.com/image.jpg',
          alt_text: 'Image alt',
          media_type: 'image',
        }),
      ),
      fetchCategories: vi
        .fn()
        .mockResolvedValue(response([{ id: 3, name: 'News', slug: 'news', count: 5, parent: 0 }])),
    });
    const service = new WordPressService(repository, client, new SocialContentGeneratorService());

    const result = await service.getPosts({ page: 2, perPage: 6 });

    expect(client.fetchPosts).toHaveBeenCalledWith(connection, { page: 2, perPage: 6 });
    expect(result.pagination).toEqual({ page: 2, perPage: 6, total: 12, totalPages: 2 });
    expect(result.data[0]).toMatchObject({
      id: 10,
      title: 'Hello world',
      excerpt: 'Short excerpt',
      author: { name: 'Editor' },
      featuredImage: { sourceUrl: 'https://example.com/image.jpg' },
      categories: [{ name: 'News' }],
    });
    expect(repository.logRequest).toHaveBeenCalled();
  });

  it('requires a connected WordPress site before fetching posts', async () => {
    const service = new WordPressService(
      createRepositoryMock({ findActiveConnection: vi.fn().mockResolvedValue(null) }),
      createClientMock(),
      new SocialContentGeneratorService(),
    );

    await expect(service.getPosts({ page: 1, perPage: 10 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

function response<T>(data: T, headers: Record<string, string> = {}) {
  return {
    data,
    attempts: 1,
    statusCode: 200,
    headers: new Headers(headers),
  };
}

function createRepositoryMock(overrides: Partial<Record<keyof WordPressRepository, unknown>> = {}) {
  return {
    saveConnection: vi.fn(),
    findActiveConnection: vi.fn(),
    logRequest: vi.fn(),
    ...overrides,
  } as unknown as WordPressRepository;
}

function createClientMock(overrides: Partial<Record<keyof WordPressRestClient, unknown>> = {}) {
  return {
    validateConnection: vi.fn(),
    fetchPosts: vi.fn(),
    fetchPost: vi.fn(),
    fetchCategories: vi.fn(),
    fetchAuthor: vi.fn(),
    fetchFeaturedImage: vi.fn(),
    ...overrides,
  } as unknown as WordPressRestClient;
}
