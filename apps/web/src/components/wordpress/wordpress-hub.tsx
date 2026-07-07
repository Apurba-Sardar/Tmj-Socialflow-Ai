'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ArrowDownUp,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe2,
  Layers3,
  Loader2,
  Menu,
  Moon,
  Plus,
  RadioTower,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Tags,
  Trash2,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';

import { LogoutButton } from '@/components/auth/logout-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet } from '@/components/ui/sheet';
import type { AuthenticatedUser } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

type CampaignStatus =
  | 'NOT_GENERATED'
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'ARCHIVED';

type SortBy = 'modifiedAt' | 'publishedAt' | 'title';
type SortDir = 'asc' | 'desc';

interface WordPressConnection {
  id: string;
  siteUrl: string;
  username: string;
  isActive: boolean;
  lastConnectedAt: string | null;
  _count: {
    articles: number;
    syncRuns: number;
  };
}

interface HubArticle {
  id: string;
  wordpressId: number;
  slug: string;
  title: string;
  excerpt: string;
  url: string;
  authorName: string | null;
  featuredImageUrl: string | null;
  categoryNames: string[];
  categorySlugs: string[];
  tagNames: string[];
  tagSlugs: string[];
  campaignStatus: CampaignStatus;
  publishedAt: string | null;
  modifiedAt: string | null;
  repurposedAt: string | null;
  connection?: {
    id: string;
    siteUrl: string;
    username: string;
  };
  latestCampaign?: {
    id: string;
    name: string;
    status: CampaignStatus;
    updatedAt: string;
    _count: {
      generations: number;
      publishingHistory: number;
    };
  } | null;
  campaignCount: number;
  draftCount: number;
}

interface GoogleAnalyticsPostMetric {
  articleId: string;
  pageViews: number;
  activeUsers: number;
  sessions: number;
  eventCount: number;
  averageSessionDuration: number;
}

