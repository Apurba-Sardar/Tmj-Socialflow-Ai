'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckSquare,
  Clock3,
  FileCheck2,
  FileText,
  History,
  Image,
  Loader2,
  Moon,
  Send,
  Sparkles,
  Square,
  Sun,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AuthenticatedUser } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

type DetailTab =
  | 'Overview'
  | 'Generated Content'
  | 'Media Assets'
  | 'Publishing History'
  | 'AI History'
  | 'Analytics';

interface WordPressCampaignGeneration {
  id: string;
  platform: string;
  caption: string;
  hashtags: string[];
  imageUrl: string | null;
  prompt: string | null;
  promptVersion: string;
  aiModel: string;
  version: number;
  generatedAt: string;
}

interface WordPressPublishingHistory {
  id: string;
  platform: string;
  platformAccount: string;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  postUrl: string | null;
  errorLog: string | null;
  createdAt: string;
}

interface WordPressRegenerationHistory {
  id: string;
  version: number;
  prompt: string | null;
  promptVersion: string;
  aiModel: string;
  reason: string | null;
  generatedAt: string;
}

interface WordPressCampaignAnalytics {
  id: string;
  platform: string | null;
  impressions: number;
  clicks: number;
  saves: number;
  comments: number;
  shares: number;
  capturedAt: string;
}

interface GoogleAnalyticsPostMetric {
  articleId: string;
  pageViews: number;
  activeUsers: number;
  sessions: number;
  eventCount: number;
  averageSessionDuration: number;
}

interface WordPressCampaign {
  id: string;
  name: string;
  status: string;
  promptVersion: string;
  aiModel: string;
  createdAt: string;
  updatedAt: string;
  generations: WordPressCampaignGeneration[];
  publishingHistory: WordPressPublishingHistory[];
  regenerationHistory: WordPressRegenerationHistory[];
  analytics: WordPressCampaignAnalytics[];
}

interface WordPressDetailArticle {
  id: string;
  wordpressId: number;
  title: string;
  excerpt: string;
  contentText: string | null;
  url: string;
  authorName: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  categoryNames: string[];
  tagNames: string[];
  publishedAt: string | null;
  modifiedAt: string | null;
  repurposedAt: string | null;
  connection: {
    siteUrl: string;
    username: string;
  };
  campaigns: WordPressCampaign[];
  socialDrafts: {
    id: string;
    platform: string;
    status: 'DRAFT' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'REJECTED';
    title: string;
    body: string;
    hashtags: string[];
    mediaUrl: string | null;
    scheduledFor?: string | null;
    createdAt: string;
  }[];
}

type WordPressSocialDraft = WordPressDetailArticle['socialDrafts'][number];

interface SocialChannelAccount {
  id: string;
  platform: string;
  displayName: string;
  status: 'CONNECTED' | 'ACTION_REQUIRED' | 'DISCONNECTED' | 'EXPIRED';
  externalAccountId: string | null;
}

const tabs: { label: DetailTab; icon: typeof FileText }[] = [
  { label: 'Overview', icon: FileText },
  { label: 'Generated Content', icon: Sparkles },
  { label: 'Media Assets', icon: Image },
  { label: 'Publishing History', icon: Send },
  { label: 'AI History', icon: History },
  { label: 'Analytics', icon: BarChart3 },
];

