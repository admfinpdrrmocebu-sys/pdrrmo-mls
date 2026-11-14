'use client';

import React from 'react';
import { BarChart3, Clock, Radio, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/skeleton';
import { OfficerAvatar } from './officer-avatar';
import {
  formatShiftStartTime,
  getInitials,
  type ActiveShiftRecord,
} from './types';

interface LogsStatusCardsProps {
  isLoading: boolean;
  isShiftActive: boolean;
  activeShift: ActiveShiftRecord | null;
  totalLogsCount: number;
}

export const LogsStatusCards = React.memo(function LogsStatusCards({
  isLoading,
  isShiftActive,
  activeShift,
  totalLogsCount,
}: LogsStatusCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
      {/* Shift Supervisor / Started By Card */}
      <div className="col-span-1 md:col-span-1 lg:col-span-7 bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden group">
        <div
          className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -mr-6 -mt-6 pointer-events-none transition-transform duration-300 group-hover:scale-110 ${
            isShiftActive ? 'bg-emerald-500/5' : 'bg-slate-500/5'
          }`}
        />

        <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
          <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-[#004AC6]" />
            Current Shift Duty
          </span>

          {isLoading ? (
            <Skeleton variant="pill" className="h-6 w-24" />
          ) : isShiftActive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              Active Shift
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[#505F76] border border-slate-200 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Shift Inactive
            </span>
          )}
        </div>

        <div className="relative z-10 flex items-center gap-4">
          {isLoading ? (
            <div className="flex items-center gap-3.5 w-full">
              <Skeleton variant="circular" className="w-12 h-12 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton variant="rounded" className="h-5 w-36" />
                <Skeleton variant="rounded" className="h-3.5 w-48" />
              </div>
            </div>
          ) : isShiftActive && activeShift ? (
            <>
              <OfficerAvatar
                officer={{
                  name: activeShift.lead_officer_name || 'Lead Officer',
                  avatarUrl: activeShift.lead_officer_avatar,
                  avatarInitials: getInitials(activeShift.lead_officer_name || ''),
                }}
                size="lg"
                className="ring-2 ring-emerald-500/20 shadow-xs shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-[#1E293B] truncate">
                    {activeShift.lead_officer_name || 'Lead Officer'}
                  </h3>
                  {activeShift.shift_label && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200 shadow-2xs shrink-0">
                      {activeShift.shift_label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#505F76] font-medium mt-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Started at{' '}
                    <strong className="text-[#1E293B] font-semibold">
                      {formatShiftStartTime(activeShift)}
                    </strong>
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200 shrink-0">
                <Clock className="w-5 h-5 text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
                  No Operational Shift Active
                </h3>
                <p className="text-xs text-[#757680] mt-0.5">
                  Duty session is currently inactive. Click &quot;Start Shift&quot; below to begin.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Stat Card */}
      <div className="col-span-1 md:col-span-1 lg:col-span-5 bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-28 h-28 bg-[#004AC6]/5 rounded-bl-[100px] -mr-6 -mt-6 pointer-events-none transition-transform duration-300 group-hover:scale-110" />

        <div className="flex justify-between items-start mb-3 relative z-10">
          <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#004AC6]" />
            Total Logs Recorded
          </span>
          <div className="w-8 h-8 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15">
            <BarChart3 className="w-4 h-4" />
          </div>
        </div>

        <div className="relative z-10 flex items-baseline justify-between gap-3">
          <div>
            {isLoading ? (
              <Skeleton variant="rounded" className="h-9 w-20" />
            ) : (
              <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1E293B]">
                {totalLogsCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Realtime Active</span>
          </div>
        </div>
      </div>
    </div>
  );
});
