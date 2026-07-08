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
  Clock3,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Library,
  Loader2,
  Menu,
  MessageSquareText,
  Moon,
  Plus,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  Sun,
  Wand2,
  type LucideIcon,
} from 'lucide-react';

import { LogoutButton } from '@/components/auth/logout-button';
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

const fallbackPlatform: PlatformOption = { platform: 'FACEBOOK', label: 'Facebook', icon: MessageSquareText, tone: 'text-blue-500' };
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
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [draftFilter, setDraftFilter] = useState<Platform | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [creating, setCreating] = useState(false);
  const [schedulingDraftId, setSchedulingDraftId] = useState<string | null>(null);
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
    .filter((post) => post.scheduledFor && toDateInputValue(new Date(post.scheduledFor)) === selectedDate)
    .sort((a, b) => dateTimeValue(a.scheduledFor) - dateTimeValue(b.scheduledFor));

  const scheduledCount = posts.filter((post) => post.status === 'SCHEDULED').length;
  const needsReviewCount = posts.filter((post) => post.status === 'PENDING_APPROVAL' || post.status === 'FAILED').length;
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
  const unscheduledDraftCount = drafts.filter((draft) => !draft.scheduledFor && draft.status !== 'PUBLISHED' && draft.status !== 'REJECTED').length;
  const scheduledDraftCount = drafts.filter((draft) => draft.scheduledFor).length;
  const dailySlotsUsed = selectedDayPosts.length;

  async function loadCalendarData() {
    await Promise.all([loadPosts(), loadDrafts()]);
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

  async function scheduleGeneratedDraft(draftId: string, date: string, hour: number, minute = 0) {
    setSchedulingDraftId(draftId);
    try {
      const scheduledFor = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
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

  function scheduleDraggedDraft(date: string, hour: number) {
    if (!draggedDraftId) {
      return;
    }

    void scheduleGeneratedDraft(draggedDraftId, date, hour);
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

          <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-4 px-4 py-4 sm:px-6 xl:px-8">
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
                draftCount={unscheduledDraftCount}
                scheduledDraftCount={scheduledDraftCount}
                needsReviewCount={needsReviewCount}
                publishedCount={publishedCount}
                scheduledCount={scheduledCount}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                view={view}
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

            <section className="grid items-start gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_22rem]">
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
                    selectedDate={selectedDate}
                    visibleDates={visibleDates}
                    onSelectDate={setSelectedDate}
                    onDropDraft={(date) => {
                      scheduleDraggedDraft(date, 9);
                    }}
                  />
                ) : view === 'list' ? (
                  <ListPlanner posts={filteredPosts} />
                ) : (
                  <WeekPlanner
                    draggedDraftId={draggedDraftId}
                    loading={loading}
                    posts={filteredPosts}
                    selectedDate={selectedDate}
                    visibleDates={visibleDates}
                    onSelectDate={setSelectedDate}
                    onDropDraft={scheduleDraggedDraft}
                  />
                )}
              </div>

              <aside className="grid gap-5">
                <CreatePostPanel
                  creating={creating}
                  form={form}
                  setForm={setForm}
                  onCreate={() => {
                    void createScheduledPost();
                  }}
                />
                <DayWorkload date={selectedDate} posts={selectedDayPosts} draftCount={dailySlotsUsed} />
                <DayAgenda date={selectedDate} posts={selectedDayPosts} />
                <ChannelHealth posts={posts} />
                <ReviewQueue posts={posts} />
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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
          <span className="text-xs font-bold tracking-wide">TMJ</span>
        </div>
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
  publishedCount,
  setSelectedDate,
}: {
  selectedDate: string;
  view: CalendarView;
  scheduledCount: number;
  draftCount: number;
  scheduledDraftCount: number;
  needsReviewCount: number;
  publishedCount: number;
  setSelectedDate: (date: string) => void;
}) {
  const step = view === 'month' ? 30 : 7;

  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 dark:border-white/10">
      <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(18rem,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <Badge className="mb-3 border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300" variant="outline">
            <CalendarClock className="mr-1 h-3.5 w-3.5" />
            Meta-style publishing planner
          </Badge>
          <h2 className="text-2xl font-semibold tracking-normal">{formatDateLabel(selectedDate, view)}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Drag generated drafts onto the calendar, balance channels, and plan each day from one workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          <SummaryPill label="Scheduled" value={scheduledCount} />
          <SummaryPill label="Draft inbox" value={draftCount} />
          <SummaryPill label="Drafts planned" value={scheduledDraftCount} tone="success" />
          <SummaryPill label="Review" value={needsReviewCount} tone="warning" />
          <SummaryPill label="Published" value={publishedCount} tone="success" />
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
            className="h-9 w-40"
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
      </CardContent>
    </Card>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' }) {
  return (
    <div className="min-w-24 rounded-lg border border-border bg-background/70 px-3 py-2 text-center dark:border-white/10 dark:bg-white/[0.03]">
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
            view === item ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
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
              <item.icon className={cn('h-4 w-4', draftFilter === item.platform ? '' : item.tone)} />
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
          Showing draft and scheduled generated content. Drop any item onto a time slot to schedule or move it.
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
  const config = platformOptions.find((item) => item.platform === draft.platform) ?? fallbackPlatform;
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
          <Badge key={tag} variant="outline">{tag.startsWith('#') ? tag : `#${tag}`}</Badge>
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
            {scheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
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
  onSelectDate,
  onDropDraft,
}: {
  visibleDates: string[];
  selectedDate: string;
  posts: ScheduledPost[];
  loading: boolean;
  draggedDraftId: string | null;
  onSelectDate: (date: string) => void;
  onDropDraft: (date: string, hour: number) => void;
}) {
  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 dark:border-white/10">
      <div className="hidden border-b border-border bg-muted/40 dark:border-white/10 dark:bg-white/[0.03] lg:grid" style={{ gridTemplateColumns: `4.75rem repeat(${String(visibleDates.length)}, minmax(9.5rem, 1fr))` }}>
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
              style={{ gridTemplateColumns: `4.75rem repeat(${String(visibleDates.length)}, minmax(9.5rem, 1fr))` }}
            >
              <div className="border-r border-border p-3 text-xs text-muted-foreground dark:border-white/10">{formatHour(hour)}</div>
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
                      <PostCard compact key={post.id} post={post} />
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
            <button
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
              type="button"
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
                  <PostCard compact key={post.id} post={post} />
                ))}
              </div>
            </button>
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
  onSelectDate,
  onDropDraft,
}: {
  visibleDates: string[];
  selectedDate: string;
  posts: ScheduledPost[];
  draggedDraftId: string | null;
  onSelectDate: (date: string) => void;
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
            <button
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
              type="button"
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
                  <MonthPostPill key={post.id} post={post} />
                ))}
                {dayPosts.length > 3 ? <div className="text-xs text-muted-foreground">+{String(dayPosts.length - 3)} more</div> : null}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ListPlanner({ posts }: { posts: ScheduledPost[] }) {
  const sortedPosts = [...posts].sort((a, b) => dateTimeValue(a.scheduledFor) - dateTimeValue(b.scheduledFor));

  return (
    <Card className="border-border/80 bg-card/95 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg">Scheduled content</CardTitle>
        <CardDescription>All upcoming posts in publishing order.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {sortedPosts.length ? (
          sortedPosts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <EmptyState label="No scheduled posts match the current filters." />
        )}
      </CardContent>
    </Card>
  );
}

