'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { formatShiftStartTime, getInitials, type ActiveShiftInfo } from './types';

export interface ActiveShiftBannerProps {
  activeShift: ActiveShiftInfo | null;
}

export const ActiveShiftBanner = React.memo(function ActiveShiftBanner({
  activeShift,
}: ActiveShiftBannerProps) {
  const isShiftActive = Boolean(activeShift && activeShift.status === 'active');

  if (isShiftActive && activeShift) {
    const officerName = activeShift.lead_officer_name || 'Lead Officer';
    const officerRole = activeShift.lead_officer_role || 'Monitoring Officer';
    const officerAvatar = activeShift.lead_officer_avatar;
    const shiftTitle = activeShift.shift_label || 'Current Shift';
    const startTimeFormatted = formatShiftStartTime(activeShift.started_at, activeShift.start_time);

    return (
      <div className="w-full bg-white rounded-2xl sm:rounded-[1.75rem] border border-[#E2E8F0] p-4 sm:p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative w-12 h-12 rounded-full bg-slate-100 border border-slate-200 p-0.5 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
              {officerAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={officerAvatar}
                  alt={officerName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-[#004AC6] text-white flex items-center justify-center font-bold text-xs sm:text-sm">
                  {getInitials(officerName)}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-[#1E293B] truncate">
                  {officerName}
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15 shrink-0">
                  {officerRole}
                </span>
              </div>
              <p className="text-xs text-[#505F76] mt-0.5 font-medium truncate">
                Started shift logs • <strong className="text-[#1E293B]">{shiftTitle}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              Shift Started
            </span>

            <div className="text-right">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1E293B]">
                <Clock className="w-3.5 h-3.5 text-[#004AC6]" />
                <span>Started at {startTimeFormatted}</span>
              </div>
              <span className="text-[10px] text-[#757680] block font-medium">
                Live Log Session
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-2xl sm:rounded-[1.75rem] border border-[#E2E8F0] p-4 sm:p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400 shadow-2xs">
            <Clock className="w-5 h-5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#1E293B]">
              No Shift In Progress
            </h2>
            <p className="text-xs text-[#505F76] mt-0.5 font-medium">
              Logs have not been started • Standby mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[#505F76] border border-slate-200 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Shift Inactive
          </span>

          <div className="text-right">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1E293B]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Logs Inactive</span>
            </div>
            <span className="text-[10px] text-[#757680] block font-medium">
              Standby / Awaiting Shift
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
