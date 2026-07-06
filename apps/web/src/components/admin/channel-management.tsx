'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { LogoutButton } from '@/components/auth/logout-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AuthenticatedUser } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

type Platform = 'PINTEREST' | 'INSTAGRAM' | 'LINKEDIN' | 'X' | 'FACEBOOK';
type ChannelStatus = 'CONNECTED' | 'ACTION_REQUIRED' | 'DISCONNECTED' | 'EXPIRED';
type AuthType = 'OAUTH' | 'MANUAL' | 'APPLICATION_PASSWORD';

interface SupportedPlatform {
  platform: Platform;
  label: string;
  authType: AuthType;
  requiredScopes: string[];
  setupHint: string;
}

interface ChannelAccount {
  id: string;
  platform: Platform;
  displayName: string;
  handle: string | null;
  externalAccountId: string | null;
  accountType: string | null;
  status: ChannelStatus;
  authType: AuthType;
  scopes: string[];
  tokenExpiresAt: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  connectedBy?: {
    email: string;
    displayName: string | null;
  } | null;
}

interface ChannelSummary {
  total: number;
  connected: number;
  actionRequired: number;
  expired: number;
  byPlatform: { platform: Platform; count: number }[];
}

interface PromptTemplate {
  id: string;
  platform: Platform;
  purpose: string;
  name: string;
  description: string | null;
  template: string;
  negativePrompt: string | null;
  styleNotes: string | null;
  version: number;
  active: boolean;
  updatedAt: string;
  updatedBy?: {
    email: string;
    displayName: string | null;
  } | null;
}

interface ChannelForm {
  platform: Platform;
  displayName: string;
  handle: string;
  externalAccountId: string;
  accountType: string;
  authType: AuthType;
  scopes: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
}

interface PromptForm {
  platform: Platform;
  name: string;
  description: string;
  template: string;
  negativePrompt: string;
  styleNotes: string;
}

const emptySummary: ChannelSummary = {
  total: 0,
  connected: 0,
  actionRequired: 0,
  expired: 0,
  byPlatform: [],
};

const initialForm: ChannelForm = {
  platform: 'PINTEREST',
  displayName: '',
  handle: '',
  externalAccountId: '',
  accountType: '',
  authType: 'MANUAL',
  scopes: '',
  accessToken: '',
  refreshToken: '',
  tokenExpiresAt: '',
};

const initialPromptForm: PromptForm = {
  platform: 'PINTEREST',
  name: '',
  description: '',
  template: '',
  negativePrompt: '',
  styleNotes: '',
};

const platformTone: Record<Platform, string> = {
  PINTEREST: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  INSTAGRAM: 'border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300',
  LINKEDIN: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  X: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  FACEBOOK: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
};

