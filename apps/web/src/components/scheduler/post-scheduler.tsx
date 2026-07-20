'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  AtSign,
  BarChart3,
  Camera,
  CalendarPlus,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Library,
  Loader2,
  Menu,
  MessageSquareText,
  Moon,
  Pencil,
  Plus,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  Sun,
  Wand2,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { LogoutButton } from '@/components/auth/logout-button';
import { BrandIcon } from '@/components/brand/brand-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import type { AuthenticatedUser } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

type CalendarView = 'week' | 'month' | 'list';
type Platform = 'PINTEREST' | 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'X';
type CalendarSource = 'publish-job' | 'draft';
type PublishStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED';

interface ScheduledPost {
  id: string;
  source: CalendarSource;
  title: string;
  caption: string | null;
  platform: Platform;
  channel: string;
  platformAccount: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  status: PublishStatus;
  tags: string[];
  metadata?: Record<string, unknown> | null;
  logs: PublishLog[];
  createdAt: string;
}

interface PublishLog {
  id: string;
  level: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

interface ApiPost {
  id: string;
  source?: CalendarSource;
  title: string;
  caption: string | null;
  platform: Platform;
  channel: string;
  platformAccount: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  status: PublishStatus;
  tags: string[];
  metadata?: Record<string, unknown> | null;
  logs?: PublishLog[];
  createdAt: string;
}

type DraftStatus = 'DRAFT' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'REJECTED';

interface GeneratedDraft {
  id: string;
  platform: Platform;
  status: DraftStatus;
  title: string;
  body: string;
  hashtags: string[];
  callToAction: string | null;
  mediaUrl: string | null;
  sourceUrl: string;
  scheduledFor: string | null;
  createdAt: string;
  article: {
    id: string;
    wordpressId: number;
    title: string;
    url: string;
    categoryNames: string[];
  };
}

interface DraftsResponse {
  data: GeneratedDraft[];
  pagination: {
    total: number;
  };
}

interface DraftForm {
  title: string;
  caption: string;
  platform: Platform;
  date: string;
  time: string;
}

interface ChannelAccount {
  id: string;
  platform: Platform;
  status: 'CONNECTED' | 'ACTION_REQUIRED' | 'DISCONNECTED' | 'EXPIRED';
  displayName: string;
  externalAccountId: string | null;
}

interface Toast {
  message: string;
  tone: 'success' | 'warning';
}

interface PlatformOption {
  platform: Platform;
  label: string;
  icon: LucideIcon;
  tone: string;
}

const navigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'WordPress Hub', href: '/wordpress-hub', icon: FileText },
  { label: 'Media Library', href: '/media-library', icon: Library },
  { label: 'Scheduler', href: '/scheduler', icon: CalendarDays },
  { label: 'Channels', href: '/admin/channels', icon: RadioTower },
];

const fallbackPlatform: PlatformOption = {
  platform: 'FACEBOOK',
  label: 'Facebook',
  icon: MessageSquareText,
  tone: 'text-blue-500',
};
const platformOptions: PlatformOption[] = [
  fallbackPlatform,
  { platform: 'INSTAGRAM', label: 'Instagram', icon: Camera, tone: 'text-pink-500' },
  { platform: 'PINTEREST', label: 'Pinterest', icon: ImageIcon, tone: 'text-red-500' },
  { platform: 'LINKEDIN', label: 'LinkedIn', icon: BarChart3, tone: 'text-sky-500' },
  { platform: 'X', label: 'X', icon: AtSign, tone: 'text-zinc-700 dark:text-zinc-200' },
];

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const timeSlots = Array.from({ length: 15 }, (_value, index) => index + 7);
const schedulerHref = (href: string) => href as Parameters<typeof Link>[0]['href'];

