'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  FolderOpen,
  FolderPlus,
  Search,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Link as LinkIcon,
  RefreshCw,
  FolderGit2,
  Lock,
  AlertCircle,
  FileText,
  CheckCircle2,
  FolderUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { GeneralCard } from '@/components/card';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';

export interface DriveDirectory {
  id: string;
  title: string;
  url: string;
  description?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  creator_avatar_url?: string | null;
  created_at: string;
  rawCreatedAt?: string;
  updated_by?: string | null;
  updated_by_name?: string | null;
  updater_avatar_url?: string | null;
  updated_at?: string | null;
  rawUpdatedAt?: string | null;
}

export const MAX_DIRECTORIES = 30;

// Helper to compute initials from full name
function getInitials(name: string): string {
  if (!name) return 'OP';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Format timestamp into standard military/civilian format: "Sep 28, 2026 · 14:00H"
function formatDriveDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month} ${day}, ${year} · ${hours}:${minutes}H`;
}

// User Avatar Component with Image & Initials Fallback (Memoized)
const UserAvatarBadge = React.memo(function UserAvatarBadge({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}: {
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const sizeMap = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  const initials = getInitials(name || 'Officer');

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'User Profile'}
        onError={() => setImgError(true)}
        className={`${sizeMap[size]} rounded-full object-cover border border-[#E2E8F0] shadow-xs shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeMap[size]} rounded-full font-bold flex items-center justify-center shadow-xs shrink-0 select-none bg-gradient-to-br from-[#004AC6] to-blue-600 text-white border border-blue-300/40 ${className}`}
    >
      {initials}
    </div>
  );
});

