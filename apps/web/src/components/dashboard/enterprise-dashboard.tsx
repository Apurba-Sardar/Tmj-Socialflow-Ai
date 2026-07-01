'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Bell,
  CheckCircle2,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Workflow,
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

interface Kpi {
  label: string;
  value: string;
  change: string;
  tone: 'primary' | 'success' | 'neutral';
  icon: LucideIcon;
}

const kpis: Kpi[] = [
  { label: 'Active workflows', value: '128', change: '+12.4%', tone: 'primary', icon: Workflow },
  { label: 'Audience growth', value: '42.8K', change: '+8.1%', tone: 'success', icon: Users },
  { label: 'Automation health', value: '99.96%', change: 'SLA met', tone: 'success', icon: ShieldCheck },
  { label: 'Actions processed', value: '1.82M', change: '+18.7%', tone: 'neutral', icon: Activity },
];

const chartData = [
  { label: 'Mon', value: 42 },
  { label: 'Tue', value: 58 },
  { label: 'Wed', value: 51 },
  { label: 'Thu', value: 73 },
  { label: 'Fri', value: 69 },
  { label: 'Sat', value: 84 },
  { label: 'Sun', value: 78 },
];

const channelData = [
  { label: 'LinkedIn', value: 62 },
  { label: 'Instagram', value: 48 },
  { label: 'X', value: 36 },
  { label: 'TikTok', value: 29 },
];

const activityFeed = [
  {
    title: 'Approval workflow completed',
    detail: 'Enterprise launch sequence passed final compliance review.',
    time: '4 min ago',
    status: 'Complete',
  },
  {
    title: 'Audience segment synced',
    detail: 'High-intent founder audience refreshed from CRM source.',
    time: '18 min ago',
    status: 'Synced',
  },
  {
    title: 'Risk rule triggered',
    detail: 'Brand-safety guardrail held one outbound campaign for review.',
    time: '41 min ago',
    status: 'Review',
  },
  {
    title: 'Content queue optimized',
    detail: 'Scheduling engine rebalanced posts across peak engagement windows.',
    time: '1 hr ago',
    status: 'Optimized',
  },
];

const notifications = [
  'Two approvals are waiting in Governance.',
  'Weekly executive report is ready.',
  'Redis queue latency is within target.',
];

const navigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Media Library', href: '/media-library', icon: BarChart3 },
  { label: 'Workflows', href: '/dashboard#workflows', icon: Workflow },
  { label: 'Governance', href: '/dashboard#governance', icon: ShieldCheck },
];

export function EnterpriseDashboard({ user }: { user: AuthenticatedUser }) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const unreadNotifications = notifications.length;

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('socialflow-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(storedTheme ? storedTheme === 'dark' : prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    window.localStorage.setItem('socialflow-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const sidebar = useMemo(() => <DashboardSidebar user={user} />, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        {sidebar}
      </Sheet>
      <div className="grid min-h-screen lg:grid-cols-[18rem_1fr]">
        <aside className="hidden border-r bg-card text-card-foreground lg:block">{sidebar}</aside>
        <div className="min-w-0">
          <DashboardHeader
            darkMode={darkMode}
            notificationCount={unreadNotifications}
            onMenuClick={() => {
              setNavigationOpen(true);
            }}
            onThemeToggle={() => {
              setDarkMode((value) => !value);
            }}
          />
          <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <KpiCard key={kpi.label} kpi={kpi} />
              ))}
            </section>
            <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
              <PerformanceChart />
              <ChannelChart />
            </section>
            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <ActivityFeed />
              <NotificationsPanel user={user} />
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function DashboardSidebar({ user }: { user: AuthenticatedUser }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-screen flex-col px-4 py-5">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">SocialFlow AI</p>
          <p className="text-xs text-muted-foreground">Enterprise Console</p>
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
            href={item.href}
            key={item.label}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto rounded-md border p-3">
        <p className="text-xs text-muted-foreground">Signed in as</p>
        <p className="mt-1 break-words text-sm font-medium">{user.email}</p>
        <Badge className="mt-3" variant={user.emailVerified ? 'success' : 'outline'}>
          {user.emailVerified ? 'Verified' : 'Verification pending'}
        </Badge>
      </div>
    </div>
  );
}

