import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Role, SocialPlatform } from '@prisma/client';

import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { facebookArticleImagePrompt } from './facebook-article-image-prompt.js';
import { instagramArticleImagePrompt } from './instagram-article-image-prompt.js';
import { pinterestArticleImagePrompt } from './pinterest-article-image-prompt.js';
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
    name: pinterestArticleImagePrompt.name,
    description: pinterestArticleImagePrompt.description,
    template: pinterestArticleImagePrompt.template,
    negativePrompt: pinterestArticleImagePrompt.negativePrompt,
    styleNotes: pinterestArticleImagePrompt.styleNotes,
  },
  [SocialPlatform.INSTAGRAM]: {
    name: instagramArticleImagePrompt.name,
    description: instagramArticleImagePrompt.description,
    template: instagramArticleImagePrompt.template,
    negativePrompt: instagramArticleImagePrompt.negativePrompt,
    styleNotes: instagramArticleImagePrompt.styleNotes,
  },
  [SocialPlatform.FACEBOOK]: {
    name: facebookArticleImagePrompt.name,
    description: facebookArticleImagePrompt.description,
    template: facebookArticleImagePrompt.template,
    negativePrompt: facebookArticleImagePrompt.negativePrompt,
    styleNotes: facebookArticleImagePrompt.styleNotes,
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
  private readonly logger = new Logger(PromptTemplatesService.name);

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
    try {
      await this.ensureDefaults(organizationId, user.id);
    } catch (error) {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : 'Unknown prompt default seed error.',
          organizationId,
        },
        'Prompt template defaults could not be ensured.',
      );
    }

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

  async remove(id: string, user: AuthenticatedUser) {
    this.ensureAdmin(user);
    const organizationId = await this.defaultOrganizationId(user.id);
    const template = await this.prisma.promptTemplate.findFirst({
      where: { id, ...this.visibleWhere(organizationId) },
      select: { id: true },
    });

    if (!template) {
      throw new NotFoundException('Prompt template was not found.');
    }

    await this.prisma.promptTemplate.delete({ where: { id: template.id } });
    return { deleted: true };
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
        contentCategory: {
          in: contentCategory === 'ARTICLE' ? ['ARTICLE'] : [contentCategory, 'ARTICLE'],
        },
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
      'Production quality requirements: create a premium, postable social media background asset directly based on the article content. Use one strong visual idea from the article, not a generic wellness or marketing background. Make it editorial, polished, and visually engaging. Do not default to a cartoon illustration. Vary the creative format based on the article: realistic lifestyle/photo poster, emotional concept art, refined paper texture, magazine-style cover, editorial collage, symbolic mental-health artwork, or clean premium illustration. Do not render any written letters, words, numbers, headlines, captions, logos, labels, signs, gibberish typography, or square font boxes directly on the image canvas. SocialFlow will add the approved text post-generation. Never add platform labels, social network names, app UI, SocialFlow branding, logos, watermarks, or dense paragraphs.';

    const channel = {
      [SocialPlatform.PINTEREST]:
        'Pinterest specifics: vertical 2:3 save-worthy composition, clear hero concept, clean top and bottom background safe areas, airy spacing.',
      [SocialPlatform.INSTAGRAM]:
        'Instagram specifics: square 1:1 feed composition, warm subject-led scene, clean top and bottom safe background areas, emotional clarity, elegant color harmony.',
      [SocialPlatform.FACEBOOK]:
        'Facebook specifics: square or landscape post image, broad-audience clarity, clean top and bottom safe background areas, warm but not childish.',
      [SocialPlatform.LINKEDIN]:
        'LinkedIn specifics: credible professional editorial visual, research/strategy feel, clean workspace, abstract concept scene, clean top and bottom safe areas, muted premium palette.',
      [SocialPlatform.X]:
        'X specifics: wide landscape preview image, high-contrast simple composition, one bold idea, clean background safe areas.',
    }[platform];

    return `${base}\n${channel}`;
  }

  private async ensureDefaults(organizationId: string | null, userId?: string) {
    for (const [platform, template] of Object.entries(defaultPromptTemplates)) {
      for (const category of promptContentCategories) {
        const categoryDefaults = this.categoryDefaultOverrides(
          category,
          platform as SocialPlatform,
        );
        const targetTemplate = categoryDefaults.template ?? template.template;
        const targetNegative = categoryDefaults.negativePrompt ?? template.negativePrompt;
        const targetStyle = categoryDefaults.styleNotes ?? template.styleNotes;
        const targetName = categoryDefaults.name ?? template.name;
        const targetDescription = categoryDefaults.description ?? template.description;

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
              name: targetName,
              description: targetDescription,
              template: targetTemplate,
              negativePrompt: targetNegative,
              styleNotes: targetStyle,
              createdById: userId,
              updatedById: userId,
            },
          });
        } else if (
          existing.template.includes('One strong, highly clickable main title') ||
          existing.template.includes('The title and footer are mandatory') ||
          existing.template.includes('Do not generate a text-free image')
        ) {
          // Update legacy database seeded default prompt templates to the clean text-free version
          await this.prisma.promptTemplate.update({
            where: { id: existing.id },
            data: {
              name: targetName,
              description: targetDescription,
              template: targetTemplate,
              negativePrompt: targetNegative,
              styleNotes: targetStyle,
              updatedById: userId,
            },
          });
        }
      }
    }
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
    const clean =
      value
        ?.trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_') ?? 'ARTICLE';

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
