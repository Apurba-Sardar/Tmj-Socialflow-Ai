'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Archive,
  Bell,
  CalendarDays,
  Check,
  Download,
  FileImage,
  Folder,
  ImageIcon,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Sparkles,
  Tag,
  UploadCloud,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';

import { LogoutButton } from '@/components/auth/logout-button';
import { BrandIcon } from '@/components/brand/brand-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet } from '@/components/ui/sheet';
import type { AuthenticatedUser } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

type MediaType = 'image' | 'video' | 'document';

interface MediaAsset {
  id: string;
  title: string;
  type: MediaType;
  folder: string;
  collection: string;
  tags: string[];
  sizeBytes: number;
  compressedBytes: number;
  createdAt: string;
  previewUrl?: string;
  accent: string;
}

const navigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Media Library', href: '/media-library', icon: ImageIcon },
  { label: 'Scheduler', href: '/scheduler', icon: CalendarDays },
];

type MediaHref = Parameters<typeof Link>[0]['href'];

export function MediaLibrary({ user }: { user: AuthenticatedUser }) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [selectedCollection, setSelectedCollection] = useState<string>('All');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [previewAssetId, setPreviewAssetId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [aiSearch, setAiSearch] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadAssets() {
      const response = await fetch(`${getApiBaseUrl()}/api/media/assets`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        setAssets([]);
        return;
      }

      const payload = (await response.json()) as { data: Omit<MediaAsset, 'accent'>[] };
      const nextAssets = payload.data.map((asset) => ({
        ...asset,
        accent: accentForType(asset.type),
        createdAt: formatDate(asset.createdAt),
      }));
      setAssets(nextAssets);
      setPreviewAssetId((current) => current || (nextAssets[0]?.id ?? ''));
    }

    void loadAssets();
  }, []);

  const availableTags = useMemo(
    () => Array.from(new Set(assets.flatMap((asset) => asset.tags))).sort(),
    [assets],
  );
  const folders = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.folder))).sort(),
    [assets],
  );
  const collections = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.collection))).sort(),
    [assets],
  );

  const filteredAssets = useMemo(() => {
    return assets
      .map((asset) => ({ asset, score: scoreAsset(asset, query, aiSearch) }))
      .filter(({ asset, score }) => {
        const matchesFolder = selectedFolder === 'All' || asset.folder === selectedFolder;
        const matchesCollection =
          selectedCollection === 'All' || asset.collection === selectedCollection;
        const matchesTags =
          selectedTags.length === 0 ||
          selectedTags.every((tagValue) => asset.tags.includes(tagValue));
        const matchesQuery = query.trim().length === 0 || score > 0;
        return matchesFolder && matchesCollection && matchesTags && matchesQuery;
      })
      .sort((left, right) => right.score - left.score)
      .map(({ asset }) => asset);
  }, [aiSearch, assets, query, selectedCollection, selectedFolder, selectedTags]);

  const previewAsset =
    assets.find((asset) => asset.id === previewAssetId) ?? filteredAssets[0] ?? assets[0];
  const selectedAssets = assets.filter((asset) => selectedAssetIds.includes(asset.id));

  function ingestFiles(fileList: FileList): void {
    void fileList;
  }

  function toggleTag(tagValue: string): void {
    setSelectedTags((currentTags) =>
      currentTags.includes(tagValue)
        ? currentTags.filter((currentTag) => currentTag !== tagValue)
        : [...currentTags, tagValue],
    );
  }

  function toggleAsset(assetId: string): void {
    setSelectedAssetIds((currentIds) =>
      currentIds.includes(assetId)
        ? currentIds.filter((currentId) => currentId !== assetId)
        : [...currentIds, assetId],
    );
  }

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files) {
      ingestFiles(event.target.files);
      event.target.value = '';
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragActive(false);

    if (event.dataTransfer.files.length > 0) {
      ingestFiles(event.dataTransfer.files);
    }
  }

  return (
    <div className="sf-app-bg min-h-screen text-foreground">
      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        <MediaSidebar user={user} />
      </Sheet>
      <div className="grid min-h-screen lg:grid-cols-[18rem_1fr]">
        <aside className="hidden border-r bg-card text-card-foreground lg:block">
          <MediaSidebar user={user} />
        </aside>
        <div className="min-w-0">
          <header className="sf-premium-header sticky top-0 z-30">
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
                <h1 className="text-lg font-semibold tracking-normal">Media Library</h1>
                <p className="hidden text-sm text-muted-foreground sm:block">
                  Governed assets, collections, compression, and AI-assisted discovery.
                </p>
              </div>
              <Button
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <UploadCloud className="h-4 w-4" />
                Bulk upload
              </Button>
              <Button aria-label="Notifications" className="relative" size="sm" variant="outline">
                <Bell className="h-4 w-4" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" />
              </Button>
              <LogoutButton />
            </div>
          </header>

          <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[15rem_1fr_21rem] lg:px-8">
            <FilterPanel
              availableTags={availableTags}
              collections={collections}
              folders={folders}
              selectedCollection={selectedCollection}
              selectedFolder={selectedFolder}
              selectedTags={selectedTags}
              onCollectionChange={setSelectedCollection}
              onFolderChange={setSelectedFolder}
              onTagToggle={toggleTag}
            />
            <section className="min-w-0 space-y-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row">
                    <div className="flex min-h-10 flex-1 items-center gap-2 rounded-md border px-3">
                      {aiSearch ? (
                        <WandSparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
                      ) : (
                        <Search className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Input
                        aria-label="Search media"
                        className="h-8 border-0 p-0 focus-visible:ring-0"
                        onChange={(event) => {
                          setQuery(event.target.value);
                        }}
                        placeholder="Search by name, campaign, tag, intent, or visual meaning"
                        value={query}
                      />
                    </div>
                    <Button
                      onClick={() => {
                        setAiSearch((enabled) => !enabled);
                      }}
                      variant={aiSearch ? 'default' : 'outline'}
                    >
                      <Sparkles className="h-4 w-4" />
                      AI Search
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div
                className={cn(
                  'rounded-lg border border-dashed p-6 transition-colors',
                  dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card',
                )}
                onDragLeave={() => {
                  setDragActive(false);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDrop={onDrop}
              >
                <input
                  className="hidden"
                  multiple
                  onChange={onFilesSelected}
                  ref={fileInputRef}
                  type="file"
                />
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium">Drop media files to upload and compress</p>
                    <p className="text-sm text-muted-foreground">
                      Images, video, and documents are organized into folders and collections.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                    Select files
                  </Button>
                </div>
              </div>

              <BulkToolbar selectedCount={selectedAssets.length} selectedAssets={selectedAssets} />

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredAssets.map((asset) => (
                  <AssetCard
                    asset={asset}
                    key={asset.id}
                    onPreview={setPreviewAssetId}
                    onToggle={toggleAsset}
                    selected={selectedAssetIds.includes(asset.id)}
                  />
                ))}
              </div>
            </section>
            <PreviewPanel asset={previewAsset} />
          </main>
        </div>
      </div>
    </div>
  );
}

function MediaSidebar({ user }: { user: AuthenticatedUser }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-screen flex-col px-4 py-5">
      <div className="flex items-center gap-3 px-2">
        <BrandIcon className="h-10 w-10 rounded-xl" priority />
        <div>
          <p className="text-sm font-semibold">TMJ SocialFlow AI</p>
          <p className="text-xs text-muted-foreground">Asset Operations</p>
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
            href={item.href as MediaHref}
            key={item.href}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto rounded-md border p-3">
        <p className="text-xs text-muted-foreground">Workspace owner</p>
        <p className="mt-1 break-words text-sm font-medium">{user.email}</p>
      </div>
    </div>
  );
}

function FilterPanel({
  availableTags,
  collections,
  folders,
  selectedCollection,
  selectedFolder,
  selectedTags,
  onCollectionChange,
  onFolderChange,
  onTagToggle,
}: {
  availableTags: string[];
  collections: string[];
  folders: string[];
  selectedCollection: string;
  selectedFolder: string;
  selectedTags: string[];
  onCollectionChange: (collection: string) => void;
  onFolderChange: (folder: string) => void;
  onTagToggle: (tagValue: string) => void;
}) {
  return (
    <aside className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Folders</CardTitle>
          <CardDescription>Storage structure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {['All', ...folders].map((folder) => (
            <FilterButton
              active={selectedFolder === folder}
              icon={Folder}
              key={folder}
              label={folder}
              onClick={() => {
                onFolderChange(folder);
              }}
            />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Collections</CardTitle>
          <CardDescription>Curated asset sets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {['All', ...collections].map((collection) => (
            <FilterButton
              active={selectedCollection === collection}
              icon={Archive}
              key={collection}
              label={collection}
              onClick={() => {
                onCollectionChange(collection);
              }}
            />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>Metadata filters</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {availableTags.map((tagValue) => (
            <button
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-medium',
                selectedTags.includes(tagValue)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
              key={tagValue}
              onClick={() => {
                onTagToggle(tagValue);
              }}
              type="button"
            >
              {tagValue}
            </button>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}

function FilterButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function BulkToolbar({
  selectedAssets,
  selectedCount,
}: {
  selectedAssets: MediaAsset[];
  selectedCount: number;
}) {
  const originalBytes = selectedAssets.reduce((total, asset) => total + asset.sizeBytes, 0);
  const compressedBytes = selectedAssets.reduce((total, asset) => total + asset.compressedBytes, 0);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium">{selectedCount} selected</p>
          <p className="text-sm text-muted-foreground">
            Compression saves {formatBytes(Math.max(0, originalBytes - compressedBytes))}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={selectedCount === 0} variant="outline">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button disabled={selectedCount === 0} variant="outline">
            <Tag className="h-4 w-4" />
            Apply tags
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AssetCard({
  asset,
  selected,
  onPreview,
  onToggle,
}: {
  asset: MediaAsset;
  selected: boolean;
  onPreview: (assetId: string) => void;
  onToggle: (assetId: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        className="block w-full text-left"
        onClick={() => {
          onPreview(asset.id);
        }}
        type="button"
      >
        <AssetThumbnail asset={asset} className="h-40" />
      </button>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{asset.title}</p>
            <p className="text-sm text-muted-foreground">{asset.folder}</p>
          </div>
          <button
            aria-label={selected ? 'Deselect asset' : 'Select asset'}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
              selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
            onClick={() => {
              onToggle(asset.id);
            }}
            type="button"
          >
            {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {asset.tags.map((tagValue) => (
            <Badge key={tagValue} variant="secondary">
              {tagValue}
            </Badge>
          ))}
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <span>{formatBytes(asset.compressedBytes)}</span>
          <span className="text-right">{compressionRatio(asset)} smaller</span>
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewPanel({ asset }: { asset?: MediaAsset }) {
  if (!asset) {
    return null;
  }

  return (
    <aside className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>{asset.collection}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AssetThumbnail asset={asset} className="h-64" />
          <div>
            <p className="font-medium">{asset.title}</p>
            <p className="text-sm text-muted-foreground">{asset.createdAt}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <PreviewFact label="Original" value={formatBytes(asset.sizeBytes)} />
            <PreviewFact label="Compressed" value={formatBytes(asset.compressedBytes)} />
            <PreviewFact label="Type" value={asset.type} />
            <PreviewFact label="Saving" value={compressionRatio(asset)} />
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            {asset.tags.map((tagValue) => (
              <Badge key={tagValue} variant="outline">
                {tagValue}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium capitalize">{value}</p>
    </div>
  );
}

function AssetThumbnail({ asset, className }: { asset: MediaAsset; className?: string }) {
  if (asset.previewUrl) {
    return (
      <div className={cn('overflow-hidden bg-muted', className)}>
        <img alt={asset.title} className="h-full w-full object-cover" src={asset.previewUrl} />
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center justify-center bg-gradient-to-br', asset.accent, className)}
    >
      <div className="rounded-md bg-background/90 p-4 text-foreground shadow-sm">
        <FileImage className="h-8 w-8" />
      </div>
    </div>
  );
}

function scoreAsset(asset: MediaAsset, query: string, aiSearch: boolean): number {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return 1;
  }

  const searchable = [
    asset.title,
    asset.type,
    asset.folder,
    asset.collection,
    ...asset.tags,
    aiSearch ? semanticTerms(asset).join(' ') : '',
  ]
    .join(' ')
    .toLowerCase();

  return normalizedQuery
    .split(/\s+/)
    .reduce((score, term) => score + (searchable.includes(term) ? 1 : 0), 0);
}

function semanticTerms(asset: MediaAsset): string[] {
  const terms = new Set<string>();

  for (const tagValue of asset.tags) {
    if (tagValue === 'hero') terms.add('homepage banner cover');
    if (tagValue === 'founder') terms.add('leadership executive people interview');
    if (tagValue === 'report') terms.add('board metrics investor performance');
    if (tagValue === 'brand') terms.add('identity visual system logo');
    if (tagValue === 'testimonial') terms.add('customer proof advocacy');
  }

  return Array.from(terms);
}

function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) {
    return `${String(Math.round(bytes / 1_000))} KB`;
  }

  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function accentForType(type: MediaType): string {
  return {
    image: 'from-sky-500 to-emerald-400',
    video: 'from-violet-500 to-cyan-400',
    document: 'from-rose-500 to-amber-400',
  }[type];
}

function compressionRatio(asset: MediaAsset): string {
  const saved = Math.max(0, asset.sizeBytes - asset.compressedBytes);
  const ratio = Math.round((saved / asset.sizeBytes) * 100);
  return `${String(ratio)}%`;
}
