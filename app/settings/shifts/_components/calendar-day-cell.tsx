'use client';

import React, { useMemo } from 'react';
import { Edit2, Plane } from 'lucide-react';
import { matchesRole, type DayDutySchedule } from './types';

interface CalendarDayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isCurrentDay: boolean;
  schedule: DayDutySchedule;
  selectedShiftFilter: string;
  selectedRoleFilter: string;
  isSettingsViewOnly: boolean;
  onSelectDay: (dateKey: string) => void;
  onEditDay: (schedule: DayDutySchedule) => void;
}

const CalendarDayCell = React.memo(function CalendarDayCell({
  date,
  isCurrentMonth,
  isCurrentDay,
  schedule,
  selectedShiftFilter,
  selectedRoleFilter,
  isSettingsViewOnly,
  onSelectDay,
  onEditDay,
}: CalendarDayCellProps) {
  const dayNum = date.getDate();

  // Filter shifts based on selectedShiftFilter
  const visibleShifts = useMemo(() => {
    if (selectedShiftFilter === 'ALL') return schedule.shifts;
    const filterLower = selectedShiftFilter.toLowerCase();
    return schedule.shifts.filter(
      (shift) =>
        shift.scheduleId === selectedShiftFilter ||
        shift.scheduleName.toLowerCase().includes(filterLower)
    );
  }, [schedule.shifts, selectedShiftFilter]);

  const matchingTravelPersonnel = useMemo(
    () =>
      schedule.travelOrderPersonnel.filter((o) =>
        matchesRole(o, selectedRoleFilter)
      ),
    [schedule.travelOrderPersonnel, selectedRoleFilter]
  );

  return (
    <div
      onClick={() => onSelectDay(schedule.dateKey)}
      className={`min-h-[140px] p-2 sm:p-2.5 border-r border-[#E2E8F0] last:border-r-0 transition-all flex flex-col justify-between cursor-pointer group ${
        !isCurrentMonth
          ? 'bg-slate-50/50 opacity-40 hover:opacity-80'
          : 'bg-white hover:bg-slate-50/80'
      } ${isCurrentDay ? 'ring-2 ring-[#004AC6] ring-inset bg-blue-50/20' : ''}`}
    >
      {/* Cell Header: Date Number & Status Indicator */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
            isCurrentDay
              ? 'bg-[#004AC6] text-white shadow-2xs'
              : isCurrentMonth
              ? 'text-[#1E293B]'
              : 'text-slate-400'
          }`}
        >
          {dayNum}
        </span>

        {isCurrentDay && (
          <span className="text-[10px] font-bold text-[#004AC6] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
            Today
          </span>
        )}
      </div>

      {/* List of Dynamic Shifts Assigned for this day */}
      <div className="space-y-1.5 flex-1">
        {visibleShifts.map((shift) => {
          const allOfficers = [
            ...(shift.leadOfficer ? [shift.leadOfficer] : []),
            ...shift.members,
          ];
          const matchingOfficers = allOfficers.filter((o) =>
            matchesRole(o, selectedRoleFilter)
          );

          if (matchingOfficers.length === 0) {
            if (selectedRoleFilter !== 'ALL' && allOfficers.length > 0) {
              return (
                <div
                  key={shift.scheduleId}
                  className="p-1 rounded-md bg-slate-50 border border-dashed border-slate-200 text-[10px] text-slate-400 truncate"
                >
                  {shift.scheduleName}: No {selectedRoleFilter}
                </div>
              );
            }
            return null;
          }

          const primaryOfficer = matchingOfficers[0];
          const extraOfficers = matchingOfficers.slice(1);
          const shiftColor = shift.color || '#004AC6';

          return (
            <div
              key={shift.scheduleId}
              style={{
                backgroundColor: `${shiftColor}12`,
                borderColor: `${shiftColor}35`,
              }}
              className="p-1.5 rounded-lg border text-[11px] leading-tight transition-all hover:brightness-95"
            >
              <div className="flex items-center justify-between text-[10px] font-bold mb-0.5">
                <span className="truncate max-w-[90px]" style={{ color: shiftColor }}>
                  {shift.scheduleName}
                </span>
                <span className="font-mono text-[9px] text-[#505F76] shrink-0 ml-1">
                  {shift.startTime?.replace(/H/gi, '')}–
                  {shift.endTime?.replace(/H/gi, '')}
                </span>
              </div>
              <p className="font-semibold text-[#1E293B] truncate">
                {primaryOfficer.name}
              </p>
              {extraOfficers.length > 0 && (
                <p className="text-[10px] text-[#505F76] truncate">
                  +{extraOfficers.map((m) => m.name.split(' ')[0]).join(', ')}
                </p>
              )}
            </div>
          );
        })}

        {/* Travel Order Indicator in Calendar Cell */}
        {matchingTravelPersonnel.length > 0 && (
          <div className="p-1.5 rounded-lg border bg-purple-500/10 border-purple-300/60 text-[11px] leading-tight transition-all hover:brightness-95">
            <div className="flex items-center justify-between text-[10px] font-bold mb-0.5 text-purple-700">
              <span className="truncate flex items-center gap-1">
                <Plane className="w-2.5 h-2.5 shrink-0" />
                Travel Order
              </span>
              <span className="font-mono text-[9px] text-purple-600 shrink-0 ml-1">
                TO
              </span>
            </div>
            <p className="font-semibold text-[#1E293B] truncate">
              {matchingTravelPersonnel[0].name}
            </p>
            {matchingTravelPersonnel.length > 1 && (
              <p className="text-[10px] text-purple-700 truncate">
                +
                {matchingTravelPersonnel
                  .slice(1)
                  .map((m) => m.name.split(' ')[0])
                  .join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer Controls on Hover */}
      <div className="mt-1 flex items-center justify-between text-[10px] text-[#004AC6] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
        {!isSettingsViewOnly ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditDay(schedule);
            }}
            className="flex items-center gap-0.5 text-[#004AC6] hover:underline cursor-pointer font-bold"
          >
            <Edit2 className="w-2.5 h-2.5" />
            <span>Edit</span>
          </button>
        ) : (
          <span />
        )}
        <span className="text-[#505F76] font-medium">Details →</span>
      </div>
    </div>
  );
});

export default CalendarDayCell;
