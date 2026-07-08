'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';

import { LogoutButton } from '@/components/auth/logout-button';
import { BrandIcon } from '@/components/brand/brand-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AuthenticatedUser } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

type SocialPlatform = 'PINTEREST' | 'INSTAGRAM' | 'LINKEDIN' | 'X' | 'FACEBOOK';
type DraftStatus = 'DRAFT' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'REJECTED';

interface PipelineOverview {
  totals: {
    sourceArticles: number;
    notGenerated: number;
    campaigns: number;
    drafts: number;
    jobs: number;
  };
  jobsByStatus: { status: string; count: number }[];
  draftsByStatus: { status: DraftStatus; count: number }[];
  recentJobs: QueueJob[];
  recentDrafts: SocialDraft[];
}

interface SourceArticle {
  id: string;
  wordpressId: number;
  title: string;
  excerpt: string;
  url: string;
  authorName: string | null;
  featuredImageUrl: string | null;
  categoryNames: string[];
  tagNames: string[];
  modifiedAt: string | null;
  connection: { id: string; siteUrl: string };
  _count: { campaigns: number; socialDrafts: number };
}

interface QueueJob {
  id: string;
  jobName: string;
  status: string;
  attempts: number;
  failedReason: string | null;
  createdAt: string;
  finishedAt: string | null;
}

interface SocialDraft {
  id: string;
  platform: SocialPlatform;
  status: DraftStatus;
  title: string;
  body: string;
  hashtags: string[];
  mediaUrl: string | null;
  createdAt: string;
  article: {
    id?: string;
    title: string;
    url?: string;
    featuredImageUrl: string | null;
    connection?: { siteUrl: string };
  };
}

const platforms: { value: SocialPlatform; label: string }[] = [
  { value: 'PINTEREST', label: 'Pinterest' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'X', label: 'X' },
  { value: 'FACEBOOK', label: 'Facebook' },
];

