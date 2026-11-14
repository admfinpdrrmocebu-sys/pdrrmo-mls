'use client';

import React from 'react';
import { Edit2, Shield, Trash2 } from 'lucide-react';
import { ShiftScheduleItem, calculateDuration, formatTimeDisplay } from './types';

export interface ShiftCardProps {
  shift: ShiftScheduleItem;
  roleDisplayName: string;
  isAccessViewOnly: boolean;
  onEdit: (shift: ShiftScheduleItem) => void;
  onDelete: (shift: ShiftScheduleItem) => void;
}

export const ShiftCard = React.memo(function ShiftCard({
  shift,
  roleDisplayName,
  isAccessViewOnly,
  onEdit,
  onDelete,
}: ShiftCardProps) {
  const durationText =
    calculateDuration(shift.startTime, shift.endTime) || shift.duration;

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 relative overflow-hidden group">
      {/* Header: Shift Name, Sequence Badge & Target Role, Actions */}
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-[#1E293B]">{shift.name}</h3>
            {shift.sortOrder === 0 || shift.sortOrder == null ? (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-[#505F76] border border-slate-200">
                Default Schedule
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200/60 font-mono">
                Monitoring Sequence #{shift.sortOrder}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#505F76] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active Roster
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200/60">
              <Shield className="w-3 h-3 text-[#004AC6]" />
              {roleDisplayName}
            </span>
          </div>
        </div>

        {/* Edit & Delete Actions */}
        {!isAccessViewOnly && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(shift)}
              title="Edit Shift Schedule"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#004AC6]/10 transition-colors cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(shift)}
              title="Delete Shift Schedule"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Time Breakdown Card */}
      <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0] space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-[#757680] uppercase tracking-wider">
              Start Shift
            </div>
            <div className="text-sm font-bold text-[#1E293B] font-mono">
              {formatTimeDisplay(shift.startTime)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-[#757680] uppercase tracking-wider">
              End Shift
            </div>
            <div className="text-sm font-bold text-[#1E293B] font-mono">
              {formatTimeDisplay(shift.endTime)}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-[#E2E8F0]/80 flex items-center justify-between text-xs text-[#505F76]">
          <span>Shift Duration:</span>
          <span className="font-bold text-[#004AC6] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60 font-mono">
            {durationText}
          </span>
        </div>
      </div>
    </div>
  );
});
