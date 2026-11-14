'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Tag,
  Plus,
  Search,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton } from '@/components/button';
import { SummaryCard } from '@/components/card';
import { Skeleton } from '@/components/skeleton';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import {
  getCachedLogSettingsScreenData,
  setCachedLogSettingsScreenData,
  patchCachedLogSettingsScreenData,
} from '@/lib/cache/screen-data-cache';
import ReportTypeRow from './_components/report-type-row';
import {
  type ReportTypeItem,
  type RawDbReportTypeRow,
  formatProfileRole,
  mapDbReportTypeRow,
  computeReportTypesSignature,
} from './_components/types';

export type { ReportTypeItem } from './_components/types';

const ViewReportTypeDrawer = dynamic(
  () => import('./_components/view-report-type-drawer'),
  { ssr: false }
);
const ReportTypeFormModal = dynamic(
  () => import('./_components/report-type-form-modal'),
  { ssr: false }
);
const DeleteReportTypeModal = dynamic(
  () => import('./_components/delete-report-type-modal'),
  { ssr: false }
);

const REPORT_TYPES_SELECT = `
  *,
  creator:created_by(id, full_name, email, position_title, role),
  updater:updated_by(id, full_name, email, position_title, role)
`;

const SEARCH_DEBOUNCE_MS = 200;
const REALTIME_DEBOUNCE_MS = 350;

// =============================================================================
// SKELETON PLACEHOLDERS
// =============================================================================
function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="rounded" className="h-3.5 w-36" />
          <Skeleton variant="rounded" className="h-8 w-16" />
          <Skeleton variant="rounded" className="h-3 w-40" />
        </div>
        <Skeleton variant="rounded" className="w-14 h-14 rounded-2xl" />
      </div>
    </div>
  );
}