// Memoized Directory Card Component
const DirectoryCard = React.memo(function DirectoryCard({
  item,
  isOwner,
  isCopied,
  onCopy,
  onEdit,
  onDelete,
}: {
  item: DriveDirectory;
  isOwner: boolean;
  isCopied: boolean;
  onCopy: (item: DriveDirectory) => void;
  onEdit: (item: DriveDirectory) => void;
  onDelete: (item: DriveDirectory) => void;
}) {
  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E2E8F0] shadow-xs hover:border-[#CBD5E1] transition-all flex flex-col justify-between group relative overflow-hidden space-y-4">
      <div className="space-y-4">
        {/* Card Header: Title & Action Controls */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#004AC6] border border-blue-200/70 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#1E293B] group-hover:text-[#004AC6] transition-colors tracking-tight leading-snug">
                {item.title}
              </h2>
            </div>
          </div>

          {/* Edit / Delete Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  title="Edit Directory"
                  className="p-2 text-[#505F76] hover:text-[#004AC6] hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  title="Delete Directory"
                  className="p-2 text-[#505F76] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <span
                title="Read only: Created by another officer"
                className="p-1 text-slate-400"
              >
                <Lock className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>

        {/* Google Drive Link Box */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <LinkIcon className="w-4 h-4 text-[#004AC6] shrink-0" />
            <span className="text-xs text-[#1E293B] font-mono truncate font-medium">
              {item.url}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onCopy(item)}
              title="Copy Direct Link"
              className="px-2.5 py-1.5 rounded-xl border border-[#E2E8F0] bg-white text-xs font-semibold text-[#505F76] hover:bg-slate-50 hover:text-[#004AC6] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Google Drive Folder in new tab"
              className="px-3 py-1.5 rounded-xl bg-[#004AC6] text-white text-xs font-bold hover:bg-[#003ea8] transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <span>Open Drive</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Quick Notes & Specific Route (Optional) */}
        {item.description ? (
          <div className="text-xs text-[#334155] bg-slate-50/80 border border-slate-200/60 rounded-2xl p-3.5 leading-relaxed">
            <p className="font-semibold text-[#1E293B] mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-[#004AC6]" />
              Quick Notes & Specific Route:
            </p>
            <p className="whitespace-pre-wrap">{item.description}</p>
          </div>
        ) : null}
      </div>

      {/* Created By & Updated By User Profile Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#F1F5F9]">
        {/* Created By Card */}
        <div className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 shadow-2xs">
          <UserAvatarBadge
            name={item.created_by_name}
            avatarUrl={item.creator_avatar_url}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
              Created by
            </span>
            <span className="text-xs font-bold text-[#1E293B] truncate block">
              {item.created_by_name || 'Monitoring Officer'}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-[#505F76] mt-0.5">
              <Calendar className="w-3 h-3 text-[#94A3B8]" />
              <span className="truncate">{item.created_at}</span>
            </div>
          </div>
        </div>

        {/* Updated By Card */}
        {item.updated_by_name && item.updated_at ? (
          <div className="flex items-center gap-3 bg-blue-50/50 border border-blue-200/60 rounded-2xl p-3 shadow-2xs">
            <UserAvatarBadge
              name={item.updated_by_name}
              avatarUrl={item.updater_avatar_url}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-[#004AC6] uppercase tracking-wider block">
                Updated by
              </span>
              <span className="text-xs font-bold text-[#1E293B] truncate block">
                {item.updated_by_name}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-[#004AC6] mt-0.5">
                <Clock className="w-3 h-3 text-[#004AC6]/70" />
                <span className="truncate">{item.updated_at}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex items-center justify-center p-3 rounded-2xl border border-dashed border-slate-200 text-[11px] text-slate-400 italic">
            No subsequent revisions
          </div>
        )}
      </div>
    </div>
  );
});

export default function DriveFilesPage() {
  const { user, profile, isAdmin, isViewOnly, canWrite } = useAuth();
  const canModifyDrive = canWrite('Archives') && !isViewOnly('Archives');

  // Stable references for profile & user to prevent recreation loops
  const profileRef = useRef(profile);
  const userRef = useRef(user);
  useEffect(() => {
    profileRef.current = profile;
    userRef.current = user;
  }, [profile, user]);

  // Data & Loading States
  const [directories, setDirectories] = useState<DriveDirectory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & Debounce
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Pagination (4 items max per page)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Capacity calculations (Max 30 limit)
  const totalCount = directories.length;
  const isFull = totalCount >= MAX_DIRECTORIES;
  const isAlmost = totalCount >= 24 && totalCount < MAX_DIRECTORIES;

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Delete Confirmation State
  const [deletingItem, setDeletingItem] = useState<DriveDirectory | null>(null);

  // Copied Link Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Toast Notification State
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    submessage?: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = useCallback(
    (message: string, submessage?: string, type: 'success' | 'error' | 'info' = 'success') => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastNotification({ message, submessage, type });
      toastTimerRef.current = setTimeout(() => {
        setToastNotification(null);
      }, 4000);
    },
    []
  );

  // Check if current user can modify a specific directory item
  const canUserModify = useCallback(
    (item: DriveDirectory) => {
      if (!canModifyDrive) return false;
      if (isAdmin) return true;
      const currentUserId = userRef.current?.id || profileRef.current?.id;
      if (!currentUserId) return false;
      return (
        item.created_by === currentUserId ||
        item.created_by_name?.toLowerCase().trim() === profileRef.current?.full_name?.toLowerCase().trim()
      );
    },
    [isAdmin, canModifyDrive]
  );

  // Fetch Drive Directories from Supabase
  const fetchDirectories = useCallback(
    async (isInitial = false, isBackground = false) => {
      if (isInitial) {
        setIsLoading(true);
      } else if (!isBackground) {
        setIsRefreshing(true);
      }

      try {
        const [driveRes, profilesRes] = await Promise.all([
          supabase
            .from('drive_directories')
            .select('*, creator:created_by(id, full_name, avatar_url, position_title), updater:updated_by(id, full_name, avatar_url, position_title)')
            .order('created_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url, position_title'),
        ]);

        const profMap = new Map<string, any>();
        if (profilesRes.data && Array.isArray(profilesRes.data)) {
          profilesRes.data.forEach((p: any) => {
            if (p.id) profMap.set(p.id.toLowerCase(), p);
            if (p.full_name) profMap.set(p.full_name.toLowerCase().trim(), p);
          });
        }
        if (profileRef.current) {
          if (profileRef.current.id) profMap.set(profileRef.current.id.toLowerCase(), profileRef.current);
          if (profileRef.current.full_name) profMap.set(profileRef.current.full_name.toLowerCase().trim(), profileRef.current);
        }

        if (driveRes.error) {
          console.warn('Notice from drive_directories query:', driveRes.error.message);
          setDirectories([]);
          return;
        }

        if (driveRes.data && Array.isArray(driveRes.data)) {
          const mapped: DriveDirectory[] = driveRes.data.map((row: any) => {
            const creatorProf = Array.isArray(row.creator) ? row.creator[0] : row.creator;
            const updaterProf = Array.isArray(row.updater) ? row.updater[0] : row.updater;

            const creatorLookup =
              creatorProf ||
              (row.created_by ? profMap.get(row.created_by.toLowerCase()) : undefined) ||
              (row.created_by_name ? profMap.get(row.created_by_name.toLowerCase().trim()) : undefined);

            const updaterLookup =
              updaterProf ||
              (row.updated_by ? profMap.get(row.updated_by.toLowerCase()) : undefined) ||
              (row.updated_by_name ? profMap.get(row.updated_by_name.toLowerCase().trim()) : undefined);

            return {
              id: row.id,
              title: row.title || 'Untitled Drive Folder',
              url: row.url || '',
              description: row.description || '',
              created_by: row.created_by,
              created_by_name: creatorLookup?.full_name || row.created_by_name || 'Monitoring Officer',
              creator_avatar_url: creatorLookup?.avatar_url || null,
              created_at: formatDriveDate(row.created_at),
              rawCreatedAt: row.created_at,
              updated_by: row.updated_by,
              updated_by_name: updaterLookup?.full_name || row.updated_by_name || null,
              updater_avatar_url: updaterLookup?.avatar_url || null,
              updated_at: row.updated_at && row.updated_at !== row.created_at ? formatDriveDate(row.updated_at) : null,
              rawUpdatedAt: row.updated_at,
            };
          });
          setDirectories(mapped);
        } else {
          setDirectories([]);
        }
      } catch (err) {
        console.error('Unexpected error fetching drive directories:', err);
        setDirectories([]);
      } finally {
        if (isInitial) setIsLoading(false);
        if (!isBackground) setIsRefreshing(false);
      }
    },
    []
  );

  // Realtime Subscription (Registered once on mount)
  useEffect(() => {
    fetchDirectories(true, false);

    const channel = supabase
      .channel('realtime_drive_directories_subscription')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drive_directories' },
        (payload) => {
          if (payload.eventType === 'DELETE' && payload.old && (payload.old as any).id) {
            const deletedId = (payload.old as any).id;
            setDirectories((prev) => prev.filter((d) => d.id !== deletedId));
          } else {
            fetchDirectories(false, true);
          }
        }
      )
      .subscribe();

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchDirectories]);

  // Copy Link Handler
  const handleCopyLink = useCallback(
    (item: DriveDirectory) => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(item.url);
        setCopiedId(item.id);
        showToast('Drive Link Copied', `Direct URL for "${item.title}" is saved to clipboard.`, 'success');
        setTimeout(() => setCopiedId(null), 2500);
      }
    },
    [showToast]
  );

  // Open Create Modal
  const handleOpenCreate = useCallback(() => {
    if (!canModifyDrive) {
      showToast('Access Restricted', 'You have view-only access. Adding drive directories is restricted.', 'error');
      return;
    }
    if (directories.length >= MAX_DIRECTORIES) {
      showToast(
        'Maximum Capacity Reached',
        `Maximum limit of ${MAX_DIRECTORIES} drive directories reached. Please remove an older directory to add a new one.`,
        'error'
      );
      return;
    }
    setEditingId(null);
    setFormTitle('');
    setFormUrl('');
    setFormDescription('');
    setIsModalOpen(true);
  }, [canModifyDrive, directories.length, showToast]);

  // Open Edit Modal
  const handleOpenEdit = useCallback(
    (item: DriveDirectory) => {
      if (!canModifyDrive || !canUserModify(item)) {
        showToast('Permission Denied', `Only the creator (${item.created_by_name || 'Creator'}) or Admin can edit this directory.`, 'error');
        return;
      }
      setEditingId(item.id);
      setFormTitle(item.title);
      setFormUrl(item.url);
      setFormDescription(item.description || '');
      setIsModalOpen(true);
    },
    [canModifyDrive, canUserModify, showToast]
  );

  // Save (Create or Update) Directory to Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModifyDrive) {
      showToast('Access Restricted', 'You have view-only access.', 'error');
      return;
    }
    if (!editingId && directories.length >= MAX_DIRECTORIES) {
      showToast(
        'Maximum Capacity Reached',
        `Cannot add new drive directory. The maximum limit of ${MAX_DIRECTORIES} directories has been reached.`,
        'error'
      );
      return;
    }

    if (!formTitle.trim() || !formUrl.trim()) {
      showToast('Validation Error', 'Please enter both a Folder Title and Google Drive Link.', 'error');
      return;
    }

    // Basic URL validation
    let cleanUrl = formUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const currentUserId = userRef.current?.id || profileRef.current?.id;
    const currentUserName = profileRef.current?.full_name || userRef.current?.user_metadata?.full_name || 'Monitoring Officer';
    const currentUserAvatar = profileRef.current?.avatar_url || null;

    setIsSubmitting(true);
    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('drive_directories')
          .update({
            title: formTitle.trim(),
            url: cleanUrl,
            description: formDescription.trim() || null,
            updated_by: currentUserId,
            updated_by_name: currentUserName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setDirectories((prev) =>
            prev.map((item) =>
              item.id === editingId
                ? {
                    ...item,
                    title: data.title,
                    url: data.url,
                    description: data.description,
                    updated_by_name: data.updated_by_name || currentUserName,
                    updater_avatar_url: currentUserAvatar,
                    updated_at: formatDriveDate(data.updated_at),
                  }
                : item
            )
          );
        }

        showToast('Directory Updated', `"${formTitle.trim()}" folder link updated successfully.`, 'success');
      } else {
        const { data, error } = await supabase
          .from('drive_directories')
          .insert({
            title: formTitle.trim(),
            url: cleanUrl,
            description: formDescription.trim() || null,
            created_by: currentUserId,
            created_by_name: currentUserName,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const newLiveItem: DriveDirectory = {
            id: data.id,
            title: data.title,
            url: data.url,
            description: data.description,
            created_by: data.created_by,
            created_by_name: data.created_by_name || currentUserName,
            creator_avatar_url: currentUserAvatar,
            created_at: formatDriveDate(data.created_at),
          };
          setDirectories((prev) => [newLiveItem, ...prev]);
        }

        showToast('Drive Directory Added', `"${formTitle.trim()}" folder route registered.`, 'success');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving drive directory:', err);
      showToast('Save Failed', err.message || 'Could not save drive directory.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Prompt Handler
  const handlePromptDelete = useCallback(
    (item: DriveDirectory) => {
      if (!canUserModify(item)) {
        showToast('Permission Denied', `Only the creator (${item.created_by_name || 'Creator'}) or Admin can delete this directory.`, 'error');
        return;
      }
      setDeletingItem(item);
    },
    [canUserModify, showToast]
  );

  // Execute Delete Handler (Optimistic & Resilient)
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    const targetItem = deletingItem;
    const targetId = targetItem.id;

    // Immediately close modal & remove optimistically from state
    setDeletingItem(null);
    setIsSubmitting(true);
    setDirectories((prev) => prev.filter((d) => d.id !== targetId));

    try {
      const { error } = await supabase.from('drive_directories').delete().eq('id', targetId);
      if (error) {
        // Rollback state if server deletion failed
        fetchDirectories(false, true);
        throw error;
      }

      showToast('Directory Removed', `"${targetItem.title}" was removed from the route directory list.`, 'success');
    } catch (err: any) {
      console.error('Error deleting directory:', err);
      showToast('Delete Failed', err.message || 'Could not delete directory.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered dataset based on debounced search query
  const filteredDirectories = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase().trim();
    if (!q) return directories;
    return directories.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.created_by_name && item.created_by_name.toLowerCase().includes(q)) ||
        (item.updated_by_name && item.updated_by_name.toLowerCase().includes(q))
      );
    });
  }, [directories, debouncedSearchQuery]);

  // Paginated dataset (4 items max per page)
  const totalFilteredCount = filteredDirectories.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Auto-adjust currentPage if items are deleted
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedDirectories = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredDirectories.slice(start, start + itemsPerPage);
  }, [filteredDirectories, safeCurrentPage, itemsPerPage]);

  return (
    <AppLayoutShell
      title="Drive Directories"
      subtitle="Google Drive Folders & Quick Notes"
      screen="Archives"
    >
      <div className="space-y-6 pb-12">
        {/* ========================================================================= */}
        {/* VIEW-ONLY NOTICE */}
        {/* ========================================================================= */}
        <ViewOnlyNotice
          screen="Archives"
          message="You are viewing the Google Drive route directories in read-only mode. Adding and editing directories are restricted."
        />

        {/* ========================================================================= */}
        {/* 1. HEADER SECTION WITH BACK LINK & ACTION CONTROLS */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link
              href="/archives"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004AC6] hover:text-[#003594] mb-2 transition-colors group cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Certified Archives</span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 text-[#004AC6] border border-blue-200/60 flex items-center justify-center shrink-0">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
                Google Drive Route Directories
              </h1>
              {isRefreshing && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#004AC6] border border-blue-200">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing
                </span>
              )}
            </div>
            <p className="text-sm sm:text-base text-[#505F76] mt-1 font-medium">
              Quick access notes, dedicated route links, and official Google Drive cloud repositories.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <SecondaryButton
              size="md"
              pill
              leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
              onClick={() => fetchDirectories(false, false)}
              className="w-full sm:w-auto justify-center"
            >
              Refresh
            </SecondaryButton>

            <Link href="/archives/transfer">
              <SecondaryButton
                size="md"
                pill
                leftIcon={<FolderUp className="w-4 h-4 text-[#004AC6]" />}
                className="w-full sm:w-auto justify-center"
              >
                Transfer Hub
              </SecondaryButton>
            </Link>

            {canModifyDrive && (
              <PrimaryButton
                size="md"
                pill
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleOpenCreate}
                disabled={isFull}
                title={
                  isFull
                    ? `Maximum limit of ${MAX_DIRECTORIES} drive directories reached`
                    : 'Add Folder Directory'
                }
                className="w-full sm:w-auto justify-center"
              >
                Add Folder Directory
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. STATS SUMMARY CARDS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-white rounded-3xl p-5 border border-[#E2E8F0] shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15 shrink-0">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider block">
                Total Route Directories
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] font-mono leading-tight">
                {directories.length}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-[#E2E8F0] shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center border border-sky-500/15 shrink-0">
              <LinkIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider block">
                Active Cloud Links
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] font-mono leading-tight">
                {directories.filter((d) => !!d.url).length}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. SEARCH BAR & ADD FOLDER BUTTON WITH CAPACITY INDICATOR */}
        {/* ========================================================================= */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search drive directories by folder title, link, notes, or author..."
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 pl-11 pr-10 text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E293B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Controls: Capacity Indicator (0/30 with progress bar) on the left side of Add Folder Directory */}
          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
            {/* Capacity Indicator: 0/30 with progress bar (no icons) */}
            <div className="flex items-center gap-3 bg-[#F8FAFC] px-4 py-2.5 rounded-full border border-[#E2E8F0] shadow-2xs shrink-0">
              <span
                className={`text-xs font-mono font-extrabold ${
                  isFull
                    ? 'text-rose-600'
                    : isAlmost
                    ? 'text-amber-600'
                    : 'text-[#004AC6]'
                }`}
              >
                {totalCount}/{MAX_DIRECTORIES}
              </span>
              <div className="w-20 sm:w-28 bg-slate-200/70 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isFull
                      ? 'bg-rose-600'
                      : isAlmost
                      ? 'bg-amber-500'
                      : 'bg-[#004AC6]'
                  }`}
                  style={{
                    width: `${Math.min(100, (totalCount / MAX_DIRECTORIES) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Add Folder Directory Button */}
            {canModifyDrive && (
              <PrimaryButton
                size="md"
                pill
                leftIcon={<FolderPlus className="w-4 h-4" />}
                onClick={handleOpenCreate}
                disabled={isFull}
                title={
                  isFull
                    ? `Maximum limit of ${MAX_DIRECTORIES} drive directories reached`
                    : 'Add Folder Directory'
                }
                className="shrink-0 justify-center"
              >
                Add Folder Directory
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. DIRECTORY CARDS GRID */}
        {/* ========================================================================= */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-2xl"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/3"></div>
                  </div>
                </div>
                <div className="h-10 bg-slate-100 rounded-2xl"></div>
                <div className="h-12 bg-slate-100 rounded-2xl"></div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="h-14 bg-slate-100 rounded-2xl"></div>
                  <div className="h-14 bg-slate-100 rounded-2xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredDirectories.length === 0 ? (
          <GeneralCard className="p-12 text-center flex flex-col items-center justify-center border-[#E2E8F0]">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-[#004AC6] mb-3 border border-blue-200/60">
              <FolderOpen className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-[#1E293B]">No Drive Directories Found</h3>
            <p className="text-xs sm:text-sm text-[#505F76] mt-1 max-w-md">
              {searchQuery
                ? 'No directory matches the search keywords.'
                : 'There are currently no Google Drive folders registered. Add your first directory link below.'}
            </p>
            {canModifyDrive && (
              <div className="mt-5">
                <PrimaryButton
                  size="md"
                  pill
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={handleOpenCreate}
                >
                  Add First Folder Directory
                </PrimaryButton>
              </div>
            )}
          </GeneralCard>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {paginatedDirectories.map((item) => (
                <DirectoryCard
                  key={item.id}
                  item={item}
                  isOwner={canUserModify(item)}
                  isCopied={copiedId === item.id}
                  onCopy={handleCopyLink}
                  onEdit={handleOpenEdit}
                  onDelete={handlePromptDelete}
                />
              ))}
            </div>

            {/* ===================================================================== */}
            {/* PAGINATION CONTROLS (4 MAX PER PAGE) */}
            {/* ===================================================================== */}
            {filteredDirectories.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 px-2">
                <span className="text-xs font-medium text-[#505F76]">
                  Showing <strong className="text-[#1E293B] font-semibold">{Math.min(filteredDirectories.length, (safeCurrentPage - 1) * itemsPerPage + 1)}</strong> to{' '}
                  <strong className="text-[#1E293B] font-semibold">{Math.min(filteredDirectories.length, safeCurrentPage * itemsPerPage)}</strong> of{' '}
                  <strong className="text-[#1E293B] font-semibold">{filteredDirectories.length}</strong> {filteredDirectories.length === 1 ? 'route directory' : 'route directories'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-bold text-[#1E293B] px-2 font-mono">
                    Page {safeCurrentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={safeCurrentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. CREATE / EDIT DIRECTORY MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden z-10 my-8"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#004AC6] flex items-center justify-center border border-blue-200/60">
                    {editingId ? <Edit2 className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#1E293B]">
                      {editingId ? 'Edit Drive Directory' : 'Add Google Drive Directory'}
                    </h3>
                    <p className="text-xs text-[#505F76]">
                      Register a cloud folder link and quick notes for specific route indexing.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSave} className="p-6 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] uppercase tracking-wider mb-1.5">
                    Title of Folder <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Daily Consolidated Operations Logs 2026"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-2.5 px-4 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  />
                </div>

                {/* Google Drive Link */}
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] uppercase tracking-wider mb-1.5">
                    Google Drive Link / URL <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <LinkIcon className="w-4 h-4 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="url"
                      required
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-2.5 pl-11 pr-4 text-sm text-[#1E293B] font-mono placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                    />
                  </div>
                </div>

                {/* Quick Notes / Description (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                      Quick Notes & Specific Route Details
                    </label>
                    <span className="text-[11px] font-semibold text-[#757680]">(Optional)</span>
                  </div>
                  <textarea
                    rows={4}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Enter optional quick notes regarding this specific folder, contents, access route, or relevant operational protocols..."
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all resize-none"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
                  <SecondaryButton
                    size="md"
                    pill
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </SecondaryButton>

                  <PrimaryButton
                    size="md"
                    pill
                    type="submit"
                    disabled={isSubmitting}
                    leftIcon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  >
                    {isSubmitting ? 'Saving...' : editingId ? 'Update Directory' : 'Save Directory'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6. DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deletingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setDeletingItem(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#E2E8F0] z-10 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-[#1E293B]">Remove Drive Directory?</h3>
                <p className="text-xs text-[#505F76]">
                  Are you sure you want to remove &quot;{deletingItem.title}&quot;? The actual Google Drive folder itself will remain untouched in your Google Drive cloud.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <SecondaryButton
                  size="md"
                  pill
                  onClick={() => setDeletingItem(null)}
                  disabled={isSubmitting}
                  className="flex-1 justify-center"
                >
                  Cancel
                </SecondaryButton>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmDelete}
                  className="flex-1 px-5 py-2.5 rounded-full bg-rose-600 text-white text-xs sm:text-sm font-bold hover:bg-rose-700 transition-all cursor-pointer justify-center flex items-center gap-1.5 shadow-sm"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Route'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-[#1E293B] text-white px-5 py-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 max-w-md"
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                toastNotification.type === 'error'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {toastNotification.type === 'error' ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-white">{toastNotification.message}</p>
              {toastNotification.submessage && (
                <p className="text-[11px] text-slate-300 mt-0.5">{toastNotification.submessage}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
