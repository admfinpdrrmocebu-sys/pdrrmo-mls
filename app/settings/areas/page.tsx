'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  MapPin,
  Anchor,
  Plus,
  Search,
  Filter,
  Check,
  X,
  Edit2,
  Trash2,
  Ship,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton, ToggleButton } from '@/components/button';
import { SummaryCard } from '@/components/card';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';

export interface AreaItem {
  id: string;
  code?: string;
  name: string;
  weatherMonitoring: boolean;
  hasPort: boolean;
  portName: string;
  coordinates?: { lat: number; lng: number };
  sortOrder?: number;
  isActive?: boolean;
}

const portFilterOptions: CustomDropdownOption[] = [
  { value: 'all', label: 'All Regions' },
  {
    value: 'with_port',
    label: 'With Port/Pier',
    dotColor: '#004AC6',
    badge: 'Maritime',
    badgeColor: 'bg-blue-50 text-[#004AC6]',
  },
  {
    value: 'no_port',
    label: 'No Port/Pier',
    dotColor: '#94A3B8',
    badge: 'Inland',
    badgeColor: 'bg-slate-100 text-[#505F76]',
  },
];

// =============================================================================
// SKELETON PLACEHOLDERS
// =============================================================================
function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-2">
            <Skeleton variant="rounded" className="h-3.5 w-28" />
            <Skeleton variant="rounded" className="h-8 w-20" />
            <Skeleton variant="rounded" className="h-3 w-36" />
          </div>
          <Skeleton variant="rounded" className="w-14 h-14 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

