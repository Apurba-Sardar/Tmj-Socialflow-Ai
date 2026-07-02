import { SocialPlatform } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { SocialContentGeneratorService } from './social-content-generator.service.js';

describe('SocialContentGeneratorService', () => {
  it('creates platform-specific drafts from a WordPress article', () => {
    const service = new SocialContentGeneratorService();

    const drafts = service.generate(
      {
        id: 'article_1',
        title: 'How to plan a productive creator workflow',
        excerpt: 'A practical guide for turning one article into a full content calendar.',
        contentText: null,
        url: 'https://example.com/workflow',
        featuredImageUrl: 'https://example.com/image.jpg',
        categoryNames: ['Content Marketing', 'Pinterest'],
      },
      [SocialPlatform.PINTEREST, SocialPlatform.LINKEDIN],
      'job_1',
    );

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      articleId: 'article_1',
      repurposeJobId: 'job_1',
      platform: SocialPlatform.PINTEREST,
      mediaUrl: 'https://example.com/image.jpg',
      hashtags: ['#ContentMarketing', '#Pinterest'],
    });
    expect(drafts[1]?.body).toContain('The useful takeaway');
  });
});
