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
}

const defaultPromptTemplates: Record<SocialPlatform, { name: string; description: string; template: string; negativePrompt: string; styleNotes: string }> = {
  [SocialPlatform.PINTEREST]: {
    name: 'Pinterest educational pin image',
    description: 'Tall save-worthy editorial visual for Pinterest pins.',
    template:
      'Create a tall vertical Pinterest image for a WordPress article.\n\nArticle title: {{articleTitle}}\nExcerpt: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: light editorial illustration, watercolor or clean vector collage, pastel palette, useful magazine or pin-board feel, one clear hero concept, airy white space, no dark backgrounds. Reserve clean negative space for the app to overlay a short headline. Avoid placing key objects under the headline area.\n\nTopic safety guidance: {{topicGuidance}}\n\nBrand: content-first, no software branding.',
    negativePrompt:
      'No readable text, words, letters, numbers, logos, watermarks, UI, captions, labels, signs, charts, posters, document text, or typographic marks. Avoid clutter, dark backgrounds, generic stock-photo styling, medical procedures, and unrelated decoration.',
    styleNotes: 'Vertical 2:3, warm pastel editorial, one simple idea.',
  },
  [SocialPlatform.INSTAGRAM]: {
    name: 'Instagram premium feed image',
    description: 'Square editorial lifestyle visual for Instagram feed posts.',
    template:
      'Create a square Instagram image for a WordPress article.\n\nArticle title: {{articleTitle}}\nExcerpt: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: premium lifestyle/editorial illustration, centered subject, balanced composition, soft gradients or paper texture, visually engaging at feed size, minimal and warm, no clutter. Reserve clean negative space for app headline overlay.\n\nTopic safety guidance: {{topicGuidance}}\n\nMake it polished enough to publish on a brand account.',
    negativePrompt:
      'No readable text, words, letters, numbers, logos, watermarks, UI, captions, labels, signs, charts, posters, document text, or typographic marks. Avoid childish cartoon styling, busy infographic layouts, medical procedures, and sensational imagery.',
    styleNotes: 'Square 1:1, warm premium editorial illustration.',
  },
  [SocialPlatform.FACEBOOK]: {
    name: 'Facebook friendly educational image',
    description: 'Friendly square/landscape image for broad Facebook audiences.',
    template:
      'Create a friendly Facebook social image for a WordPress article.\n\nArticle title: {{articleTitle}}\nExcerpt: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: approachable lifestyle illustration, warm and clear educational visual, suitable for a broad audience, no clutter. Use one clear concept and keep negative space for an app headline overlay.\n\nTopic safety guidance: {{topicGuidance}}',
    negativePrompt:
      'No readable text, words, letters, numbers, logos, watermarks, UI, captions, labels, signs, charts, posters, document text, or typographic marks. Avoid fear-based imagery, clinical drama, and unrelated generic objects.',
    styleNotes: 'Square/landscape, warm, approachable, easy to understand.',
  },
  [SocialPlatform.LINKEDIN]: {
    name: 'LinkedIn professional research image',
    description: 'Professional editorial image for business and health education feeds.',
    template:
      'Create a professional LinkedIn image for a WordPress article.\n\nArticle title: {{articleTitle}}\nExcerpt: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: credible editorial research visual, clean desk or abstract science composition, muted premium palette, polished business/health education feel, no childish cartoon styling. Reserve clean negative space for an app headline overlay.\n\nTopic safety guidance: {{topicGuidance}}',
    negativePrompt:
      'No readable text, words, letters, numbers, logos, watermarks, UI, captions, labels, signs, charts, posters, document text, or typographic marks. Avoid childish cartoons, sensational health claims, medical procedures, and clutter.',
    styleNotes: 'Professional, muted premium palette, credible research mood.',
  },
  [SocialPlatform.X]: {
    name: 'X high-contrast preview image',
    description: 'Wide simple visual designed to read well in X previews.',
    template:
      'Create a wide landscape X image for a WordPress article.\n\nArticle title: {{articleTitle}}\nExcerpt: {{articleExcerpt}}\nCategories: {{categories}}\nArticle context: {{articleContext}}\n\nCreative direction: simple high-contrast editorial composition, one clear idea, readable at small preview size, minimal background detail, no infographic clutter. Keep negative space for an app headline overlay.\n\nTopic safety guidance: {{topicGuidance}}',
    negativePrompt:
      'No readable text, words, letters, numbers, logos, watermarks, UI, captions, labels, signs, charts, posters, document text, or typographic marks. Avoid tiny details, busy layouts, medical procedures, and body-transformation imagery.',
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
      ...template,
    }));
  }

  async list(user: AuthenticatedUser) {
    const organizationId = await this.defaultOrganizationId(user.id);
    await this.ensureDefaults(organizationId, user.id);

    return this.prisma.promptTemplate.findMany({
      where: this.visibleWhere(organizationId),
      orderBy: [{ platform: 'asc' }, { purpose: 'asc' }, { updatedAt: 'desc' }],
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

    const existing = await this.prisma.promptTemplate.findFirst({
      where: { organizationId, platform: dto.platform, purpose, active: true },
      select: { id: true, version: true },
    });

    if (existing) {
      return this.prisma.promptTemplate.update({
        where: { id: existing.id },
        data: {
          name: dto.name.trim(),
          description: this.optionalTrim(dto.description),
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

  async reset(platform: string, user: AuthenticatedUser) {
    this.ensureAdmin(user);
    const cleanPlatform = this.parsePlatform(platform);
    const defaults = defaultPromptTemplates[cleanPlatform];

    return this.upsert(
      {
        platform: cleanPlatform,
        purpose: PROMPT_PURPOSE_IMAGE,
        ...defaults,
        active: true,
      },
      user,
    );
  }

  async preview(dto: PreviewPromptTemplateDto, user: AuthenticatedUser) {
    const rendered = await this.renderImagePrompt({
      platform: dto.platform,
      article: {
        title: nonEmpty(dto.title?.trim(), 'Example WordPress article'),
        excerpt: nonEmpty(dto.excerpt?.trim(), 'A concise article summary used for image direction.'),
        contentText: nonEmptyOrNull(dto.content?.trim()),
        url: 'https://example.com/article',
        categoryNames: this.parseCsv(dto.categories),
      },
    }, user.id, this.purpose(dto.purpose));

    return { prompt: rendered.prompt, promptVersion: rendered.promptVersion, templateId: rendered.templateId };
  }

  async renderImagePrompt(input: RenderPromptInput, userId?: string, purpose = PROMPT_PURPOSE_IMAGE) {
    const organizationId = userId ? await this.defaultOrganizationId(userId) : null;
    await this.ensureDefaults(organizationId, userId);

    const template = await this.prisma.promptTemplate.findFirst({
      where: {
        ...this.visibleWhere(organizationId),
        platform: input.platform,
        purpose,
        active: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

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
      ].filter(Boolean).join('\n\n'),
      promptVersion: `admin-${input.platform.toLowerCase()}-${String(template?.version ?? 1)}`,
      templateId: template?.id ?? null,
    };
  }

  private productionCreativeBrief(platform: SocialPlatform): string {
    const base =
      'Production quality requirements: create a premium, postable social media creative directly based on the article content. Use one strong visual idea from the article, not a generic wellness or marketing background. Make it editorial, polished, useful at feed size, and ready for a brand account. Leave clean negative space for SocialFlow to overlay the headline later. Do not include text in the generated image itself.';

    const channel = {
      [SocialPlatform.PINTEREST]:
        'Pinterest specifics: vertical 2:3 save-worthy educational pin composition, clear hero concept, soft editorial illustration or premium collage, helpful reference-board mood, airy spacing.',
      [SocialPlatform.INSTAGRAM]:
        'Instagram specifics: square premium lifestyle/editorial composition, warm subject-led scene, balanced center of interest, elegant color harmony, instantly understandable in feed.',
      [SocialPlatform.FACEBOOK]:
        'Facebook specifics: friendly square or landscape educational visual, approachable human/lifestyle context when safe, broad-audience clarity, warm optimistic tone.',
      [SocialPlatform.LINKEDIN]:
        'LinkedIn specifics: credible professional editorial visual, research/strategy feel, clean workspace or abstract concept scene, muted premium palette, business-health education polish.',
      [SocialPlatform.X]:
        'X specifics: wide landscape preview image, high-contrast simple composition, one bold idea, very readable at small preview size, minimal detail.',
    }[platform];

    return `${base}\n${channel}`;
  }

  private async ensureDefaults(organizationId: string | null, userId?: string) {
    for (const [platform, template] of Object.entries(defaultPromptTemplates)) {
      const existing = await this.prisma.promptTemplate.findFirst({
        where: {
          organizationId,
          platform: platform as SocialPlatform,
          purpose: PROMPT_PURPOSE_IMAGE,
          active: true,
        },
        select: { id: true },
      });

      if (!existing) {
        await this.prisma.promptTemplate.create({
          data: {
            organizationId,
            platform: platform as SocialPlatform,
            purpose: PROMPT_PURPOSE_IMAGE,
            name: template.name,
            description: template.description,
            template: template.template,
            negativePrompt: template.negativePrompt,
            styleNotes: template.styleNotes,
            createdById: userId,
            updatedById: userId,
          },
        });
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
    return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => replacements[key] ?? '');
  }

  private topicVisualGuidance(article: PromptArticleContext): string {
    const topic = `${article.title} ${article.excerpt} ${article.contentText ?? ''} ${article.categoryNames.join(' ')}`.toLowerCase();

    if (/(peptide|semaglutide|tesamorelin|aod|fat loss|weight loss|metabolism|obesity)/i.test(topic)) {
      return [
        'Use abstract molecular structures, amino-acid chain motifs, microscope lens, clean lab glassware without labels, blank research notebook, healthy balanced plate, leaves, soft science-and-wellness symbols.',
        'Do not show weighing scales, stomach/body silhouettes, measuring tape, before-after imagery, injections, needles, syringes, vials, pills, drug packaging, doctors treating patients, medical procedures, or dramatic clinical scenes.',
        'Do not imply treatment results or body transformation.',
      ].join(' ');
    }

    if (/(parent|child|family|dad|mom|baby|toddler|school|foster)/i.test(topic)) {
      return [
        'Use warm family-safe illustration, books, toys, home routines, parent-child activity, gentle educational scenes, playful soft colors.',
        'Avoid distressed children, unsafe situations, medical scenes, or identifiable real people.',
      ].join(' ');
    }

    return 'Use symbolic editorial illustration based on the article theme, with clean objects, soft texture, and a useful educational content feel. Avoid generic stock-photo compositions and unrelated decorative elements.';
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}...` : value;
  }
}

function platformTitle(platform: SocialPlatform): string {
  return platform.charAt(0) + platform.slice(1).toLowerCase();
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
