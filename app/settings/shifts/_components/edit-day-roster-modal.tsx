'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Edit2,
  X,
  CalendarDays,
  CalendarX,
  Plane,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { supabase } from '@/lib/supabase/client';
import PersonnelMultiSelectDropdown from './personnel-multi-select-dropdown';
import {
  getRoleBadge,
  broadcastShiftSync,
  type OfficerAssignment,
  type ShiftScheduleItem,
  type DutyRosterAssignmentRecord,
  type EditDayAssignment,
} from './types';

interface EditDayRosterModalProps {
  editingDayDate: Date;
  initialAssignments: EditDayAssignment[];
  profiles: OfficerAssignment[];
  profilesById: Map<string, OfficerAssignment>;
  effectiveShiftSchedules: ShiftScheduleItem[];
  shiftRotationDropdownOptions: CustomDropdownOption[];
  currentUserId: string | null;
  isSettingsViewOnly: boolean;
  onClose: () => void;
  onSavedDay: (
    dateKey: string,
    updatedRows: DutyRosterAssignmentRecord[],
    message: string
  ) => void;
  onToast: (message: string) => void;
}

export default function EditDayRosterModal({
  editingDayDate,
  initialAssignments,
  profiles,
  profilesById,
  effectiveShiftSchedules,
  shiftRotationDropdownOptions,
  currentUserId,
  isSettingsViewOnly,
  onClose,
  onSavedDay,
  onToast,
}: EditDayRosterModalProps) {
  const [editingDayAssignments, setEditingDayAssignments] =
    useState<EditDayAssignment[]>(() => initialAssignments);
  const [isSavingDay, setIsSavingDay] = useState(false);
  const [editModalCategory, setEditModalCategory] = useState<
    'DUTY' | 'REST' | 'TRAVEL'
  >('DUTY');
  const [editModalShiftFilter, setEditModalShiftFilter] = useState<string>(
    () => effectiveShiftSchedules[0]?.id || 'ALL'
  );
  const [displayedPersonnelSearch, setDisplayedPersonnelSearch] = useState('');
  const [debouncedDisplayedSearch, setDebouncedDisplayedSearch] = useState('');
  const [shiftPersonnelPages, setShiftPersonnelPages] = useState<{
    [schedId: string]: number;
  }>({});
  const [restPersonnelPage, setRestPersonnelPage] = useState(1);
  const [travelPersonnelPage, setTravelPersonnelPage] = useState(1);

  // Debounce Edit Day modal search by 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDisplayedSearch(displayedPersonnelSearch);
    }, 200);
    return () => clearTimeout(timer);
  }, [displayedPersonnelSearch]);

  const handleAddMultipleOfficersToShift = (
    shiftScheduleId: string,
    profileIds: string[]
  ) => {
    if (isSettingsViewOnly || profileIds.length === 0) return;
    const profileIdSet = new Set(profileIds);
    setEditingDayAssignments((prev) => {
      const filtered = prev.filter((a) => !profileIdSet.has(a.profileId));
      const newAssignments: EditDayAssignment[] = profileIds.map((pId) => ({
        profileId: pId,
        shiftScheduleId,
        assignmentType: 'duty',
        isLead: false,
      }));
      return [...filtered, ...newAssignments];
    });
  };

  const handleAddMultipleOfficersToRest = (profileIds: string[]) => {
    if (isSettingsViewOnly || profileIds.length === 0) return;
    const profileIdSet = new Set(profileIds);
    setEditingDayAssignments((prev) => {
      const filtered = prev.filter((a) => !profileIdSet.has(a.profileId));
      const newAssignments: EditDayAssignment[] = profileIds.map((pId) => ({
        profileId: pId,
        shiftScheduleId: null,
        assignmentType: 'rest',
        isLead: false,
      }));
      return [...filtered, ...newAssignments];
    });
  };

  const handleAddMultipleOfficersToTravel = (profileIds: string[]) => {
    if (isSettingsViewOnly || profileIds.length === 0) return;
    const profileIdSet = new Set(profileIds);
    setEditingDayAssignments((prev) => {
      const filtered = prev.filter((a) => !profileIdSet.has(a.profileId));
      const newAssignments: EditDayAssignment[] = profileIds.map((pId) => ({
        profileId: pId,
        shiftScheduleId: null,
        assignmentType: 'travel',
        isLead: false,
      }));
      return [...filtered, ...newAssignments];
    });
  };

  const handleRemoveOfficerFromDay = (profileId: string) => {
    if (isSettingsViewOnly) return;
    setEditingDayAssignments((prev) =>
      prev.filter((a) => a.profileId !== profileId)
    );
  };

  const handleSaveDaySchedule = async () => {
    if (isSettingsViewOnly) {
      onToast('You have view-only access. Modifying rosters is restricted.');
      return;
    }
    const dateKey = format(editingDayDate, 'yyyy-MM-dd');

    try {
      setIsSavingDay(true);

      const { error: deleteError } = await supabase
        .from('duty_roster_assignments')
        .delete()
        .eq('duty_date', dateKey);

      if (deleteError) {
        console.warn('Delete error notice:', deleteError.message);
      }

      let insertedRows: DutyRosterAssignmentRecord[] = [];
      if (editingDayAssignments.length > 0) {
        const recordsToInsert: DutyRosterAssignmentRecord[] =
          editingDayAssignments.map((a) => ({
            profile_id: a.profileId,
            shift_schedule_id:
              a.assignmentType === 'duty' ? a.shiftScheduleId : null,
            duty_date: dateKey,
            assignment_type: a.assignmentType,
            is_lead: a.isLead,
            created_by: currentUserId,
          }));

        const { data: insertedData, error: insertError } = await supabase
          .from('duty_roster_assignments')
          .insert(recordsToInsert)
          .select('*');

        if (insertError) {
          throw new Error(insertError.message);
        }

        insertedRows =
          insertedData && insertedData.length > 0
            ? (insertedData as DutyRosterAssignmentRecord[])
            : recordsToInsert;
      }

      broadcastShiftSync();
      onSavedDay(
        dateKey,
        insertedRows,
        `Roster for ${format(editingDayDate, 'MMMM d, yyyy')} updated successfully.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error';
      console.error('Error saving day schedule:', err);
      onToast(`Error saving schedule: ${msg}`);
    } finally {
      setIsSavingDay(false);
    }
  };

  const handleClearDaySchedule = async () => {
    if (isSettingsViewOnly) {
      onToast('You have view-only access. Modifying rosters is restricted.');
      return;
    }
    const dateKey = format(editingDayDate, 'yyyy-MM-dd');

    if (
      !confirm(
        `Are you sure you want to clear all shift and rest assignments for ${format(
          editingDayDate,
          'MMMM d, yyyy'
        )}?`
      )
    ) {
      return;
    }

    try {
      setIsSavingDay(true);
      const { error } = await supabase
        .from('duty_roster_assignments')
        .delete()
        .eq('duty_date', dateKey);

      if (error) {
        throw new Error(error.message);
      }

      broadcastShiftSync();
      onSavedDay(
        dateKey,
        [],
        `All assignments cleared for ${format(editingDayDate, 'MMMM d, yyyy')}.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error';
      console.error('Error clearing day assignments:', err);
      onToast(`Failed to clear assignments: ${msg}`);
    } finally {
      setIsSavingDay(false);
    }
  };

  const searchQueryLower = debouncedDisplayedSearch.trim().toLowerCase();

  const matchesSearchQuery = useMemo(() => {
    return (profileId: string) => {
      if (!searchQueryLower) return true;
      const officer = profilesById.get(profileId);
      if (!officer) return false;
      return (
        officer.name.toLowerCase().includes(searchQueryLower) ||
        officer.role.toLowerCase().includes(searchQueryLower) ||
        (officer.badgeNumber &&
          officer.badgeNumber.toLowerCase().includes(searchQueryLower)) ||
        (officer.defaultShift &&
          officer.defaultShift.toLowerCase().includes(searchQueryLower)) ||
        (officer.userRole &&
          officer.userRole.toLowerCase().includes(searchQueryLower))
      );
    };
  }, [profilesById, searchQueryLower]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !isSavingDay && onClose()}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden z-10 flex flex-col h-[88vh] max-h-[92vh] min-h-[620px]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/20 shrink-0">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#1E293B]">
                Edit Shift Roster — {format(editingDayDate, 'EEEE, MMMM d, yyyy')}
              </h3>
              <p className="text-xs text-[#757680] mt-0.5">
                Assign, reassign, or remove personnel and manage shift duty rosters
                for this date
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSavingDay}
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Segmented Toggle Bar */}
        <div className="px-6 pt-4 pb-3 bg-slate-50/80 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-2xl">
            <button
              type="button"
              onClick={() => setEditModalCategory('DUTY')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                editModalCategory === 'DUTY'
                  ? 'bg-white text-[#004AC6] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span className="truncate">Shift Schedule</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  editModalCategory === 'DUTY'
                    ? 'bg-[#004AC6]/10 text-[#004AC6]'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {editingDayAssignments.filter((a) => a.assignmentType === 'duty').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setEditModalCategory('REST')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                editModalCategory === 'REST'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <CalendarX className="w-4 h-4 shrink-0" />
              <span className="truncate">Rest Day</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  editModalCategory === 'REST'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {editingDayAssignments.filter((a) => a.assignmentType === 'rest').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setEditModalCategory('TRAVEL')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                editModalCategory === 'TRAVEL'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Plane className="w-4 h-4 shrink-0" />
              <span className="truncate">Travel Order</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  editModalCategory === 'TRAVEL'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {editingDayAssignments.filter((a) => a.assignmentType === 'travel').length}
              </span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 1. Shift Schedule Groups */}
          {editModalCategory === 'DUTY' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  <div className="sm:w-80 shrink-0">
                    <CustomDropdown
                      label="Shift Roster Rotations"
                      value={editModalShiftFilter}
                      onChange={setEditModalShiftFilter}
                      options={shiftRotationDropdownOptions}
                      size="sm"
                      placeholder="Select Shift Rotation..."
                    />
                  </div>

                  <div className="flex-1 w-full">
                    <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide mb-1.5 flex items-center justify-between">
                      <span>Search Personnel</span>
                      {displayedPersonnelSearch && (
                        <span className="text-[10px] text-[#004AC6] font-semibold lowercase">
                          filtering displayed
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={displayedPersonnelSearch}
                        onChange={(e) => setDisplayedPersonnelSearch(e.target.value)}
                        placeholder="Search displayed personnel by name, role, badge..."
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl py-1.5 pl-9 pr-8 text-xs text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all"
                      />
                      {displayedPersonnelSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setDisplayedPersonnelSearch('');
                            setDebouncedDisplayedSearch('');
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

              {effectiveShiftSchedules
                .filter(
                  (sched) =>
                    editModalShiftFilter === 'ALL' ||
                    sched.id === editModalShiftFilter
                )
                .map((sched) => {
                  const shiftColor = sched.color || '#004AC6';
                  const assignedToThisShift = editingDayAssignments.filter(
                    (a) =>
                      a.assignmentType === 'duty' &&
                      a.shiftScheduleId === sched.id
                  );

                  const displayedOfficers = searchQueryLower
                    ? assignedToThisShift.filter((assignment) =>
                        matchesSearchQuery(assignment.profileId)
                      )
                    : assignedToThisShift;

                  const PAGE_SIZE = 10;
                  const currentPage = shiftPersonnelPages[sched.id] || 1;
                  const totalPages = Math.max(
                    1,
                    Math.ceil(displayedOfficers.length / PAGE_SIZE)
                  );
                  const safePage = Math.min(currentPage, totalPages);
                  const startIndex = (safePage - 1) * PAGE_SIZE;
                  const paginatedOfficers = displayedOfficers.slice(
                    startIndex,
                    startIndex + PAGE_SIZE
                  );

                  return (
                    <div
                      key={sched.id}
                      className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-3.5 transition-all shadow-2xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: shiftColor }}
                          />
                          <h5 className="text-sm font-bold text-[#1E293B]">
                            {sched.name}
                          </h5>
                          <span className="text-[11px] text-[#505F76] font-mono">
                            ({sched.time})
                          </span>
                          {sched.targetRole && sched.targetRole !== 'ALL' && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                              {sched.targetRole}
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            color: shiftColor,
                            borderColor: `${shiftColor}30`,
                          }}
                          className="text-xs font-bold bg-white px-2.5 py-0.5 rounded-full border shadow-2xs"
                        >
                          {searchQueryLower
                            ? `${displayedOfficers.length} of ${assignedToThisShift.length} Personnel`
                            : `${assignedToThisShift.length} Personnel`}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {paginatedOfficers.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {paginatedOfficers.map((assignment) => {
                              const officer = profilesById.get(
                                assignment.profileId
                              );
                              const badge = getRoleBadge(officer?.userRole);
                              const officerName =
                                officer?.name || 'Duty Responder';
                              const officerRole = officer?.role || 'Responder';

                              return (
                                <div
                                  key={assignment.profileId}
                                  className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 shadow-2xs transition-all hover:border-slate-300"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className="w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                                      style={{ backgroundColor: shiftColor }}
                                    >
                                      {officer?.avatarInitials || 'OP'}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-bold text-[#1E293B] truncate">
                                          {officerName}
                                        </p>
                                        <span
                                          className={`text-[8px] font-semibold px-1 py-0.2 rounded border ${badge.badgeClass}`}
                                        >
                                          {badge.label}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-[#757680] truncate">
                                        {officerRole}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveOfficerFromDay(
                                          assignment.profileId
                                        )
                                      }
                                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer"
                                      title="Remove officer from this day"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : assignedToThisShift.length > 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400 bg-white/50 rounded-xl border border-dashed border-slate-200">
                            No personnel matching &quot;{debouncedDisplayedSearch}&quot;
                            in {sched.name}.
                          </div>
                        ) : (
                          <div className="p-3 text-center text-xs text-slate-400 bg-white/50 rounded-xl border border-dashed border-slate-200">
                            No personnel assigned to {sched.name} yet.
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <PersonnelMultiSelectDropdown
                            label={`Add Personnel to ${sched.name}`}
                            themeColor={shiftColor}
                            profiles={profiles}
                            currentAssignedIds={assignedToThisShift.map(
                              (a) => a.profileId
                            )}
                            allDayAssignments={editingDayAssignments}
                            shiftSchedules={effectiveShiftSchedules}
                            disabled={isSavingDay}
                            onAddOfficers={(ids) =>
                              handleAddMultipleOfficersToShift(sched.id, ids)
                            }
                          />
                        </div>

                        {displayedOfficers.length > PAGE_SIZE && (
                          <div className="flex items-center gap-2 select-none">
                            <span className="text-xs font-medium text-slate-500">
                              {startIndex + 1}–
                              {Math.min(
                                startIndex + PAGE_SIZE,
                                displayedOfficers.length
                              )}{' '}
                              of {displayedOfficers.length}
                            </span>
                            <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                disabled={safePage <= 1}
                                onClick={() =>
                                  setShiftPersonnelPages((prev) => ({
                                    ...prev,
                                    [sched.id]: Math.max(1, safePage - 1),
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
                                  setShiftPersonnelPages((prev) => ({
                                    ...prev,
                                    [sched.id]: Math.min(totalPages, safePage + 1),
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
                    </div>
                  );
                })}
            </div>
          )}

          {/* 2. Rest Day / Off-Duty Section */}
          {editModalCategory === 'REST' &&
            (() => {
              const restAssignments = editingDayAssignments.filter(
                (a) => a.assignmentType === 'rest'
              );
              const displayedRestOfficers = searchQueryLower
                ? restAssignments.filter((assignment) =>
                    matchesSearchQuery(assignment.profileId)
                  )
                : restAssignments;

              const PAGE_SIZE = 10;
              const totalRestPages = Math.max(
                1,
                Math.ceil(displayedRestOfficers.length / PAGE_SIZE)
              );
              const safeRestPage = Math.min(restPersonnelPage, totalRestPages);
              const startRestIndex = (safeRestPage - 1) * PAGE_SIZE;
              const paginatedRestOfficers = displayedRestOfficers.slice(
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
                      {searchQueryLower
                        ? `${displayedRestOfficers.length} of ${restAssignments.length} Personnel`
                        : `${restAssignments.length} Personnel`}
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={displayedPersonnelSearch}
                      onChange={(e) => setDisplayedPersonnelSearch(e.target.value)}
                      placeholder="Search rest day personnel by name, role, badge..."
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl py-1.5 pl-9 pr-8 text-xs text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15 hover:border-[#CBD5E1] transition-all"
                    />
                    {displayedPersonnelSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setDisplayedPersonnelSearch('');
                          setDebouncedDisplayedSearch('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {paginatedRestOfficers.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {paginatedRestOfficers.map((assignment) => {
                          const officer = profilesById.get(assignment.profileId);
                          const badge = getRoleBadge(officer?.userRole);
                          const officerName = officer?.name || 'Duty Responder';
                          const officerRole = officer?.role || 'Responder';

                          return (
                            <div
                              key={assignment.profileId}
                              className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 shadow-2xs transition-all hover:border-slate-300"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {officer?.avatarInitials || 'OP'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold text-[#1E293B] truncate">
                                      {officerName}
                                    </p>
                                    <span
                                      className={`text-[8px] font-semibold px-1 py-0.2 rounded border ${badge.badgeClass}`}
                                    >
                                      {badge.label}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#757680] truncate">
                                    {officerRole}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveOfficerFromDay(assignment.profileId)
                                }
                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                                title="Remove from rest day"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : restAssignments.length > 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        No rest personnel matching &quot;{debouncedDisplayedSearch}&quot;.
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        No personnel scheduled for rest day on this date.
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <PersonnelMultiSelectDropdown
                        label="Add Personnel to Rest Day"
                        themeColor="#D97706"
                        profiles={profiles}
                        currentAssignedIds={restAssignments.map(
                          (a) => a.profileId
                        )}
                        allDayAssignments={editingDayAssignments}
                        shiftSchedules={effectiveShiftSchedules}
                        disabled={isSavingDay}
                        onAddOfficers={handleAddMultipleOfficersToRest}
                      />
                    </div>

                    {displayedRestOfficers.length > PAGE_SIZE && (
                      <div className="flex items-center gap-2 select-none">
                        <span className="text-xs font-medium text-slate-500">
                          {startRestIndex + 1}–
                          {Math.min(
                            startRestIndex + PAGE_SIZE,
                            displayedRestOfficers.length
                          )}{' '}
                          of {displayedRestOfficers.length}
                        </span>
                        <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            disabled={safeRestPage <= 1}
                            onClick={() =>
                              setRestPersonnelPage((p) => Math.max(1, p - 1))
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
                              setRestPersonnelPage((p) =>
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
                </div>
              );
            })()}

          {/* 3. Travel Order Section */}
          {editModalCategory === 'TRAVEL' &&
            (() => {
              const travelAssignments = editingDayAssignments.filter(
                (a) => a.assignmentType === 'travel'
              );
              const displayedTravelOfficers = searchQueryLower
                ? travelAssignments.filter((assignment) =>
                    matchesSearchQuery(assignment.profileId)
                  )
                : travelAssignments;

              const PAGE_SIZE = 10;
              const totalTravelPages = Math.max(
                1,
                Math.ceil(displayedTravelOfficers.length / PAGE_SIZE)
              );
              const safeTravelPage = Math.min(
                travelPersonnelPage,
                totalTravelPages
              );
              const startTravelIndex = (safeTravelPage - 1) * PAGE_SIZE;
              const paginatedTravelOfficers = displayedTravelOfficers.slice(
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
                      {searchQueryLower
                        ? `${displayedTravelOfficers.length} of ${travelAssignments.length} Personnel`
                        : `${travelAssignments.length} Personnel`}
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={displayedPersonnelSearch}
                      onChange={(e) => setDisplayedPersonnelSearch(e.target.value)}
                      placeholder="Search travel order personnel by name, role, badge..."
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl py-1.5 pl-9 pr-8 text-xs text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 hover:border-[#CBD5E1] transition-all"
                    />
                    {displayedPersonnelSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setDisplayedPersonnelSearch('');
                          setDebouncedDisplayedSearch('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {paginatedTravelOfficers.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {paginatedTravelOfficers.map((assignment) => {
                          const officer = profilesById.get(assignment.profileId);
                          const badge = getRoleBadge(officer?.userRole);
                          const officerName = officer?.name || 'Duty Responder';
                          const officerRole = officer?.role || 'Responder';

                          return (
                            <div
                              key={assignment.profileId}
                              className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 shadow-2xs transition-all hover:border-slate-300"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {officer?.avatarInitials || 'OP'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold text-[#1E293B] truncate">
                                      {officerName}
                                    </p>
                                    <span
                                      className={`text-[8px] font-semibold px-1 py-0.2 rounded border ${badge.badgeClass}`}
                                    >
                                      {badge.label}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#757680] truncate">
                                    {officerRole}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveOfficerFromDay(assignment.profileId)
                                }
                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                                title="Remove from travel order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : travelAssignments.length > 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        No travel personnel matching &quot;{debouncedDisplayedSearch}
                        &quot;.
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        No personnel scheduled for travel order on this date.
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <PersonnelMultiSelectDropdown
                        label="Add Personnel to Travel Order"
                        themeColor="#7C3AED"
                        profiles={profiles}
                        currentAssignedIds={travelAssignments.map(
                          (a) => a.profileId
                        )}
                        allDayAssignments={editingDayAssignments}
                        shiftSchedules={effectiveShiftSchedules}
                        disabled={isSavingDay}
                        onAddOfficers={handleAddMultipleOfficersToTravel}
                      />
                    </div>

                    {displayedTravelOfficers.length > PAGE_SIZE && (
                      <div className="flex items-center gap-2 select-none">
                        <span className="text-xs font-medium text-slate-500">
                          {startTravelIndex + 1}–
                          {Math.min(
                            startTravelIndex + PAGE_SIZE,
                            displayedTravelOfficers.length
                          )}{' '}
                          of {displayedTravelOfficers.length}
                        </span>
                        <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            disabled={safeTravelPage <= 1}
                            onClick={() =>
                              setTravelPersonnelPage((p) => Math.max(1, p - 1))
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
                              setTravelPersonnelPage((p) =>
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
                </div>
              );
            })()}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={isSavingDay || editingDayAssignments.length === 0}
            onClick={handleClearDaySchedule}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All for this Date</span>
          </button>

          <div className="flex items-center gap-2.5 justify-end">
            <SecondaryButton
              type="button"
              size="md"
              pill
              disabled={isSavingDay}
              onClick={onClose}
            >
              Cancel
            </SecondaryButton>

            <PrimaryButton
              type="button"
              size="md"
              pill
              disabled={isSavingDay}
              onClick={handleSaveDaySchedule}
              leftIcon={
                isSavingDay ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )
              }
            >
              {isSavingDay ? 'Saving Changes...' : 'Save Day Changes'}
            </PrimaryButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