function ReportTypesTableSkeleton() {
  return (
    <div className="w-full divide-y divide-[#E2E8F0]">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between py-4 px-6 gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton variant="circular" className="w-3 h-3 shrink-0" />
            <Skeleton variant="rounded" className="h-4 w-44" />
          </div>
          <div className="w-36">
            <Skeleton variant="rounded" className="h-5 w-24 rounded-md" />
          </div>
          <div className="flex-1">
            <Skeleton variant="rounded" className="h-3.5 w-32" />
          </div>
          <div className="w-12 flex justify-end">
            <Skeleton variant="circular" className="w-8 h-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LogSettingsPage() {
  const { user, profile, canWrite } = useAuth();
  const canModifySettings = canWrite('Settings');

  const currentUserId = user?.id || profile?.id || '';
  const currentUserName =
    profile?.full_name?.trim() ||
    (typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name.trim()
      : '') ||
    (user?.email ? user.email.split('@')[0] : '') ||
    'Authorized User';
  const currentUserRole =
    profile?.position_title?.trim() ||
    formatProfileRole(profile?.role) ||
    'Authorized Personnel';

  const [initialCache] = useState(() => getCachedLogSettingsScreenData());

  const [reportTypes, setReportTypes] = useState<ReportTypeItem[]>(
    () => initialCache?.reportTypes ?? []
  );
  const [isLoading, setIsLoading] = useState(() => !initialCache);
  const [searchQuery, setSearchQuery] = useState(
    () => initialCache?.searchQuery ?? ''
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    () => initialCache?.searchQuery ?? ''
  );

  // Active Dropdown Menu state: item ID or null
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Side Drawer state
  const [viewItem, setViewItem] = useState<ReportTypeItem | null>(null);

  // Add / Edit Modal State (form fields isolated inside ReportTypeFormModal)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReportTypeItem | null>(null);

  // Delete Confirmation State
  const [deleteConfirmItem, setDeleteConfirmItem] =
    useState<ReportTypeItem | null>(null);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const reportTypesSigRef = useRef<string>(initialCache?.signature ?? '');
  const searchQueryRef = useRef<string>(searchQuery);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback(
    (text: string, type: 'success' | 'error' = 'success') => {
      setToastMessage({ text, type });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastMessage(null), 3500);
    },
    []
  );

  // ===========================================================================
  // 1. SEARCH DEBOUNCING (200ms)
  // ===========================================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    patchCachedLogSettingsScreenData({ searchQuery: value });
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    patchCachedLogSettingsScreenData({ searchQuery: '' });
  }, []);

  // ===========================================================================
  // 2. DATA FETCHING (SWR CACHE + SILENT REALTIME & VISIBILITY SYNC)
  // ===========================================================================
  const fetchReportTypes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('report_types')
        .select(REPORT_TYPES_SELECT)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Could not fetch report_types from database:', error.message);
      } else if (data) {
        const mappedTypes = (data as RawDbReportTypeRow[]).map(mapDbReportTypeRow);
        const nextSig = computeReportTypesSignature(mappedTypes);

        if (nextSig !== reportTypesSigRef.current) {
          reportTypesSigRef.current = nextSig;
          setReportTypes(mappedTypes);
          setCachedLogSettingsScreenData({
            reportTypes: mappedTypes,
            searchQuery: searchQueryRef.current,
            signature: nextSig,
            fetchedAt: Date.now(),
          });
        } else {
          patchCachedLogSettingsScreenData({ fetchedAt: Date.now() });
        }
      }
    } catch (err) {
      console.error('Error fetching report_types from database:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let realtimeDebounce: ReturnType<typeof setTimeout> | null = null;

    Promise.resolve().then(() => {
      if (!cancelled) void fetchReportTypes();
    });

    const channel = supabase
      .channel('report-types-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_types' },
        () => {
          if (realtimeDebounce) clearTimeout(realtimeDebounce);
          realtimeDebounce = setTimeout(() => {
            if (!cancelled) void fetchReportTypes();
          }, REALTIME_DEBOUNCE_MS);
        }
      )
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        void fetchReportTypes();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (realtimeDebounce) clearTimeout(realtimeDebounce);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [fetchReportTypes]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Filtered Report Types (debounced)
  const filteredReportTypes = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    if (!query) return reportTypes;
    return reportTypes.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query)
    );
  }, [reportTypes, debouncedSearchQuery]);

  // Stable callbacks for memoized rows
  const handleToggleMenu = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuId((prev) => (prev === id ? null : id));
  }, []);

  const handleViewRow = useCallback((item: ReportTypeItem) => {
    setViewItem(item);
    setActiveMenuId(null);
  }, []);

  const handleOpenEditModal = useCallback(
    (item: ReportTypeItem) => {
      if (!canModifySettings) {
        showToast('Action restricted under View-Only clearance.', 'error');
        return;
      }
      setEditingItem(item);
      setIsAddModalOpen(true);
      setActiveMenuId(null);
      setViewItem(null);
    },
    [canModifySettings, showToast]
  );

  const handleDeleteRow = useCallback((item: ReportTypeItem) => {
    setDeleteConfirmItem(item);
    setActiveMenuId(null);
  }, []);

  // ===========================================================================
  // 3. MODAL & CRUD HANDLERS
  // ===========================================================================
  const handleOpenAddModal = useCallback(() => {
    if (!canModifySettings) {
      showToast('Action restricted under View-Only clearance.', 'error');
      return;
    }
    setEditingItem(null);
    setIsAddModalOpen(true);
    setActiveMenuId(null);
  }, [canModifySettings, showToast]);

  const handleSaveItem = useCallback(
    async ({ name, color }: { name: string; color: string }): Promise<boolean> => {
      if (!canModifySettings) {
        showToast('Action restricted under View-Only clearance.', 'error');
        return false;
      }
      if (!name.trim()) return false;

      const trimmedName = name.trim();

      try {
        if (editingItem) {
          const updatePayload: Record<string, string | null> = {
            name: trimmedName,
            color,
            updated_by: currentUserId || null,
          };

          const { data, error } = await supabase
            .from('report_types')
            .update(updatePayload)
            .eq('id', editingItem.id)
            .select(REPORT_TYPES_SELECT)
            .maybeSingle();

          if (error) {
            console.warn(
              'Database update error, updating locally:',
              error.message
            );
          }

          const updatedItem: ReportTypeItem = data
            ? mapDbReportTypeRow(data as RawDbReportTypeRow)
            : {
                ...editingItem,
                name: trimmedName,
                color,
                updatedAt: 'Just now',
                updatedBy: currentUserName,
                updatedById: currentUserId || editingItem.updatedById || null,
                updatedByRole: currentUserRole,
              };

          setReportTypes((prev) => {
            const next = prev.map((item) =>
              item.id === editingItem.id ? updatedItem : item
            );
            const sig = computeReportTypesSignature(next);
            reportTypesSigRef.current = sig;
            setCachedLogSettingsScreenData({
              reportTypes: next,
              searchQuery: searchQueryRef.current,
              signature: sig,
              fetchedAt: Date.now(),
            });
            return next;
          });

          setViewItem((prev) => (prev?.id === editingItem.id ? updatedItem : prev));
          showToast(`Report type "${trimmedName}" updated successfully.`);
          return true;
        }

        const generatedCode =
          trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
          `rpt-${Date.now()}`;

        const insertPayload = {
          code: generatedCode,
          name: trimmedName,
          color,
          version: 'v1.0',
          is_active: true,
          created_by: currentUserId || null,
          updated_by: currentUserId || null,
        };

        const { data, error } = await supabase
          .from('report_types')
          .insert([insertPayload])
          .select(REPORT_TYPES_SELECT)
          .maybeSingle();

        if (error) {
          console.warn('Database insert error, adding locally:', error.message);
        }

        const newReport: ReportTypeItem = data
          ? mapDbReportTypeRow(data as RawDbReportTypeRow)
          : {
              id: `rpt-${Date.now()}`,
              code: `RPT-CUST-${String(reportTypes.length + 1).padStart(3, '0')}`,
              name: trimmedName,
              color,
              version: 'v1.0',
              createdAt: 'Just now',
              createdBy: currentUserName,
              createdById: currentUserId || null,
              createdByRole: currentUserRole,
              updatedAt: 'Just now',
              updatedBy: currentUserName,
              updatedById: currentUserId || null,
              updatedByRole: currentUserRole,
            };

        setReportTypes((prev) => {
          const next = [...prev, newReport];
          const sig = computeReportTypesSignature(next);
          reportTypesSigRef.current = sig;
          setCachedLogSettingsScreenData({
            reportTypes: next,
            searchQuery: searchQueryRef.current,
            signature: sig,
            fetchedAt: Date.now(),
          });
          return next;
        });

        showToast(`Report type "${trimmedName}" added successfully.`);
        return true;
      } catch (err) {
        console.error('Error saving report type:', err);
        showToast('Failed to save report type.', 'error');
        return false;
      }
    },
    [
      canModifySettings,
      editingItem,
      currentUserId,
      currentUserName,
      currentUserRole,
      reportTypes.length,
      showToast,
    ]
  );

  const handleConfirmDelete = useCallback(
    async (itemToDelete: ReportTypeItem) => {
      if (!canModifySettings) {
        showToast('Action restricted under View-Only clearance.', 'error');
        return;
      }
      const { id, name } = itemToDelete;

      try {
        const { error } = await supabase.from('report_types').delete().eq('id', id);

        if (error) {
          console.warn('Database delete error, removing locally:', error.message);
        }

        setReportTypes((prev) => {
          const next = prev.filter((item) => item.id !== id);
          const sig = computeReportTypesSignature(next);
          reportTypesSigRef.current = sig;
          setCachedLogSettingsScreenData({
            reportTypes: next,
            searchQuery: searchQueryRef.current,
            signature: sig,
            fetchedAt: Date.now(),
          });
          return next;
        });

        setViewItem((prev) => (prev?.id === id ? null : prev));
        showToast(`Report type "${name}" removed.`);
      } catch (err) {
        console.error('Error deleting report type:', err);
        showToast('Failed to delete report type.', 'error');
      } finally {
        setDeleteConfirmItem(null);
        setActiveMenuId(null);
      }
    },
    [canModifySettings, showToast]
  );

  return (
    <AppLayoutShell
      title="Report Types"
      subtitle="Manage incident classifications and dispatch advisory categories."
    >
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* =================================================================== */}
        {/* 1. PAGE HEADER & ACTION BAR                                         */}
        {/* =================================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs uppercase tracking-wider text-[#004AC6] font-bold bg-[#004AC6]/10 border border-[#004AC6]/20 px-2.5 py-0.5 rounded-full">
                System Governance
              </span>
              <span className="text-slate-300 text-xs">•</span>
              <span className="text-xs text-[#505F76] font-medium">
                Node Policy #4012
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
              Report Types
            </h1>
            <p className="text-sm sm:text-base text-[#505F76] mt-1 font-medium">
              Manage report categories, classification badges, and dispatch advisory
              indicator colors across MLS telemetric feeds.
            </p>
          </div>

          {canModifySettings && (
            <div className="flex items-center gap-3 shrink-0">
              <PrimaryButton
                size="md"
                pill
                onClick={handleOpenAddModal}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add Report Type
              </PrimaryButton>
            </div>
          )}
        </div>

        {/* View-Only Banner */}
        <ViewOnlyNotice
          screen="Settings"
          message="Report type classifications and incident category codes are presented in read-only audit mode."
        />

        {/* =================================================================== */}
        {/* 2. SUMMARY KPI SECTION                                              */}
        {/* =================================================================== */}
        {isLoading ? (
          <SummaryCardsSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SummaryCard
              title="TOTAL REPORT TYPES ADDED"
              value={reportTypes.length}
              change="Active Categories"
              changeType="positive"
              subtitle="Standard category classifications"
              icon={<Tag className="w-6 h-6 text-[#004AC6]" />}
              iconBg="bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15"
              ambientColor="bg-[#004AC6]/5"
            />
          </div>
        )}

        {/* =================================================================== */}
        {/* 3. MAIN CARD: REPORT TYPES                                          */}
        {/* =================================================================== */}
        <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col">
          {/* Header & Search Toolbar */}
          <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 flex items-center justify-center text-[#004AC6] border border-[#004AC6]/15 shrink-0">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1E293B]">Report Types</h2>
                <p className="text-xs text-[#757680]">
                  Standard category classifications for MLS incident logs
                </p>
              </div>
            </div>

            {/* Search Input (Debounced 200ms) */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search report types..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 pl-10 pr-9 text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#1E293B] hover:bg-slate-200/70 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Items List Table */}
          <div className="overflow-x-auto min-h-[280px]">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-[#F8FAFC]/80 border-b border-[#E2E8F0] text-[#505F76] text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-6">Classification Name</th>
                  <th className="py-3.5 px-6 w-36">Code</th>
                  <th className="py-3.5 px-6">Last Updated</th>
                  <th className="py-3.5 px-6 text-right w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm font-medium text-[#1E293B]">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <ReportTypesTableSkeleton />
                    </td>
                  </tr>
                ) : reportTypes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 px-6 text-center">
                      <div className="flex flex-col items-center justify-center gap-4 max-w-md mx-auto">
                        <div className="w-14 h-14 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/20">
                          <Tag className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-[#1E293B]">
                            No Report Types Configured Yet
                          </h3>
                          <p className="text-xs text-[#757680] leading-relaxed">
                            Start from scratch by creating custom report classifications
                            and assigning indicator colors.
                          </p>
                        </div>
                        {canModifySettings && (
                          <PrimaryButton
                            size="sm"
                            pill
                            onClick={handleOpenAddModal}
                            leftIcon={<Plus className="w-4 h-4" />}
                          >
                            Add First Report Type
                          </PrimaryButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : filteredReportTypes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-[#757680]">
                      <Tag className="w-8 h-8 mx-auto text-slate-300 mb-2 opacity-50" />
                      <p className="font-semibold text-sm text-[#505F76]">
                        No matching report types found
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        Try adjusting your search query or add a new report type.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredReportTypes.map((item) => (
                    <ReportTypeRow
                      key={item.id}
                      item={item}
                      isMenuOpen={activeMenuId === item.id}
                      canModify={canModifySettings}
                      onToggleMenu={handleToggleMenu}
                      onView={handleViewRow}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDeleteRow}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-[#E2E8F0] bg-[#F8FAFC]/50 flex justify-between items-center text-xs text-[#757680]">
            <span>
              Showing{' '}
              <span className="font-bold text-[#1E293B]">
                {filteredReportTypes.length}
              </span>{' '}
              of{' '}
              <span className="font-bold text-[#1E293B]">{reportTypes.length}</span>{' '}
              total report types
            </span>
            <span className="text-[11px] text-[#94A3B8]">
              Standard System Classification
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. LAZY SIDE DRAWER (VIEW REPORT TYPE DETAILS)                        */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {viewItem && (
          <ViewReportTypeDrawer
            key={viewItem.id}
            item={viewItem}
            canModify={canModifySettings}
            onClose={() => setViewItem(null)}
            onEdit={handleOpenEditModal}
            onRequestDelete={(item) => setDeleteConfirmItem(item)}
          />
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 5. LAZY ADD / EDIT MODAL (ISOLATED FORM STATE)                        */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isAddModalOpen && (
          <ReportTypeFormModal
            key={editingItem?.id ?? 'create-report-type'}
            editingItem={editingItem}
            onClose={() => {
              setIsAddModalOpen(false);
              setEditingItem(null);
            }}
            onSubmit={handleSaveItem}
          />
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 6. LAZY CONFIRM DELETE MODAL                                          */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {deleteConfirmItem && (
          <DeleteReportTypeModal
            key={deleteConfirmItem.id}
            item={deleteConfirmItem}
            onClose={() => setDeleteConfirmItem(null)}
            onConfirm={handleConfirmDelete}
          />
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 7. TOAST NOTIFICATION POPUP                                           */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-rose-600 text-white border-rose-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-200" />
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
