export interface WordPressConnectionConfig {
  id?: string;
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface WordPressConnectionRecord {
  id: string;
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface WordPressAuthor {
  id: number;
  name: string;
  slug: string;
  url?: string;
  avatarUrl?: string;
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent?: number;
}

export interface WordPressFeaturedImage {
  id: number;
  sourceUrl: string;
  altText: string;
  mediaType: string;
  mimeType?: string;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
}

export interface WordPressPost {
  id: number;
  slug: string;
  status: string;
  link: string;
  title: string;
  excerpt: string;
  content?: string;
  publishedAt: string;
  modifiedAt: string;
  author?: WordPressAuthor;
  featuredImage?: WordPressFeaturedImage;
  categories: WordPressCategory[];
  tags: WordPressCategory[];
  metadata?: Record<string, unknown>;
}

export interface PaginatedWordPressPosts {
  data: WordPressPost[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface WordPressRequestLogInput {
  method: string;
  url: string;
  statusCode?: number;
  attempts: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface WordPressRawAuthor {
  id: number;
  name: string;
  slug: string;
  url?: string;
  avatar_urls?: Record<string, string>;
}

export interface WordPressRawCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

export interface WordPressRawMedia {
  id: number;
  source_url: string;
  alt_text: string;
  media_type: string;
  mime_type?: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, unknown>;
  };
}

export interface WordPressRawPost {
  id: number;
  slug: string;
  status: string;
  link: string;
  date_gmt: string;
  modified_gmt: string;
  author: number;
  featured_media?: number;
  categories?: number[];
  tags?: number[];
  meta?: Record<string, unknown>;
  social_zap4?: Record<string, unknown>;
  title: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  content?: {
    rendered: string;
  };
  _embedded?: {
    author?: WordPressRawAuthor[];
    'wp:featuredmedia'?: WordPressRawMedia[];
    'wp:term'?: WordPressRawCategory[][];
  };
}

export interface WordPressHttpResponse<T> {
  data: T;
  headers: Headers;
  attempts: number;
  statusCode: number;
}

export interface WordPressArticleLibraryItem {
  id: string;
  wordpressId: number;
  title: string;
  excerpt: string;
  url: string;
  authorName?: string | null;
  featuredImageUrl?: string | null;
  categoryNames: string[];
  categorySlugs: string[];
  tagNames: string[];
  tagSlugs: string[];
  campaignStatus: string;
  publishedAt?: Date | null;
  modifiedAt?: Date | null;
  repurposedAt?: Date | null;
}

export interface WordPressSyncResult {
  syncRunId: string;
  status: 'COMPLETED' | 'FAILED';
  scannedPosts: number;
  upsertedPosts: number;
  failedPosts: number;
  totalPages: number;
}
