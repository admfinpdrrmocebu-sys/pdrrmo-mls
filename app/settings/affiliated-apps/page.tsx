'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  Check,
  Copy,
  Camera,
  Upload,
  Globe,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Sparkles,
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

const STORAGE_BUCKET = 'affiliated-apps';
const ITEMS_PER_PAGE = 6;

export interface AffiliatedAppRecord {
  id: string;
  name: string;
  appUrl: string;
  imageUrl: string;
  storagePath: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function normalizeDisplayHost(urlStr: string): string {
  try {
    const withProto = /^https?:\/\//i.test(urlStr.trim())
      ? urlStr.trim()
      : `https://${urlStr.trim()}`;
    return new URL(withProto).hostname.replace(/^www\./i, '');
  } catch {
    return urlStr.trim() || 'web-app';
  }
}

function normalizeFullUrl(urlStr: string): string {
  const trimmed = urlStr.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isLikelySnapReadyUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 4) return false;
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return (
      (u.protocol === 'http:' || u.protocol === 'https:') &&
      u.hostname.includes('.') &&
      !u.hostname.endsWith('.')
    );
  } catch {
    return false;
  }
}

function formatUpdatedDate(iso: string | null | undefined): string {
  if (!iso) return 'Recently';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
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
  const { user, profile, isViewOnly, canWrite } = useAuth();
  const canModify = canWrite('Affiliated Apps');

  const [apps, setApps] = useState<AffiliatedAppRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tableMissingNotice, setTableMissingNotice] = useState(false);

  // Debounced Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Copy link feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Card-level re-snap loading state
  const [resnappingCardId, setResnappingCardId] = useState<string | null>(null);
  // Broken image fallback tracking
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AffiliatedAppRecord | null>(null);
  const [appName, setAppName] = useState('');
  const [appLink, setAppLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const [isSnapping, setIsSnapping] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);
  const [snapSuccessHint, setSnapSuccessHint] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<AffiliatedAppRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3800);
  }, []);

  // Track last auto-snapped URL and temporary unsaved storage files during modal session
  const lastAutoSnappedUrlRef = useRef<string>('');
  const unsavedTempPathsRef = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ===========================================================================
  // 1. FETCH & REALTIME SYNC
  // ===========================================================================
  const fetchAffiliatedApps = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);

      const { data, error } = await supabase
        .from('affiliated_apps')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        if (
          error.code === '42P01' ||
          /relation .*affiliated_apps.* does not exist/i.test(error.message || '') ||
          /schema cache/i.test(error.message || '')
        ) {
          setTableMissingNotice(true);
          setApps([]);
          return;
        }
        throw error;
      }

      setTableMissingNotice(false);
      const mapped: AffiliatedAppRecord[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        appUrl: row.app_url,
        imageUrl: row.image_url,
        storagePath: row.storage_path || null,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active ?? true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      setApps(mapped);
    } catch (err: any) {
      console.warn('Error fetching affiliated apps:', err?.message || err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAffiliatedApps();

    const channel = supabase
      .channel('settings-affiliated-apps-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'affiliated_apps' },
        () => {
          fetchAffiliatedApps(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAffiliatedApps]);

  const filteredApps = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return apps;
    const q = debouncedSearchQuery.trim().toLowerCase();
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.appUrl.toLowerCase().includes(q)
    );
  }, [apps, debouncedSearchQuery]);

  // Pagination State (Max 6 per page)
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

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

  // ===========================================================================
  // 2. SNAPSHOT CAPTURE ("SNAP TO LINK -> SAVE AS PICTURE") & MANUAL UPLOAD
  // ===========================================================================
  const captureLinkSnapshot = useCallback(
    async (rawUrl: string, currentUnsavedPath?: string | null) => {
      const normalized = normalizeFullUrl(rawUrl);
      if (!normalized) return;

      try {
        setIsSnapping(true);
        setSnapError(null);
        setSnapSuccessHint(null);

        const res = await fetch('/api/affiliated-apps/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: normalized,
            previousStoragePath:
              currentUnsavedPath && unsavedTempPathsRef.current.has(currentUnsavedPath)
                ? currentUnsavedPath
                : null,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setSnapError(
            data?.error || 'Could not automatically snap preview. You can upload a picture manually.'
          );
          return;
        }

        if (currentUnsavedPath && unsavedTempPathsRef.current.has(currentUnsavedPath)) {
          unsavedTempPathsRef.current.delete(currentUnsavedPath);
        }

        if (data.storagePath) {
          unsavedTempPathsRef.current.add(data.storagePath);
        }

        setImageUrl(data.imageUrl);
        setStoragePath(data.storagePath || null);
        lastAutoSnappedUrlRef.current = normalized;
        setSnapSuccessHint('Webpage snapped & saved as picture');

        // Auto-suggest App Name if blank
        setAppName((prev) => {
          if (prev.trim()) return prev;
          if (typeof data.suggestedTitle === 'string' && data.suggestedTitle.trim()) {
            return data.suggestedTitle.trim().slice(0, 80);
          }
          return prev;
        });
      } catch (err: any) {
        setSnapError(
          err?.message || 'Network error while snapping webpage preview.'
        );
      } finally {
        setIsSnapping(false);
      }
    },
    []
  );

  // Automatic debounced snap (800ms) when user enters or pastes a valid App Link inside the modal
  useEffect(() => {
    if (!isModalOpen) return;
    if (!isLikelySnapReadyUrl(appLink)) return;

    const normalized = normalizeFullUrl(appLink);
    if (normalized === lastAutoSnappedUrlRef.current) return;

    const timer = setTimeout(() => {
      captureLinkSnapshot(normalized, storagePath);
    }, 800);

    return () => clearTimeout(timer);
  }, [appLink, isModalOpen, captureLinkSnapshot, storagePath]);

  const handleManualImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setSnapError('Please select a PNG, JPG, or WEBP image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setSnapError('Image size must be 10MB or smaller.');
      return;
    }

    try {
      setIsUploadingFile(true);
      setSnapError(null);
      setSnapSuccessHint(null);

      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeBase = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-z0-9-]/gi, '-')
        .toLowerCase()
        .slice(0, 32) || 'app-preview';

      const newPath = `uploads/${Date.now()}-${safeBase}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(newPath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(uploadErr.message);
      }

      // Clean up prior unsaved temp snapshot if any
      if (storagePath && unsavedTempPathsRef.current.has(storagePath)) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {});
        unsavedTempPathsRef.current.delete(storagePath);
      }

      unsavedTempPathsRef.current.add(newPath);

      const { data: pubData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(newPath);
      setImageUrl(pubData.publicUrl);
      setStoragePath(newPath);
      setSnapSuccessHint('Custom picture uploaded & ready');
    } catch (err: any) {
      setSnapError(
        `Upload failed: ${err?.message || 'Ensure the affiliated-apps storage bucket is created.'}`
      );
    } finally {
      setIsUploadingFile(false);
    }
  };

  // ===========================================================================
  // 3. MODAL LIFECYCLE & CRUD ACTIONS
  // ===========================================================================
  const cleanupUnsavedTempFiles = useCallback(async () => {
    const paths = Array.from(unsavedTempPathsRef.current);
    unsavedTempPathsRef.current.clear();
    if (paths.length > 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove(paths).catch(() => {});
    }
  }, []);

  const handleOpenAddModal = () => {
    if (!canModify) return;
    setEditingApp(null);
    setAppName('');
    setAppLink('');
    setImageUrl('');
    setStoragePath(null);
    setIsActive(true);
    setSnapError(null);
    setSnapSuccessHint(null);
    lastAutoSnappedUrlRef.current = '';
    unsavedTempPathsRef.current.clear();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (app: AffiliatedAppRecord) => {
    if (!canModify) return;
    setEditingApp(app);
    setAppName(app.name);
    setAppLink(app.appUrl);
    setImageUrl(app.imageUrl);
    setStoragePath(app.storagePath);
    setIsActive(app.isActive);
    setSnapError(null);
    setSnapSuccessHint(null);
    lastAutoSnappedUrlRef.current = normalizeFullUrl(app.appUrl);
    unsavedTempPathsRef.current.clear();
    setIsModalOpen(true);
  };

  const handleCloseModal = async () => {
    if (isSaving) return;
    setIsModalOpen(false);
    await cleanupUnsavedTempFiles();
  };

  const handleSaveApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) return;

    const trimmedName = appName.trim();
    const normalizedUrl = normalizeFullUrl(appLink);

    if (!trimmedName) {
      setSnapError('App Name is required.');
      return;
    }
    if (!normalizedUrl) {
      setSnapError('App Link is required.');
      return;
    }
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setSnapError('App Link must start with http:// or https://.');
        return;
      }
    } catch {
      setSnapError('Please enter a valid App Link URL.');
      return;
    }

    if (!imageUrl) {
      setSnapError('Please wait for the link picture to snap or upload a custom image.');
      return;
    }

    try {
      setIsSaving(true);
      setSnapError(null);

      const actorId = user?.id || profile?.id || null;

      if (editingApp) {
        const previousCommittedPath = editingApp.storagePath;

        const { error } = await supabase
          .from('affiliated_apps')
          .update({
            name: trimmedName,
            app_url: normalizedUrl,
            image_url: imageUrl,
            storage_path: storagePath,
            is_active: isActive,
            updated_by: actorId,
          })
          .eq('id', editingApp.id);

        if (error) throw error;

        // Keep newly saved path; remove superseded storage object if changed
        if (storagePath) {
          unsavedTempPathsRef.current.delete(storagePath);
        }
        if (previousCommittedPath && previousCommittedPath !== storagePath) {
          await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([previousCommittedPath])
            .catch(() => {});
        }

        // Write audit log
        if (actorId) {
          await supabase
            .from('audit_logs')
            .insert({
              user_id: actorId,
              action: 'UPDATE_AFFILIATED_APP',
              entity_type: 'affiliated_apps',
              entity_id: editingApp.id,
              details: { name: trimmedName, app_url: normalizedUrl },
            })
            .then(() => {});
        }

        showToast(`Updated "${trimmedName}" successfully.`);
      } else {
        const nextSortOrder =
          apps.length > 0 ? Math.max(...apps.map((a) => a.sortOrder || 0)) + 1 : 1;

        const { data: inserted, error } = await supabase
          .from('affiliated_apps')
          .insert({
            name: trimmedName,
            app_url: normalizedUrl,
            image_url: imageUrl,
            storage_path: storagePath,
            sort_order: nextSortOrder,
            is_active: isActive,
            created_by: actorId,
            updated_by: actorId,
          })
          .select()
          .maybeSingle();

        if (error) throw error;

        if (storagePath) {
          unsavedTempPathsRef.current.delete(storagePath);
        }

        if (actorId) {
          await supabase
            .from('audit_logs')
            .insert({
              user_id: actorId,
              action: 'CREATE_AFFILIATED_APP',
              entity_type: 'affiliated_apps',
              entity_id: inserted?.id || null,
              details: { name: trimmedName, app_url: normalizedUrl },
            })
            .then(() => {});
        }

        showToast(`Added "${trimmedName}" to Affiliated Apps.`);
      }

      // Clean up any leftover temp files not chosen
      await cleanupUnsavedTempFiles();
      setIsModalOpen(false);
      await fetchAffiliatedApps(true);
    } catch (err: any) {
      setSnapError(err?.message || 'Failed to save Affiliated App.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (app: AffiliatedAppRecord) => {
    if (!canModify) return;
    const nextState = !app.isActive;
    setApps((prev) =>
      prev.map((item) => (item.id === app.id ? { ...item, isActive: nextState } : item))
    );

    const { error } = await supabase
      .from('affiliated_apps')
      .update({
        is_active: nextState,
        updated_by: user?.id || profile?.id || null,
      })
      .eq('id', app.id);

    if (error) {
      setApps((prev) =>
        prev.map((item) => (item.id === app.id ? { ...item, isActive: app.isActive } : item))
      );
      showToast('Failed to update visibility status.', 'error');
      return;
    }

    showToast(
      nextState
        ? `"${app.name}" is now visible in Affiliated Apps.`
        : `"${app.name}" hidden from directory.`
    );
  };

  const handleResnapExistingCard = async (app: AffiliatedAppRecord) => {
    if (!canModify || resnappingCardId) return;
    try {
      setResnappingCardId(app.id);
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
          updated_by: user?.id || profile?.id || null,
        })
        .eq('id', app.id);

      if (error) {
        if (data.storagePath) {
          await supabase.storage.from(STORAGE_BUCKET).remove([data.storagePath]).catch(() => {});
        }
        throw error;
      }

      if (oldPath && oldPath !== data.storagePath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([oldPath]).catch(() => {});
      }

      setBrokenImages((prev) => ({ ...prev, [app.id]: false }));
      await fetchAffiliatedApps(true);
      showToast(`Refreshed live picture for "${app.name}".`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to refresh app snapshot.', 'error');
    } finally {
      setResnappingCardId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !canModify) return;
    try {
      setIsDeleting(true);
      const target = deleteTarget;

      const { error } = await supabase
        .from('affiliated_apps')
        .delete()
        .eq('id', target.id);

      if (error) throw error;

      if (target.storagePath) {
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([target.storagePath])
          .catch(() => {});
      }

      const actorId = user?.id || profile?.id || null;
      if (actorId) {
        await supabase
          .from('audit_logs')
          .insert({
            user_id: actorId,
            action: 'DELETE_AFFILIATED_APP',
            entity_type: 'affiliated_apps',
            entity_id: target.id,
            details: { name: target.name, app_url: target.appUrl },
          })
          .then(() => {});
      }

      setApps((prev) => prev.filter((item) => item.id !== target.id));
      setDeleteTarget(null);
      showToast(`Removed "${target.name}" from Affiliated Apps.`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete Affiliated App.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyUrl = async (app: AffiliatedAppRecord) => {
    try {
      await navigator.clipboard.writeText(app.appUrl);
      setCopiedId(app.id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === app.id ? null : prev));
      }, 1800);
    } catch {
      showToast('Could not copy link to clipboard.', 'error');
    }
  };

  const activeCount = useMemo(() => apps.filter((a) => a.isActive).length, [apps]);

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

        {/* Database Migration Helper Notice (Only shown if SQL migration hasn't been executed yet) */}
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
          {/* Debounced Search Input */}
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

          {/* Mobile-responsive Action Buttons */}
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
              {paginatedApps.map((app, index) => {
              const host = normalizeDisplayHost(app.appUrl);
              const isResnapping = resnappingCardId === app.id;
              const isBroken = Boolean(brokenImages[app.id]);

              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.04 }}
                  className="bg-white rounded-[1.5rem] border border-[#E2E8F0] hover:border-[#CBD5E1] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    {/* Mini Browser Chrome Header */}
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

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          app.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {app.isActive ? 'Published' : 'Hidden'}
                      </span>
                    </div>

                    {/* 16:10 Saved Picture Frame */}
                    <div className="relative w-full aspect-[16/10] bg-[#F1F5F9] overflow-hidden border-b border-[#E2E8F0]">
                      {app.imageUrl && !isBroken ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={app.imageUrl}
                          alt={`${app.name} preview`}
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [app.id]: true }))
                          }
                          className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#757680] p-4 text-center">
                          <Globe className="w-8 h-8 text-[#004AC6]/60" />
                          <span className="text-xs font-semibold text-[#505F76] truncate max-w-full">
                            {host}
                          </span>
                        </div>
                      )}

                      {isResnapping && (
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white p-4">
                          <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                          <span className="text-xs font-semibold">
                            Snapping fresh picture...
                          </span>
                        </div>
                      )}

                      {/* Hover Quick Open Overlay */}
                      <a
                        href={app.appUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/25 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 text-[#1E293B] text-xs font-bold shadow-lg">
                          <span>Open Web App</span>
                          <ExternalLink className="w-3.5 h-3.5 text-[#004AC6]" />
                        </span>
                      </a>
                    </div>

                    {/* App Name & Link Body */}
                    <div className="p-5 pb-3 space-y-2">
                      <h3 className="text-base font-bold text-[#1E293B] truncate">
                        {app.name}
                      </h3>

                      <div className="flex items-center justify-between gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2">
                        <a
                          href={app.appUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[#004AC6] hover:underline truncate flex-1"
                          title={app.appUrl}
                        >
                          {app.appUrl}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(app)}
                          className="text-[#757680] hover:text-[#1E293B] transition-colors shrink-0 cursor-pointer"
                          title="Copy App Link"
                        >
                          {copiedId === app.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Controls */}
                  <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC]/50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {canModify ? (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(app)}
                          className="inline-flex items-center gap-2 text-xs font-semibold text-[#505F76] hover:text-[#1E293B] cursor-pointer"
                          title={
                            app.isActive
                              ? 'Click to hide from Affiliated Apps directory'
                              : 'Click to publish to Affiliated Apps directory'
                          }
                        >
                          <div
                            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex items-center ${
                              app.isActive
                                ? 'bg-[#004AC6] justify-end'
                                : 'bg-slate-300 justify-start'
                            }`}
                          >
                            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-2xs" />
                          </div>
                          <span>{app.isActive ? 'Visible' : 'Hidden'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#757680] font-medium">
                          Updated {formatUpdatedDate(app.updatedAt)}
                        </span>
                      )}
                    </div>

                    {canModify && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleResnapExistingCard(app)}
                          disabled={isResnapping}
                          title="Re-snap Live Picture"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:text-[#004AC6] hover:bg-[#004AC6]/10 transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(app)}
                          title="Edit Affiliated App"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:text-[#004AC6] hover:bg-[#004AC6]/10 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(app)}
                          title="Delete Affiliated App"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
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

      {/* ======================================================================= */}
      {/* 5. MODAL: ADD / EDIT AFFILIATED APP ("APP NAME -> APP LINK -> IMAGE") */}
      {/* ======================================================================= */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15 flex items-center justify-center shrink-0">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                      {editingApp ? 'Edit Affiliated Web App' : 'Add Affiliated Web App'}
                    </h2>
                    <p className="text-xs text-[#505F76]">
                      Provide the App Link to automatically snap & save its preview picture.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSaving}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form Body */}
              <form
                onSubmit={handleSaveApp}
                className="p-6 space-y-5 overflow-y-auto custom-scrollbar"
              >
                {/* Field 1: App Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1E293B] uppercase tracking-wide block">
                    App Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="e.g., PDRRMO Weather Telemetry Portal"
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all placeholder:text-[#94A3B8]"
                  />
                </div>

                {/* Field 2: App Link (Triggers Automatic Snapshot) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-[#1E293B] uppercase tracking-wide">
                      App Link <span className="text-rose-600">*</span>
                    </label>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#004AC6]">
                      <Sparkles className="w-3 h-3" />
                      Auto-snaps on valid URL
                    </span>
                  </div>

                  <div className="flex items-stretch gap-2">
                    <div className="relative flex-1">
                      <Globe className="w-4 h-4 text-[#757680] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={appLink}
                        onChange={(e) => setAppLink(e.target.value)}
                        placeholder="https://example.pdrrmo.gov.ph"
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all placeholder:text-[#94A3B8]"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!isLikelySnapReadyUrl(appLink) || isSnapping || isUploadingFile}
                      onClick={() => captureLinkSnapshot(appLink, storagePath)}
                      className="px-3.5 py-2.5 rounded-xl bg-blue-50 text-[#004AC6] border border-blue-200/80 hover:bg-blue-100 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                      title="Capture live screenshot from App Link"
                    >
                      {isSnapping ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                      <span>{imageUrl ? 'Re-snap' : 'Snap Link'}</span>
                    </button>
                  </div>
                </div>

                {/* Field 3: Image (Auto-Snapped Preview & Saved Picture) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-[#1E293B] uppercase tracking-wide">
                      Image Preview <span className="text-rose-600">*</span>
                    </label>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleManualImageUpload}
                      className="hidden"
                    />

                    <button
                      type="button"
                      disabled={isSnapping || isUploadingFile}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#505F76] hover:text-[#004AC6] transition-colors cursor-pointer disabled:opacity-45"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Custom Picture</span>
                    </button>
                  </div>

                  {/* 16:10 Browser Frame Container */}
                  <div className="rounded-2xl border border-[#CBD5E1] overflow-hidden bg-[#F8FAFC] shadow-2xs">
                    {/* Browser Chrome Bar */}
                    <div className="h-7 bg-white border-b border-[#E2E8F0] px-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="ml-2 text-[10px] font-mono text-[#757680] truncate">
                          {appLink.trim() ? normalizeDisplayHost(appLink) : 'preview.pdrrmo.local'}
                        </span>
                      </div>
                      {snapSuccessHint && !isSnapping && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          Saved as Picture
                        </span>
                      )}
                    </div>

                    {/* Preview Viewport */}
                    <div className="relative w-full aspect-[16/10] bg-[#F1F5F9] flex items-center justify-center overflow-hidden">
                      {isSnapping || isUploadingFile ? (
                        <div className="flex flex-col items-center justify-center gap-2.5 p-6 text-center">
                          <div className="w-11 h-11 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#1E293B]">
                              {isUploadingFile
                                ? 'Uploading custom picture...'
                                : 'Snapping live webpage preview...'}
                            </p>
                            <p className="text-[11px] text-[#505F76] mt-0.5">
                              Capturing & saving image to Supabase Storage
                            </p>
                          </div>
                        </div>
                      ) : imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageUrl}
                            alt="Snapped App Preview"
                            className="w-full h-full object-cover object-top"
                          />
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                            {isLikelySnapReadyUrl(appLink) && (
                              <button
                                type="button"
                                onClick={() => captureLinkSnapshot(appLink, storagePath)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900/75 hover:bg-slate-900 text-white text-[11px] font-semibold inline-flex items-center gap-1 backdrop-blur-xs transition-colors cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Re-snap</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-2.5 py-1 rounded-lg bg-slate-900/75 hover:bg-slate-900 text-white text-[11px] font-semibold inline-flex items-center gap-1 backdrop-blur-xs transition-colors cursor-pointer"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Replace</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 p-6 text-center max-w-xs">
                          <div className="w-11 h-11 rounded-2xl bg-white border border-[#E2E8F0] text-[#505F76] flex items-center justify-center shadow-2xs">
                            <Camera className="w-5 h-5 text-[#004AC6]" />
                          </div>
                          <p className="text-xs font-bold text-[#1E293B]">
                            Automatic Link Picture Capture
                          </p>
                          <p className="text-[11px] text-[#505F76] leading-relaxed">
                            Enter an <strong>App Link</strong> above to snap its live landing page automatically, or click <strong>Upload Custom Picture</strong>.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Visibility Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div>
                    <p className="text-xs font-bold text-[#1E293B]">
                      Show in Affiliated Apps Navbar
                    </p>
                    <p className="text-[11px] text-[#505F76]">
                      Make this web app visible on the Affiliated Apps directory screen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive((prev) => !prev)}
                    className={`w-10 h-5.5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer shrink-0 ${
                      isActive ? 'bg-[#004AC6] justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </button>
                </div>

                {/* Error Notice */}
                {snapError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{snapError}</span>
                  </div>
                )}

                {/* Modal Footer */}
                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E2E8F0]">
                  <SecondaryButton
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCloseModal}
                    disabled={isSaving}
                  >
                    Cancel
                  </SecondaryButton>

                  <PrimaryButton
                    type="submit"
                    size="sm"
                    isLoading={isSaving}
                    disabled={
                      isSaving ||
                      isSnapping ||
                      isUploadingFile ||
                      !appName.trim() ||
                      !appLink.trim() ||
                      !imageUrl
                    }
                  >
                    {editingApp ? 'Save Changes' : 'Save Affiliated App'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================================= */}
      {/* 6. DELETE CONFIRMATION MODAL */}
      {/* ======================================================================= */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-md p-6 space-y-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">
                    Remove Affiliated App?
                  </h3>
                  <p className="text-xs sm:text-sm text-[#505F76] mt-1 leading-relaxed">
                    Are you sure you want to delete <strong>{deleteTarget.name}</strong>? Its saved preview picture will also be removed from storage.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <SecondaryButton
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </SecondaryButton>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Delete App</span>
                </button>
              </div>
            </motion.div>
          </div>
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
