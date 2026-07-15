import { createHash, createHmac, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  PublishJobStatus,
  PublishLogLevel,
  SocialChannelAuthType,
  SocialChannelStatus,
  SocialPlatform,
} from '@prisma/client';

import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateSocialChannelDto,
  OAuthCallbackDto,
  PublishToChannelDto,
  UpdateSocialChannelDto,
} from './social-channels.dto.js';

const supportedPlatforms = [
  {
    platform: SocialPlatform.FACEBOOK,
    label: 'Facebook Pages',
    authType: SocialChannelAuthType.OAUTH,
    requiredScopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    setupHint: 'Connect a Meta app and select one or more Facebook Pages.',
  },
  {
    platform: SocialPlatform.INSTAGRAM,
    label: 'Instagram Business',
    authType: SocialChannelAuthType.OAUTH,
    requiredScopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
    setupHint: 'Use an Instagram Business or Creator account connected to a Facebook Page.',
  },
  {
    platform: SocialPlatform.PINTEREST,
    label: 'Pinterest',
    authType: SocialChannelAuthType.OAUTH,
    requiredScopes: [
      'boards:read',
      'boards:write',
      'pins:read',
      'pins:write',
      'user_accounts:read',
    ],
    setupHint: 'Connect a Pinterest developer app and choose the board used for publishing.',
  },
  {
    platform: SocialPlatform.LINKEDIN,
    label: 'LinkedIn',
    authType: SocialChannelAuthType.OAUTH,
    requiredScopes: ['w_member_social', 'r_liteprofile'],
    setupHint: 'Connect a LinkedIn profile or organization page for publishing.',
  },
  {
    platform: SocialPlatform.X,
    label: 'X',
    authType: SocialChannelAuthType.OAUTH,
    requiredScopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    setupHint: 'Connect an X developer app with OAuth 2.0 user context.',
  },
] as const;

interface SocialChannelAccountRecord {
  id: string;
  organizationId: string | null;
  connectedById: string | null;
  platform: SocialPlatform;
  externalAccountId: string | null;
  accessTokenCiphertext: string | null;
  tokenExpiresAt: Date | null;
  authType: SocialChannelAuthType;
  status: SocialChannelStatus;
}

