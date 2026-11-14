'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  CalendarX,
  Plane,
  Search,
  X,
  Plus,
  Edit2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { getRoleBadge, matchesRole, type DayDutySchedule } from './types';

interface DayDetailsModalProps {
  selectedDaySchedule: DayDutySchedule;
  selectedRoleFilter: string;
  isSettingsViewOnly: boolean;
  onClose: () => void;
  onEditDay: (schedule: DayDutySchedule) => void;
  onOpenAddForDate: (date: Date, dateKey: string) => void;
}

export default function DayDetailsModal({
  selectedDaySchedule,
  selectedRoleFilter,
  isSettingsViewOnly,
  onClose,
  onEditDay,
  onOpenAddForDate,
}: DayDetailsModalProps) {
  const [detailsModalCategory, setDetailsModalCategory] = useState<
    'DUTY' | 'REST' | 'TRAVEL'
  >('DUTY');
  const [detailsModalShiftFilter, setDetailsModalShiftFilter] = useState<string>(
    () => {
      const defaultShift =
        selectedDaySchedule.shifts.find((s) =>
          s.scheduleName.toLowerCase().includes('default')
        ) || selectedDaySchedule.shifts[0];
      return defaultShift ? defaultShift.scheduleId : 'ALL';
    }
  );
  const [detailsSearchQuery, setDetailsSearchQuery] = useState('');
  const [debouncedDetailsSearchQuery, setDebouncedDetailsSearchQuery] =
    useState('');
  const [detailsPersonnelPages, setDetailsPersonnelPages] = useState<{
    [schedId: string]: number;
  }>({});
  const [detailsRestPage, setDetailsRestPage] = useState(1);
  const [detailsTravelPage, setDetailsTravelPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDetailsSearchQuery(detailsSearchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [detailsSearchQuery]);

  const detailsShiftOptions: CustomDropdownOption[] = useMemo(() => {
    const list: CustomDropdownOption[] = selectedDaySchedule.shifts.map(
      (shift) => ({
        value: shift.scheduleId,
        label: shift.scheduleName,
        badge: shift.timeLabel || `${shift.startTime} – ${shift.endTime}`,
        badgeColor: 'bg-blue-50 text-[#004AC6]',
        dotColor: shift.color || '#004AC6',
      })
    );
    list.push({
      value: 'ALL',
      label: 'All Shifts',
      badge: `${selectedDaySchedule.shifts.length} Shifts`,
      badgeColor: 'bg-slate-100 text-slate-700',
      dotColor: '#505F76',
    });
    return list;
  }, [selectedDaySchedule]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden z-10 flex flex-col h-[82vh] max-h-[88vh] min-h-[580px]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#1E293B]">
              {format(selectedDaySchedule.date, 'EEEE, MMMM d, yyyy')}
            </h3>
            <p className="text-xs text-[#757680]">
              Official Disaster Operations Center Roster
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Segmented Toggle Bar for Schedule, Rest Day and Travel Order */}
        <div className="px-6 pt-4 pb-3 bg-slate-50/80 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-2xl">
            <button
              type="button"
              onClick={() => setDetailsModalCategory('DUTY')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                detailsModalCategory === 'DUTY'
                  ? 'bg-white text-[#004AC6] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span className="truncate">Schedule</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  detailsModalCategory === 'DUTY'
                    ? 'bg-[#004AC6]/10 text-[#004AC6]'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {selectedDaySchedule.shifts.reduce(
                  (acc, s) => acc + (s.leadOfficer ? 1 : 0) + s.members.length,
                  0
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDetailsModalCategory('REST')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                detailsModalCategory === 'REST'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <CalendarX className="w-4 h-4 shrink-0" />
              <span className="truncate">Rest Day</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  detailsModalCategory === 'REST'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {selectedDaySchedule.restDayPersonnel.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDetailsModalCategory('TRAVEL')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                detailsModalCategory === 'TRAVEL'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Plane className="w-4 h-4 shrink-0" />
              <span className="truncate">Travel Order</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  detailsModalCategory === 'TRAVEL'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {selectedDaySchedule.travelOrderPersonnel.length}
              </span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {selectedDaySchedule.shifts.length === 0 &&
          selectedDaySchedule.restDayPersonnel.length === 0 &&
          selectedDaySchedule.travelOrderPersonnel.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1E293B]">
                  No Shifts Assigned for this Date
                </p>
                <p className="text-xs text-[#757680] mt-0.5">
                  There are no duty assignments or off-duty rotations scheduled for{' '}
                  {format(selectedDaySchedule.date, 'MMMM d, yyyy')}.
                </p>
              </div>
              {!isSettingsViewOnly && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenAddForDate(
                      selectedDaySchedule.date,
                      selectedDaySchedule.dateKey
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#004AC6] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Personnel for this Date</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* 1. Schedule Category */}
              {detailsModalCategory === 'DUTY' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="sm:w-72 shrink-0">
                        <CustomDropdown
                          value={detailsModalShiftFilter}
                          onChange={setDetailsModalShiftFilter}
                          options={detailsShiftOptions}
                          size="sm"
                          placeholder="Filter Shift..."
                        />
                      </div>

                      <div className="sm:w-80 w-full">
                        <div className="relative">
                          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={detailsSearchQuery}
                            onChange={(e) => setDetailsSearchQuery(e.target.value)}
                            placeholder="Search personnel by name or role..."
                            className="w-full bg-white border border-[#E2E8F0] rounded-xl py-2 pl-9 pr-8 text-xs text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all shadow-2xs"
                          />
                          {detailsSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setDetailsSearchQuery('');
                                setDebouncedDetailsSearchQuery('');
                              }}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#1E293B] cursor-pointer"
                              title="Clear search"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedDaySchedule.shifts
                    .filter(
                      (shift) =>
                        detailsModalShiftFilter === 'ALL' ||
                        shift.scheduleId === detailsModalShiftFilter
                    )
                    .map((shift) => {
                      const shiftColor = shift.color || '#004AC6';
                      const allOfficers = [
                        ...(shift.leadOfficer ? [shift.leadOfficer] : []),
                        ...shift.members,
                      ];
                      const query = debouncedDetailsSearchQuery
                        .trim()
                        .toLowerCase();
                      const matchingOfficers = allOfficers.filter((o) => {
                        const matchesR = matchesRole(o, selectedRoleFilter);
                        if (!matchesR) return false;
                        if (!query) return true;
                        return (
                          o.name.toLowerCase().includes(query) ||
                          o.role.toLowerCase().includes(query) ||
                          (o.badgeNumber &&
                            o.badgeNumber.toLowerCase().includes(query)) ||
                          (o.defaultShift &&
                            o.defaultShift.toLowerCase().includes(query)) ||
                          (o.userRole && o.userRole.toLowerCase().includes(query))
                        );
                      });

                      const PAGE_SIZE = 10;
                      const currentPage =
                        detailsPersonnelPages[shift.scheduleId] || 1;
                      const totalPages = Math.max(
                        1,
                        Math.ceil(matchingOfficers.length / PAGE_SIZE)
                      );
                      const safePage = Math.min(currentPage, totalPages);
                      const startIndex = (safePage - 1) * PAGE_SIZE;
                      const paginatedOfficers = matchingOfficers.slice(
                        startIndex,
                        startIndex + PAGE_SIZE
                      );

                      return (
                        <div
                          key={shift.scheduleId}
                          className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-3.5 transition-all shadow-2xs"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: shiftColor }}
                              />
                              <h4 className="text-sm sm:text-base font-bold text-[#1E293B]">
                                {shift.scheduleName}
                              </h4>
                              <span className="text-[11px] text-[#505F76] font-mono">
                                ({shift.startTime} – {shift.endTime})
                              </span>
                              {shift.targetRole && shift.targetRole !== 'ALL' && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 shadow-2xs">
                                  {shift.targetRole}
                                </span>
                              )}
                            </div>

                            <span
                              style={{
                                color: shiftColor,
                                borderColor: `${shiftColor}40`,
                              }}
                              className="text-xs font-bold bg-white px-3 py-1 rounded-full border shadow-2xs"
                            >
                              {query
                                ? `${matchingOfficers.length} of ${allOfficers.length} Personnel`
                                : `${matchingOfficers.length} Personnel`}
                            </span>
                          </div>

                          {matchingOfficers.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {paginatedOfficers.map((officer) => {
                                const isLead = shift.leadOfficer?.id === officer.id;
                                const badge = getRoleBadge(officer.userRole);
                                return (
                                  <div
                                    key={officer.id}
                                    className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 shadow-2xs transition-all hover:border-slate-300"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div
                                        className="w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: shiftColor }}
                                      >
                                        {officer.avatarInitials || 'OP'}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <p className="text-xs font-bold text-[#1E293B] truncate">
                                            {officer.name}
                                          </p>
                                          <span
                                            className={`text-[8px] font-semibold px-1 py-0.2 rounded border ${badge.badgeClass}`}
                                          >
                                            {badge.label}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-[#757680] truncate">
                                          {officer.role}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="shrink-0">
                                      {isLead ? (
                                        <span
                                          style={{
                                            color: shiftColor,
                                            backgroundColor: `${shiftColor}15`,
                                          }}
                                          className="text-[10px] font-bold px-2 py-0.5 rounded"
                                        >
                                          Lead Officer
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                          Duty Member
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                              {query
                                ? `No personnel matching "${debouncedDetailsSearchQuery}".`
                                : 'No personnel assigned to this shift.'}
                            </div>
                          )}

                          {matchingOfficers.length > PAGE_SIZE && (
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 select-none">
                              <span className="text-xs font-medium text-slate-500">
                                {startIndex + 1}–
                                {Math.min(
                                  startIndex + PAGE_SIZE,
                                  matchingOfficers.length
                                )}{' '}
                                of {matchingOfficers.length}
                              </span>
                              <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-xl border border-slate-200">
                                <button
                                  type="button"
                                  disabled={safePage <= 1}
                                  onClick={() =>
                                    setDetailsPersonnelPages((prev) => ({
                                      ...prev,
                                      [shift.scheduleId]: Math.max(1, safePage - 1),
                                    }))
                                  }
                                  className="w-7 h-7 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                                  title="Previous page"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs font-bold text-slate-700 px-1.5 font-mono">
                                  {safePage} / {totalPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={safePage >= totalPages}
                                  onClick={() =>
                                    setDetailsPersonnelPages((prev) => ({
                                      ...prev,
                                      [shift.scheduleId]: Math.min(
                                        totalPages,
                                        safePage + 1
                                      ),
                                    }))
                                  }
                                  className="w-7 h-7 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                                  title="Next page"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* 2. Rest Day Category */}
              {detailsModalCategory === 'REST' &&
                (() => {
                  const query = debouncedDetailsSearchQuery.trim().toLowerCase();
                  const matchingRest =
                    selectedDaySchedule.restDayPersonnel.filter((p) => {
                      const matchesR = matchesRole(p, selectedRoleFilter);
                      if (!matchesR) return false;
                      if (!query) return true;
                      return (
                        p.name.toLowerCase().includes(query) ||
                        p.role.toLowerCase().includes(query) ||
                        (p.badgeNumber &&
                          p.badgeNumber.toLowerCase().includes(query)) ||
                        (p.defaultShift &&
                          p.defaultShift.toLowerCase().includes(query)) ||
                        (p.userRole && p.userRole.toLowerCase().includes(query))
                      );
                    });

                  const PAGE_SIZE = 10;
                  const totalRestPages = Math.max(
                    1,
                    Math.ceil(matchingRest.length / PAGE_SIZE)
                  );
                  const safeRestPage = Math.min(detailsRestPage, totalRestPages);
                  const startRestIndex = (safeRestPage - 1) * PAGE_SIZE;
                  const paginatedRestOfficers = matchingRest.slice(
                    startRestIndex,
                    startRestIndex + PAGE_SIZE
                  );

                  return (
                    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <CalendarX className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-amber-900">
                              Rest Day / Off-Duty Personnel
                            </h4>
                            <p className="text-xs text-slate-500">
                              Scheduled rest days and time-off for this date
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shadow-2xs">
                          {query
                            ? `${matchingRest.length} of ${selectedDaySchedule.restDayPersonnel.length} Personnel`
                            : `${selectedDaySchedule.restDayPersonnel.length} Personnel`}
                        </span>
                      </div>

                      <div className="relative">
                        <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={detailsSearchQuery}
                          onChange={(e) => setDetailsSearchQuery(e.target.value)}
                          placeholder="Search rest day personnel..."
                          className="w-full bg-white border border-[#E2E8F0] rounded-xl py-2 pl-9 pr-8 text-xs text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15 hover:border-[#CBD5E1] transition-all shadow-2xs"
                        />
                        {detailsSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setDetailsSearchQuery('');
                              setDebouncedDetailsSearchQuery('');
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {matchingRest.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {paginatedRestOfficers.map((person) => {
                            const badge = getRoleBadge(person.userRole);
                            return (
                              <div
                                key={person.id}
                                className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 shadow-2xs transition-all hover:border-slate-300"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {person.avatarInitials || 'OP'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-bold text-[#1E293B] truncate">
                                        {person.name}
                                      </p>
                                      <span
                                        className={`text-[8px] font-semibold px-1 py-0.2 rounded border ${badge.badgeClass}`}
                                      >
                                        {badge.label}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-[#757680] truncate">
                                      {person.role}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Off-Duty
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          {query
                            ? `No rest day personnel matching "${debouncedDetailsSearchQuery}".`
                            : 'No personnel scheduled for rest day on this date.'}
                        </div>
                      )}

                      {matchingRest.length > PAGE_SIZE && (
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 select-none">
                          <span className="text-xs font-medium text-slate-500">
                            {startRestIndex + 1}–
                            {Math.min(
                              startRestIndex + PAGE_SIZE,
                              matchingRest.length
                            )}{' '}
                            of {matchingRest.length}
                          </span>
                          <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-xl border border-slate-200">
                            <button
                              type="button"
                              disabled={safeRestPage <= 1}
                              onClick={() =>
                                setDetailsRestPage((p) => Math.max(1, p - 1))
                              }
                              className="w-7 h-7 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                              title="Previous page"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-bold text-slate-700 px-1.5 font-mono">
                              {safeRestPage} / {totalRestPages}
                            </span>
                            <button
                              type="button"
                              disabled={safeRestPage >= totalRestPages}
                              onClick={() =>
                                setDetailsRestPage((p) =>
                                  Math.min(totalRestPages, p + 1)
                                )
                              }
                              className="w-7 h-7 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                              title="Next page"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

              {/* 3. Travel Order Category */}
              {detailsModalCategory === 'TRAVEL' &&
                (() => {
                  const query = debouncedDetailsSearchQuery.trim().toLowerCase();
                  const matchingTravel =
                    selectedDaySchedule.travelOrderPersonnel.filter((p) => {
                      const matchesR = matchesRole(p, selectedRoleFilter);
                      if (!matchesR) return false;
                      if (!query) return true;
                      return (
                        p.name.toLowerCase().includes(query) ||
                        p.role.toLowerCase().includes(query) ||
                        (p.badgeNumber &&
                          p.badgeNumber.toLowerCase().includes(query)) ||
                        (p.defaultShift &&
                          p.defaultShift.toLowerCase().includes(query)) ||
                        (p.userRole && p.userRole.toLowerCase().includes(query))
                      );
                    });

                  const PAGE_SIZE = 10;
                  const totalTravelPages = Math.max(
                    1,
                    Math.ceil(matchingTravel.length / PAGE_SIZE)
                  );
                  const safeTravelPage = Math.min(
                    detailsTravelPage,
                    totalTravelPages
                  );
                  const startTravelIndex = (safeTravelPage - 1) * PAGE_SIZE;
                  const paginatedTravelOfficers = matchingTravel.slice(
                    startTravelIndex,
                    startTravelIndex + PAGE_SIZE
                  );

                  return (
                    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                            <Plane className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-purple-900">
                              Travel Order Personnel
                            </h4>
                            <p className="text-xs text-slate-500">
                              Officers deployed on official travel orders or field
                              missions
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200 shadow-2xs">
                          {query
                            ? `${matchingTravel.length} of ${selectedDaySchedule.travelOrderPersonnel.length} Personnel`
                            : `${selectedDaySchedule.travelOrderPersonnel.length} Personnel`}
                        </span>
                      </div>

                      <div className="relative">
                        <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={detailsSearchQuery}
                          onChange={(e) => setDetailsSearchQuery(e.target.value)}
                          placeholder="Search travel order personnel..."
                          className="w-full bg-white border border-[#E2E8F0] rounded-xl py-2 pl-9 pr-8 text-xs text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 hover:border-[#CBD5E1] transition-all shadow-2xs"
                        />
                        {detailsSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setDetailsSearchQuery('');
                              setDebouncedDetailsSearchQuery('');
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {matchingTravel.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {paginatedTravelOfficers.map((person) => {
                            const badge = getRoleBadge(person.userRole);
                            return (
                              <div
                                key={person.id}
                                className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 shadow-2xs transition-all hover:border-slate-300"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {person.avatarInitials || 'OP'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-bold text-[#1E293B] truncate">
                                        {person.name}
                                      </p>
                                      <span
                                        className={`text-[8px] font-semibold px-1 py-0.2 rounded border ${badge.badgeClass}`}
                                      >
                                        {badge.label}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-[#757680] truncate">
                                      {person.role}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                  Travel Order
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          {query
                            ? `No travel order personnel matching "${debouncedDetailsSearchQuery}".`
                            : 'No personnel scheduled for travel order on this date.'}
                        </div>
                      )}

                      {matchingTravel.length > PAGE_SIZE && (
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 select-none">
                          <span className="text-xs font-medium text-slate-500">
                            {startTravelIndex + 1}–
                            {Math.min(
                              startTravelIndex + PAGE_SIZE,
                              matchingTravel.length
                            )}{' '}
                            of {matchingTravel.length}
                          </span>
                          <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-xl border border-slate-200">
                            <button
                              type="button"
                              disabled={safeTravelPage <= 1}
                              onClick={() =>
                                setDetailsTravelPage((p) => Math.max(1, p - 1))
                              }
                              className="w-7 h-7 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                              title="Previous page"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-bold text-slate-700 px-1.5 font-mono">
                              {safeTravelPage} / {totalTravelPages}
                            </span>
                            <button
                              type="button"
                              disabled={safeTravelPage >= totalTravelPages}
                              onClick={() =>
                                setDetailsTravelPage((p) =>
                                  Math.min(totalTravelPages, p + 1)
                                )
                              }
                              className="w-7 h-7 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                              title="Next page"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center shrink-0">
          {!isSettingsViewOnly ? (
            <SecondaryButton
              size="md"
              pill
              onClick={() => onEditDay(selectedDaySchedule)}
              leftIcon={<Edit2 className="w-3.5 h-3.5 text-[#004AC6]" />}
            >
              Edit Day Roster
            </SecondaryButton>
          ) : (
            <div />
          )}
          <PrimaryButton size="md" pill onClick={onClose}>
            Close
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
}
