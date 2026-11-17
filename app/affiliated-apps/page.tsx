'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  Search,
  RefreshCw,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  Pin,
} from 'lucide-react';
import { AppLayoutShell } from '@/components/nav-route';
import {
  AFFILIATED_APPS_UPDATED_EVENT,
  CachedAffiliatedApp,
  getCachedAffiliatedApps,
  hydrateOperationalCachesFromStorage,
  setCachedAffiliatedApps,
} from '@/lib/cache/screen-data-cache';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { DirectoryAppCard } from './_components/directory-app-card';

const ITEMS_PER_PAGE = 6;

interface DirectoryDbRow {
  id: string;
  name: string;
  app_url: string;
  image_url: string;
  sort_order: number | null;
  is_pinned?: boolean | null;
  pinned_at?: string | null;
  updated_at: string;
}

function sortDirectoryApps(items: CachedAffiliatedApp[]): CachedAffiliatedApp[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    if (a.isPinned && b.isPinned) {
      const aPinTime = a.pinnedAt ? Date.parse(a.pinnedAt) || 0 : 0;
      const bPinTime = b.pinnedAt ? Date.parse(b.pinnedAt) || 0 : 0;
      if (aPinTime !== bPinTime) return bPinTime - aPinTime;
    }
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

function computeDirectorySignature(items: CachedAffiliatedApp[]): string {
  return items
    .map(
      (a) =>
        `${a.id}:${a.name}:${a.appUrl}:${a.imageUrl}:${a.sortOrder}:${a.isPinned ? 1 : 0}:${a.pinnedAt ?? ''}:${a.updatedAt ?? ''}`
    )
    .join('|');
}

function DirectorySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-white rounded-[1.5rem] border border-[#E2E8F0] overflow-hidden shadow-sm"
        >
          <div className="h-8 bg-[#F8FAFC] border-b border-[#E2E8F0] px-3.5 flex items-center gap-1.5">
            <Skeleton variant="circular" className="w-2.5 h-2.5" />
            <Skeleton variant="circular" className="w-2.5 h-2.5" />
            <Skeleton variant="circular" className="w-2.5 h-2.5" />
            <Skeleton variant="rounded" className="h-3 w-32 ml-2" />
          </div>
          <Skeleton variant="rectangular" className="w-full aspect-[16/10]" />
          <div className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-2 flex-1">
              <Skeleton variant="rounded" className="h-5 w-40" />
              <Skeleton variant="rounded" className="h-3.5 w-52" />
            </div>
            <Skeleton variant="circular" className="w-10 h-10 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AffiliatedAppsDirectoryPage() {
  const { canWrite } = useAuth();
  const canManage = canWrite('Affiliated Apps');

  // Synchronous in-memory cache hydration once on mount (0ms revisit hydration)
  const [initialCache] = useState(() => getCachedAffiliatedApps());
  const skipInitialCardMotion = Boolean(initialCache);

  const [apps, setApps] = useState<CachedAffiliatedApp[]>(() =>
    initialCache ? sortDirectoryApps(initialCache) : []
  );
  const [isLoading, setIsLoading] = useState(() => !initialCache);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Debounced Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const signatureRef = useRef<string>(
    initialCache ? computeDirectorySignature(sortDirectoryApps(initialCache)) : ''
  );
  const lastFetchedAtRef = useRef<number>(initialCache ? Date.now() : 0);

  useEffect(() => {
    if (searchQuery === debouncedQuery) return;
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedQuery]);

  const handleImageError = useCallback((appId: string) => {
    setBrokenImages((prev) => (prev[appId] ? prev : { ...prev, [appId]: true }));
  }, []);

  const fetchActiveApps = useCallback(async (silent = false) => {
    try {
      const hasCached = Boolean(getCachedAffiliatedApps());
      if (!silent && !hasCached) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      let { data, error } = await supabase
        .from('affiliated_apps')
        .select('id, name, app_url, image_url, sort_order, is_pinned, pinned_at, updated_at')
        .eq('is_active', true)
        .order('is_pinned', { ascending: false })
        .order('pinned_at', { ascending: false, nullsFirst: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      // Graceful fallback if pinned columns haven't been migrated yet
      if (
        error &&
        (error.code === '42703' || /is_pinned|pinned_at/i.test(error.message || ''))
      ) {
        const fallbackRes = await supabase
          .from('affiliated_apps')
          .select('id, name, app_url, image_url, sort_order, updated_at')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });
        data = fallbackRes.data as typeof data;
        error = fallbackRes.error;
      }

      if (error) {
        return;
      }

      const mapped: CachedAffiliatedApp[] = sortDirectoryApps(
        ((data || []) as DirectoryDbRow[]).map((row) => ({
          id: row.id,
          name: row.name,
          appUrl: row.app_url,
          imageUrl: row.image_url,
          sortOrder: row.sort_order ?? 0,
          isPinned: Boolean(row.is_pinned),
          pinnedAt: row.is_pinned ? (row.pinned_at ?? null) : null,
          updatedAt: row.updated_at,
        }))
      );

      const nextSig = computeDirectorySignature(mapped);
      lastFetchedAtRef.current = Date.now();

      if (nextSig !== signatureRef.current) {
        signatureRef.current = nextSig;
        setApps(mapped);
        setCachedAffiliatedApps(mapped);
      }
    } catch {
      // Keep cached/previous state cleanly on transient offline errors
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      hydrateOperationalCachesFromStorage();
      const cached = getCachedAffiliatedApps();
      if (cached && !signatureRef.current) {
        const sorted = sortDirectoryApps(cached);
        signatureRef.current = computeDirectorySignature(sorted);
        setApps(sorted);
        setIsLoading(false);
      }
      void fetchActiveApps(Boolean(cached));
    }, 0);

    let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
    const channelName = `directory-affiliated-apps-realtime-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'affiliated_apps' },
        () => {
          if (realtimeTimer) clearTimeout(realtimeTimer);
          realtimeTimer = setTimeout(() => {
            void fetchActiveApps(true);
          }, 300);
        }
      )
      .subscribe();

    const handleCacheSync = () => {
      const cached = getCachedAffiliatedApps();
      if (!cached) return;
      const sorted = sortDirectoryApps(cached);
      const nextSig = computeDirectorySignature(sorted);
      if (nextSig !== signatureRef.current) {
        signatureRef.current = nextSig;
        setApps(sorted);
      }
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastFetchedAtRef.current > 5000
      ) {
        void fetchActiveApps(true);
      }
    };

    window.addEventListener(AFFILIATED_APPS_UPDATED_EVENT, handleCacheSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      if (realtimeTimer) clearTimeout(realtimeTimer);
      window.removeEventListener(AFFILIATED_APPS_UPDATED_EVENT, handleCacheSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [fetchActiveApps]);

  const filteredApps = useMemo(() => {
    if (!debouncedQuery.trim()) return apps;
    const q = debouncedQuery.trim().toLowerCase();
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.appUrl.toLowerCase().includes(q)
    );
  }, [apps, debouncedQuery]);

  // Single-pass partition so Pinned Apps remain highlighted at the top across pages
  const { pinnedApps, regularApps } = useMemo(() => {
    const pinned: CachedAffiliatedApp[] = [];
    const regular: CachedAffiliatedApp[] = [];
    for (const app of filteredApps) {
      if (app.isPinned) pinned.push(app);
      else regular.push(app);
    }
    return { pinnedApps: pinned, regularApps: regular };
  }, [filteredApps]);

  // Pagination State (Max 6 per page for standard directory grid)
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(regularApps.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRegularApps = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return regularApps.slice(start, start + ITEMS_PER_PAGE);
  }, [regularApps, currentPage]);

  return (
    <AppLayoutShell
      title="Affiliated Apps"
      subtitle="PDRRMO Integrated Web Applications"
      screen="Affiliated Apps"
    >
      <div className="space-y-6">
        {/* ===================================================================== */}
        {/* 1. DIRECTORY HEADER */}
        {/* ===================================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
                Affiliated PDRRMO Web Apps
              </h1>
              {!isLoading && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200/70">
                  {apps.length} {apps.length === 1 ? 'App' : 'Apps'}
                </span>
              )}
              {!isLoading && pinnedApps.length > 0 && !debouncedQuery.trim() && (
                <span className="pinned-badge inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80">
                  <Pin className="w-3 h-3 fill-amber-500 text-amber-600" />
                  {pinnedApps.length} Pinned
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#505F76] font-medium max-w-2xl">
              Quick-launch directory of official and affiliated Provincial DRRMO web systems, telemetry dashboards, and operational portals.
            </p>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 2. SEARCH & ACTIONS BAR */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Debounced Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#757680] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search affiliated web apps..."
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl pl-10 pr-8 py-2.5 text-xs sm:text-sm text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all placeholder:text-[#94A3B8]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="w-5 h-5 rounded-full flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 text-[#757680] hover:text-[#1E293B] cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <SecondaryButton
              type="button"
              size="sm"
              variant="outline"
              pill={false}
              onClick={() => fetchActiveApps(true)}
              disabled={isRefreshing}
              leftIcon={
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                />
              }
              className="w-full sm:w-auto rounded-xl py-2.5"
            >
              Refresh
            </SecondaryButton>

            {canManage && (
              <Link href="/settings/affiliated-apps" className="w-full sm:w-auto">
                <PrimaryButton
                  type="button"
                  size="sm"
                  pill={false}
                  leftIcon={<Settings className="w-3.5 h-3.5" />}
                  className="w-full rounded-xl py-2.5"
                >
                  Manage Apps
                </PrimaryButton>
              </Link>
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 3. AFFILIATED APPS LAUNCHPAD GRID */}
        {/* ===================================================================== */}
        {isLoading ? (
          <DirectorySkeleton />
        ) : filteredApps.length === 0 ? (
          <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] p-12 text-center shadow-2xs space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#004AC6] border border-blue-200/70 flex items-center justify-center mx-auto">
              <LayoutGrid className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-lg font-bold text-[#1E293B]">
                {debouncedQuery.trim()
                  ? `No web apps matching "${debouncedQuery}"`
                  : 'No Affiliated Web Apps Published Yet'}
              </h3>
              <p className="text-xs sm:text-sm text-[#505F76] leading-relaxed">
                {debouncedQuery.trim()
                  ? 'Try searching with a different keyword or clear your filter.'
                  : canManage
                  ? 'Register affiliated PDRRMO web apps in Settings to display them here with automatic webpage preview snapshots.'
                  : 'Affiliated PDRRMO web applications added by system administrators will appear here.'}
              </p>
            </div>
            {debouncedQuery.trim() ? (
              <SecondaryButton
                type="button"
                size="sm"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </SecondaryButton>
            ) : (
              canManage && (
                <div className="pt-1">
                  <Link href="/settings/affiliated-apps">
                    <PrimaryButton
                      type="button"
                      size="md"
                      leftIcon={<Settings className="w-4 h-4" />}
                    >
                      Configure Affiliated Apps
                    </PrimaryButton>
                  </Link>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pinned Quick-Access Spotlight (Visible to Everyone) */}
            {pinnedApps.length > 0 && (
              <section
                className="pinned-spotlight-panel rounded-[1.75rem] border border-amber-200/80 bg-amber-50/40 p-5 sm:p-6 shadow-2xs space-y-4"
                aria-label="Pinned Affiliated Apps"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="pinned-badge w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0">
                      <Pin className="w-4 h-4 fill-amber-500" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-[#1E293B]">
                        Pinned Portals
                      </h2>
                      <p className="text-[11px] sm:text-xs text-[#505F76]">
                        Priority operational links pinned for everyone&apos;s quick access
                      </p>
                    </div>
                  </div>
                  <span className="pinned-badge text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80">
                    {pinnedApps.length} Pinned
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pinnedApps.map((app, idx) => (
                    <DirectoryAppCard
                      key={app.id}
                      app={app}
                      variant="pinned"
                      isBrokenImage={Boolean(brokenImages[app.id])}
                      skipInitialMotion={skipInitialCardMotion}
                      animationIndex={idx}
                      onImageError={handleImageError}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Standard Paginated Directory Grid */}
            {regularApps.length > 0 && (
              <section className="space-y-4" aria-label="All Affiliated Apps">
                {pinnedApps.length > 0 && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0]">
                    <h2 className="text-sm sm:text-base font-bold text-[#1E293B]">
                      All Web Applications
                    </h2>
                    <span className="text-xs text-[#505F76] font-medium">
                      {regularApps.length} {regularApps.length === 1 ? 'app' : 'apps'}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedRegularApps.map((app, idx) => (
                    <DirectoryAppCard
                      key={app.id}
                      app={app}
                      variant="standard"
                      isBrokenImage={Boolean(brokenImages[app.id])}
                      skipInitialMotion={skipInitialCardMotion}
                      animationIndex={idx}
                      onImageError={handleImageError}
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-xs text-[#505F76] font-medium">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, regularApps.length)} of{' '}
                    {regularApps.length}{' '}
                    {regularApps.length === 1 ? 'web app' : 'web apps'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      aria-label="Previous Page"
                      className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="text-xs font-bold text-[#1E293B] px-2 select-none">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={currentPage === totalPages || totalPages === 0}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      aria-label="Next Page"
                      className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppLayoutShell>
  );
}