export function PostScheduler({ user }: { user: AuthenticatedUser }) {
  const apiBaseUrl = getApiBaseUrl();
  const [view, setView] = useState<CalendarView>('week');
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);
  const [channels, setChannels] = useState<ChannelAccount[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [draftFilter, setDraftFilter] = useState<Platform | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [creating, setCreating] = useState(false);
  const [autoPlanning, setAutoPlanning] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [schedulingDraftId, setSchedulingDraftId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [draggedDraftId, setDraggedDraftId] = useState<string | null>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [form, setForm] = useState<DraftForm>({
    title: '',
    caption: '',
    platform: 'FACEBOOK',
    date: selectedDate,
    time: '09:00',
  });
  const [timeEditor, setTimeEditor] = useState({
    date: selectedDate,
    time: '09:00',
  });

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
    void loadCalendarData();
  }, []);

  const resetDraftDrag = useCallback(() => {
    setDraggedDraftId(null);
    document.body.classList.remove('sf-dragging-draft');
  }, []);

  useEffect(() => {
    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        resetDraftDrag();
      }
    }

    window.addEventListener('dragend', resetDraftDrag);
    window.addEventListener('drop', resetDraftDrag);
    window.addEventListener('blur', resetDraftDrag);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('dragend', resetDraftDrag);
      window.removeEventListener('drop', resetDraftDrag);
      window.removeEventListener('blur', resetDraftDrag);
      window.removeEventListener('keyup', handleKeyUp);
      document.body.classList.remove('sf-dragging-draft');
    };
  }, [resetDraftDrag]);

  useEffect(() => {
    setForm((current) => ({ ...current, date: selectedDate }));
  }, [selectedDate]);

  const visibleDates = useMemo(() => {
    if (view === 'month') {
      return monthDates(selectedDate);
    }

    return weekDates(selectedDate);
  }, [selectedDate, view]);

  const filteredPosts = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return posts.filter((post) => {
      const platformMatch = selectedPlatform === 'ALL' || post.platform === selectedPlatform;
      const searchMatch =
        !cleanSearch ||
        post.title.toLowerCase().includes(cleanSearch) ||
        post.channel.toLowerCase().includes(cleanSearch) ||
        (post.caption?.toLowerCase().includes(cleanSearch) ?? false);
      return platformMatch && searchMatch;
    });
  }, [posts, search, selectedPlatform]);

  const selectedDayPosts = filteredPosts
    .filter(
      (post) => post.scheduledFor && toDateInputValue(new Date(post.scheduledFor)) === selectedDate,
    )
    .sort((a, b) => dateTimeValue(a.scheduledFor) - dateTimeValue(b.scheduledFor));
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? selectedDayPosts[0] ?? null;

  useEffect(() => {
    if (!selectedPost?.scheduledFor) {
      setTimeEditor((current) => ({ ...current, date: selectedDate }));
      return;
    }

    const scheduledAt = new Date(selectedPost.scheduledFor);
    setTimeEditor({
      date: toDateInputValue(scheduledAt),
      time: toTimeInputValue(scheduledAt),
    });
  }, [selectedDate, selectedPost]);

  const scheduledCount = posts.filter((post) => post.status === 'SCHEDULED').length;
  const needsReviewCount = posts.filter(
    (post) => post.status === 'PENDING_APPROVAL' || post.status === 'FAILED',
  ).length;
  const pendingApprovalIds = filteredPosts
    .filter((post) => post.source === 'publish-job' && post.status === 'PENDING_APPROVAL')
    .map((post) => post.id);
  const publishedCount = posts.filter((post) => post.status === 'PUBLISHED').length;
  const visibleDrafts = useMemo(() => {
    const cleanSearch = draftSearch.trim().toLowerCase();

    return drafts.filter((draft) => {
      const available = draft.status !== 'PUBLISHED' && draft.status !== 'REJECTED';
      const platformMatch = draftFilter === 'ALL' || draft.platform === draftFilter;
      const searchMatch =
        !cleanSearch ||
        draft.title.toLowerCase().includes(cleanSearch) ||
        draft.body.toLowerCase().includes(cleanSearch) ||
        draft.article.title.toLowerCase().includes(cleanSearch);

      return available && platformMatch && searchMatch;
    });
  }, [draftFilter, draftSearch, drafts]);
  const unscheduledDraftCount = drafts.filter(
    (draft) => !draft.scheduledFor && draft.status !== 'PUBLISHED' && draft.status !== 'REJECTED',
  ).length;
  const scheduledDraftCount = drafts.filter((draft) => draft.scheduledFor).length;
  const dailySlotsUsed = selectedDayPosts.length;

  async function loadCalendarData() {
    await Promise.all([loadPosts(), loadDrafts(), loadChannels()]);
  }

  async function loadPosts() {
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/scheduler/posts`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Calendar posts could not be loaded.');
      }

      const payload = (await response.json()) as { data: ApiPost[] };
      setPosts(payload.data.map(postFromApi));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Scheduler failed to load.', 'warning');
    } finally {
      setLoading(false);
    }
  }

  async function loadDrafts() {
    setLoadingDrafts(true);
    try {
      const params = new URLSearchParams({ page: '1', perPage: '200' });
      const response = await fetch(`${apiBaseUrl}/api/wordpress/drafts?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Generated drafts could not be loaded.');
      }

      const payload = (await response.json()) as DraftsResponse;
      setDrafts(payload.data);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Draft inbox failed to load.', 'warning');
    } finally {
      setLoadingDrafts(false);
    }
  }

  async function loadChannels() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/social-channels`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Connected channels could not be loaded.');
      }

      setChannels((await response.json()) as ChannelAccount[]);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Channel lookup failed.', 'warning');
    }
  }

  async function createScheduledPost() {
    if (!form.title.trim()) {
      notify('Add a post title before scheduling.', 'warning');
      return;
    }

    setCreating(true);
    try {
      const scheduledFor = new Date(`${form.date}T${form.time}:00`);
      const response = await fetch(`${apiBaseUrl}/api/scheduler/posts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          caption: form.caption.trim() || undefined,
          platform: form.platform,
          scheduledFor: scheduledFor.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Post could not be scheduled.');
      }

      notify('Post scheduled.', 'success');
      setForm((current) => ({ ...current, title: '', caption: '' }));
      await loadCalendarData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Post scheduling failed.', 'warning');
    } finally {
      setCreating(false);
    }
  }

  async function createAiDailyPlan() {
    setAutoPlanning(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/scheduler/auto-plan`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, count: 5 }),
      });
      const payload = (await response.json().catch(() => null)) as {
        planned?: number;
        message?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          payload?.message ?? payload?.error ?? 'AI daily plan could not be created.',
        );
      }

      notify(`AI planned ${String(payload?.planned ?? 0)} posts for final approval.`, 'success');
      await loadCalendarData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'AI auto-scheduling failed.', 'warning');
    } finally {
      setAutoPlanning(false);
    }
  }

  async function approveScheduledPost(id: string) {
    setApprovingId(id);
    try {
      const response = await fetch(`${apiBaseUrl}/api/scheduler/posts/${id}/approve`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Post could not be approved.');
      }

      notify('Post approved and scheduled.', 'success');
      await loadCalendarData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Approval failed.', 'warning');
    } finally {
      setApprovingId(null);
    }
  }

  async function approveVisiblePendingPosts() {
    if (!pendingApprovalIds.length) {
      notify('No pending AI-planned posts are visible.', 'warning');
      return;
    }

    setApprovingId('bulk');
    try {
      const response = await fetch(`${apiBaseUrl}/api/scheduler/posts/approve`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pendingApprovalIds }),
      });
      const payload = (await response.json().catch(() => null)) as { approved?: number } | null;

      if (!response.ok) {
        throw new Error('Posts could not be approved.');
      }

      notify(
        `Approved ${String(payload?.approved ?? pendingApprovalIds.length)} scheduled posts.`,
        'success',
      );
      await loadCalendarData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Bulk approval failed.', 'warning');
    } finally {
      setApprovingId(null);
    }
  }

  async function scheduleGeneratedDraft(draftId: string, date: string, hour: number, minute = 0) {
    setSchedulingDraftId(draftId);
    try {
      const scheduledFor = new Date(
        `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
      );
      const response = await fetch(`${apiBaseUrl}/api/wordpress/drafts/${draftId}/schedule`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: scheduledFor.toISOString() }),
      });

      if (!response.ok) {
        throw new Error('Draft could not be scheduled.');
      }

      notify('Draft scheduled on the calendar.', 'success');
      await loadCalendarData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Draft scheduling failed.', 'warning');
    } finally {
      setSchedulingDraftId(null);
      resetDraftDrag();
    }
  }

  async function updateScheduledTime(post: ScheduledPost, date: string, time: string) {
    setReschedulingId(post.id);

    try {
      const scheduledFor = new Date(`${date}T${time}:00`);
      const endpoint =
        post.source === 'draft'
          ? `${apiBaseUrl}/api/wordpress/drafts/${post.id}/schedule`
          : `${apiBaseUrl}/api/scheduler/posts/${post.id}/schedule`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: scheduledFor.toISOString() }),
      });

      if (!response.ok) {
        throw new Error('Scheduled time could not be updated.');
      }

      notify('Scheduled time updated.', 'success');
      await loadCalendarData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update scheduled time.', 'warning');
    } finally {
      setReschedulingId(null);
    }
  }

  async function publishPostNow(post: ScheduledPost) {
    const channelId = metadataString(post.metadata, 'channelAccountId');
    const channel =
      channels.find((item) => item.id === channelId && item.status === 'CONNECTED') ??
      channels.find((item) => item.platform === post.platform && item.status === 'CONNECTED');

    if (!channel) {
      notify(`Connect an active ${titleCase(post.platform)} channel before posting.`, 'warning');
      return;
    }

    if (!post.caption?.trim()) {
      notify('This post needs a caption before it can be posted.', 'warning');
      return;
    }

    setPublishingId(post.id);
    try {
      const draftId = metadataString(post.metadata, 'draftId') ?? (post.source === 'draft' ? post.id : undefined);
      const mediaUrl = metadataString(post.metadata, 'mediaUrl') ?? undefined;
      const shouldHydrateMediaFromDraft = Boolean(
        draftId && mediaUrl?.startsWith('data:image/') && post.platform === 'FACEBOOK',
      );
      const response = await fetch(`${apiBaseUrl}/api/social-channels/${channel.id}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          title: post.title,
          caption: post.caption,
          hashtags: post.tags,
          ...(mediaUrl && !shouldHydrateMediaFromDraft ? { mediaUrl } : {}),
          sourceUrl: metadataString(post.metadata, 'sourceUrl') ?? undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        published?: boolean;
        error?: string;
        message?: string | string[];
      } | null;

      if (!response.ok || payload?.published === false) {
        const message = Array.isArray(payload?.message)
          ? payload.message.join(' ')
          : payload?.message;
        throw new Error(payload?.error ?? message ?? 'Post could not be published.');
      }

      notify(`${titleCase(post.platform)} posted now.`, 'success');
      await loadCalendarData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Post now failed.', 'warning');
    } finally {
      setPublishingId(null);
    }
  }

  function scheduleDraggedDraft(date: string, hour: number) {
    if (!draggedDraftId) {
      return;
    }

    void scheduleGeneratedDraft(draggedDraftId, date, hour);
  }

  function selectPost(post: ScheduledPost) {
    setSelectedPostId(post.id);
    setSelectedDate(
      post.scheduledFor ? toDateInputValue(new Date(post.scheduledFor)) : selectedDate,
    );
  }

  function notify(message: string, tone: Toast['tone']) {
    setToast({ message, tone });
    window.setTimeout(() => {
      setToast(null);
    }, 3200);
  }

  function toggleTheme() {
    const current = darkMode ?? document.documentElement.classList.contains('dark');
    const next = !current;
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem('socialflow-theme', next ? 'dark' : 'light');
    setDarkMode(next);
  }

  return (
    <div className="sf-app-bg min-h-screen text-foreground">
      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        <SchedulerSidebar user={user} />
      </Sheet>
      <div className="grid min-h-screen lg:grid-cols-[17rem_1fr]">
        <aside className="hidden border-r border-border/70 bg-card/90 backdrop-blur-xl dark:border-white/10 lg:block">
          <SchedulerSidebar user={user} />
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/82 backdrop-blur-2xl dark:border-white/10">
            <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 xl:px-8">
              <Button
                aria-label="Open navigation"
                className="lg:hidden"
                onClick={() => {
                  setNavigationOpen(true);
                }}
                size="sm"
                variant="ghost"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-semibold tracking-normal">Content Calendar</h1>
                <p className="hidden text-sm text-muted-foreground md:block">
                  Schedule, review, and monitor publishing across every channel.
                </p>
              </div>
              <ViewSwitcher view={view} onViewChange={setView} />
              <Button aria-label="Toggle theme" onClick={toggleTheme} size="sm" variant="outline">
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <LogoutButton />
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-[96rem] flex-col gap-4 px-4 py-4 sm:px-6 xl:px-8">
            {toast ? (
              <div
                className={cn(
                  'rounded-lg border px-4 py-3 text-sm shadow-sm',
                  toast.tone === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                )}
              >
                {toast.message}
              </div>
            ) : null}

            <section className="space-y-3">
              <PlannerHero
                autoPlanning={autoPlanning}
                draftCount={unscheduledDraftCount}
                scheduledDraftCount={scheduledDraftCount}
                needsReviewCount={needsReviewCount}
                pendingApprovalCount={pendingApprovalIds.length}
                publishedCount={publishedCount}
                scheduledCount={scheduledCount}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                view={view}
                onApprovePending={() => {
                  void approveVisiblePendingPosts();
                }}
                onAutoPlan={() => {
                  void createAiDailyPlan();
                }}
              />
              <PlannerFilters
                onRefresh={() => {
                  void loadCalendarData();
                }}
                search={search}
                selectedPlatform={selectedPlatform}
                setSearch={setSearch}
                setSelectedPlatform={setSelectedPlatform}
              />
            </section>

            <section className="grid items-start gap-4 xl:grid-cols-[19rem_minmax(0,1fr)_24rem]">
              <DraftInbox
                drafts={visibleDrafts}
                draftFilter={draftFilter}
                draftSearch={draftSearch}
                loading={loadingDrafts}
                schedulingDraftId={schedulingDraftId}
                setDraftFilter={setDraftFilter}
                setDraftSearch={setDraftSearch}
                onDragEnd={resetDraftDrag}
                onDragStart={(draftId) => {
                  document.body.classList.add('sf-dragging-draft');
                  setDraggedDraftId(draftId);
                }}
                onRefresh={() => {
                  void loadDrafts();
                }}
                onSchedule={(draftId, hour) => {
                  void scheduleGeneratedDraft(draftId, selectedDate, hour);
                }}
              />
              <div className="min-w-0">
                {view === 'month' ? (
                  <MonthPlanner
                    draggedDraftId={draggedDraftId}
                    posts={filteredPosts}
                    selectedPostId={selectedPost?.id ?? null}
                    selectedDate={selectedDate}
                    visibleDates={visibleDates}
                    onSelectDate={setSelectedDate}
                    onSelectPost={selectPost}
                    onDropDraft={(date) => {
                      scheduleDraggedDraft(date, 9);
                    }}
                  />
                ) : view === 'list' ? (
                  <ListPlanner
                    approvingId={approvingId}
                    posts={filteredPosts}
                    publishingId={publishingId}
                    reschedulingId={reschedulingId}
                    selectedPostId={selectedPost?.id ?? null}
                    onApprove={(id) => {
                      void approveScheduledPost(id);
                    }}
                    onPostNow={(post) => {
                      void publishPostNow(post);
                    }}
                    onSelectPost={selectPost}
                  />
                ) : (
                  <WeekPlanner
                    draggedDraftId={draggedDraftId}
                    loading={loading}
                    posts={filteredPosts}
                    selectedPostId={selectedPost?.id ?? null}
                    selectedDate={selectedDate}
                    visibleDates={visibleDates}
                    onSelectDate={setSelectedDate}
                    onSelectPost={selectPost}
                    onDropDraft={scheduleDraggedDraft}
                  />
                )}
              </div>

              <aside className="grid gap-4 xl:sticky xl:top-24">
                <SelectedPostPanel
                  approving={selectedPost ? approvingId === selectedPost.id || approvingId === 'bulk' : false}
                  channels={channels}
                  post={selectedPost}
                  publishing={selectedPost ? publishingId === selectedPost.id : false}
                  rescheduling={selectedPost ? reschedulingId === selectedPost.id : false}
                  timeEditor={timeEditor}
                  setTimeEditor={setTimeEditor}
                  onApprove={(post) => {
                    void approveScheduledPost(post.id);
                  }}
                  onPostNow={(post) => {
                    void publishPostNow(post);
                  }}
                  onSaveTime={(post) => {
                    void updateScheduledTime(post, timeEditor.date, timeEditor.time);
                  }}
                />
                <CreatePostPanel
                  creating={creating}
                  form={form}
                  setForm={setForm}
                  onCreate={() => {
                    void createScheduledPost();
                  }}
                />
                <ReviewQueue
                  approvingId={approvingId}
                  posts={posts}
                  selectedPostId={selectedPost?.id ?? null}
                  onApprove={(id) => {
                    void approveScheduledPost(id);
                  }}
                  onSelectPost={selectPost}
                />
                <DayWorkload
                  date={selectedDate}
                  posts={selectedDayPosts}
                  draftCount={dailySlotsUsed}
                />
                <ChannelHealth posts={posts} />
              </aside>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function SchedulerSidebar({ user }: { user: AuthenticatedUser }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-screen flex-col px-4 py-5">
      <div className="flex items-center gap-3 px-2">
        <BrandIcon className="h-10 w-10 rounded-xl" priority />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">TMJ SocialFlow AI</p>
          <p className="text-xs text-muted-foreground">Publishing planner</p>
        </div>
      </div>
      <nav className="mt-8 space-y-1">
        {navigation.map((item) => (
          <Link
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-white/[0.05]',
            )}
            href={schedulerHref(item.href)}
            key={item.href}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto rounded-lg border border-border bg-background/70 p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
        <p className="text-xs text-muted-foreground">Signed in as</p>
        <p className="mt-1 break-words font-medium">{user.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">Super Admin</p>
      </div>
    </div>
  );
}

function PlannerHero({
  selectedDate,
  view,
  scheduledCount,
  draftCount,
  scheduledDraftCount,
  needsReviewCount,
  pendingApprovalCount,
  publishedCount,
  autoPlanning,
  setSelectedDate,
  onApprovePending,
  onAutoPlan,
}: {
  selectedDate: string;
  view: CalendarView;
  scheduledCount: number;
  draftCount: number;
  scheduledDraftCount: number;
  needsReviewCount: number;
  pendingApprovalCount: number;
  publishedCount: number;
  autoPlanning: boolean;
  setSelectedDate: (date: string) => void;
  onApprovePending: () => void;
  onAutoPlan: () => void;
}) {
  const step = view === 'month' ? 30 : 7;

  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 shadow-sm dark:border-white/10">
      <CardContent className="grid gap-5 p-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(22rem,34rem)] lg:items-stretch">
        <div className="min-w-0 rounded-xl border border-border bg-background/60 p-4 dark:border-white/10 dark:bg-white/[0.025]">
          <Badge
            className="mb-3 border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
            variant="outline"
          >
            <CalendarClock className="mr-1 h-3.5 w-3.5" />
            AI-assisted publishing planner
          </Badge>
          <h2 className="text-2xl font-semibold tracking-normal">
            {formatDateLabel(selectedDate, view)}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Generate five unique WordPress-based posts, spread them across connected channels, and
            review every scheduled item before it goes live.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <SummaryPill label="Scheduled" value={scheduledCount} />
            <SummaryPill label="Draft inbox" value={draftCount} />
            <SummaryPill label="Drafts planned" value={scheduledDraftCount} tone="success" />
            <SummaryPill label="Review" value={needsReviewCount} tone="warning" />
            <SummaryPill label="Published" value={publishedCount} tone="success" />
          </div>
        </div>
        <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 dark:border-primary/25 dark:bg-primary/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Daily AI planner</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Creates post copy, assigns random time slots, and holds everything for approval.
              </p>
            </div>
            <Badge
              className={cn(
                pendingApprovalCount
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              )}
              variant="outline"
            >
              {pendingApprovalCount ? `${String(pendingApprovalCount)} pending` : 'Clear'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-11" disabled={autoPlanning} onClick={onAutoPlan}>
              {autoPlanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Plan 5 posts
            </Button>
            <Button
              className="h-11"
              disabled={!pendingApprovalCount || autoPlanning}
              onClick={onApprovePending}
              variant="outline"
            >
              <Send className="h-4 w-4" />
              Approve all
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              aria-label="Previous period"
              onClick={() => {
                setSelectedDate(addDays(selectedDate, -step));
              }}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              aria-label="Selected date"
              className="h-9 min-w-0 flex-1"
              onChange={(event) => {
                setSelectedDate(event.target.value);
              }}
              type="date"
              value={selectedDate}
            />
            <Button
              aria-label="Next period"
              onClick={() => {
                setSelectedDate(addDays(selectedDate, step));
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
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning';
}) {
  return (
    <div className="min-w-24 rounded-lg border border-border bg-background/80 px-3 py-2 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div
        className={cn(
          'text-lg font-semibold',
          tone === 'success' ? 'text-emerald-600 dark:text-emerald-300' : '',
          tone === 'warning' ? 'text-amber-600 dark:text-amber-300' : '',
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PlannerFilters({
  selectedPlatform,
  setSelectedPlatform,
  search,
  setSearch,
  onRefresh,
}: {
  selectedPlatform: Platform | 'ALL';
  setSelectedPlatform: (platform: Platform | 'ALL') => void;
  search: string;
  setSearch: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <Card className="border-border/80 bg-card/95 dark:border-white/10">
      <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search scheduled posts, captions, channels"
            value={search}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
          <FilterChip
            active={selectedPlatform === 'ALL'}
            label="All"
            onClick={() => {
              setSelectedPlatform('ALL');
            }}
          />
          {platformOptions.map((item) => (
            <FilterChip
              active={selectedPlatform === item.platform}
              icon={<item.icon className={cn('h-4 w-4', item.tone)} />}
              key={item.platform}
              label={item.label}
              onClick={() => {
                setSelectedPlatform(item.platform);
              }}
            />
          ))}
          <Button onClick={onRefresh} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background/70 text-muted-foreground hover:border-primary/40 hover:text-foreground dark:border-white/10 dark:bg-white/[0.03]',
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function ViewSwitcher({
  view,
  onViewChange,
}: {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
}) {
  return (
    <div className="hidden rounded-lg border border-border bg-background/70 p-1 dark:border-white/10 dark:bg-white/[0.03] sm:flex">
      {(['week', 'month', 'list'] as const).map((item) => (
        <button
          className={cn(
            'h-8 rounded-md px-3 text-sm font-medium capitalize transition',
            view === item
              ? 'bg-primary text-primary-foreground shadow-sm'
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
  );
}

function CreatePostPanel({
  form,
  setForm,
  creating,
  onCreate,
}: {
  form: DraftForm;
  setForm: (updater: (value: DraftForm) => DraftForm) => void;
  creating: boolean;
  onCreate: () => void;
}) {
  return (
    <Card className="border-border/80 bg-card/95 dark:border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4" />
          Schedule post
        </CardTitle>
        <CardDescription>Manual post, separate from generated drafts.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        <Field label="Channel">
          <select
            className="sf-focus-ring h-10 rounded-lg border border-input bg-background/80 px-3 text-sm dark:bg-white/[0.035]"
            onChange={(event) => {
              setForm((value) => ({ ...value, platform: event.target.value as Platform }));
            }}
            value={form.platform}
          >
            {platformOptions.map((item) => (
              <option key={item.platform} value={item.platform}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Post title">
          <Input
            onChange={(event) => {
              setForm((value) => ({ ...value, title: event.target.value }));
            }}
            placeholder="Campaign post title"
            value={form.title}
          />
        </Field>
        <Field label="Caption">
          <textarea
            className="sf-focus-ring min-h-20 resize-none rounded-lg border border-input bg-background/80 px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground dark:bg-white/[0.035]"
            onChange={(event) => {
              setForm((value) => ({ ...value, caption: event.target.value }));
            }}
            placeholder="Write the post caption"
            value={form.caption}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input
              onChange={(event) => {
                setForm((value) => ({ ...value, date: event.target.value }));
              }}
              type="date"
              value={form.date}
            />
          </Field>
          <Field label="Time">
            <Input
              onChange={(event) => {
                setForm((value) => ({ ...value, time: event.target.value }));
              }}
              type="time"
              value={form.time}
            />
          </Field>
        </div>
        <Button disabled={creating} onClick={onCreate}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Schedule
        </Button>
      </CardContent>
    </Card>
  );
}

function SelectedPostPanel({
  post,
  channels,
  timeEditor,
  approving,
  publishing,
  rescheduling,
  setTimeEditor,
  onApprove,
  onPostNow,
  onSaveTime,
}: {
  post: ScheduledPost | null;
  channels: ChannelAccount[];
  timeEditor: { date: string; time: string };
  approving: boolean;
  publishing: boolean;
  rescheduling: boolean;
  setTimeEditor: (updater: (value: { date: string; time: string }) => { date: string; time: string }) => void;
  onApprove: (post: ScheduledPost) => void;
  onPostNow: (post: ScheduledPost) => void;
  onSaveTime: (post: ScheduledPost) => void;
}) {
  const connectedChannel = post
    ? channels.find((item) => item.platform === post.platform && item.status === 'CONNECTED')
    : null;
  const sourceUrl = post ? metadataString(post.metadata, 'sourceUrl') : null;

  return (
    <Card className="border-border/80 bg-card/95 shadow-sm dark:border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Pencil className="h-4 w-4" />
          Selected post
        </CardTitle>
        <CardDescription>Change time, approve, or publish immediately.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {post ? (
          <>
            <div className="rounded-xl border border-border bg-background/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge variant="secondary">{titleCase(post.platform)}</Badge>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold">{post.title}</h3>
                </div>
                <StatusBadge status={post.status} />
              </div>
              {post.caption ? (
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                  {post.caption}
                </p>
              ) : null}
              {sourceUrl ? (
                <a
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  href={sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Source article
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input
                  onChange={(event) => {
                    setTimeEditor((value) => ({ ...value, date: event.target.value }));
                  }}
                  type="date"
                  value={timeEditor.date}
                />
              </Field>
              <Field label="Time">
                <Input
                  onChange={(event) => {
                    setTimeEditor((value) => ({ ...value, time: event.target.value }));
                  }}
                  type="time"
                  value={timeEditor.time}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={rescheduling}
                onClick={() => {
                  onSaveTime(post);
                }}
                variant="outline"
              >
                {rescheduling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarClock className="h-4 w-4" />
                )}
                Save time
              </Button>
              <Button
                disabled={publishing || !connectedChannel}
                onClick={() => {
                  onPostNow(post);
                }}
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Post now
              </Button>
            </div>
            {post.status === 'PENDING_APPROVAL' ? (
              <Button
                disabled={approving}
                onClick={() => {
                  onApprove(post);
                }}
                variant="outline"
              >
                {approving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Final approval
              </Button>
            ) : null}
            {!connectedChannel ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                Connect an active {titleCase(post.platform)} channel before using quick post.
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState label="Select a calendar item to manage it." />
        )}
      </CardContent>
    </Card>
  );
}

function DraftInbox({
  drafts,
  loading,
  draftSearch,
  draftFilter,
  schedulingDraftId,
  setDraftSearch,
  setDraftFilter,
  onDragStart,
  onDragEnd,
  onSchedule,
  onRefresh,
}: {
  drafts: GeneratedDraft[];
  loading: boolean;
  draftSearch: string;
  draftFilter: Platform | 'ALL';
  schedulingDraftId: string | null;
  setDraftSearch: (value: string) => void;
  setDraftFilter: (platform: Platform | 'ALL') => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onSchedule: (id: string, hour: number) => void;
  onRefresh: () => void;
}) {
  return (
    <Card className="h-fit overflow-hidden border-border/80 bg-card/95 dark:border-white/10 xl:sticky xl:top-24">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="h-4 w-4" />
              Generated drafts
            </CardTitle>
            <CardDescription>Drag active drafts into daily or weekly slots.</CardDescription>
          </div>
          <Button aria-label="Refresh drafts" onClick={onRefresh} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => {
              setDraftSearch(event.target.value);
            }}
            placeholder="Search generated drafts"
            value={draftSearch}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip
            active={draftFilter === 'ALL'}
            label="All"
            onClick={() => {
              setDraftFilter('ALL');
            }}
          />
          {platformOptions.map((item) => (
            <button
              aria-label={item.label}
              className={cn(
                'flex h-9 w-10 shrink-0 items-center justify-center rounded-lg border transition',
                draftFilter === item.platform
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background/70 hover:border-primary/40 dark:border-white/10 dark:bg-white/[0.03]',
              )}
              key={item.platform}
              onClick={() => {
                setDraftFilter(item.platform);
              }}
              type="button"
            >
              <item.icon
                className={cn('h-4 w-4', draftFilter === item.platform ? '' : item.tone)}
              />
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
          Showing draft and scheduled generated content. Drop any item onto a time slot to schedule
          or move it.
        </div>
        <div className="grid max-h-[46rem] gap-3 overflow-auto pr-1">
          {loading ? (
            <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground dark:border-white/10">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Loading generated drafts
            </div>
          ) : drafts.length ? (
            drafts.map((draft) => (
              <GeneratedDraftCard
                draft={draft}
                key={draft.id}
                scheduling={schedulingDraftId === draft.id}
                onDragEnd={onDragEnd}
                onDragStart={() => {
                  onDragStart(draft.id);
                }}
                onSchedule={(hour) => {
                  onSchedule(draft.id, hour);
                }}
              />
            ))
          ) : (
            <EmptyState label="No unscheduled generated drafts match this filter." />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function GeneratedDraftCard({
  draft,
  scheduling,
  onDragStart,
  onDragEnd,
  onSchedule,
}: {
  draft: GeneratedDraft;
  scheduling: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onSchedule: (hour: number) => void;
}) {
  const config =
    platformOptions.find((item) => item.platform === draft.platform) ?? fallbackPlatform;
  const Icon = config.icon;

  return (
    <article
      className="select-none rounded-xl border border-border bg-background/80 p-3 shadow-sm transition hover:border-primary/50 dark:border-white/10 dark:bg-white/[0.04] [&[draggable='true']]:cursor-grab [&[draggable='true']]:active:cursor-grabbing"
      draggable
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draft.id);
        onDragStart();
      }}
    >
      <div className="flex gap-3">
        {draft.mediaUrl ? (
          <img alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" src={draft.mediaUrl} />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted dark:bg-white/[0.06]">
            <Icon className={cn('h-5 w-5', config.tone)} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className={cn('h-3.5 w-3.5', config.tone)} />
            <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
            <Badge variant="secondary">{titleCase(draft.status)}</Badge>
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold">{draft.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{draft.body}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {draft.hashtags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="outline">
            {tag.startsWith('#') ? tag : `#${tag}`}
          </Badge>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[9, 13, 18].map((hour) => (
          <Button
            disabled={scheduling}
            key={hour}
            onClick={() => {
              onSchedule(hour);
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            size="sm"
            variant="outline"
          >
            {scheduling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarPlus className="h-3.5 w-3.5" />
            )}
            {formatHour(hour)}
          </Button>
        ))}
      </div>
    </article>
  );
}

function WeekPlanner({
  visibleDates,
  selectedDate,
  posts,
  loading,
  draggedDraftId,
  selectedPostId,
  onSelectDate,
  onSelectPost,
  onDropDraft,
}: {
  visibleDates: string[];
  selectedDate: string;
  posts: ScheduledPost[];
  loading: boolean;
  draggedDraftId: string | null;
  selectedPostId: string | null;
  onSelectDate: (date: string) => void;
  onSelectPost: (post: ScheduledPost) => void;
  onDropDraft: (date: string, hour: number) => void;
}) {
  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 dark:border-white/10">
      <div
        className="hidden border-b border-border bg-muted/40 dark:border-white/10 dark:bg-white/[0.03] lg:grid"
        style={{
          gridTemplateColumns: `4.75rem repeat(${String(visibleDates.length)}, minmax(9.5rem, 1fr))`,
        }}
      >
        <div className="p-3 text-xs font-medium text-muted-foreground">Time</div>
        {visibleDates.map((date, index) => (
          <button
            className={cn(
              'border-l border-border p-3 text-left transition hover:bg-muted/70 dark:border-white/10 dark:hover:bg-white/[0.05]',
              date === selectedDate ? 'bg-primary/10' : '',
            )}
            key={date}
            onClick={() => {
              onSelectDate(date);
            }}
            type="button"
          >
            <div className="text-xs text-muted-foreground">{weekDays[index]}</div>
            <div className="text-sm font-semibold">{shortDate(date)}</div>
          </button>
        ))}
      </div>

      <div className="hidden max-h-[48rem] overflow-auto lg:block">
        {loading ? (
          <CalendarLoading />
        ) : (
          timeSlots.map((hour) => (
            <div
              className="grid min-h-28 border-b border-border dark:border-white/10"
              key={hour}
              style={{
                gridTemplateColumns: `4.75rem repeat(${String(visibleDates.length)}, minmax(9.5rem, 1fr))`,
              }}
            >
              <div className="border-r border-border p-3 text-xs text-muted-foreground dark:border-white/10">
                {formatHour(hour)}
              </div>
              {visibleDates.map((date) => {
                const slotPosts = postsForSlot(posts, date, hour);
                return (
                  <div
                    className={cn(
                      'space-y-2 border-l border-border p-2 transition dark:border-white/10',
                      draggedDraftId ? 'bg-primary/5 ring-1 ring-inset ring-primary/15' : '',
                    )}
                    key={`${date}-${String(hour)}`}
                    onDragOver={(event) => {
                      if (draggedDraftId) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      onDropDraft(date, hour);
                    }}
                  >
                    {draggedDraftId && !slotPosts.length ? (
                      <div className="flex h-full min-h-20 items-center justify-center rounded-lg border border-dashed border-primary/40 text-xs font-medium text-primary">
                        Drop at {formatHour(hour)}
                      </div>
                    ) : null}
                    {slotPosts.map((post) => (
                      <PostCard
                        compact
                        key={post.id}
                        post={post}
                        selected={selectedPostId === post.id}
                        onSelect={() => {
                          onSelectPost(post);
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {visibleDates.map((date) => {
          const dayPosts = postsForDate(posts, date);
          return (
            <div
              className={cn(
                'rounded-lg border border-border bg-background/70 p-3 text-left dark:border-white/10 dark:bg-white/[0.03]',
                date === selectedDate ? 'border-primary ring-2 ring-primary/20' : '',
                draggedDraftId ? 'border-primary/50 bg-primary/5' : '',
              )}
              key={date}
              onDragOver={(event) => {
                if (draggedDraftId) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                onDropDraft(date, 9);
              }}
              onClick={() => {
                onSelectDate(date);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{weekdayLabel(date)}</div>
                  <div className="text-xs text-muted-foreground">{shortDate(date)}</div>
                </div>
                <Badge variant="secondary">{dayPosts.length} posts</Badge>
              </div>
              <div className="mt-3 grid gap-2">
                {dayPosts.slice(0, 3).map((post) => (
                  <PostCard
                    compact
                    key={post.id}
                    post={post}
                    selected={selectedPostId === post.id}
                    onSelect={() => {
                      onSelectPost(post);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function MonthPlanner({
  visibleDates,
  selectedDate,
  posts,
  draggedDraftId,
  selectedPostId,
  onSelectDate,
  onSelectPost,
  onDropDraft,
}: {
  visibleDates: string[];
  selectedDate: string;
  posts: ScheduledPost[];
  draggedDraftId: string | null;
  selectedPostId: string | null;
  onSelectDate: (date: string) => void;
  onSelectPost: (post: ScheduledPost) => void;
  onDropDraft: (date: string) => void;
}) {
  const currentMonth = parseLocalDate(selectedDate).getMonth();

  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 dark:border-white/10">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
        {weekDays.map((day) => (
          <div className="p-3" key={day}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
        {visibleDates.map((date) => {
          const dayPosts = postsForDate(posts, date);
          const isMuted = parseLocalDate(date).getMonth() !== currentMonth;

          return (
            <div
              className={cn(
                'min-h-36 border-b border-r border-border p-3 text-left transition hover:bg-muted/45 dark:border-white/10 dark:hover:bg-white/[0.04]',
                date === selectedDate ? 'bg-primary/10 ring-2 ring-inset ring-primary/25' : '',
                draggedDraftId ? 'bg-primary/5' : '',
                isMuted ? 'text-muted-foreground' : '',
              )}
              key={date}
              onDragOver={(event) => {
                if (draggedDraftId) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                onDropDraft(date);
              }}
              onClick={() => {
                onSelectDate(date);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{shortDate(date)}</span>
                {dayPosts.length ? <Badge variant="secondary">{dayPosts.length}</Badge> : null}
              </div>
              <div className="mt-3 space-y-1.5">
                {draggedDraftId && !dayPosts.length ? (
                  <div className="rounded-md border border-dashed border-primary/40 px-2 py-3 text-center text-xs font-medium text-primary">
                    Drop here
                  </div>
                ) : null}
                {dayPosts.slice(0, 3).map((post) => (
                  <MonthPostPill
                    key={post.id}
                    post={post}
                    selected={selectedPostId === post.id}
                    onSelect={() => {
                      onSelectPost(post);
                    }}
                  />
                ))}
                {dayPosts.length > 3 ? (
                  <div className="text-xs text-muted-foreground">
                    +{String(dayPosts.length - 3)} more
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ListPlanner({
  posts,
  approvingId,
  publishingId,
  selectedPostId,
  onApprove,
  onPostNow,
  onSelectPost,
}: {
  posts: ScheduledPost[];
  approvingId: string | null;
  publishingId: string | null;
  reschedulingId: string | null;
  selectedPostId: string | null;
  onApprove: (id: string) => void;
  onPostNow: (post: ScheduledPost) => void;
  onSelectPost: (post: ScheduledPost) => void;
}) {
  const sortedPosts = [...posts].sort(
    (a, b) => dateTimeValue(a.scheduledFor) - dateTimeValue(b.scheduledFor),
  );

  return (
    <Card className="border-border/80 bg-card/95 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg">Scheduled content</CardTitle>
        <CardDescription>All upcoming posts in publishing order.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {sortedPosts.length ? (
          sortedPosts.map((post) => (
            <PostCard
              approving={approvingId === post.id || approvingId === 'bulk'}
              key={post.id}
              post={post}
              publishing={publishingId === post.id}
              selected={selectedPostId === post.id}
              onApprove={() => {
                onApprove(post.id);
              }}
              onPostNow={() => {
                onPostNow(post);
              }}
              onSelect={() => {
                onSelectPost(post);
              }}
            />
          ))
        ) : (
          <EmptyState label="No scheduled posts match the current filters." />
        )}
      </CardContent>
    </Card>
  );
}

function DayWorkload({
  date,
  posts,
  draftCount,
}: {
  date: string;
  posts: ScheduledPost[];
  draftCount: number;
}) {
  const byPlatform = platformOptions.map((item) => ({
    ...item,
    count: posts.filter((post) => post.platform === item.platform).length,
  }));
  const suggestedHours = [9, 12, 15, 18].filter((hour) => !postsForSlot(posts, date, hour).length);

  return (
    <Card className="border-border/80 bg-card/95 dark:border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarPlus className="h-4 w-4" />
          Daily planner
        </CardTitle>
        <CardDescription>{weekdayLabel(date)} publishing capacity.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="Planned" value={draftCount} />
          <MiniMetric label="Open slots" value={Math.max(0, 8 - posts.length)} />
          <MiniMetric label="Channels" value={byPlatform.filter((item) => item.count > 0).length} />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Best open windows
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedHours.length ? (
              suggestedHours.map((hour) => (
                <Badge key={hour} variant="outline">
                  {formatHour(hour)}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">This day is tightly packed.</span>
            )}
          </div>
        </div>
        <div className="grid gap-2">
          {byPlatform.map((item) => (
            <div className="flex items-center justify-between gap-3 text-sm" key={item.platform}>
              <span className="flex items-center gap-2">
                <item.icon className={cn('h-4 w-4', item.tone)} />
                {item.label}
              </span>
              <Badge variant={item.count ? 'secondary' : 'outline'}>{item.count}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3 text-center dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ChannelHealth({ posts }: { posts: ScheduledPost[] }) {
  return (
    <Card className="border-border/80 bg-card/95 dark:border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Channel mix</CardTitle>
        <CardDescription>Scheduled volume by publishing destination.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {platformOptions.map((item) => {
          const count = posts.filter((post) => post.platform === item.platform).length;
          return (
            <div className="flex items-center gap-3" key={item.platform}>
              <item.icon className={cn('h-4 w-4', item.tone)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${String(Math.min(count * 12, 100))}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ReviewQueue({
  posts,
  approvingId,
  selectedPostId,
  onApprove,
  onSelectPost,
}: {
  posts: ScheduledPost[];
  approvingId: string | null;
  selectedPostId: string | null;
  onApprove: (id: string) => void;
  onSelectPost: (post: ScheduledPost) => void;
}) {
  const reviewPosts = posts.filter(
    (post) => post.status === 'FAILED' || post.status === 'PENDING_APPROVAL',
  );
  const pendingCount = reviewPosts.filter((post) => post.status === 'PENDING_APPROVAL').length;

  return (
    <Card className="border-border/80 bg-card/95 dark:border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Approval queue
            </CardTitle>
            <CardDescription>AI-planned and failed posts that need review.</CardDescription>
          </div>
          <Badge
            className={cn(
              pendingCount
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            )}
            variant="outline"
          >
            {String(pendingCount)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {reviewPosts.length ? (
          reviewPosts.slice(0, 4).map((post) => (
            <PostCard
              approving={approvingId === post.id || approvingId === 'bulk'}
              key={post.id}
              post={post}
              selected={selectedPostId === post.id}
              onApprove={() => {
                onApprove(post.id);
              }}
              onSelect={() => {
                onSelectPost(post);
              }}
            />
          ))
        ) : (
          <EmptyState label="No posts need approval." />
        )}
      </CardContent>
    </Card>
  );
}

function PostCard({
  post,
  compact = false,
  approving = false,
  publishing = false,
  selected = false,
  onApprove,
  onPostNow,
  onSelect,
}: {
  post: ScheduledPost;
  compact?: boolean;
  approving?: boolean;
  publishing?: boolean;
  selected?: boolean;
  onApprove?: () => void;
  onPostNow?: () => void;
  onSelect?: () => void;
}) {
  const config =
    platformOptions.find((item) => item.platform === post.platform) ?? fallbackPlatform;
  const Icon = config.icon;
  const automated = post.metadata?.automation === 'daily-ai-auto-scheduler';

  return (
    <article
      className={cn(
        'rounded-lg border bg-background/80 p-3 shadow-sm transition hover:border-primary/40 dark:bg-white/[0.035]',
        selected
          ? 'border-primary ring-2 ring-primary/20'
          : post.status === 'PENDING_APPROVAL'
          ? 'border-amber-500/35 ring-1 ring-amber-500/10 dark:border-amber-400/30'
          : 'border-border dark:border-white/10',
      )}
      onClick={onSelect}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted dark:bg-white/[0.06]',
            post.status === 'PENDING_APPROVAL' ? 'bg-amber-500/10 dark:bg-amber-400/10' : '',
          )}
        >
          <Icon className={cn('h-5 w-5', config.tone)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn('line-clamp-2 font-semibold', compact ? 'text-sm' : 'text-base')}>
              {post.title}
            </h3>
            <StatusBadge status={post.status} />
          </div>
          {automated ? (
            <Badge
              className="mt-2 border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
              variant="outline"
            >
              <Wand2 className="mr-1 h-3 w-3" />
              AI planned
            </Badge>
          ) : null}
          {post.caption && !compact ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.caption}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDateTime(post.scheduledFor)}</span>
            <span>{post.channel}</span>
            <span>{post.source === 'draft' ? 'Generated draft' : 'Manual post'}</span>
            {post.platformAccount ? <span>{post.platformAccount}</span> : null}
          </div>
          {post.tags.length && !compact ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </Badge>
              ))}
            </div>
          ) : null}
          {!compact && post.logs.length ? (
            <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">Automation log</span>
                <span className="text-muted-foreground">
                  {formatDateTime(post.logs[0]?.createdAt ?? null)}
                </span>
              </div>
              <div className="grid gap-1.5">
                {post.logs.slice(0, 2).map((log) => (
                  <div className="flex gap-2 text-muted-foreground" key={log.id}>
                    <span
                      className={cn(
                        'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                        log.level === 'ERROR'
                          ? 'bg-rose-500'
                          : log.level === 'WARNING'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500',
                      )}
                    />
                    <span className="line-clamp-2">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {post.status === 'PENDING_APPROVAL' && onApprove ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={approving}
                onClick={(event) => {
                  event.stopPropagation();
                  onApprove();
                }}
                size="sm"
              >
                {approving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarClock className="h-3.5 w-3.5" />
                )}
                Final approval
              </Button>
              {onPostNow ? (
                <Button
                  disabled={publishing}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPostNow();
                  }}
                  size="sm"
                  variant="outline"
                >
                  {publishing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Post now
                </Button>
              ) : null}
            </div>
          ) : null}
          {post.status !== 'PENDING_APPROVAL' && onPostNow && !compact ? (
            <div className="mt-3">
              <Button
                disabled={publishing}
                onClick={(event) => {
                  event.stopPropagation();
                  onPostNow();
                }}
                size="sm"
                variant="outline"
              >
                {publishing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                Post now
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MonthPostPill({
  post,
  selected = false,
  onSelect,
}: {
  post: ScheduledPost;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const config =
    platformOptions.find((item) => item.platform === post.platform) ?? fallbackPlatform;
  const Icon = config.icon;

  return (
    <button
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 text-left text-xs shadow-sm transition hover:ring-1 hover:ring-primary/30 dark:bg-white/[0.05]',
        selected ? 'ring-2 ring-primary/35' : '',
      )}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
      type="button"
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', config.tone)} />
      <span className="truncate">{post.title}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: PublishStatus }) {
  const className: Record<PublishStatus, string> = {
    DRAFT: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
    PENDING_APPROVAL: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    APPROVED: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    SCHEDULED: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    PROCESSING: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    PUBLISHED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    FAILED: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    CANCELLED: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  };

  return (
    <Badge className={className[status]} variant="outline">
      {titleCase(status)}
    </Badge>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground dark:border-white/10">
      <MessageSquareText className="mx-auto mb-2 h-5 w-5" />
      {label}
    </div>
  );
}

function CalendarLoading() {
  return (
    <div className="flex min-h-96 items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading calendar
    </div>
  );
}

function weekDates(selectedDate: string): string[] {
  const start = startOfWeek(selectedDate);
  return Array.from({ length: 7 }, (_value, index) => addDays(start, index));
}

function monthDates(selectedDate: string): string[] {
  const date = parseLocalDate(selectedDate);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstMondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstMondayOffset);

  return Array.from({ length: 42 }, (_value, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return toDateInputValue(next);
  });
}

function startOfWeek(dateValue: string): string {
  const date = parseLocalDate(dateValue);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return toDateInputValue(date);
}

function addDays(dateValue: string, days: number): string {
  const date = parseLocalDate(dateValue);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function parseLocalDate(dateValue: string): Date {
  const [year = '2026', month = '1', day = '1'] = dateValue.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function toDateInputValue(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function shortDate(dateValue: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
    parseLocalDate(dateValue),
  );
}

function weekdayLabel(dateValue: string): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long' }).format(parseLocalDate(dateValue));
}

function formatDateLabel(dateValue: string, view: CalendarView): string {
  if (view === 'week') {
    const start = startOfWeek(dateValue);
    return `${shortDate(start)} - ${shortDate(addDays(start, 6))}`;
  }

  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
    parseLocalDate(dateValue),
  );
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(normalized)} ${suffix}`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Not scheduled';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function postsForDate(posts: ScheduledPost[], date: string): ScheduledPost[] {
  return posts
    .filter((post) => post.scheduledFor && toDateInputValue(new Date(post.scheduledFor)) === date)
    .sort((a, b) => dateTimeValue(a.scheduledFor) - dateTimeValue(b.scheduledFor));
}

function postsForSlot(posts: ScheduledPost[], date: string, hour: number): ScheduledPost[] {
  return postsForDate(posts, date).filter((post) => {
    if (!post.scheduledFor) {
      return false;
    }

    return new Date(post.scheduledFor).getHours() === hour;
  });
}

function dateTimeValue(value: string | null): number {
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}

function titleCase(value: string): string {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function postFromApi(post: ApiPost): ScheduledPost {
  return {
    id: post.id,
    source: post.source ?? 'publish-job',
    title: post.title,
    caption: post.caption,
    platform: post.platform,
    channel: post.channel,
    platformAccount: post.platformAccount,
    scheduledFor: post.scheduledFor,
    publishedAt: post.publishedAt,
    status: post.status,
    tags: post.tags,
    metadata: post.metadata ?? null,
    logs: post.logs ?? [],
    createdAt: post.createdAt,
  };
}
