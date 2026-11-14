'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ChevronDown,
  Check,
  Search,
  Trash2,
  CalendarCheck,
  CalendarX,
  Plane,
  Loader2,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { supabase } from '@/lib/supabase/client';
import {
  broadcastShiftSync,
  type OfficerAssignment,
  type ShiftScheduleItem,
  type DutyRosterAssignmentRecord,
} from './types';

interface AddShiftScheduleModalProps {
  initialMonth: Date;
  initialDutyDateKey?: string | null;
  profiles: OfficerAssignment[];
  shiftSchedules: ShiftScheduleItem[];
  schedulesById: Map<string, ShiftScheduleItem>;
  currentUserId: string | null;
  isSettingsViewOnly: boolean;
  onClose: () => void;
  onBatchSaved: (params: {
    savedRecords: DutyRosterAssignmentRecord[];
    targetMonthDate: Date;
    message: string;
  }) => void;
  onToast: (message: string) => void;
}

export default function AddShiftScheduleModal({
  initialMonth,
  initialDutyDateKey,
  profiles,
  shiftSchedules,
  schedulesById,
  currentUserId,
  isSettingsViewOnly,
  onClose,
  onBatchSaved,
  onToast,
}: AddShiftScheduleModalProps) {
  const twoYearMonthOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    return { currentYear, nextYear };
  }, []);

  const [scheduleMonth, setScheduleMonth] = useState(() =>
    format(initialMonth, 'yyyy-MM')
  );
  const [selectedShiftScheduleId, setSelectedShiftScheduleId] = useState(
    () => shiftSchedules[0]?.id ?? ''
  );
  const [selectedDutyDates, setSelectedDutyDates] = useState<string[]>(() =>
    initialDutyDateKey ? [initialDutyDateKey] : []
  );
  const [selectedDayOffDates, setSelectedDayOffDates] = useState<string[]>([]);
  const [selectedTravelOrderDates, setSelectedTravelOrderDates] = useState<
    string[]
  >([]);
  const [datePickerMode, setDatePickerMode] = useState<
    'DUTY' | 'DAY_OFF' | 'TRAVEL_ORDER'
  >('DUTY');

  const [monthScheduledPersonnelMap, setMonthScheduledPersonnelMap] = useState<
    Map<string, { shiftId?: string | null; shiftName?: string; count: number }>
  >(new Map());
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>(
    () => {
      const initialSched = shiftSchedules[0];
      if (!initialSched) return profiles.map((p) => p.id);
      const targetName = initialSched.name.trim().toLowerCase();
      return profiles
        .filter((p) => {
          const pShift = (p.defaultShift || '').trim().toLowerCase();
          return (
            !!pShift &&
            !!targetName &&
            (pShift === targetName ||
              pShift.startsWith(targetName) ||
              targetName.startsWith(pShift))
          );
        })
        .map((p) => p.id);
    }
  );
  const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState(false);
  const [personnelSearchQuery, setPersonnelSearchQuery] = useState('');
  const [debouncedPersonnelSearchQuery, setDebouncedPersonnelSearchQuery] =
    useState('');
  const [isSaving, setIsSaving] = useState(false);

  const shiftDropdownRef = useRef<HTMLDivElement>(null);

  const scheduleMonthDate = useMemo(() => {
    const [year, month] = scheduleMonth.split('-').map(Number);
    if (!year || !month) return new Date();
    return new Date(year, month - 1, 1);
  }, [scheduleMonth]);

  // Debounce personnel search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPersonnelSearchQuery(personnelSearchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [personnelSearchQuery]);

  // Close shift schedule dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        shiftDropdownRef.current &&
        !shiftDropdownRef.current.contains(e.target as Node)
      ) {
        setIsShiftDropdownOpen(false);
      }
    };
    if (isShiftDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isShiftDropdownOpen]);

  const computeMatchingPersonnel = useCallback(
    (schedId: string) => {
      if (!schedId) return profiles;
      const targetSched = schedulesById.get(schedId);
      if (!targetSched) return profiles;
      const targetName = (targetSched.name || '').trim().toLowerCase();
      return profiles.filter((p) => {
        const pShift = (p.defaultShift || '').trim().toLowerCase();
        if (!pShift || !targetName) return false;
        return (
          pShift === targetName ||
          pShift.startsWith(targetName) ||
          targetName.startsWith(pShift)
        );
      });
    },
    [profiles, schedulesById]
  );

  // Fetch already-scheduled personnel for selected scheduleMonth
  useEffect(() => {
    let isMounted = true;
    const fetchScheduledPersonnelForMonth = async () => {
      try {
        const mStart = format(startOfMonth(scheduleMonthDate), 'yyyy-MM-dd');
        const mEnd = format(endOfMonth(scheduleMonthDate), 'yyyy-MM-dd');

        const { data, error } = await supabase
          .from('duty_roster_assignments')
          .select('profile_id, shift_schedule_id, assignment_type')
          .gte('duty_date', mStart)
          .lte('duty_date', mEnd);

        if (!isMounted) return;

        if (!error && data) {
          const map = new Map<
            string,
            { shiftId?: string | null; shiftName?: string; count: number }
          >();
          data.forEach((row) => {
            const existing = map.get(row.profile_id);
            const schedObj = row.shift_schedule_id
              ? schedulesById.get(row.shift_schedule_id)
              : undefined;
            const sName =
              schedObj?.name ||
              (row.assignment_type === 'rest'
                ? 'Rest Day'
                : row.assignment_type === 'travel'
                ? 'Travel Order'
                : 'Duty');

            if (existing) {
              existing.count += 1;
              if (!existing.shiftName && sName) existing.shiftName = sName;
            } else {
              map.set(row.profile_id, {
                shiftId: row.shift_schedule_id,
                shiftName: sName,
                count: 1,
              });
            }
          });
          setMonthScheduledPersonnelMap(map);
          setSelectedPersonnelIds(
            computeMatchingPersonnel(selectedShiftScheduleId)
              .filter((p) => !map.has(p.id))
              .map((p) => p.id)
          );
        } else {
          const empty = new Map<
            string,
            { shiftId?: string | null; shiftName?: string; count: number }
          >();
          setMonthScheduledPersonnelMap(empty);
        }
      } catch (err) {
        console.warn('Error fetching month scheduled personnel:', err);
      }
    };

    void fetchScheduledPersonnelForMonth();
    return () => {
      isMounted = false;
    };
  }, [
    scheduleMonth,
    scheduleMonthDate,
    schedulesById,
    selectedShiftScheduleId,
    computeMatchingPersonnel,
  ]);

  const filteredPersonnel = useMemo(
    () => computeMatchingPersonnel(selectedShiftScheduleId),
    [computeMatchingPersonnel, selectedShiftScheduleId]
  );

  const sortedVisiblePersonnel = useMemo(() => {
    const unassigned: OfficerAssignment[] = [];
    const alreadyScheduled: OfficerAssignment[] = [];

    filteredPersonnel.forEach((officer) => {
      if (monthScheduledPersonnelMap.has(officer.id)) {
        alreadyScheduled.push(officer);
      } else {
        unassigned.push(officer);
      }
    });

    return [...unassigned, ...alreadyScheduled];
  }, [filteredPersonnel, monthScheduledPersonnelMap]);

  const searchedSortedPersonnel = useMemo(() => {
    if (!debouncedPersonnelSearchQuery.trim()) {
      return sortedVisiblePersonnel;
    }
    const q = debouncedPersonnelSearchQuery.trim().toLowerCase();
    return sortedVisiblePersonnel.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const role = (p.role || '').toLowerCase();
      const badge = (p.badgeNumber || '').toLowerCase();
      const shift = (p.defaultShift || '').toLowerCase();
      return (
        name.includes(q) ||
        role.includes(q) ||
        badge.includes(q) ||
        shift.includes(q)
      );
    });
  }, [sortedVisiblePersonnel, debouncedPersonnelSearchQuery]);

  const selectedShiftSchedule = useMemo(
    () => shiftSchedules.find((s) => s.id === selectedShiftScheduleId),
    [shiftSchedules, selectedShiftScheduleId]
  );

  const handleShiftScheduleChange = (newSchedId: string) => {
    setSelectedShiftScheduleId(newSchedId);
    setSelectedPersonnelIds(
      computeMatchingPersonnel(newSchedId)
        .filter((p) => !monthScheduledPersonnelMap.has(p.id))
        .map((p) => p.id)
    );
  };

  const handlePrevScheduleMonth = () => {
    const [y, m] = scheduleMonth.split('-').map(Number);
    const prevDate = subMonths(new Date(y, m - 1, 1), 1);
    const prevStr = format(prevDate, 'yyyy-MM');
    const minStr = `${twoYearMonthOptions.currentYear}-01`;
    if (prevStr >= minStr) {
      setScheduleMonth(prevStr);
      setSelectedDutyDates([]);
      setSelectedDayOffDates([]);
      setSelectedTravelOrderDates([]);
    }
  };

  const handleNextScheduleMonth = () => {
    const [y, m] = scheduleMonth.split('-').map(Number);
    const nextDate = addMonths(new Date(y, m - 1, 1), 1);
    const nextStr = format(nextDate, 'yyyy-MM');
    const maxStr = `${twoYearMonthOptions.nextYear}-12`;
    if (nextStr <= maxStr) {
      setScheduleMonth(nextStr);
      setSelectedDutyDates([]);
      setSelectedDayOffDates([]);
      setSelectedTravelOrderDates([]);
    }
  };

  const handleTogglePersonnel = (id: string) => {
    if (monthScheduledPersonnelMap.has(id)) return;
    setSelectedPersonnelIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const pickerCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(scheduleMonthDate);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((d) => {
      const dateKey = format(d, 'yyyy-MM-dd');
      return {
        date: d,
        dateKey,
        dayNum: d.getDate(),
        isCurrentMonth: isSameMonth(d, scheduleMonthDate),
        isToday: isToday(d),
        isDuty: selectedDutyDates.includes(dateKey),
        isDayOff: selectedDayOffDates.includes(dateKey),
        isTravelOrder: selectedTravelOrderDates.includes(dateKey),
        dayOfWeek: d.getDay(),
      };
    });
  }, [
    scheduleMonthDate,
    selectedDutyDates,
    selectedDayOffDates,
    selectedTravelOrderDates,
  ]);

  const pickerMonthDays = useMemo(
    () => pickerCalendarDays.filter((d) => d.isCurrentMonth),
    [pickerCalendarDays]
  );

  const handleTogglePickerDate = (dateKey: string) => {
    if (datePickerMode === 'DUTY') {
      if (selectedDutyDates.includes(dateKey)) {
        setSelectedDutyDates((prev) => prev.filter((d) => d !== dateKey));
      } else {
        setSelectedDutyDates((prev) => [...prev, dateKey].sort());
        setSelectedDayOffDates((prev) => prev.filter((d) => d !== dateKey));
        setSelectedTravelOrderDates((prev) => prev.filter((d) => d !== dateKey));
      }
    } else if (datePickerMode === 'DAY_OFF') {
      if (selectedDayOffDates.includes(dateKey)) {
        setSelectedDayOffDates((prev) => prev.filter((d) => d !== dateKey));
      } else {
        setSelectedDayOffDates((prev) => [...prev, dateKey].sort());
        setSelectedDutyDates((prev) => prev.filter((d) => d !== dateKey));
        setSelectedTravelOrderDates((prev) => prev.filter((d) => d !== dateKey));
      }
    } else if (datePickerMode === 'TRAVEL_ORDER') {
      if (selectedTravelOrderDates.includes(dateKey)) {
        setSelectedTravelOrderDates((prev) => prev.filter((d) => d !== dateKey));
      } else {
        setSelectedTravelOrderDates((prev) => [...prev, dateKey].sort());
        setSelectedDutyDates((prev) => prev.filter((d) => d !== dateKey));
        setSelectedDayOffDates((prev) => prev.filter((d) => d !== dateKey));
      }
    }
  };

  const handleClearAllDates = () => {
    setSelectedDutyDates([]);
    setSelectedDayOffDates([]);
    setSelectedTravelOrderDates([]);
  };

  const handleSaveShiftSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSettingsViewOnly) {
      onToast('You have view-only access. Modifying rosters is restricted.');
      return;
    }
    if (shiftSchedules.length === 0) {
      onToast(
        'No shift schedules available in system. Please add shift schedules in Access Control first.'
      );
      return;
    }
    if (!selectedShiftScheduleId) {
      onToast('Please select a valid shift schedule.');
      return;
    }

    const targetPersonnelIds = selectedPersonnelIds.filter(
      (id) => !monthScheduledPersonnelMap.has(id)
    );

    if (targetPersonnelIds.length === 0) {
      onToast(
        'Please select at least one available personnel member who is not already scheduled.'
      );
      return;
    }
    if (
      selectedDutyDates.length === 0 &&
      selectedDayOffDates.length === 0 &&
      selectedTravelOrderDates.length === 0
    ) {
      onToast('Please select at least one duty, day off, or travel order date.');
      return;
    }

    try {
      setIsSaving(true);
      const records: DutyRosterAssignmentRecord[] = [];

      for (const profileId of targetPersonnelIds) {
        for (const dateStr of selectedDutyDates) {
          records.push({
            profile_id: profileId,
            shift_schedule_id: selectedShiftScheduleId,
            duty_date: dateStr,
            assignment_type: 'duty',
            is_lead: false,
            created_by: currentUserId,
          });
        }
        for (const dateStr of selectedDayOffDates) {
          records.push({
            profile_id: profileId,
            shift_schedule_id: null,
            duty_date: dateStr,
            assignment_type: 'rest',
            is_lead: false,
            created_by: currentUserId,
          });
        }
        for (const dateStr of selectedTravelOrderDates) {
          records.push({
            profile_id: profileId,
            shift_schedule_id: null,
            duty_date: dateStr,
            assignment_type: 'travel',
            is_lead: false,
            created_by: currentUserId,
          });
        }
      }

      const { data: upsertedData, error } = await supabase
        .from('duty_roster_assignments')
        .upsert(records, { onConflict: 'profile_id,duty_date' })
        .select('*');

      if (error) {
        console.warn('Upsert error:', error.message);
        onToast(`Error saving roster: ${error.message}`);
        return;
      }

      const effectiveRecords =
        upsertedData && upsertedData.length > 0
          ? (upsertedData as DutyRosterAssignmentRecord[])
          : records;

      const targetSched = schedulesById.get(selectedShiftScheduleId);
      broadcastShiftSync();
      onBatchSaved({
        savedRecords: effectiveRecords,
        targetMonthDate: scheduleMonthDate,
        message: `Configured ${targetSched?.name || 'Shift'}: ${
          targetPersonnelIds.length
        } personnel (${selectedDutyDates.length} Duty, ${
          selectedDayOffDates.length
        } Day Off, ${selectedTravelOrderDates.length} Travel Order)`,
      });
    } catch (err) {
      console.error('Error saving shift assignments:', err);
      onToast('Failed to save shift assignments.');
    } finally {
      setIsSaving(false);
    }
  };

  const unscheduledDaysCount = Math.max(
    0,
    pickerMonthDays.length -
      selectedDutyDates.length -
      selectedDayOffDates.length -
      selectedTravelOrderDates.length
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !isSaving && onClose()}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#1E293B]">
              Add Shift Schedule
            </h3>
            <p className="text-xs text-[#757680]">
              Configure multi-date duty rotations and day-off schedules for
              designated shift personnel
            </p>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form
          onSubmit={handleSaveShiftSchedule}
          className="p-6 space-y-5 overflow-y-auto flex-1"
        >
          {/* 1. Month of Schedule & Shift Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
            <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-3 sm:p-3.5 space-y-2 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-[#004AC6]" />
                  <label className="text-xs font-bold text-[#1E293B] uppercase tracking-wide">
                    Month of Schedule
                  </label>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200/60">
                  {scheduleMonth.startsWith(String(twoYearMonthOptions.currentYear))
                    ? `${twoYearMonthOptions.currentYear}`
                    : `${twoYearMonthOptions.nextYear} Advance`}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 bg-white border border-[#E2E8F0] rounded-xl p-1.5 shadow-2xs h-12">
                <button
                  type="button"
                  onClick={handlePrevScheduleMonth}
                  disabled={scheduleMonth <= `${twoYearMonthOptions.currentYear}-01`}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#505F76] hover:bg-slate-100 hover:text-[#1E293B] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent shrink-0"
                  aria-label="Previous Month"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex-1 flex items-center justify-center px-1">
                  <span className="text-xs sm:text-sm font-bold text-[#1E293B] select-none text-center truncate">
                    {format(scheduleMonthDate, 'MMMM yyyy')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleNextScheduleMonth}
                  disabled={scheduleMonth >= `${twoYearMonthOptions.nextYear}-12`}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#505F76] hover:bg-slate-100 hover:text-[#1E293B] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent shrink-0"
                  aria-label="Next Month"
                  title="Next Month"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div
              className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-3 sm:p-3.5 space-y-2 shadow-2xs flex flex-col justify-between relative"
              ref={shiftDropdownRef}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#004AC6]" />
                  <label className="text-xs font-bold text-[#1E293B] uppercase tracking-wide">
                    Shift Schedule
                  </label>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200/60">
                  {shiftSchedules.length} Available
                </span>
              </div>

              {shiftSchedules.length > 0 ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsShiftDropdownOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-2.5 bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 shadow-2xs h-12 hover:border-[#004AC6]/60 transition-all cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{
                          backgroundColor:
                            selectedShiftSchedule?.color || '#004AC6',
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-[#1E293B] truncate">
                            {selectedShiftSchedule?.name || 'Select Shift Schedule'}
                          </span>
                          {selectedShiftSchedule?.targetRole && (
                            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-blue-50 text-[#004AC6] border border-blue-200/60 shrink-0">
                              {selectedShiftSchedule.targetRole}
                            </span>
                          )}
                        </div>
                        {selectedShiftSchedule && (
                          <div className="text-[11px] text-[#505F76] font-medium flex items-center gap-1.5 truncate mt-0.5 leading-none">
                            <span>{selectedShiftSchedule.time}</span>
                            {selectedShiftSchedule.duration && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-[#757680]">
                                  {selectedShiftSchedule.duration}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronDown
                      className={`w-4 h-4 text-[#757680] shrink-0 transition-transform duration-200 ${
                        isShiftDropdownOpen ? 'rotate-180 text-[#004AC6]' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isShiftDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-[#CBD5E1] rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto p-1.5 space-y-1"
                      >
                        {shiftSchedules.map((sched) => {
                          const isSelected = selectedShiftScheduleId === sched.id;
                          const color = sched.color || '#004AC6';

                          return (
                            <button
                              key={sched.id}
                              type="button"
                              onClick={() => {
                                handleShiftScheduleChange(sched.id);
                                setIsShiftDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50/90 text-[#004AC6] font-bold border border-blue-200/60'
                                  : 'hover:bg-slate-100 text-[#1E293B]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                  style={{ backgroundColor: color }}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold truncate">
                                      {sched.name}
                                    </span>
                                    {sched.targetRole && (
                                      <span className="text-[9px] uppercase font-semibold px-1.5 py-0.2 rounded bg-slate-200/70 text-[#505F76]">
                                        {sched.targetRole}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#505F76] font-normal flex items-center gap-1.5 truncate mt-0.5">
                                    <span>{sched.time}</span>
                                    {sched.duration && (
                                      <>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-[#757680]">
                                          {sched.duration}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-full bg-[#004AC6] text-white flex items-center justify-center shadow-2xs">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-4 h-4 rounded-full border border-slate-300" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  No shift schedules found. Please create one in{' '}
                  <strong>Settings → Access Control</strong>.
                </div>
              )}
            </div>
          </div>

          {/* 2. Assigned Personnel Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                Assigned Personnel
              </label>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#757680] pointer-events-none" />
                <input
                  type="text"
                  value={personnelSearchQuery}
                  onChange={(e) => setPersonnelSearchQuery(e.target.value)}
                  placeholder="Search personnel..."
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl pl-8 pr-7 py-1.5 text-xs text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all placeholder:text-[#94A3B8]"
                />
                {personnelSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setPersonnelSearchQuery('');
                      setDebouncedPersonnelSearchQuery('');
                    }}
                    className="w-4 h-4 rounded-full flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 text-[#757680] hover:text-[#1E293B] cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5 max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {searchedSortedPersonnel.length > 0 ? (
                searchedSortedPersonnel.map((officer) => {
                  const isAlreadyScheduled = monthScheduledPersonnelMap.has(
                    officer.id
                  );
                  const scheduledInfo = monthScheduledPersonnelMap.get(
                    officer.id
                  );
                  const isChecked =
                    isAlreadyScheduled ||
                    selectedPersonnelIds.includes(officer.id);

                  return (
                    <label
                      key={officer.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all select-none ${
                        isAlreadyScheduled
                          ? 'shift-personnel-card-disabled cursor-not-allowed opacity-85'
                          : isChecked
                          ? 'bg-white border-[#004AC6]/50 shadow-xs ring-1 ring-[#004AC6]/25 cursor-pointer'
                          : 'bg-white/60 border-[#E2E8F0] opacity-80 hover:opacity-100 hover:bg-white cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isAlreadyScheduled}
                          onChange={() => handleTogglePersonnel(officer.id)}
                          className={`w-4 h-4 rounded shrink-0 ${
                            isAlreadyScheduled
                              ? 'shift-personnel-checkbox-disabled cursor-not-allowed'
                              : 'text-[#004AC6] focus:ring-[#004AC6] cursor-pointer'
                          }`}
                        />
                        <div className="min-w-0">
                          <span
                            className={`text-xs font-bold block truncate ${
                              isAlreadyScheduled
                                ? 'shift-personnel-text-disabled'
                                : 'text-[#1E293B]'
                            }`}
                          >
                            {officer.name}
                          </span>
                          <span
                            className={`text-[11px] block truncate ${
                              isAlreadyScheduled
                                ? 'shift-personnel-subtext-disabled'
                                : 'text-[#757680]'
                            }`}
                          >
                            {officer.role} ·{' '}
                            <span className="font-mono">{officer.badgeNumber}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        {isAlreadyScheduled ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded shadow-2xs shift-personnel-badge-disabled">
                            {scheduledInfo?.shiftName
                              ? `Scheduled: ${scheduledInfo.shiftName}`
                              : 'Already Scheduled'}
                          </span>
                        ) : officer.defaultShift ? (
                          <span className="text-[10px] font-bold text-[#004AC6] bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded">
                            {officer.defaultShift}
                          </span>
                        ) : null}
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="col-span-full py-5 text-center text-xs text-slate-500 space-y-1">
                  {debouncedPersonnelSearchQuery.trim() ? (
                    <>
                      <p>
                        No personnel matching &quot;{debouncedPersonnelSearchQuery}
                        &quot;.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPersonnelSearchQuery('');
                          setDebouncedPersonnelSearchQuery('');
                        }}
                        className="text-[#004AC6] font-semibold hover:underline cursor-pointer"
                      >
                        Clear search query
                      </button>
                    </>
                  ) : (
                    <p>No personnel currently assigned to this shift schedule.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Unified Multi-Date Picker Card */}
          <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#004AC6]" />
                  <h4 className="text-sm font-bold text-[#1E293B]">
                    Schedule Dates Multi-Picker (
                    {format(scheduleMonthDate, 'MMMM yyyy')})
                  </h4>
                </div>
                <p className="text-[11px] text-[#505F76] mt-0.5">
                  Click any date to assign it as Duty (Blue), Day Off (Amber), or
                  Travel Order (Purple).
                </p>
              </div>

              <button
                type="button"
                onClick={handleClearAllDates}
                className="text-[11px] text-slate-500 hover:text-red-600 font-semibold flex items-center gap-1 transition-colors self-end sm:self-auto cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Reset All Dates
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 p-1 bg-slate-200/80 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setDatePickerMode('DUTY')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  datePickerMode === 'DUTY'
                    ? 'bg-[#004AC6] text-white shadow-sm ring-2 ring-[#004AC6]/30'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Duty Schedule</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    datePickerMode === 'DUTY'
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {selectedDutyDates.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDatePickerMode('DAY_OFF')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  datePickerMode === 'DAY_OFF'
                    ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-600/30'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <CalendarX className="w-3.5 h-3.5" />
                <span>Day Off</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    datePickerMode === 'DAY_OFF'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {selectedDayOffDates.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDatePickerMode('TRAVEL_ORDER')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  datePickerMode === 'TRAVEL_ORDER'
                    ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-600/30'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Plane className="w-3.5 h-3.5" />
                <span>Travel Order</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    datePickerMode === 'TRAVEL_ORDER'
                      ? 'bg-white/20 text-white'
                      : 'bg-purple-500/15 text-purple-700'
                  }`}
                >
                  {selectedTravelOrderDates.length}
                </span>
              </button>
            </div>

            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                datePickerMode === 'DUTY'
                  ? 'bg-blue-50/90 border-blue-200 text-[#004AC6]'
                  : datePickerMode === 'DAY_OFF'
                  ? 'bg-amber-50/90 border-amber-200 text-amber-800'
                  : 'bg-purple-500/10 border-purple-300/60 text-purple-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold">
                  {datePickerMode === 'DUTY'
                    ? '🔵 Duty Mode:'
                    : datePickerMode === 'DAY_OFF'
                    ? '🟠 Day Off Mode:'
                    : '🟣 Travel Order Mode:'}
                </span>
                <span>
                  {datePickerMode === 'DUTY'
                    ? 'Click dates on the calendar to mark them as Active Duty.'
                    : datePickerMode === 'DAY_OFF'
                    ? 'Click dates on the calendar to mark them as Scheduled Day Off.'
                    : 'Click dates on the calendar to mark them as Official Travel Order.'}
                </span>
              </div>
            </div>

            <div className="bg-white border border-[#CBD5E1] rounded-2xl p-3 shadow-2xs overflow-hidden">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#505F76] uppercase tracking-wider pb-2 border-b border-slate-100">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              <div className="grid grid-cols-7 gap-1.5 pt-2">
                {pickerCalendarDays.map((cell) => {
                  const {
                    dateKey,
                    dayNum,
                    isCurrentMonth,
                    isDuty,
                    isDayOff,
                    isTravelOrder,
                  } = cell;

                  if (!isCurrentMonth) {
                    return (
                      <div
                        key={dateKey}
                        className="h-10 rounded-xl flex items-center justify-center text-xs text-slate-300 bg-slate-50/40 border border-dashed border-slate-200 cursor-not-allowed select-none"
                      >
                        {dayNum}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => handleTogglePickerDate(dateKey)}
                      className={`h-11 rounded-xl flex flex-col items-center justify-center text-xs transition-all relative cursor-pointer font-bold select-none ${
                        isDuty
                          ? 'bg-[#004AC6] text-white shadow-2xs hover:bg-[#003ca3] ring-2 ring-[#004AC6]/30'
                          : isDayOff
                          ? 'bg-amber-600 text-white shadow-2xs hover:bg-amber-700 ring-2 ring-amber-600/30'
                          : isTravelOrder
                          ? 'bg-purple-600 text-white shadow-2xs hover:bg-purple-700 ring-2 ring-purple-600/30'
                          : 'bg-[#F8FAFC] text-slate-700 hover:bg-slate-200/80 border border-[#E2E8F0]'
                      }`}
                    >
                      <span className="leading-tight">{dayNum}</span>
                      <span
                        className={`text-[8px] uppercase tracking-tighter leading-none mt-0.5 ${
                          isDuty || isDayOff || isTravelOrder
                            ? 'text-white/90 font-medium'
                            : 'text-slate-400 font-normal'
                        }`}
                      >
                        {isDuty
                          ? 'Duty'
                          : isDayOff
                          ? 'Off'
                          : isTravelOrder
                          ? 'Travel'
                          : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                <div className="p-3 rounded-2xl border metric-card-duty flex flex-col justify-between transition-all">
                  <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                    <span className="truncate">Duty Days</span>
                    <CalendarCheck className="w-3.5 h-3.5 shrink-0 opacity-90" />
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-lg sm:text-xl font-black">
                      {selectedDutyDates.length}
                    </span>
                    <span className="text-[11px] font-semibold opacity-80">
                      {selectedDutyDates.length === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border metric-card-dayoff flex flex-col justify-between transition-all">
                  <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                    <span className="truncate">Day Off</span>
                    <CalendarX className="w-3.5 h-3.5 shrink-0 opacity-90" />
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-lg sm:text-xl font-black">
                      {selectedDayOffDates.length}
                    </span>
                    <span className="text-[11px] font-semibold opacity-80">
                      {selectedDayOffDates.length === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border metric-card-travel flex flex-col justify-between transition-all">
                  <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                    <span className="truncate">Travel Order</span>
                    <Plane className="w-3.5 h-3.5 shrink-0 opacity-90" />
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-lg sm:text-xl font-black">
                      {selectedTravelOrderDates.length}
                    </span>
                    <span className="text-[11px] font-semibold opacity-80">
                      {selectedTravelOrderDates.length === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border metric-card-unscheduled flex flex-col justify-between transition-all">
                  <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                    <span className="truncate">Unscheduled</span>
                    <CalendarDays className="w-3.5 h-3.5 shrink-0 opacity-90" />
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-lg sm:text-xl font-black">
                      {unscheduledDaysCount}
                    </span>
                    <span className="text-[11px] font-semibold opacity-80">
                      {unscheduledDaysCount === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0">
            <SecondaryButton
              type="button"
              size="md"
              pill
              disabled={isSaving}
              onClick={onClose}
            >
              Cancel
            </SecondaryButton>

            <PrimaryButton
              type="submit"
              size="md"
              pill
              disabled={isSaving || shiftSchedules.length === 0}
              leftIcon={
                isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )
              }
            >
              {isSaving ? 'Saving Roster...' : 'Save Shift Schedule'}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
