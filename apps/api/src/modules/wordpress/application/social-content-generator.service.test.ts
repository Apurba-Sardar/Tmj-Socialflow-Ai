import { SocialPlatform } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

import { SocialContentGeneratorService } from './social-content-generator.service.js';

const responseCreate = vi.fn();
const imageGenerate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: responseCreate,
      },
    },
    images: {
      generate: imageGenerate,
    },
  })),
}));

describe('SocialContentGeneratorService', () => {
  beforeEach(() => {
    responseCreate.mockReset();
    imageGenerate.mockReset();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_IMAGE_MODEL;
  });

  afterEach(() => {
    responseCreate.mockReset();
    imageGenerate.mockReset();
  });

  it('creates platform-specific fallback drafts from a WordPress article', async () => {
    const service = new SocialContentGeneratorService();

    const drafts = await service.generate(
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
      hashtags: ['#ContentMarketing', '#Pinterest'],
    });
    expect(drafts[0]?.mediaUrl).toBe('https://example.com/image.jpg');
    expect(drafts[1]?.body).toContain('The useful takeaway');
  });

  it('uses OpenAI structured output when an API key is configured', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    responseCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              drafts: [
                {
                  platform: SocialPlatform.PINTEREST,
                  title: 'Save this creator workflow',
                  body: 'A fresh Pinterest description from OpenAI.',
                  hashtags: ['#Workflow', 'Content Marketing'],
                  callToAction: 'Save this for your next planning session.',
                },
              ],
            }),
          },
        },
      ],
    });
    imageGenerate.mockResolvedValue({
      data: [
        {
          b64_json:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
        },
      ],
    });

    const service = new SocialContentGeneratorService();
    const drafts = await service.generate(
      {
        id: 'article_1',
        title: 'How to plan a productive creator workflow',
        excerpt: 'A practical guide for turning one article into a full content calendar.',
        contentText: null,
        url: 'https://example.com/workflow',
        featuredImageUrl: 'https://example.com/image.jpg',
        categoryNames: ['Content Marketing'],
      },
      [SocialPlatform.PINTEREST],
      'job_1',
    );

    expect(responseCreate).toHaveBeenCalledOnce();
    expect(imageGenerate).toHaveBeenCalledOnce();
    expect(imageGenerate.mock.calls[0]?.[0]).toMatchObject({
      model: 'gpt-image-1',
      size: '1024x1536',
      output_format: 'jpeg',
    });
    expect(drafts[0]).toMatchObject({
      title: 'Save this creator workflow',
      body: 'A fresh Pinterest description from OpenAI.',
      hashtags: ['#Workflow', '#ContentMarketing'],
      callToAction: 'Save this for your next planning session.',
    });
    expect(drafts[0]?.mediaUrl).toContain('data:image/jpeg;base64,');
  });

  it('reuses the WordPress featured image for daily automation', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    responseCreate.mockResolvedValue({
      output_text: JSON.stringify({
        drafts: [
          {
            platform: SocialPlatform.INSTAGRAM,
            title: 'A mindful daily practice',
            body: 'A practical reminder from the latest article.',
            hashtags: ['#Mindfulness'],
            callToAction: 'Read the full article.',
          },
        ],
      }),
    });

    const service = new SocialContentGeneratorService();
    const drafts = await service.generate(
      {
        id: 'article_1',
        title: 'A mindful daily practice',
        excerpt: 'A practical reminder.',
        contentText: null,
        url: 'https://example.com/mindfulness',
        featuredImageUrl: 'https://example.com/wordpress-image.jpg',
        categoryNames: ['Mindfulness'],
      },
      [SocialPlatform.INSTAGRAM],
      'job_1',
      undefined,
      { useFeaturedImage: true },
    );

    expect(drafts[0]?.mediaUrl).toBe('https://example.com/wordpress-image.jpg');
    expect(imageGenerate).not.toHaveBeenCalled();
  });

  it('renders readable Instagram text over the generated image', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    responseCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              drafts: [
                {
                  platform: SocialPlatform.INSTAGRAM,
                  title: 'How to find a calmer daily rhythm',
                  body: 'A practical reminder for busy parents.',
                  hashtags: ['#Mindfulness'],
                  callToAction: 'Read the full article.',
                  imageHeadline: 'A calmer daily rhythm',
                  imageFooter: 'Small changes can make busy days feel lighter.',
                },
              ],
            }),
          },
        },
      ],
    });
    imageGenerate.mockResolvedValue({
      data: [
        {
          b64_json:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
        },
      ],
    });

    const service = new SocialContentGeneratorService();
    const drafts = await service.generate(
      {
        id: 'article_1',
        title: 'How to find a calmer daily rhythm',
        excerpt: 'A practical reminder for busy parents.',
        contentText: null,
        url: 'https://example.com/calm',
        featuredImageUrl: null,
        categoryNames: ['Mindfulness'],
      },
      [SocialPlatform.INSTAGRAM],
      'job_1',
    );

    const mediaUrl = drafts[0]?.mediaUrl ?? '';
    expect(mediaUrl).toMatch(/^data:image\/jpeg;base64,/);
    const metadata = await sharp(Buffer.from(mediaUrl.split(',')[1] ?? '', 'base64')).metadata();
    expect(metadata).toMatchObject({ width: 1200, height: 1200, format: 'jpeg' });
    expect(imageGenerate.mock.calls[0]?.[0]?.prompt).toContain('No text, letters, numbers');
  });
});
