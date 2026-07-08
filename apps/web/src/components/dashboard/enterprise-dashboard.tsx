'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpRight,
  AtSign,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Contact,
  Trash2,
  FileCheck2,
  FileText,
  Image,
  LayoutDashboard,
  Library,
  Menu,
  Moon,
  Plus,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  ThumbsUp,
  Timer,
  Video,
  WandSparkles,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';

import { LogoutButton } from '@/components/auth/logout-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet } from '@/components/ui/sheet';
import type { AuthenticatedUser } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

type ScheduleView = 'Today' | 'Week' | 'Month';
type CreateType = 'Post' | 'Campaign' | 'Approval';
type ToastTone = 'success' | 'info' | 'warning';

interface Metric {
  label: string;
  value: string;
  detail: string;
  trend: string;
  tone: 'blue' | 'green' | 'amber' | 'rose';
  icon: LucideIcon;
}

interface QueueItem {
  label: string;
  value: number;
  detail: string;
  tone: string;
}

interface PlatformKpi {
  platform: string;
  icon: LucideIcon;
  color: string;
  posts: number;
  engagement: string;
  health: string;
  delta: string;
}

interface ScheduleItem {
  id: string;
  time: string;
  platform: string;
  title: string;
  state: string;
  accent: string;
  view: ScheduleView;
}

interface ApprovalItem {
  id: string;
  title: string;
  owner: string;
  risk: string;
  age: string;
  status: 'Pending' | 'Approved' | 'Changes requested';
}

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  icon: LucideIcon;
  tone: string;
}

interface Toast {
  message: string;
  tone: ToastTone;
}

interface TopPost {
  id: string;
  title: string;
  platform: string;
  metric: string;
  value: number;
  capturedAt: string;
}

interface DashboardMetricPayload {
  label: string;
  value: number;
  detail: string;
  tone: Metric['tone'];
}

interface DashboardOverview {
  metrics: DashboardMetricPayload[];
  queue: QueueItem[];
  schedule: {
    id: string;
    time: string;
    platform: string;
    title: string;
    state: string;
  }[];
  approvals: ApprovalItem[];
  activity: {
    id: string;
    title: string;
    detail: string;
    time: string;
    tone: 'success' | 'warning' | 'info';
  }[];
  notifications: {
    id: string;
    title: string;
    body: string | null;
    createdAt: string;
  }[];
  platformKpis: {
    platform: string;
    posts: number;
    published: number;
    health: number;
  }[];
  platformHealth: {
    id: string;
    platform: string;
    posts: number;
    health: number;
    status: string;
  }[];
  topPosts: TopPost[];
}

interface WordPressArticle {
  id: string;
  wordpressId: number;
  title: string;
  excerpt: string;
  url: string;
  authorName: string | null;
  featuredImageUrl: string | null;
  categoryNames: string[];
  categorySlugs: string[];
  publishedAt: string | null;
  modifiedAt: string | null;
  repurposedAt: string | null;
}

interface WordPressDraft {
  id: string;
  platform: string;
  status: 'DRAFT' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'REJECTED';
  title: string;
  body: string;
  mediaUrl: string | null;
  sourceUrl: string;
  scheduledFor: string | null;
  article?: {
    id: string;
    title: string;
    wordpressId: number;
    url?: string;
    categoryNames?: string[];
  };
}

interface WordPressDraftGroup {
  key: string;
  title: string;
  wordpressId: number | null;
  sourceUrl: string;
  categories: string[];
  drafts: WordPressDraft[];
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    totalPages: number;
    page: number;
    perPage: number;
  };
}

const defaultPlatformKpi: PlatformKpi = {
  platform: 'Instagram',
  icon: Video,
  color: 'text-pink-500 dark:text-pink-400',
  posts: 0,
  engagement: '0%',
  health: '100%',
  delta: '0%',
};

type DashboardHref = Parameters<typeof Link>[0]['href'];

const navigation: { label: string; href: string; icon: LucideIcon; count?: string }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'WordPress Hub', href: '/wordpress-hub', icon: FileText },
  { label: 'Content', href: '/media-library', icon: Library },
  { label: 'Scheduler', href: '/scheduler', icon: CalendarDays },
  { label: 'Queue', href: '/dashboard#queue', icon: Workflow, count: '24' },
  { label: 'Approvals', href: '/dashboard#approvals', icon: FileCheck2, count: '31' },
  { label: 'Analytics', href: '/dashboard#analytics', icon: BarChart3 },
  { label: 'AI Studio', href: '/dashboard#ai', icon: WandSparkles },
  { label: 'Channels', href: '/admin/channels', icon: RadioTower },
  { label: 'Settings', href: '/dashboard#settings', icon: Settings },
];

const platforms = [
  { label: 'Pinterest', icon: Image, tone: 'text-red-500' },
  { label: 'Instagram', icon: Video, tone: 'text-pink-500' },
  { label: 'LinkedIn', icon: Contact, tone: 'text-sky-500' },
  { label: 'X', icon: AtSign, tone: 'text-slate-600 dark:text-zinc-200' },
];

const dateRanges = ['May 24 - May 30', 'May 31 - Jun 06', 'Jun 07 - Jun 13'];