export function WordPressPostDetail({ articleId }: { articleId: string; user: AuthenticatedUser }) {
  const apiBaseUrl = getApiBaseUrl();
  const [article, setArticle] = useState<WordPressDetailArticle | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('Overview');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [googleAnalytics, setGoogleAnalytics] = useState<GoogleAnalyticsPostMetric | null>(null);
  const [googleAnalyticsLoading, setGoogleAnalyticsLoading] = useState(false);
  const [googleAnalyticsError, setGoogleAnalyticsError] = useState<string | null>(null);
  const [channels, setChannels] = useState<SocialChannelAccount[]>([]);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
    void loadArticle();
    void loadChannels();
  }, [articleId]);

  async function loadArticle() {
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/wordpress/hub/posts/${articleId}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Unable to load WordPress post.');
      }
      const payload = (await response.json()) as WordPressDetailArticle;
      setArticle(payload);
      setSelectedDraftIds((ids) =>
        ids.filter((id) => payload.socialDrafts.some((draft) => draft.id === id)),
      );
      void loadGoogleAnalytics();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load WordPress post.');
    } finally {
      setLoading(false);
    }
  }

  async function loadGoogleAnalytics() {
    setGoogleAnalyticsLoading(true);
    setGoogleAnalyticsError(null);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/google-analytics/wordpress-posts/${articleId}`,
        {
          cache: 'no-store',
          credentials: 'include',
        },
      );
      if (!response.ok) {
        throw new Error(await apiErrorMessage(response, 'Google Analytics data is not available.'));
      }
      const payload = (await response.json()) as GoogleAnalyticsPostMetric[];
      setGoogleAnalytics(payload[0] ?? null);
    } catch (error) {
      setGoogleAnalyticsError(
        error instanceof Error ? error.message : 'Google Analytics data is not available.',
      );
      setGoogleAnalytics(null);
    } finally {
      setGoogleAnalyticsLoading(false);
    }
  }

  async function loadChannels() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/social-channels`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (response.ok) {
        setChannels((await response.json()) as SocialChannelAccount[]);
      }
    } catch {
      setChannels([]);
    }
  }

  async function generateCampaign() {
    setGenerating(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/wordpress/hub/posts/${articleId}/generate-campaign`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignName: article ? `${article.title} Social Campaign` : undefined,
            promptVersion: 'wordpress-hub-v1',
            platforms: ['PINTEREST', 'INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X'],
          }),
        },
      );
      if (!response.ok) {
        throw new Error('Campaign generation failed.');
      }
      setMessage('AI campaign generated.');
      await loadArticle();
      setActiveTab('Generated Content');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to generate campaign.');
    } finally {
      setGenerating(false);
    }
  }

  async function approveDrafts(drafts: WordPressSocialDraft[]) {
    const approvableDrafts = drafts.filter((draft) => draft.status === 'DRAFT');

    if (!approvableDrafts.length) {
      setMessage('Selected drafts are already approved or scheduled.');
      return;
    }

    setBusyDraftId(
      approvableDrafts.length === 1 ? (approvableDrafts[0]?.id ?? 'approve') : 'approve-selected',
    );
    try {
      await Promise.all(
        approvableDrafts.map(async (draft) => {
          const response = await fetch(`${apiBaseUrl}/api/wordpress/drafts/${draft.id}/approve`, {
            method: 'PATCH',
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error(`Unable to approve ${titleCase(draft.platform)} draft.`);
          }
        }),
      );

      setMessage(approvableDrafts.length === 1 ? 'Draft approved.' : 'Selected drafts approved.');
      await loadArticle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to approve drafts.');
    } finally {
      setBusyDraftId(null);
    }
  }

  async function scheduleDraft(draft: WordPressSocialDraft) {
    setBusyDraftId(draft.id);
    try {
      const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch(`${apiBaseUrl}/api/wordpress/drafts/${draft.id}/schedule`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor }),
      });

      if (!response.ok) {
        throw new Error('Unable to schedule draft.');
      }

      setMessage('Draft scheduled for tomorrow.');
      await loadArticle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to schedule draft.');
    } finally {
      setBusyDraftId(null);
    }
  }

  async function publishDraftNow(draft: WordPressSocialDraft) {
    const channel = channels.find(
      (item) => item.platform === draft.platform && item.status === 'CONNECTED',
    );

    if (!channel) {
      setMessage(`Connect an active ${titleCase(draft.platform)} channel before posting.`);
      return;
    }

    setBusyDraftId(draft.id);
    try {
      const mediaUrl = safePublishMediaUrl(draft.mediaUrl);
      const skippedMedia = Boolean(draft.mediaUrl && !mediaUrl);
      const response = await fetch(`${apiBaseUrl}/api/social-channels/${channel.id}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          caption: draft.body,
          hashtags: draft.hashtags,
          ...(mediaUrl ? { mediaUrl } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        published?: boolean;
        error?: string;
      } | null;

      if (!response.ok || payload?.published === false) {
        throw new Error(payload?.error ?? 'Unable to publish draft.');
      }

      setMessage(
        `${titleCase(draft.platform)} post published now${
          skippedMedia ? ' without image because the image is not hosted as a public URL yet.' : '.'
        }`,
      );
      await loadArticle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to publish draft.');
    } finally {
      setBusyDraftId(null);
    }
  }

  async function deleteDraft(draft: WordPressSocialDraft) {
    setBusyDraftId(draft.id);
    try {
      const response = await fetch(`${apiBaseUrl}/api/wordpress/drafts/${draft.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Unable to delete draft.');
      }

      setMessage('Draft deleted.');
      setSelectedDraftIds((ids) => ids.filter((id) => id !== draft.id));
      await loadArticle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete draft.');
    } finally {
      setBusyDraftId(null);
    }
  }

  function toggleTheme() {
    const current = darkMode ?? document.documentElement.classList.contains('dark');
    const next = !current;
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem('socialflow-theme', next ? 'dark' : 'light');
    setDarkMode(next);
  }

  const campaigns = article?.campaigns ?? [];
  const generations = campaigns.flatMap((campaign) => campaign.generations);
  const socialDrafts = article?.socialDrafts ?? [];
  const publishingHistory = campaigns.flatMap((campaign) => campaign.publishingHistory);
  const regenerationHistory = campaigns.flatMap((campaign) => campaign.regenerationHistory);
  const analytics = campaigns.flatMap((campaign) => campaign.analytics);

  return (
    <div className="sf-app-bg min-h-screen text-foreground transition-colors">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/78 backdrop-blur-2xl dark:border-white/10">
        <div className="mx-auto flex max-w-[92rem] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Button asChild size="sm" variant="ghost">
            <Link href="/wordpress-hub">
              <ArrowLeft className="h-4 w-4" />
              Hub
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">WordPress post detail</div>
            <div className="truncate text-xs text-muted-foreground">
              {article?.connection.siteUrl ?? 'Loading source'}
            </div>
          </div>
          <Button aria-label="Toggle theme" onClick={toggleTheme} size="sm" variant="outline">
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            disabled={generating}
            onClick={() => {
              void generateCampaign();
            }}
            size="sm"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate AI Campaign
          </Button>
        </div>
      </header>

      <main className="sf-page-enter mx-auto flex w-full max-w-[92rem] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {message ? (
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-700 shadow-2xl backdrop-blur dark:text-sky-200">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="sf-card flex min-h-96 items-center justify-center rounded-xl border border-border bg-card dark:border-white/10">
            <div className="text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Loading WordPress post
            </div>
          </div>
        ) : article ? (
          <>
            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">WP #{article.wordpressId}</Badge>
                  <Badge variant={article.repurposedAt ? 'success' : 'outline'}>
                    {article.repurposedAt ? 'Campaign generated' : 'Not generated'}
                  </Badge>
                  <Badge variant="outline">{article.authorName ?? 'Unknown author'}</Badge>
                </div>
                <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">
                  {article.title}
                </h1>
                <p className="max-w-4xl text-sm text-muted-foreground">{article.excerpt}</p>
              </div>
              <div className="sf-card grid grid-cols-3 gap-2 rounded-xl border border-border bg-card/80 p-2 dark:border-white/10">
                <DetailStat label="Campaigns" value={String(campaigns.length)} />
                <DetailStat label="Drafts" value={String(article.socialDrafts.length)} />
                <DetailStat label="Versions" value={String(regenerationHistory.length)} />
              </div>
            </section>

            <div className="flex gap-2 overflow-x-auto border-b border-border pb-2 dark:border-white/10">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                      activeTab === tab.label
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    key={tab.label}
                    onClick={() => {
                      setActiveTab(tab.label);
                    }}
                    type="button"
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'Overview' ? <OverviewTab article={article} /> : null}
            {activeTab === 'Generated Content' ? (
              <GeneratedContentTab
                busyDraftId={busyDraftId}
                drafts={socialDrafts}
                selectedDraftIds={selectedDraftIds}
                onApproveAll={() => {
                  void approveDrafts(socialDrafts);
                }}
                onApproveDraft={(draft) => {
                  void approveDrafts([draft]);
                }}
                onApproveSelected={() => {
                  void approveDrafts(
                    socialDrafts.filter((draft) => selectedDraftIds.includes(draft.id)),
                  );
                }}
                onDeleteDraft={(draft) => {
                  void deleteDraft(draft);
                }}
                onPublishNow={(draft) => {
                  void publishDraftNow(draft);
                }}
                onScheduleDraft={(draft) => {
                  void scheduleDraft(draft);
                }}
                onToggleDraft={(draftId) => {
                  setSelectedDraftIds((ids) =>
                    ids.includes(draftId) ? ids.filter((id) => id !== draftId) : [...ids, draftId],
                  );
                }}
                onToggleAll={() => {
                  setSelectedDraftIds((ids) =>
                    ids.length === socialDrafts.length ? [] : socialDrafts.map((draft) => draft.id),
                  );
                }}
              />
            ) : null}
            {activeTab === 'Media Assets' ? (
              <MediaAssetsTab article={article} drafts={socialDrafts} generations={generations} />
            ) : null}
            {activeTab === 'Publishing History' ? (
              <PublishingHistoryTab items={publishingHistory} />
            ) : null}
            {activeTab === 'AI History' ? <AiHistoryTab items={regenerationHistory} /> : null}
            {activeTab === 'Analytics' ? (
              <AnalyticsTab
                googleAnalytics={googleAnalytics}
                googleAnalyticsError={googleAnalyticsError}
                googleAnalyticsLoading={googleAnalyticsLoading}
                items={analytics}
              />
            ) : null}
          </>
        ) : (
          <div className="sf-card rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground dark:border-white/10">
            WordPress post was not found.
          </div>
        )}
      </main>
    </div>
  );
}

function OverviewTab({ article }: { article: WordPressDetailArticle }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="border-border/80 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">Source article</CardTitle>
          <CardDescription>Canonical WordPress record.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <InfoRow label="Site" value={article.connection.siteUrl} />
          <InfoRow label="Author" value={article.authorName ?? 'Unknown'} />
          <InfoRow label="Published" value={formatDate(article.publishedAt)} />
          <InfoRow label="Modified" value={formatDate(article.modifiedAt)} />
          <Button asChild className="mt-2" variant="outline">
            <a href={article.url} rel="noreferrer" target="_blank">
              Open in WordPress
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card className="border-border/80 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">Content brief</CardTitle>
          <CardDescription>Categories, tags, and source text for AI reuse.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {article.categoryNames.map((item) => (
              <Badge key={item} variant="secondary">
                {item}
              </Badge>
            ))}
            {article.tagNames.map((item) => (
              <Badge key={item} variant="outline">
                {item}
              </Badge>
            ))}
          </div>
          <p className="max-h-80 overflow-auto rounded-md border border-border bg-background/70 p-4 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
            {article.contentText ?? article.excerpt}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function GeneratedContentTab({
  busyDraftId,
  drafts,
  selectedDraftIds,
  onApproveAll,
  onApproveDraft,
  onApproveSelected,
  onDeleteDraft,
  onPublishNow,
  onScheduleDraft,
  onToggleAll,
  onToggleDraft,
}: {
  busyDraftId: string | null;
  drafts: WordPressSocialDraft[];
  selectedDraftIds: string[];
  onApproveAll: () => void;
  onApproveDraft: (draft: WordPressSocialDraft) => void;
  onApproveSelected: () => void;
  onDeleteDraft: (draft: WordPressSocialDraft) => void;
  onPublishNow: (draft: WordPressSocialDraft) => void;
  onScheduleDraft: (draft: WordPressSocialDraft) => void;
  onToggleAll: () => void;
  onToggleDraft: (draftId: string) => void;
}) {
  if (!drafts.length) {
    return <EmptyState title="No generated content yet" />;
  }

  const allSelected = selectedDraftIds.length === drafts.length;
  const selectedCount = selectedDraftIds.length;
  const approvableCount = drafts.filter((draft) => draft.status === 'DRAFT').length;

  return (
    <section className="grid gap-4">
      <Card className="border-border/80 bg-card/80 dark:border-white/10 dark:bg-white/[0.04]">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold">Generated channel drafts</p>
            <p className="text-xs text-muted-foreground">
              {String(drafts.length)} drafts, {String(approvableCount)} waiting for approval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="h-8 px-2" onClick={onToggleAll} size="sm" variant="outline">
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allSelected ? 'Clear selection' : 'Select all'}
            </Button>
            <Button
              className="h-8 px-2"
              disabled={!selectedCount || busyDraftId !== null}
              onClick={onApproveSelected}
              size="sm"
              variant="outline"
            >
              <FileCheck2 className="h-4 w-4" />
              Approve selected {selectedCount ? `(${String(selectedCount)})` : ''}
            </Button>
            <Button
              className="h-8 px-2"
              disabled={!approvableCount || busyDraftId !== null}
              onClick={onApproveAll}
              size="sm"
            >
              <FileCheck2 className="h-4 w-4" />
              Approve all
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {drafts.map((draft) => {
          const selected = selectedDraftIds.includes(draft.id);
          const busy = busyDraftId === draft.id || busyDraftId === 'approve-selected';

          return (
            <Card
              className={cn(
                'overflow-hidden border-border/80 dark:border-white/10',
                selected ? 'border-primary ring-2 ring-primary/20' : '',
              )}
              key={draft.id}
            >
              <button
                className="flex w-full items-center justify-between gap-3 border-b border-border/70 p-3 text-left transition hover:bg-muted/60 dark:border-white/10 dark:hover:bg-white/[0.04]"
                onClick={() => {
                  onToggleDraft(draft.id);
                }}
                type="button"
              >
                <div className="flex items-center gap-2">
                  {selected ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">Select draft</span>
                </div>
                <Badge
                  variant={
                    draft.status === 'DRAFT' || draft.status === 'REJECTED' ? 'outline' : 'success'
                  }
                >
                  {titleCase(draft.status)}
                </Badge>
              </button>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">{titleCase(draft.platform)}</CardTitle>
                  <Badge variant="outline">{formatDate(draft.createdAt)}</Badge>
                </div>
                <CardDescription>{draft.title}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {draft.mediaUrl ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-background/70 dark:border-white/10 dark:bg-white/[0.03]">
                    <img
                      alt={`${titleCase(draft.platform)} generated campaign visual`}
                      className={cn(
                        'w-full object-cover',
                        draft.platform === 'PINTEREST' ? 'aspect-[2/3]' : 'aspect-video',
                      )}
                      src={draft.mediaUrl}
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-border bg-background/70 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
                    Visual will be generated with the next campaign run.
                  </div>
                )}
                <p className="rounded-md border border-border bg-background/70 p-3 text-sm leading-6 dark:border-white/10 dark:bg-white/[0.03]">
                  {draft.body}
                </p>
                <div className="flex flex-wrap gap-2">
                  {draft.hashtags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    className="h-8 px-2"
                    disabled={busyDraftId !== null || draft.status !== 'DRAFT'}
                    onClick={() => {
                      onApproveDraft(draft);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileCheck2 className="h-4 w-4" />
                    )}
                    Approve
                  </Button>
                  <Button
                    className="h-8 px-2"
                    disabled={busyDraftId !== null || draft.status === 'PUBLISHED'}
                    onClick={() => {
                      onPublishNow(draft);
                    }}
                    size="sm"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Post now
                  </Button>
                  <Button
                    className="h-8 px-2"
                    disabled={
                      busyDraftId !== null ||
                      draft.status === 'SCHEDULED' ||
                      draft.status === 'PUBLISHED'
                    }
                    onClick={() => {
                      onScheduleDraft(draft);
                    }}
                    size="sm"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CalendarDays className="h-4 w-4" />
                    )}
                    Schedule tomorrow
                  </Button>
                  <Button
                    className="h-8 px-2 text-rose-600 hover:text-rose-700 dark:text-rose-300"
                    disabled={busyDraftId !== null}
                    onClick={() => {
                      onDeleteDraft(draft);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function MediaAssetsTab({
  article,
  drafts,
  generations,
}: {
  article: WordPressDetailArticle;
  drafts: WordPressSocialDraft[];
  generations: WordPressCampaignGeneration[];
}) {
  const images: { id: string; url: string; label: string }[] = [];

  if (article.featuredImageUrl) {
    images.push({
      id: 'featured',
      url: article.featuredImageUrl,
      label: article.featuredImageAlt ?? 'Featured image',
    });
  }

  generations.forEach((item) => {
    if (item.imageUrl) {
      images.push({ id: item.id, url: item.imageUrl, label: titleCase(item.platform) });
    }
  });

  drafts.forEach((draft) => {
    if (draft.mediaUrl) {
      images.push({
        id: draft.id,
        url: draft.mediaUrl,
        label: `${titleCase(draft.platform)} draft image`,
      });
    }
  });

  if (!images.length) {
    return <EmptyState title="No media assets found" />;
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {images.map((image) => (
        <div
          className="sf-card overflow-hidden rounded-xl border border-border bg-card dark:border-white/10"
          key={image.id}
        >
          <img alt={image.label} className="aspect-video w-full object-cover" src={image.url} />
          <div className="p-3 text-sm font-medium">{image.label}</div>
        </div>
      ))}
    </section>
  );
}

function PublishingHistoryTab({ items }: { items: WordPressPublishingHistory[] }) {
  if (!items.length) {
    return <EmptyState title="No publishing history yet" />;
  }

  return (
    <Card className="overflow-hidden border-border/80 dark:border-white/10">
      <div className="overflow-x-auto">
        <table className="sf-data-table w-full min-w-[52rem] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground dark:bg-white/[0.03]">
            <tr>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Publish time</th>
              <th className="px-4 py-3">Post URL</th>
              <th className="px-4 py-3">Error logs</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-t border-border dark:border-white/10" key={item.id}>
                <td className="px-4 py-3">{titleCase(item.platform)}</td>
                <td className="px-4 py-3">{item.platformAccount}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{titleCase(item.status)}</Badge>
                </td>
                <td className="px-4 py-3">
                  {formatDateTime(item.publishedAt ?? item.scheduledFor ?? item.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {item.postUrl ? (
                    <a className="text-primary" href={item.postUrl}>
                      Open
                    </a>
                  ) : (
                    'Not published'
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.errorLog ?? 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AiHistoryTab({ items }: { items: WordPressRegenerationHistory[] }) {
  if (!items.length) {
    return <EmptyState title="No AI generation history yet" />;
  }

  return (
    <section className="grid gap-3">
      {items.map((item) => (
        <Card className="border-border/80 dark:border-white/10" key={item.id}>
          <CardContent className="grid gap-2 p-4 sm:grid-cols-[8rem_1fr_12rem] sm:items-center">
            <Badge variant="secondary">Version {item.version}</Badge>
            <div>
              <div className="font-medium">{item.reason ?? 'Campaign regenerated'}</div>
              <div className="text-sm text-muted-foreground">
                {item.promptVersion} - {item.aiModel}
              </div>
              {item.prompt ? (
                <div className="mt-1 text-xs text-muted-foreground">{item.prompt}</div>
              ) : null}
            </div>
            <div className="text-sm text-muted-foreground sm:text-right">
              {formatDateTime(item.generatedAt)}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function AnalyticsTab({
  googleAnalytics,
  googleAnalyticsError,
  googleAnalyticsLoading,
  items,
}: {
  googleAnalytics: GoogleAnalyticsPostMetric | null;
  googleAnalyticsError: string | null;
  googleAnalyticsLoading: boolean;
  items: WordPressCampaignAnalytics[];
}) {
  const totals = items.reduce(
    (sum, item) => ({
      impressions: sum.impressions + item.impressions,
      clicks: sum.clicks + item.clicks,
      saves: sum.saves + item.saves,
      comments: sum.comments + item.comments,
      shares: sum.shares + item.shares,
    }),
    { impressions: 0, clicks: 0, saves: 0, comments: 0, shares: 0 },
  );

  return (
    <section className="grid gap-4">
      <Card className="border-border/80 dark:border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Google Analytics
          </CardTitle>
          <CardDescription>Lifetime total views for this WordPress article URL.</CardDescription>
        </CardHeader>
        <CardContent>
          {googleAnalyticsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Google Analytics
            </div>
          ) : googleAnalyticsError ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">
              {googleAnalyticsError}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnalyticsMetric
                label="Lifetime total views"
                value={googleAnalytics?.pageViews ?? 0}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {Object.entries(totals).map(([label, value]) => (
          <Card className="sf-card-hover border-border/80 dark:border-white/10" key={label}>
            <CardContent className="p-4">
              <div className="text-2xl font-semibold">{formatNumber(value)}</div>
              <div className="text-sm capitalize text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
        {!items.length ? (
          <div className="lg:col-span-5">
            <EmptyState title="Social publishing analytics will populate after publishing" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AnalyticsMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-2xl font-semibold">
        {typeof value === 'number' ? formatNumber(value) : value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0 dark:border-white/10">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/70 px-4 py-3 text-center dark:bg-white/[0.04]">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="sf-card rounded-xl border border-dashed border-border bg-card/80 p-8 text-center text-sm text-muted-foreground dark:border-white/10">
      <Clock3 className="mx-auto mb-3 h-6 w-6" />
      {title}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function safePublishMediaUrl(value: string | null) {
  if (!value || value.length > 2000) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(payload.message)) {
      return payload.message.join(' ');
    }
    return payload.message ?? fallback;
  } catch {
    return fallback;
  }
}
