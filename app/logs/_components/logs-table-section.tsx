'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  FileText,
  Filter,
  Loader2,
  Lock,
  MoreVertical,
  Play,
  Plus,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { PrimaryButton } from '@/components/button';
import { CustomDropdown, type CustomDropdownOption } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import type {
  ActiveShiftRecord,
  LogEntry,
  ScheduleEligibility,
} from './types';

interface LogsTableSectionProps {
  isLoading: boolean;
  isAddingLog: boolean;
  searchQuery: string;
  debouncedSearchQuery: string;
  onSearchChange: (val: string) => void;
  filterDropdownOptions: CustomDropdownOption[];
  reportTypeFilter: string;
  onReportTypeFilterChange: (val: string) => void;
  reportTypeOptionsList: CustomDropdownOption[];
  canModifyLogs: boolean;
  isShiftActive: boolean;
  activeShift: ActiveShiftRecord | null;
  canEndCurrentShift: boolean;
  canAddLogs: boolean;
  scheduleEligibility: ScheduleEligibility;
  onShiftButtonClick: () => void;
  onOpenAddModal: () => void;
  paginatedLogs: LogEntry[];
  filteredLogsCount: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  activeMenuId: string | null;
  onToggleMenu: (id: string | null) => void;
  onSelectLog: (log: LogEntry) => void;
  onEditLog: (log: LogEntry) => void;
  onDeleteLog: (id: string) => void;
  canEditLog: (log: LogEntry | null) => boolean;
}