@Injectable()
export class SocialChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  supported() {
    return supportedPlatforms.map((platform) => ({
      ...platform,
      oauthConfigured: Boolean(this.providerConfig(platform.platform)),
    }));
  }

  oauthStart(platform: SocialPlatform, user: AuthenticatedUser) {
    const config = this.requireProviderConfig(platform);
    const verifier = randomBytes(32).toString('base64url');
    const state = this.signState({
      platform,
      userId: user.id,
      verifier,
      nonce: randomBytes(12).toString('hex'),
      createdAt: Date.now(),
    });
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(config.scopeSeparator),
      state,
    });

    if (config.pkce) {
      params.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'));
      params.set('code_challenge_method', 'S256');
    }

    if (platform === SocialPlatform.X) {
      params.set('response_type', 'code');
    }

    return {
      platform,
      authorizationUrl: `${config.authorizeUrl}?${params.toString()}`,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
    };
  }

  async oauthCallback(platform: SocialPlatform, dto: OAuthCallbackDto) {
    const config = this.requireProviderConfig(platform);
    const state = this.verifyState(dto.state);

    if (state.platform !== platform) {
      throw new BadRequestException('OAuth callback platform does not match the original request.');
    }

    const token = await this.exchangeCode(config, dto.code, state.verifier);
    const organizationId = await this.defaultOrganizationId(state.userId);
    const supported = supportedPlatforms.find((item) => item.platform === platform);
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : undefined;
    const facebookPage =
      platform === SocialPlatform.FACEBOOK && token.access_token
        ? await this.findFacebookPageCredential(token.access_token, process.env.FACEBOOK_PAGE_ID)
        : null;
    const accessToken = facebookPage?.accessToken ?? token.access_token;

    const account = await this.prisma.socialChannelAccount.create({
      data: {
        organizationId,
        connectedById: state.userId,
        platform,
        displayName: facebookPage?.name ?? `${supported?.label ?? platform} OAuth account`,
        handle: facebookPage?.id ?? token.screen_name ?? undefined,
        externalAccountId: facebookPage?.id ?? token.user_id ?? token.account_id ?? undefined,
        accountType: platformAccountType(platform),
        authType: SocialChannelAuthType.OAUTH,
        scopes:
          typeof token.scope === 'string'
            ? token.scope.split(/[,\s]+/).filter(Boolean)
            : config.scopes,
        accessTokenCiphertext: this.encodeSecret(accessToken),
        refreshTokenCiphertext: this.encodeSecret(
          platform === SocialPlatform.FACEBOOK ? token.access_token : token.refresh_token,
        ),
        tokenExpiresAt: expiresAt,
        status:
          token.access_token && (platform !== SocialPlatform.FACEBOOK || facebookPage)
            ? SocialChannelStatus.CONNECTED
            : SocialChannelStatus.ACTION_REQUIRED,
        lastHealthCheckAt: new Date(),
        lastError:
          platform === SocialPlatform.FACEBOOK && !facebookPage
            ? 'No Facebook Page access token was found. Add a Page ID and reconnect or run Check.'
            : null,
        metadata: {
          setupSource: 'oauth',
          tokenType: token.token_type,
          provider: platform,
          ...(facebookPage
            ? {
                facebookPageId: facebookPage.id,
                facebookPageName: facebookPage.name,
                facebookPageTasks: facebookPage.tasks,
              }
            : {}),
          note:
            platform === SocialPlatform.FACEBOOK
              ? 'Facebook publishing uses the selected Page access token.'
              : 'Set externalAccountId to the Page, board, organization, or IG business account ID required for publishing.',
        },
      },
    });

    return {
      connected: true,
      account,
      nextStep: nextStep(platform),
    };
  }

  async summary(user: AuthenticatedUser) {
    const where = await this.visibleWhere(user);
    const [total, connected, actionRequired, expired, byPlatform] = await Promise.all([
      this.prisma.socialChannelAccount.count({ where }),
      this.prisma.socialChannelAccount.count({
        where: { ...where, status: SocialChannelStatus.CONNECTED },
      }),
      this.prisma.socialChannelAccount.count({
        where: { ...where, status: SocialChannelStatus.ACTION_REQUIRED },
      }),
      this.prisma.socialChannelAccount.count({
        where: { ...where, status: SocialChannelStatus.EXPIRED },
      }),
      this.prisma.socialChannelAccount.groupBy({
        by: ['platform'],
        where,
        _count: { _all: true },
        orderBy: { platform: 'asc' },
      }),
    ]);

    return {
      total,
      connected,
      actionRequired,
      expired,
      byPlatform: byPlatform.map((item) => ({
        platform: item.platform,
        count: item._count._all,
      })),
    };
  }

  async list(user: AuthenticatedUser) {
    return this.prisma.socialChannelAccount.findMany({
      where: await this.visibleWhere(user),
      orderBy: [{ status: 'asc' }, { platform: 'asc' }, { updatedAt: 'desc' }],
      include: {
        connectedBy: {
          select: {
            email: true,
            displayName: true,
          },
        },
      },
    });
  }

  async create(dto: CreateSocialChannelDto, user: AuthenticatedUser) {
    const organizationId = await this.defaultOrganizationId(user.id);
    const now = new Date();

    return this.prisma.socialChannelAccount.create({
      data: {
        organizationId,
        connectedById: user.id,
        platform: dto.platform,
        displayName: dto.displayName.trim(),
        handle: this.optionalTrim(dto.handle),
        externalAccountId: this.optionalTrim(dto.externalAccountId),
        accountType: this.optionalTrim(dto.accountType),
        authType: dto.authType ?? SocialChannelAuthType.MANUAL,
        scopes: dto.scopes ?? [],
        accessTokenCiphertext: this.encodeSecret(dto.accessToken),
        refreshTokenCiphertext: this.encodeSecret(dto.refreshToken),
        tokenExpiresAt: dto.tokenExpiresAt ? new Date(dto.tokenExpiresAt) : undefined,
        status: this.resolveStatus(dto.accessToken, dto.tokenExpiresAt),
        lastHealthCheckAt: now,
        metadata: {
          setupSource: 'admin-panel',
          tokenConfigured: Boolean(dto.accessToken),
          refreshTokenConfigured: Boolean(dto.refreshToken),
        },
      },
    });
  }

  async update(id: string, dto: UpdateSocialChannelDto, user: AuthenticatedUser) {
    const account = await this.ensureVisible(id, user);

    const data: Prisma.SocialChannelAccountUpdateInput = {
      ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
      ...(dto.handle !== undefined ? { handle: this.optionalTrim(dto.handle) } : {}),
      ...(dto.externalAccountId !== undefined
        ? { externalAccountId: this.optionalTrim(dto.externalAccountId) }
        : {}),
      ...(dto.accountType !== undefined ? { accountType: this.optionalTrim(dto.accountType) } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.scopes !== undefined ? { scopes: dto.scopes } : {}),
      ...(dto.accessToken !== undefined
        ? { accessTokenCiphertext: this.encodeSecret(dto.accessToken) }
        : {}),
      ...(dto.refreshToken !== undefined
        ? { refreshTokenCiphertext: this.encodeSecret(dto.refreshToken) }
        : {}),
      ...(dto.tokenExpiresAt !== undefined ? { tokenExpiresAt: new Date(dto.tokenExpiresAt) } : {}),
    };

    if (account.platform === SocialPlatform.FACEBOOK && dto.externalAccountId !== undefined) {
      const accessToken =
        this.decodeSecret(account.refreshTokenCiphertext) ??
        this.decodeSecret(account.accessTokenCiphertext);
      const pageId = this.optionalTrim(dto.externalAccountId);
      const facebookPage =
        accessToken && pageId ? await this.findFacebookPageCredential(accessToken, pageId) : null;

      if (facebookPage) {
        data.accessTokenCiphertext = this.encodeSecret(facebookPage.accessToken);
        data.displayName = facebookPage.name;
        data.handle = facebookPage.id;
        data.externalAccountId = facebookPage.id;
        data.status = SocialChannelStatus.CONNECTED;
        data.lastError = null;
        data.lastHealthCheckAt = new Date();
        data.metadata = {
          setupSource: 'admin-panel',
          provider: SocialPlatform.FACEBOOK,
          facebookPageId: facebookPage.id,
          facebookPageName: facebookPage.name,
          facebookPageTasks: facebookPage.tasks,
          note: 'Facebook publishing uses the selected Page access token.',
        };
      }
    }

    return this.prisma.socialChannelAccount.update({
      where: { id },
      data,
    });
  }

  async healthCheck(id: string, user: AuthenticatedUser) {
    const account = await this.ensureVisible(id, user);
    const expired = account.tokenExpiresAt ? account.tokenExpiresAt.getTime() < Date.now() : false;
    const hasToken = Boolean(account.accessTokenCiphertext);

    const data: Prisma.SocialChannelAccountUpdateInput = {
      lastHealthCheckAt: new Date(),
      status: expired
        ? SocialChannelStatus.EXPIRED
        : hasToken || account.authType === SocialChannelAuthType.OAUTH
          ? SocialChannelStatus.CONNECTED
          : SocialChannelStatus.ACTION_REQUIRED,
      lastError: expired ? 'Access token has expired. Reconnect this channel.' : null,
    };

    if (
      !expired &&
      hasToken &&
      account.platform === SocialPlatform.FACEBOOK &&
      account.externalAccountId
    ) {
      const accessToken =
        this.decodeSecret(account.refreshTokenCiphertext) ??
        this.decodeSecret(account.accessTokenCiphertext);
      const facebookPage = accessToken
        ? await this.findFacebookPageCredential(accessToken, account.externalAccountId)
        : null;

      if (facebookPage) {
        data.accessTokenCiphertext = this.encodeSecret(facebookPage.accessToken);
        data.displayName = facebookPage.name;
        data.handle = facebookPage.id;
        data.externalAccountId = facebookPage.id;
        data.status = SocialChannelStatus.CONNECTED;
        data.lastError = null;
        data.metadata = {
          setupSource: 'health-check',
          provider: SocialPlatform.FACEBOOK,
          facebookPageId: facebookPage.id,
          facebookPageName: facebookPage.name,
          facebookPageTasks: facebookPage.tasks,
          note: 'Facebook publishing uses the selected Page access token.',
        };
      }
    }

    return this.prisma.socialChannelAccount.update({
      where: { id },
      data,
    });
  }

  async publish(id: string, dto: PublishToChannelDto, user: AuthenticatedUser) {
    const account = await this.ensureVisible(id, user);
    const accessToken = this.decodeSecret(account.accessTokenCiphertext);
    const publishDto = await this.hydratePublishPayload(dto, account.platform);

    if (!accessToken) {
      throw new BadRequestException(
        'This channel has no access token. Connect it with OAuth or manual token setup.',
      );
    }

    if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() < Date.now()) {
      await this.prisma.socialChannelAccount.update({
        where: { id },
        data: {
          status: SocialChannelStatus.EXPIRED,
          lastError: 'Access token has expired. Reconnect this channel.',
        },
      });
      throw new BadRequestException('Access token has expired. Reconnect this channel.');
    }

    const organizationId = account.organizationId ?? (await this.defaultOrganizationId(user.id));

    if (!organizationId) {
      throw new UnprocessableEntityException('User is not assigned to an organization.');
    }

    const job = await this.prisma.publishJob.create({
      data: {
        organizationId,
        userId: user.id,
        platform: account.platform,
        platformAccount: account.displayName,
        title: publishDto.title,
        caption: publishDto.caption,
        hashtags: publishDto.hashtags ?? [],
        status: PublishJobStatus.PROCESSING,
        metadata: {
          channelAccountId: account.id,
          draftId: publishDto.draftId,
          mediaUrl: publishDto.mediaUrl,
          sourceUrl: publishDto.sourceUrl,
        },
      },
    });

    try {
      const result = await this.publishToProvider(account, accessToken, publishDto);
      const updatedJob = await this.prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: PublishJobStatus.PUBLISHED,
          publishedAt: new Date(),
          postUrl: result.postUrl,
          attempts: { increment: 1 },
          metadata: {
            channelAccountId: account.id,
            draftId: publishDto.draftId,
            mediaUrl: publishDto.mediaUrl,
            sourceUrl: publishDto.sourceUrl,
            providerResponse: result.providerResponse as Prisma.InputJsonValue,
          },
          logs: {
            create: {
              level: PublishLogLevel.INFO,
              message: `Published to ${account.platform}.`,
              metadata: result.providerResponse as Prisma.InputJsonValue,
            },
          },
        },
      });

      await this.prisma.socialChannelAccount.update({
        where: { id: account.id },
        data: {
          status: SocialChannelStatus.CONNECTED,
          lastError: null,
          lastHealthCheckAt: new Date(),
        },
      });

      return { published: true, job: updatedJob, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Publishing failed.';
      const failedJob = await this.prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: PublishJobStatus.FAILED,
          attempts: { increment: 1 },
          lastError: message,
          logs: {
            create: {
              level: PublishLogLevel.ERROR,
              message,
            },
          },
        },
      });
      await this.prisma.socialChannelAccount.update({
        where: { id: account.id },
        data: {
          status: SocialChannelStatus.ACTION_REQUIRED,
          lastError: message,
          lastHealthCheckAt: new Date(),
        },
      });

      return { published: false, job: failedJob, error: message };
    }
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.ensureVisible(id, user);
    await this.prisma.socialChannelAccount.delete({ where: { id } });
    return { deleted: true };
  }

  private async hydratePublishPayload(
    dto: PublishToChannelDto,
    platform: SocialPlatform,
  ): Promise<PublishToChannelDto> {
    if ((dto.mediaUrl && dto.sourceUrl) || !dto.draftId) {
      return dto;
    }

    const draft = await this.prisma.socialDraft.findUnique({
      where: { id: dto.draftId },
      select: { mediaUrl: true, platform: true, sourceUrl: true },
    });

    if (draft?.platform !== platform) {
      return dto;
    }

    return {
      draftId: dto.draftId,
      title: dto.title,
      caption: dto.caption,
      hashtags: dto.hashtags,
      mediaUrl: dto.mediaUrl ?? draft.mediaUrl ?? undefined,
      sourceUrl: dto.sourceUrl ?? draft.sourceUrl,
    };
  }

  private async findFacebookPageCredential(
    userAccessToken: string,
    requestedPageId?: string | null,
  ): Promise<FacebookPageCredential | null> {
    const pageId = requestedPageId?.trim();

    try {
      const payload = await this.providerJson<FacebookAccountsResponse>(
        await fetch(
          `https://graph.facebook.com/v20.0/me/accounts?${new URLSearchParams({
            fields: 'id,name,access_token,tasks',
            access_token: userAccessToken,
          }).toString()}`,
        ),
        'Unable to load Facebook Pages for this account.',
      );
      const pages = payload.data ?? [];
      const page = pageId ? pages.find((item) => item.id === pageId) : pages[0];

      if (!page?.id || !page.name || !page.access_token) {
        if (pageId) {
          throw new BadRequestException(
            `Facebook Page ${pageId} was not returned by /me/accounts. Reconnect Facebook and make sure this Page is selected with pages_read_engagement and pages_manage_posts.`,
          );
        }
        return null;
      }

      return {
        id: page.id,
        name: page.name,
        accessToken: page.access_token,
        tasks: page.tasks ?? [],
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      return null;
    }
  }

  private async exchangeCode(
    config: ProviderConfig,
    code: string,
    verifier: string,
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
    });

    if (config.pkce) {
      body.set('code_verifier', verifier);
    }

    if (config.clientSecret && !config.basicAuthToken) {
      body.set('client_secret', config.clientSecret);
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(config.basicAuthToken ? { Authorization: `Basic ${config.basicAuthToken}` } : {}),
      },
      body,
    });

    return this.providerJson<TokenResponse>(response, 'OAuth token exchange failed.');
  }

  private async publishToProvider(
    account: SocialChannelAccountRecord,
    accessToken: string,
    dto: PublishToChannelDto,
  ): Promise<{ postUrl: string | null; providerResponse: unknown }> {
    const caption = withHashtags(dto.caption, dto.hashtags);

    switch (account.platform) {
      case SocialPlatform.X: {
        const payload = await this.providerJson<Record<string, unknown>>(
          await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: caption }),
          }),
          'X publish failed.',
        );
        const id = nestedString(payload, ['data', 'id']);
        return {
          postUrl: id ? `https://x.com/i/web/status/${id}` : null,
          providerResponse: payload,
        };
      }

      case SocialPlatform.LINKEDIN: {
        const author = requiredExternalId(account.externalAccountId, 'LinkedIn author URN');
        const payload = await this.providerJson<Record<string, unknown>>(
          await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify({
              author,
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text: caption },
                  shareMediaCategory: 'NONE',
                },
              },
              visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
            }),
          }),
          'LinkedIn publish failed.',
        );
        return { postUrl: null, providerResponse: payload };
      }

      case SocialPlatform.PINTEREST: {
        const boardId = requiredExternalId(account.externalAccountId, 'Pinterest board ID');
        const payload = await this.providerJson<Record<string, unknown>>(
          await fetch('https://api.pinterest.com/v5/pins', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              board_id: boardId,
              title: dto.title,
              description: caption,
              ...(dto.mediaUrl
                ? {
                    media_source: {
                      source_type: 'image_url',
                      url: dto.mediaUrl,
                    },
                  }
                : {}),
            }),
          }),
          'Pinterest publish failed.',
        );
        const id = stringValue(payload.id);
        return {
          postUrl: id ? `https://www.pinterest.com/pin/${id}/` : null,
          providerResponse: payload,
        };
      }

      case SocialPlatform.FACEBOOK: {
        const pageId = requiredExternalId(account.externalAccountId, 'Facebook Page ID');
        const facebookMedia = facebookMediaUpload(dto.mediaUrl);
        const endpoint =
          dto.mediaUrl || facebookMedia
            ? `https://graph.facebook.com/v20.0/${pageId}/photos`
            : `https://graph.facebook.com/v20.0/${pageId}/feed`;
        const body =
          facebookMedia ??
          new URLSearchParams({
            access_token: accessToken,
            ...(dto.mediaUrl ? { url: dto.mediaUrl, caption } : { message: caption }),
          });

        if (facebookMedia) {
          facebookMedia.set('access_token', accessToken);
          facebookMedia.set('caption', caption);
        }

        const payload = await this.providerJson<Record<string, unknown>>(
          await fetch(endpoint, { method: 'POST', body }),
          'Facebook publish failed.',
        );
        const id = stringValue(payload.post_id) ?? stringValue(payload.id);
        const comment = id
          ? await this.commentOnFacebookPost(id, accessToken, dto.sourceUrl)
          : null;

        return {
          postUrl: id ? `https://www.facebook.com/${id}` : null,
          providerResponse: {
            ...payload,
            ...(comment ? { firstComment: comment } : {}),
          },
        };
      }

      case SocialPlatform.INSTAGRAM: {
        const instagramBusinessId = requiredExternalId(
          account.externalAccountId,
          'Instagram Business account ID',
        );

        if (!dto.mediaUrl) {
          throw new BadRequestException('Instagram publishing requires a public image URL.');
        }

        const createPayload = await this.providerJson<Record<string, unknown>>(
          await fetch(`https://graph.facebook.com/v20.0/${instagramBusinessId}/media`, {
            method: 'POST',
            body: new URLSearchParams({
              access_token: accessToken,
              image_url: dto.mediaUrl,
              caption,
            }),
          }),
          'Instagram media container creation failed.',
        );
        const creationId = stringValue(createPayload.id);

        if (!creationId) {
          throw new BadRequestException('Instagram did not return a media container ID.');
        }

        const publishPayload = await this.providerJson<Record<string, unknown>>(
          await fetch(`https://graph.facebook.com/v20.0/${instagramBusinessId}/media_publish`, {
            method: 'POST',
            body: new URLSearchParams({
              access_token: accessToken,
              creation_id: creationId,
            }),
          }),
          'Instagram publish failed.',
        );
        const id = stringValue(publishPayload.id);
        return {
          postUrl: id ? `https://www.instagram.com/p/${id}/` : null,
          providerResponse: publishPayload,
        };
      }
    }
  }

  private async commentOnFacebookPost(
    postId: string,
    accessToken: string,
    sourceUrl?: string,
  ): Promise<Record<string, unknown> | null> {
    const cleanUrl = sourceUrl?.trim();

    if (!cleanUrl) {
      return null;
    }

    try {
      const payload = await this.providerJson<Record<string, unknown>>(
        await fetch(`https://graph.facebook.com/v20.0/${postId}/comments`, {
          method: 'POST',
          body: new URLSearchParams({
            access_token: accessToken,
            message: `Read more: ${cleanUrl}`,
          }),
        }),
        'Facebook first comment failed.',
      );

      return {
        status: 'posted',
        id: stringValue(payload.id),
        sourceUrl: cleanUrl,
      };
    } catch (error) {
      return {
        status: 'failed',
        sourceUrl: cleanUrl,
        error: error instanceof Error ? error.message : 'Facebook first comment failed.',
      };
    }
  }

  private async providerJson<T>(response: Response, fallback: string): Promise<T> {
    const text = await response.text();
    const payload = parseJson(text);

    if (!response.ok) {
      throw new BadRequestException(providerErrorMessage(payload, text, fallback));
    }

    return payload as T;
  }

  private requireProviderConfig(platform: SocialPlatform): ProviderConfig {
    const config = this.providerConfig(platform);

    if (!config) {
      throw new BadRequestException(
        `OAuth is not configured for ${platform}. Add provider client ID/secret env values.`,
      );
    }

    return config;
  }

  private providerConfig(platform: SocialPlatform): ProviderConfig | null {
    return providerConfig(platform);
  }

  private signState(payload: OAuthStatePayload): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', this.stateSecret()).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  private verifyState(state: string): OAuthStatePayload {
    const [body, signature] = state.split('.');
    const expected = body
      ? createHmac('sha256', this.stateSecret()).update(body).digest('base64url')
      : '';

    if (!body || !signature || signature !== expected) {
      throw new BadRequestException('Invalid OAuth state.');
    }

    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as OAuthStatePayload;

    if (Date.now() - payload.createdAt > 10 * 60 * 1000) {
      throw new BadRequestException('OAuth state expired. Start the connection again.');
    }

    return payload;
  }

  private stateSecret(): string {
    return (
      process.env.JWT_ACCESS_SECRET ??
      process.env.JWT_REFRESH_SECRET ??
      'socialflow-local-oauth-state'
    );
  }

  private async ensureVisible(id: string, user: AuthenticatedUser) {
    const account = await this.prisma.socialChannelAccount.findFirst({
      where: {
        id,
        ...(await this.visibleWhere(user)),
      },
    });

    if (!account) {
      throw new NotFoundException('Social channel account was not found.');
    }

    return account;
  }

  private async visibleWhere(
    user: AuthenticatedUser,
  ): Promise<Prisma.SocialChannelAccountWhereInput> {
    const organizationId = await this.defaultOrganizationId(user.id);
    return organizationId
      ? {
          OR: [{ organizationId }, { connectedById: user.id }],
        }
      : { connectedById: user.id };
  }

  private async defaultOrganizationId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultOrganizationId: true },
    });
    return user?.defaultOrganizationId ?? null;
  }

  private resolveStatus(accessToken?: string, tokenExpiresAt?: string): SocialChannelStatus {
    if (tokenExpiresAt && new Date(tokenExpiresAt).getTime() < Date.now()) {
      return SocialChannelStatus.EXPIRED;
    }

    return accessToken ? SocialChannelStatus.CONNECTED : SocialChannelStatus.ACTION_REQUIRED;
  }

  private encodeSecret(secret?: string): string | undefined {
    const clean = secret?.trim();
    return clean ? Buffer.from(clean, 'utf8').toString('base64') : undefined;
  }

  private decodeSecret(secret?: string | null): string | null {
    const clean = secret?.trim();
    return clean ? Buffer.from(clean, 'base64').toString('utf8') : null;
  }

  private optionalTrim(value?: string): string | undefined {
    const clean = value?.trim();
    if (!clean) {
      return undefined;
    }

    return clean;
  }
}

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  scopeSeparator: string;
  pkce: boolean;
  basicAuthToken?: string;
}

