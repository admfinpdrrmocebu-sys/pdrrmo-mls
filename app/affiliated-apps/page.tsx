'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  Search,
  RefreshCw,
  ArrowUpRight,
  Globe,
  Lock,
  Settings,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';

const ITEMS_PER_PAGE = 6;

interface DirectoryAppItem {
  id: string;
  name: string;
  appUrl: string;
  imageUrl: string;
  sortOrder: number;
  updatedAt: string;
}

function getDisplayHostname(urlStr: string): string {
  try {
    const normalized = /^https?:\/\//i.test(urlStr.trim())
      ? urlStr.trim()
      : `https://${urlStr.trim()}`;
    return new URL(normalized).hostname.replace(/^www\./i, '');
  } catch {
    return urlStr.trim() || 'pdrrmo-app';
  }
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

  const [apps, setApps] = useState<DirectoryAppItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Debounced Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchActiveApps = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);

      const { data, error } = await supabase
        .from('affiliated_apps')
        .select('id, name, app_url, image_url, sort_order, updated_at')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        setApps([]);
        return;
      }

      const mapped: DirectoryAppItem[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        appUrl: row.app_url,
        imageUrl: row.image_url,
        sortOrder: row.sort_order ?? 0,
        updatedAt: row.updated_at,
      }));
      setApps(mapped);
    } catch {
      setApps([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveApps();

    const channel = supabase
      .channel('directory-affiliated-apps-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'affiliated_apps' },
        () => {
          fetchActiveApps(true);
        }
      )
      .subscribe();

    return () => {
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

  // Pagination State (Max 6 per page)
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredApps.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedApps = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredApps.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredApps, currentPage]);

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
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedApps.map((app, idx) => {
              const host = getDisplayHostname(app.appUrl);
              const isBroken = Boolean(brokenImages[app.id]);

              return (
                <motion.a
                  key={app.id}
                  href={app.appUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  whileHover={{ y: -4 }}
                  className="bg-white rounded-[1.5rem] border border-[#E2E8F0] hover:border-[#004AC6]/40 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    {/* Mini Browser Chrome Bar */}
                    <div className="h-8 bg-[#F8FAFC] border-b border-[#E2E8F0] px-3.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80 shrink-0" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 shrink-0" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 shrink-0" />
                        <div className="ml-2 flex items-center gap-1 text-[11px] font-mono text-[#505F76] truncate">
                          <Lock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{host}</span>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#004AC6] transition-colors shrink-0" />
                    </div>

                    {/* 16:10 Snapped Website Picture */}
                    <div className="relative w-full aspect-[16/10] bg-[#F1F5F9] overflow-hidden border-b border-[#E2E8F0]">
                      {app.imageUrl && !isBroken ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={app.imageUrl}
                          alt={app.name}
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [app.id]: true }))
                          }
                          className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#757680] p-4 text-center">
                          <Globe className="w-9 h-9 text-[#004AC6]/60" />
                          <span className="text-xs font-semibold text-[#505F76] truncate max-w-full">
                            {host}
                          </span>
                        </div>
                      )}

                      {/* Hover Launch Pill */}
                      <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 text-[#1E293B] text-xs font-bold shadow-lg">
                          <span>Open Application</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-[#004AC6]" />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-bold text-[#1E293B] group-hover:text-[#004AC6] transition-colors truncate">
                        {app.name}
                      </h2>
                      <p className="text-xs text-[#505F76] truncate mt-0.5 font-medium">
                        {app.appUrl}
                      </p>
                    </div>

                    <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] group-hover:bg-[#004AC6] group-hover:text-white flex items-center justify-center shrink-0 transition-all duration-200 shadow-2xs">
                      <ArrowUpRight className="w-4.5 h-4.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                </motion.a>
              );
            })}
            </div>

            {/* Pagination Controls */}
            {filteredApps.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-[#505F76] font-medium">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredApps.length)} of {filteredApps.length}{' '}
                  {filteredApps.length === 1 ? 'web app' : 'web apps'}
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
            )}
          </div>
        )}
      </div>
    </AppLayoutShell>
  );
}