interface PaginatedHubArticles {
  data: HubArticle[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

interface Toast {
  tone: 'success' | 'info' | 'warning';
  message: string;
}

const campaignStatuses: { value: CampaignStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'NOT_GENERATED', label: 'Not Generated' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const platformDefaults = ['PINTEREST', 'INSTAGRAM', 'LINKEDIN', 'X'];

export function WordPressHub({ user }: { user: AuthenticatedUser }) {
  const apiBaseUrl = getApiBaseUrl();
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const [articles, setArticles] = useState<HubArticle[]>([]);
  const [connections, setConnections] = useState<WordPressConnection[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [googleAnalytics, setGoogleAnalytics] = useState<Record<string, GoogleAnalyticsPostMetric>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CampaignStatus | 'ALL'>('ALL');
  const [connectionId, setConnectionId] = useState('ALL');
  const [slugPath, setSlugPath] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('modifiedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [connectForm, setConnectForm] = useState({
    siteUrl: '',
    username: '',
    applicationPassword: '',
  });

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadArticles();
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [page, perPage, search, status, connectionId, slugPath, category, tag, sortBy, sortDir]);

  useEffect(() => {
    void loadConnections();
  }, []);

  const selectedCount = selectedArticles.length;
  const allVisibleSelected = articles.length > 0 && articles.every((item) => selectedArticles.includes(item.id));
  const generatedCount = articles.filter((item) => item.campaignStatus !== 'NOT_GENERATED').length;
  const failedCount = articles.filter((item) => item.campaignStatus === 'FAILED').length;

  const categories = useMemo(
    () => Array.from(new Set(articles.flatMap((article) => article.categoryNames))).slice(0, 6),
    [articles],
  );

  function notify(message: string, tone: Toast['tone'] = 'success') {
    setToast({ message, tone });
    window.setTimeout(() => {
      setToast(null);
    }, 3200);
  }

  async function loadConnections() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/wordpress/connections`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Unable to load WordPress connections.');
      }
      setConnections((await response.json()) as WordPressConnection[]);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Connection list failed.', 'warning');
    }
  }

  async function loadArticles() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
        sortBy,
        sortDir,
      });
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'ALL') params.set('campaignStatus', status);
      if (connectionId !== 'ALL') params.set('connectionId', connectionId);
      if (slugPath.trim()) params.set('slug', slugPath.trim());
      if (category.trim()) params.set('category', category.trim());
      if (tag.trim()) params.set('tag', tag.trim());

      const response = await fetch(`${apiBaseUrl}/api/wordpress/hub/posts?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Unable to load WordPress posts.');
      }
      const payload = (await response.json()) as PaginatedHubArticles;
      setArticles(payload.data);
      setTotal(payload.pagination.total);
      setTotalPages(Math.max(payload.pagination.totalPages, 1));
      setSelectedArticles((ids) => ids.filter((id) => payload.data.some((article) => article.id === id)));
      void loadGoogleAnalytics(payload.data);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'WordPress Hub failed to load.', 'warning');
    } finally {
      setLoading(false);
    }
  }

  async function loadGoogleAnalytics(items: HubArticle[]) {
    const articleIds = items.map((item) => item.id);

    if (!articleIds.length) {
      setGoogleAnalytics({});
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const params = new URLSearchParams({
        articleIds: articleIds.join(','),
        days: '30',
      });
      const response = await fetch(`${apiBaseUrl}/api/google-analytics/wordpress-posts?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(await apiErrorMessage(response, 'Google Analytics data is not available.'));
      }
      const payload = (await response.json()) as GoogleAnalyticsPostMetric[];
      setGoogleAnalytics(Object.fromEntries(payload.map((item) => [item.articleId, item])));
    } catch (error) {
      setAnalyticsError(error instanceof Error ? error.message : 'Google Analytics data is not available.');
      setGoogleAnalytics({});
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function connectWordPress() {
    if (!isAdmin) {
      notify('Admin access is required to connect WordPress sites.', 'warning');
      return;
    }

    setConnecting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/wordpress/connect`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectForm),
      });
      if (!response.ok) {
        throw new Error('WordPress connection failed.');
      }
      setConnectForm({ siteUrl: '', username: '', applicationPassword: '' });
      notify('WordPress site connected.');
      await loadConnections();
      await syncWordPress();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to connect WordPress.', 'warning');
    } finally {
      setConnecting(false);
    }
  }

  async function syncWordPress() {
    if (!isAdmin) {
      notify('Admin access is required to sync WordPress.', 'warning');
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/wordpress/sync`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perPage: 100,
          maxPages: 100,
          status: 'any',
          postTypes: ['posts', 'articles', 'news', 'quotes', 'best-quotes'],
        }),
      });
      if (!response.ok) {
        throw new Error('WordPress sync failed.');
      }
      const result = (await response.json()) as { scannedPosts: number; upsertedPosts: number };
      notify(`Synced ${String(result.upsertedPosts)} of ${String(result.scannedPosts)} WordPress posts.`);
      await Promise.all([loadConnections(), loadArticles()]);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to sync WordPress posts.', 'warning');
    } finally {
      setSyncing(false);
    }
  }

  async function generateCampaign(article: HubArticle) {
    setBusyId(article.id);
    try {
      const response = await fetch(`${apiBaseUrl}/api/wordpress/hub/posts/${article.id}/generate-campaign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: `${article.title} Social Campaign`,
          promptVersion: 'wordpress-hub-v1',
          platforms: platformDefaults,
        }),
      });
      if (!response.ok) {
        throw new Error('Campaign generation failed.');
      }
      notify('AI campaign generated.');
      await loadArticles();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to generate campaign.', 'warning');
    } finally {
      setBusyId(null);
    }
  }

  async function runBulk(action: 'generate' | 'archive' | 'remove', articleIds = selectedArticles) {
    if ((action === 'archive' || action === 'remove') && !isAdmin) {
      notify('Admin access is required to change WordPress Hub posts.', 'warning');
      return;
    }

    if (!articleIds.length) {
      notify('Select at least one post.', 'warning');
      return;
    }

    if (action === 'remove') {
      const confirmed = window.confirm(
        `Remove ${String(articleIds.length)} post${articleIds.length === 1 ? '' : 's'} from WordPress Hub? This only removes the synced local copy, not the live WordPress post.`,
      );
      if (!confirmed) {
        return;
      }
    }

    setBulkBusy(action);
    try {
      const response = await fetch(`${apiBaseUrl}/api/wordpress/hub/bulk`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, articleIds }),
      });
      if (!response.ok) {
        throw new Error('Bulk action failed.');
      }
      const result = (await response.json()) as { processed: number };
      notify(
        action === 'remove'
          ? `${String(result.processed)} posts removed from Hub.`
          : `${String(result.processed)} posts processed.`,
      );
      setSelectedArticles((ids) => ids.filter((id) => !articleIds.includes(id)));
      await loadArticles();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Bulk action failed.', 'warning');
    } finally {
      setBulkBusy(null);
    }
  }

  function toggleTheme() {
    const current = darkMode ?? document.documentElement.classList.contains('dark');
    const next = !current;
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem('socialflow-theme', next ? 'dark' : 'light');
    setDarkMode(next);
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedArticles((ids) => ids.filter((id) => !articles.some((article) => article.id === id)));
      return;
    }

    setSelectedArticles((ids) => Array.from(new Set([...ids, ...articles.map((article) => article.id)])));
  }

  function toggleArticle(id: string) {
    setSelectedArticles((ids) =>
      ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id],
    );
  }

  const sidebar = (
    <HubSidebar
      connections={connections}
      user={user}
      onSync={() => {
        void syncWordPress();
      }}
      syncing={syncing}
    />
  );

  return (
    <div className="sf-app-bg min-h-screen text-foreground transition-colors">
      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        {sidebar}
      </Sheet>
      <div className="grid min-h-screen lg:grid-cols-[17rem_1fr]">
        <aside className="hidden border-r border-border/70 bg-card/80 backdrop-blur-2xl lg:block dark:border-white/10">
          {sidebar}
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/78 backdrop-blur-2xl dark:border-white/10">
            <div className="mx-auto flex max-w-[98rem] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <Button
                aria-label="Open navigation"
                className="lg:hidden"
                onClick={() => {
                  setNavigationOpen(true);
                }}
                size="sm"
                variant="ghost"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="relative min-w-0 flex-1 sm:max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 bg-card/80 pl-9 dark:border-white/10"
                  onChange={(event) => {
                    setPage(1);
                    setSearch(event.target.value);
                  }}
                  placeholder="Search WordPress posts, categories, tags"
                  value={search}
                />
              </div>
              <Button aria-label="Toggle theme" onClick={toggleTheme} size="sm" variant="outline">
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                disabled={syncing || !isAdmin}
                onClick={() => {
                  void syncWordPress();
                }}
                size="sm"
                variant="outline"
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync
              </Button>
              <LogoutButton />
            </div>
          </header>

          <main className="sf-page-enter mx-auto flex w-full max-w-[98rem] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
            {toast ? (
              <div
                className={cn(
                  'fixed right-4 top-20 z-40 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur',
                  toast.tone === 'warning'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
                    : toast.tone === 'info'
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
                )}
              >
                {toast.message}
              </div>
            ) : null}

            <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-3">
                <Badge className="w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" variant="outline">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  WordPress content intelligence
                </Badge>
                <div>
                  <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">
                    WordPress Hub
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    Sync source content, generate reusable AI campaigns, and track publishing history across every social platform.
                  </p>
                </div>
              </div>
              <div className="sf-card grid grid-cols-3 gap-2 rounded-xl border border-border bg-card/80 p-2 dark:border-white/10">
                <Stat label="Posts" value={formatNumber(total)} />
                <Stat label="Campaigns" value={formatNumber(generatedCount)} />
                <Stat label="Failed" value={formatNumber(failedCount)} />
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-border/80 bg-card/90 dark:border-white/10">
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">Connected sites</CardTitle>
                      <CardDescription>Multiple WordPress websites can feed one campaign library.</CardDescription>
                    </div>
                    <Button
                      disabled={!isAdmin || connecting}
                      onClick={() => {
                        void connectWordPress();
                      }}
                      size="sm"
                    >
                      {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Connect
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label htmlFor="site-url">Site URL</Label>
                    <Input
                      id="site-url"
                      onChange={(event) => {
                        setConnectForm((form) => ({ ...form, siteUrl: event.target.value }));
                      }}
                      placeholder="https://example.com"
                      value={connectForm.siteUrl}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wp-username">Username</Label>
                    <Input
                      id="wp-username"
                      onChange={(event) => {
                        setConnectForm((form) => ({ ...form, username: event.target.value }));
                      }}
                      placeholder="wordpress user"
                      value={connectForm.username}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wp-password">Application password</Label>
                    <Input
                      id="wp-password"
                      onChange={(event) => {
                        setConnectForm((form) => ({ ...form, applicationPassword: event.target.value }));
                      }}
                      placeholder="xxxx xxxx xxxx xxxx"
                      type="password"
                      value={connectForm.applicationPassword}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card/90 dark:border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Source coverage</CardTitle>
                  <CardDescription>Active sync inventory by site.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {connections.length ? (
                    connections.map((connection) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/70 p-3 dark:border-white/10 dark:bg-white/[0.03]"
                        key={connection.id}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{connection.siteUrl}</div>
                          <div className="text-xs text-muted-foreground">{connection.username}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{formatNumber(connection._count.articles)}</div>
                          <div className="text-xs text-muted-foreground">posts</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground dark:border-white/10">
                      No WordPress site connected yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <Card className="overflow-hidden border-border/80 bg-card/95 dark:border-white/10">
              <CardHeader className="gap-4 border-b border-border pb-4 dark:border-white/10">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <CardTitle className="text-lg">Posts library</CardTitle>
                    <CardDescription>Search, sort, filter, generate, archive, and inspect synced WordPress content.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!selectedCount || bulkBusy !== null}
                      onClick={() => {
                        void runBulk('generate');
                      }}
                      size="sm"
                    >
                      {bulkBusy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                      Generate selected
                    </Button>
                    <Button
                      disabled={!selectedCount || bulkBusy !== null || !isAdmin}
                      onClick={() => {
                        void runBulk('archive');
                      }}
                      size="sm"
                      variant="outline"
                    >
                      {bulkBusy === 'archive' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                      Archive
                    </Button>
                    <Button
                      disabled={!selectedCount || bulkBusy !== null || !isAdmin}
                      onClick={() => {
                        void runBulk('remove');
                      }}
                      size="sm"
                      variant="destructive"
                    >
                      {bulkBusy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
                  <FilterSelect
                    label="Site"
                    onChange={(value) => {
                      setPage(1);
                      setConnectionId(value);
                    }}
                    value={connectionId}
                  >
                    <option value="ALL">All sites</option>
                    {connections.map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.siteUrl}
                      </option>
                    ))}
                  </FilterSelect>
                  <FilterSelect
                    label="Campaign"
                    onChange={(value) => {
                      setPage(1);
                      setStatus(value as CampaignStatus | 'ALL');
                    }}
                    value={status}
                  >
                    {campaignStatuses.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </FilterSelect>
                  <FilterInput
                    icon={FileText}
                    label="URL path / slug"
                    onChange={(value) => {
                      setPage(1);
                      setSlugPath(value);
                    }}
                    placeholder="quotes or full URL"
                    value={slugPath}
                  />
                  <FilterInput
                    icon={Layers3}
                    label="Category slug"
                    onChange={(value) => {
                      setPage(1);
                      setCategory(value);
                    }}
                    value={category}
                  />
                  <FilterInput
                    icon={Tags}
                    label="Tag slug"
                    onChange={(value) => {
                      setPage(1);
                      setTag(value);
                    }}
                    value={tag}
                  />
                  <FilterSelect
                    label="Sort"
                    onChange={(value) => {
                      setSortBy(value as SortBy);
                    }}
                    value={sortBy}
                  >
                    <option value="modifiedAt">Modified</option>
                    <option value="publishedAt">Published</option>
                    <option value="title">Title</option>
                  </FilterSelect>
                  <FilterSelect
                    label="Direction"
                    onChange={(value) => {
                      setSortDir(value as SortDir);
                    }}
                    value={sortDir}
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </FilterSelect>
                </div>
                {categories.length || slugPath ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs transition',
                        slugPath === 'quotes'
                          ? 'border-primary/60 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground dark:border-white/10',
                      )}
                      onClick={() => {
                        setSlugPath('quotes');
                        setPage(1);
                      }}
                      type="button"
                    >
                      Quotes path
                    </button>
                    {slugPath ? (
                      <button
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground dark:border-white/10"
                        onClick={() => {
                          setSlugPath('');
                          setPage(1);
                        }}
                        type="button"
                      >
                        Clear slug filter
                      </button>
                    ) : null}
                    {categories.map((item) => (
                      <button
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground dark:border-white/10"
                        key={item}
                        onClick={() => {
                          setCategory(slugify(item));
                          setPage(1);
                        }}
                        type="button"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
                  <BarChart3 className="h-4 w-4" />
                  {analyticsLoading ? 'Loading Google Analytics for visible posts...' : 'Google Analytics: last 30 days per WordPress URL.'}
                  {analyticsError ? <span className="text-amber-600 dark:text-amber-300">{analyticsError}</span> : null}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="hidden overflow-x-auto xl:block">
                  <table className="sf-data-table w-full min-w-[84rem] text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground dark:bg-white/[0.03]">
                      <tr>
                        <th className="w-12 px-4 py-3 text-left">
                          <button
                            aria-label="Select visible posts"
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded border border-border dark:border-white/20',
                              allVisibleSelected ? 'bg-primary text-primary-foreground' : 'bg-background',
                            )}
                            onClick={toggleAllVisible}
                            type="button"
                          >
                            {allVisibleSelected ? <Check className="h-3 w-3" /> : null}
                          </button>
                        </th>
                        <SortableHead
                          active={sortBy === 'title'}
                          label="Article"
                          onClick={() => {
                            setSortBy('title');
                            setSortDir((value) => (value === 'asc' ? 'desc' : 'asc'));
                          }}
                        />
                        <th className="px-4 py-3 text-left">Taxonomy</th>
                        <th className="px-4 py-3 text-left">Campaign Status</th>
                        <th className="px-4 py-3 text-left">Google Analytics</th>
                        <SortableHead
                          active={sortBy === 'publishedAt'}
                          label="Published"
                          onClick={() => {
                            setSortBy('publishedAt');
                            setSortDir((value) => (value === 'asc' ? 'desc' : 'asc'));
                          }}
                        />
                        <th className="px-4 py-3 text-left">History</th>
                        <th className="sticky right-0 z-10 w-72 bg-muted/95 px-4 py-3 text-right backdrop-blur dark:bg-[#171717]/95">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td className="px-4 py-12 text-center text-muted-foreground" colSpan={8}>
                            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                            Loading WordPress posts
                          </td>
                        </tr>
                      ) : articles.length ? (
                        articles.map((article) => (
                          <HubRow
                            analytics={googleAnalytics[article.id]}
                            article={article}
                            analyticsLoading={analyticsLoading}
                            busy={busyId === article.id || bulkBusy !== null}
                            canRemove={isAdmin}
                            key={article.id}
                            onGenerate={() => {
                              void generateCampaign(article);
                            }}
                            onRemove={() => {
                              void runBulk('remove', [article.id]);
                            }}
                            onToggle={() => {
                              toggleArticle(article.id);
                            }}
                            selected={selectedArticles.includes(article.id)}
                          />
                        ))
                      ) : (
                        <tr>
                          <td className="px-4 py-12 text-center text-muted-foreground" colSpan={8}>
                            No WordPress posts match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 p-4 xl:hidden">
                  {loading ? (
                    <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground dark:border-white/10">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Loading WordPress posts
                    </div>
                  ) : articles.length ? (
                    articles.map((article) => (
                      <MobileArticleCard
                        analytics={googleAnalytics[article.id]}
                        article={article}
                        analyticsLoading={analyticsLoading}
                        busy={busyId === article.id || bulkBusy !== null}
                        canRemove={isAdmin}
                        key={article.id}
                        onGenerate={() => {
                          void generateCampaign(article);
                        }}
                        onRemove={() => {
                          void runBulk('remove', [article.id]);
                        }}
                        onToggle={() => {
                          toggleArticle(article.id);
                        }}
                        selected={selectedArticles.includes(article.id)}
                      />
                    ))
                  ) : (
                    <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground dark:border-white/10">
                      No WordPress posts match the current filters.
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-muted-foreground">
                    {selectedCount ? `${String(selectedCount)} selected - ` : null}
                    Showing {formatNumber(articles.length)} of {formatNumber(total)} posts
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                      onChange={(event) => {
                        setPerPage(Number(event.target.value));
                        setPage(1);
                      }}
                      value={perPage}
                    >
                      {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size} / page
                        </option>
                      ))}
                    </select>
                    <Button
                      disabled={page <= 1}
                      onClick={() => {
                        setPage((value) => Math.max(value - 1, 1));
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-20 text-center text-xs text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      disabled={page >= totalPages}
                      onClick={() => {
                        setPage((value) => Math.min(value + 1, totalPages));
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}

function HubSidebar({
  connections,
  syncing,
  user,
  onSync,
}: {
  connections: WordPressConnection[];
  syncing: boolean;
  user: AuthenticatedUser;
  onSync: () => void;
}) {
  return (
    <div className="flex h-full flex-col p-3">
      <div className="flex items-center gap-3 px-2 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-400 text-white shadow-lg shadow-sky-500/20">
          <span className="text-xs font-bold tracking-wide">TMJ</span>
        </div>
        <div>
          <div className="font-semibold leading-tight">TMJ SocialFlow AI</div>
          <div className="text-xs text-muted-foreground">WordPress Hub</div>
        </div>
      </div>
      <nav className="mt-4 grid gap-1 text-sm">
        <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" href="/dashboard">
          <Globe2 className="h-4 w-4" />
          Dashboard
        </Link>
        <Link className="flex items-center gap-3 rounded-md bg-primary px-3 py-2 text-primary-foreground shadow-sm" href="/wordpress-hub">
          <FileText className="h-4 w-4" />
          WordPress Hub
        </Link>
        <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" href="/admin/channels">
          <RadioTower className="h-4 w-4" />
          Channels
        </Link>
      </nav>
      <Separator className="my-4" />
      <div className="grid gap-2 px-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sites</div>
        {connections.slice(0, 5).map((connection) => (
          <div className="flex min-w-0 items-center gap-2 text-sm" key={connection.id}>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="truncate">{connection.siteUrl.replace(/^https?:\/\//, '')}</span>
          </div>
        ))}
        {!connections.length ? <div className="text-sm text-muted-foreground">No sites connected.</div> : null}
      </div>
      <div className="mt-auto rounded-lg border border-border bg-background/70 p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="font-medium">{user.email}</div>
        <div className="text-xs text-muted-foreground">{user.role}</div>
        <Button className="mt-3 w-full" disabled={syncing} onClick={onSync} size="sm" variant="outline">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync now
        </Button>
      </div>
    </div>
  );
}

function HubRow({
  analytics,
  analyticsLoading,
  article,
  busy,
  canRemove,
  selected,
  onGenerate,
  onRemove,
  onToggle,
}: {
  analytics?: GoogleAnalyticsPostMetric;
  analyticsLoading: boolean;
  article: HubArticle;
  busy: boolean;
  canRemove: boolean;
  selected: boolean;
  onGenerate: () => void;
  onRemove: () => void;
  onToggle: () => void;
}) {
  return (
    <tr className="border-t border-border transition hover:bg-muted/40 dark:border-white/10 dark:hover:bg-white/[0.03]">
      <td className="px-4 py-4 align-top">
        <button
          aria-label={`Select ${article.title}`}
          className={cn(
            'mt-1 flex h-4 w-4 items-center justify-center rounded border border-border dark:border-white/20',
            selected ? 'bg-primary text-primary-foreground' : 'bg-background',
          )}
          onClick={onToggle}
          type="button"
        >
          {selected ? <Check className="h-3 w-3" /> : null}
        </button>
      </td>
      <td className="max-w-xl px-4 py-4 align-top">
        <div className="flex gap-3">
          {article.featuredImageUrl ? (
            <img
              alt=""
              className="h-14 w-20 rounded-md object-cover"
              src={article.featuredImageUrl}
            />
          ) : (
            <div className="flex h-14 w-20 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <FileText className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <Link className="line-clamp-2 font-medium hover:text-primary" href={`/wordpress-hub/${article.id}`}>
              {article.title}
            </Link>
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.excerpt}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">WP #{article.wordpressId}</Badge>
              <Badge className="max-w-64 truncate font-mono text-[11px]" variant="outline">
                /{article.slug}
              </Badge>
              {article.connection ? <Badge variant="outline">{article.connection.siteUrl.replace(/^https?:\/\//, '')}</Badge> : null}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex max-w-56 flex-wrap gap-1.5">
          {article.categoryNames.slice(0, 2).map((item) => (
            <Badge key={item} variant="secondary">{item}</Badge>
          ))}
          {article.tagNames.slice(0, 2).map((item) => (
            <Badge className="border-sky-500/30 text-sky-700 dark:text-sky-300" key={item} variant="outline">{item}</Badge>
          ))}
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <StatusBadge status={article.campaignStatus} />
        {article.latestCampaign ? (
          <div className="mt-2 text-xs text-muted-foreground">{article.latestCampaign.name}</div>
        ) : null}
      </td>
      <td className="px-4 py-4 align-top">
        <GoogleAnalyticsCell analytics={analytics} loading={analyticsLoading} />
      </td>
      <td className="px-4 py-4 align-top text-sm">
        <div>{formatDate(article.publishedAt)}</div>
        <div className="text-xs text-muted-foreground">Modified {formatDate(article.modifiedAt)}</div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="text-sm">{article.campaignCount} campaigns</div>
        <div className="text-xs text-muted-foreground">{article.draftCount} drafts</div>
      </td>
      <td className="sticky right-0 z-10 bg-card/95 px-4 py-4 text-right align-top backdrop-blur dark:bg-[#121212]/95">
        <div className="flex min-w-72 justify-end gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/wordpress-hub/${article.id}`}>Open</Link>
          </Button>
          <Button
            className="min-w-28"
            disabled={busy}
            onClick={onGenerate}
            size="sm"
            title="Generate AI campaign"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </Button>
          <Button
            aria-label={`Remove ${article.title} from WordPress Hub`}
            disabled={busy || !canRemove}
            onClick={onRemove}
            size="sm"
            variant="destructive"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        </div>
      </td>
    </tr>
  );
}

function MobileArticleCard({
  analytics,
  analyticsLoading,
  article,
  busy,
  canRemove,
  selected,
  onGenerate,
  onRemove,
  onToggle,
}: {
  analytics?: GoogleAnalyticsPostMetric;
  analyticsLoading: boolean;
  article: HubArticle;
  busy: boolean;
  canRemove: boolean;
  selected: boolean;
  onGenerate: () => void;
  onRemove: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-start gap-3">
        <button
          aria-label={`Select ${article.title}`}
          className={cn(
            'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border dark:border-white/20',
            selected ? 'bg-primary text-primary-foreground' : 'bg-background',
          )}
          onClick={onToggle}
          type="button"
        >
          {selected ? <Check className="h-3 w-3" /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <Link className="font-medium hover:text-primary" href={`/wordpress-hub/${article.id}`}>
            {article.title}
          </Link>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge status={article.campaignStatus} />
            <Badge variant="secondary">{formatDate(article.publishedAt)}</Badge>
            <Badge className="max-w-full truncate font-mono text-[11px]" variant="outline">
              /{article.slug}
            </Badge>
          </div>
          <div className="mt-3">
            <GoogleAnalyticsCell analytics={analytics} loading={analyticsLoading} />
          </div>
          <div className="mt-3 flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/wordpress-hub/${article.id}`}>Open</Link>
            </Button>
            <Button disabled={busy} onClick={onGenerate} size="sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate
            </Button>
            <Button disabled={busy || !canRemove} onClick={onRemove} size="sm" variant="destructive">
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const styles: Record<CampaignStatus, string> = {
    NOT_GENERATED: 'border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    DRAFT: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    SCHEDULED: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    PUBLISHED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    FAILED: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    ARCHIVED: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  };

  return (
    <Badge className={styles[status]} variant="outline">
      {status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}
    </Badge>
  );
}

function GoogleAnalyticsCell({
  analytics,
  loading,
}: {
  analytics?: GoogleAnalyticsPostMetric;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading GA
      </div>
    );
  }

  if (!analytics) {
    return <div className="text-xs text-muted-foreground">No GA data</div>;
  }

  return (
    <div className="grid min-w-40 grid-cols-3 gap-1.5 text-xs">
      <MetricPill label="Views" value={analytics.pageViews} />
      <MetricPill label="Users" value={analytics.activeUsers} />
      <MetricPill label="Sessions" value={analytics.sessions} />
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background/70 px-2 py-1 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="font-semibold text-foreground">{formatCompactNumber(value)}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function FilterInput({
  icon: Icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 translate-y-0.5 text-muted-foreground" />
      <Input
        className="h-10 pt-4 pl-9 text-sm"
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        value={value}
      />
      <span className="pointer-events-none absolute left-9 top-1.5 text-[10px] uppercase text-muted-foreground">
        {label}
      </span>
      {value ? (
        <button
          aria-label={`Clear ${label}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            onChange('');
          }}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  children,
  label,
  value,
  onChange,
}: {
  children: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block">
      <select
        className="h-10 w-full rounded-md border border-input bg-background px-3 pt-4 text-sm dark:border-white/10 dark:bg-white/[0.04]"
        onChange={(event) => {
          onChange(event.target.value);
        }}
        value={value}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute left-3 top-1.5 text-[10px] uppercase text-muted-foreground">
        {label}
      </span>
    </label>
  );
}

function SortableHead({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3 text-left">
      <button
        className={cn('inline-flex items-center gap-1 transition hover:text-foreground', active ? 'text-foreground' : '')}
        onClick={onClick}
        type="button"
      >
        {label}
        <ArrowDownUp className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-md bg-background/70 px-4 py-3 text-center dark:bg-white/[0.04]">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(value),
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
