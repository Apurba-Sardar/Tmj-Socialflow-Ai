'use client';

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  GripVertical,
  ImageIcon,
  LayoutDashboard,
  Menu,
  Repeat,
  Send,
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

type CalendarView = 'day' | 'week' | 'month';
type QueueStatus = 'draft' | 'queued' | 'processing' | 'scheduled';
type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

interface ScheduledPost {
  id: string;
  title: string;
  channel: string;
  date: string;
  hour: number;
  durationHours: number;
  status: QueueStatus;
  recurrence: Recurrence;
  tags: string[];
}

interface DraftPost {
  id: string;
  title: string;
  channel: string;
  recurrence: Recurrence;
}

const navigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Media Library', href: '/media-library', icon: ImageIcon },
  { label: 'Scheduler', href: '/scheduler', icon: CalendarDays },
];

type SchedulerHref = Parameters<typeof Link>[0]['href'];

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const timeSlots = Array.from({ length: 14 }, (_value, index) => index + 7);

export function PostScheduler({ user }: { user: AuthenticatedUser }) {
  const [view, setView] = useState<CalendarView>('week');
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [drafts] = useState<DraftPost[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkRecurrence, setBulkRecurrence] = useState<Recurrence>('weekly');
  const [navigationOpen, setNavigationOpen] = useState(false);

  const visibleDates = useMemo(() => datesForView(selectedDate, view), [selectedDate, view]);
  const queuedPosts = posts.filter((post) => post.status === 'queued' || post.status === 'processing');

  useEffect(() => {
    async function loadPosts() {
      const response = await fetch(`${getApiBaseUrl()}/api/scheduler/posts`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        setPosts([]);
        return;
      }

      const payload = (await response.json()) as {
        data: {
          id: string;
          title: string;
          channel: string;
          scheduledFor: string | null;
          status: string;
          tags: string[];
        }[];
      };
      setPosts(payload.data.filter((post) => post.scheduledFor).map(postFromApi));
    }

    void loadPosts();
  }, []);

  function scheduleDraft(draftId: string, date: string, hour: number): void {
    const draft = drafts.find((item) => item.id === draftId);

    if (!draft) {
      return;
    }

    const scheduledPost: ScheduledPost = {
      id: `${draft.id}-${date}-${String(hour)}`,
      title: draft.title,
      channel: draft.channel,
      date,
      hour,
      durationHours: 1,
      status: 'queued',
      recurrence: draft.recurrence,
      tags: ['bulk-ready'],
    };

    setPosts((currentPosts) => upsertPost(currentPosts, scheduledPost));
  }

  function movePost(postId: string, date: string, hour: number): void {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId ? { ...post, date, hour, status: 'queued' } : post,
      ),
    );
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, date: string, hour: number): void {
    event.preventDefault();
    const draftId = event.dataTransfer.getData('application/socialflow-draft');
    const postId = event.dataTransfer.getData('application/socialflow-post');

    if (draftId) {
      scheduleDraft(draftId, date, hour);
      return;
    }

    if (postId) {
      movePost(postId, date, hour);
    }
  }

  function bulkSchedule(): void {
    void bulkCount;
    void bulkRecurrence;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        <SchedulerSidebar user={user} />
      </Sheet>
      <div className="grid min-h-screen lg:grid-cols-[18rem_1fr]">
        <aside className="hidden border-r bg-card text-card-foreground lg:block">
          <SchedulerSidebar user={user} />
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
            <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
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
                <h1 className="text-lg font-semibold tracking-normal">Scheduler</h1>
                <p className="hidden text-sm text-muted-foreground sm:block">
                  Plan posts, manage recurrence, and stage queue jobs.
                </p>
              </div>
              <ViewSwitcher view={view} onViewChange={setView} />
              <Button aria-label="Notifications" className="relative" size="sm" variant="outline">
                <Bell className="h-4 w-4" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" />
              </Button>
              <LogoutButton />
            </div>
          </header>

          <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[1fr_21rem] xl:px-8">
            <section className="min-w-0 space-y-6">
              <CalendarToolbar
                selectedDate={selectedDate}
                view={view}
                onDateChange={setSelectedDate}
              />
              {view === 'month' ? (
                <MonthView posts={posts} selectedDate={selectedDate} onDateSelect={setSelectedDate} />
              ) : (
                <TimeGrid
                  dates={visibleDates}
                  posts={posts}
                  onDropPost={handleDrop}
                  view={view}
                />
              )}
            </section>
            <aside className="space-y-6">
              <QueuePanel queuedPosts={queuedPosts} />
              <DraftPanel drafts={drafts} />
              <BulkSchedulePanel
                bulkCount={bulkCount}
                bulkRecurrence={bulkRecurrence}
                onBulkCountChange={setBulkCount}
                onBulkRecurrenceChange={setBulkRecurrence}
                onBulkSchedule={bulkSchedule}
              />
              <RecurringPanel posts={posts} />
            </aside>
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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-xs font-bold tracking-wide">TMJ</span>
        </div>
        <div>
          <p className="text-sm font-semibold">TMJ SocialFlow AI</p>
          <p className="text-xs text-muted-foreground">Publishing Control</p>
        </div>
      </div>
      <nav className="mt-8 space-y-1">
        {navigation.map((item) => (
          <Link
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            href={item.href as SchedulerHref}
            key={item.href}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto rounded-md border p-3">
        <p className="text-xs text-muted-foreground">Scheduler owner</p>
        <p className="mt-1 break-words text-sm font-medium">{user.email}</p>
      </div>
    </div>
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
    <div className="hidden rounded-md border p-1 sm:flex">
      {(['day', 'week', 'month'] as const).map((item) => (
        <button
          className={cn(
            'rounded px-3 py-1.5 text-sm font-medium capitalize',
            view === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
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

function CalendarToolbar({
  selectedDate,
  view,
  onDateChange,
}: {
  selectedDate: string;
  view: CalendarView;
  onDateChange: (date: string) => void;
}) {
  const step = view === 'day' ? 1 : view === 'week' ? 7 : 30;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Calendar window</p>
          <h2 className="text-xl font-semibold tracking-normal">{formatDateLabel(selectedDate, view)}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            aria-label="Previous window"
            onClick={() => {
              onDateChange(addDays(selectedDate, -step));
            }}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            aria-label="Selected calendar date"
            className="w-40"
            onChange={(event) => {
              onDateChange(event.target.value);
            }}
            type="date"
            value={selectedDate}
          />
          <Button
            aria-label="Next window"
            onClick={() => {
              onDateChange(addDays(selectedDate, step));
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

function TimeGrid({
  dates,
  posts,
  onDropPost,
  view,
}: {
  dates: string[];
  posts: ScheduledPost[];
  onDropPost: (event: DragEvent<HTMLDivElement>, date: string, hour: number) => void;
  view: CalendarView;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid border-b bg-muted/50" style={{ gridTemplateColumns: `5rem repeat(${String(dates.length)}, minmax(9rem, 1fr))` }}>
        <div className="p-3 text-xs font-medium text-muted-foreground">Time</div>
        {dates.map((date, index) => (
          <div className="border-l p-3" key={date}>
            <p className="text-xs text-muted-foreground">{view === 'week' ? weekDays[index] : 'Day'}</p>
            <p className="text-sm font-semibold">{shortDate(date)}</p>
          </div>
        ))}
      </div>
      <div className="max-h-[44rem] overflow-auto">
        {timeSlots.map((hour) => (
          <div
            className="grid min-h-24 border-b"
            key={hour}
            style={{ gridTemplateColumns: `5rem repeat(${String(dates.length)}, minmax(9rem, 1fr))` }}
          >
            <div className="border-r p-3 text-xs text-muted-foreground">{formatHour(hour)}</div>
            {dates.map((date) => {
              const slotPosts = posts.filter((post) => post.date === date && post.hour === hour);
              return (
                <div
                  className="space-y-2 border-l p-2 transition-colors hover:bg-muted/40"
                  key={`${date}-${String(hour)}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    onDropPost(event, date, hour);
                  }}
                >
                  {slotPosts.map((post) => (
                    <ScheduledPostCard key={post.id} post={post} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

function MonthView({
  posts,
  selectedDate,
  onDateSelect,
}: {
  posts: ScheduledPost[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
}) {
  const dates = monthDates(selectedDate);

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {weekDays.map((day) => (
          <div className="p-3 text-xs font-medium text-muted-foreground" key={day}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((date) => {
          const dayPosts = posts.filter((post) => post.date === date);
          return (
            <button
              className={cn(
                'min-h-32 border-b border-r p-2 text-left transition-colors hover:bg-muted/40',
                date === selectedDate ? 'bg-primary/5' : '',
              )}
              key={date}
              onClick={() => {
                onDateSelect(date);
              }}
              type="button"
            >
              <p className="text-xs font-medium text-muted-foreground">{shortDate(date)}</p>
              <div className="mt-2 space-y-1">
                {dayPosts.slice(0, 3).map((post) => (
                  <div className="truncate rounded bg-primary/10 px-2 py-1 text-xs text-primary" key={post.id}>
                    {post.title}
                  </div>
                ))}
                {dayPosts.length > 3 ? (
                  <p className="text-xs text-muted-foreground">+{String(dayPosts.length - 3)} more</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ScheduledPostCard({ post }: { post: ScheduledPost }) {
  return (
    <div
      className="rounded-md border bg-card p-2 shadow-sm"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/socialflow-post', post.id);
      }}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{post.title}</p>
          <p className="text-xs text-muted-foreground">
            {post.channel} · {formatHour(post.hour)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant={queueVariant(post.status)}>{post.status}</Badge>
            {post.recurrence !== 'none' ? (
              <Badge variant="outline">
                <Repeat className="mr-1 h-3 w-3" />
                {post.recurrence}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function QueuePanel({ queuedPosts }: { queuedPosts: ScheduledPost[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue Integration</CardTitle>
        <CardDescription>Posts staged for publishing workers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <QueueFact label="Queued" value={String(queuedPosts.filter((post) => post.status === 'queued').length)} />
          <QueueFact
            label="Processing"
            value={String(queuedPosts.filter((post) => post.status === 'processing').length)}
          />
          <QueueFact label="Workers" value="3" />
        </div>
        <Separator />
        <div className="space-y-3">
          {queuedPosts.slice(0, 4).map((post) => (
            <div className="flex items-center justify-between gap-3" key={post.id}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{post.title}</p>
                <p className="text-xs text-muted-foreground">{post.date}</p>
              </div>
              <Badge variant={queueVariant(post.status)}>{post.status}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QueueFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DraftPanel({ drafts }: { drafts: DraftPost[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unscheduled Posts</CardTitle>
        <CardDescription>Drag a post into a time slot.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {drafts.map((draft) => (
          <div
            className="cursor-grab rounded-md border bg-card p-3 active:cursor-grabbing"
            draggable
            key={draft.id}
            onDragStart={(event) => {
              event.dataTransfer.setData('application/socialflow-draft', draft.id);
            }}
          >
            <div className="flex items-start gap-3">
              <Send className="mt-0.5 h-4 w-4 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{draft.title}</p>
                <p className="text-xs text-muted-foreground">{draft.channel}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BulkSchedulePanel({
  bulkCount,
  bulkRecurrence,
  onBulkCountChange,
  onBulkRecurrenceChange,
  onBulkSchedule,
}: {
  bulkCount: number;
  bulkRecurrence: Recurrence;
  onBulkCountChange: (value: number) => void;
  onBulkRecurrenceChange: (value: Recurrence) => void;
  onBulkSchedule: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Schedule</CardTitle>
        <CardDescription>Create a queue-ready posting sequence.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="bulk-count">
            Number of posts
          </label>
          <Input
            id="bulk-count"
            min={1}
            max={30}
            onChange={(event) => {
              onBulkCountChange(Number(event.target.value));
            }}
            type="number"
            value={bulkCount}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Recurrence</p>
          <div className="grid grid-cols-2 gap-2">
            {(['none', 'daily', 'weekly', 'monthly'] as const).map((item) => (
              <button
                className={cn(
                  'rounded-md border px-3 py-2 text-sm capitalize',
                  bulkRecurrence === item ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
                key={item}
                onClick={() => {
                  onBulkRecurrenceChange(item);
                }}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <Button className="w-full" onClick={onBulkSchedule}>
          <CopyPlus className="h-4 w-4" />
          Add to queue
        </Button>
      </CardContent>
    </Card>
  );
}

function RecurringPanel({ posts }: { posts: ScheduledPost[] }) {
  const recurringPosts = posts.filter((post) => post.recurrence !== 'none');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recurring Posts</CardTitle>
        <CardDescription>Active repeating schedules.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {recurringPosts.slice(0, 5).map((post) => (
          <div className="flex items-center gap-3 rounded-md border p-3" key={post.id}>
            <Repeat className="h-4 w-4 text-[hsl(var(--accent))]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{post.title}</p>
              <p className="text-xs text-muted-foreground capitalize">{post.recurrence}</p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--accent))]" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function datesForView(selectedDate: string, view: CalendarView): string[] {
  if (view === 'day') {
    return [selectedDate];
  }

  return Array.from({ length: 7 }, (_value, index) => addDays(startOfWeek(selectedDate), index));
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
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
    parseLocalDate(dateValue),
  );
}

function formatDateLabel(dateValue: string, view: CalendarView): string {
  if (view === 'day') {
    return shortDate(dateValue);
  }

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

function queueVariant(status: QueueStatus): 'default' | 'secondary' | 'outline' | 'success' {
  if (status === 'scheduled') {
    return 'success';
  }

  if (status === 'processing') {
    return 'default';
  }

  if (status === 'queued') {
    return 'secondary';
  }

  return 'outline';
}

function postFromApi(post: {
  id: string;
  title: string;
  channel: string;
  scheduledFor: string | null;
  status: string;
  tags: string[];
}): ScheduledPost {
  const scheduledFor = post.scheduledFor ? new Date(post.scheduledFor) : new Date();
  return {
    id: post.id,
    title: post.title,
    channel: post.channel,
    date: toDateInputValue(scheduledFor),
    hour: scheduledFor.getHours(),
    durationHours: 1,
    status: queueStatusFromApi(post.status),
    recurrence: 'none',
    tags: post.tags,
  };
}

function queueStatusFromApi(status: string): QueueStatus {
  if (status === 'PROCESSING') {
    return 'processing';
  }

  if (status === 'SCHEDULED' || status === 'APPROVED') {
    return 'scheduled';
  }

  if (status === 'DRAFT') {
    return 'draft';
  }

  return 'queued';
}

function upsertPost(posts: ScheduledPost[], nextPost: ScheduledPost): ScheduledPost[] {
  const existingIndex = posts.findIndex((post) => post.id === nextPost.id);

  if (existingIndex === -1) {
    return [...posts, nextPost];
  }

  return posts.map((post) => (post.id === nextPost.id ? nextPost : post));
}
