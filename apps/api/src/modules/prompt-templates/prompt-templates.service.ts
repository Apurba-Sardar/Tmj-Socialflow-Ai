import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, SocialPlatform } from '@prisma/client';

import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PreviewPromptTemplateDto, UpsertPromptTemplateDto } from './prompt-templates.dto.js';

export const PROMPT_PURPOSE_IMAGE = 'IMAGE_GENERATION';

interface PromptArticleContext {
  title: string;
  excerpt: string;
  contentText: string | null;
  url: string;
  categoryNames: string[];
}

interface RenderPromptInput {
  platform: SocialPlatform;
  article: PromptArticleContext;
  captionTitle?: string;
  captionBody?: string;
  contentCategory?: string;
}

const promptContentCategories = ['ARTICLE', 'QUOTES', 'NEWS'] as const;
type PromptContentCategory = (typeof promptContentCategories)[number];

const defaultPromptTemplates: Record<
  SocialPlatform,
  {
    name: string;
    description: string;
    template: string;
    negativePrompt: string;
    styleNotes: string;
  }
> = {
  [SocialPlatform.PINTEREST]: {
    name: 'Pinterest mixed editorial pin image',
    description:
      'Tall save-worthy pins with varied quote, poster, photo, collage, and editorial formats.',
    template:
      'Create a tall vertical Pinterest-ready image asset for a WordPress article.\n\nArticle title: {{articleTitle}}\nExcerpt: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: choose the strongest postable format for this article, not a repeated cartoon template. Use one of these formats when appropriate: emotional text-over-photo poster, elegant quote card, magazine-style educational cover, editorial collage, realistic lifestyle photograph with tasteful overlay space, abstract mental-health concept art, or clean illustrated explainer. Make it feel like a Mind Family social post people would save and share.\n\nText treatment: short readable text is allowed only when it improves the asset, such as a concise quote, 3-6 word hook, or article-inspired headline. Keep text large, minimal, correctly spelled, and visually designed. Do not paste the full caption.\n\nTopic safety guidance: {{topicGuidance}}\n\nBrand: content-first, no software branding, no platform label.',
    negativePrompt:
      'No platform label, social network name, UI, app logo, watermark, fake website chrome, tiny unreadable text, misspelled text, dense paragraphs, clutter, generic stock-photo styling, medical procedures, violent or fear-based imagery, or unrelated decoration.',
    styleNotes:
      'Vertical 2:3. Vary the format across posts: quote card, emotional photo poster, editorial collage, magazine cover, concept art, or clean explainer. Avoid defaulting to childish cartoons.',
  },
  [SocialPlatform.INSTAGRAM]: {
    name: 'Instagram mixed premium feed image',
    description:
      'Square feed images with realistic, quote-card, editorial, and concept-art variety.',
    template:
      'Create a square Instagram-ready image asset for a WordPress article.\n\nArticle title: {{articleTitle}}\nExcerpt: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: choose a premium feed format that fits the article: realistic lifestyle photo, emotional portrait-style concept, quote-card graphic, soft editorial collage, magazine-style mental-health visual, or refined illustration. Avoid repetitive cartoon parent-child scenes. The image should look like a finished Mind Family post, visually strong at feed size, warm, human, and shareable.\n\nText treatment: short readable text is allowed when useful, such as a concise quote or 3-7 word hook. Keep it large, clean, correctly spelled, and designed as part of the image. Do not paste the full caption.\n\nTopic safety guidance: {{topicGuidance}}\n\nMake it polished enough to publish on a brand account. No platform label.',
    negativePrompt:
      'No platform label, social network name, UI, app logo, watermark, tiny unreadable text, misspelled text, dense paragraphs, cheap template look, childish cartoon styling, busy infographic layouts, medical procedures, or sensational imagery.',
    styleNotes:
      'Square 1:1. Use varied premium formats: realistic lifestyle, quote card, editorial collage, emotional concept art, or refined illustration.',
  },
  [SocialPlatform.FACEBOOK]: {
    name: 'Facebook Mind Family post image',
    description: 'Shareable Facebook images in the style of Mind Family posts.',
    template:
      'Create a Facebook-ready Mind Family style image asset for a WordPress article.\n\nArticle title: {{articleTitle}}\nExcerpt: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: create a postable social image like a manually designed Facebook page asset, not a generic cartoon scene. Select the best format for the content: realistic family/mental-health photo poster, dramatic but tasteful concept art, quote card on paper/neutral background, magazine-style educational graphic, editorial collage, illustrated psychology metaphor, or warm lifestyle image with a designed text area. Make it unique to this article and emotionally clear.\n\nText treatment: short readable text is allowed and often preferred for Facebook, such as a concise quote, article-inspired headline, or 3-8 word hook. Keep text large, clean, correctly spelled, and visually designed. Do not include the full caption or hashtags.\n\nTopic safety guidance: {{topicGuidance}}\n\nNo Facebook label, no SocialFlow branding, no app UI.',
    negativePrompt:
      'No platform label, social network name, UI, app logo, watermark, tiny unreadable text, misspelled text, dense paragraphs, cheap meme template, repeated generic cartoon families, clinical drama, gore, fearmongering, or unrelated generic objects.',
    styleNotes:
      'Square/landscape. Match Mind Family page style: quote cards, text-over-photo posters, emotional concept art, magazine-style mental-health graphics, and premium educational visuals.',
  },
  [SocialPlatform.LINKEDIN]: {
    name: 'LinkedIn professional research image',
    description: 'Professional editorial image for business and health education feeds.',
    template:
      'Create a professional LinkedIn-ready image asset for a WordPress article.\n\nArticle title: {{articleTitle}}\nExcerpt: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: credible editorial research visual, clean desk or abstract science composition, muted premium palette, polished business/health education feel, no childish cartoon styling. Choose a varied professional format: research desk photo, editorial concept, refined quote card, abstract data-free metaphor, or premium magazine-style cover.\n\nText treatment: short readable text is allowed only when it gives the image a professional cover/quote-card feel. Keep it minimal, correctly spelled, and not like a dense slide.\n\nTopic safety guidance: {{topicGuidance}}\n\nNo platform label.',
    negativePrompt:
      'No platform label, social network name, UI, app logo, watermark, tiny unreadable text, misspelled text, dense paragraphs, childish cartoons, sensational health claims, medical procedures, or clutter.',
    styleNotes: 'Professional, muted premium palette, credible research mood.',
  },
  [SocialPlatform.X]: {
    name: 'X high-contrast preview image',
    description: 'Wide simple visual designed to read well in X previews.',
    template:
      'Create a wide landscape X-ready image asset for a WordPress article.\n\nArticle title: {{articleTitle}}\nExcerpt: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: simple high-contrast editorial composition, one clear idea, readable at small preview size, minimal background detail, no infographic clutter. Use a varied format such as text-over-photo poster, bold quote card, realistic editorial image, surreal concept art, or simple premium collage.\n\nText treatment: short readable text is allowed when it improves preview impact, but keep it very brief and correctly spelled.\n\nTopic safety guidance: {{topicGuidance}}\n\nNo X/Twitter label.',
    negativePrompt:
      'No platform label, social network name, UI, app logo, watermark, tiny unreadable text, misspelled text, dense paragraphs, busy layouts, medical procedures, or body-transformation imagery.',
    styleNotes: 'Wide 16:9, high-contrast, simple preview-safe composition.',
  },
};