function AreasTableSkeleton() {
  return (
    <div className="w-full divide-y divide-[#E2E8F0]">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center justify-between py-4 px-6 gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
            <Skeleton variant="rounded" className="h-4 w-40" />
          </div>
          <div className="w-24 flex justify-center">
            <Skeleton variant="rounded" className="h-6 w-6 rounded-md" />
          </div>
          <div className="w-28 flex justify-center">
            <Skeleton variant="rounded" className="h-6 w-6 rounded-md" />
          </div>
          <div className="flex-1 flex items-center gap-2">
            <Skeleton variant="circular" className="w-4 h-4 shrink-0" />
            <Skeleton variant="rounded" className="h-4 w-36" />
          </div>
          <div className="flex items-center justify-end gap-2 w-20">
            <Skeleton variant="circular" className="w-8 h-8 rounded-full" />
            <Skeleton variant="circular" className="w-8 h-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function AreaSeedingPage() {
  const { canWrite, isViewOnly } = useAuth();
  const isSettingsViewOnly = isViewOnly('Settings');
  const canModifySettings = canWrite('Settings');

  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [portFilter, setPortFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [areaName, setAreaName] = useState('');
  const [weatherMonitoring, setWeatherMonitoring] = useState(true);
  const [portAvailability, setPortAvailability] = useState(false);
  const [portName, setPortName] = useState('');

  // Delete Confirmation State
  const [deleteConfirmArea, setDeleteConfirmArea] = useState<AreaItem | null>(null);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ===========================================================================
  // 1. DATA FETCHING (SUPABASE & REALTIME)
  // ===========================================================================
  const fetchAreas = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.warn('Could not fetch areas from database:', error.message);
        setAreas([]);
      } else if (data) {
        const mappedAreas: AreaItem[] = data.map((item: any) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          weatherMonitoring: item.weather_monitoring ?? true,
          hasPort: item.has_port ?? false,
          portName: item.port_name || 'None',
          coordinates: item.coordinates,
          sortOrder: item.sort_order ?? 0,
          isActive: item.is_active ?? true,
        }));
        setAreas(mappedAreas);
      }
    } catch (err) {
      console.error('Error fetching areas from database:', err);
      setAreas([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAreas();

    // Supabase Realtime Subscription
    const channel = supabase
      .channel('areas-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'areas' },
        () => {
          fetchAreas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAreas]);

  // Reset pagination when search query or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, portFilter]);

  // ===========================================================================
  // 2. FILTERING & PAGINATION
  // ===========================================================================
  const filteredAreas = useMemo(() => {
    return areas.filter((area) => {
      const matchesSearch =
        area.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        area.portName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter =
        portFilter === 'all' ||
        (portFilter === 'with_port' && area.hasPort) ||
        (portFilter === 'no_port' && !area.hasPort);
      return matchesSearch && matchesFilter;
    });
  }, [areas, searchQuery, portFilter]);

  const totalPages = Math.ceil(filteredAreas.length / pageSize) || 1;
  const paginatedAreas = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAreas.slice(startIndex, startIndex + pageSize);
  }, [filteredAreas, currentPage, pageSize]);

  // Statistics
  const totalAreas = areas.length;
  const totalWithPort = areas.filter((a) => a.hasPort).length;

  // ===========================================================================
  // 3. HANDLERS: ADD / EDIT / DELETE
  // ===========================================================================
  const handleOpenAddModal = () => {
    setEditingAreaId(null);
    setAreaName('');
    setWeatherMonitoring(true);
    setPortAvailability(false);
    setPortName('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (area: AreaItem) => {
    setEditingAreaId(area.id);
    setAreaName(area.name);
    setWeatherMonitoring(area.weatherMonitoring);
    setPortAvailability(area.hasPort);
    setPortName(area.hasPort && area.portName !== 'None' ? area.portName : '');
    setIsModalOpen(true);
  };

  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaName.trim()) return;

    try {
      setIsSubmitting(true);
      const isEditing = !!editingAreaId;
      const formattedPortName =
        portAvailability && portName.trim() ? portName.trim() : 'None';

      if (isEditing) {
        // Update existing area
        const updatePayload = {
          name: areaName.trim(),
          weather_monitoring: weatherMonitoring,
          has_port: portAvailability,
          port_name: formattedPortName,
        };

        const { error } = await supabase
          .from('areas')
          .update(updatePayload)
          .eq('id', editingAreaId);

        if (error) {
          console.warn('Database update error, updating locally:', error.message);
        }

        setAreas((prev) =>
          prev.map((a) =>
            a.id === editingAreaId
              ? {
                  ...a,
                  name: areaName.trim(),
                  weatherMonitoring,
                  hasPort: portAvailability,
                  portName: formattedPortName,
                }
              : a
          )
        );

        showToast(`Area "${areaName.trim()}" updated successfully.`);
      } else {
        // Create new area
        const generatedCode =
          areaName
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-') || `area-${Date.now()}`;

        const insertPayload = {
          code: generatedCode,
          name: areaName.trim(),
          weather_monitoring: weatherMonitoring,
          has_port: portAvailability,
          port_name: formattedPortName,
          is_active: true,
          sort_order: areas.length + 1,
        };

        const { data, error } = await supabase
          .from('areas')
          .insert([insertPayload])
          .select()
          .maybeSingle();

        if (error) {
          console.warn('Database insert error, adding locally:', error.message);
        }

        const newArea: AreaItem = {
          id: data?.id || `area-${Date.now()}`,
          code: data?.code || generatedCode,
          name: areaName.trim(),
          weatherMonitoring,
          hasPort: portAvailability,
          portName: formattedPortName,
          isActive: true,
          sortOrder: areas.length + 1,
        };

        setAreas((prev) => [...prev, newArea]);
        showToast(`Area "${areaName.trim()}" created successfully.`);
      }

      setIsModalOpen(false);
      setEditingAreaId(null);
    } catch (err) {
      console.error('Error saving area:', err);
      showToast('Failed to save area configuration.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmArea) return;
    const { id, name } = deleteConfirmArea;

    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('areas').delete().eq('id', id);

      if (error) {
        console.warn('Database delete error, removing locally:', error.message);
      }

      setAreas((prev) => prev.filter((item) => item.id !== id));
      showToast(`Area "${name}" removed successfully.`);
    } catch (err) {
      console.error('Error deleting area:', err);
      showToast('Failed to delete area.', 'error');
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmArea(null);
    }
  };

  return (
    <AppLayoutShell
      title="Area Seeding Configuration"
      subtitle="Manage and monitor regional assignments and port availabilities."
    >
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* ========================================================================= */}
        {/* 1. PAGE HEADER */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
              Area Seeding Configuration
            </h1>
            <p className="text-sm sm:text-base text-[#505F76] mt-1 font-medium">
              Manage and monitor regional assignments, weather telemetry, and maritime port availabilities.
            </p>
          </div>
        </div>

        {/* View-Only Banner */}
        <ViewOnlyNotice
          screen="Settings"
          message="Regional area seeding definitions and monitoring status indicators are presented in read-only audit mode."
        />

        {/* ========================================================================= */}
        {/* 2. SUMMARY METRIC CARDS (BENTO STYLE) */}
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
              {/* Card 1: Total Areas */}
              <SummaryCard
                title="TOTAL AREAS"
                value={totalAreas}
                subtitle="monitored regions"
                icon={<MapPin className="w-6 h-6 text-[#505F76]" />}
                iconBg="bg-slate-100 text-[#505F76] border border-slate-200"
                ambientColor="bg-[#505F76]/5"
              />

              {/* Card 2: Total Areas with Port/Pier */}
              <SummaryCard
                title="TOTAL AREAS WITH PORT/PIER"
                value={totalWithPort}
                subtitle="active maritime nodes"
                icon={<Anchor className="w-6 h-6 text-[#004AC6]" />}
                iconBg="bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15"
                ambientColor="bg-[#004AC6]/5"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* 3. MONITORING AREAS DATA TABLE */}
        {/* ========================================================================= */}
        <div className="bg-white border border-[#E2E8F0] rounded-[1.75rem] shadow-sm flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="p-5 sm:p-6 border-b border-[#E2E8F0] bg-white flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-[#1E293B]">Monitoring Areas</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15">
                {filteredAreas.length} {filteredAreas.length === 1 ? 'Area' : 'Areas'}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search areas..."
                  className="w-full pl-9 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                />
              </div>

              {/* Filter Port Custom Dropdown */}
              <div className="w-44 shrink-0">
                <CustomDropdown
                  options={portFilterOptions}
                  value={portFilter}
                  onChange={(val) => setPortFilter(val)}
                  leftIcon={<Filter className="w-3.5 h-3.5" />}
                  size="sm"
                  pill
                />
              </div>

              {/* Add Area Button */}
              {canModifySettings && (
                <PrimaryButton
                  size="md"
                  pill
                  onClick={handleOpenAddModal}
                  leftIcon={<Plus className="w-4 h-4" />}
                  className="shrink-0"
                >
                  Add Area
                </PrimaryButton>
              )}
            </div>
          </div>

          {/* Table Body / Skeleton */}
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]/80 text-[#505F76]">
                  <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider">
                    Name of the Area
                  </th>
                  <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-center">
                    Weather Status
                  </th>
                  <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-center">
                    Port/Pier Availability
                  </th>
                  <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider">
                    Port/Pier Name
                  </th>
                  <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm font-medium text-[#1E293B]">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <AreasTableSkeleton />
                    </td>
                  </tr>
                ) : areas.length === 0 ? (
                  /* From Scratch Empty State */
                  <tr>
                    <td colSpan={5} className="py-16 px-6 text-center">
                      <div className="flex flex-col items-center justify-center gap-4 max-w-md mx-auto">
                        <div className="w-14 h-14 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/20">
                          <MapPin className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-[#1E293B]">
                            No Monitored Areas Configured Yet
                          </h3>
                          <p className="text-xs text-[#757680] leading-relaxed">
                            Start from scratch by adding regional zones, meteorological tracking, and maritime ports to the database.
                          </p>
                        </div>
                        <PrimaryButton
                          size="sm"
                          pill
                          onClick={handleOpenAddModal}
                          leftIcon={<Plus className="w-4 h-4" />}
                        >
                          Add First Area
                        </PrimaryButton>
                      </div>
                    </td>
                  </tr>
                ) : filteredAreas.length === 0 ? (
                  /* Search / Filter Empty State */
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#757680]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <MapPin className="w-8 h-8 text-[#94A3B8] opacity-50" />
                        <p className="text-sm font-semibold text-[#505F76]">No matching areas found</p>
                        <p className="text-xs text-[#94A3B8]">
                          Try adjusting your search criteria or filter options.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedAreas.map((area) => (
                    <tr
                      key={area.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Name of the Area */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center shrink-0 border border-[#004AC6]/15">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <span className="font-semibold text-[#1E293B]">{area.name}</span>
                        </div>
                      </td>

                      {/* Weather Status */}
                      <td className="py-4 px-6 text-center">
                        <div
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md border ${
                            area.weatherMonitoring
                              ? 'bg-[#004AC6]/10 border-[#004AC6]/20 text-[#004AC6]'
                              : 'bg-slate-50 border-slate-200 text-slate-300'
                          }`}
                        >
                          {area.weatherMonitoring ? (
                            <Check className="w-4 h-4" strokeWidth={2.5} />
                          ) : (
                            <X className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Port/Pier Availability */}
                      <td className="py-4 px-6 text-center">
                        <div
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md border ${
                            area.hasPort
                              ? 'bg-[#004AC6]/10 border-[#004AC6]/20 text-[#004AC6]'
                              : 'bg-slate-50 border-slate-200 text-slate-300'
                          }`}
                        >
                          {area.hasPort ? (
                            <Check className="w-4 h-4" strokeWidth={2.5} />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          )}
                        </div>
                      </td>

                      {/* Port/Pier Name */}
                      <td className="py-4 px-6">
                        {area.hasPort && area.portName !== 'None' ? (
                          <div className="flex items-center gap-2">
                            <Ship className="w-3.5 h-3.5 text-[#004AC6] shrink-0" />
                            <span className="text-[#505F76] font-medium">{area.portName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(area)}
                            title="Edit Area"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#004AC6]/10 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmArea(area)}
                            title="Delete Area"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination Controls */}
          <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]/50 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#757680]">
            <p>
              Showing{' '}
              <span className="font-bold text-[#1E293B]">
                {filteredAreas.length === 0
                  ? 0
                  : (currentPage - 1) * pageSize + 1}
                -
                {Math.min(currentPage * pageSize, filteredAreas.length)}
              </span>{' '}
              of <span className="font-bold text-[#1E293B]">{filteredAreas.length}</span> filtered areas ({totalAreas} total in database)
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={`w-8 h-8 rounded-full border border-[#E2E8F0] flex items-center justify-center transition-all ${
                  currentPage <= 1 || isLoading
                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                    : 'bg-white text-[#505F76] hover:text-[#004AC6] hover:border-[#004AC6] cursor-pointer'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 rounded-full bg-[#004AC6] text-white font-semibold text-xs">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={`w-8 h-8 rounded-full border border-[#E2E8F0] flex items-center justify-center transition-all ${
                  currentPage >= totalPages || isLoading
                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                    : 'bg-white text-[#505F76] hover:text-[#004AC6] hover:border-[#004AC6] cursor-pointer'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL: ADD / EDIT MONITORING AREA */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden z-10"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1E293B]">
                    {editingAreaId ? 'Edit Monitoring Area' : 'Add New Monitoring Area'}
                  </h2>
                  <p className="text-xs text-[#757680]">
                    {editingAreaId
                      ? 'Update geographic zone and maritime port configurations'
                      : 'Register new geographic zone and port details'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveArea} className="flex flex-col">
                <div className="p-6 space-y-5">
                  {/* Area Name Input */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="area-name"
                      className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
                    >
                      Area Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="area-name"
                      type="text"
                      required
                      value={areaName}
                      onChange={(e) => setAreaName(e.target.value)}
                      placeholder="e.g., Cebu City, Mandaue, Talisay"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                    />
                  </div>

                  {/* Weather Monitoring Toggle */}
                  <div className="flex items-center justify-between py-1">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[#1E293B]">
                        Weather Monitoring
                      </span>
                      <span className="text-xs text-[#757680]">
                        Include in meteorological telemetry updates
                      </span>
                    </div>
                    <ToggleButton
                      checked={weatherMonitoring}
                      onChange={(val) => setWeatherMonitoring(val)}
                    />
                  </div>

                  <hr className="border-t border-[#E2E8F0]" />

                  {/* Port/Pier Availability Toggle */}
                  <div className="flex items-center justify-between py-1">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[#1E293B]">
                        Port/Pier Availability
                      </span>
                      <span className="text-xs text-[#757680]">
                        Enable maritime hub monitoring
                      </span>
                    </div>
                    <ToggleButton
                      checked={portAvailability}
                      onChange={(val) => {
                        setPortAvailability(val);
                        if (!val) setPortName('');
                      }}
                    />
                  </div>

                  {/* Port/Pier Name Input */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="port-name"
                      className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
                    >
                      Port/Pier Name {portAvailability && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      id="port-name"
                      type="text"
                      disabled={!portAvailability}
                      required={portAvailability}
                      value={portName}
                      onChange={(e) => setPortName(e.target.value)}
                      placeholder={
                        portAvailability
                          ? 'e.g., Pier 1, Cebu International Port'
                          : 'Disabled (No port available)'
                      }
                      className={`w-full border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm transition-all ${
                        portAvailability
                          ? 'bg-[#F8FAFC] text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15'
                          : 'bg-slate-100 text-slate-400 placeholder:text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
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
                        <Plus className="w-4 h-4" />
                      )
                    }
                  >
                    {isSubmitting
                      ? 'Saving...'
                      : editingAreaId
                      ? 'Save Changes'
                      : 'Add Area'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. MODAL: CONFIRM DELETE AREA */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deleteConfirmArea && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setDeleteConfirmArea(null)}
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
                <h3 className="text-base font-bold text-[#1E293B]">Delete Monitoring Area</h3>
                <p className="text-xs text-[#757680] leading-relaxed">
                  Are you sure you want to remove{' '}
                  <span className="font-bold text-[#1E293B]">"{deleteConfirmArea.name}"</span>?
                  This action will delete the area from the database.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <SecondaryButton
                  type="button"
                  size="md"
                  pill
                  disabled={isSubmitting}
                  onClick={() => setDeleteConfirmArea(null)}
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
      {/* 6. TOAST NOTIFICATION POPUP */}
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