function DayWorkload({ date, posts, draftCount }: { date: string; posts: ScheduledPost[]; draftCount: number }) {
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
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Best open windows</div>
          <div className="flex flex-wrap gap-2">
            {suggestedHours.length ? (
              suggestedHours.map((hour) => (
                <Badge key={hour} variant="outline">{formatHour(hour)}</Badge>
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

function DayAgenda({ date, posts }: { date: string; posts: ScheduledPost[] }) {
  return (
    <Card className="border-border/80 bg-card/95 dark:border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="h-4 w-4" />
          {weekdayLabel(date)}
        </CardTitle>
        <CardDescription>{shortDate(date)} publishing plan.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {posts.length ? posts.map((post) => <PostCard compact key={post.id} post={post} />) : <EmptyState label="No posts scheduled for this day." />}
      </CardContent>
    </Card>
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
                  <div className="h-full rounded-full bg-primary" style={{ width: `${String(Math.min(count * 12, 100))}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ReviewQueue({ posts }: { posts: ScheduledPost[] }) {
  const reviewPosts = posts.filter((post) => post.status === 'FAILED' || post.status === 'PENDING_APPROVAL');

  return (
    <Card className="border-border/80 bg-card/95 dark:border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" />
          Needs attention
        </CardTitle>
        <CardDescription>Failed or approval-pending scheduled posts.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {reviewPosts.length ? reviewPosts.slice(0, 4).map((post) => <PostCard compact key={post.id} post={post} />) : <EmptyState label="No posts need attention." />}
      </CardContent>
    </Card>
  );
}

function PostCard({ post, compact = false }: { post: ScheduledPost; compact?: boolean }) {
  const config = platformOptions.find((item) => item.platform === post.platform) ?? fallbackPlatform;
  const Icon = config.icon;

  return (
    <article className="rounded-lg border border-border bg-background/80 p-3 shadow-sm transition hover:border-primary/40 dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted dark:bg-white/[0.06]">
          <Icon className={cn('h-5 w-5', config.tone)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn('line-clamp-2 font-semibold', compact ? 'text-sm' : 'text-base')}>{post.title}</h3>
            <StatusBadge status={post.status} />
          </div>
          {post.caption && !compact ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.caption}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDateTime(post.scheduledFor)}</span>
            <span>{post.channel}</span>
            <span>{post.source === 'draft' ? 'Generated draft' : 'Manual post'}</span>
            {post.platformAccount ? <span>{post.platformAccount}</span> : null}
          </div>
          {post.tags.length && !compact ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="outline">{tag.startsWith('#') ? tag : `#${tag}`}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MonthPostPill({ post }: { post: ScheduledPost }) {
  const config = platformOptions.find((item) => item.platform === post.platform) ?? fallbackPlatform;
  const Icon = config.icon;

  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 text-xs shadow-sm dark:bg-white/[0.05]">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', config.tone)} />
      <span className="truncate">{post.title}</span>
    </div>
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
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
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

function shortDate(dateValue: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(parseLocalDate(dateValue));
}

function weekdayLabel(dateValue: string): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long' }).format(parseLocalDate(dateValue));
}

function formatDateLabel(dateValue: string, view: CalendarView): string {
  if (view === 'week') {
    const start = startOfWeek(dateValue);
    return `${shortDate(start)} - ${shortDate(addDays(start, 6))}`;
  }

  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(parseLocalDate(dateValue));
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
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    createdAt: post.createdAt,
  };
}