interface OAuthStatePayload {
  platform: SocialPlatform;
  userId: string;
  verifier: string;
  nonce: string;
  createdAt: number;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  screen_name?: string;
  user_id?: string;
  account_id?: string;
}

interface FacebookPageCredential {
  id: string;
  name: string;
  accessToken: string;
  tasks: string[];
}

interface FacebookAccountsResponse {
  data?: {
    access_token?: string;
    id?: string;
    name?: string;
    tasks?: string[];
  }[];
}

function providerConfig(platform: SocialPlatform): ProviderConfig | null {
  const apiBaseUrl =
    process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.API_PORT ?? '4000'}`;
  const redirectUri =
    process.env[`${platform}_REDIRECT_URI`] ??
    `${apiBaseUrl}/api/social-channels/oauth/${platform}/callback`;
  const supported = supportedPlatforms.find((item) => item.platform === platform);

  if (!supported) {
    return null;
  }

  if (platform === SocialPlatform.FACEBOOK || platform === SocialPlatform.INSTAGRAM) {
    const clientId = process.env.META_CLIENT_ID ?? process.env.FACEBOOK_CLIENT_ID;
    const clientSecret = process.env.META_CLIENT_SECRET ?? process.env.FACEBOOK_CLIENT_SECRET;
    return clientId && clientSecret
      ? {
          authorizeUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
          tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
          clientId,
          clientSecret,
          redirectUri,
          scopes: [...supported.requiredScopes],
          scopeSeparator: ',',
          pkce: false,
        }
      : null;
  }

  if (platform === SocialPlatform.PINTEREST) {
    const clientId = process.env.PINTEREST_CLIENT_ID;
    const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
    return clientId && clientSecret
      ? {
          authorizeUrl: 'https://www.pinterest.com/oauth/',
          tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
          clientId,
          clientSecret,
          redirectUri: process.env.PINTEREST_REDIRECT_URI ?? redirectUri,
          scopes: [...supported.requiredScopes],
          scopeSeparator: ',',
          pkce: false,
          basicAuthToken: Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        }
      : null;
  }

  if (platform === SocialPlatform.LINKEDIN) {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    return clientId && clientSecret
      ? {
          authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
          tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
          clientId,
          clientSecret,
          redirectUri,
          scopes: [...supported.requiredScopes],
          scopeSeparator: ' ',
          pkce: false,
        }
      : null;
  }

  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  return clientId
    ? {
        authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        clientId,
        clientSecret,
        redirectUri,
        scopes: [...supported.requiredScopes],
        scopeSeparator: ' ',
        pkce: true,
        basicAuthToken: clientSecret
          ? Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
          : undefined,
      }
    : null;
}

function platformAccountType(platform: SocialPlatform): string {
  const types: Record<SocialPlatform, string> = {
    [SocialPlatform.FACEBOOK]: 'Page',
    [SocialPlatform.INSTAGRAM]: 'Business',
    [SocialPlatform.PINTEREST]: 'Board',
    [SocialPlatform.LINKEDIN]: 'Profile or Organization',
    [SocialPlatform.X]: 'User',
  };

  return types[platform];
}

function withHashtags(caption: string, hashtags?: string[]): string {
  const cleanTags = hashtags?.map((tag) => tag.trim()).filter(Boolean) ?? [];

  if (!cleanTags.length) {
    return caption;
  }

  return `${caption.trim()}\n\n${cleanTags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ')}`;
}

