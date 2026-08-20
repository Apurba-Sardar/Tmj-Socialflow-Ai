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
    this.model = 'gpt-4o-mini';
    const configuredImageModel = process.env.OPENAI_IMAGE_MODEL?.trim().toLowerCase();
    this.imageModel =
      configuredImageModel && !configuredImageModel.startsWith('dall-e-')
        ? configuredImageModel
        : 'gpt-image-1';
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
      return fallbackDrafts.map((draft) => ({
        ...draft,
        mediaUrl: article.featuredImageUrl ?? draft.mediaUrl,
      }));
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
    if (!this.client) {
      return [];
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You create premium social media drafts from WordPress articles for a social automation SaaS. Return concise, accurate, non-clickbait copy. Do not invent facts. Keep medical and mental-health content careful, non-diagnostic, and supportive. Return JSON with a top-level "drafts" array.',
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
      response_format: { type: 'json_object' },
    });

    const textContent = response.choices[0]?.message.content ?? '{"drafts":[]}';
    const parsed = JSON.parse(textContent) as {
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
      // Build a focused prompt: topic first, then brief layout constraints.
      // Long prompts overwhelm gpt-image-1-mini and cause irrelevant imagery.
      const topicBlock = [
        `ARTICLE TOPIC (illustrate this): "${article.title}"`,
        article.excerpt ? `Context: ${this.truncate(article.excerpt, 300)}` : '',
        article.categoryNames.length ? `Categories: ${article.categoryNames.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const layoutBlock = this.compactLayoutInstructions(draft.platform);

      const imagePrompt = [
        topicBlock,
        '',
        layoutBlock,
        '',
        'Style: premium editorial illustration for The Minds Journal. Use illustrations, painted artwork, or editorial collage. No real photography. No text, letters, numbers, logos, labels, or watermarks anywhere on the image.',
      ].join('\n');

      const image = await this.client?.images.generate(
        this.imageModel.startsWith('gpt-image')
          ? {
              model: this.imageModel,
              prompt: imagePrompt,
              n: 1,
              size: this.openAiImageSize(draft.platform),
              quality: 'medium',
              output_format: 'jpeg',
            }
          : {
              model: this.imageModel,
              prompt: imagePrompt,
              n: 1,
              size: this.openAiImageSize(draft.platform),
              quality: 'standard',
              response_format: 'b64_json',
            },
      );

      let b64Json = image?.data?.[0]?.b64_json;
      if (!b64Json && image?.data?.[0]?.url) {
        const fetchRes = await fetch(image.data[0].url);
        const arrayBuf = await fetchRes.arrayBuffer();
        b64Json = Buffer.from(arrayBuf).toString('base64');
      }

      if (!b64Json) {
        throw new Error('OpenAI image response did not include image data or URL.');
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
        mediaUrl:
          article.featuredImageUrl ?? this.visualFor(article, draft.platform, draft.hashtags),
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

  private compactLayoutInstructions(platform: SocialPlatform): string {
    return {
      [SocialPlatform.PINTEREST]:
        'Layout: vertical 2:3 canvas. Leave clean space at top 25% and bottom 15% for text overlay. Main artwork in center.',
      [SocialPlatform.INSTAGRAM]:
        'Layout: square 1:1 canvas. Leave clean space at top 25% and bottom 15% for text overlay. Main artwork fills center.',
      [SocialPlatform.FACEBOOK]: 'Layout: square 1:1 canvas. Full artwork, clean composition.',
      [SocialPlatform.LINKEDIN]:
        'Layout: wide 16:9 canvas. Professional editorial visual, clean composition.',
      [SocialPlatform.X]:
        'Layout: wide 16:9 canvas. High-contrast, simple composition, one bold idea.',
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

  private openAiImageSize(
    platform: SocialPlatform,
  ): '1024x1024' | '1792x1024' | '1024x1792' | '1536x1024' | '1024x1536' {
    if (this.imageModel.startsWith('gpt-image')) {
      if (platform === SocialPlatform.PINTEREST) {
        return '1024x1536';
      }

      if (platform === SocialPlatform.X || platform === SocialPlatform.LINKEDIN) {
        return '1536x1024';
      }
    }

    if (platform === SocialPlatform.PINTEREST) {
      return '1024x1792';
    }

    if (platform === SocialPlatform.X || platform === SocialPlatform.LINKEDIN) {
      return '1792x1024';
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
    const isPortrait = size.height > size.width;
    const isLandscape = size.width > size.height;

    // Platform-tailored color themes
    const theme = {
      [SocialPlatform.PINTEREST]: {
        bgFrom: '#1E1E2E',
        bgTo: '#11111B',
        cardBg: 'rgba(30, 30, 46, 0.85)',
        cardBorder: 'rgba(245, 194, 231, 0.3)',
        badgeBg: '#F5C2E7',
        badgeText: '#1E1E2E',
        titleColor: '#F5E0DC',
        excerptColor: '#BAC2DE',
        accentGlow: '#F5C2E7',
        brandText: '#CBA6F7',
      },
      [SocialPlatform.INSTAGRAM]: {
        bgFrom: '#0F172A',
        bgTo: '#020617',
        cardBg: 'rgba(15, 23, 42, 0.85)',
        cardBorder: 'rgba(56, 189, 248, 0.3)',
        badgeBg: '#38BDF8',
        badgeText: '#0F172A',
        titleColor: '#F8FAFC',
        excerptColor: '#94A3B8',
        accentGlow: '#818CF8',
        brandText: '#38BDF8',
      },
      [SocialPlatform.LINKEDIN]: {
        bgFrom: '#0B192C',
        bgTo: '#1E3E62',
        cardBg: 'rgba(11, 25, 44, 0.85)',
        cardBorder: 'rgba(0, 166, 244, 0.35)',
        badgeBg: '#00A6F4',
        badgeText: '#FFFFFF',
        titleColor: '#F8FAFC',
        excerptColor: '#CBD5E1',
        accentGlow: '#00A6F4',
        brandText: '#60A5FA',
      },
      [SocialPlatform.X]: {
        bgFrom: '#09090B',
        bgTo: '#18181B',
        cardBg: 'rgba(24, 24, 27, 0.85)',
        cardBorder: 'rgba(255, 255, 255, 0.2)',
        badgeBg: '#38BDF8',
        badgeText: '#09090B',
        titleColor: '#FAFAFA',
        excerptColor: '#A1A1AA',
        accentGlow: '#38BDF8',
        brandText: '#38BDF8',
      },
      [SocialPlatform.FACEBOOK]: {
        bgFrom: '#0F172A',
        bgTo: '#1E293B',
        cardBg: 'rgba(30, 41, 59, 0.85)',
        cardBorder: 'rgba(96, 165, 250, 0.3)',
        badgeBg: '#60A5FA',
        badgeText: '#0F172A',
        titleColor: '#F8FAFC',
        excerptColor: '#94A3B8',
        accentGlow: '#60A5FA',
        brandText: '#93C5FD',
      },
    }[platform];

    const categoryTag =
      article.categoryNames[0]?.toUpperCase() ??
      hashtags[0]?.replace('#', '').toUpperCase() ??
      'FEATURED ARTICLE';

    const maxCharsPerLine = isLandscape ? 38 : isPortrait ? 26 : 28;
    const maxLines = isLandscape ? 3 : 4;
    const titleLines = this.wrapText(article.title, maxCharsPerLine, maxLines);

    const excerptText = article.excerpt
      ? this.truncate(article.excerpt, isLandscape ? 120 : 90)
      : '';
    const excerptLines = excerptText ? this.wrapText(excerptText, maxCharsPerLine + 6, 2) : [];

    // Layout coordinates & scaling
    const paddingX = Math.round(size.width * 0.08);
    const paddingY = Math.round(size.height * 0.08);
    const cardWidth = size.width - paddingX * 2;
    const cardHeight = size.height - paddingY * 2;

    const titleFontSize = isLandscape ? 44 : isPortrait ? 52 : 48;
    const titleLineHeight = Math.round(titleFontSize * 1.25);
    const excerptFontSize = isLandscape ? 22 : 24;
    const excerptLineHeight = Math.round(excerptFontSize * 1.35);

    // Y positions
    const startY = paddingY + (isLandscape ? 60 : 80);
    const titleStartY = startY + 60;
    const excerptStartY = titleStartY + titleLines.length * titleLineHeight + 30;

    const titleTspans = titleLines
      .map(
        (line, index) =>
          `<tspan x="${paddingX + 40}" y="${titleStartY + index * titleLineHeight}">${escapeXml(line)}</tspan>`,
      )
      .join('');

    const excerptTspans = excerptLines
      .map(
        (line, index) =>
          `<tspan x="${paddingX + 40}" y="${excerptStartY + index * excerptLineHeight}">${escapeXml(line)}</tspan>`,
      )
      .join('');

    const footerY = paddingY + cardHeight - 50;
    const badgeWidth = Math.max(140, categoryTag.length * 13 + 32);

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bgFrom}"/>
      <stop offset="100%" stop-color="${theme.bgTo}"/>
    </linearGradient>
    <radialGradient id="glowG" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="${theme.accentGlow}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${theme.bgTo}" stop-opacity="0"/>
    </radialGradient>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bgGrad)"/>
  <rect width="100%" height="100%" fill="url(#glowG)"/>

  <!-- Subtle ambient line accents -->
  <circle cx="${size.width * 0.85}" cy="${size.height * 0.15}" r="${Math.round(size.width * 0.35)}" fill="none" stroke="${theme.accentGlow}" stroke-width="1.5" stroke-dasharray="8 12" opacity="0.25"/>
  <circle cx="${size.width * 0.15}" cy="${size.height * 0.85}" r="${Math.round(size.width * 0.25)}" fill="none" stroke="${theme.accentGlow}" stroke-width="1.5" opacity="0.15"/>

  <!-- Main Editorial Card -->
  <rect x="${paddingX}" y="${paddingY}" width="${cardWidth}" height="${cardHeight}" rx="24" fill="${theme.cardBg}" stroke="${theme.cardBorder}" stroke-width="2" filter="url(#cardShadow)"/>

  <!-- Category Badge -->
  <rect x="${paddingX + 40}" y="${startY - 25}" width="${badgeWidth}" height="36" rx="18" fill="${theme.badgeBg}"/>
  <text x="${paddingX + 40 + badgeWidth / 2}" y="${startY - 2}" fill="${theme.badgeText}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" text-anchor="middle" letter-spacing="1">${escapeXml(categoryTag)}</text>

  <!-- Article Title -->
  <text font-family="system-ui, -apple-system, sans-serif" font-size="${titleFontSize}" font-weight="800" fill="${theme.titleColor}">
    ${titleTspans}
  </text>

  <!-- Excerpt / Summary Quote -->
  ${
    excerptLines.length
      ? `<text font-family="system-ui, -apple-system, sans-serif" font-size="${excerptFontSize}" font-style="italic" fill="${theme.excerptColor}">
    ${excerptTspans}
  </text>`
      : ''
  }

  <!-- Separator Line -->
  <line x1="${paddingX + 40}" y1="${footerY - 35}" x2="${paddingX + cardWidth - 40}" y2="${footerY - 35}" stroke="${theme.cardBorder}" stroke-width="1"/>

  <!-- Brand / Publication Footer -->
  <text x="${paddingX + 40}" y="${footerY}" fill="${theme.brandText}" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" letter-spacing="1.5">
    THE MINDS JOURNAL <tspan fill="${theme.excerptColor}" font-weight="400">• READ FULL ARTICLE</tspan>
  </text>
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