export function EnterpriseDashboard({ user }: { user: AuthenticatedUser }) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleView, setScheduleView] = useState<ScheduleView>('Today');
  const [dateRangeIndex, setDateRangeIndex] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showQueueAll, setShowQueueAll] = useState(false);
  const [showActivityAll, setShowActivityAll] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKpi>(defaultPlatformKpi);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [platformKpis, setPlatformKpis] = useState<PlatformKpi[]>([]);
  const [platformHealth, setPlatformHealth] = useState<PlatformKpi[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<Metric[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [wordpressArticles, setWordpressArticles] = useState<WordPressArticle[]>([]);
  const [wordpressDrafts, setWordpressDrafts] = useState<WordPressDraft[]>([]);
  const [wordpressTotal, setWordpressTotal] = useState(0);
  const [wordpressLoading, setWordpressLoading] = useState(true);
  const [wordpressError, setWordpressError] = useState<string | null>(null);
  const [wordpressBusyId, setWordpressBusyId] = useState<string | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('socialflow-theme');
    const browserThemeIsDark = document.documentElement.classList.contains('dark');
    setDarkMode(storedTheme ? storedTheme === 'dark' : browserThemeIsDark);
  }, []);

  useEffect(() => {
    if (darkMode === null) {
      return;
    }

    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
    window.localStorage.setItem('socialflow-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toast]);

  useEffect(() => {
    void refreshDashboardData();
    void refreshWordPressData();
  }, []);

  const pendingApprovals = approvals.filter((item) => item.status === 'Pending').length;
  const retryingCount = queueItems.find((item) => item.label === 'Retrying')?.value ?? 0;
  const filteredSchedule = filterBySearch(
    scheduleItems.filter((item) => item.view === scheduleView),
    searchQuery,
    (item) => [item.title, item.platform, item.state],
  );
  const filteredApprovals = filterBySearch(approvals, searchQuery, (item) => [
    item.title,
    item.owner,
    item.risk,
    item.status,
  ]);
  const filteredActivity = filterBySearch(activity, searchQuery, (item) => [
    item.title,
    item.detail,
  ]);
  const filteredTopPosts = filterBySearch(topPosts, searchQuery, (item) => [
    item.title,
    item.platform,
  ]);
  const filteredWordPressArticles = filterBySearch(wordpressArticles, searchQuery, (item) => [
    item.title,
    item.excerpt,
    item.authorName ?? '',
    ...item.categoryNames,
  ]);
  const filteredWordPressDrafts = filterBySearch(wordpressDrafts, searchQuery, (item) => [
    item.title,
    item.platform,
    item.status,
    item.article?.title ?? '',
  ]);
  const displayedActivity = showActivityAll ? filteredActivity : filteredActivity.slice(0, 4);
  const displayedQueue = showQueueAll ? queueItems : queueItems.slice(0, 4);
  const metrics = dashboardMetrics;

  const sidebar = useMemo(
    () => <DashboardSidebar user={user} pendingApprovals={pendingApprovals} />,
    [user, pendingApprovals],
  );

  function pushActivity(title: string, detail: string, tone: string, icon: LucideIcon) {
    setActivity((items) => [
      {
        id: `activity-${Date.now().toString()}-${createClientId()}`,
        title,
        detail,
        time: 'Just now',
        icon,
        tone,
      },
      ...items,
    ]);
  }

  function notify(message: string, tone: ToastTone = 'success') {
    setToast({ message, tone });
  }

  async function refreshWordPressData() {
    setWordpressLoading(true);
    setWordpressError(null);

    try {
      const [libraryResponse, draftsResponse] = await Promise.all([
        fetch(`${getApiBaseUrl()}/api/wordpress/library?perPage=6&page=1`, {
          cache: 'no-store',
          credentials: 'include',
        }),
        fetch(`${getApiBaseUrl()}/api/wordpress/drafts?perPage=100&page=1`, {
          cache: 'no-store',
          credentials: 'include',
        }),
      ]);

      if (!libraryResponse.ok) {
        throw new Error('WordPress library is not available yet.');
      }

      if (!draftsResponse.ok) {
        throw new Error('WordPress drafts are not available yet.');
      }

      const library = (await libraryResponse.json()) as PaginatedResponse<WordPressArticle>;
      const drafts = (await draftsResponse.json()) as PaginatedResponse<WordPressDraft>;
      setWordpressArticles(library.data);
      setWordpressDrafts(drafts.data);
      setWordpressTotal(library.pagination.total);
    } catch (error) {
      setWordpressError(error instanceof Error ? error.message : 'Could not load WordPress data.');
    } finally {
      setWordpressLoading(false);
    }
  }

  async function refreshDashboardData() {
    setDashboardError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/dashboard/overview`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Dashboard data is not available.');
      }

      const overview = (await response.json()) as DashboardOverview;
      setDashboardMetrics(overview.metrics.map(metricFromPayload));
      setQueueItems(overview.queue);
      setScheduleItems(overview.schedule.map(scheduleFromPayload));
      setApprovals(overview.approvals);
      setActivity(overview.activity.map(activityFromPayload));
      setInsights(overview.notifications.map((item) => item.body ?? item.title));
      setPlatformKpis(overview.platformKpis.map(platformKpiFromPayload));
      setPlatformHealth(overview.platformHealth.map(platformHealthFromPayload));
      setTopPosts(overview.topPosts);
      setSelectedPlatform((current) => {
        const next = overview.platformKpis.map(platformKpiFromPayload)[0];
        return current.posts === 0 && next ? next : current;
      });
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Could not load dashboard data.');
    }
  }

  async function syncWordPress() {
    setWordpressBusyId('sync');
    setWordpressError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/wordpress/sync`, {
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

      const result = (await response.json()) as { upsertedPosts: number; failedPosts: number };
      await refreshWordPressData();
      pushActivity(
        'WordPress library synced',
        `${String(result.upsertedPosts)} posts saved, ${String(result.failedPosts)} failed`,
        'text-emerald-500',
        CheckCircle2,
      );
      notify('WordPress posts synced into the content library.');
    } catch (error) {
      setWordpressError(error instanceof Error ? error.message : 'WordPress sync failed.');
      notify('WordPress sync failed.', 'warning');
    } finally {
      setWordpressBusyId(null);
    }
  }

  async function repurposeWordPressArticle(article: WordPressArticle) {
    setWordpressBusyId(article.id);
    setWordpressError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/wordpress/library/${article.id}/repurpose`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: ['PINTEREST', 'INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X'],
        }),
      });

      if (!response.ok) {
        throw new Error('Could not generate social drafts.');
      }

      await refreshWordPressData();
      pushActivity(
        'WordPress article repurposed',
        article.title,
        'text-violet-500',
        Sparkles,
      );
      notify('Social drafts generated from WordPress content.');
    } catch (error) {
      setWordpressError(error instanceof Error ? error.message : 'Could not repurpose article.');
      notify('Could not generate drafts.', 'warning');
    } finally {
      setWordpressBusyId(null);
    }
  }

  async function approveWordPressDraft(draft: WordPressDraft) {
    await approveWordPressDrafts([draft]);
  }

  async function approveWordPressDrafts(drafts: WordPressDraft[]) {
    const approvableDrafts = drafts.filter((draft) => draft.status === 'DRAFT');

    if (!approvableDrafts.length) {
      notify('Selected drafts are already approved.', 'info');
      return;
    }

    setWordpressBusyId(approvableDrafts.length === 1 ? approvableDrafts[0]?.id ?? 'drafts' : 'drafts-bulk-approve');

    try {
      await Promise.all(
        approvableDrafts.map(async (draft) => {
          const response = await fetch(`${getApiBaseUrl()}/api/wordpress/drafts/${draft.id}/approve`, {
            method: 'PATCH',
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error(`Could not approve ${platformLabel(draft.platform)} draft.`);
          }
        }),
      );

      await refreshWordPressData();
      pushActivity(
        approvableDrafts.length === 1 ? 'WordPress draft approved' : 'WordPress campaign drafts approved',
        approvableDrafts.length === 1
          ? approvableDrafts[0]?.title ?? 'Draft'
          : `${String(approvableDrafts.length)} channel drafts approved`,
        'text-emerald-500',
        FileCheck2,
      );
      notify(approvableDrafts.length === 1 ? 'WordPress draft approved.' : 'Selected channel drafts approved.');
    } catch (error) {
      setWordpressError(error instanceof Error ? error.message : 'Could not approve drafts.');
      notify('Could not approve drafts.', 'warning');
    } finally {
      setWordpressBusyId(null);
    }
  }

  async function scheduleWordPressDraft(draft: WordPressDraft) {
    setWordpressBusyId(draft.id);

    try {
      const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch(`${getApiBaseUrl()}/api/wordpress/drafts/${draft.id}/schedule`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor }),
      });

      if (!response.ok) {
        throw new Error('Could not schedule draft.');
      }

      await refreshWordPressData();
      pushActivity('WordPress draft scheduled', draft.title, 'text-blue-500', CalendarDays);
      notify('WordPress draft scheduled for tomorrow.');
    } catch (error) {
      setWordpressError(error instanceof Error ? error.message : 'Could not schedule draft.');
      notify('Could not schedule draft.', 'warning');
    } finally {
      setWordpressBusyId(null);
    }
  }

  async function deleteWordPressDraft(draft: WordPressDraft) {
    setWordpressBusyId(draft.id);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/wordpress/drafts/${draft.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Could not delete draft.');
      }

      await refreshWordPressData();
      pushActivity('WordPress draft deleted', draft.title, 'text-rose-500', Trash2);
      notify('Draft deleted.', 'info');
    } catch (error) {
      setWordpressError(error instanceof Error ? error.message : 'Could not delete draft.');
      notify('Could not delete draft.', 'warning');
    } finally {
      setWordpressBusyId(null);
    }
  }

  function handleCreate(payload: {
    title: string;
    platform: string;
    time: string;
    type: CreateType;
  }) {
    const newItem: ScheduleItem = {
      id: `created-${Date.now().toString()}`,
      title: payload.title,
      platform: payload.platform,
      time: payload.time,
      state: payload.type === 'Approval' ? 'Needs approval' : 'Queued',
      accent: accentForPlatform(payload.platform),
      view: 'Today',
    };

    setScheduleItems((items) => [newItem, ...items]);
    setQueueItems((items) =>
      items.map((item) =>
        item.label === (payload.type === 'Approval' ? 'Needs approval' : 'Queued')
          ? { ...item, value: item.value + 1 }
          : item,
      ),
    );
    if (payload.type === 'Approval') {
      setApprovals((items) => [
        {
          id: `created-approval-${Date.now().toString()}`,
          title: payload.title,
          owner: 'Demo user',
          risk: 'New request',
          age: 'Just now',
          status: 'Pending',
        },
        ...items,
      ]);
    }
    pushActivity(
      `${payload.type} created`,
      `${payload.title} queued for ${payload.platform}`,
      'text-emerald-500',
      CheckCircle2,
    );
    notify(`${payload.type} created and added to today's schedule.`);
  }

  function updateApproval(id: string, status: ApprovalItem['status']) {
    const item = approvals.find((approval) => approval.id === id);
    setApprovals((items) =>
      items.map((approval) => (approval.id === id ? { ...approval, status } : approval)),
    );
    if (item) {
      pushActivity(
        `Approval updated: ${status}`,
        item.title,
        status === 'Approved' ? 'text-emerald-500' : 'text-amber-500',
        FileCheck2,
      );
      notify(
        `${item.title} marked ${status.toLowerCase()}.`,
        status === 'Approved' ? 'success' : 'warning',
      );
    }
  }

  function retryFailedPosts() {
    void refreshDashboardData();
    notify('Queue status refreshed from the backend.', 'info');
  }

  return (
    <div className="sf-app-bg min-h-screen overflow-x-hidden text-foreground transition-colors duration-300">
      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        {sidebar}
      </Sheet>
      <div className="grid min-h-screen lg:grid-cols-[17rem_1fr]">
        <aside className="hidden border-r border-border/70 bg-card/80 backdrop-blur-2xl lg:block dark:border-white/10">
          {sidebar}
        </aside>
        <div className="min-w-0">
          <DashboardHeader
            darkMode={darkMode ?? true}
            dateRange={dateRanges[dateRangeIndex] ?? 'May 24 - May 30'}
            notificationCount={pendingApprovals + retryingCount}
            searchQuery={searchQuery}
            showNotifications={showNotifications}
            onCreateClick={() => {
              setShowCreateModal(true);
            }}
            onDateClick={() => {
              setDateRangeIndex((index) => (index + 1) % dateRanges.length);
              notify('Date range changed.', 'info');
            }}
            onMenuClick={() => {
              setNavigationOpen(true);
            }}
            onNotificationClick={() => {
              setShowNotifications((value) => !value);
            }}
            onSearchChange={setSearchQuery}
            onThemeToggle={() => {
              const currentDarkMode =
                darkMode ?? document.documentElement.classList.contains('dark');
              const nextDarkMode = !currentDarkMode;
              setDarkMode(nextDarkMode);
              notify(`Switched to ${nextDarkMode ? 'dark' : 'light'} mode.`, 'info');
            }}
          />
          <main className="mx-auto flex w-full max-w-[96rem] flex-col gap-4 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
            <Hero user={user} />
            {dashboardError ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100">
                {dashboardError}
              </div>
            ) : null}
            {searchQuery ? (
              <SearchSummary
                count={
                  filteredSchedule.length +
                  filteredApprovals.length +
                  filteredActivity.length +
                  filteredTopPosts.length +
                  filteredWordPressArticles.length +
                  filteredWordPressDrafts.length
                }
                onClear={() => {
                  setSearchQuery('');
                }}
                query={searchQuery}
              />
            ) : null}
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </section>
            <WordPressLibraryPanel
              articles={filteredWordPressArticles}
              busyId={wordpressBusyId}
              drafts={filteredWordPressDrafts}
              error={wordpressError}
              loading={wordpressLoading}
                onApproveDraft={(draft) => {
                  void approveWordPressDraft(draft);
                }}
                onApproveDrafts={(drafts) => {
                  void approveWordPressDrafts(drafts);
                }}
              onDeleteDraft={(draft) => {
                void deleteWordPressDraft(draft);
              }}
              onRefresh={() => {
                void refreshWordPressData();
              }}
              onRepurpose={(article) => {
                void repurposeWordPressArticle(article);
              }}
              onScheduleDraft={(draft) => {
                void scheduleWordPressDraft(draft);
              }}
              onSync={() => {
                void syncWordPress();
              }}
              total={wordpressTotal}
            />
            <section className="grid gap-4 xl:grid-cols-[1.1fr_1.35fr_0.9fr]">
              <div className="grid gap-4">
                <PlatformHealth
                  items={platformHealth}
                  selectedPlatform={selectedPlatform.platform}
                  onSelect={(platform) => {
                    setSelectedPlatform(platform);
                    notify(`${platform.platform} health panel selected.`, 'info');
                  }}
                />
                <TopPosts posts={filteredTopPosts} onOpenReport={notify} />
              </div>
              <TodaySchedule
                items={filteredSchedule}
                scheduleView={scheduleView}
                onPromote={(item) => {
                  setScheduleItems((items) =>
                    items.map((scheduleItem) =>
                      scheduleItem.id === item.id
                        ? { ...scheduleItem, state: 'Queued' }
                        : scheduleItem,
                    ),
                  );
                  pushActivity(
                    'Schedule item queued',
                    item.title,
                    'text-emerald-500',
                    CheckCircle2,
                  );
                  notify(`${item.title} moved to queued.`);
                }}
                onViewChange={setScheduleView}
              />
              <div className="grid gap-4">
                <PublishingQueue
                  items={displayedQueue}
                  showAll={showQueueAll}
                  totalItems={queueItems.length}
                  onRetry={retryFailedPosts}
                  onToggleAll={() => {
                    setShowQueueAll((value) => !value);
                  }}
                />
                <AiInsights
                  insights={insights}
                  onApply={(insight) => {
                    pushActivity('AI recommendation applied', insight, 'text-violet-500', Sparkles);
                    notify('AI recommendation applied to the plan.');
                  }}
                />
              </div>
            </section>
            <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
              <ApprovalQueue
                approvals={filteredApprovals}
                pendingCount={pendingApprovals}
                onUpdate={updateApproval}
              />
              <RecentActivity
                items={displayedActivity}
                showAll={showActivityAll}
                totalItems={filteredActivity.length}
                onToggleAll={() => {
                  setShowActivityAll((value) => !value);
                }}
              />
            </section>
            <PlatformKpis
              items={platformKpis}
              selectedPlatform={selectedPlatform.platform}
              onSelect={(platform) => {
                setSelectedPlatform(platform);
                notify(`${platform.platform} KPI card opened.`, 'info');
              }}
            />
          </main>
        </div>
      </div>
      {showNotifications ? (
        <NotificationsPanel
          approvals={pendingApprovals}
          retries={retryingCount}
          onClose={() => {
            setShowNotifications(false);
          }}
        />
      ) : null}
      {showCreateModal ? (
        <CreateModal
          onClose={() => {
            setShowCreateModal(false);
          }}
          onCreate={(payload) => {
            handleCreate(payload);
            setShowCreateModal(false);
          }}
        />
      ) : null}
      {toast ? <ToastMessage toast={toast} /> : null}
    </div>
  );
}

function DashboardSidebar({
  user,
  pendingApprovals,
}: {
  user: AuthenticatedUser;
  pendingApprovals: number;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-screen flex-col px-3 py-4">
      <div className="flex items-center gap-3 rounded-md px-2 py-2">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-emerald-400 text-white shadow-lg shadow-blue-950/30">
          <span className="text-xs font-bold tracking-wide">TMJ</span>
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-card" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">TMJ SocialFlow AI</p>
          <p className="truncate text-xs text-muted-foreground">Automation OS</p>
        </div>
      </div>
      <nav className="mt-6 space-y-1">
        {navigation.map((item) => {
          const active =
            pathname === item.href ||
            (pathname === '/dashboard' && item.href.startsWith('/dashboard#'));
          const count = item.label === 'Approvals' ? String(pendingApprovals) : item.count;

          return (
            <Link
              className={cn(
                'group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-blue-950/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-white/[0.06]',
              )}
              href={item.href as DashboardHref}
              key={item.label}
            >
              <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              <span className="flex-1">{item.label}</span>
              {count ? (
                <Badge className="bg-violet-500/20 text-violet-700 dark:text-violet-100">
                  {count}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <Separator className="my-5" />
      <div className="space-y-3 px-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Platforms
        </p>
        {platforms.map((platform) => (
          <a
            className="flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="#analytics"
            key={platform.label}
          >
            <platform.icon className={cn('h-4 w-4', platform.tone)} />
            <span>{platform.label}</span>
          </a>
        ))}
      </div>
      <div className="mt-auto rounded-md border bg-muted/40 p-3 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-500 text-sm font-semibold text-slate-950">
            {initialsForEmail(user.email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
        </div>
        <Badge className="mt-3" variant={user.emailVerified ? 'success' : 'outline'}>
          {user.emailVerified ? 'Verified workspace' : 'Verification pending'}
        </Badge>
      </div>
    </div>
  );
}

function DashboardHeader({
  darkMode,
  dateRange,
  notificationCount,
  searchQuery,
  showNotifications,
  onCreateClick,
  onDateClick,
  onMenuClick,
  onNotificationClick,
  onSearchChange,
  onThemeToggle,
}: {
  darkMode: boolean;
  dateRange: string;
  notificationCount: number;
  searchQuery: string;
  showNotifications: boolean;
  onCreateClick: () => void;
  onDateClick: () => void;
  onMenuClick: () => void;
  onNotificationClick: () => void;
  onSearchChange: (value: string) => void;
  onThemeToggle: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl dark:border-white/10">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          aria-label="Open navigation"
          className="lg:hidden"
          onClick={onMenuClick}
          size="sm"
          variant="ghost"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden w-full max-w-md items-center gap-2 rounded-md border bg-card px-3 py-2 md:flex dark:border-white/10 dark:bg-white/[0.04]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search dashboard"
            className="h-5 border-0 bg-transparent p-0 focus-visible:ring-0"
            onChange={(event) => {
              onSearchChange(event.target.value);
            }}
            placeholder="Search posts, approvals, platforms"
            type="search"
            value={searchQuery}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            className="hidden whitespace-nowrap sm:inline-flex"
            onClick={onDateClick}
            size="sm"
            variant="outline"
          >
            <CalendarDays className="h-4 w-4" />
            {dateRange}
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            aria-label="Create New"
            className="whitespace-nowrap shadow-lg shadow-blue-950/20"
            onClick={onCreateClick}
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create New</span>
          </Button>
          <Button aria-label="Toggle theme" onClick={onThemeToggle} size="sm" variant="outline">
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            aria-label="Notifications"
            className={cn('relative', showNotifications ? 'bg-muted' : '')}
            onClick={onNotificationClick}
            size="sm"
            variant="outline"
          >
            <Bell className="h-4 w-4" />
            {notificationCount ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[0.65rem] font-semibold text-white">
                {notificationCount}
              </span>
            ) : null}
          </Button>
          <LogoutButton />
        </div>
      </div>
      <div className="border-t border-border px-4 py-2 md:hidden dark:border-white/10">
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search dashboard mobile"
            className="h-5 border-0 bg-transparent p-0 focus-visible:ring-0"
            onChange={(event) => {
              onSearchChange(event.target.value);
            }}
            placeholder="Search dashboard"
            type="search"
            value={searchQuery}
          />
        </div>
      </div>
    </header>
  );
}

function Hero({ user }: { user: AuthenticatedUser }) {
  return (
    <section className="flex flex-col gap-4 py-2 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200">
          <RadioTower className="h-3.5 w-3.5" />
          All publishing systems operational
        </div>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
          Welcome back, {displayNameForUser(user)}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Command center for scheduled content, approvals, AI recommendations, and platform health.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-md border bg-card/80 p-2 text-center dark:border-white/10 dark:bg-white/[0.04]">
        <MiniStat label="On time" value="99.2%" />
        <MiniStat label="Reach" value="1.4M" />
        <MiniStat label="Saved" value="22h" />
      </div>
    </section>
  );
}

function SearchSummary({
  count,
  onClear,
  query,
}: {
  count: number;
  onClear: () => void;
  query: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.045]">
      <span>
        Showing {count} result{count === 1 ? '' : 's'} for{' '}
        <span className="font-medium">&quot;{query}&quot;</span>
      </span>
      <Button onClick={onClear} size="sm" variant="outline">
        Clear search
      </Button>
    </div>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/10 dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.065]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-normal">{metric.value}</p>
          </div>
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-md',
              toneClass(metric.tone),
            )}
          >
            <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="truncate text-muted-foreground">{metric.detail}</span>
          <span
            className={cn(
              'font-medium',
              metric.tone === 'rose' ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-300',
            )}
          >
            {metric.trend}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function WordPressLibraryPanel({
  articles,
  busyId,
  drafts,
  error,
  loading,
  onApproveDraft,
  onApproveDrafts,
  onDeleteDraft,
  onRefresh,
  onRepurpose,
  onScheduleDraft,
  onSync,
  total,
}: {
  articles: WordPressArticle[];
  busyId: string | null;
  drafts: WordPressDraft[];
  error: string | null;
  loading: boolean;
  onApproveDraft: (draft: WordPressDraft) => void;
  onApproveDrafts: (drafts: WordPressDraft[]) => void;
  onDeleteDraft: (draft: WordPressDraft) => void;
  onRefresh: () => void;
  onRepurpose: (article: WordPressArticle) => void;
  onScheduleDraft: (draft: WordPressDraft) => void;
  onSync: () => void;
  total: number;
}) {
  const draftGroups = useMemo(() => groupWordPressDrafts(drafts), [drafts]);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const selectedGroup = draftGroups.find((group) => group.key === selectedGroupKey) ?? null;

  return (
    <Card className="dark:border-white/10 dark:bg-white/[0.045]" id="wordpress">
      <CardHeader className="p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-sky-500" />
              WordPress Content Library
            </CardTitle>
            <CardDescription>
              Synced posts from mind.family ready for AI repurposing and scheduling.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-200">
              {loading ? 'Loading' : `${String(total)} posts`}
            </Badge>
            <Button
              className="h-8 px-2"
              disabled={loading || busyId !== null}
              onClick={onRefresh}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={cn('h-4 w-4', loading ? 'animate-spin' : '')} />
              Refresh
            </Button>
            <Button
              className="h-8 px-2"
              disabled={busyId !== null}
              onClick={onSync}
              size="sm"
            >
              <Workflow className="h-4 w-4" />
              Sync WordPress
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 pt-0 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-3">
          {error ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">
              {error}
            </div>
          ) : null}
          {loading ? (
            <EmptyState label="Loading WordPress posts from Supabase." />
          ) : articles.length ? (
            articles.map((article) => (
              <div
                className="grid gap-3 rounded-md border p-3 transition-all duration-300 hover:-translate-y-0.5 hover:bg-muted dark:border-white/10 dark:hover:bg-white/[0.04] md:grid-cols-[4.5rem_1fr_auto]"
                key={article.id}
              >
                <div className="overflow-hidden rounded-md bg-muted dark:bg-white/[0.04]">
                  {article.featuredImageUrl ? (
                    <img
                      alt={article.title}
                      className="h-20 w-full object-cover md:h-full"
                      src={article.featuredImageUrl}
                    />
                  ) : (
                    <div className="flex h-20 items-center justify-center md:h-full">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={article.repurposedAt ? 'success' : 'outline'}>
                      {article.repurposedAt ? 'Repurposed' : 'Ready'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      WP #{String(article.wordpressId)}
                    </span>
                    {article.categoryNames.slice(0, 2).map((category) => (
                      <Badge key={category} variant="outline">
                        {category}
                      </Badge>
                    ))}
                  </div>
                  <a
                    className="line-clamp-1 text-sm font-medium hover:text-primary"
                    href={article.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {article.title}
                  </a>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {article.excerpt}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {article.authorName ?? 'WordPress'} - Updated{' '}
                    {formatDateLabel(article.modifiedAt ?? article.publishedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
                  <Button
                    className="h-8 px-2"
                    disabled={busyId !== null}
                    onClick={() => {
                      onRepurpose(article);
                    }}
                    size="sm"
                    variant={article.repurposedAt ? 'outline' : 'default'}
                  >
                    <Sparkles className={cn('h-4 w-4', busyId === article.id ? 'animate-pulse' : '')} />
                    {busyId === article.id ? 'Generating' : 'Repurpose'}
                  </Button>
                  <Button asChild className="h-8 px-2" size="sm" variant="ghost">
                    <a href={article.url} rel="noreferrer" target="_blank">
                      <ArrowUpRight className="h-4 w-4" />
                      Open
                    </a>
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="No WordPress posts match your search." />
          )}
        </div>
        <div className="rounded-md border bg-muted/30 p-3 dark:border-white/10 dark:bg-black/20">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Generated Drafts</p>
              <p className="text-xs text-muted-foreground">Grouped by source article for channel review.</p>
            </div>
            <Badge variant="outline">
              {String(draftGroups.length)} campaigns
            </Badge>
          </div>
          <div className="space-y-2">
            {draftGroups.length ? (
              draftGroups.map((group) => {
                const approvedCount = group.drafts.filter((draft) => draft.status === 'APPROVED').length;
                const scheduledCount = group.drafts.filter((draft) => draft.status === 'SCHEDULED').length;
                const pendingCount = group.drafts.filter((draft) => draft.status === 'DRAFT').length;

                return (
                  <button
                    className="w-full rounded-md border bg-card p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.07]"
                    key={group.key}
                    onClick={() => {
                      setSelectedGroupKey(group.key);
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {group.wordpressId ? (
                            <Badge variant="outline">WP #{String(group.wordpressId)}</Badge>
                          ) : null}
                          <Badge variant={pendingCount > 0 ? 'outline' : 'success'}>
                            {String(group.drafts.length)} channel drafts
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-sm font-semibold">{group.title}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {group.drafts.map((draft) => (
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                channelTone(draft.platform),
                              )}
                              key={draft.id}
                            >
                              {platformLabel(draft.platform)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-md bg-muted/70 px-2 py-2 dark:bg-white/[0.04]">
                        <p className="font-semibold text-foreground">{String(pendingCount)}</p>
                        <p className="text-muted-foreground">Draft</p>
                      </div>
                      <div className="rounded-md bg-emerald-500/10 px-2 py-2 text-emerald-700 dark:text-emerald-300">
                        <p className="font-semibold">{String(approvedCount)}</p>
                        <p>Approved</p>
                      </div>
                      <div className="rounded-md bg-blue-500/10 px-2 py-2 text-blue-700 dark:text-blue-300">
                        <p className="font-semibold">{String(scheduledCount)}</p>
                        <p>Scheduled</p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <EmptyState label="Repurpose a WordPress post to create grouped channel drafts." />
            )}
          </div>
        </div>
      </CardContent>

      {selectedGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl border bg-card shadow-2xl dark:border-white/10 dark:bg-[#111113]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4 dark:border-white/10">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-200">
                    Campaign review
                  </Badge>
                  {selectedGroup.wordpressId ? (
                    <Badge variant="outline">WP #{String(selectedGroup.wordpressId)}</Badge>
                  ) : null}
                  <Badge variant="outline">{String(selectedGroup.drafts.length)} channels</Badge>
                </div>
                <h3 className="line-clamp-2 text-lg font-semibold">{selectedGroup.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review what was generated for each channel, then approve all or selected drafts.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={busyId !== null || selectedGroup.drafts.every((draft) => draft.status !== 'DRAFT')}
                  onClick={() => {
                    onApproveDrafts(selectedGroup.drafts);
                  }}
                  size="sm"
                >
                  <FileCheck2 className="h-4 w-4" />
                  Approve all
                </Button>
                <Button
                  aria-label="Close draft review"
                  onClick={() => {
                    setSelectedGroupKey(null);
                  }}
                  size="sm"
                  variant="outline"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid max-h-[calc(90vh-7.5rem)] gap-3 overflow-auto p-4 md:grid-cols-2">
              {selectedGroup.drafts.map((draft) => (
                <div
                  className="rounded-lg border bg-background/70 p-4 dark:border-white/10 dark:bg-white/[0.035]"
                  key={draft.id}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={channelTone(draft.platform)} variant="outline">
                        {platformLabel(draft.platform)}
                      </Badge>
                      <Badge variant={statusBadgeVariant(draft.status)}>
                        {draft.status.toLowerCase()}
                      </Badge>
                    </div>
                    {draft.scheduledFor ? (
                      <span className="text-xs text-muted-foreground">
                        {formatDateTimeLabel(draft.scheduledFor)}
                      </span>
                    ) : null}
                  </div>
                  {draft.mediaUrl ? (
                    <div className="mb-3 overflow-hidden rounded-lg border bg-muted dark:border-white/10 dark:bg-black/20">
                      <img
                        alt={`${platformLabel(draft.platform)} generated creative`}
                        className="max-h-72 w-full object-cover"
                        src={draft.mediaUrl}
                      />
                    </div>
                  ) : (
                    <div className="mb-3 flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground dark:border-white/10 dark:bg-black/20">
                      Image will appear after generation
                    </div>
                  )}
                  <p className="text-sm font-semibold">{draft.title}</p>
                  <div className="mt-3 max-h-44 overflow-auto rounded-md border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-black/20">
                    {draft.body}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      className="h-8 px-2"
                      disabled={busyId !== null || draft.status !== 'DRAFT'}
                      onClick={() => {
                        onApproveDraft(draft);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <FileCheck2 className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      className="h-8 px-2"
                      disabled={busyId !== null || draft.status === 'SCHEDULED'}
                      onClick={() => {
                        onScheduleDraft(draft);
                      }}
                      size="sm"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Schedule
                    </Button>
                    <Button
                      className="h-8 px-2 text-rose-600 hover:text-rose-700 dark:text-rose-300"
                      disabled={busyId !== null}
                      onClick={() => {
                        onDeleteDraft(draft);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function groupWordPressDrafts(drafts: WordPressDraft[]): WordPressDraftGroup[] {
  const groups = new Map<string, WordPressDraftGroup>();

  drafts.forEach((draft) => {
    const key = draft.article?.id ?? draft.sourceUrl;
    const existing = groups.get(key);

    if (existing) {
      existing.drafts.push(draft);
      return;
    }

    groups.set(key, {
      key,
      title: draft.article?.title ?? draft.title,
      wordpressId: draft.article?.wordpressId ?? null,
      sourceUrl: draft.article?.url ?? draft.sourceUrl,
      categories: draft.article?.categoryNames ?? [],
      drafts: [draft],
    });
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    drafts: [...group.drafts].sort((a, b) => platformLabel(a.platform).localeCompare(platformLabel(b.platform))),
  }));
}

function statusBadgeVariant(status: WordPressDraft['status']): 'outline' | 'success' | 'destructive' {
  if (status === 'APPROVED' || status === 'SCHEDULED' || status === 'PUBLISHED') {
    return 'success';
  }

  if (status === 'REJECTED') {
    return 'destructive';
  }

  return 'outline';
}

function channelTone(platform: string): string {
  return (
    {
      FACEBOOK: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300',
      INSTAGRAM: 'border-pink-500/25 bg-pink-500/10 text-pink-700 dark:text-pink-300',
      LINKEDIN: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
      PINTEREST: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
      X: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
    }[platform] ?? 'border-border bg-muted text-foreground'
  );
}

function PlatformHealth({
  items,
  onSelect,
  selectedPlatform,
}: {
  items: PlatformKpi[];
  onSelect: (platform: PlatformKpi) => void;
  selectedPlatform: string;
}) {
  return (
    <Card className="dark:border-white/10 dark:bg-white/[0.045]">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Platform Health</CardTitle>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-200">Live</Badge>
        </div>
        <CardDescription>API status, queue latency, and publish reliability.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {items.length ? (
          items.map((item) => (
          <button
            className={cn(
              'grid w-full grid-cols-[1fr_auto] gap-3 rounded-md border p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-muted dark:border-white/10 dark:hover:bg-white/[0.04]',
              selectedPlatform === item.platform
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : '',
            )}
            key={item.platform}
            onClick={() => {
              onSelect(item);
            }}
            type="button"
          >
            <div className="flex items-center gap-3">
              <item.icon className={cn('h-5 w-5', item.color)} />
              <div>
                <p className="text-sm font-medium">{item.platform}</p>
                <p className="text-xs text-muted-foreground">{item.posts} scheduled posts</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{item.health}</p>
              <p className="text-xs text-muted-foreground">health</p>
            </div>
          </button>
          ))
        ) : (
          <EmptyState label="No platform health records yet." />
        )}
      </CardContent>
    </Card>
  );
}

function TodaySchedule({
  items,
  onPromote,
  onViewChange,
  scheduleView,
}: {
  items: ScheduleItem[];
  onPromote: (item: ScheduleItem) => void;
  onViewChange: (view: ScheduleView) => void;
  scheduleView: ScheduleView;
}) {
  return (
    <Card className="dark:border-white/10 dark:bg-white/[0.045]" id="schedule">
      <CardHeader className="p-4 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{scheduleView}&apos;s Schedule</CardTitle>
            <CardDescription>Publishing windows and production states.</CardDescription>
          </div>
          <div className="flex rounded-md border bg-muted/40 p-1 text-xs dark:border-white/10 dark:bg-black/20">
            {(['Today', 'Week', 'Month'] as ScheduleView[]).map((item) => (
              <button
                className={cn(
                  'rounded px-3 py-1.5 transition-colors',
                  item === scheduleView
                    ? 'bg-background text-foreground shadow-sm dark:bg-white/10'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                key={item}
                onClick={() => {
                  onViewChange(item);
                }}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-hidden rounded-md border bg-muted/30 dark:border-white/10 dark:bg-[#080d16]">
          <div className="grid grid-cols-5 border-b text-center text-xs text-muted-foreground dark:border-white/10">
            {daysForView(scheduleView).map((day) => (
              <div className="border-r px-2 py-3 last:border-r-0 dark:border-white/10" key={day}>
                {day}
              </div>
            ))}
          </div>
          <div className="space-y-2 p-3">
            {items.length ? (
              items.map((item) => (
                <div
                  className="grid gap-3 rounded-md border bg-card p-3 transition-all duration-300 hover:-translate-y-0.5 hover:bg-muted sm:grid-cols-[4.5rem_1fr_auto] dark:border-white/10 dark:bg-white/[0.055] dark:hover:bg-white/[0.085]"
                  key={item.id}
                >
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span className={cn('h-2.5 w-2.5 rounded-full', item.accent)} />
                    {item.time}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.platform}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="w-fit self-center" variant="outline">
                      {item.state}
                    </Badge>
                    {item.state !== 'Queued' ? (
                      <Button
                        className="h-8 px-2"
                        onClick={() => {
                          onPromote(item);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Queue
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState label="No scheduled posts match your search." />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PublishingQueue({
  items,
  onRetry,
  onToggleAll,
  showAll,
  totalItems,
}: {
  items: QueueItem[];
  onRetry: () => void;
  onToggleAll: () => void;
  showAll: boolean;
  totalItems: number;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <Card className="dark:border-white/10 dark:bg-white/[0.045]" id="queue">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Publishing Queue</CardTitle>
          <Button className="h-8 px-2" onClick={onToggleAll} size="sm" variant="ghost">
            {showAll ? 'Collapse' : 'View all'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', item.tone)} />
                <span>{item.label}</span>
              </div>
              <span className="font-medium">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted dark:bg-white/10">
              <div
                className={cn('h-full rounded-full transition-all duration-700', item.tone)}
                style={{ width: `${String((item.value / total) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
        {totalItems > 0 ? (
          <Button className="w-full" onClick={onRetry} size="sm" variant="outline">
            Retry failed posts
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AiInsights({
  insights,
  onApply,
}: {
  insights: string[];
  onApply: (insight: string) => void;
}) {
  return (
    <Card className="dark:border-white/10 dark:bg-white/[0.045]" id="ai">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            AI Insights
          </CardTitle>
          <Badge>New</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {insights.length ? (
          insights.map((insight, index) => (
          <div
            className="rounded-md border p-3 text-sm transition-colors hover:bg-muted dark:border-white/10 dark:hover:bg-white/[0.04]"
            key={insight}
          >
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              {index === 0 ? (
                <Clock3 className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Recommendation
            </div>
            <p>{insight}</p>
            <Button
              className="mt-3 h-8 px-2"
              onClick={() => {
                onApply(insight);
              }}
              size="sm"
              variant="outline"
            >
              Apply insight
            </Button>
          </div>
          ))
        ) : (
          <EmptyState label="No AI insight notifications yet." />
        )}
      </CardContent>
    </Card>
  );
}

function ApprovalQueue({
  approvals,
  onUpdate,
  pendingCount,
}: {
  approvals: ApprovalItem[];
  onUpdate: (id: string, status: ApprovalItem['status']) => void;
  pendingCount: number;
}) {
  return (
    <Card className="dark:border-white/10 dark:bg-white/[0.045]" id="approvals">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Content Approval Queue</CardTitle>
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-200">
            {pendingCount} pending
          </Badge>
        </div>
        <CardDescription>Posts waiting on editorial, brand, or compliance checks.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {approvals.length ? (
          approvals.map((item) => (
            <div
              className="grid gap-3 rounded-md border p-3 transition-colors hover:bg-muted dark:border-white/10 dark:hover:bg-white/[0.04] sm:grid-cols-[1fr_auto]"
              key={item.id}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge
                    variant={
                      item.status === 'Approved'
                        ? 'success'
                        : item.status === 'Changes requested'
                          ? 'destructive'
                          : 'outline'
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.owner} - {item.risk}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                {item.age}
                {item.status === 'Pending' ? (
                  <>
                    <Button
                      className="h-8 px-2"
                      onClick={() => {
                        onUpdate(item.id, 'Approved');
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Approve
                    </Button>
                    <Button
                      className="h-8 px-2"
                      onClick={() => {
                        onUpdate(item.id, 'Changes requested');
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Request edits
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <EmptyState label="No approval items match your search." />
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({
  items,
  onToggleAll,
  showAll,
  totalItems,
}: {
  items: ActivityItem[];
  onToggleAll: () => void;
  showAll: boolean;
  totalItems: number;
}) {
  return (
    <Card className="dark:border-white/10 dark:bg-white/[0.045]">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Publishing Activity</CardTitle>
          <Button className="h-8 px-2" onClick={onToggleAll} size="sm" variant="ghost">
            {showAll ? 'Collapse' : 'View all'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 pt-0 md:grid-cols-2">
        {items.length ? (
          items.map((item) => (
            <div
              className="rounded-md border p-3 transition-all duration-300 hover:-translate-y-0.5 hover:bg-muted dark:border-white/10 dark:hover:bg-white/[0.04]"
              key={item.id}
            >
              <div className="flex items-start gap-3">
                <item.icon className={cn('mt-0.5 h-5 w-5', item.tone)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.time}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState label="No activity matches your search." />
        )}
        {totalItems === 0 ? null : (
          <span className="sr-only">{totalItems} activities available</span>
        )}
      </CardContent>
    </Card>
  );
}

function TopPosts({
  onOpenReport,
  posts,
}: {
  onOpenReport: (message: string, tone?: ToastTone) => void;
  posts: TopPost[];
}) {
  return (
    <Card className="dark:border-white/10 dark:bg-white/[0.045]">
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-base">Top-Performing Posts</CardTitle>
        <CardDescription>Ranked by engagement velocity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {posts.length ? (
          posts.map((post) => (
            <button
              className="grid w-full grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-md border p-2 text-left transition-colors hover:bg-muted dark:border-white/10 dark:hover:bg-white/[0.04]"
              key={post.id}
              onClick={() => {
                onOpenReport(`${post.title} report opened.`, 'info');
              }}
              type="button"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-sky-400/80 via-emerald-300/70 to-amber-200/80 text-slate-950">
                <ThumbsUp className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{post.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {post.platform} - {post.metric}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatCompactNumber(post.value)}</p>
                <p className="text-xs text-muted-foreground">value</p>
              </div>
            </button>
          ))
        ) : (
          <EmptyState label="No top posts match your search." />
        )}
      </CardContent>
    </Card>
  );
}

function PlatformKpis({
  items,
  onSelect,
  selectedPlatform,
}: {
  items: PlatformKpi[];
  onSelect: (platform: PlatformKpi) => void;
  selectedPlatform: string;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" id="analytics">
      {items.map((item) => (
        <button
          className="text-left"
          key={item.platform}
          onClick={() => {
            onSelect(item);
          }}
          type="button"
        >
          <Card
            className={cn(
              'transition-all duration-300 hover:-translate-y-0.5 hover:bg-muted dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.065]',
              selectedPlatform === item.platform ? 'border-primary ring-2 ring-primary/20' : '',
            )}
          >
            <CardContent className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className={cn('h-5 w-5', item.color)} />
                  <span className="font-medium">{item.platform}</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <MiniStat label="Posts" value={String(item.posts)} />
                <MiniStat label="Eng." value={item.engagement} />
                <MiniStat label="Delta" value={item.delta} />
              </div>
            </CardContent>
          </Card>
        </button>
      ))}
    </section>
  );
}

function NotificationsPanel({
  approvals,
  onClose,
  retries,
}: {
  approvals: number;
  onClose: () => void;
  retries: number;
}) {
  return (
    <div className="fixed right-4 top-20 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-md border bg-card p-4 shadow-2xl dark:border-white/10 dark:bg-[#10151f]">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">Notifications</p>
        <Button aria-label="Close notifications" onClick={onClose} size="sm" variant="ghost">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3">
        <NotificationLine
          icon={FileCheck2}
          label={`${String(approvals)} approvals waiting for review`}
        />
        <NotificationLine
          icon={AlertTriangle}
          label={`${String(retries)} publish retries need attention`}
        />
        <NotificationLine icon={Sparkles} label="AI found 3 optimization opportunities" />
      </div>
    </div>
  );
}

function NotificationLine({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3 text-sm dark:border-white/10">
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </div>
  );
}

function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (payload: { title: string; platform: string; time: string; type: CreateType }) => void;
}) {
  const [title, setTitle] = useState('Demo launch announcement');
  const [platform, setPlatform] = useState('Instagram');
  const [time, setTime] = useState('18:30');
  const [type, setType] = useState<CreateType>('Post');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-md border bg-card p-5 shadow-2xl dark:border-white/10">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Create New</h2>
            <p className="text-sm text-muted-foreground">
              Add an item to the publishing workflow.
            </p>
          </div>
          <Button aria-label="Close create modal" onClick={onClose} size="sm" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="create-title">
              Title
            </label>
            <Input
              id="create-title"
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              value={title}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectLike
              label="Platform"
              onChange={(value) => {
                setPlatform(value);
              }}
              options={['Instagram', 'LinkedIn', 'Pinterest', 'X']}
              value={platform}
            />
            <SelectLike
              label="Type"
              onChange={(value) => {
                setType(value as CreateType);
              }}
              options={['Post', 'Campaign', 'Approval']}
              value={type}
            />
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="create-time">
                Time
              </label>
              <Input
                id="create-time"
                onChange={(event) => {
                  setTime(event.target.value);
                }}
                type="time"
                value={time}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button
              onClick={() => {
                onCreate({ title: title.trim() || 'Untitled post', platform, time, type });
              }}
            >
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectLike({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            className={cn(
              'rounded-md border px-2 py-1 text-xs transition-colors',
              option === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted dark:border-white/10',
            )}
            key={option}
            onClick={() => {
              onChange(option);
            }}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToastMessage({ toast }: { toast: Toast }) {
  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 max-w-sm rounded-md border bg-card px-4 py-3 text-sm shadow-2xl dark:border-white/10',
        toast.tone === 'success' ? 'border-emerald-500/40' : '',
        toast.tone === 'warning' ? 'border-amber-500/40' : '',
      )}
    >
      <div className="flex items-center gap-2">
        {toast.tone === 'warning' ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        )}
        {toast.message}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground dark:border-white/10">
      {label}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2 dark:bg-white/[0.04]">
      <p className="text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function toneClass(tone: Metric['tone']): string {
  return {
    blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
    green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-200',
    rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  }[tone];
}

function metricFromPayload(metric: DashboardMetricPayload): Metric {
  return {
    label: metric.label,
    value: String(metric.value),
    detail: metric.detail,
    trend: 'Live',
    tone: metric.tone,
    icon: iconForMetric(metric.label, metric.tone),
  };
}

function scheduleFromPayload(item: DashboardOverview['schedule'][number]): ScheduleItem {
  return {
    id: item.id,
    time: formatScheduleTime(item.time),
    platform: item.platform,
    title: item.title,
    state: item.state,
    accent: accentForPlatform(item.platform),
    view: viewForDate(item.time),
  };
}

function activityFromPayload(item: DashboardOverview['activity'][number]): ActivityItem {
  return {
    id: item.id,
    title: item.title,
    detail: item.detail,
    time: formatDateTimeLabel(item.time),
    icon: item.tone === 'warning' ? AlertTriangle : CheckCircle2,
    tone: item.tone === 'warning' ? 'text-amber-500' : 'text-emerald-500',
  };
}

function platformKpiFromPayload(item: DashboardOverview['platformKpis'][number]): PlatformKpi {
  return {
    platform: item.platform,
    icon: iconForPlatform(item.platform),
    color: colorForPlatform(item.platform),
    posts: item.posts,
    engagement: `${String(item.published)} published`,
    health: `${String(item.health)}%`,
    delta: 'Live',
  };
}

function platformHealthFromPayload(item: DashboardOverview['platformHealth'][number]): PlatformKpi {
  return {
    platform: item.platform,
    icon: RadioTower,
    color: item.status === 'ACTIVE' ? 'text-emerald-500' : 'text-amber-500',
    posts: item.posts,
    engagement: item.status,
    health: `${String(item.health)}%`,
    delta: 'Live',
  };
}

function iconForMetric(label: string, tone: Metric['tone']): LucideIcon {
  if (label.toLowerCase().includes('failed') || tone === 'rose') {
    return AlertTriangle;
  }
  if (label.toLowerCase().includes('pending')) {
    return FileCheck2;
  }
  if (label.toLowerCase().includes('published')) {
    return CheckCircle2;
  }
  return Send;
}

function iconForPlatform(platform: string): LucideIcon {
  return (
    {
      Instagram: Video,
      Linkedin: Contact,
      LinkedIn: Contact,
      Pinterest: Image,
      X: AtSign,
      Facebook: ThumbsUp,
    }[platform] ?? RadioTower
  );
}

function colorForPlatform(platform: string): string {
  return (
    {
      Instagram: 'text-pink-500 dark:text-pink-400',
      Linkedin: 'text-sky-600 dark:text-sky-400',
      LinkedIn: 'text-sky-600 dark:text-sky-400',
      Pinterest: 'text-red-500 dark:text-red-400',
      X: 'text-slate-700 dark:text-zinc-200',
      Facebook: 'text-blue-600 dark:text-blue-300',
    }[platform] ?? 'text-emerald-500'
  );
}

function filterBySearch<T>(items: T[], query: string, getValues: (item: T) => string[]): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return items.filter((item) =>
    getValues(item).some((value) => value.toLowerCase().includes(normalized)),
  );
}

function daysForView(view: ScheduleView): string[] {
  if (view === 'Month') {
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
  }

  if (view === 'Week') {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  }

  return ['Mon 24', 'Tue 25', 'Wed 26', 'Thu 27', 'Fri 28'];
}

function accentForPlatform(platform: string): string {
  return (
    {
      Instagram: 'bg-pink-500',
      LinkedIn: 'bg-sky-500',
      Pinterest: 'bg-red-500',
      X: 'bg-slate-400',
    }[platform] ?? 'bg-blue-500'
  );
}

function displayNameForUser(user: AuthenticatedUser): string {
  return user.email.split('@')[0]?.replaceAll('.', ' ') ?? 'there';
}

function formatDateLabel(value: string | null): string {
  if (!value) {
    return 'recently';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTimeLabel(value: string | null): string {
  if (!value) {
    return 'recently';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatScheduleTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(value);
}

function createClientId(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Math.random().toString(36).slice(2)}-${performance.now().toString(36).replace('.', '')}`;
}

function viewForDate(value: string): ScheduleView {
  const date = new Date(value);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  }

  const weekFromNow = new Date(now);
  weekFromNow.setDate(now.getDate() + 7);

  return date <= weekFromNow ? 'Week' : 'Month';
}

function platformLabel(platform: string): string {
  return platform
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function initialsForEmail(email: string): string {
  return (
    email
      .split('@')[0]
      ?.split(/[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') ?? 'TMJ'
  );
}
