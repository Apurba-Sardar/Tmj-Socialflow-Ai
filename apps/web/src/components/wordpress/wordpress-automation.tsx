'use client';

import { useEffect, useState } from 'react';
import { Clock3, Loader2, Save, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuthenticatedUser } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';

const platforms = ['PINTEREST', 'INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X'] as const;
type Platform = (typeof platforms)[number];

interface AutomationState {
  enabled: boolean;
  connectionId: string;
  categorySlug: string;
  platforms: Platform[];
  dailyLimit: number;
  publishHour: number;
  timezone: string;
  lastError: string | null;
  lastPublishedTitle: string | null;
  connections: { id: string; siteUrl: string; username: string }[];
}

const emptyState: AutomationState = {
  enabled: false,
  connectionId: '',
  categorySlug: '',
  platforms: ['INSTAGRAM', 'FACEBOOK'],
  dailyLimit: 1,
  publishHour: 9,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  lastError: null,
  lastPublishedTitle: null,
  connections: [],
};

export function WordPressAutomation({ user }: { user: AuthenticatedUser }) {
  const apiBaseUrl = getApiBaseUrl();
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const [state, setState] = useState(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/wordpress/automation/daily`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Unable to load automation settings.');
      setState((await response.json()) as AutomationState);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load automation settings.');
    } finally {
      setLoading(false);
    }
  }

  function togglePlatform(platform: Platform) {
    setState((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }));
  }

  async function save() {
    if (!state.connectionId || !state.platforms.length) {
      setMessage('Choose a WordPress site and at least one social channel.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`${apiBaseUrl}/api/wordpress/automation/daily`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: state.enabled,
          connectionId: state.connectionId,
          categorySlug: state.categorySlug,
          platforms: state.platforms,
          dailyLimit: state.dailyLimit,
          publishHour: state.publishHour,
          timezone: state.timezone,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      setMessage(state.enabled ? 'Daily automation enabled.' : 'Daily automation paused.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save automation settings.');
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setMessage('Checking WordPress for a new post…');
    try {
      const response = await fetch(`${apiBaseUrl}/api/wordpress/automation/daily/run`, {
        method: 'POST',
        credentials: 'include',
      });
      const raw = await response.text();
      let payload: { message?: string; published?: number } = {};
      try {
        payload = JSON.parse(raw) as { message?: string; published?: number };
      } catch {
        payload = { message: raw };
      }
      if (!response.ok) throw new Error(payload.message ?? 'Automation run failed.');
      setMessage(payload.message ?? `${String(payload.published ?? 0)} post(s) published.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Automation run failed.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="border-border/80 bg-card/90 dark:border-white/10">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4 text-primary" />
              Daily auto-publishing
            </CardTitle>
            <CardDescription>
              The server checks WordPress every minute and immediately shares new posts to your
              selected channels using the original WordPress featured image.
            </CardDescription>
          </div>
          <Badge variant={state.enabled ? 'default' : 'outline'}>
            {state.enabled ? 'Active' : 'Paused'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="automation-site">WordPress site</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={!isAdmin || loading}
              id="automation-site"
              onChange={(event) => {
                setState((current) => ({ ...current, connectionId: event.target.value }));
              }}
              value={state.connectionId}
            >
              <option value="">Choose a site</option>
              {state.connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.siteUrl}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="automation-category">WordPress category</Label>
            <Input
              id="automation-category"
              onChange={(event) => {
                setState((current) => ({ ...current, categorySlug: event.target.value }));
              }}
              placeholder="All categories"
              value={state.categorySlug}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave blank to publish every new category, including Quotes.
            </p>
          </div>
          <div>
            <Label htmlFor="automation-limit">New posts per day</Label>
            <Input
              id="automation-limit"
              max={10}
              min={1}
              onChange={(event) => {
                setState((current) => ({ ...current, dailyLimit: Number(event.target.value) }));
              }}
              type="number"
              value={state.dailyLimit}
            />
          </div>
          <div>
            <Label htmlFor="automation-timezone">Timezone</Label>
            <Input
              id="automation-timezone"
              onChange={(event) => {
                setState((current) => ({ ...current, timezone: event.target.value }));
              }}
              value={state.timezone}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {platforms.map((platform) => (
            <Button
              key={platform}
              onClick={() => {
                togglePlatform(platform);
              }}
              size="sm"
              variant={state.platforms.includes(platform) ? 'default' : 'outline'}
            >
              {platform}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!isAdmin || saving || loading}
            onClick={() => {
              setState((current) => ({ ...current, enabled: !current.enabled }));
            }}
            variant="outline"
          >
            {state.enabled ? 'Pause automation' : 'Enable automation'}
          </Button>
          <Button disabled={!isAdmin || saving || loading} onClick={() => void save()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </Button>
          <Button
            disabled={!isAdmin || running || !state.enabled}
            onClick={() => void runNow()}
            variant="outline"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock3 className="h-4 w-4" />
            )}
            Run now
          </Button>
        </div>
        {state.lastPublishedTitle ? (
          <p className="text-xs text-muted-foreground">
            Last published: {state.lastPublishedTitle}
          </p>
        ) : null}
        {message || state.lastError ? (
          <p className="text-sm text-muted-foreground">{message || state.lastError}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
