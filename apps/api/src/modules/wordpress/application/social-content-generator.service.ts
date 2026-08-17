import { Injectable, Optional } from '@nestjs/common';
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { SocialPlatform } from '@prisma/client';
import OpenAI from 'openai';
import sharp from 'sharp';
import { createLogger } from '@socialflow/logger';

import { PromptTemplatesService } from '../../prompt-templates/prompt-templates.service.js';
import type { SocialDraftInput } from '../infrastructure/wordpress.repository.js';
import { ensureFontAvailability } from './font-bootstrap.js';

interface ArticleForGeneration {
  id: string;
  title: string;
  excerpt: string;
  contentText: string | null;
  url: string;
  featuredImageUrl: string | null;
  categoryNames: string[];
}

interface GeneratedDraft {
  platform: SocialPlatform;
  title: string;
  body: string;
  hashtags: string[];
  callToAction: string;
  imageHeadline?: string;
  imageFooter?: string;
}

@Injectable()
export class SocialContentGeneratorService {
  private readonly logger = createLogger('wordpress-ai');
  private readonly client: OpenAI | null;
  private readonly model: string;
  private readonly imageModel: string;

  constructor(@Optional() private readonly promptTemplatesService?: PromptTemplatesService) {
    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    this.model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    this.imageModel = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1-mini';
  }

  async generate(
    article: ArticleForGeneration,
    platforms: SocialPlatform[],
    repurposeJobId: string,
    userId?: string,
    options: { useFeaturedImage?: boolean } = {},
  ): Promise<SocialDraftInput[]> {
    const fallbackDrafts = this.generateFallback(article, platforms, repurposeJobId);

    if (!this.client) {
      return fallbackDrafts;
    }

    let draftsForVisuals = fallbackDrafts;

    try {
      const drafts = await this.generateWithOpenAI(article, platforms);
      const draftsByPlatform = new Map(drafts.map((draft) => [draft.platform, draft]));

      draftsForVisuals = fallbackDrafts.map((fallback) => {
        const generated = draftsByPlatform.get(fallback.platform);

        if (!generated) {
          return fallback;
        }

        return {
          ...fallback,
          title: this.truncate(
            generated.title,
            fallback.platform === SocialPlatform.PINTEREST ? 95 : 120,
          ),
          body: generated.body,
          hashtags: this.normalizeHashtags(generated.hashtags, article.categoryNames),
          callToAction: generated.callToAction,
          imageHeadline: generated.imageHeadline ?? generated.title,
          imageFooter:
            generated.imageFooter ?? 'The most meaningful support may begin in small moments.',
        };
      });
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown OpenAI generation error.' },
        'OpenAI social draft generation failed; using fallback copy',
      );
    }

    if (options.useFeaturedImage) {
      return draftsForVisuals.map((draft) => ({
        ...draft,
        // Daily automation must publish the image already attached to the
        // WordPress post. Do not call the AI image generator for this path.
        mediaUrl: article.featuredImageUrl ?? undefined,
      }));
    }

