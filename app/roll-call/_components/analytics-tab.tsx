'use client';

import React from 'react';
import {
  MoreVertical,
  CheckCircle2,
  Search,
  MapPin,
  Edit2,
  Eye,
  Activity,
  Anchor,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SummaryCard } from '@/components/card';
import type { LGUAnalyticsSummary } from './types';

export interface AnalyticsTabProps {
  isLoadingAnalytics: boolean;
  analyticsLoaded: boolean;
  totalRegisteredLgus: number;
  currentMonthName: string;
  monthlyPresentCount: number;
  monthlyAbsentCount: number;
  filteredLguAnalytics: LGUAnalyticsSummary[];
  analyticsSearchQuery: string;
  onSearchChange: (q: string) => void;
  activeAnalyticsMenuId: string | null;
  onToggleAnalyticsMenu: (lguId: string | null) => void;
  onOpenViewDrawer: (lgu: LGUAnalyticsSummary) => void;
  onOpenEditLgu: (lgu: LGUAnalyticsSummary) => void;
}

export const AnalyticsTab = React.memo(function AnalyticsTab({
  isLoadingAnalytics,
  analyticsLoaded,
  totalRegisteredLgus,
  currentMonthName,
  monthlyPresentCount,
  monthlyAbsentCount,
  filteredLguAnalytics,
  analyticsSearchQuery,
  onSearchChange,
  activeAnalyticsMenuId,
  onToggleAnalyticsMenu,
  onOpenViewDrawer,
  onOpenEditLgu,
}: AnalyticsTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. Summary Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Card 1: Total LGU Registered */}
        <SummaryCard
          title="Total LGU Registered"
          value={totalRegisteredLgus}
          subtitle="Active VHF monitoring stations in Cebu"
          icon={<MapPin className="w-5 h-5" />}
          iconBg="bg-[#004AC6]/10 text-[#004AC6]"
          ambientColor="bg-[#004AC6]/5"
        />

        {/* Card 2: Total Present Counted (Monthly Count) */}
        <SummaryCard
          title={`Total Present Counted (${currentMonthName})`}
          value={isLoadingAnalytics && !analyticsLoaded ? '...' : monthlyPresentCount}
          subtitle="Present check-ins recorded this month"
          change={
            isLoadingAnalytics && !analyticsLoaded
              ? 'Loading telemetry...'
              : monthlyPresentCount > 0
              ? `${monthlyPresentCount} Responses`
              : 'No logs yet'
          }
          changeType={monthlyPresentCount > 0 ? 'positive' : 'neutral'}
          icon={<CheckCircle2 className="w-5 h-5" />}
          iconBg="bg-emerald-50 text-emerald-600"
          ambientColor="bg-emerald-500/5"
        />

        {/* Card 3: Total Absent Counted (Monthly Count) */}
        <SummaryCard
          title={`Total Absent Counted (${currentMonthName})`}
          value={isLoadingAnalytics && !analyticsLoaded ? '...' : monthlyAbsentCount}
          subtitle="Absent marks recorded this month"
          change={
            isLoadingAnalytics && !analyticsLoaded
              ? 'Loading telemetry...'
              : monthlyAbsentCount > 0
              ? `${monthlyAbsentCount} Unresponsive`
              : 'Zero Absents'
          }
          changeType={monthlyAbsentCount > 0 ? 'negative' : 'positive'}
          icon={<AlertCircle className="w-5 h-5" />}
          iconBg="bg-rose-50 text-rose-600"
          ambientColor="bg-rose-500/5"
        />
      </div>

      {/* 2. LGU Analytics Table Card */}
      <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-5 sm:p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                LGU Telemetry & Attendance Records
              </h2>
              <p className="text-xs text-[#505F76]">
                Aggregated VHF roll call performance across {filteredLguAnalytics.length} registered stations
              </p>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#757680]" />
            <input
              type="text"
              value={analyticsSearchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search LGU or code..."
              className="w-full bg-white border border-[#E2E8F0] rounded-full pl-9 pr-4 py-2 text-xs text-[#1E293B] placeholder-[#757680] focus:outline-none focus:border-[#004AC6] shadow-2xs"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider bg-slate-50/50">
                <th className="py-3.5 px-4 sm:px-6">LGU Name</th>
                <th className="py-3.5 px-4 sm:px-6 text-center">Total Present</th>
                <th className="py-3.5 px-4 sm:px-6 text-center">Total Absent</th>
                <th className="py-3.5 px-4 sm:px-6 text-center">Attendance Rate</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLguAnalytics.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-sm">No LGU stations match your search</p>
                  </td>
                </tr>
              ) : (
                filteredLguAnalytics.map((lgu) => (
                  <tr
                    key={lgu.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    {/* LGU Name & Code */}
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-[#505F76] border border-slate-200 shrink-0">
                          {lgu.code}
                        </span>
                        <div>
                          <span className="font-bold text-[#1E293B] block text-sm">
                            {lgu.name}
                          </span>
                          {lgu.hasPort ? (
                            <span className="text-[11px] text-sky-700 font-semibold flex items-center gap-1 mt-0.5">
                              <Anchor className="w-3 h-3" />
                              {lgu.portName && lgu.portName !== 'None' ? lgu.portName : 'Coastal Port'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">
                              Inland Station
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Total Present */}
                    <td className="py-4 px-4 sm:px-6 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {lgu.totalPresent} Present
                      </span>
                    </td>

                    {/* Total Absent */}
                    <td className="py-4 px-4 sm:px-6 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold ${
                          lgu.totalAbsent > 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-[#505F76] border border-slate-200'
                        }`}
                      >
                        {lgu.totalAbsent} Absent
                      </span>
                    </td>

                    {/* Attendance Rate */}
                    <td className="py-4 px-4 sm:px-6 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                            lgu.totalSessions === 0
                              ? 'bg-slate-100 text-slate-500 border border-slate-200'
                              : lgu.attendanceRate >= 90
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : lgu.attendanceRate >= 75
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {lgu.totalSessions > 0 ? `${lgu.attendanceRate}%` : 'No Data'}
                        </span>
                        {lgu.totalSessions > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            {lgu.totalPresent}/{lgu.totalSessions} sessions
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action (Three Dots Dropdown) */}
                    <td className="py-4 px-4 sm:px-6 text-right relative">
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleAnalyticsMenu(activeAnalyticsMenuId === lgu.id ? null : lgu.id);
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                          aria-label="LGU actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        <AnimatePresence>
                          {activeAnalyticsMenuId === lgu.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 mt-2 w-48 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5"
                            >
                              <button
                                type="button"
                                onClick={() => onOpenViewDrawer(lgu)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#004AC6]" />
                                View Analytics & History
                              </button>

                              <button
                                type="button"
                                onClick={() => onOpenEditLgu(lgu)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-[#505F76]" />
                                Edit LGU Details
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
      </div>
    </div>
  );
});
