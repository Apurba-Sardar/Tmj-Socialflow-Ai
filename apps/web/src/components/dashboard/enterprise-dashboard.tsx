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
  FileCheck2,
  Image,
  LayoutDashboard,
  Library,
  Menu,
  Moon,
  Plus,
  RadioTower,
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

const baseQueueItems: QueueItem[] = [
  { label: 'Queued', value: 184, detail: 'Ready for dispatch', tone: 'bg-blue-500' },
  { label: 'Processing', value: 27, detail: 'Media rendering', tone: 'bg-violet-500' },
  { label: 'Needs approval', value: 31, detail: 'Brand or legal review', tone: 'bg-amber-400' },
  { label: 'Retrying', value: 2, detail: 'API rate limits', tone: 'bg-rose-500' },
];

const basePlatformKpis: PlatformKpi[] = [
  {
    platform: 'Instagram',
    icon: Video,
    color: 'text-pink-500 dark:text-pink-400',
    posts: 68,
    engagement: '7.8%',
    health: '99.9%',
    delta: '+23%',
  },
  {
    platform: 'LinkedIn',
    icon: Contact,
    color: 'text-sky-600 dark:text-sky-400',
    posts: 44,
    engagement: '5.1%',
    health: '100%',
    delta: '+12%',
  },
  {
    platform: 'X',
    icon: AtSign,
    color: 'text-slate-700 dark:text-zinc-200',
    posts: 39,
    engagement: '3.4%',
    health: '98.7%',
    delta: '+8%',
  },
  {
    platform: 'Pinterest',
    icon: Image,
    color: 'text-red-500 dark:text-red-400',
    posts: 72,
    engagement: '9.2%',
    health: '96.8%',
    delta: '-3%',
  },
];

const baseSchedule: ScheduleItem[] = [
  {
    id: 'sch-1',
    time: '08:00',
    platform: 'Pinterest',
    title: 'Summer launch moodboard',
    state: 'Queued',
    accent: 'bg-red-500',
    view: 'Today',
  },
  {
    id: 'sch-2',
    time: '09:30',
    platform: 'LinkedIn',
    title: 'Founder thought leadership',
    state: 'Approved',
    accent: 'bg-sky-500',
    view: 'Today',
  },
  {
    id: 'sch-3',
    time: '12:00',
    platform: 'Instagram',
    title: 'Reels cutdown batch',
    state: 'Rendering',
    accent: 'bg-pink-500',
    view: 'Today',
  },
  {
    id: 'sch-4',
    time: '15:30',
    platform: 'X',
    title: 'Product changelog thread',
    state: 'Draft lock',
    accent: 'bg-slate-400',
    view: 'Today',
  },
  {
    id: 'sch-5',
    time: '20:00',
    platform: 'Instagram',
    title: 'Community recap carousel',
    state: 'Queued',
    accent: 'bg-pink-500',
    view: 'Today',
  },
  {
    id: 'sch-6',
    time: 'Tue',
    platform: 'LinkedIn',
    title: 'Enterprise automation report',
    state: 'Approved',
    accent: 'bg-sky-500',
    view: 'Week',
  },
  {
    id: 'sch-7',
    time: 'Thu',
    platform: 'Pinterest',
    title: 'Creator workflow pins',
    state: 'Queued',
    accent: 'bg-red-500',
    view: 'Week',
  },
  {
    id: 'sch-8',
    time: 'Fri',
    platform: 'Instagram',
    title: 'Launch week recap reel',
    state: 'Rendering',
    accent: 'bg-pink-500',
    view: 'Week',
  },
  {
    id: 'sch-9',
    time: 'Jun 04',
    platform: 'LinkedIn',
    title: 'Monthly executive POV',
    state: 'Draft lock',
    accent: 'bg-sky-500',
    view: 'Month',
  },
  {
    id: 'sch-10',
    time: 'Jun 14',
    platform: 'Pinterest',
    title: 'Evergreen content refresh',
    state: 'Queued',
    accent: 'bg-red-500',
    view: 'Month',
  },
];

