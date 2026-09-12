'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tag,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  X,
  Plus,
  Calendar,
  Clock,
  ShieldCheck,
  Activity,
  Search,
  AlertTriangle,
  Check,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { SummaryCard } from '@/components/card';
import { Skeleton } from '@/components/skeleton';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';

export interface ReportTypeItem {
  id: string;
  code: string;
  name: string;
  color: string;
  version: string;
  createdAt: string;
  createdBy: string;
  createdByRole: string;
  updatedAt: string;
  updatedBy: string;
  updatedByRole: string;
}

const COLOR_OPTIONS = [
  { color: '#004AC6', name: 'Primary Blue' },
  { color: '#BA1A1A', name: 'Critical Red' },
  { color: '#F59E0B', name: 'Warning Amber' },
  { color: '#10B981', name: 'Active Green' },
  { color: '#8B5CF6', name: 'Purple' },
  { color: '#505F76', name: 'Slate Gray' },
];

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

// Helper: Format date string to display format
const formatDateDisplay = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

export default function LogSettingsPage() {
  const { canWrite, isViewOnly } = useAuth();
  const isSettingsViewOnly = isViewOnly('Settings');
  const canModifySettings = canWrite('Settings');

  const [reportTypes, setReportTypes] = useState<ReportTypeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Dropdown Menu state: item ID or null
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Side Drawer state
  const [viewItem, setViewItem] = useState<ReportTypeItem | null>(null);

  // Add / Edit Floating Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState('#004AC6');

  // Delete Confirmation State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ReportTypeItem | null>(null);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ===========================================================================
  // 1. DATA FETCHING (SUPABASE & REALTIME)
  // ===========================================================================
  const fetchReportTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('report_types')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Could not fetch report_types from database:', error.message);
        setReportTypes([]);
      } else if (data) {
        const mappedTypes: ReportTypeItem[] = data.map((item: any) => ({
          id: item.id,
          code: item.code || `RPT-${item.id.slice(0, 6).toUpperCase()}`,
          name: item.name,
          color: item.color || '#004AC6',
          version: item.version || 'v1.0',
          createdAt: formatDateDisplay(item.created_at),
          createdBy: 'Alex Thompson',
          createdByRole: 'System Admin (UID: #1001)',
          updatedAt: formatDateDisplay(item.updated_at),
          updatedBy: 'Alex Thompson',
          updatedByRole: 'System Admin (UID: #1001)',
        }));
        setReportTypes(mappedTypes);
      }
    } catch (err) {
      console.error('Error fetching report_types from database:', err);
      setReportTypes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportTypes();

    const channel = supabase
      .channel('report-types-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_types' },
        () => {
          fetchReportTypes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReportTypes]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Filtered Report Types
  const filteredReportTypes = useMemo(() => {
    return reportTypes.filter(
      (item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [reportTypes, searchQuery]);

  // ===========================================================================
  // 2. MODAL & CRUD HANDLERS
  // ===========================================================================
  const handleOpenAddModal = () => {
    setEditingId(null);
    setItemTitle('');
    setSelectedColor('#004AC6');
    setIsAddModalOpen(true);
    setActiveMenuId(null);
  };

  const handleOpenEditModal = (item: ReportTypeItem) => {
    setEditingId(item.id);
    setItemTitle(item.name);
    setSelectedColor(item.color || '#004AC6');
    setIsAddModalOpen(true);
    setActiveMenuId(null);
    if (viewItem) setViewItem(null);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const isEditing = !!editingId;

      if (isEditing) {
        // Update existing report type
        const updatePayload = {
          name: itemTitle.trim(),
          color: selectedColor,
        };

        const { error } = await supabase
          .from('report_types')
          .update(updatePayload)
          .eq('id', editingId);

        if (error) {
          console.warn('Database update error, updating locally:', error.message);
        }

        setReportTypes((prev) =>
          prev.map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  name: itemTitle.trim(),
                  color: selectedColor,
                  updatedAt: 'Just now',
                }
              : item
          )
        );

        if (viewItem?.id === editingId) {
          setViewItem((prev) =>
            prev
              ? {
                  ...prev,
                  name: itemTitle.trim(),
                  color: selectedColor,
                  updatedAt: 'Just now',
                }
              : null
          );
        }

        showToast(`Report type "${itemTitle.trim()}" updated successfully.`);
      } else {
        // Create new report type
        const generatedCode =
          itemTitle
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-') || `rpt-${Date.now()}`;

        const insertPayload = {
          code: generatedCode,
          name: itemTitle.trim(),
          color: selectedColor,
          version: 'v1.0',
          is_active: true,
        };

        const { data, error } = await supabase
          .from('report_types')
          .insert([insertPayload])
          .select()
          .maybeSingle();

        if (error) {
          console.warn('Database insert error, adding locally:', error.message);
        }

        const newReport: ReportTypeItem = {
          id: data?.id || `rpt-${Date.now()}`,
          code: data?.code || `RPT-CUST-${String(reportTypes.length + 1).padStart(3, '0')}`,
          name: itemTitle.trim(),
          color: selectedColor,
          version: 'v1.0',
          createdAt: 'Just now',
          createdBy: 'Alex Thompson',
          createdByRole: 'System Admin (UID: #1001)',
          updatedAt: 'Just now',
          updatedBy: 'Alex Thompson',
          updatedByRole: 'System Admin (UID: #1001)',
        };

        setReportTypes((prev) => [...prev, newReport]);
        showToast(`Report type "${itemTitle.trim()}" added successfully.`);
      }

      setIsAddModalOpen(false);
      setItemTitle('');
      setSelectedColor('#004AC6');
      setEditingId(null);
    } catch (err) {
      console.error('Error saving report type:', err);
      showToast('Failed to save report type.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    const { id, name } = deleteConfirmItem;

    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('report_types').delete().eq('id', id);

      if (error) {
        console.warn('Database delete error, removing locally:', error.message);
      }

      setReportTypes((prev) => prev.filter((item) => item.id !== id));
      if (viewItem?.id === id) setViewItem(null);
      showToast(`Report type "${name}" removed.`);
    } catch (err) {
      console.error('Error deleting report type:', err);
      showToast('Failed to delete report type.', 'error');
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmItem(null);
      setActiveMenuId(null);
    }
  };

  return (
    <AppLayoutShell
      title="Report Types"
      subtitle="Manage incident classifications and dispatch advisory categories."
    >
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* ========================================================================= */}
        {/* 1. PAGE HEADER & ACTION BAR */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs uppercase tracking-wider text-[#004AC6] font-bold bg-[#004AC6]/10 border border-[#004AC6]/20 px-2.5 py-0.5 rounded-full">
                System Governance
              </span>
              <span className="text-slate-300 text-xs">•</span>
              <span className="text-xs text-[#505F76] font-medium">Node Policy #4012</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
              Report Types
            </h1>
            <p className="text-sm sm:text-base text-[#505F76] mt-1 font-medium">
              Manage report categories, classification badges, and dispatch advisory indicator colors across MLS telemetric feeds.
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

        {/* ========================================================================= */}
        {/* 2. SUMMARY KPI SECTION */}
        {/* ========================================================================= */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="summary-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <SummaryCardsSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key="summary-content"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* 3. MAIN CARD: REPORT TYPES */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col">
          {/* Header & Search Toolbar */}
          <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 flex items-center justify-center text-[#004AC6] border border-[#004AC6]/15 shrink-0">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1E293B]">Report Types</h2>
                <p className="text-xs text-[#757680]">Standard category classifications for MLS incident logs</p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search report types..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 pl-10 pr-4 text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
              />
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
                  /* Clean Empty State */
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
                            Start from scratch by creating custom report classifications and assigning indicator colors.
                          </p>
                        </div>
                        <PrimaryButton
                          size="sm"
                          pill
                          onClick={handleOpenAddModal}
                          leftIcon={<Plus className="w-4 h-4" />}
                        >
                          Add First Report Type
                        </PrimaryButton>
                      </div>
                    </td>
                  </tr>
                ) : filteredReportTypes.length === 0 ? (
                  /* Search Empty State */
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-[#757680]">
                      <Tag className="w-8 h-8 mx-auto text-slate-300 mb-2 opacity-50" />
                      <p className="font-semibold text-sm text-[#505F76]">No matching report types found</p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        Try adjusting your search query or add a new report type.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredReportTypes.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setViewItem(item)}
                    >
                      {/* Name with Color Indicator */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: item.color || '#004AC6' }}
                          />
                          <span className="font-semibold text-[#1E293B] group-hover:text-[#004AC6] transition-colors">
                            {item.name}
                          </span>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-4 px-6 font-mono text-xs text-[#505F76]">
                        <span className="bg-[#F1F5F9] px-2.5 py-1 rounded-md border border-[#E2E8F0] font-semibold text-[11px]">
                          {item.code}
                        </span>
                      </td>

                      {/* Last Updated */}
                      <td className="py-4 px-6 text-xs text-[#505F76]">
                        <div className="flex flex-col">
                          <span className="font-medium text-[#1E293B]">{item.updatedAt}</span>
                          <span className="text-[11px] text-[#94A3B8]">{item.updatedBy}</span>
                        </div>
                      </td>

                      {/* Three Dots Menu */}
                      <td
                        className="py-4 px-6 text-right relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            title="Options"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === item.id ? null : item.id);
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Dropdown Menu Choices Card */}
                          <AnimatePresence>
                            {activeMenuId === item.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                transition={{ duration: 0.12 }}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-9 z-40 w-36 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-1.5 space-y-1 text-left ring-1 ring-black/5"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewItem(item);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#004AC6]" />
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(item)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-[#505F76]" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteConfirmItem(item);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Delete</span>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-[#E2E8F0] bg-[#F8FAFC]/50 flex justify-between items-center text-xs text-[#757680]">
            <span>
              Showing <span className="font-bold text-[#1E293B]">{filteredReportTypes.length}</span> of{' '}
              <span className="font-bold text-[#1E293B]">{reportTypes.length}</span> total report types
            </span>
            <span className="text-[11px] text-[#94A3B8]">Standard System Classification</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SIDE MODAL / SLIDE-OVER DRAWER (VIEW REPORT TYPE DETAILS) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {viewItem && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewItem(null)}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm"
            />

            {/* Slide-over Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full sm:w-[480px] bg-white h-full shadow-2xl border-l border-[#E2E8F0] flex flex-col justify-between overflow-hidden z-10"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0"
                    style={{
                      backgroundColor: `${viewItem.color || '#004AC6'}15`,
                      color: viewItem.color || '#004AC6',
                      borderColor: `${viewItem.color || '#004AC6'}30`,
                    }}
                  >
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#1E293B]">Report Type Details</h2>
                    <p className="text-xs text-[#757680] font-mono">{viewItem.code}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewItem(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Meta Overview Card */}
                <div className="bg-[#F8FAFC] rounded-2xl p-5 border border-[#E2E8F0] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#004AC6] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                      Standard Classification
                    </span>
                    <span className="text-xs text-[#757680] font-medium">
                      Version {viewItem.version}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shadow-2xs"
                        style={{ backgroundColor: viewItem.color || '#004AC6' }}
                      />
                      <span className="text-xl font-bold text-[#1E293B]">
                        {viewItem.name}
                      </span>
                    </div>
                    <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-white border border-[#E2E8F0] text-[#505F76] font-semibold">
                      {viewItem.code}
                    </span>
                  </div>
                </div>

                {/* Audit & Governance Trail */}
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#757680] px-1">
                    Audit & Governance Trail
                  </div>

                  <div className="space-y-3">
                    {/* Created At */}
                    <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-xs text-[#757680] font-medium flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#505F76]" /> Created at
                        </div>
                        <div className="text-sm font-semibold text-[#1E293B] pl-5">
                          {viewItem.createdAt}
                        </div>
                      </div>
                    </div>

                    {/* Updated At */}
                    <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-xs text-[#757680] font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#505F76]" /> Updated at
                        </div>
                        <div className="text-sm font-semibold text-[#1E293B] pl-5">
                          {viewItem.updatedAt}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-5 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmItem(viewItem);
                  }}
                  className="px-4 py-2.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>

                <PrimaryButton
                  size="md"
                  pill
                  onClick={() => handleOpenEditModal(viewItem)}
                  leftIcon={<Edit2 className="w-4 h-4" />}
                >
                  Edit Report Type
                </PrimaryButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. FLOATING ADD / EDIT MODAL WITH COLOR SELECTION */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsAddModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden z-10"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center border shrink-0 transition-colors"
                    style={{
                      backgroundColor: `${selectedColor}15`,
                      color: selectedColor,
                      borderColor: `${selectedColor}30`,
                    }}
                  >
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#1E293B]">
                      {editingId ? 'Edit Report Type' : 'Add Report Type'}
                    </h2>
                    <p className="text-xs text-[#757680]">
                      Configure report category title and indicator color
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveItem} className="flex flex-col">
                <div className="p-6 space-y-5">
                  {/* Name / Title Input */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="item-title"
                      className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
                    >
                      Report Type Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="item-title"
                      type="text"
                      required
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                      placeholder="e.g., Hazardous Chemical Spill, Flood Advisory"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                    />
                  </div>

                  {/* Color Indicator Swatches Selection (Matches app/logs/page.tsx) */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                      Indicator Color
                    </label>
                    <div className="flex items-center gap-3 pt-1">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.color}
                          type="button"
                          onClick={() => setSelectedColor(c.color)}
                          className={`w-7 h-7 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                            selectedColor === c.color
                              ? 'ring-2 ring-offset-2 ring-[#004AC6] scale-110'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.color }}
                          title={c.name}
                        >
                          {selectedColor === c.color && (
                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4.5 border-t border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
                  <SecondaryButton
                    type="button"
                    size="md"
                    pill
                    disabled={isSubmitting}
                    onClick={() => setIsAddModalOpen(false)}
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
                      ) : editingId ? (
                        <Edit2 className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )
                    }
                  >
                    {isSubmitting
                      ? 'Saving...'
                      : editingId
                      ? 'Save Changes'
                      : 'Add Report Type'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6. CONFIRM DELETE MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deleteConfirmItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setDeleteConfirmItem(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden z-10 p-6 space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-[#1E293B]">Delete Report Type</h3>
                <p className="text-xs text-[#757680] leading-relaxed">
                  Are you sure you want to remove{' '}
                  <span className="font-bold text-[#1E293B]">"{deleteConfirmItem.name}"</span>?
                  This action will delete the report category from the database.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <SecondaryButton
                  type="button"
                  size="md"
                  pill
                  disabled={isSubmitting}
                  onClick={() => setDeleteConfirmItem(null)}
                  className="flex-1"
                >
                  Cancel
                </SecondaryButton>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 px-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. TOAST NOTIFICATION POPUP */}
      {/* ========================================================================= */}
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
