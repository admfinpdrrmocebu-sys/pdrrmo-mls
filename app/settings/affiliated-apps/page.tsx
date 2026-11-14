'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  LayoutGrid,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
  X,
  Globe,
  Camera,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import {
  CachedAffiliatedApp,
  getCachedAffiliatedAppsSettingsData,
  patchCachedAffiliatedAppsSettingsData,
  setCachedAffiliatedApps,
  setCachedAffiliatedAppsSettingsData,
} from '@/lib/cache/screen-data-cache';
import {
  AffiliatedAppDbRow,
  AffiliatedAppRecord,
  ITEMS_PER_PAGE,
  computeAffiliatedAppsSignature,
  getErrorMessage,
} from './_components/types';
import { AffiliatedAppCard } from './_components/affiliated-app-card';

export type { AffiliatedAppRecord };

const AffiliatedAppFormModal = dynamic(
  () => import('./_components/affiliated-app-form-modal'),
  { ssr: false }
);

const DeleteAppModal = dynamic(
  () => import('./_components/delete-app-modal'),
  { ssr: false }
);

function toDirectoryCacheItems(apps: AffiliatedAppRecord[]): CachedAffiliatedApp[] {
  return apps
    .filter((a) => a.isActive)
    .map((a) => ({
      id: a.id,
      name: a.name,
      appUrl: a.appUrl,
      imageUrl: a.imageUrl,
      sortOrder: a.sortOrder,
      updatedAt: a.updatedAt,
    }));
}

function AppsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-[1.5rem] border border-[#E2E8F0] overflow-hidden shadow-sm"
        >
          <div className="h-7 bg-[#F8FAFC] border-b border-[#E2E8F0] px-3 flex items-center gap-1.5">
            <Skeleton variant="circular" className="w-2.5 h-2.5" />
            <Skeleton variant="circular" className="w-2.5 h-2.5" />
            <Skeleton variant="circular" className="w-2.5 h-2.5" />
            <Skeleton variant="rounded" className="h-3 w-28 ml-2" />
          </div>
          <Skeleton variant="rectangular" className="w-full aspect-[16/10]" />
          <div className="p-5 space-y-3">
            <Skeleton variant="rounded" className="h-5 w-44" />
            <Skeleton variant="rounded" className="h-3.5 w-56" />
            <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
              <Skeleton variant="rounded" className="h-5 w-20 rounded-full" />
              <div className="flex items-center gap-1.5">
                <Skeleton variant="circular" className="w-8 h-8" />
                <Skeleton variant="circular" className="w-8 h-8" />
                <Skeleton variant="circular" className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SettingsAffiliatedAppsPage() {
  const { user, profile, canWrite } = useAuth();
  const canModify = canWrite('Affiliated Apps');
  const actorId = user?.id || profile?.id || null;

  // Read SWR cache once synchronously on mount (0ms revisit hydration)
  const [initialCache] = useState(() => getCachedAffiliatedAppsSettingsData());
  const skipInitialCardMotion = Boolean(initialCache);

  const [apps, setApps] = useState<AffiliatedAppRecord[]>(() => initialCache?.apps ?? []);
  const [isLoading, setIsLoading] = useState(() => !initialCache);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tableMissingNotice, setTableMissingNotice] = useState(
    () => initialCache?.tableMissingNotice ?? false
  );

  // Debounced Search (persisted across navigations)
  const [searchQuery, setSearchQuery] = useState(() => initialCache?.searchQuery ?? '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    () => initialCache?.searchQuery ?? ''
  );
  const [currentPage, setCurrentPage] = useState(() => initialCache?.currentPage ?? 1);

  // Lightweight per-card feedback states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resnappingCardId, setResnappingCardId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Lazy modal triggers (all modal internals live in _components)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AffiliatedAppRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AffiliatedAppRecord | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const signatureRef = useRef<string>(initialCache?.signature ?? '');
  const lastFetchedAtRef = useRef<number>(initialCache?.fetchedAt ?? 0);
  const appsRef = useRef<AffiliatedAppRecord[]>(apps);
  const searchQueryRef = useRef<string>(searchQuery);
  const currentPageRef = useRef<number>(currentPage);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    appsRef.current = apps;
  }, [apps]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
    patchCachedAffiliatedAppsSettingsData({ searchQuery });
  }, [searchQuery]);

  useEffect(() => {
    currentPageRef.current = currentPage;
    patchCachedAffiliatedAppsSettingsData({ currentPage });
  }, [currentPage]);

  useEffect(() => {
    if (searchQuery === debouncedSearchQuery) return;
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearchQuery]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3800);
  }, []);

  const commitAppsAndCaches = useCallback(
    (nextApps: AffiliatedAppRecord[], nextTableMissingNotice = false) => {
      const nextSig = computeAffiliatedAppsSignature(nextApps, nextTableMissingNotice);
      const now = Date.now();
      signatureRef.current = nextSig;
      lastFetchedAtRef.current = now;
      appsRef.current = nextApps;

      setTableMissingNotice(nextTableMissingNotice);
      setApps(nextApps);

      setCachedAffiliatedAppsSettingsData({
        apps: nextApps,
        tableMissingNotice: nextTableMissingNotice,
        searchQuery: searchQueryRef.current,
        currentPage: currentPageRef.current,
        signature: nextSig,
        fetchedAt: now,
      });
      setCachedAffiliatedApps(toDirectoryCacheItems(nextApps));
    },
    []
  );

  // ===========================================================================
  // 1. FETCH, SIGNATURE DIFFING & DEBOUNCED REALTIME SYNC
  // ===========================================================================
  const fetchAffiliatedApps = useCallback(
    async (silent = false) => {
      try {
        const hasCached = Boolean(getCachedAffiliatedAppsSettingsData());
        if (!silent && !hasCached) setIsLoading(true);
        else setIsRefreshing(true);

        const { data, error } = await supabase
          .from('affiliated_apps')
          .select(
            'id, name, app_url, image_url, storage_path, sort_order, is_active, created_at, updated_at'
          )
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) {
          if (
            error.code === '42P01' ||
            /relation .*affiliated_apps.* does not exist/i.test(error.message || '') ||
            /schema cache/i.test(error.message || '')
          ) {
            const missingSig = computeAffiliatedAppsSignature([], true);
            if (missingSig !== signatureRef.current) {
              commitAppsAndCaches([], true);
            }
            return;
          }
          throw error;
        }

        const mapped: AffiliatedAppRecord[] = ((data || []) as AffiliatedAppDbRow[]).map(
          (row) => ({
            id: row.id,
            name: row.name,
            appUrl: row.app_url,
            imageUrl: row.image_url,
            storagePath: row.storage_path || null,
            sortOrder: row.sort_order ?? 0,
            isActive: row.is_active ?? true,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })
        );

        const nextSig = computeAffiliatedAppsSignature(mapped, false);
        const now = Date.now();
        lastFetchedAtRef.current = now;

        if (nextSig !== signatureRef.current) {
          commitAppsAndCaches(mapped, false);
        } else {
          patchCachedAffiliatedAppsSettingsData({ fetchedAt: now });
        }
      } catch (err: unknown) {
        console.warn('Error fetching affiliated apps:', getErrorMessage(err, 'Unknown error'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [commitAppsAndCaches]
  );

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void fetchAffiliatedApps(Boolean(getCachedAffiliatedAppsSettingsData()));
    }, 0);

    let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
    const channelName = `settings-affiliated-apps-realtime-${Date.now()}-${Math.random()
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
            void fetchAffiliatedApps(true);
          }, 300);
        }
      )
      .subscribe();

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastFetchedAtRef.current > 5000
      ) {
        void fetchAffiliatedApps(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      if (realtimeTimer) clearTimeout(realtimeTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [fetchAffiliatedApps]);

  // ===========================================================================
  // 2. FILTERING & PAGINATION
  // ===========================================================================
  const filteredApps = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return apps;
    const q = debouncedSearchQuery.trim().toLowerCase();
    return apps.filter(
      (a) => a.name.toLowerCase().includes(q) || a.appUrl.toLowerCase().includes(q)
    );
  }, [apps, debouncedSearchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredApps.length / ITEMS_PER_PAGE));
  const effectivePage = Math.min(currentPage, totalPages);

  const paginatedApps = useMemo(() => {
    const start = (effectivePage - 1) * ITEMS_PER_PAGE;
    return filteredApps.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredApps, effectivePage]);

  const activeCount = useMemo(() => apps.filter((a) => a.isActive).length, [apps]);

  const nextSortOrder = useMemo(
    () => (apps.length > 0 ? Math.max(...apps.map((a) => a.sortOrder || 0)) + 1 : 1),
    [apps]
  );

  // ===========================================================================
  // 3. STABLE CARD CALLBACKS
  // ===========================================================================
  const handleImageError = useCallback((appId: string) => {
    setBrokenImages((prev) => (prev[appId] ? prev : { ...prev, [appId]: true }));
  }, []);

  const handleOpenAddModal = useCallback(() => {
    if (!canModify) return;
    setEditingApp(null);
    setIsModalOpen(true);
  }, [canModify]);

  const handleOpenEditModal = useCallback(
    (app: AffiliatedAppRecord) => {
      if (!canModify) return;
      setEditingApp(app);
      setIsModalOpen(true);
    },
    [canModify]
  );

  const handleToggleActive = useCallback(
    async (app: AffiliatedAppRecord) => {
      if (!canModify) return;
      const prevApps = appsRef.current;
      const nextState = !app.isActive;
      const nextApps = prevApps.map((item) =>
        item.id === app.id ? { ...item, isActive: nextState } : item
      );
      commitAppsAndCaches(nextApps, false);

      const { error } = await supabase
        .from('affiliated_apps')
        .update({
          is_active: nextState,
          updated_by: actorId,
        })
        .eq('id', app.id);

      if (error) {
        commitAppsAndCaches(prevApps, false);
        showToast('Failed to update visibility status.', 'error');
        return;
      }

      showToast(
        nextState
          ? `"${app.name}" is now visible in Affiliated Apps.`
          : `"${app.name}" hidden from directory.`
      );
    },
    [canModify, actorId, commitAppsAndCaches, showToast]
  );

  const handleResnapExistingCard = useCallback(
    async (app: AffiliatedAppRecord) => {
      if (!canModify) return;
      setResnappingCardId((current) => (current ? current : app.id));
      try {
        const res = await fetch('/api/affiliated-apps/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: app.appUrl }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data?.error || 'Could not re-snap preview for this link.', 'error');
          return;
        }

        const oldPath = app.storagePath;
        const { error } = await supabase
          .from('affiliated_apps')
          .update({
            image_url: data.imageUrl,
            storage_path: data.storagePath || null,
            updated_by: actorId,
          })
          .eq('id', app.id);

        if (error) {
          if (data.storagePath) {
            await supabase.storage.from('affiliated-apps').remove([data.storagePath]).catch(() => {});
          }
          throw error;
        }

        if (oldPath && oldPath !== data.storagePath) {
          await supabase.storage.from('affiliated-apps').remove([oldPath]).catch(() => {});
        }

        setBrokenImages((prev) => (prev[app.id] ? { ...prev, [app.id]: false } : prev));
        const optimisticApps = appsRef.current.map((item) =>
          item.id === app.id
            ? {
                ...item,
                imageUrl: data.imageUrl,
                storagePath: data.storagePath || null,
              }
            : item
        );
        commitAppsAndCaches(optimisticApps, false);
        fetchAffiliatedApps(true);
        showToast(`Refreshed live picture for "${app.name}".`);
      } catch (err: unknown) {
        showToast(getErrorMessage(err, 'Failed to refresh app snapshot.'), 'error');
      } finally {
        setResnappingCardId(null);
      }
    },
    [canModify, actorId, commitAppsAndCaches, fetchAffiliatedApps, showToast]
  );

  const handleCopyUrl = useCallback(
    async (app: AffiliatedAppRecord) => {
      try {
        await navigator.clipboard.writeText(app.appUrl);
        setCopiedId(app.id);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => {
          setCopiedId((prev) => (prev === app.id ? null : prev));
        }, 1800);
      } catch {
        showToast('Could not copy link to clipboard.', 'error');
      }
    },
    [showToast]
  );

  const handleRequestDelete = useCallback((app: AffiliatedAppRecord) => {
    setDeleteTarget(app);
  }, []);

  const handleModalSaved = useCallback(
    (savedRecord: AffiliatedAppRecord | null, toastMessage: string, editingId?: string) => {
      setIsModalOpen(false);
      if (editingId) {
        setBrokenImages((prev) => (prev[editingId] ? { ...prev, [editingId]: false } : prev));
      }

      if (savedRecord) {
        const exists = appsRef.current.some((a) => a.id === savedRecord.id);
        const nextApps = exists
          ? appsRef.current.map((a) => (a.id === savedRecord.id ? savedRecord : a))
          : [...appsRef.current, savedRecord];
        commitAppsAndCaches(nextApps, false);
      }

      showToast(toastMessage);
      fetchAffiliatedApps(true);
    },
    [commitAppsAndCaches, fetchAffiliatedApps, showToast]
  );

  const handleAppDeleted = useCallback(
    (deletedApp: AffiliatedAppRecord) => {
      const nextApps = appsRef.current.filter((item) => item.id !== deletedApp.id);
      commitAppsAndCaches(nextApps, false);
      setDeleteTarget(null);
      showToast(`Removed "${deletedApp.name}" from Affiliated Apps.`);
    },
    [commitAppsAndCaches, showToast]
  );

  const handleDeleteError = useCallback(
    (message: string) => {
      showToast(message, 'error');
    },
    [showToast]
  );

  return (
    <AppLayoutShell
      title="Affiliated Web Apps"
      subtitle="PDRRMO Ecosystem & Portal Configuration"
      screen="Affiliated Apps"
      requiredPermission="Full Access"
    >
      <div className="space-y-6">
        {/* ===================================================================== */}
        {/* 1. BREADCRUMB & PAGE HEADER */}
        {/* ===================================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004AC6] hover:text-[#003594] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Settings</span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/70 flex items-center justify-center shrink-0">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E293B]">
                  Affiliated PDRRMO Web Apps
                </h1>
                <p className="text-xs sm:text-sm text-[#505F76] font-medium">
                  Register operational web portals, snap live link previews as pictures, and publish to the sidebar launcher.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link href="/affiliated-apps">
              <SecondaryButton
                size="sm"
                variant="outline"
                pill
                rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                Preview Directory
              </SecondaryButton>
            </Link>
          </div>
        </div>

        <ViewOnlyNotice
          screen="Settings"
          message="Affiliated web application settings are presented in read-only audit mode."
        />

        {tableMissingNotice && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm space-y-1">
              <p className="font-bold">Database Migration Pending</p>
              <p className="text-amber-800">
                Run <code className="px-1.5 py-0.5 rounded bg-amber-100 font-mono text-xs">supabase/create_affiliated_apps_table.sql</code> in your Supabase SQL Editor to initialize <code className="font-mono text-xs">public.affiliated_apps</code> and the <code className="font-mono text-xs">affiliated-apps</code> storage bucket.
              </p>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 2. SUMMARY METRIC STRIP */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#757680] uppercase tracking-wider">
                Registered Apps
              </p>
              <p className="text-2xl font-black text-[#1E293B] mt-1">{apps.length}</p>
              <p className="text-xs text-[#505F76] mt-0.5">Total configured portals</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15 flex items-center justify-center shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#757680] uppercase tracking-wider">
                Published in Navbar
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</p>
              <p className="text-xs text-[#505F76] mt-0.5">Live on Affiliated Apps screen</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#757680] uppercase tracking-wider">
                Auto-Snap Storage
              </p>
              <p className="text-lg font-extrabold text-[#1E293B] mt-1">1280 × 800 PNG</p>
              <p className="text-xs text-[#505F76] mt-0.5">Saved to Supabase Storage</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 border border-sky-200/70 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 3. SEARCH & ACTION TOOLBAR */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#757680] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search app name or link..."
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <SecondaryButton
              type="button"
              size="sm"
              variant="outline"
              pill={false}
              onClick={() => fetchAffiliatedApps(true)}
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

            {canModify && (
              <PrimaryButton
                type="button"
                size="sm"
                pill={false}
                onClick={handleOpenAddModal}
                leftIcon={<Plus className="w-4 h-4" />}
                className="w-full sm:w-auto rounded-xl py-2.5"
              >
                Add Affiliated App
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 4. AFFILIATED APPS CARDS GRID */}
        {/* ===================================================================== */}
        {isLoading ? (
          <AppsGridSkeleton />
        ) : filteredApps.length === 0 ? (
          <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] p-12 text-center shadow-2xs space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-700 border border-sky-200/70 flex items-center justify-center mx-auto">
              <LayoutGrid className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-lg font-bold text-[#1E293B]">
                {debouncedSearchQuery.trim()
                  ? `No apps matching "${debouncedSearchQuery}"`
                  : 'No Affiliated Web Apps Registered Yet'}
              </h3>
              <p className="text-xs sm:text-sm text-[#505F76] leading-relaxed">
                {debouncedSearchQuery.trim()
                  ? 'Try adjusting your search keywords or clear the filter.'
                  : 'Add related PDRRMO web apps with their link. Each link is automatically snapped and saved as a preview picture for quick access in the Affiliated Apps directory.'}
              </p>
            </div>
            {debouncedSearchQuery.trim() ? (
              <SecondaryButton
                type="button"
                size="sm"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </SecondaryButton>
            ) : (
              canModify && (
                <div className="pt-1">
                  <PrimaryButton
                    type="button"
                    size="md"
                    onClick={handleOpenAddModal}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Add First Affiliated App
                  </PrimaryButton>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedApps.map((app, index) => (
                <AffiliatedAppCard
                  key={app.id}
                  app={app}
                  canModify={canModify}
                  isCopied={copiedId === app.id}
                  isResnapping={resnappingCardId === app.id}
                  isBrokenImage={Boolean(brokenImages[app.id])}
                  skipInitialMotion={skipInitialCardMotion}
                  animationIndex={index}
                  onImageError={handleImageError}
                  onCopyUrl={handleCopyUrl}
                  onToggleActive={handleToggleActive}
                  onResnap={handleResnapExistingCard}
                  onEdit={handleOpenEditModal}
                  onDelete={handleRequestDelete}
                />
              ))}
            </div>

            {filteredApps.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-[#505F76] font-medium">
                  Showing {(effectivePage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(effectivePage * ITEMS_PER_PAGE, filteredApps.length)} of{' '}
                  {filteredApps.length}{' '}
                  {filteredApps.length === 1 ? 'web app' : 'web apps'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={effectivePage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous Page"
                    className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-bold text-[#1E293B] px-2 select-none">
                    Page {effectivePage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={effectivePage === totalPages || totalPages === 0}
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

      {/* ======================================================================= */}
      {/* 5. LAZY MODAL: ADD / EDIT AFFILIATED APP */}
      {/* ======================================================================= */}
      <AnimatePresence>
        {isModalOpen && (
          <AffiliatedAppFormModal
            key={editingApp?.id ?? 'new-affiliated-app'}
            editingApp={editingApp}
            nextSortOrder={nextSortOrder}
            actorId={actorId}
            onClose={() => setIsModalOpen(false)}
            onSaved={handleModalSaved}
          />
        )}
      </AnimatePresence>

      {/* ======================================================================= */}
      {/* 6. LAZY MODAL: DELETE CONFIRMATION */}
      {/* ======================================================================= */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteAppModal
            key={deleteTarget.id}
            target={deleteTarget}
            actorId={actorId}
            onClose={() => setDeleteTarget(null)}
            onDeleted={handleAppDeleted}
            onError={handleDeleteError}
          />
        )}
      </AnimatePresence>

      {/* ======================================================================= */}
      {/* 7. FLOATING TOAST FEEDBACK */}
      {/* ======================================================================= */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs sm:text-sm font-semibold ${
              toast.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-white text-[#1E293B] border-[#E2E8F0]'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
