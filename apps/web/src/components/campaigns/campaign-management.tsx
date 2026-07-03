'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ArrowDownUp,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileText,
  Loader2,
  Megaphone,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';

import { LogoutButton } from '@/components/auth/logout-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuthenticatedUser } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

type CampaignStatus = 'NOT_GENERATED' | 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'ARCHIVED';
type SocialPlatform = 'PINTEREST' | 'INSTAGRAM' | 'LINKEDIN' | 'X' | 'FACEBOOK';
type SortBy = 'updatedAt' | 'createdAt' | 'name' | 'status';
type SortDir = 'asc' | 'desc';

interface CampaignSummary {
  totals: {
    campaigns: number;
    scheduled: number;
    published: number;
    failed: number;
    generations: number;
    publishingRecords: number;
  };
  byStatus: { status: CampaignStatus; count: number }[];
}

interface CampaignListItem {
  id: string;
  name: string;
  status: CampaignStatus;
  promptVersion: string;
  aiModel: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  article: {
    id: string;
    title: string;
    url: string;
    featuredImageUrl: string | null;
    authorName: string | null;
    publishedAt: string | null;
    connection: {
      id: string;
      siteUrl: string;
    };
  };
  generationCount: number;
  publishingHistoryCount: number;
  platforms: SocialPlatform[];
  nextPublishAt: string | null;
  lastPublishedAt: string | null;
}

interface CampaignDetail extends CampaignListItem {
  generations: {
    id: string;
    platform: SocialPlatform;
    caption: string;
    hashtags: string[];
    imageUrl: string | null;
    promptVersion: string;
    aiModel: string;
    version: number;
    generatedAt: string;
  }[];
  publishingHistory: {
    id: string;
    platform: SocialPlatform;
    platformAccount: string;
    status: string;
    scheduledFor: string | null;
    publishedAt: string | null;
    postUrl: string | null;
    errorLog: string | null;
  }[];
  regenerationHistory: { id: string; version: number; reason: string | null; generatedAt: string }[];
}