const baseApprovals: ApprovalItem[] = [
  {
    id: 'ap-1',
    title: 'Q3 campaign narrative',
    owner: 'Maya',
    risk: 'Legal copy',
    age: '18m',
    status: 'Pending',
  },
  {
    id: 'ap-2',
    title: 'Customer quote carousel',
    owner: 'Nikhil',
    risk: 'Brand tone',
    age: '42m',
    status: 'Pending',
  },
  {
    id: 'ap-3',
    title: 'Competitor response post',
    owner: 'Ava',
    risk: 'Executive review',
    age: '1h',
    status: 'Pending',
  },
  {
    id: 'ap-4',
    title: 'Healthcare case study',
    owner: 'Ishaan',
    risk: 'Compliance',
    age: '2h',
    status: 'Pending',
  },
];

const baseActivity: ActivityItem[] = [
  {
    title: 'Pinterest pin published successfully',
    detail: '10 ways to stay productive working from home',
    time: '2m ago',
    icon: CheckCircle2,
    tone: 'text-emerald-500',
  },
  {
    title: 'Instagram Reel failed to publish',
    detail: 'Summer outfit ideas 2026',
    time: '15m ago',
    icon: AlertTriangle,
    tone: 'text-amber-500',
  },
  {
    title: 'LinkedIn post approved',
    detail: 'AI workflow operating model',
    time: '28m ago',
    icon: FileCheck2,
    tone: 'text-sky-500',
  },
  {
    title: 'Queue optimizer shifted 11 posts',
    detail: 'Peak engagement window detected',
    time: '47m ago',
    icon: Sparkles,
    tone: 'text-violet-500',
  },
  {
    title: 'Facebook copy localized',
    detail: 'Weekend motivation for APAC audience',
    time: '1h ago',
    icon: Workflow,
    tone: 'text-blue-500',
  },
  {
    title: 'Compliance check completed',
    detail: 'Healthcare case study passed automated screening',
    time: '2h ago',
    icon: CheckCircle2,
    tone: 'text-emerald-500',
  },
];

const topPosts = [
  {
    title: 'Beautiful places to visit this season',
    platform: 'Pinterest',
    views: '12.5K',
    saves: '1.2K',
    comments: 312,
    score: 94,
  },
  {
    title: 'Healthy breakfast ideas for busy teams',
    platform: 'Instagram',
    views: '9.8K',
    saves: '1.1K',
    comments: 215,
    score: 89,
  },
  {
    title: 'Daily motivation for creators',
    platform: 'Facebook',
    views: '8.7K',
    saves: '870',
    comments: 120,
    score: 82,
  },
];

const insights = [
  'Best posting window today: Pinterest from 8:00 PM to 10:00 PM.',
  'Instagram Reels engagement is 23% higher than static posts.',
  'Five evergreen posts can be repurposed into LinkedIn carousels.',
];

