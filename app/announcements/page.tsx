'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertCircle,
  CheckCircle2,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { GeneralCard } from '@/components/card';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import {
  getCachedAnnouncementsScreenData,
  patchCachedAnnouncementsScreenData,
  setCachedAnnouncementsScreenData,
} from '@/lib/cache/screen-data-cache';
import {
  Announcement,
  AnnouncementAcknowledgment,
  MAX_ANNOUNCEMENTS,
  RawDbAnnouncementRow,
  computeAnnouncementsSignature,
  getPlainText,
  mapAnnouncementRow,
} from './_components/types';
import { AnnouncementCard } from './_components/announcement-card';

export type { Announcement, AnnouncementAcknowledgment } from './_components/types';

const AnnouncementEditorModal = dynamic(
  () => import('./_components/announcement-editor-modal'),
  { ssr: false }
);

const AnnouncementViewModal = dynamic(
  () => import('./_components/announcement-view-modal'),
  { ssr: false }
);

const DeleteAnnouncementModal = dynamic(
  () => import('./_components/delete-announcement-modal'),
  { ssr: false }
);

const ANNOUNCEMENTS_SELECT = `
  *,
  creator:created_by(id, full_name, email, role),
  updater:updated_by(id, full_name, email, role),
  acknowledgments:announcement_acknowledgments(
    id,
    announcement_id,
    user_id,
    created_at,
    user:user_id(id, full_name, email, role, avatar_url)
  )
`;