interface PaginatedCampaigns {
  data: CampaignListItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

const statuses: { value: CampaignStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const platforms: { value: SocialPlatform | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All platforms' },
  { value: 'PINTEREST', label: 'Pinterest' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'X', label: 'X' },
  { value: 'FACEBOOK', label: 'Facebook' },
];

export function CampaignManagement({ user }: { user: AuthenticatedUser }) {
  const apiBaseUrl = getApiBaseUrl();
  const canManage = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'PUBLISHER'].includes(user.role);
  const [summary, setSummary] = useState<CampaignSummary | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CampaignStatus | 'ALL'>('ALL');
  const [platform, setPlatform] = useState<SocialPlatform | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState('');
  const [editingGenerationId, setEditingGenerationId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [hashtagsDraft, setHashtagsDraft] = useState('');

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCampaigns();
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [page, perPage, search, status, platform, sortBy, sortDir]);

  const allVisibleSelected = campaigns.length > 0 && campaigns.every((campaign) => selectedIds.includes(campaign.id));
  const selectedCount = selectedIds.length;

  async function loadSummary() {
    const response = await fetch(`${apiBaseUrl}/api/campaigns/summary`, {
      cache: 'no-store',
      credentials: 'include',
    });

    if (response.ok) {
      setSummary((await response.json()) as CampaignSummary);
    }
  }

  async function loadCampaigns() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
        sortBy,
        sortDir,
      });
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'ALL') params.set('status', status);
      if (platform !== 'ALL') params.set('platform', platform);

      const response = await fetch(`${apiBaseUrl}/api/campaigns?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Unable to load campaigns.');
      }

      const payload = (await response.json()) as PaginatedCampaigns;
      setCampaigns(payload.data);
      setTotal(payload.pagination.total);
      setTotalPages(Math.max(payload.pagination.totalPages, 1));
      setSelectedIds((ids) => ids.filter((id) => payload.data.some((campaign) => campaign.id === id)));

      if (selectedCampaign && !payload.data.some((campaign) => campaign.id === selectedCampaign.id)) {
        setSelectedCampaign(null);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Campaigns failed to load.');
    } finally {
      setLoading(false);
    }
  }

  async function openCampaign(id: string) {
    setBusy(id);
    try {
      const response = await fetch(`${apiBaseUrl}/api/campaigns/${id}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Unable to load campaign detail.');
      setSelectedCampaign((await response.json()) as CampaignDetail);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to open campaign.');
    } finally {
      setBusy(null);
    }
  }

  async function updateStatus(id: string, nextStatus: CampaignStatus) {
    setBusy(id);
    try {
      const response = await fetch(`${apiBaseUrl}/api/campaigns/${id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error('Unable to update campaign status.');
      notify('Campaign status updated.');
      await refreshAfterMutation(id);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Status update failed.');
    } finally {
      setBusy(null);
    }
  }

  async function scheduleCampaign(id: string) {
    if (!scheduleFor) {
      notify('Choose a schedule date and time.');
      return;
    }

    setBusy(id);
    try {
      const response = await fetch(`${apiBaseUrl}/api/campaigns/${id}/schedule`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: new Date(scheduleFor).toISOString() }),
      });
      if (!response.ok) throw new Error('Unable to schedule campaign.');
      notify('Campaign scheduled.');
      await refreshAfterMutation(id);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Scheduling failed.');
    } finally {
      setBusy(null);
    }
  }

  async function runBulk(action: 'archive' | 'mark-published') {
    if (!selectedIds.length) {
      notify('Select at least one campaign.');
      return;
    }

    setBusy(action);
    try {
      const response = await fetch(`${apiBaseUrl}/api/campaigns/bulk`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, campaignIds: selectedIds }),
      });
      if (!response.ok) throw new Error('Bulk action failed.');
      const result = (await response.json()) as { processed: number };
      notify(`${String(result.processed)} campaigns processed.`);
      setSelectedIds([]);
      await Promise.all([loadCampaigns(), loadSummary()]);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Bulk action failed.');
    } finally {
      setBusy(null);
    }
  }

  async function saveGeneration() {
    if (!selectedCampaign || !editingGenerationId) return;

    setBusy(editingGenerationId);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/campaigns/${selectedCampaign.id}/generations/${editingGenerationId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption: captionDraft,
            hashtags: hashtagsDraft
              .split(/[,\s]+/)
              .map((item) => item.trim())
              .filter(Boolean)
              .map((item) => (item.startsWith('#') ? item : `#${item}`)),
          }),
        },
      );
      if (!response.ok) throw new Error('Unable to update generated content.');
      setEditingGenerationId(null);
      notify('Generated content updated.');
      await openCampaign(selectedCampaign.id);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Generated content update failed.');
    } finally {
      setBusy(null);
    }
  }

  async function refreshAfterMutation(id: string) {
    await Promise.all([loadCampaigns(), loadSummary(), selectedCampaign?.id === id ? openCampaign(id) : Promise.resolve()]);
  }

  function notify(value: string) {
    setMessage(value);
    window.setTimeout(() => { setMessage(null); }, 3200);
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((ids) => ids.filter((id) => !campaigns.some((campaign) => campaign.id === id)));
      return;
    }
    setSelectedIds((ids) => Array.from(new Set([...ids, ...campaigns.map((campaign) => campaign.id)])));
  }

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }

  function beginEdit(generation: CampaignDetail['generations'][number]) {
    setEditingGenerationId(generation.id);
    setCaptionDraft(generation.caption);
    setHashtagsDraft(generation.hashtags.join(' '));
  }

  const summaryCards = useMemo(
    () => [
      { label: 'Campaigns', value: summary?.totals.campaigns ?? 0, icon: Megaphone },
      { label: 'Scheduled', value: summary?.totals.scheduled ?? 0, icon: CalendarClock },
      { label: 'Published', value: summary?.totals.published ?? 0, icon: Send },
      { label: 'Generated Assets', value: summary?.totals.generations ?? 0, icon: Sparkles },
    ],
    [summary],
  );

  return (
    <div className="sf-app-bg min-h-screen text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/78 backdrop-blur-2xl dark:border-white/10">
        <div className="mx-auto flex max-w-[96rem] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl sf-gradient-icon">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Campaign Management</div>
            <div className="text-xs text-muted-foreground">Reusable AI campaigns, approvals, publishing state, and generated content.</div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/wordpress-hub">WordPress Hub</Link>
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

        <section className="grid gap-3 md:grid-cols-4">
          {summaryCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card className="sf-card-hover border-border/80 dark:border-white/10" key={item.label}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-2xl font-semibold">{formatNumber(item.value)}</div>
                    <div className="text-sm text-muted-foreground">{item.label}</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_28rem]">
          <Card className="overflow-hidden border-border/80 dark:border-white/10">
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Campaign Library</CardTitle>
                  <CardDescription>Server-side search, filters, sorting, pagination, and bulk actions.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!canManage || !selectedCount || busy !== null}
                    onClick={() => void runBulk('mark-published')}
                    size="sm"
                    variant="outline"
                  >
                    <Check className="h-4 w-4" />
                    Mark Published
                  </Button>
                  <Button
                    disabled={!canManage || !selectedCount || busy !== null}
                    onClick={() => void runBulk('archive')}
                    size="sm"
                    variant="outline"
                  >
                    <Archive className="h-4 w-4" />
                    Archive
                  </Button>
                  <Button onClick={() => void loadCampaigns()} size="sm" variant="outline">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 lg:grid-cols-[1fr_12rem_12rem_10rem]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    onChange={(event) => {
                      setPage(1);
                      setSearch(event.target.value);
                    }}
                    placeholder="Search campaigns or source articles"
                    value={search}
                  />
                </div>
                <SelectFilter
                  onChange={(value) => {
                    setPage(1);
                    setStatus(value as CampaignStatus | 'ALL');
                  }}
                  options={statuses}
                  value={status}
                />
                <SelectFilter
                  onChange={(value) => {
                    setPage(1);
                    setPlatform(value as SocialPlatform | 'ALL');
                  }}
                  options={platforms}
                  value={platform}
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                  onChange={(event) => {
                    setPerPage(Number(event.target.value));
                    setPage(1);
                  }}
                  value={perPage}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="sf-data-table w-full min-w-[72rem] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground dark:bg-white/[0.03]">
                    <tr>
                      <th className="w-12 px-4 py-3">
                        <button
                          aria-label="Select visible campaigns"
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
                      <SortableHead active={sortBy === 'name'} label="Campaign" onClick={() => { updateSort('name', setSortBy, setSortDir); }} />
                      <SortableHead active={sortBy === 'status'} label="Status" onClick={() => { updateSort('status', setSortBy, setSortDir); }} />
                      <th className="px-4 py-3">Platforms</th>
                      <th className="px-4 py-3">Publishing</th>
                      <SortableHead active={sortBy === 'updatedAt'} label="Updated" onClick={() => { updateSort('updatedAt', setSortBy, setSortDir); }} />
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="px-4 py-12 text-center text-muted-foreground" colSpan={7}>
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Loading campaigns
                        </td>
                      </tr>
                    ) : campaigns.length ? (
                      campaigns.map((campaign) => (
                        <tr className="border-t border-border transition hover:bg-muted/40 dark:border-white/10 dark:hover:bg-white/[0.03]" key={campaign.id}>
                          <td className="px-4 py-4 align-top">
                            <button
                              aria-label={`Select ${campaign.name}`}
                              className={cn(
                                'mt-1 flex h-4 w-4 items-center justify-center rounded border border-border dark:border-white/20',
                                selectedIds.includes(campaign.id) ? 'bg-primary text-primary-foreground' : 'bg-background',
                              )}
                              onClick={() => { toggleSelected(campaign.id); }}
                              type="button"
                            >
                              {selectedIds.includes(campaign.id) ? <Check className="h-3 w-3" /> : null}
                            </button>
                          </td>
                          <td className="max-w-xl px-4 py-4 align-top">
                            <div className="flex gap-3">
                              {campaign.article.featuredImageUrl ? (
                                <img alt="" className="h-14 w-20 rounded-md object-cover" src={campaign.article.featuredImageUrl} />
                              ) : (
                                <div className="flex h-14 w-20 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                  <FileText className="h-5 w-5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <button
                                  className="line-clamp-2 text-left font-medium hover:text-primary"
                                  onClick={() => void openCampaign(campaign.id)}
                                  type="button"
                                >
                                  {campaign.name}
                                </button>
                                <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{campaign.article.title}</div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <Badge variant="secondary">{campaign.aiModel}</Badge>
                                  <Badge variant="outline">{campaign.promptVersion}</Badge>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <StatusBadge status={campaign.status} />
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex max-w-48 flex-wrap gap-1.5">
                              {campaign.platforms.map((item) => (
                                <Badge key={item} variant="outline">{titleCase(item)}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div>{campaign.generationCount} generated</div>
                            <div className="text-xs text-muted-foreground">{campaign.publishingHistoryCount} publishing records</div>
                            <div className="text-xs text-muted-foreground">Next: {formatDateTime(campaign.nextPublishAt)}</div>
                          </td>
                          <td className="px-4 py-4 align-top text-muted-foreground">
                            {formatDateTime(campaign.updatedAt)}
                          </td>
                          <td className="px-4 py-4 text-right align-top">
                            <div className="flex justify-end gap-2">
                              <Button disabled={busy === campaign.id} onClick={() => void openCampaign(campaign.id)} size="sm" variant="outline">
                                Open
                              </Button>
                              <Button
                                disabled={!canManage || busy === campaign.id}
                                onClick={() => void updateStatus(campaign.id, 'PUBLISHED')}
                                size="sm"
                              >
                                Publish
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-12 text-center text-muted-foreground" colSpan={7}>
                          No campaigns match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-muted-foreground">
                  {selectedCount ? `${String(selectedCount)} selected - ` : null}
                  Showing {formatNumber(campaigns.length)} of {formatNumber(total)} campaigns
                </div>
                <div className="flex items-center gap-2">
                  <Button disabled={page <= 1} onClick={() => { setPage((value) => Math.max(value - 1, 1)); }} size="sm" variant="outline">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-20 text-center text-xs text-muted-foreground">{page} / {totalPages}</span>
                  <Button disabled={page >= totalPages} onClick={() => { setPage((value) => Math.min(value + 1, totalPages)); }} size="sm" variant="outline">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <CampaignDetailPanel
            busy={busy}
            canManage={canManage}
            campaign={selectedCampaign}
            captionDraft={captionDraft}
            editingGenerationId={editingGenerationId}
            hashtagsDraft={hashtagsDraft}
            onArchive={(id) => void updateStatus(id, 'ARCHIVED')}
            onBeginEdit={beginEdit}
            onCaptionChange={setCaptionDraft}
            onHashtagsChange={setHashtagsDraft}
            onSaveGeneration={() => void saveGeneration()}
            onSchedule={(id) => void scheduleCampaign(id)}
            scheduleFor={scheduleFor}
            setScheduleFor={setScheduleFor}
          />
        </section>
      </main>
    </div>
  );
}

function CampaignDetailPanel({
  campaign,
  canManage,
  busy,
  scheduleFor,
  setScheduleFor,
  editingGenerationId,
  captionDraft,
  hashtagsDraft,
  onCaptionChange,
  onHashtagsChange,
  onBeginEdit,
  onSaveGeneration,
  onSchedule,
  onArchive,
}: {
  campaign: CampaignDetail | null;
  canManage: boolean;
  busy: string | null;
  scheduleFor: string;
  setScheduleFor: (value: string) => void;
  editingGenerationId: string | null;
  captionDraft: string;
  hashtagsDraft: string;
  onCaptionChange: (value: string) => void;
  onHashtagsChange: (value: string) => void;
  onBeginEdit: (generation: CampaignDetail['generations'][number]) => void;
  onSaveGeneration: () => void;
  onSchedule: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  if (!campaign) {
    return (
      <Card className="border-dashed border-border/80 dark:border-white/10 dark:bg-white/[0.04]">
        <CardContent className="flex min-h-96 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          Select a campaign to review generated content, schedule publishing, and manage status.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 dark:border-white/10 dark:bg-white/[0.04]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="line-clamp-2 text-lg">{campaign.name}</CardTitle>
            <CardDescription className="mt-1">{campaign.article.connection.siteUrl}</CardDescription>
          </div>
          <StatusBadge status={campaign.status} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2 rounded-md border border-border p-3 text-sm dark:border-white/10">
          <div className="font-medium">{campaign.article.title}</div>
          <div className="text-muted-foreground">Updated {formatDateTime(campaign.updatedAt)}</div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/wordpress-hub/${campaign.article.id}`}>Source</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={campaign.article.url} rel="noreferrer" target="_blank">WordPress</a>
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="schedule-for">Schedule campaign</Label>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              id="schedule-for"
              onChange={(event) => { setScheduleFor(event.target.value); }}
              type="datetime-local"
              value={scheduleFor}
            />
            <Button disabled={!canManage || busy === campaign.id} onClick={() => { onSchedule(campaign.id); }} size="sm">
              <CalendarClock className="h-4 w-4" />
              Schedule
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Generated content</div>
            <Button disabled={!canManage || busy === campaign.id} onClick={() => { onArchive(campaign.id); }} size="sm" variant="outline">
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          </div>
          {campaign.generations.map((generation) => (
            <div className="rounded-md border border-border p-3 dark:border-white/10" key={generation.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge variant="secondary">{titleCase(generation.platform)}</Badge>
                <Button disabled={!canManage} onClick={() => { onBeginEdit(generation); }} size="sm" variant="ghost">
                  <Edit3 className="h-4 w-4" />
                </Button>
              </div>
              {editingGenerationId === generation.id ? (
                <div className="grid gap-2">
                  <textarea
                    className="min-h-32 rounded-md border border-input bg-background p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                    onChange={(event) => { onCaptionChange(event.target.value); }}
                    value={captionDraft}
                  />
                  <Input onChange={(event) => { onHashtagsChange(event.target.value); }} value={hashtagsDraft} />
                  <Button disabled={busy === generation.id} onClick={onSaveGeneration} size="sm">
                    {busy === generation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-6">{generation.caption}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {generation.hashtags.map((tag) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-2">
          <div className="font-medium">Publishing history</div>
          {campaign.publishingHistory.length ? (
            campaign.publishingHistory.map((item) => (
              <div className="rounded-md border border-border p-3 text-sm dark:border-white/10" key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <span>{titleCase(item.platform)}</span>
                  <Badge variant="outline">{titleCase(item.status)}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.postUrl ? <a className="text-primary" href={item.postUrl}>Published post</a> : formatDateTime(item.publishedAt ?? item.scheduledFor)}
                </div>
                {item.errorLog ? <div className="mt-1 text-xs text-destructive">{item.errorLog}</div> : null}
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground dark:border-white/10">
              No publishing history yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SelectFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="h-10 rounded-md border border-input bg-background px-3 text-sm dark:border-white/10 dark:bg-white/[0.04]"
      onChange={(event) => { onChange(event.target.value); }}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function SortableHead({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <th className="px-4 py-3">
      <button className={cn('inline-flex items-center gap-1 hover:text-foreground', active ? 'text-foreground' : '')} onClick={onClick} type="button">
        {label}
        <ArrowDownUp className="h-3.5 w-3.5" />
      </button>
    </th>
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

  return <Badge className={styles[status]} variant="outline">{titleCase(status)}</Badge>;
}

function updateSort(
  nextSort: SortBy,
  setSortBy: (value: SortBy) => void,
  setSortDir: React.Dispatch<React.SetStateAction<SortDir>>,
) {
  setSortBy(nextSort);
  setSortDir((value) => (value === 'asc' ? 'desc' : 'asc'));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDateTime(value: string | null) {
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
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