@Injectable()
export class PromptTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  defaults() {
    return Object.entries(defaultPromptTemplates).map(([platform, template]) => ({
      platform,
      purpose: PROMPT_PURPOSE_IMAGE,
      contentCategory: 'ARTICLE',
      ...template,
    }));
  }

  async list(user: AuthenticatedUser) {
    const organizationId = await this.defaultOrganizationId(user.id);
    await this.ensureDefaults(organizationId, user.id);

    return this.prisma.promptTemplate.findMany({
      where: this.visibleWhere(organizationId),
      orderBy: [
        { platform: 'asc' },
        { contentCategory: 'asc' },
        { purpose: 'asc' },
        { updatedAt: 'desc' },
      ],
      include: {
        updatedBy: {
          select: {
            email: true,
            displayName: true,
          },
        },
      },
    });
  }

  async upsert(dto: UpsertPromptTemplateDto, user: AuthenticatedUser) {
    this.ensureAdmin(user);
    const organizationId = await this.defaultOrganizationId(user.id);
    const purpose = this.purpose(dto.purpose);
    const contentCategory = this.contentCategory(dto.contentCategory);

    const existing = await this.prisma.promptTemplate.findFirst({
      where: { organizationId, platform: dto.platform, purpose, contentCategory, active: true },
      select: { id: true, version: true },
    });

    if (existing) {
      return this.prisma.promptTemplate.update({
        where: { id: existing.id },
        data: {
          name: dto.name.trim(),
          description: this.optionalTrim(dto.description),
          contentCategory,
          template: dto.template.trim(),
          negativePrompt: this.optionalTrim(dto.negativePrompt),
          styleNotes: this.optionalTrim(dto.styleNotes),
          active: dto.active ?? true,
          updatedById: user.id,
          version: { increment: 1 },
        },
      });
    }

    return this.prisma.promptTemplate.create({
      data: {
        organizationId,
        platform: dto.platform,
        purpose,
        contentCategory,
        name: dto.name.trim(),
        description: this.optionalTrim(dto.description),
        template: dto.template.trim(),
        negativePrompt: this.optionalTrim(dto.negativePrompt),
        styleNotes: this.optionalTrim(dto.styleNotes),
        active: dto.active ?? true,
        createdById: user.id,
        updatedById: user.id,
      },
    });
  }

  async reset(platform: string, user: AuthenticatedUser, contentCategory?: string) {
    this.ensureAdmin(user);
    const cleanPlatform = this.parsePlatform(platform);
    const cleanCategory = this.contentCategory(contentCategory);
    const defaults = defaultPromptTemplates[cleanPlatform];
    const categoryDefaults = this.categoryDefaultOverrides(cleanCategory, cleanPlatform);

    return this.upsert(
      {
        platform: cleanPlatform,
        purpose: PROMPT_PURPOSE_IMAGE,
        contentCategory: cleanCategory,
        ...defaults,
        ...categoryDefaults,
        active: true,
      },
      user,
    );
  }

  async preview(dto: PreviewPromptTemplateDto, user: AuthenticatedUser) {
    const rendered = await this.renderImagePrompt(
      {
        platform: dto.platform,
        contentCategory: dto.contentCategory,
        article: {
          title: nonEmpty(dto.title?.trim(), 'Example WordPress article'),
          excerpt: nonEmpty(
            dto.excerpt?.trim(),
            'A concise article summary used for image direction.',
          ),
          contentText: nonEmptyOrNull(dto.content?.trim()),
          url: 'https://example.com/article',
          categoryNames: this.parseCsv(dto.categories),
        },
      },
      user.id,
      this.purpose(dto.purpose),
    );

    return {
      prompt: rendered.prompt,
      promptVersion: rendered.promptVersion,
      templateId: rendered.templateId,
    };
  }

  async renderImagePrompt(
    input: RenderPromptInput,
    userId?: string,
    purpose = PROMPT_PURPOSE_IMAGE,
  ) {
    const organizationId = userId ? await this.defaultOrganizationId(userId) : null;
    await this.ensureDefaults(organizationId, userId);
    const contentCategory = this.contentCategory(
      input.contentCategory ?? this.inferContentCategory(input.article),
    );

    const templates = await this.prisma.promptTemplate.findMany({
      where: {
        ...this.visibleWhere(organizationId),
        platform: input.platform,
        purpose,
        contentCategory: { in: contentCategory === 'ARTICLE' ? ['ARTICLE'] : [contentCategory, 'ARTICLE'] },
        active: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    const template =
      templates.find((item) => item.contentCategory === contentCategory) ?? templates[0];

    const fallback = defaultPromptTemplates[input.platform];
    const body = template?.template ?? fallback.template;
    const negativePrompt = template?.negativePrompt ?? fallback.negativePrompt;
    const styleNotes = template?.styleNotes ?? fallback.styleNotes;
    const replacements = {
      articleTitle: input.article.title,
      articleExcerpt: input.article.excerpt,
      articleContext: this.truncate(input.article.contentText ?? input.article.excerpt, 1200),
      articleUrl: input.article.url,
      categories: nonEmpty(input.article.categoryNames.join(', '), 'social media article'),
      platform: platformTitle(input.platform),
      contentCategory: categoryTitle(contentCategory),
      captionTitle: input.captionTitle ?? input.article.title,
      captionBody: input.captionBody ?? '',
      topicGuidance: this.topicVisualGuidance(input.article),
      negativePrompt,
      styleNotes,
    };

    const renderedBody = this.replaceTokens(body, replacements);
    const renderedNegative = this.replaceTokens(negativePrompt, replacements);
    const renderedStyleNotes = this.replaceTokens(styleNotes, replacements);

    return {
      prompt: [
        renderedBody,
        this.productionCreativeBrief(input.platform),
        renderedStyleNotes ? `Style notes: ${renderedStyleNotes}` : '',
        renderedNegative ? `Negative prompt: ${renderedNegative}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      promptVersion: `admin-${input.platform.toLowerCase()}-${contentCategory.toLowerCase()}-${String(template?.version ?? 1)}`,
      templateId: template?.id ?? null,
    };
  }

  private productionCreativeBrief(platform: SocialPlatform): string {
    const base =
      'Production quality requirements: create a premium, postable social media asset directly based on the article content. Use one strong visual idea from the article, not a generic wellness or marketing background. Make it editorial, polished, useful at feed size, and ready for a brand account. Do not default to a cartoon illustration. Vary the creative format based on the article: realistic lifestyle/photo poster, emotional concept art, refined quote card, magazine-style educational cover, editorial collage, symbolic mental-health artwork, or clean premium illustration. Short readable text is allowed when it makes the asset more postable, such as a concise quote, 3-8 word hook, or article-inspired headline; keep it large, minimal, correctly spelled, and visually designed. Do not paste the full caption or hashtags. Never add platform labels, social network names, app UI, SocialFlow branding, logos, watermarks, tiny unreadable text, or dense paragraphs.';

    const channel = {
      [SocialPlatform.PINTEREST]:
        'Pinterest specifics: vertical 2:3 save-worthy composition, clear hero concept, quote-card or educational poster feel, premium collage or realistic/editorial visual, helpful reference-board mood, airy spacing.',
      [SocialPlatform.INSTAGRAM]:
        'Instagram specifics: square premium feed composition, warm subject-led scene or designed quote card, emotional clarity, elegant color harmony, instantly understandable in feed.',
      [SocialPlatform.FACEBOOK]:
        'Facebook specifics: Mind Family style square or landscape post image, broad-audience clarity, shareable quote/text poster when useful, realistic family/mental-health visual when safe, warm but not childish.',
      [SocialPlatform.LINKEDIN]:
        'LinkedIn specifics: credible professional editorial visual, research/strategy feel, clean workspace, abstract concept scene, refined quote card, muted premium palette, business-health education polish.',
      [SocialPlatform.X]:
        'X specifics: wide landscape preview image, high-contrast simple composition, one bold idea, optional very short hook text, very readable at small preview size, minimal detail.',
    }[platform];

    return `${base}\n${channel}`;
  }

  private async ensureDefaults(organizationId: string | null, userId?: string) {
    for (const [platform, template] of Object.entries(defaultPromptTemplates)) {
      for (const category of promptContentCategories) {
        const categoryDefaults = this.categoryDefaultOverrides(category, platform as SocialPlatform);
        const existing = await this.prisma.promptTemplate.findFirst({
          where: {
            organizationId,
            platform: platform as SocialPlatform,
            purpose: PROMPT_PURPOSE_IMAGE,
            contentCategory: category,
            active: true,
          },
          select: { id: true, name: true, template: true, styleNotes: true, contentCategory: true },
        });

        if (!existing) {
          await this.prisma.promptTemplate.create({
            data: {
              organizationId,
              platform: platform as SocialPlatform,
              purpose: PROMPT_PURPOSE_IMAGE,
              contentCategory: category,
              name: categoryDefaults.name ?? template.name,
              description: categoryDefaults.description ?? template.description,
              template: categoryDefaults.template ?? template.template,
              negativePrompt: categoryDefaults.negativePrompt ?? template.negativePrompt,
              styleNotes: categoryDefaults.styleNotes ?? template.styleNotes,
              createdById: userId,
              updatedById: userId,
            },
          });
        } else if (category === 'ARTICLE' && this.shouldUpgradeLegacyDefault(existing)) {
          await this.prisma.promptTemplate.update({
            where: { id: existing.id },
            data: {
              name: template.name,
              description: template.description,
              template: template.template,
              negativePrompt: template.negativePrompt,
              styleNotes: template.styleNotes,
              updatedById: userId,
              version: { increment: 1 },
            },
          });
        }
      }
    }
  }

  private shouldUpgradeLegacyDefault(template: {
    name: string;
    template: string;
    styleNotes: string | null;
  }) {
    const legacyNames = new Set([
      'Pinterest educational pin image',
      'Instagram premium feed image',
      'Facebook friendly educational image',
      'LinkedIn professional research image',
      'X high-contrast preview image',
    ]);
    const legacyText = `${template.template} ${template.styleNotes ?? ''}`.toLowerCase();

    return (
      legacyNames.has(template.name) ||
      legacyText.includes('no readable text') ||
      legacyText.includes('not contain caption text') ||
      legacyText.includes('warm premium editorial illustration')
    );
  }

  private visibleWhere(organizationId: string | null): Prisma.PromptTemplateWhereInput {
    return organizationId ? { organizationId } : { organizationId: null };
  }

  private async defaultOrganizationId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultOrganizationId: true },
    });
    return user?.defaultOrganizationId ?? null;
  }

  private ensureAdmin(user: AuthenticatedUser) {
    if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN && user.role !== Role.MANAGER) {
      throw new NotFoundException('Prompt template was not found.');
    }
  }

  private parsePlatform(platform: string): SocialPlatform {
    if (!Object.values(SocialPlatform).includes(platform as SocialPlatform)) {
      throw new BadRequestException('Unsupported social platform.');
    }

    return platform as SocialPlatform;
  }

  private purpose(value?: string) {
    return nonEmpty(value?.trim().toUpperCase(), PROMPT_PURPOSE_IMAGE);
  }

  private contentCategory(value?: string): PromptContentCategory {
    const clean = value?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') || 'ARTICLE';

    if (promptContentCategories.includes(clean as PromptContentCategory)) {
      return clean as PromptContentCategory;
    }

    return 'ARTICLE';
  }

  private inferContentCategory(article: PromptArticleContext): PromptContentCategory {
    const text = `${article.url} ${article.title} ${article.categoryNames.join(' ')}`.toLowerCase();

    if (/(\/quotes?\/|\bquotes?\b|saying|proverb)/i.test(text)) {
      return 'QUOTES';
    }

    if (/(\/news\/|\bnews\b|update|announces?|report|study|research|202[0-9])/i.test(text)) {
      return 'NEWS';
    }

    return 'ARTICLE';
  }

  private categoryDefaultOverrides(
    category: PromptContentCategory,
    platform: SocialPlatform,
  ): Partial<(typeof defaultPromptTemplates)[SocialPlatform]> {
    if (category === 'QUOTES') {
      return {
        name: `${platformTitle(platform)} Mind Family quote image`,
        description:
          'Quote-first visual prompts for quote posts, short sayings, and shareable family wisdom.',
        template:
          'Create a premium {{platform}} image asset for a quote-style WordPress post.\n\nArticle title: {{articleTitle}}\nExcerpt or quote idea: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: make this feel like a finished Mind Family quote post, not a generic cartoon. Use one of these formats: elegant paper quote card, realistic photo background with clean readable quote overlay, warm minimal typography poster, subtle illustration plus quote block, premium book/page texture, or emotional concept image with a short quote area.\n\nText treatment: because this is quote content, one short quote or 3-10 word hook is allowed and preferred. Keep text large, correctly spelled, centered or intentionally composed, and easy to read on mobile. Do not include hashtags, platform labels, UI, or long paragraphs.\n\nTopic safety guidance: {{topicGuidance}}\n\nBrand: content-first Mind Family style. No SocialFlow branding.',
        styleNotes:
          'Quote/category mode. Prioritize readable short quote-card, paper texture, soft photo poster, premium typography, and emotional simplicity. Avoid childish cartoons and dense text.',
      };
    }

    if (category === 'NEWS') {
      return {
        name: `${platformTitle(platform)} Mind Family news image`,
        description:
          'News/update visual prompts for timely posts, reports, studies, and announcements.',
        template:
          'Create a premium {{platform}} image asset for a news or update-style WordPress post.\n\nArticle title: {{articleTitle}}\nExcerpt: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: make a polished social news asset that communicates the story clearly without looking like a generic cartoon. Use one of these formats: editorial photo poster, clean news-card graphic, magazine-style cover, serious mental-health concept art, report-style visual without charts, or realistic lifestyle/news image with a concise headline area.\n\nText treatment: a short headline or 3-8 word news hook is allowed. Keep it accurate, large, correctly spelled, and not sensational. Do not add fake statistics, charts, labels, hashtags, platform names, or full caption text.\n\nTopic safety guidance: {{topicGuidance}}\n\nBrand: content-first Mind Family style. No SocialFlow branding.',
        styleNotes:
          'News/category mode. Prioritize editorial clarity, accurate headline-style visuals, realistic/contextual imagery, and serious but supportive tone. Avoid clickbait, fear imagery, and childish cartoons.',
      };
    }

    return {};
  }

  private optionalTrim(value?: string): string | undefined {
    const clean = value?.trim();
    return nonEmptyOrUndefined(clean);
  }

  private parseCsv(value?: string): string[] {
    return (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  private replaceTokens(template: string, replacements: Record<string, string>): string {
    return template.replace(
      /\{\{([a-zA-Z0-9_]+)\}\}/g,
      (_match, key: string) => replacements[key] ?? '',
    );
  }

  private topicVisualGuidance(article: PromptArticleContext): string {
    const topic =
      `${article.title} ${article.excerpt} ${article.contentText ?? ''} ${article.categoryNames.join(' ')}`.toLowerCase();

    if (
      /(peptide|semaglutide|tesamorelin|aod|fat loss|weight loss|metabolism|obesity)/i.test(topic)
    ) {
      return [
        'Use abstract molecular structures, amino-acid chain motifs, microscope lens, clean lab glassware without labels, blank research notebook, healthy balanced plate, leaves, soft science-and-wellness symbols.',
        'Do not show weighing scales, stomach/body silhouettes, measuring tape, before-after imagery, injections, needles, syringes, vials, pills, drug packaging, doctors treating patients, medical procedures, or dramatic clinical scenes.',
        'Do not imply treatment results or body transformation.',
      ].join(' ');
    }

    if (/(parent|child|family|dad|mom|baby|toddler|school|foster)/i.test(topic)) {
      return [
        'Use family-safe visuals, but vary the format: realistic home/lifestyle photo poster, thoughtful parent-child editorial scene, quote card on paper or neutral background, psychology metaphor, magazine-style parenting graphic, or refined illustration.',
        'For sensitive mental-health or family-stress topics, use supportive, non-exploitative imagery: thoughtful faces, soft lighting, symbolic fog/brain/heart/home motifs, calm interiors, or abstract emotional concepts.',
        'Avoid repetitive cartoon families, distressed children, unsafe situations, medical scenes, identifiable real people, or sensational fear imagery.',
      ].join(' ');
    }

    return 'Use a varied editorial format based on the article theme: realistic photo poster, refined quote card, premium collage, symbolic concept art, magazine cover, or clean educational graphic. Avoid generic stock-photo compositions, repeated cartoon scenes, and unrelated decorative elements.';
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}...` : value;
  }
}

function platformTitle(platform: SocialPlatform): string {
  return platform.charAt(0) + platform.slice(1).toLowerCase();
}

function categoryTitle(category: string): string {
  return category
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function nonEmpty(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

function nonEmptyOrNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

function nonEmptyOrUndefined(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}
