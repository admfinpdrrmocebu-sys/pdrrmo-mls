'use client';

import React, { useState } from 'react';
import {
  Radio as RadioIcon,
  X,
  CheckCircle2,
  BarChart3,
  Activity,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { SecondaryButton } from '@/components/button';
import { OfficerAvatar } from './officer-avatar';
import { getInitials, type LGUAnalyticsSummary } from './types';

interface ChartTooltipPayloadItem {
  payload: {
    category: string;
    count: number;
    percentage: number;
    fill?: string;
  };
}

function CustomChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
}) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1E293B] text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700/80 space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor:
                data.fill || (data.category === 'Present' ? '#10B981' : '#EF4444'),
            }}
          />
          <p className="font-bold text-slate-200">{data.category} Sessions</p>
        </div>
        <div className="pt-0.5">
          <p className="text-sm font-extrabold text-white">
            {data.count}{' '}
            <span className="text-xs font-normal text-slate-300">
              ({data.percentage}%)
            </span>
          </p>
        </div>
      </div>
    );
  }
  return null;
}

export interface ViewLguDrawerProps {
  isOpen: boolean;
  selectedLgu: LGUAnalyticsSummary | null;
  onClose: () => void;
}

export function ViewLguDrawer({
  isOpen,
  selectedLgu,
  onClose,
}: ViewLguDrawerProps) {
  const [absentPage, setAbsentPage] = useState(1);
  const [presentPage, setPresentPage] = useState(1);
  const [prevLguId, setPrevLguId] = useState<string | null>(null);

  const currentLguId = selectedLgu?.id ?? null;
  if (currentLguId !== prevLguId) {
    setPrevLguId(currentLguId);
    setAbsentPage(1);
    setPresentPage(1);
  }

  const totalAbsentPages = selectedLgu
    ? Math.max(1, Math.ceil(selectedLgu.absentRecords.length / 5))
    : 1;
  const totalPresentPages = selectedLgu
    ? Math.max(1, Math.ceil(selectedLgu.presentRecords.length / 5))
    : 1;
  const safeAbsentPage = Math.min(absentPage, totalAbsentPages);
  const safePresentPage = Math.min(presentPage, totalPresentPages);

  return (
    <AnimatePresence>
      {isOpen && selectedLgu && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 w-full sm:w-auto">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="w-full sm:w-screen sm:max-w-xl bg-white shadow-2xl flex flex-col h-full border-l border-[#E2E8F0]"
            >
              {/* Drawer Header */}
              <div className="p-4 sm:p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/90 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 sm:w-11 h-10 sm:h-11 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center font-bold shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold text-[#1E293B] truncate">
                        {selectedLgu.name}
                      </h2>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-200 text-[#1E293B]">
                        {selectedLgu.code}
                      </span>
                    </div>
                    <p className="text-xs text-[#505F76] mt-0.5 truncate">
                      {selectedLgu.hasPort
                        ? `Coastal Municipality • Port: ${selectedLgu.portName || 'Active Pier'}`
                        : 'Inland Station Municipality'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
                {/* Quick Stats Strip */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-[#505F76] uppercase">
                      Total Checks
                    </span>
                    <p className="text-lg font-bold text-[#004AC6] mt-0.5">
                      {selectedLgu.totalSessions}
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">
                      Present
                    </span>
                    <p className="text-lg font-bold text-emerald-700 mt-0.5">
                      {selectedLgu.totalPresent}
                    </p>
                  </div>
                  <div className="bg-rose-50 rounded-2xl p-3 border border-rose-100 text-center">
                    <span className="text-[10px] font-bold text-rose-700 uppercase">
                      Absent
                    </span>
                    <p className="text-lg font-bold text-rose-700 mt-0.5">
                      {selectedLgu.totalAbsent}
                    </p>
                  </div>
                </div>

                {/* 1. Bar Chart Trend */}
                <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5 uppercase tracking-wider">
                      <BarChart3 className="w-3.5 h-3.5 text-[#004AC6]" />
                      Attendance Trend Over Time
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Present ({selectedLgu.totalPresent})
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Absent ({selectedLgu.totalAbsent})
                      </span>
                      <span className="text-[11px] font-bold text-[#004AC6] bg-[#004AC6]/10 px-2 py-0.5 rounded-full border border-[#004AC6]/20">
                        {selectedLgu.attendanceRate}% Presence
                      </span>
                    </div>
                  </div>

                  {selectedLgu.totalSessions === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No historical roll call session records available yet.
                    </div>
                  ) : (
                    <div className="h-44 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            {
                              category: 'Present',
                              count: selectedLgu.totalPresent,
                              percentage:
                                selectedLgu.totalSessions > 0
                                  ? Math.round(
                                      (selectedLgu.totalPresent /
                                        selectedLgu.totalSessions) *
                                        100
                                    )
                                  : 0,
                              fill: '#10B981',
                            },
                            {
                              category: 'Absent',
                              count: selectedLgu.totalAbsent,
                              percentage:
                                selectedLgu.totalSessions > 0
                                  ? Math.round(
                                      (selectedLgu.totalAbsent /
                                        selectedLgu.totalSessions) *
                                        100
                                    )
                                  : 0,
                              fill: '#EF4444',
                            },
                          ]}
                          margin={{ top: 12, right: 20, left: -15, bottom: 0 }}
                          barCategoryGap="18%"
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#F1F5F9"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="category"
                            tick={{ fontSize: 12, fontWeight: 700, fill: '#1E293B' }}
                            tickLine={false}
                            axisLine={{ stroke: '#E2E8F0' }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 10, fill: '#64748B' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            content={<CustomChartTooltip />}
                            cursor={{ fill: 'rgba(0, 74, 198, 0.04)' }}
                          />
                          <Bar
                            dataKey="count"
                            radius={[8, 8, 0, 0]}
                            barSize={110}
                            maxBarSize={140}
                          >
                            <Cell fill="#10B981" />
                            <Cell fill="#EF4444" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 2. Last Roll Call Conductor / Moderator Details */}
                <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-4 space-y-3">
                  <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
                    <RadioIcon className="w-3.5 h-3.5 text-[#004AC6]" />
                    Latest Roll Call Moderator Details
                  </span>

                  {selectedLgu.lastModeratorName ? (
                    <div className="flex items-center gap-3.5 bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs">
                      <OfficerAvatar
                        officer={{
                          name: selectedLgu.lastModeratorName,
                          avatarUrl: selectedLgu.lastModeratorAvatar,
                          avatarInitials: getInitials(
                            selectedLgu.lastModeratorName
                          ),
                        }}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-[#1E293B] truncate">
                          {selectedLgu.lastModeratorName}
                        </h4>
                        <p className="text-[11px] text-[#505F76] font-medium">
                          {selectedLgu.lastModeratorRole || 'Monitoring Officer'}{' '}
                          • {selectedLgu.lastFrequency || '142.500 MHz'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-bold text-[#1E293B] block">
                          {selectedLgu.lastSessionDate}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          {selectedLgu.lastSessionTime}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 py-2">
                      No recent moderator records found.
                    </div>
                  )}
                </div>

                {/* 3. Absent Dates Records */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      Absent Dates Records ({selectedLgu.absentRecords.length})
                    </span>
                  </div>

                  {selectedLgu.absentRecords.length === 0 ? (
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>
                        No absences recorded — Outstanding attendance record!
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {selectedLgu.absentRecords
                          .slice((safeAbsentPage - 1) * 5, safeAbsentPage * 5)
                          .map((rec) => (
                            <div
                              key={rec.id}
                              className="p-3 rounded-xl bg-rose-50/50 border border-rose-200 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                <div>
                                  <span className="font-bold text-rose-950 block">
                                    {rec.sessionDate} • {rec.sessionTime}
                                  </span>
                                  <span className="text-[10px] text-rose-700 font-medium">
                                    Conducted by{' '}
                                    {rec.conductedByName || 'Duty Officer'}
                                  </span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                Unresponsive
                              </span>
                            </div>
                          ))}
                      </div>

                      {totalAbsentPages > 1 && (
                        <div className="flex items-center justify-center gap-1.5 pt-1">
                          <button
                            type="button"
                            disabled={safeAbsentPage === 1}
                            onClick={() =>
                              setAbsentPage((prev) => Math.max(1, prev - 1))
                            }
                            className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#1E293B] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors cursor-pointer"
                            aria-label="Previous page"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>

                          {Array.from(
                            { length: totalAbsentPages },
                            (_, i) => i + 1
                          ).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setAbsentPage(p)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                safeAbsentPage === p
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'bg-white border border-[#E2E8F0] text-[#505F76] hover:bg-slate-50 hover:text-[#1E293B]'
                              }`}
                            >
                              {p}
                            </button>
                          ))}

                          <button
                            type="button"
                            disabled={safeAbsentPage === totalAbsentPages}
                            onClick={() =>
                              setAbsentPage((prev) =>
                                Math.min(totalAbsentPages, prev + 1)
                              )
                            }
                            className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#1E293B] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors cursor-pointer"
                            aria-label="Next page"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 4. Present Details Records */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Present Details Records ({selectedLgu.presentRecords.length})
                  </span>

                  {selectedLgu.presentRecords.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs">
                      No present responses recorded yet.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {selectedLgu.presentRecords
                          .slice(
                            (safePresentPage - 1) * 5,
                            safePresentPage * 5
                          )
                          .map((rec) => (
                            <div
                              key={rec.id}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-white transition-colors text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#1E293B]">
                                  {rec.sessionDate} • {rec.sessionTime}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Present
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-[#505F76]">
                                <span>
                                  Weather:{' '}
                                  <strong className="text-[#1E293B]">
                                    {rec.weatherStatus || 'Fair'}
                                  </strong>
                                </span>
                                {selectedLgu.hasPort && (
                                  <span>
                                    Port:{' '}
                                    <strong className="text-[#1E293B]">
                                      {rec.portStatus || 'Operational'}
                                    </strong>
                                  </span>
                                )}
                                <span>
                                  Mod:{' '}
                                  <strong className="text-[#1E293B]">
                                    {rec.conductedByName || 'Officer'}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>

                      {totalPresentPages > 1 && (
                        <div className="flex items-center justify-center gap-1.5 pt-1">
                          <button
                            type="button"
                            disabled={safePresentPage === 1}
                            onClick={() =>
                              setPresentPage((prev) => Math.max(1, prev - 1))
                            }
                            className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#1E293B] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors cursor-pointer"
                            aria-label="Previous page"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>

                          {Array.from(
                            { length: totalPresentPages },
                            (_, i) => i + 1
                          ).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPresentPage(p)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                safePresentPage === p
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-white border border-[#E2E8F0] text-[#505F76] hover:bg-slate-50 hover:text-[#1E293B]'
                              }`}
                            >
                              {p}
                            </button>
                          ))}

                          <button
                            type="button"
                            disabled={safePresentPage === totalPresentPages}
                            onClick={() =>
                              setPresentPage((prev) =>
                                Math.min(totalPresentPages, prev + 1)
                              )
                            }
                            className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#1E293B] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors cursor-pointer"
                            aria-label="Next page"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
                <SecondaryButton size="sm" pill onClick={onClose}>
                  Close Details
                </SecondaryButton>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