    return Promise.all(
      draftsForVisuals.map((draft) => this.withCreativeImage(article, draft, userId)),
    );
  }

  private generateFallback(
    article: ArticleForGeneration,
    platforms: SocialPlatform[],
    repurposeJobId: string,
  ): SocialDraftInput[] {
    return platforms.map((platform) => {
      const summary = this.summary(article);
      const hashtags = this.hashtags(article.categoryNames);

      return {
        articleId: article.id,
        repurposeJobId,
        platform,
        title: this.titleFor(platform, article.title),
        body: this.bodyFor(platform, article.title, summary, hashtags),
        hashtags,
        callToAction: this.callToActionFor(platform),
        imageHeadline: this.titleFor(platform, article.title),
        imageFooter: this.footerFor(platform),
        mediaUrl: this.visualFor(article, platform, hashtags),
        sourceUrl: article.url,
      };
    });
  }

  private async generateWithOpenAI(
    article: ArticleForGeneration,
    platforms: SocialPlatform[],
  ): Promise<GeneratedDraft[]> {
    const response = await this.client?.responses.create({
      model: this.model,
      input: [
        {
          role: 'developer',
          content:
            'You create premium social media drafts from WordPress articles for a social automation SaaS. Return concise, accurate, non-clickbait copy. Do not invent facts. Keep medical and mental-health content careful, non-diagnostic, and supportive.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            platforms,
            article: {
              title: article.title,
              excerpt: article.excerpt,
              content: this.truncate(article.contentText ?? article.excerpt, 6000),
              url: article.url,
              categories: article.categoryNames,
            },
            requirements: {
              pinterest: 'Save-worthy pin title and description.',
              instagram: 'Caption with a warm hook and conversational CTA.',
              facebook: 'Readable post that invites discussion.',
              linkedin: 'Professional, practical angle.',
              x: 'Short post under 260 characters before hashtags when possible.',
            },
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'social_drafts',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['drafts'],
            properties: {
              drafts: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'platform',
                    'title',
                    'body',
                    'hashtags',
                    'callToAction',
                    'imageHeadline',
                    'imageFooter',
                  ],
                  properties: {
                    platform: {
                      type: 'string',
                      enum: Object.values(SocialPlatform),
                    },
                    title: {
                      type: 'string',
                    },
                    body: {
                      type: 'string',
                    },
                    hashtags: {
                      type: 'array',
                      items: {
                        type: 'string',
                      },
                    },
                    callToAction: {
                      type: 'string',
                    },
                    imageHeadline: {
                      type: 'string',
                    },
                    imageFooter: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse(response?.output_text ?? '{"drafts":[]}') as {
      drafts?: GeneratedDraft[];
    };

    return (parsed.drafts ?? []).filter((draft) => platforms.includes(draft.platform));
  }

  private async withCreativeImage(
    article: ArticleForGeneration,
    draft: SocialDraftInput,
    userId?: string,
  ): Promise<SocialDraftInput> {
    const renderedPrompt = this.promptTemplatesService
      ? await this.promptTemplatesService.renderImagePrompt(
          {
            platform: draft.platform,
            article,
            captionTitle: draft.title,
            captionBody: draft.body,
          },
          userId,
        )
      : {
          prompt: this.fallbackImagePrompt(article, draft),
          promptVersion: 'fallback-image-v1',
          templateId: null,
        };

    try {
      const image = await this.client?.images.generate({
        model: this.imageModel,
        prompt: [
          renderedPrompt.prompt,
          'FINAL IMAGE OVERRIDE: generate artwork only. Do not render any readable text, letters, numbers, headlines, captions, logos, labels, signs, or typographic marks. SocialFlow will add the approved text after generation. Keep the top and bottom safe areas visually simple and never crop the artwork.',
        ].join('\n\n'),
        n: 1,
        size: this.openAiImageSize(draft.platform),
        quality: 'medium',
        background: 'opaque',
        output_format: 'jpeg',
      });
      const b64Json = image?.data?.[0]?.b64_json;

      if (!b64Json) {
        throw new Error('OpenAI image response did not include image data.');
      }

      return {
        ...draft,
        mediaUrl: await this.composePostImage(b64Json, draft),
        prompt: renderedPrompt.prompt,
        promptVersion: renderedPrompt.promptVersion,
      };
    } catch (error) {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : 'Unknown OpenAI image generation error.',
          platform: draft.platform,
          articleId: article.id,
        },
        'OpenAI image generation failed; using illustrated fallback visual',
      );

      return {
        ...draft,
        mediaUrl: this.visualFor(article, draft.platform, draft.hashtags),
        prompt: renderedPrompt.prompt,
        promptVersion: renderedPrompt.promptVersion,
      };
    }
  }

  private fallbackImagePrompt(article: ArticleForGeneration, draft: SocialDraftInput): string {
    return [
      `Create a polished ${draft.platform.toLowerCase()} social media image for this article.`,
      `Title: ${article.title}`,
      `Context: ${article.excerpt}`,
      'Use one clear editorial visual idea, premium composition, strong contrast, and no watermarks or platform logos.',
    ].join('\n');
  }

  private imagePromptFor(article: ArticleForGeneration, draft: SocialDraftInput): string {
    const category = article.categoryNames.slice(0, 3).join(', ') || 'social media article';
    const sourceText = this.truncate(article.contentText ?? article.excerpt, 1200);
    const topicGuidance = this.topicVisualGuidance(article);

    return [
      `Create a production-ready social media visual for ${platformTitle(draft.platform)}.`,
      `Topic: ${article.title}.`,
      `Article context: ${sourceText}`,
      `Categories: ${category}.`,
      this.platformCreativeDirection(draft.platform),
      topicGuidance,
      'The visual must be directly relevant to the article, polished enough to publish, and content-first rather than software-branded.',
      'Reserve clean negative space for the app to overlay a short headline. Avoid placing key objects under the headline area.',
      'No readable text anywhere in the generated image. Do not add words, letters, numbers, logos, watermarks, UI, captions, labels, signs, charts, posters, document text, or typographic marks.',
    ].join('\n');
  }

  private platformCreativeDirection(platform: SocialPlatform): string {
    return {
      [SocialPlatform.PINTEREST]:
        'Pinterest creative: tall vertical save-worthy educational pin, light editorial illustration, watercolor or clean vector collage, pastel palette, useful magazine/pin-board feel, one clear hero concept, airy white space, no dark backgrounds.',
      [SocialPlatform.INSTAGRAM]:
        'Instagram creative: square premium lifestyle/editorial illustration, centered subject, balanced composition, soft gradients or paper texture, visually engaging at feed size, minimal and warm, no clutter.',
      [SocialPlatform.LINKEDIN]:
        'LinkedIn creative: professional editorial research visual, clean desk or abstract science composition, muted premium palette, credible and polished, suitable for a business/health education feed, no childish cartoon styling.',
      [SocialPlatform.X]:
        'X creative: wide landscape editorial visual, simple high-contrast composition, one clear idea, readable at small preview size, minimal background detail, no infographic clutter.',
      [SocialPlatform.FACEBOOK]:
        'Facebook creative: friendly square/landscape educational visual, approachable lifestyle illustration, warm and clear, suitable for a broad audience, no clutter.',
    }[platform];
  }

  private topicVisualGuidance(article: ArticleForGeneration): string {
    const topic =
      `${article.title} ${article.excerpt} ${article.contentText ?? ''} ${article.categoryNames.join(' ')}`.toLowerCase();

    if (
      /(peptide|semaglutide|tesamorelin|aod|fat loss|weight loss|metabolism|obesity)/i.test(topic)
    ) {
      return [
        'Topic visual guidance for peptide/weight-management research:',
        'Use abstract molecular structures, amino-acid chain motifs, microscope lens, clean lab glassware without labels, blank research notebook, healthy balanced plate, leaves, soft science-and-wellness symbols.',
        'Do not show weighing scales, stomach/body silhouettes, measuring tape, before-after imagery, injections, needles, syringes, vials, pills, drug packaging, doctors treating patients, medical procedures, or dramatic clinical scenes.',
        'Do not imply treatment results or body transformation.',
      ].join(' ');
    }

    if (/(parent|child|family|dad|mom|baby|toddler|school|foster)/i.test(topic)) {
      return [
        'Topic visual guidance for family/parenting content:',
        'Use warm family-safe illustration, books, toys, home routines, parent-child activity, gentle educational scenes, playful soft colors.',
        'Avoid distressed children, unsafe situations, medical scenes, or identifiable real people.',
      ].join(' ');
    }

    return [
      'Topic visual guidance:',
      'Use symbolic editorial illustration based on the article theme, with clean objects, soft texture, and a useful educational content feel.',
      'Avoid generic stock-photo compositions and avoid unrelated decorative elements.',
    ].join(' ');
  }

  private async composePostImage(imageBase64: string, draft: SocialDraftInput): Promise<string> {
    const size = this.visualSize(draft.platform);
    const imageSource = sharp(Buffer.from(imageBase64, 'base64')).resize(size.width, size.height, {
      fit: 'contain',
      background: { r: 248, g: 244, b: 235, alpha: 1 },
    });
    const composed =
      draft.platform === SocialPlatform.INSTAGRAM
        ? await this.composeInstagramOverlay(imageSource, draft, size)
        : imageSource;

    const image = await composed.jpeg({ quality: 92, mozjpeg: true }).toBuffer();

    return `data:image/jpeg;base64,${image.toString('base64')}`;
  }

  private async composeInstagramOverlay(
    imageSource: sharp.Sharp,
    draft: SocialDraftInput,
    size: { width: number; height: number },
  ): Promise<sharp.Sharp> {
    // Ensure fonts are available for Pango text rendering (Vercel Lambda fix)
    await ensureFontAvailability();

    const rawTitle = draft.imageHeadline ?? draft.title;
    const rawFooter =
      draft.imageFooter ?? 'The most meaningful support may begin in small moments.';
    const defaultCta =
      draft.platform === SocialPlatform.FACEBOOK
        ? 'Read the full article - link in comments.'
        : 'Read the full article - link in bio.';
    const cta = this.truncate(draft.callToAction ?? defaultCta, 72);

    // Clean text for rendering
    const cleanTitle = sanitizePlainText(rawTitle);
    const cleanFooter = sanitizePlainText(rawFooter);
    const cleanCta = sanitizePlainText(cta);

    // Create header background rectangle (cream)
    const headerHeight = 290;
    const headerBg = await sharp({
      create: {
        width: size.width,
        height: headerHeight,
        channels: 4,
        background: { r: 248, g: 241, b: 223, alpha: 245 },
      },
    })
      .png()
      .toBuffer();

    // Create footer background rectangle (dark blue)
    const footerHeight = 120;
    const footerBg = await sharp({
      create: {
        width: size.width,
        height: footerHeight,
        channels: 4,
        background: { r: 18, g: 59, b: 80, alpha: 242 },
      },
    })
      .png()
      .toBuffer();

    // Render title text as image using sharp's text input
    const titlePango = `<span foreground="#123b50" font="36" weight="bold">${escapeXml(cleanTitle)}</span>`;
    let titleImg: Buffer;
    try {
      titleImg = await sharp({
        text: {
          text: titlePango,
          width: size.width - 120,
          height: 150,
          rgba: true,
        },
      })
        .png()
        .toBuffer();
    } catch {
      titleImg = Buffer.alloc(0);
    }

    // Render footer text as image
    const footerPango = `<span foreground="#4b6575" font="18">${escapeXml(cleanFooter)}</span>`;
    let footerImg: Buffer;
    try {
      footerImg = await sharp({
        text: {
          text: footerPango,
          width: size.width - 120,
          height: 80,
          rgba: true,
        },
      })
        .png()
        .toBuffer();
    } catch {
      footerImg = Buffer.alloc(0);
    }

    // Render CTA text as image
    const ctaPango = `<span foreground="#fffaf1" font="20" weight="bold">${escapeXml(cleanCta)}</span>`;
    let ctaImg: Buffer;
    try {
      ctaImg = await sharp({
        text: {
          text: ctaPango,
          width: size.width - 120,
          height: 60,
          rgba: true,
        },
      })
        .png()
        .toBuffer();
    } catch {
      ctaImg = Buffer.alloc(0);
    }

    // Build composite layers
    const composites: sharp.OverlayOptions[] = [
      { input: headerBg, top: 0, left: 0, blend: 'over' },
      { input: footerBg, top: size.height - footerHeight, left: 0, blend: 'over' },
    ];

    if (titleImg.length > 0) {
      composites.push({ input: titleImg, top: 50, left: 60, blend: 'over' });
    }

    if (footerImg.length > 0) {
      composites.push({ input: footerImg, top: 200, left: 60, blend: 'over' });
    }

    if (ctaImg.length > 0) {
      composites.push({
        input: ctaImg,
        top: size.height - footerHeight + 30,
        left: 60,
        blend: 'over',
      });
    }

    return imageSource.composite(composites);
  }

  private openAiImageSize(platform: SocialPlatform): '1024x1024' | '1536x1024' | '1024x1536' {
    if (platform === SocialPlatform.PINTEREST) {
      return '1024x1536';
    }

    if (platform === SocialPlatform.X || platform === SocialPlatform.LINKEDIN) {
      return '1536x1024';
    }

    return '1024x1024';
  }

  private titleFor(platform: SocialPlatform, title: string): string {
    const cleanTitle = this.truncate(title, platform === SocialPlatform.PINTEREST ? 95 : 120);

    return {
      [SocialPlatform.PINTEREST]: `${cleanTitle}: Save this idea`,
      [SocialPlatform.INSTAGRAM]: cleanTitle,
      [SocialPlatform.LINKEDIN]: `A practical take on ${cleanTitle}`,
      [SocialPlatform.X]: cleanTitle,
      [SocialPlatform.FACEBOOK]: cleanTitle,
    }[platform];
  }

  private footerFor(platform: SocialPlatform): string {
    return platform === SocialPlatform.PINTEREST
      ? 'A save-worthy reminder for the moments that matter most.'
      : 'The most meaningful support may begin in small moments.';
  }

  private bodyFor(
    platform: SocialPlatform,
    title: string,
    summary: string,
    hashtags: string[],
  ): string {
    const hashtagText = hashtags.join(' ');

    return {
      [SocialPlatform.PINTEREST]: `${summary}\n\nSave this for later and read the full guide when you are ready.\n\n${hashtagText}`,
      [SocialPlatform.INSTAGRAM]: `${summary}\n\nFresh idea from our latest guide: ${title}.\n\n${hashtagText}`,
      [SocialPlatform.LINKEDIN]: `${summary}\n\nThe useful takeaway: turn one strong idea into a repeatable workflow your audience can act on.\n\n${hashtagText}`,
      [SocialPlatform.X]: `${this.truncate(summary, 190)}\n\nRead more:`,
      [SocialPlatform.FACEBOOK]: `${summary}\n\nWhat would you try first?\n\n${hashtagText}`,
    }[platform];
  }

  private callToActionFor(platform: SocialPlatform): string {
    return {
      [SocialPlatform.PINTEREST]: 'Save this pin and read the full article.',
      [SocialPlatform.INSTAGRAM]: 'Comment if you want more ideas like this.',
      [SocialPlatform.LINKEDIN]: 'Read the full article and share it with your team.',
      [SocialPlatform.X]: 'Open the full post for the complete breakdown.',
      [SocialPlatform.FACEBOOK]: 'Tap through for the full story.',
    }[platform];
  }

  private summary(article: ArticleForGeneration): string {
    const source = article.excerpt.trim()
      ? article.excerpt
      : article.contentText?.trim()
        ? article.contentText
        : article.title;
    return this.truncate(source, 260);
  }

  private hashtags(categories: string[]): string[] {
    const tags = categories
      .map((category) => category.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(Boolean)
      .slice(0, 4)
      .map((category) => `#${category}`);

    return tags.length ? tags : ['#SocialMedia', '#ContentMarketing'];
  }

  private normalizeHashtags(hashtags: string[], categories: string[]): string[] {
    const normalized = hashtags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
      .map((tag) => tag.replace(/[^#a-zA-Z0-9]/g, ''))
      .filter((tag) => tag.length > 1)
      .slice(0, 6);

    return normalized.length ? normalized : this.hashtags(categories);
  }

  private visualFor(
    article: ArticleForGeneration,
    platform: SocialPlatform,
    hashtags: string[],
  ): string {
    const size = this.visualSize(platform);
    const topicSeed =
      `${article.title} ${article.excerpt} ${article.categoryNames.join(' ')} ${hashtags.join(' ')}`
        .length;
    const isPortrait = size.height > size.width;
    const palette = this.visualTheme(platform);
    const centerX = Math.round(size.width * (0.46 + (topicSeed % 7) * 0.01));
    const centerY = Math.round(size.height * (isPortrait ? 0.43 : 0.48));
    const mainRadius = isPortrait ? 210 : 170;
    const accentRadius = isPortrait ? 112 : 90;
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
  <defs>
    <linearGradient id="backdrop" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${palette.from}"/>
      <stop offset="0.55" stop-color="${palette.mid}"/>
      <stop offset="1" stop-color="${palette.to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="60%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.88"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="26" flood-color="#76685c" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#backdrop)"/>
  <circle cx="${centerX}" cy="${centerY}" r="${mainRadius + 130}" fill="url(#glow)" opacity="0.55"/>
  <ellipse cx="${centerX}" cy="${centerY + Math.round(mainRadius * 0.18)}" rx="${mainRadius * 1.24}" ry="${mainRadius * 0.78}" fill="#fffaf1" opacity="0.82" filter="url(#softShadow)"/>
  <circle cx="${centerX - Math.round(mainRadius * 0.36)}" cy="${centerY - Math.round(mainRadius * 0.18)}" r="${accentRadius}" fill="#91c7b1" opacity="0.72"/>
  <circle cx="${centerX + Math.round(mainRadius * 0.32)}" cy="${centerY - Math.round(mainRadius * 0.04)}" r="${Math.round(accentRadius * 0.88)}" fill="#f3b97c" opacity="0.74"/>
  <circle cx="${centerX + Math.round(mainRadius * 0.05)}" cy="${centerY + Math.round(mainRadius * 0.26)}" r="${Math.round(accentRadius * 0.76)}" fill="#8fb5e8" opacity="0.62"/>
  <path d="M${centerX - mainRadius} ${centerY + mainRadius * 0.42} C${centerX - mainRadius * 0.38} ${centerY + mainRadius * 0.72}, ${centerX + mainRadius * 0.42} ${centerY + mainRadius * 0.72}, ${centerX + mainRadius} ${centerY + mainRadius * 0.36}" fill="none" stroke="#7a9f8a" stroke-width="${isPortrait ? 18 : 14}" stroke-linecap="round" opacity="0.34"/>
  <path d="M${centerX - mainRadius * 0.72} ${centerY - mainRadius * 0.62} C${centerX - mainRadius * 0.1} ${centerY - mainRadius * 0.92}, ${centerX + mainRadius * 0.42} ${centerY - mainRadius * 0.86}, ${centerX + mainRadius * 0.82} ${centerY - mainRadius * 0.52}" fill="none" stroke="#c9a46f" stroke-width="${isPortrait ? 12 : 10}" stroke-linecap="round" opacity="0.32"/>
</svg>`.trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  private visualSize(platform: SocialPlatform): { width: number; height: number } {
    if (platform === SocialPlatform.PINTEREST) {
      return { width: 1000, height: 1500 };
    }

    if (platform === SocialPlatform.X || platform === SocialPlatform.LINKEDIN) {
      return { width: 1600, height: 900 };
    }

    return { width: 1200, height: 1200 };
  }

  private visualTheme(platform: SocialPlatform): { from: string; mid: string; to: string } {
    return {
      [SocialPlatform.PINTEREST]: { from: '#fff1f2', mid: '#fef3c7', to: '#dcfce7' },
      [SocialPlatform.INSTAGRAM]: { from: '#fce7f3', mid: '#ffedd5', to: '#e0f2fe' },
      [SocialPlatform.LINKEDIN]: { from: '#e0f2fe', mid: '#f8fafc', to: '#dcfce7' },
      [SocialPlatform.X]: { from: '#f8fafc', mid: '#f1f5f9', to: '#e2e8f0' },
      [SocialPlatform.FACEBOOK]: { from: '#dbeafe', mid: '#f8fafc', to: '#fef3c7' },
    }[platform];
  }

  private wrapText(value: string, maxChars: number, maxLines: number): string[] {
    const words = value.replace(/\s+/g, ' ').trim().split(' ');
    const lines: string[] = [];

    words.forEach((word) => {
      if (!lines.length) {
        lines.push(word);
        return;
      }

      const current = lines[lines.length - 1] ?? '';
      const next = current ? `${current} ${word}` : word;

      if (next.length <= maxChars || !current) {
        lines[lines.length - 1] = next;
        return;
      }

      if (lines.length < maxLines) {
        lines.push(word);
      }
    });

    if (lines.length > maxLines) {
      lines.length = maxLines;
    }

    const lastIndex = lines.length - 1;
    if (lastIndex >= 0 && words.join(' ').length > lines.join(' ').length) {
      lines[lastIndex] = `${(lines[lastIndex] ?? '').replace(/\.+$/, '')}...`;
    }

    return lines.length ? lines : ['Fresh social campaign'];
  }

  private truncate(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 1).trim()}...`;
  }
}

function platformTitle(platform: SocialPlatform): string {
  return platform
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function escapeXml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' })[character] ??
      character,
  );
}

function sanitizePlainText(value: string): string {
  if (!value) return '';
  return value
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