export const LogsTableSection = React.memo(function LogsTableSection({
  isLoading,
  isAddingLog,
  searchQuery,
  debouncedSearchQuery,
  onSearchChange,
  filterDropdownOptions,
  reportTypeFilter,
  onReportTypeFilterChange,
  reportTypeOptionsList,
  canModifyLogs,
  isShiftActive,
  activeShift,
  canEndCurrentShift,
  canAddLogs,
  scheduleEligibility,
  onShiftButtonClick,
  onOpenAddModal,
  paginatedLogs,
  filteredLogsCount,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  activeMenuId,
  onToggleMenu,
  onSelectLog,
  onEditLog,
  onDeleteLog,
  canEditLog,
}: LogsTableSectionProps) {
  const reportTypeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    reportTypeOptionsList.forEach((opt) => {
      if (opt.dotColor) map.set(opt.value, opt.dotColor);
    });
    return map;
  }, [reportTypeOptionsList]);

  return (
    <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col">
      {/* Table Header Actions & Toolbar */}
      <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white">
        {/* Search Input with Debounced Filtering */}
        <div className="relative flex-1 sm:w-80">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search logs by title, type, or ID..."
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 pl-10 pr-10 text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
          />
          {searchQuery !== debouncedSearchQuery ? (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#004AC6]" />
            </div>
          ) : searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E293B] transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Filter Custom Dropdown */}
          <div className="w-48 shrink-0">
            <CustomDropdown
              options={filterDropdownOptions}
              value={reportTypeFilter}
              onChange={onReportTypeFilterChange}
              leftIcon={<Filter className="w-3.5 h-3.5" />}
              size="sm"
              pill
            />
          </div>

          {canModifyLogs && (
            <>
              {isLoading ? (
                <>
                  {/* Prevent "Start Shift" / locked flash during cold boot while shift status is resolving */}
                  <Skeleton variant="pill" className="h-10 w-32 shrink-0" />
                  <Skeleton variant="pill" className="h-10 w-28 shrink-0" />
                </>
              ) : (
                <>
                  {/* Start / End Shift Button with Schedule Window Verification & Handover Authority Check */}
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={onShiftButtonClick}
                      disabled={
                        isShiftActive
                          ? !canEndCurrentShift
                          : !scheduleEligibility.isEligible
                      }
                      className={`flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-sm border ${
                        isShiftActive
                          ? canEndCurrentShift
                            ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20 cursor-pointer'
                            : 'bg-slate-200 text-slate-400 border-slate-300 opacity-60 cursor-not-allowed shadow-none'
                          : scheduleEligibility.isEligible
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-emerald-600/20 cursor-pointer'
                          : 'bg-slate-200 text-slate-400 border-slate-300 opacity-60 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {isShiftActive ? (
                        <>
                          {canEndCurrentShift ? (
                            <Square className="w-3.5 h-3.5 fill-white" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>End Shift</span>
                        </>
                      ) : (
                        <>
                          {scheduleEligibility.isEligible ? (
                            <Play className="w-3.5 h-3.5 fill-white" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>Start Shift</span>
                        </>
                      )}
                    </button>

                    {/* Tooltip explaining disabled status if not eligible to start */}
                    {!isShiftActive && !scheduleEligibility.isEligible && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 min-w-[280px]">
                        <div className="bg-[#1E293B] text-white text-[11px] font-semibold py-2 px-3 rounded-xl shadow-xl leading-relaxed text-center">
                          <p className="font-bold text-amber-300 mb-0.5">
                            Shift Window Inactive
                          </p>
                          <p className="text-slate-200">
                            {scheduleEligibility.reason}
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-[#1E293B] rotate-45 -mt-1" />
                      </div>
                    )}

                    {/* Tooltip explaining disabled status if not eligible to end someone else's shift */}
                    {isShiftActive && !canEndCurrentShift && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 min-w-[280px]">
                        <div className="bg-[#1E293B] text-white text-[11px] font-semibold py-2 px-3 rounded-xl shadow-xl leading-relaxed text-center">
                          <p className="font-bold text-amber-300 mb-0.5">
                            Shift Handover Restricted
                          </p>
                          <p className="text-slate-200">
                            Only personnel designated for {activeShift?.shift_label} or
                            System Administrators can end this active shift.
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-[#1E293B] rotate-45 -mt-1" />
                      </div>
                    )}
                  </div>

                  {/* Add Logs Primary Button */}
                  <div className="relative group">
                    <PrimaryButton
                      size="md"
                      pill
                      disabled={!canAddLogs}
                      onClick={onOpenAddModal}
                      leftIcon={
                        !canAddLogs && isShiftActive && !canEndCurrentShift ? (
                          <Lock className="w-4 h-4 text-slate-400" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )
                      }
                      className={`shrink-0 ${
                        !canAddLogs
                          ? 'opacity-40 cursor-not-allowed bg-slate-300 text-slate-500 border-slate-300 shadow-none hover:bg-slate-300 pointer-events-auto'
                          : ''
                      }`}
                    >
                      Add Logs
                    </PrimaryButton>

                    {/* Tooltip when disabled: Shift not started */}
                    {!isShiftActive && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                        <div className="bg-[#1E293B] text-white text-[11px] font-semibold py-1.5 px-3 rounded-xl whitespace-nowrap shadow-lg">
                          Please click &quot;Start Shift&quot; to enable adding logs
                        </div>
                        <div className="w-2 h-2 bg-[#1E293B] rotate-45 -mt-1" />
                      </div>
                    )}

                    {/* Tooltip when disabled: View Only permission */}
                    {isShiftActive && !canModifyLogs && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                        <div className="bg-[#1E293B] text-white text-[11px] font-semibold py-1.5 px-3 rounded-xl whitespace-nowrap shadow-lg">
                          You have view-only access to Operational Logs
                        </div>
                        <div className="w-2 h-2 bg-[#1E293B] rotate-45 -mt-1" />
                      </div>
                    )}

                    {/* Tooltip when disabled: Not designated to active shift schedule */}
                    {isShiftActive && canModifyLogs && !canEndCurrentShift && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 min-w-[280px]">
                        <div className="bg-[#1E293B] text-white text-[11px] font-semibold py-2 px-3 rounded-xl shadow-xl leading-relaxed text-center">
                          <p className="font-bold text-amber-300 mb-0.5">
                            Logging Restricted
                          </p>
                          <p className="text-slate-200">
                            Only personnel designated for {activeShift?.shift_label} or
                            System Administrators can record incident logs.
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-[#1E293B] rotate-45 -mt-1" />
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto min-h-[320px] pb-12">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-[#F8FAFC]/80 border-b border-[#E2E8F0] text-[#505F76] text-xs uppercase tracking-wider font-semibold">
              <th className="py-3.5 px-6 w-28">Time</th>
              <th className="py-3.5 px-6">Title</th>
              <th className="py-3.5 px-6 w-56">Report Type</th>
              <th className="py-3.5 px-6 text-right w-28">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] text-sm font-medium text-[#1E293B]">
            {/* 1. Newly Added Log In-Flight Skeleton Loader Row */}
            {isAddingLog && (
              <tr className="bg-[#004AC6]/5 border-b border-[#004AC6]/20 transition-all duration-300 animate-pulse">
                <td className="py-4 px-6">
                  <div className="h-4 w-16 bg-[#004AC6]/20 rounded-md" />
                </td>
                <td className="py-4 px-6">
                  <div className="space-y-1.5 max-w-lg">
                    <div className="h-4 w-3/4 bg-[#004AC6]/25 rounded-md" />
                    <div className="h-3 w-1/2 bg-[#004AC6]/15 rounded-md" />
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#004AC6]/40 animate-ping" />
                    <div className="h-4 w-28 bg-[#004AC6]/20 rounded-md" />
                  </div>
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="w-8 h-8 rounded-full bg-[#004AC6]/10 inline-flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-[#004AC6] animate-spin" />
                  </div>
                </td>
              </tr>
            )}

            {/* 2. Initial Full Table Loading Skeleton */}
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="py-4 px-6">
                    <Skeleton variant="rounded" className="h-4 w-16" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton variant="rounded" className="h-4 w-64" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton variant="rounded" className="h-4 w-32" />
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Skeleton variant="circular" className="w-7 h-7 inline-block" />
                  </td>
                </tr>
              ))
            ) : filteredLogsCount === 0 && !isAddingLog ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-[#757680]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-[#94A3B8] opacity-50" />
                    <p className="text-sm font-semibold text-[#505F76]">
                      No logs found
                    </p>
                    <p className="text-xs text-[#94A3B8]">
                      {isShiftActive
                        ? 'Start logging incident telemetry or adjust your search filter.'
                        : 'Click "Start Shift" above to initiate duty and log entries.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => (
                <tr
                  key={log.id}
                  className={`hover:bg-slate-50/80 transition-colors group relative ${
                    activeMenuId === log.id ? 'z-50 relative' : 'z-0'
                  }`}
                >
                  {/* Time */}
                  <td className="py-4 px-6 text-[#505F76] font-mono text-xs font-semibold">
                    {log.time}
                  </td>

                  {/* Title */}
                  <td className="py-4 px-6">
                    <span
                      onClick={() => onSelectLog(log)}
                      className="font-semibold text-[#1E293B] hover:text-[#004AC6] transition-colors cursor-pointer block max-w-xl truncate"
                    >
                      {log.title}
                    </span>
                  </td>

                  {/* Report Type */}
                  <td className="py-4 px-6 text-[#505F76] text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            reportTypeColorMap.get(log.reportType) || '#004AC6',
                        }}
                      />
                      <span className="truncate">{log.reportType}</span>
                    </div>
                  </td>

                  {/* Actions: Three Dots Menu */}
                  <td
                    className={`py-4 px-6 text-right ${
                      activeMenuId === log.id ? 'relative z-50' : ''
                    }`}
                  >
                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        title="Log Actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMenu(activeMenuId === log.id ? null : log.id);
                        }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                          activeMenuId === log.id
                            ? 'bg-slate-200 text-[#1E293B]'
                            : 'text-[#757680] hover:text-[#1E293B] hover:bg-slate-100'
                        }`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Popover Dropdown */}
                      <AnimatePresence>
                        {activeMenuId === log.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 4 }}
                            transition={{ duration: 0.12 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1.5 z-[100] w-40 bg-white/95 backdrop-blur-md border border-[#E2E8F0] rounded-2xl shadow-2xl shadow-slate-900/15 p-1.5 space-y-1 text-left ring-1 ring-black/10"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onSelectLog(log);
                                onToggleMenu(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#004AC6]" />
                              <span>View Details</span>
                            </button>

                            {canEditLog(log) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onEditLog(log)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Edit Log</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteLog(log.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Delete</span>
                                </button>
                              </>
                            )}
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

      {/* Pagination Footer */}
      <div className="p-4 sm:p-5 border-t border-[#E2E8F0] bg-[#F8FAFC]/50 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#757680]">
        <span className="font-medium">
          Showing{' '}
          <span className="font-bold text-[#1E293B]">
            {filteredLogsCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}
          </span>{' '}
          to{' '}
          <span className="font-bold text-[#1E293B]">
            {Math.min(currentPage * itemsPerPage, filteredLogsCount)}
          </span>{' '}
          of <span className="font-bold text-[#1E293B]">{filteredLogsCount}</span>{' '}
          entries
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const pageNum = i + 1;
            if (
              totalPages <= 7 ||
              pageNum === 1 ||
              pageNum === totalPages ||
              Math.abs(pageNum - currentPage) <= 1
            ) {
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-[#004AC6] text-white shadow-xs font-bold'
                      : 'border border-[#E2E8F0] bg-white text-[#505F76] hover:bg-slate-50 shadow-2xs'
                  }`}
                >
                  {pageNum}
                </button>
              );
            } else if (
              (pageNum === 2 && currentPage > 3) ||
              (pageNum === totalPages - 1 && currentPage < totalPages - 2)
            ) {
              return (
                <span key={pageNum} className="px-1 text-slate-400 font-bold">
                  ...
                </span>
              );
            }
            return null;
          })}

          <button
            type="button"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