function DashboardHeader({
  darkMode,
  notificationCount,
  onMenuClick,
  onThemeToggle,
}: {
  darkMode: boolean;
  notificationCount: number;
  onMenuClick: () => void;
  onThemeToggle: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
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
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-normal">Dashboard</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">Realtime operating view</p>
        </div>
        <div className="hidden w-full max-w-xs items-center gap-2 rounded-md border px-3 py-2 md:flex">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search dashboard"
            className="h-5 border-0 p-0 focus-visible:ring-0"
            placeholder="Search"
            type="search"
          />
        </div>
        <Button aria-label="Toggle theme" onClick={onThemeToggle} size="sm" variant="outline">
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button aria-label="Notifications" className="relative" size="sm" variant="outline">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-semibold text-destructive-foreground">
            {notificationCount}
          </span>
        </Button>
        <LogoutButton />
      </div>
    </header>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = kpi.icon;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal">{kpi.value}</p>
          </div>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-md',
              kpi.tone === 'success'
                ? 'bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))]'
                : 'bg-primary/10 text-primary',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <Badge className="mt-4" variant={kpi.tone === 'neutral' ? 'secondary' : 'success'}>
          {kpi.change}
        </Badge>
      </CardContent>
    </Card>
  );
}

function PerformanceChart() {
  const max = Math.max(...chartData.map((item) => item.value));
  const points = chartData
    .map((item, index) => {
      const x = (index / (chartData.length - 1)) * 100;
      const y = 100 - (item.value / max) * 82;
      return `${String(x)},${String(y)}`;
    })
    .join(' ');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement Trend</CardTitle>
        <CardDescription>Seven-day aggregate across active social channels.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <svg
            aria-label="Engagement trend chart"
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
            role="img"
            viewBox="0 0 100 100"
          >
            <defs>
              <linearGradient id="trendArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polyline
              fill="none"
              points="0,100 0,66 16.6,43 33.3,50 50,28 66.6,32 83.3,18 100,24 100,100"
              stroke="none"
            />
            <polygon fill="url(#trendArea)" points={`0,100 ${points} 100,100`} />
            <polyline
              fill="none"
              points={points}
              stroke="hsl(var(--primary))"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
          {chartData.map((item) => (
            <span key={item.label}>{item.label}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel Mix</CardTitle>
        <CardDescription>Automation volume by destination.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {channelData.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground">{item.value}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted">
              <div
                className="h-3 rounded-full bg-[hsl(var(--accent))]"
                style={{ width: `${String(item.value)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ActivityFeed() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
        <CardDescription>Latest operational events across the workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activityFeed.map((item, index) => (
          <div className="flex gap-4" key={item.title}>
            <div className="flex flex-col items-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <CheckCircle2 className="h-4 w-4 text-[hsl(var(--accent))]" />
              </div>
              {index < activityFeed.length - 1 ? <div className="mt-2 h-full w-px bg-border" /> : null}
            </div>
            <div className="min-w-0 flex-1 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.title}</p>
                <Badge variant={item.status === 'Review' ? 'outline' : 'secondary'}>{item.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              <p className="mt-2 text-xs text-muted-foreground">{item.time}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NotificationsPanel({ user }: { user: AuthenticatedUser }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Items requiring attention.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.map((item) => (
          <div className="rounded-md border p-3" key={item}>
            <p className="text-sm">{item}</p>
          </div>
        ))}
        <Separator />
        <div className="rounded-md bg-muted p-4">
          <p className="text-sm font-medium">Access posture</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.role} account with {user.emailVerified ? 'verified email' : 'pending email verification'}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