const navigation: { label: string; href: string; icon: LucideIcon; count?: string }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Content', href: '/media-library', icon: Library },
  { label: 'Scheduler', href: '/scheduler', icon: CalendarDays },
  { label: 'Queue', href: '/dashboard#queue', icon: Workflow, count: '24' },
  { label: 'Approvals', href: '/dashboard#approvals', icon: FileCheck2, count: '31' },
  { label: 'Analytics', href: '/dashboard#analytics', icon: BarChart3 },
  { label: 'AI Studio', href: '/dashboard#ai', icon: WandSparkles },
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
  const [darkMode, setDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleView, setScheduleView] = useState<ScheduleView>('Today');
  const [dateRangeIndex, setDateRangeIndex] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showQueueAll, setShowQueueAll] = useState(false);
  const [showActivityAll, setShowActivityAll] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(basePlatformKpis[0]);
  const [scheduleItems, setScheduleItems] = useState(baseSchedule);
  const [queueItems, setQueueItems] = useState(baseQueueItems);
  const [approvals, setApprovals] = useState(baseApprovals);
  const [activity, setActivity] = useState(baseActivity);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('socialflow-theme');
    setDarkMode(storedTheme ? storedTheme === 'dark' : true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
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
  const displayedActivity = showActivityAll ? filteredActivity : filteredActivity.slice(0, 4);
  const displayedQueue = showQueueAll ? queueItems : queueItems.slice(0, 4);
  const metrics = buildMetrics(queueItems, pendingApprovals);

  const sidebar = useMemo(
    () => <DashboardSidebar user={user} pendingApprovals={pendingApprovals} />,
    [user, pendingApprovals],
  );

  function pushActivity(title: string, detail: string, tone: string, icon: LucideIcon) {
    setActivity((items) => [{ title, detail, time: 'Just now', icon, tone }, ...items]);
  }

  function notify(message: string, tone: ToastTone = 'success') {
    setToast({ message, tone });
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
    setQueueItems((items) =>
      items.map((item) => {
        if (item.label === 'Retrying') {
          return { ...item, value: 0, detail: 'No active retries' };
        }
        if (item.label === 'Processing') {
          return { ...item, value: item.value + 2 };
        }
        return item;
      }),
    );
    pushActivity(
      'Failed posts sent to retry',
      'Two Pinterest jobs moved into processing',
      'text-blue-500',
      Workflow,
    );
    notify('Retry started for failed posts.', 'info');
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-foreground transition-colors duration-300 dark:bg-[#05070d]">
      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        {sidebar}
      </Sheet>
      <div className="grid min-h-screen lg:grid-cols-[17rem_1fr]">
        <aside className="hidden border-r border-border bg-card/95 lg:block dark:border-white/10 dark:bg-[#070a12]/95">
          {sidebar}
        </aside>
        <div className="min-w-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_30rem),radial-gradient(circle_at_top_right,rgba(20,184,166,0.10),transparent_28rem)]">
          <DashboardHeader
            darkMode={darkMode}
            dateRange={dateRanges[dateRangeIndex] ?? dateRanges[0]}
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
              setDarkMode((value) => !value);
              notify(`Switched to ${darkMode ? 'light' : 'dark'} mode.`, 'info');
            }}
          />
          <main className="mx-auto flex w-full max-w-[96rem] flex-col gap-4 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
            <Hero user={user} />
            {searchQuery ? (
              <SearchSummary
                count={
                  filteredSchedule.length +
                  filteredApprovals.length +
                  filteredActivity.length +
                  filteredTopPosts.length
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
            <section className="grid gap-4 xl:grid-cols-[1.1fr_1.35fr_0.9fr]">
              <div className="grid gap-4">
                <PlatformHealth
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
              items={basePlatformKpis}
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
        <div className="relative flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 via-violet-500 to-emerald-400 text-white shadow-lg shadow-blue-950/30">
          <Sparkles className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-card" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">SocialFlow AI</p>
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
              href={item.href}
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
            <p className="text-xs text-muted-foreground">{user.role}</p>
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

function PlatformHealth({
  onSelect,
  selectedPlatform,
}: {
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
        {basePlatformKpis.map((item) => (
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
        ))}
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

function AiInsights({ onApply }: { onApply: (insight: string) => void }) {
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
        {insights.map((insight, index) => (
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
        ))}
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
              key={`${item.title}-${item.time}`}
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
  posts: typeof topPosts;
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
              key={post.title}
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
                  {post.platform} - {post.views} views - {post.saves} saves - {post.comments}{' '}
                  comments
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{post.score}</p>
                <p className="text-xs text-muted-foreground">score</p>
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
              Add a demo item to the publishing workflow.
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
          <div className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground dark:border-white/10">
            This demo creates local UI state only. It shows the workflow without requiring Postgres.
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

function buildMetrics(queueItems: QueueItem[], pendingApprovals: number): Metric[] {
  const queued = queueItems.find((item) => item.label === 'Queued')?.value ?? 0;
  const processing = queueItems.find((item) => item.label === 'Processing')?.value ?? 0;
  const retrying = queueItems.find((item) => item.label === 'Retrying')?.value ?? 0;

  return [
    {
      label: 'Publishing queue',
      value: String(queued + processing),
      detail: `${String(queued)} posts scheduled today`,
      trend: '+18.2%',
      tone: 'blue',
      icon: Send,
    },
    {
      label: 'Approval backlog',
      value: String(pendingApprovals),
      detail: '9 marked priority',
      trend: '-12 min SLA',
      tone: 'amber',
      icon: FileCheck2,
    },
    {
      label: 'Posts published',
      value: '173',
      detail: 'Across 7 platforms',
      trend: '+12.7%',
      tone: 'green',
      icon: CheckCircle2,
    },
    {
      label: 'Failed publishes',
      value: String(retrying),
      detail: retrying ? 'Pinterest token refresh' : 'No active failures',
      trend: retrying ? 'Needs review' : 'Resolved',
      tone: retrying ? 'rose' : 'green',
      icon: retrying ? AlertTriangle : CheckCircle2,
    },
  ];
}

function toneClass(tone: Metric['tone']): string {
  return {
    blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
    green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-200',
    rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  }[tone];
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

function initialsForEmail(email: string): string {
  return (
    email
      .split('@')[0]
      ?.split(/[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') ?? 'SF'
  );
}
