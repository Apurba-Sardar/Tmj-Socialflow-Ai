import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type {
  WordPressConnectionConfig,
  WordPressHttpResponse,
  WordPressRawAuthor,
  WordPressRawCategory,
  WordPressRawMedia,
  WordPressRawPost,
} from '../domain/wordpress.types.js';

type HttpMethod = 'GET' | 'POST';

@Injectable()
export class WordPressRestClient {
  private readonly maxAttempts = 3;

  async fetchPosts(
    connection: WordPressConnectionConfig,
    params: { page: number; perPage: number },
  ): Promise<WordPressHttpResponse<WordPressRawPost[]>> {
    return this.request<WordPressRawPost[]>(connection, 'GET', '/wp-json/wp/v2/posts', {
      page: String(params.page),
      per_page: String(params.perPage),
      _embed: '1',
    });
  }

  async fetchPost(
    connection: WordPressConnectionConfig,
    id: number,
  ): Promise<WordPressHttpResponse<WordPressRawPost>> {
    return this.request<WordPressRawPost>(connection, 'GET', `/wp-json/wp/v2/posts/${String(id)}`, {
      _embed: '1',
    });
  }

  async fetchCategories(
    connection: WordPressConnectionConfig,
    ids?: number[],
  ): Promise<WordPressHttpResponse<WordPressRawCategory[]>> {
    return this.request<WordPressRawCategory[]>(connection, 'GET', '/wp-json/wp/v2/categories', {
      per_page: '100',
      ...(ids?.length ? { include: ids.join(',') } : {}),
    });
  }

  async fetchAuthor(
    connection: WordPressConnectionConfig,
    id: number,
  ): Promise<WordPressHttpResponse<WordPressRawAuthor>> {
    return this.request<WordPressRawAuthor>(
      connection,
      'GET',
      `/wp-json/wp/v2/users/${String(id)}`,
    );
  }

  async fetchFeaturedImage(
    connection: WordPressConnectionConfig,
    id: number,
  ): Promise<WordPressHttpResponse<WordPressRawMedia>> {
    return this.request<WordPressRawMedia>(connection, 'GET', `/wp-json/wp/v2/media/${String(id)}`);
  }

  async validateConnection(
    connection: WordPressConnectionConfig,
  ): Promise<WordPressHttpResponse<unknown>> {
    return this.request<unknown>(connection, 'GET', '/wp-json/wp/v2/users/me');
  }

  private async request<T>(
    connection: WordPressConnectionConfig,
    method: HttpMethod,
    path: string,
    query: Record<string, string> = {},
  ): Promise<WordPressHttpResponse<T>> {
    const url = this.buildUrl(connection.siteUrl, path, query);
    const startedAt = Date.now();
    let lastError: unknown;
    let statusCode = 0;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            Accept: 'application/json',
            Authorization: this.authorizationHeader(connection),
          },
        });
        statusCode = response.status;

        if (!response.ok) {
          const text = await response.text();
          lastError = new Error(
            `WordPress request failed with ${String(response.status)} ${response.statusText}: ${text.slice(0, 500)}`,
          );

          if (!this.shouldRetry(response.status) || attempt === this.maxAttempts) {
            break;
          }

          await this.wait(attempt);
          continue;
        }

        return {
          data: (await response.json()) as T,
          headers: response.headers,
          attempts: attempt,
          statusCode,
        };
      } catch (error) {
        lastError = error;

        if (attempt === this.maxAttempts) {
          break;
        }

        await this.wait(attempt);
      }
    }

    const durationMs = Date.now() - startedAt;
    throw new ServiceUnavailableException({
      message: 'WordPress REST API request failed.',
      statusCode,
      durationMs,
      error: lastError instanceof Error ? lastError.message : 'Unknown WordPress request failure.',
    });
  }

  private authorizationHeader(connection: WordPressConnectionConfig): string {
    const token = Buffer.from(`${connection.username}:${connection.applicationPassword}`).toString(
      'base64',
    );
    return `Basic ${token}`;
  }

  private buildUrl(siteUrl: string, path: string, query: Record<string, string>): string {
    const url = new URL(path, this.normalizeSiteUrl(siteUrl));
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  }

  private normalizeSiteUrl(siteUrl: string): string {
    return siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  }

  private shouldRetry(statusCode: number): boolean {
    return statusCode === 408 || statusCode === 429 || statusCode >= 500;
  }

  private async wait(attempt: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, attempt * 150);
    });
  }
}