export function AiPipeline({ user }: { user: AuthenticatedUser }) {
  const apiBaseUrl = getApiBaseUrl();
  const canGenerate = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CONTENT_WRITER', 'PUBLISHER'].includes(
    user.role,
  );
  const [overview, setOverview] = useState<PipelineOverview | null>(null);
  const [sources, setSources] = useState<SourceArticle[]>([]);
  const [drafts, setDrafts] = useState<SocialDraft[]>([]);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([
    'PINTEREST',
    'INSTAGRAM',
    'LINKEDIN',
    'X',
  ]);
  const [search, setSearch] = useState('');
  const [prompt, setPrompt] = useState('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadOverview();
    void loadDrafts();
    void loadJobs();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSources();
    }, 250);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [page, search]);

  const allVisibleSelected =
    sources.length > 0 && sources.every((source) => selectedIds.includes(source.id));

  async function loadOverview() {
    const response = await fetch(`${apiBaseUrl}/api/ai-pipeline/overview`, {
      cache: 'no-store',
      credentials: 'include',
    });
    if (response.ok) setOverview((await response.json()) as PipelineOverview);
  }

  async function loadSources() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`${apiBaseUrl}/api/ai-pipeline/sources?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Unable to load source articles.');
      const payload = (await response.json()) as {
        data: SourceArticle[];
        pagination: { total: number; totalPages: number };
      };
      setSources(payload.data);
      setTotal(payload.pagination.total);
      setTotalPages(Math.max(payload.pagination.totalPages, 1));
      setSelectedIds((ids) => ids.filter((id) => payload.data.some((source) => source.id === id)));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Source queue failed.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDrafts() {
    const response = await fetch(`${apiBaseUrl}/api/ai-pipeline/drafts`, {
      cache: 'no-store',
      credentials: 'include',
    });
    if (response.ok) {
      const payload = (await response.json()) as { data: SocialDraft[] };
      setDrafts(payload.data);
    }
  }

  async function loadJobs() {
    const response = await fetch(`${apiBaseUrl}/api/ai-pipeline/jobs`, {
      cache: 'no-store',
      credentials: 'include',
    });
    if (response.ok) {
      const payload = (await response.json()) as { data: QueueJob[] };
      setJobs(payload.data);
    }
  }

  async function generateSelected() {
    if (!canGenerate) {
      notify('You do not have permission to run the AI pipeline.');
      return;
    }

    if (!selectedIds.length) {
      notify('Select at least one WordPress article.');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/ai-pipeline/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleIds: selectedIds,
          platforms: selectedPlatforms,
          prompt: prompt.trim() || undefined,
          promptVersion: 'ai-pipeline-v1',
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const result = (await response.json()) as { completed: number; failed: number };
      notify(`Generated ${String(result.completed)} campaigns. Failed: ${String(result.failed)}.`);
      setSelectedIds([]);
      await Promise.all([loadOverview(), loadSources(), loadDrafts(), loadJobs()]);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'AI generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  async function updateDraftStatus(id: string, status: DraftStatus) {
    const response = await fetch(`${apiBaseUrl}/api/ai-pipeline/drafts/${id}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      notify(`Draft ${status.toLowerCase()}.`);
      await Promise.all([loadOverview(), loadDrafts()]);
    } else {
      notify(await readError(response));
    }
  }

  function notify(value: string) {
    setMessage(value);
    window.setTimeout(() => {
      setMessage(null);
    }, 3500);
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((ids) => ids.filter((id) => !sources.some((source) => source.id === id)));
      return;
    }
    setSelectedIds((ids) => Array.from(new Set([...ids, ...sources.map((source) => source.id)])));
  }

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }

  function togglePlatform(platform: SocialPlatform) {
    setSelectedPlatforms((items) =>
      items.includes(platform) ? items.filter((item) => item !== platform) : [...items, platform],
    );
  }

  return (
    <div className="sf-app-bg min-h-screen text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/78 backdrop-blur-2xl dark:border-white/10">
        <div className="mx-auto flex max-w-[96rem] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <BrandIcon className="h-10 w-10 rounded-xl" priority />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">AI Content Pipeline</div>
            <div className="text-xs text-muted-foreground">
              Turn WordPress articles into reviewed, reusable social campaigns.
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/campaigns">Campaigns</Link>
          </Button>
          <LogoutButton />
        </div>
      </header>

      <main className="sf-page-enter mx-auto grid w-full max-w-[96rem] gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {message ? (
          <div className="fixed right-4 top-20 z-40 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-700 shadow-2xl backdrop-blur dark:text-sky-200">
            {message}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-5">
          <Metric label="Sources" value={overview?.totals.sourceArticles ?? 0} />
          <Metric label="Ready" value={overview?.totals.notGenerated ?? 0} />
          <Metric label="Campaigns" value={overview?.totals.campaigns ?? 0} />
          <Metric label="Drafts" value={overview?.totals.drafts ?? 0} />
          <Metric label="Jobs" value={overview?.totals.jobs ?? 0} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_28rem]">
          <Card className="overflow-hidden border-border/80 dark:border-white/10">
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Source Queue</CardTitle>
                  <CardDescription>WordPress posts without generated campaigns.</CardDescription>
                </div>
                <Button
                  disabled={generating || !selectedIds.length || !selectedPlatforms.length}
                  onClick={() => void generateSelected()}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <WandSparkles className="h-4 w-4" />
                  )}
                  Generate Selected
                </Button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    onChange={(event) => {
                      setPage(1);
                      setSearch(event.target.value);
                    }}
                    placeholder="Search source articles"
                    value={search}
                  />
                </div>
                <Input
                  onChange={(event) => {
                    setPrompt(event.target.value);
                  }}
                  placeholder="Optional AI instruction, tone, or campaign angle"
                  value={prompt}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {platforms.map((platform) => (
                  <button
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm transition',
                      selectedPlatforms.includes(platform.value)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground dark:border-white/10',
                    )}
                    key={platform.value}
                    onClick={() => {
                      togglePlatform(platform.value);
                    }}
                    type="button"
                  >
                    {platform.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="sf-data-table w-full min-w-[62rem] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground dark:bg-white/[0.03]">
                    <tr>
                      <th className="w-12 px-4 py-3">
                        <button
                          aria-label="Select visible articles"
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded border border-border dark:border-white/20',
                            allVisibleSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background',
                          )}
                          onClick={toggleAllVisible}
                          type="button"
                        >
                          {allVisibleSelected ? <Check className="h-3 w-3" /> : null}
                        </button>
                      </th>
                      <th className="px-4 py-3">Article</th>
                      <th className="px-4 py-3">Taxonomy</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="px-4 py-12 text-center text-muted-foreground" colSpan={5}>
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Loading source queue
                        </td>
                      </tr>
                    ) : sources.length ? (
                      sources.map((source) => (
                        <tr className="border-t border-border dark:border-white/10" key={source.id}>
                          <td className="px-4 py-4 align-top">
                            <button
                              aria-label={`Select ${source.title}`}
                              className={cn(
                                'mt-1 flex h-4 w-4 items-center justify-center rounded border border-border dark:border-white/20',
                                selectedIds.includes(source.id)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-background',
                              )}
                              onClick={() => {
                                toggleSelected(source.id);
                              }}
                              type="button"
                            >
                              {selectedIds.includes(source.id) ? (
                                <Check className="h-3 w-3" />
                              ) : null}
                            </button>
                          </td>
                          <td className="max-w-xl px-4 py-4 align-top">
                            <div className="flex gap-3">
                              {source.featuredImageUrl ? (
                                <img
                                  alt=""
                                  className="h-14 w-20 rounded-md object-cover"
                                  src={source.featuredImageUrl}
                                />
                              ) : (
                                <div className="flex h-14 w-20 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                  <FileText className="h-5 w-5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="line-clamp-2 font-medium">{source.title}</div>
                                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {source.excerpt}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex max-w-56 flex-wrap gap-1.5">
                              {source.categoryNames.slice(0, 2).map((item) => (
                                <Badge key={item} variant="secondary">
                                  {item}
                                </Badge>
                              ))}
                              {source.tagNames.slice(0, 2).map((item) => (
                                <Badge key={item} variant="outline">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-muted-foreground">
                            {source.connection.siteUrl.replace(/^https?:\/\//, '')}
                          </td>
                          <td className="px-4 py-4 align-top text-muted-foreground">
                            {formatDate(source.modifiedAt)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-12 text-center text-muted-foreground" colSpan={5}>
                          No ungenerated WordPress articles found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-muted-foreground">
                  Showing {sources.length} of {total} articles
                </div>
                <div className="flex items-center gap-2">
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

          <div className="grid gap-4">
            <Card className="border-border/80 dark:border-white/10">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Pipeline Jobs</CardTitle>
                  <CardDescription>Recent AI generation runs.</CardDescription>
                </div>
                <Button onClick={() => void loadJobs()} size="sm" variant="outline">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="grid gap-2">
                {jobs.slice(0, 6).map((job) => (
                  <div
                    className="rounded-md border border-border p-3 text-sm dark:border-white/10"
                    key={job.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{titleCase(job.jobName)}</span>
                      <StatusBadge value={job.status} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(job.finishedAt ?? job.createdAt)}
                    </div>
                    {job.failedReason ? (
                      <div className="mt-1 text-xs text-destructive">{job.failedReason}</div>
                    ) : null}
                  </div>
                ))}
                {!jobs.length ? <EmptyState label="No AI jobs yet." /> : null}
              </CardContent>
            </Card>

            <Card className="border-border/80 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">Review Drafts</CardTitle>
                <CardDescription>Approve or reject generated draft content.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {drafts.slice(0, 5).map((draft) => (
                  <div
                    className="rounded-md border border-border p-3 text-sm dark:border-white/10"
                    key={draft.id}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge variant="secondary">{titleCase(draft.platform)}</Badge>
                      <StatusBadge value={draft.status} />
                    </div>
                    <div className="font-medium">{draft.title}</div>
                    <p className="mt-2 line-clamp-4 text-muted-foreground">{draft.body}</p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        disabled={!canGenerate}
                        onClick={() => void updateDraftStatus(draft.id, 'APPROVED')}
                        size="sm"
                        variant="outline"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        disabled={!canGenerate}
                        onClick={() => void updateDraftStatus(draft.id, 'REJECTED')}
                        size="sm"
                        variant="outline"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
                {!drafts.length ? <EmptyState label="No generated drafts yet." /> : null}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="sf-card-hover border-border/80 dark:border-white/10">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-2xl font-semibold">
            {new Intl.NumberFormat('en-US').format(value)}
          </div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ value }: { value: string }) {
  return <Badge variant="outline">{titleCase(value)}</Badge>;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background/40 p-5 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.025]">
      {label}
    </div>
  );
}

async function readError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(payload.message)) return payload.message.join(' ');
    if (payload.message) return payload.message;
  } catch {
    return 'Request failed.';
  }
  return 'Request failed.';
}

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll('-', ' ')
    .split('_')
    .flatMap((part) => part.split(' '))
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
