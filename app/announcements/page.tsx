'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  X,
  Lock,
  Save,
  AlertCircle,
  Bold,
  List,
  ListOrdered,
  Eye,
  FileText,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { GeneralCard } from '@/components/card';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';

export interface Announcement {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  rawCreatedAt?: string;
  createdBy: string;
  createdById: string;
  updatedBy?: string | null;
  updatedById?: string | null;
  updatedAt?: string | null;
  rawUpdatedAt?: string | null;
}

// Truncation limit in words for card previews
const WORD_LIMIT = 24;

// Extracts clean plain text from HTML
function getPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Checks if description exceeds word limit
function checkIsTruncated(html: string, limit = WORD_LIMIT): boolean {
  const plain = getPlainText(html);
  const words = plain.split(/\s+/).filter(Boolean);
  return words.length > limit;
}

// Formats timestamp into standard military/civilian format: "Sep 06, 2026 · 14:00H"
function formatAnnouncementDate(dateStr: string | null | undefined): string {
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

// Maps Supabase database row to frontend Announcement object
function mapAnnouncementRow(row: any, fallbackName?: string): Announcement {
  const creatorProfile = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  const updaterProfile = Array.isArray(row.updater) ? row.updater[0] : row.updater;

  const createdByName =
    creatorProfile?.full_name ||
    (creatorProfile?.email ? creatorProfile.email.split('@')[0] : null) ||
    row.created_by_name ||
    fallbackName ||
    'Monitoring Officer';

  const updatedByName =
    updaterProfile?.full_name ||
    (updaterProfile?.email ? updaterProfile.email.split('@')[0] : null) ||
    row.updated_by_name ||
    null;

  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    createdAt: formatAnnouncementDate(row.created_at),
    rawCreatedAt: row.created_at,
    createdBy: createdByName,
    createdById: row.created_by || '',
    updatedBy: updatedByName,
    updatedById: row.updated_by || null,
    updatedAt:
      row.updated_at && row.updated_at !== row.created_at
        ? formatAnnouncementDate(row.updated_at)
        : null,
    rawUpdatedAt: row.updated_at || null,
  };
}

// Sanitizes HTML to ensure safe display while converting markdown if legacy
function sanitizeHtml(html: string): string {
  if (!html) return '';
  let formatted = html;

  // If text lacks HTML tags, convert basic markdown to HTML for backwards compatibility
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    formatted = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return `<li>${trimmed.slice(2)}</li>`;
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          return `<li>${trimmed.replace(/^\d+\.\s+/, '')}</li>`;
        }
        return trimmed ? `<p>${trimmed}</p>` : '';
      })
      .join('');
    formatted = formatted.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
  }

  // Strip harmful tags / attributes
  return formatted
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:[^"']*/gi, '');
}