export default function AnnouncementsPage() {
  const { user, profile, isAdmin, canWrite } = useAuth();

  const authUserId = user?.id ?? '';
  const profileId = profile?.id ?? '';
  const currentUserId = authUserId || profileId;
  const currentUserName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Monitoring Officer';
  const currentUserRole = profile?.role || profile?.position_title || 'Officer';
  const currentUserAvatar = profile?.avatar_url ?? null;

  const canModifyAnnouncements = canWrite('Announcements');

  // Synchronous SWR Cache Hydration (0ms instant paint on back-navigation)
  const [initialCache] = useState(() => getCachedAnnouncementsScreenData());

  const [announcements, setAnnouncements] = useState<Announcement[]>(
    () => initialCache?.announcements ?? []
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialCache);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>(
    () => initialCache?.searchQuery ?? ''
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>(
    () => initialCache?.searchQuery ?? ''
  );

  // Refs for latest reads without stale closures or re-creating callbacks
  const announcementsRef = useRef<Announcement[]>(initialCache?.announcements ?? []);
  const announcementsSigRef = useRef<string>(initialCache?.signature ?? '');
  const searchQueryRef = useRef<string>(initialCache?.searchQuery ?? '');
  const debounceFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlDeepLinkAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    announcementsRef.current = announcements;
  }, [announcements]);

  // Keep searchQuery debounced and persisted to SWR cache
  useEffect(() => {
    searchQueryRef.current = searchQuery;
    patchCachedAnnouncementsScreenData({ searchQuery });
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Capacity calculations (Max 20 limit)
  const totalCount = announcements.length;
  const isFull = totalCount >= MAX_ANNOUNCEMENTS;
  const isAlmost = totalCount >= 16 && totalCount < MAX_ANNOUNCEMENTS;

  // Modal & Card Interaction State
  const [viewingAnnouncement, setViewingAnnouncement] = useState<Announcement | null>(null);
  const [editorState, setEditorState] = useState<{
    open: boolean;
    editingId: string | null;
    title: string;
    description: string;
  }>({
    open: false,
    editingId: null,
    title: '',
    description: '',
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [acknowledgingIds, setAcknowledgingIds] = useState<Record<string, boolean>>({});

  // Toast notification
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    submessage?: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = useCallback(
    (
      message: string,
      submessage?: string,
      type: 'success' | 'error' | 'info' = 'success'
    ) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastNotification({ message, submessage, type });
      toastTimerRef.current = setTimeout(() => {
        setToastNotification(null);
      }, 4000);
    },
    []
  );

  const persistAnnouncementsSnapshot = useCallback(
    (nextList: Announcement[], explicitSignature?: string) => {
      const nextSig = explicitSignature ?? computeAnnouncementsSignature(nextList);
      announcementsSigRef.current = nextSig;
      setCachedAnnouncementsScreenData({
        announcements: nextList,
        searchQuery: searchQueryRef.current,
        signature: nextSig,
        fetchedAt: Date.now(),
      });
    },
    []
  );

  // Check if current user has permission to edit or delete a specific announcement
  const canUserModify = useCallback(
    (item: Announcement) => {
      if (!canModifyAnnouncements) return false;
      if (isAdmin) return true;
      return (
        Boolean(currentUserId) &&
        (item.createdById === currentUserId ||
          item.createdById === authUserId ||
          item.createdById === profileId)
      );
    },
    [isAdmin, canModifyAnnouncements, currentUserId, authUserId, profileId]
  );

  // 1. Fetch Dynamic Announcements from Supabase (with signature diffing)
  const fetchAnnouncements = useCallback(async () => {
    try {
      const primary = await supabase
        .from('announcements')
        .select(ANNOUNCEMENTS_SELECT)
        .order('created_at', { ascending: false });

      let data = primary.data;

      if (primary.error) {
        console.warn('Falling back to basic announcements query:', primary.error.message);
        const fallback = await supabase
          .from('announcements')
          .select(
            '*, creator:created_by(id, full_name, email, role), updater:updated_by(id, full_name, email, role)'
          )
          .order('created_at', { ascending: false });

        if (fallback.error) {
          console.error('Error loading announcements:', fallback.error);
          showToast('Failed to load announcements', fallback.error.message, 'error');
          return;
        }
        data = fallback.data;
      }

      if (data) {
        const mapped = (data as RawDbAnnouncementRow[]).map((row) =>
          mapAnnouncementRow(row)
        );
        const nextSig = computeAnnouncementsSignature(mapped);

        if (nextSig !== announcementsSigRef.current) {
          setAnnouncements(mapped);
          persistAnnouncementsSnapshot(mapped, nextSig);

          setViewingAnnouncement((prev) => {
            if (!prev) return null;
            const updated = mapped.find((m) => m.id === prev.id);
            return updated || prev;
          });
        } else {
          patchCachedAnnouncementsScreenData({ fetchedAt: Date.now() });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error fetching announcements';
      console.error('Unexpected error fetching announcements:', err);
      showToast('Failed to load announcements', msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, persistAnnouncementsSnapshot]);

  const handleManualRefresh = useCallback(() => {
    setIsLoading(true);
    void fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Debounced background resync for Realtime CDC bursts
  const scheduleBackgroundRefresh = useCallback(() => {
    if (debounceFetchTimerRef.current) {
      clearTimeout(debounceFetchTimerRef.current);
    }
    debounceFetchTimerRef.current = setTimeout(() => {
      debounceFetchTimerRef.current = null;
      void fetchAnnouncements();
    }, 350);
  }, [fetchAnnouncements]);

  // 2. Initial / Background SWR Fetch + Realtime Sync + Visibility Resync
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void fetchAnnouncements();
    });

    const channelName = `announcements-screen-sync-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          scheduleBackgroundRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcement_acknowledgments' },
        () => {
          scheduleBackgroundRefresh();
        }
      )
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleBackgroundRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (debounceFetchTimerRef.current) clearTimeout(debounceFetchTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [fetchAnnouncements, scheduleBackgroundRefresh]);

  // Open announcement view modal if ?id= param is present in URL (once per param value)
  useEffect(() => {
    if (typeof window === 'undefined' || announcements.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('id');
    if (!targetId || urlDeepLinkAppliedRef.current === targetId) return;

    const match = announcements.find((a) => a.id === targetId);
    if (!match) return;

    urlDeepLinkAppliedRef.current = targetId;
    const timer = setTimeout(() => {
      setViewingAnnouncement(match);
    }, 0);
    return () => clearTimeout(timer);
  }, [announcements]);

  // 3. Acknowledge Handler (stable callback referencing latest announcementsRef)
  const handleToggleAcknowledge = useCallback(
    async (announcementId: string) => {
      if (!currentUserId) {
        showToast(
          'Authentication required',
          'Please sign in to acknowledge announcements',
          'error'
        );
        return;
      }

      const target = announcementsRef.current.find((a) => a.id === announcementId);
      if (!target) return;

      if (
        target.createdById === currentUserId ||
        target.createdById === authUserId ||
        target.createdById === profileId
      ) {
        return;
      }

      const existingAck = target.acknowledgments?.find(
        (a) =>
          a.userId === currentUserId ||
          a.userId === authUserId ||
          a.userId === profileId
      );
      if (existingAck) return;

      setAcknowledgingIds((prev) => ({ ...prev, [announcementId]: true }));

      const newAck: AnnouncementAcknowledgment = {
        id: 'temp-' + Date.now(),
        announcementId,
        userId: currentUserId,
        userName: currentUserName,
        userAvatarUrl: currentUserAvatar,
        userRole: currentUserRole,
        createdAt: 'Just now',
      };

      const updatedAcks = [...target.acknowledgments, newAck];
      const optimisticList = announcementsRef.current.map((a) =>
        a.id === announcementId ? { ...a, acknowledgments: updatedAcks } : a
      );

      setAnnouncements(optimisticList);
      persistAnnouncementsSnapshot(optimisticList);
      setViewingAnnouncement((prev) =>
        prev && prev.id === announcementId ? { ...prev, acknowledgments: updatedAcks } : prev
      );

      try {
        const { error } = await supabase
          .from('announcement_acknowledgments')
          .insert({
            announcement_id: announcementId,
            user_id: currentUserId,
          });

        if (error) {
          console.error('Error saving acknowledgment:', error);
          showToast('Failed to acknowledge', error.message, 'error');
          void fetchAnnouncements();
        } else {
          showToast(
            'Announcement Acknowledged',
            'Your acknowledgment has been recorded',
            'success'
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        console.error('Unexpected error toggling acknowledgment:', err);
        showToast('Error', msg, 'error');
        void fetchAnnouncements();
      } finally {
        setAcknowledgingIds((prev) => ({ ...prev, [announcementId]: false }));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pdrrmo:announcement-ack-changed'));
        }
      }
    },
    [
      currentUserId,
      authUserId,
      profileId,
      currentUserName,
      currentUserAvatar,
      currentUserRole,
      showToast,
      fetchAnnouncements,
      persistAnnouncementsSnapshot,
    ]
  );

  // Filtered Announcements using precomputed plainText (zero regex parsing per keystroke)
  const filteredAnnouncements = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q) return announcements;
    return announcements.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.plainText.toLowerCase().includes(q) ||
        item.createdBy.toLowerCase().includes(q)
    );
  }, [announcements, debouncedSearchQuery]);

  const handleOpenCreate = useCallback(() => {
    if (!canModifyAnnouncements) {
      showToast(
        'Permission Denied',
        'You have view-only access. Posting announcements is restricted.',
        'error'
      );
      return;
    }
    if (announcementsRef.current.length >= MAX_ANNOUNCEMENTS) {
      showToast(
        'Maximum Capacity Reached',
        `Maximum limit of ${MAX_ANNOUNCEMENTS} announcements reached. Please delete an older announcement to publish a new one.`,
        'error'
      );
      return;
    }
    setEditorState({
      open: true,
      editingId: null,
      title: '',
      description: '',
    });
  }, [canModifyAnnouncements, showToast]);

  const handleOpenEdit = useCallback(
    (item: Announcement) => {
      if (!canModifyAnnouncements || !canUserModify(item)) {
        showToast(
          'Permission Denied',
          `Only the creator (${item.createdBy}) or Admin can edit this announcement.`,
          'error'
        );
        return;
      }
      setViewingAnnouncement(null);
      setEditorState({
        open: true,
        editingId: item.id,
        title: item.title,
        description: item.description,
      });
    },
    [canModifyAnnouncements, canUserModify, showToast]
  );

  const handleSave = useCallback(
    async ({
      editingId,
      title,
      description,
    }: {
      editingId: string | null;
      title: string;
      description: string;
    }) => {
      if (!canModifyAnnouncements) {
        showToast(
          'Action Restricted',
          'You have view-only access. Modifying announcements is restricted.',
          'error'
        );
        return;
      }
      if (!editingId && announcementsRef.current.length >= MAX_ANNOUNCEMENTS) {
        showToast(
          'Maximum Capacity Reached',
          `Cannot publish new announcement. The maximum limit of ${MAX_ANNOUNCEMENTS} bulletins has been reached.`,
          'error'
        );
        return;
      }
      const plainDesc = getPlainText(description);
      if (!title.trim() || !plainDesc.trim()) {
        showToast('Validation Error', 'Please provide both a title and description.', 'error');
        return;
      }

      if (!currentUserId) {
        showToast(
          'Authentication Required',
          'Please sign in to post or modify announcements.',
          'error'
        );
        return;
      }

      setIsSubmitting(true);
      try {
        if (editingId) {
          const { data, error } = await supabase
            .from('announcements')
            .update({
              title: title.trim(),
              description,
              updated_by: currentUserId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingId)
            .select(
              '*, creator:created_by(id, full_name, email, role), updater:updated_by(id, full_name, email, role)'
            )
            .single();

          if (error) throw error;

          if (data) {
            const existing = announcementsRef.current.find((a) => a.id === editingId);
            const updated = mapAnnouncementRow(
              {
                ...(data as RawDbAnnouncementRow),
                acknowledgments: undefined,
              },
              currentUserName
            );
            const merged: Announcement = {
              ...updated,
              acknowledgments: existing?.acknowledgments ?? [],
            };
            const nextList = announcementsRef.current.map((item) =>
              item.id === editingId ? merged : item
            );
            setAnnouncements(nextList);
            persistAnnouncementsSnapshot(nextList);
            setViewingAnnouncement((prev) =>
              prev?.id === editingId ? merged : prev
            );
          }

          showToast(
            'Announcement Updated',
            'Changes have been saved and broadcast to all terminals.',
            'success'
          );
        } else {
          const { data, error } = await supabase
            .from('announcements')
            .insert({
              title: title.trim(),
              description,
              created_by: currentUserId,
            })
            .select(
              '*, creator:created_by(id, full_name, email, role), updater:updated_by(id, full_name, email, role)'
            )
            .single();

          if (error) throw error;

          if (data) {
            const created = mapAnnouncementRow(
              data as RawDbAnnouncementRow,
              currentUserName
            );
            const nextList = [
              created,
              ...announcementsRef.current.filter((a) => a.id !== created.id),
            ];
            setAnnouncements(nextList);
            persistAnnouncementsSnapshot(nextList);

            fetch('/api/announcements/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: created.id,
                title: created.title,
                description: created.description,
                createdBy: currentUserId,
              }),
            }).catch((pushErr) => {
              console.warn('Push notification broadcast error:', pushErr);
            });
          }

          showToast(
            'Announcement Published',
            'New bulletin is now live for all duty personnel.',
            'success'
          );
        }

        setEditorState((prev) => ({ ...prev, open: false }));
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Could not save announcement. Please verify your permissions.';
        console.error('Failed to save announcement:', err);
        showToast('Save Failed', msg, 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      canModifyAnnouncements,
      currentUserId,
      currentUserName,
      showToast,
      persistAnnouncementsSnapshot,
    ]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const item = announcementsRef.current.find((a) => a.id === id);
      if (!item) return;

      if (!canUserModify(item)) {
        showToast(
          'Permission Denied',
          `Only the creator (${item.createdBy}) or Admin can delete this announcement.`,
          'error'
        );
        setDeletingId(null);
        return;
      }

      setIsSubmitting(true);
      try {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) throw error;

        const nextList = announcementsRef.current.filter((a) => a.id !== id);
        setAnnouncements(nextList);
        persistAnnouncementsSnapshot(nextList);
        setViewingAnnouncement((prev) => (prev?.id === id ? null : prev));
        setDeletingId(null);
        showToast('Announcement Removed', 'The bulletin has been permanently deleted.', 'success');
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Could not delete announcement. Please check permissions.';
        console.error('Failed to delete announcement:', err);
        showToast('Delete Failed', msg, 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [canUserModify, showToast, persistAnnouncementsSnapshot]
  );

  const viewingCreatorCheck = useMemo(() => {
    if (!viewingAnnouncement || !currentUserId) return false;
    return (
      viewingAnnouncement.createdById === currentUserId ||
      viewingAnnouncement.createdById === authUserId ||
      viewingAnnouncement.createdById === profileId
    );
  }, [viewingAnnouncement, currentUserId, authUserId, profileId]);

  const viewingHasAcknowledged = useMemo(() => {
    if (!viewingAnnouncement || !currentUserId) return false;
    return Boolean(
      viewingAnnouncement.acknowledgments?.some(
        (a) =>
          a.userId === currentUserId ||
          a.userId === authUserId ||
          a.userId === profileId
      )
    );
  }, [viewingAnnouncement, currentUserId, authUserId, profileId]);

  return (
    <AppLayoutShell
      title="Announcements"
      subtitle="Official Broadcasts & Bulletins"
      screen="Announcements"
    >
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* 1. HEADER & CONTROLS */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-[#004AC6]" />
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1E293B] tracking-tight">
                Official Announcements
              </h1>
            </div>
            <p className="text-sm text-[#505F76] mt-1">
              Broadcasts, operational memos, and disaster advisory bulletins for all duty personnel.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <SecondaryButton
              size="md"
              pill
              onClick={handleManualRefresh}
              disabled={isLoading}
              leftIcon={
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#004AC6]' : ''}`}
                />
              }
              className="w-full sm:w-auto justify-center"
            >
              Refresh
            </SecondaryButton>

            {canModifyAnnouncements && (
              <PrimaryButton
                size="md"
                pill
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleOpenCreate}
                disabled={isFull}
                className="w-full sm:w-auto justify-center"
                title={
                  isFull
                    ? `Maximum limit of ${MAX_ANNOUNCEMENTS} announcements reached`
                    : 'Post Announcement'
                }
              >
                Post Announcement
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* View-Only Clearance Notice */}
        <ViewOnlyNotice
          screen="Announcements"
          message="Posting, editing, and deleting official announcements are restricted under View-Only clearance."
        />

        {/* 2. SEARCH BAR & CAPACITY INDICATOR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="relative flex items-center w-full max-w-md">
            <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search announcements by title, keywords, or author..."
              className="w-full bg-white border border-[#E2E8F0] rounded-full py-2.5 pl-11 pr-4 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 text-[#94A3B8] hover:text-[#1E293B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-full border border-[#E2E8F0] shadow-2xs shrink-0 self-start sm:self-auto">
            <span
              className={`text-xs font-mono font-extrabold ${
                isFull
                  ? 'text-rose-600'
                  : isAlmost
                  ? 'text-amber-600'
                  : 'text-[#004AC6]'
              }`}
            >
              {totalCount}/{MAX_ANNOUNCEMENTS}
            </span>
            <div className="w-24 sm:w-28 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isFull
                    ? 'bg-rose-600'
                    : isAlmost
                    ? 'bg-amber-500'
                    : 'bg-[#004AC6]'
                }`}
                style={{
                  width: `${Math.min(100, (totalCount / MAX_ANNOUNCEMENTS) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* 3. ANNOUNCEMENTS LIST */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <GeneralCard key={i} className="p-5 sm:p-6 border-[#E2E8F0] animate-pulse">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="h-5 bg-slate-200 rounded-md w-2/3"></div>
                      <div className="h-6 w-16 bg-slate-100 rounded-full"></div>
                    </div>
                    <div className="space-y-2 py-1">
                      <div className="h-3.5 bg-slate-100 rounded w-full"></div>
                      <div className="h-3.5 bg-slate-100 rounded w-5/6"></div>
                      <div className="h-3.5 bg-slate-100 rounded w-1/2"></div>
                    </div>
                    <div className="flex items-center gap-4 pt-3 border-t border-[#F1F5F9]">
                      <div className="h-3 w-28 bg-slate-200 rounded"></div>
                      <div className="h-3 w-32 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                </GeneralCard>
              ))}
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <GeneralCard className="p-10 text-center flex flex-col items-center justify-center border-[#E2E8F0]">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-[#757680] mb-3">
                <Megaphone className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#1E293B]">No announcements found</h3>
              <p className="text-xs text-[#505F76] mt-1 max-w-sm">
                {searchQuery
                  ? 'No broadcast matches your search query.'
                  : 'There are currently no active announcements posted.'}
              </p>
              {!searchQuery && canModifyAnnouncements && (
                <div className="mt-4">
                  <PrimaryButton
                    size="sm"
                    pill
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={handleOpenCreate}
                  >
                    Post First Announcement
                  </PrimaryButton>
                </div>
              )}
            </GeneralCard>
          ) : (
            filteredAnnouncements.map((item) => {
              const isOwner = canUserModify(item);
              const isCreator = Boolean(
                currentUserId &&
                  (item.createdById === currentUserId ||
                    item.createdById === authUserId ||
                    item.createdById === profileId)
              );
              const hasAcknowledged = Boolean(
                currentUserId &&
                  item.acknowledgments?.some(
                    (a) =>
                      a.userId === currentUserId ||
                      a.userId === authUserId ||
                      a.userId === profileId
                  )
              );
              const isAcknowledging = Boolean(acknowledgingIds[item.id]);

              return (
                <AnnouncementCard
                  key={item.id}
                  item={item}
                  isOwner={isOwner}
                  isCreator={isCreator}
                  hasAcknowledged={hasAcknowledged}
                  isAcknowledging={isAcknowledging}
                  onView={setViewingAnnouncement}
                  onEdit={handleOpenEdit}
                  onDeleteRequest={setDeletingId}
                  onAcknowledge={handleToggleAcknowledge}
                />
              );
            })
          )}
        </div>
      </div>

      {/* 4. LAZY MODALS */}
      <AnimatePresence>
        {editorState.open && (
          <AnnouncementEditorModal
            key={editorState.editingId || 'create'}
            editingId={editorState.editingId}
            initialTitle={editorState.title}
            initialDescription={editorState.description}
            isSubmitting={isSubmitting}
            onClose={() => setEditorState((prev) => ({ ...prev, open: false }))}
            onSubmit={handleSave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingId && (
          <DeleteAnnouncementModal
            deletingId={deletingId}
            isSubmitting={isSubmitting}
            onCancel={() => setDeletingId(null)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingAnnouncement && (
          <AnnouncementViewModal
            announcement={viewingAnnouncement}
            canModify={canUserModify(viewingAnnouncement)}
            isCreator={viewingCreatorCheck}
            hasAcknowledged={viewingHasAcknowledged}
            isAcknowledging={Boolean(acknowledgingIds[viewingAnnouncement.id])}
            onClose={() => setViewingAnnouncement(null)}
            onEdit={handleOpenEdit}
            onAcknowledge={handleToggleAcknowledge}
          />
        )}
      </AnimatePresence>

      {/* 5. PAGE TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 text-white px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 ${
              toastNotification.type === 'error'
                ? 'bg-rose-900/90 border-rose-700 text-white'
                : toastNotification.type === 'info'
                ? 'bg-sky-900/90 border-sky-700 text-white'
                : 'bg-[#1E293B] border-slate-700 text-white'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                toastNotification.type === 'error'
                  ? 'bg-rose-500/20 text-rose-300'
                  : toastNotification.type === 'info'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {toastNotification.type === 'error' ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold">{toastNotification.message}</p>
              {toastNotification.submessage && (
                <p className="text-xs text-slate-300">{toastNotification.submessage}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