function requiredExternalId(value: string | null, label: string): string {
  const clean = value?.trim();

  if (!clean) {
    throw new BadRequestException(
      `${label} is required. Add it as the channel Account ID in Admin > Channels.`,
    );
  }

  return clean;
}

function facebookMediaUpload(mediaUrl?: string): FormData | null {
  const parsed = parseImageDataUrl(mediaUrl);

  if (!parsed) {
    return null;
  }

  const body = new FormData();
  const extension = parsed.mimeType === 'image/png' ? 'png' : 'jpg';
  body.set(
    'source',
    new Blob([parsed.bytes], { type: parsed.mimeType }),
    `socialflow-post.${extension}`,
  );
  return body;
}

function parseImageDataUrl(value?: string): { bytes: ArrayBuffer; mimeType: string } | null {
  if (!value?.startsWith('data:image/')) {
    return null;
  }

  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(value);

  if (!match?.[1] || !match[2]) {
    throw new BadRequestException('Generated image is not a valid publishable data URL.');
  }

  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const bytes = Buffer.from(match[2], 'base64');

  if (!bytes.length) {
    throw new BadRequestException('Generated image is empty.');
  }

  const arrayBuffer = new ArrayBuffer(bytes.length);
  new Uint8Array(arrayBuffer).set(bytes);

  return { bytes: arrayBuffer, mimeType };
}

function parseJson(value: string): unknown {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return { raw: value };
  }
}

function providerErrorMessage(payload: unknown, raw: string, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const error = record.error;

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === 'string') {
        return message;
      }
    }

    const message = record.message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return raw || fallback;
}

function nestedString(payload: Record<string, unknown>, path: string[]): string | null {
  let current: unknown = payload;

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return stringValue(current);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function nextStep(platform: SocialPlatform): string {
  const steps: Record<SocialPlatform, string> = {
    [SocialPlatform.FACEBOOK]:
      'Set Account ID to the Facebook Page ID and use a Page access token with pages_manage_posts.',
    [SocialPlatform.INSTAGRAM]:
      'Set Account ID to the Instagram Business account ID connected to your Facebook Page.',
    [SocialPlatform.PINTEREST]:
      'Set Account ID to the Pinterest board ID used for publishing pins.',
    [SocialPlatform.LINKEDIN]:
      'Set Account ID to the LinkedIn author URN, such as urn:li:person:... or urn:li:organization:...',
    [SocialPlatform.X]:
      'No account ID is required for basic text publishing. Media upload support can be added after X app approval.',
  };

  return steps[platform];
}