export function ChannelManagement({ user }: { user: AuthenticatedUser }) {
  const apiBaseUrl = getApiBaseUrl();
  const [supported, setSupported] = useState<SupportedPlatform[]>([]);
  const [channels, setChannels] = useState<ChannelAccount[]>([]);
  const [summary, setSummary] = useState<ChannelSummary>(emptySummary);
  const [form, setForm] = useState<ChannelForm>(initialForm);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [promptForm, setPromptForm] = useState<PromptForm>(initialPromptForm);
  const [promptPreview, setPromptPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [previewingPrompt, setPreviewingPrompt] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);

  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'MANAGER';
  const selectedPlatform = useMemo(
    () => supported.find((item) => item.platform === form.platform),
    [form.platform, supported],
  );
  const selectedPrompt = useMemo(
    () => promptTemplates.find((item) => item.platform === promptForm.platform && item.purpose === 'IMAGE_GENERATION'),
    [promptForm.platform, promptTemplates],
  );

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [supportedResponse, channelsResponse, summaryResponse, promptsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/social-channels/supported`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/social-channels`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/social-channels/summary`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/prompt-templates`, { credentials: 'include', cache: 'no-store' }),
      ]);

      if (!supportedResponse.ok || !channelsResponse.ok || !summaryResponse.ok || !promptsResponse.ok) {
        throw new Error('Unable to load social channel settings.');
      }

      const nextSupported = (await supportedResponse.json()) as SupportedPlatform[];
      const nextPrompts = (await promptsResponse.json()) as PromptTemplate[];
      setSupported(nextSupported);
      setChannels((await channelsResponse.json()) as ChannelAccount[]);
      setSummary((await summaryResponse.json()) as ChannelSummary);
      setPromptTemplates(nextPrompts);
      setForm((value) => ({
        ...value,
        platform: nextSupported[0]?.platform ?? value.platform,
        authType: nextSupported[0]?.authType ?? value.authType,
        scopes: nextSupported[0]?.requiredScopes.join(', ') ?? value.scopes,
      }));
      const currentPrompt = nextPrompts.find((item) => item.platform === promptForm.platform) ?? nextPrompts[0];
      if (currentPrompt) {
        hydratePromptForm(currentPrompt);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Channel settings failed to load.');
    } finally {
      setLoading(false);
    }
  }

  async function addChannel() {
    if (!form.displayName.trim()) {
      notify('Add a channel display name first.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/social-channels`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: form.platform,
          displayName: form.displayName,
          handle: form.handle || undefined,
          externalAccountId: form.externalAccountId || undefined,
          accountType: form.accountType || undefined,
          authType: form.authType,
          scopes: parseScopes(form.scopes),
          accessToken: form.accessToken || undefined,
          refreshToken: form.refreshToken || undefined,
          tokenExpiresAt: form.tokenExpiresAt ? new Date(form.tokenExpiresAt).toISOString() : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Could not add this channel.');
      }

      notify('Channel added.');
      setForm({
        ...initialForm,
        platform: form.platform,
        authType: selectedPlatform?.authType ?? form.authType,
        scopes: selectedPlatform?.requiredScopes.join(', ') ?? '',
      });
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Channel could not be added.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(channel: ChannelAccount, status: ChannelStatus) {
    setBusyId(channel.id);
    try {
      const response = await fetch(`${apiBaseUrl}/api/social-channels/${channel.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error('Could not update channel status.');
      }
      notify('Channel status updated.');
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Channel update failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function healthCheck(channel: ChannelAccount) {
    setBusyId(channel.id);
    try {
      const response = await fetch(`${apiBaseUrl}/api/social-channels/${channel.id}/health-check`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Health check failed.');
      }
      notify('Channel health checked.');
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Health check failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function removeChannel(channel: ChannelAccount) {
    setBusyId(channel.id);
    try {
      const response = await fetch(`${apiBaseUrl}/api/social-channels/${channel.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Could not remove channel.');
      }
      notify('Channel removed.');
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Channel removal failed.');
    } finally {
      setBusyId(null);
    }
  }

  function notify(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => {
      setMessage(null);
    }, 3200);
  }

  function toggleTheme() {
    const current = darkMode ?? document.documentElement.classList.contains('dark');
    const next = !current;
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem('socialflow-theme', next ? 'dark' : 'light');
    setDarkMode(next);
  }

  function updatePlatform(platform: Platform) {
    const config = supported.find((item) => item.platform === platform);
    setForm((value) => ({
      ...value,
      platform,
      authType: config?.authType ?? value.authType,
      scopes: config?.requiredScopes.join(', ') ?? value.scopes,
    }));
  }

  function hydratePromptForm(template: PromptTemplate) {
    setPromptForm({
      platform: template.platform,
      name: template.name,
      description: template.description ?? '',
      template: template.template,
      negativePrompt: template.negativePrompt ?? '',
      styleNotes: template.styleNotes ?? '',
    });
    setPromptPreview('');
  }

  function updatePromptPlatform(platform: Platform) {
    const template = promptTemplates.find((item) => item.platform === platform && item.purpose === 'IMAGE_GENERATION');
    if (template) {
      hydratePromptForm(template);
      return;
    }

    setPromptForm((value) => ({ ...value, platform }));
    setPromptPreview('');
  }

  async function savePromptTemplate() {
    if (!promptForm.template.trim()) {
      notify('Add an image prompt template before saving.');
      return;
    }

    setSavingPrompt(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/prompt-templates`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: promptForm.platform,
          purpose: 'IMAGE_GENERATION',
          name: promptForm.name || `${titleCase(promptForm.platform)} image prompt`,
          description: promptForm.description || undefined,
          template: promptForm.template,
          negativePrompt: promptForm.negativePrompt || undefined,
          styleNotes: promptForm.styleNotes || undefined,
          active: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Could not save this prompt template.');
      }

      notify('Image prompt template saved.');
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Prompt template could not be saved.');
    } finally {
      setSavingPrompt(false);
    }
  }

  async function resetPromptTemplate() {
    setSavingPrompt(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/prompt-templates/${promptForm.platform}/reset`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Could not reset this prompt template.');
      }

      const resetTemplate = (await response.json()) as PromptTemplate;
      hydratePromptForm(resetTemplate);
      notify('Prompt reset to default.');
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Prompt template could not be reset.');
    } finally {
      setSavingPrompt(false);
    }
  }

  async function previewPromptTemplate() {
    setPreviewingPrompt(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/prompt-templates/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: promptForm.platform,
          purpose: 'IMAGE_GENERATION',
          title: 'Fat Loss Research Peptides: A Scientific Review',
          excerpt: 'A careful article about peptide research, metabolism, and weight-management science.',
          content: 'Peptides are short chains of amino acids discussed in research contexts. The visual should be scientific, careful, and non-prescriptive.',
          categories: 'Guest Posts, Health Science, Peptides',
        }),
      });

      if (!response.ok) {
        throw new Error('Could not preview this prompt.');
      }

      const result = (await response.json()) as { prompt: string };
      setPromptPreview(result.prompt);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Prompt preview failed.');
    } finally {
      setPreviewingPrompt(false);
    }
  }

  return (
    <div className="sf-app-bg min-h-screen text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-2xl dark:border-white/10">
        <div className="mx-auto flex max-w-[92rem] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">Admin panel</div>
            <div className="truncate text-xs text-muted-foreground">Manage connected social publishing channels</div>
          </div>
          <Button aria-label="Toggle theme" onClick={toggleTheme} size="sm" variant="outline">
            {darkMode ? <Sparkles className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          </Button>
          <LogoutButton />
        </div>
      </header>

      <main className="sf-page-enter mx-auto flex w-full max-w-[92rem] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {message ? (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-700 dark:text-sky-200">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Badge className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" variant="outline">
              <RadioTower className="mr-1 h-3.5 w-3.5" />
              Social channel control
            </Badge>
            <h1 className="text-3xl font-semibold tracking-normal">Channel Management</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Add Facebook Pages, Instagram Business, Pinterest, LinkedIn, and X accounts used for publishing, scheduling, and campaign routing.
            </p>
          </div>
          <Card className="border-border/80 bg-card/95 dark:border-white/10">
            <CardContent className="grid grid-cols-4 gap-2 p-3">
              <Metric label="Total" value={summary.total} />
              <Metric label="Connected" value={summary.connected} tone="success" />
              <Metric label="Needs action" value={summary.actionRequired} tone="warning" />
              <Metric label="Expired" value={summary.expired} tone="danger" />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
          <Card className="border-border/80 bg-card/95 dark:border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="h-5 w-5" />
                Add channel
              </CardTitle>
              <CardDescription>Store the channel record now. OAuth connect buttons can reuse this same backend table.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Platform</label>
                <select
                  className="sf-focus-ring h-11 rounded-lg border border-input bg-background/80 px-3 text-sm dark:bg-white/[0.035]"
                  onChange={(event) => {
                    updatePlatform(event.target.value as Platform);
                  }}
                  value={form.platform}
                >
                  {supported.map((item) => (
                    <option key={item.platform} value={item.platform}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPlatform ? (
                <div className="rounded-lg border border-border bg-muted/35 p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="font-medium">{selectedPlatform.setupHint}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Required scopes: {selectedPlatform.requiredScopes.join(', ')}
                  </div>
                </div>
              ) : null}

              <Field label="Display name">
                <Input
                  onChange={(event) => {
                    setForm((value) => ({ ...value, displayName: event.target.value }));
                  }}
                  placeholder="Mind Family Pinterest"
                  value={form.displayName}
                />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Handle">
                  <Input
                    onChange={(event) => {
                      setForm((value) => ({ ...value, handle: event.target.value }));
                    }}
                    placeholder="@mindfamily"
                    value={form.handle}
                  />
                </Field>
                <Field label="Account ID">
                  <Input
                    onChange={(event) => {
                      setForm((value) => ({ ...value, externalAccountId: event.target.value }));
                    }}
                    placeholder="page, board, or business account id"
                    value={form.externalAccountId}
                  />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Account type">
                  <Input
                    onChange={(event) => {
                      setForm((value) => ({ ...value, accountType: event.target.value }));
                    }}
                    placeholder="Page, Business, Board"
                    value={form.accountType}
                  />
                </Field>
                <Field label="Token expires">
                  <Input
                    onChange={(event) => {
                      setForm((value) => ({ ...value, tokenExpiresAt: event.target.value }));
                    }}
                    type="datetime-local"
                    value={form.tokenExpiresAt}
                  />
                </Field>
              </div>
              <Field label="Scopes">
                <Input
                  onChange={(event) => {
                    setForm((value) => ({ ...value, scopes: event.target.value }));
                  }}
                  value={form.scopes}
                />
              </Field>
              <Field label="Access token">
                <Input
                  onChange={(event) => {
                    setForm((value) => ({ ...value, accessToken: event.target.value }));
                  }}
                  placeholder="Paste token for manual setup"
                  type="password"
                  value={form.accessToken}
                />
              </Field>
              <Field label="Refresh token">
                <Input
                  onChange={(event) => {
                    setForm((value) => ({ ...value, refreshToken: event.target.value }));
                  }}
                  placeholder="Optional"
                  type="password"
                  value={form.refreshToken}
                />
              </Field>
              <Button
                disabled={saving}
                onClick={() => {
                  void addChannel();
                }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Add channel
              </Button>
              {!isAdmin ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
                  Your role is {user.role}. Admin, Super Admin, and Manager users should manage production credentials.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/80 bg-card/95 dark:border-white/10">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Connected channels</CardTitle>
                <CardDescription>Accounts available to campaign generation, scheduling, and publishing workflows.</CardDescription>
              </div>
              <Button
                disabled={loading}
                onClick={() => {
                  void loadData();
                }}
                size="sm"
                variant="outline"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {loading ? (
                <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground dark:border-white/10">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Loading channels
                </div>
              ) : channels.length ? (
                channels.map((channel) => (
                  <ChannelCard
                    busy={busyId === channel.id}
                    channel={channel}
                    key={channel.id}
                    onHealthCheck={() => {
                      void healthCheck(channel);
                    }}
                    onRemove={() => {
                      void removeChannel(channel);
                    }}
                    onStatus={(status) => {
                      void updateStatus(channel, status);
                    }}
                  />
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground dark:border-white/10">
                  No channels connected yet. Add your first publishing account from the panel on the left.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
          <Card className="border-border/80 bg-card/95 dark:border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5" />
                Prompt Studio
              </CardTitle>
              <CardDescription>
                Manage the exact image-generation prompt used for every channel when WordPress content creates campaign visuals.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {promptTemplates.map((template) => (
                <button
                  className={cn(
                    'rounded-xl border border-border bg-background/70 p-4 text-left transition hover:border-primary/40 dark:border-white/10 dark:bg-white/[0.03]',
                    promptForm.platform === template.platform ? 'border-primary/60 bg-primary/5' : '',
                  )}
                  key={template.id}
                  onClick={() => {
                    hydratePromptForm(template);
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge className={platformTone[template.platform]} variant="outline">
                      {titleCase(template.platform)}
                    </Badge>
                    <Badge variant="secondary">v{template.version}</Badge>
                  </div>
                  <div className="mt-3 font-semibold">{template.name}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.description ?? template.styleNotes ?? 'Custom image prompt'}</p>
                  <div className="mt-3 text-xs text-muted-foreground">Updated {formatDate(template.updatedAt)}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95 dark:border-white/10">
            <CardHeader className="flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-lg">Image prompt editor</CardTitle>
                <CardDescription>
                  Variables: {'{{articleTitle}}'}, {'{{articleExcerpt}}'}, {'{{articleContext}}'}, {'{{categories}}'}, {'{{platform}}'}, {'{{topicGuidance}}'}, {'{{captionTitle}}'}, {'{{captionBody}}'}.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={previewingPrompt}
                  onClick={() => {
                    void previewPromptTemplate();
                  }}
                  size="sm"
                  variant="outline"
                >
                  {previewingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clipboard className="h-4 w-4" />}
                  Preview
                </Button>
                <Button
                  disabled={savingPrompt}
                  onClick={() => {
                    void resetPromptTemplate();
                  }}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  disabled={savingPrompt}
                  onClick={() => {
                    void savePromptTemplate();
                  }}
                  size="sm"
                >
                  {savingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Save prompt
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[0.45fr_1fr]">
                <Field label="Channel">
                  <select
                    className="sf-focus-ring h-11 rounded-lg border border-input bg-background/80 px-3 text-sm dark:bg-white/[0.035]"
                    onChange={(event) => {
                      updatePromptPlatform(event.target.value as Platform);
                    }}
                    value={promptForm.platform}
                  >
                    {Object.keys(platformTone).map((platform) => (
                      <option key={platform} value={platform}>
                        {titleCase(platform)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Prompt name">
                  <Input
                    onChange={(event) => {
                      setPromptForm((value) => ({ ...value, name: event.target.value }));
                    }}
                    value={promptForm.name}
                  />
                </Field>
              </div>

              <Field label="Description">
                <Input
                  onChange={(event) => {
                    setPromptForm((value) => ({ ...value, description: event.target.value }));
                  }}
                  placeholder="What this prompt should produce"
                  value={promptForm.description}
                />
              </Field>

              <Field label="Main image prompt">
                <textarea
                  className="sf-focus-ring min-h-72 resize-y rounded-lg border border-input bg-background/80 px-3 py-3 text-sm leading-6 dark:bg-white/[0.035]"
                  onChange={(event) => {
                    setPromptForm((value) => ({ ...value, template: event.target.value }));
                  }}
                  value={promptForm.template}
                />
              </Field>

              <div className="grid gap-3 lg:grid-cols-2">
                <Field label="Negative prompt">
                  <textarea
                    className="sf-focus-ring min-h-36 resize-y rounded-lg border border-input bg-background/80 px-3 py-3 text-sm leading-6 dark:bg-white/[0.035]"
                    onChange={(event) => {
                      setPromptForm((value) => ({ ...value, negativePrompt: event.target.value }));
                    }}
                    value={promptForm.negativePrompt}
                  />
                </Field>
                <Field label="Style notes">
                  <textarea
                    className="sf-focus-ring min-h-36 resize-y rounded-lg border border-input bg-background/80 px-3 py-3 text-sm leading-6 dark:bg-white/[0.035]"
                    onChange={(event) => {
                      setPromptForm((value) => ({ ...value, styleNotes: event.target.value }));
                    }}
                    value={promptForm.styleNotes}
                  />
                </Field>
              </div>

              <div className="rounded-xl border border-border bg-muted/35 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Current template</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedPrompt ? `Version ${String(selectedPrompt.version)} - updated ${formatDate(selectedPrompt.updatedAt)}` : 'No saved prompt selected'}
                    </div>
                  </div>
                  <Badge variant="secondary">{promptForm.platform}</Badge>
                </div>
                {promptPreview ? (
                  <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-4 text-xs leading-5 text-muted-foreground dark:bg-black/30">
                    {promptPreview}
                  </pre>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Use Preview to see the final rendered prompt with sample WordPress content before saving or generating new campaign images.
                  </p>
                )}
              </div>

              {!isAdmin ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
                  Your role is {user.role}. Only Admin, Super Admin, and Manager users can save prompt templates.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function ChannelCard({
  channel,
  busy,
  onHealthCheck,
  onRemove,
  onStatus,
}: {
  channel: ChannelAccount;
  busy: boolean;
  onHealthCheck: () => void;
  onRemove: () => void;
  onStatus: (status: ChannelStatus) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-4 transition hover:border-primary/35 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={platformTone[channel.platform]} variant="outline">
              {titleCase(channel.platform)}
            </Badge>
            <StatusBadge status={channel.status} />
            <Badge variant="secondary">{channel.authType.replaceAll('_', ' ')}</Badge>
          </div>
          <h3 className="mt-3 text-lg font-semibold">{channel.displayName}</h3>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {channel.handle ? <span>{channel.handle}</span> : null}
            {channel.externalAccountId ? <span>ID: {channel.externalAccountId}</span> : null}
            {channel.accountType ? <span>{channel.accountType}</span> : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {channel.scopes.slice(0, 5).map((scope) => (
              <Badge key={scope} variant="outline">{scope}</Badge>
            ))}
            {channel.scopes.length > 5 ? <Badge variant="secondary">+{channel.scopes.length - 5}</Badge> : null}
          </div>
          {channel.lastError ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" />
              {channel.lastError}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          <Button disabled={busy} onClick={onHealthCheck} size="sm" variant="outline">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Check
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              onStatus('CONNECTED');
            }}
            size="sm"
            variant="outline"
          >
            <CheckCircle2 className="h-4 w-4" />
            Connect
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              onStatus('DISCONNECTED');
            }}
            size="sm"
            variant="outline"
          >
            <ExternalLink className="h-4 w-4" />
            Disable
          </Button>
          <Button disabled={busy} onClick={onRemove} size="sm" variant="destructive">
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 border-t border-border pt-3 text-xs text-muted-foreground dark:border-white/10 md:grid-cols-3">
        <span>Added {formatDate(channel.createdAt)}</span>
        <span>Updated {formatDate(channel.updatedAt)}</span>
        <span>Health {channel.lastHealthCheckAt ? formatDate(channel.lastHealthCheckAt) : 'not checked'}</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' | 'danger' }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3 text-center dark:bg-white/[0.04]">
      <div
        className={cn(
          'text-xl font-semibold',
          tone === 'success' ? 'text-emerald-600 dark:text-emerald-300' : '',
          tone === 'warning' ? 'text-amber-600 dark:text-amber-300' : '',
          tone === 'danger' ? 'text-rose-600 dark:text-rose-300' : '',
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ChannelStatus }) {
  const styles: Record<ChannelStatus, string> = {
    CONNECTED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    ACTION_REQUIRED: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    DISCONNECTED: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
    EXPIRED: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  };

  return (
    <Badge className={styles[status]} variant="outline">
      {titleCase(status)}
    </Badge>
  );
}

function parseScopes(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