export default function AnnouncementsPage() {
  const { user, profile, isAdmin } = useAuth();

  // Data & Loading States
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Viewing Full Content
  const [viewingAnnouncement, setViewingAnnouncement] = useState<Announcement | null>(null);

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [activeModalTab, setActiveModalTab] = useState<'write' | 'preview'>('write');

  // WYSIWYG ContentEditable ref
  const editorRef = useRef<HTMLDivElement>(null);

  // Formatting state indicators
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isBulletActive, setIsBulletActive] = useState(false);
  const [isNumberedActive, setIsNumberedActive] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast notification
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    submessage?: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Check if current user has permission to edit or delete a specific announcement
  const canUserModify = useCallback(
    (item: Announcement) => {
      if (isAdmin) return true;
      const currentId = user?.id || profile?.id;
      return !!currentId && (item.createdById === currentId || item.createdById === user?.id || item.createdById === profile?.id);
    },
    [isAdmin, user?.id, profile?.id]
  );

  // 1. Fetch Dynamic Announcements from Supabase
  const fetchAnnouncements = useCallback(
    async (isInitial = false) => {
      if (isInitial) setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*, creator:created_by(id, full_name, email, role), updater:updated_by(id, full_name, email, role)')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading announcements:', error);
          showToast('Failed to load announcements', error.message, 'error');
          return;
        }

        if (data) {
          const mapped = data.map((row: any) => mapAnnouncementRow(row));
          setAnnouncements(mapped);
        }
      } catch (err: any) {
        console.error('Unexpected error fetching announcements:', err);
        showToast('Failed to load announcements', err.message, 'error');
      } finally {
        if (isInitial) setIsLoading(false);
      }
    },
    [showToast]
  );

  // 2. Realtime Subscription & Initial Load
  useEffect(() => {
    fetchAnnouncements(true);

    const channel = supabase
      .channel('realtime-announcements-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          fetchAnnouncements(false);
        }
      )
      .subscribe();

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchAnnouncements]);

  // Check active formatting state in editor
  const checkActiveCommands = useCallback(() => {
    if (typeof document !== 'undefined') {
      try {
        setIsBoldActive(document.queryCommandState('bold'));
        setIsBulletActive(document.queryCommandState('insertUnorderedList'));
        setIsNumberedActive(document.queryCommandState('insertOrderedList'));
      } catch {
        // Ignore in environments where queryCommandState is restricted
      }
    }
  }, []);

  // Synchronize ContentEditable editor innerHTML with formDescription
  useEffect(() => {
    if (isModalOpen && activeModalTab === 'write' && editorRef.current) {
      if (editorRef.current.innerHTML !== formDescription) {
        editorRef.current.innerHTML = formDescription || '';
      }
      checkActiveCommands();
    }
  }, [isModalOpen, activeModalTab, formDescription, checkActiveCommands]);

  // Execute native rich-text command in contentEditable
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (typeof document !== 'undefined') {
      if (editorRef.current) {
        editorRef.current.focus();
      }
      document.execCommand(command, false, value);
      if (editorRef.current) {
        setFormDescription(editorRef.current.innerHTML);
        checkActiveCommands();
      }
    }
  };

  // Filtered Announcements based on search query
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      const q = searchQuery.toLowerCase();
      const plainText = getPlainText(item.description).toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        plainText.includes(q) ||
        item.createdBy.toLowerCase().includes(q)
      );
    });
  }, [announcements, searchQuery]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDescription('');
    setActiveModalTab('write');
    setIsModalOpen(true);
  };

  // Open Edit Modal (Allowed for creator or admin)
  const handleOpenEdit = (item: Announcement) => {
    if (!canUserModify(item)) {
      showToast(
        'Permission Denied',
        `Only the creator (${item.createdBy}) or Admin can edit this announcement.`,
        'error'
      );
      return;
    }
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormDescription(item.description);
    setActiveModalTab('write');
    if (viewingAnnouncement) setViewingAnnouncement(null);
    setIsModalOpen(true);
  };

  // Save (Create or Update) to Supabase Database
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const plainDesc = getPlainText(formDescription);
    if (!formTitle.trim() || !plainDesc.trim()) {
      showToast('Validation Error', 'Please provide both a title and description.', 'error');
      return;
    }

    const currentUserId = user?.id || profile?.id;
    const currentUserName =
      profile?.full_name ||
      user?.user_metadata?.full_name ||
      user?.email?.split('@')[0] ||
      'Monitoring Officer';

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
        // Edit existing announcement
        const { data, error } = await supabase
          .from('announcements')
          .update({
            title: formTitle.trim(),
            description: formDescription,
            updated_by: currentUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
          .select('*, creator:created_by(id, full_name, email, role), updater:updated_by(id, full_name, email, role)')
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const updated = mapAnnouncementRow(data, currentUserName);
          setAnnouncements((prev) =>
            prev.map((item) => (item.id === editingId ? updated : item))
          );
          if (viewingAnnouncement?.id === editingId) {
            setViewingAnnouncement(updated);
          }
        }

        showToast(
          'Announcement Updated',
          'Changes have been saved and broadcast to all terminals.',
          'success'
        );
      } else {
        // Create new announcement
        const { data, error } = await supabase
          .from('announcements')
          .insert({
            title: formTitle.trim(),
            description: formDescription,
            created_by: currentUserId,
          })
          .select('*, creator:created_by(id, full_name, email, role), updater:updated_by(id, full_name, email, role)')
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const created = mapAnnouncementRow(data, currentUserName);
          setAnnouncements((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
        }

        showToast(
          'Announcement Published',
          'New bulletin is now live for all duty personnel.',
          'success'
        );
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save announcement:', err);
      showToast(
        'Save Failed',
        err.message || 'Could not save announcement. Please verify your permissions.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Announcement Handler
  const handleDelete = async (id: string) => {
    const item = announcements.find((a) => a.id === id);
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

      if (error) {
        throw error;
      }

      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      if (viewingAnnouncement?.id === id) {
        setViewingAnnouncement(null);
      }
      setDeletingId(null);
      showToast('Announcement Removed', 'The bulletin has been permanently deleted.', 'success');
    } catch (err: any) {
      console.error('Failed to delete announcement:', err);
      showToast(
        'Delete Failed',
        err.message || 'Could not delete announcement. Please check permissions.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if contentEditable has empty text
  const isEditorEmpty =
    !formDescription ||
    formDescription === '<br>' ||
    formDescription === '<p><br></p>' ||
    getPlainText(formDescription) === '';

  return (
    <AppLayoutShell title="Announcements" subtitle="Official Broadcasts & Bulletins">
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* ========================================================================= */}
        {/* 1. HEADER & CONTROLS */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchAnnouncements(true)}
              title="Refresh Announcements"
              className="p-2.5 text-[#505F76] hover:text-[#004AC6] hover:bg-slate-100 rounded-full transition-colors border border-[#E2E8F0] shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#004AC6]' : ''}`} />
            </button>
            <PrimaryButton
              size="md"
              pill
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenCreate}
            >
              Post Announcement
            </PrimaryButton>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. SEARCH BAR */}
        {/* ========================================================================= */}
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
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 text-[#94A3B8] hover:text-[#1E293B] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 3. ANNOUNCEMENTS LIST */}
        {/* ========================================================================= */}
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
              {!searchQuery && (
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
              const isTruncated = checkIsTruncated(item.description);

              return (
                <GeneralCard
                  key={item.id}
                  className="p-5 sm:p-6 border-[#E2E8F0] shadow-xs hover:border-[#CBD5E1] transition-all cursor-pointer group"
                  onClick={() => setViewingAnnouncement(item)}
                >
                  <div className="flex flex-col gap-3">
                    {/* Header Row: Title & Action Controls */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h2 className="text-base sm:text-lg font-bold text-[#1E293B] group-hover:text-[#004AC6] transition-colors tracking-tight">
                          {item.title}
                        </h2>
                      </div>

                      {/* Action Buttons (Only for creator or Admin) */}
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isOwner ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              title="Edit Announcement"
                              className="p-2 text-[#505F76] hover:text-[#004AC6] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(item.id)}
                              title="Delete Announcement"
                              className="p-2 text-[#505F76] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span
                            title="Read only: Created by another officer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#757680] bg-slate-100 px-2.5 py-0.5 rounded-full"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Read only</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rich Formatted Preview Description */}
                    <div>
                      <div
                        className="text-sm text-[#334155] leading-relaxed line-clamp-3 space-y-1 [&_strong]:font-bold [&_b]:font-bold [&_strong]:text-[#0F172A] [&_b]:text-[#0F172A] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_p]:my-0.5"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }}
                      />
                      {isTruncated && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingAnnouncement(item);
                          }}
                          className="mt-2 text-xs font-semibold text-[#004AC6] hover:text-[#003594] transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          Read full announcement →
                        </button>
                      )}
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 mt-1 border-t border-[#F1F5F9] text-xs text-[#757680]">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#004AC6]" />
                        <span>
                          Created by <strong className="text-[#1E293B] font-semibold">{item.createdBy}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#757680]" />
                        <span>{item.createdAt}</span>
                      </div>

                      {item.updatedBy && item.updatedAt && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#004AC6] font-medium bg-blue-50 px-2.5 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          <span>
                            Updated by {item.updatedBy} · {item.updatedAt}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </GeneralCard>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. CREATE / EDIT MODAL WITH WYSIWYG RICH TEXT FORMATTING */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-[#004AC6]" />
                  <h3 className="text-base font-bold text-[#1E293B]">
                    {editingId ? 'Edit Announcement' : 'New Announcement'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="text-[#757680] hover:text-[#1E293B] p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Title */}
                <div className="space-y-1.5">
                  <label htmlFor="anc-title" className="text-xs font-bold text-[#505F76]">
                    Announcement Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="anc-title"
                    type="text"
                    required
                    disabled={isSubmitting}
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Typhoon Advisory or Station Protocol Update"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl py-2.5 px-3.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all disabled:opacity-60"
                  />
                </div>

                {/* Rich WYSIWYG Description & Toolbar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#505F76]">
                      Description & Content <span className="text-rose-500">*</span>
                    </label>

                    {/* Write / Preview Tab Switcher */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setActiveModalTab('write')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                          activeModalTab === 'write'
                            ? 'bg-white text-[#004AC6] shadow-2xs font-semibold'
                            : 'text-[#757680] hover:text-[#1E293B]'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveModalTab('preview')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                          activeModalTab === 'preview'
                            ? 'bg-white text-[#004AC6] shadow-2xs font-semibold'
                            : 'text-[#757680] hover:text-[#1E293B]'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </button>
                    </div>
                  </div>

                  {activeModalTab === 'write' ? (
                    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden focus-within:border-[#004AC6] focus-within:ring-2 focus-within:ring-[#004AC6]/15 transition-all bg-[#F8FAFC]">
                      {/* Document Formatting Toolbar */}
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-100/70 border-b border-[#E2E8F0]">
                        <div className="flex items-center gap-1">
                          {/* WYSIWYG Bold Button */}
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              executeCommand('bold');
                            }}
                            title="Make selection bold (Ctrl+B)"
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                              isBoldActive
                                ? 'bg-[#004AC6] text-white shadow-xs'
                                : 'text-[#334155] hover:bg-white hover:text-[#004AC6] hover:shadow-2xs'
                            }`}
                          >
                            <Bold className="w-3.5 h-3.5" />
                            <span>Bold</span>
                          </button>

                          <div className="w-px h-4 bg-[#CBD5E1] mx-1" />

                          {/* WYSIWYG Bullet List Button */}
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              executeCommand('insertUnorderedList');
                            }}
                            title="Insert Bullet List"
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                              isBulletActive
                                ? 'bg-[#004AC6] text-white shadow-xs font-semibold'
                                : 'text-[#334155] hover:bg-white hover:text-[#004AC6] hover:shadow-2xs'
                            }`}
                          >
                            <List className="w-3.5 h-3.5" />
                            <span>Bullet List</span>
                          </button>

                          {/* WYSIWYG Numbered List Button */}
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              executeCommand('insertOrderedList');
                            }}
                            title="Insert Numbered List"
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                              isNumberedActive
                                ? 'bg-[#004AC6] text-white shadow-xs font-semibold'
                                : 'text-[#334155] hover:bg-white hover:text-[#004AC6] hover:shadow-2xs'
                            }`}
                          >
                            <ListOrdered className="w-3.5 h-3.5" />
                            <span>Numbered List</span>
                          </button>
                        </div>

                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#004AC6] font-medium bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          <Sparkles className="w-3 h-3" />
                          <span>Live Rich Text</span>
                        </span>
                      </div>

                      {/* ContentEditable WYSIWYG Editor Area */}
                      <div className="relative">
                        {isEditorEmpty && (
                          <div className="absolute top-3.5 left-3.5 text-sm text-[#94A3B8] pointer-events-none select-none">
                            Type announcement details here... Highlight text and click Bold to format directly.
                          </div>
                        )}
                        <div
                          ref={editorRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(e) => {
                            setFormDescription(e.currentTarget.innerHTML);
                            checkActiveCommands();
                          }}
                          onSelect={checkActiveCommands}
                          onKeyUp={checkActiveCommands}
                          onClick={checkActiveCommands}
                          className="w-full min-h-[160px] max-h-[260px] overflow-y-auto p-3.5 text-sm text-[#1E293B] focus:outline-none leading-relaxed [&_strong]:font-bold [&_b]:font-bold [&_strong]:text-[#0F172A] [&_b]:text-[#0F172A] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_ol]:space-y-1 [&_p]:my-1"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Live Preview Box */
                    <div className="border border-[#E2E8F0] rounded-xl p-4 min-h-[200px] bg-[#F8FAFC]">
                      {formTitle && (
                        <h4 className="text-base font-bold text-[#1E293B] pb-2 mb-3 border-b border-[#E2E8F0]/70">
                          {formTitle}
                        </h4>
                      )}
                      {!isEditorEmpty ? (
                        <div
                          className="text-sm text-[#334155] leading-relaxed space-y-2 [&_strong]:font-bold [&_b]:font-bold [&_strong]:text-[#0F172A] [&_b]:text-[#0F172A] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_ol]:space-y-1 [&_p]:my-1"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(formDescription) }}
                        />
                      ) : (
                        <p className="text-xs text-[#94A3B8] italic">
                          No content written yet. Switch to Write mode to type and format content.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Visual Formatting Hint */}
                  <div className="flex items-center gap-2 text-[11px] text-[#757680] pt-1 px-1">
                    <span>Formatting:</span>
                    <span className="text-[#1E293B] font-semibold">Highlighted text bolds directly in place</span>
                    <span>·</span>
                    <span>Lists render active bullets in the editor</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F1F5F9]">
                  <SecondaryButton
                    type="button"
                    size="md"
                    pill
                    disabled={isSubmitting}
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    type="submit"
                    size="md"
                    pill
                    disabled={isSubmitting}
                    leftIcon={
                      isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )
                    }
                  >
                    {isSubmitting
                      ? 'Saving...'
                      : editingId
                      ? 'Save Changes'
                      : 'Publish'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-sm p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#1E293B]">Delete Announcement?</h3>
              <p className="text-xs text-[#505F76] mt-1 mb-5">
                Are you sure you want to remove this bulletin? This action cannot be undone.
              </p>
              <div className="flex items-center justify-center gap-2.5">
                <SecondaryButton
                  size="md"
                  pill
                  disabled={isSubmitting}
                  onClick={() => setDeletingId(null)}
                >
                  Cancel
                </SecondaryButton>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDelete(deletingId)}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-full shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Confirm Delete</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6. VIEW FULL ANNOUNCEMENT MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {viewingAnnouncement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[88vh]"
            >
              {/* Header */}
              <div className="flex items-start justify-between p-5 sm:p-6 border-b border-[#E2E8F0] bg-slate-50/50">
                <div className="flex items-start gap-3 pr-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004AC6] flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-[#004AC6] uppercase tracking-wider">
                      Official Announcement
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold text-[#1E293B] mt-0.5 leading-snug">
                      {viewingAnnouncement.title}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingAnnouncement(null)}
                  className="text-[#757680] hover:text-[#1E293B] p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content Body with Document Formatting */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
                {/* Formatted Description */}
                <div>
                  <h4 className="text-xs font-bold text-[#757680] uppercase tracking-wider mb-2">
                    Announcement Details
                  </h4>
                  <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                    <div
                      className="text-sm text-[#334155] leading-relaxed space-y-2 [&_strong]:font-bold [&_b]:font-bold [&_strong]:text-[#0F172A] [&_b]:text-[#0F172A] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1 [&_p]:my-1"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewingAnnouncement.description) }}
                    />
                  </div>
                </div>

                {/* Audit & Author Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-[#E2E8F0]/60 space-y-1">
                    <span className="text-[#757680] font-medium flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#004AC6]" /> Posted by
                    </span>
                    <p className="font-bold text-[#1E293B] pl-5">{viewingAnnouncement.createdBy}</p>
                    <p className="text-[11px] text-[#757680] pl-5 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" /> {viewingAnnouncement.createdAt}
                    </p>
                  </div>

                  {viewingAnnouncement.updatedBy && viewingAnnouncement.updatedAt ? (
                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                      <span className="text-[#004AC6] font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#004AC6]" /> Last Modified
                      </span>
                      <p className="font-bold text-[#1E293B] pl-5">
                        {viewingAnnouncement.updatedBy}
                      </p>
                      <p className="text-[11px] text-[#505F76] pl-5 mt-0.5">
                        {viewingAnnouncement.updatedAt}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl border border-[#E2E8F0]/60 flex items-center text-[#757680]">
                      <span className="text-[11px] italic">No revisions recorded</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-t border-[#E2E8F0] bg-slate-50/50">
                <div>
                  {canUserModify(viewingAnnouncement) ? (
                    <SecondaryButton
                      size="sm"
                      pill
                      leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      onClick={() => handleOpenEdit(viewingAnnouncement)}
                    >
                      Edit Announcement
                    </SecondaryButton>
                  ) : (
                    <span className="text-xs text-[#757680] flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Read only access
                    </span>
                  )}
                </div>

                <PrimaryButton
                  size="md"
                  pill
                  onClick={() => setViewingAnnouncement(null)}
                >
                  Close
                </PrimaryButton>
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
