import { Injectable } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';

import type { SocialDraftInput } from '../infrastructure/wordpress.repository.js';

interface ArticleForGeneration {
  id: string;
  title: string;
  excerpt: string;
  contentText: string | null;
  url: string;
  featuredImageUrl: string | null;
  categoryNames: string[];
}

@Injectable()
export class SocialContentGeneratorService {
  generate(
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
        mediaUrl: article.featuredImageUrl ?? undefined,
        sourceUrl: article.url,
      };
    });
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

  private truncate(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 1).trim()}...`;
  }
}
