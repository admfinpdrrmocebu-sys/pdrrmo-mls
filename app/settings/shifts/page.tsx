'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  UserCheck,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  FileSpreadsheet,
  Download,
  X,
  Check,
  CheckCircle2,
  CalendarDays,
  CalendarCheck,
  CalendarX,
  Trash2,
  Loader2,
  RefreshCw,
  Shield,
  Filter,
  Layers,
  Edit2,
  Crown,
  UserPlus,
  AlertCircle,
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
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { SummaryCard } from '@/components/card';
import { SummaryCardSkeleton, CalendarSkeleton } from '@/components/skeleton';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';

// =============================================================================
// TYPES & ROSTER MODELS
// =============================================================================

export interface OfficerAssignment {
  id: string;
  name: string;
  role: string;
  userRole?: string; // 'admin' | 'monitoring' | 'staff' | string
  badgeNumber: string;
  avatarInitials: string;
  defaultShift: string;
  avatarUrl?: string | null;
  isLead?: boolean;
}

export interface ShiftScheduleItem {
  id: string;
  name: string;
  time: string;
  duration: string;
  color?: string;
  startTime?: string;
  endTime?: string;
  targetRole?: string;
  sortOrder?: number;
}

export interface DutyRosterAssignmentRecord {
  id?: string;
  profile_id: string;
  shift_schedule_id?: string | null;
  duty_date: string;
  assignment_type: 'duty' | 'rest';
  is_lead: boolean;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AssignedShiftGroup {
  scheduleId: string;
  scheduleName: string;
  startTime: string;
  endTime: string;
  timeLabel: string;
  duration: string;
  color: string;
  targetRole?: string;
  sortOrder: number;
  leadOfficer: OfficerAssignment | null;
  members: OfficerAssignment[];
  station?: string;
}

export interface DayDutySchedule {
  date: Date;
  dateKey: string;
  shifts: AssignedShiftGroup[];
  restDayPersonnel: OfficerAssignment[];
}

export interface EditDayAssignment {
  profileId: string;
  shiftScheduleId: string | null;
  assignmentType: 'duty' | 'rest';
  isLead: boolean;
}

function getInitials(name: string): string {
  if (!name) return 'OP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function matchesRole(officer: OfficerAssignment, filter: string): boolean {
  if (!filter || filter === 'ALL') return true;
  const f = filter.toLowerCase();
  const uRole = officer.userRole?.toLowerCase() || '';
  const pRole = officer.role?.toLowerCase() || '';
  return uRole === f || uRole.includes(f) || pRole.includes(f);
}

function getRoleBadge(userRole?: string) {
  const r = (userRole || 'staff').toLowerCase();
  if (r.includes('admin')) {
    return {
      label: 'Admin',
      badgeClass: 'bg-blue-50 text-[#004AC6] border-blue-200',
      dotClass: 'bg-blue-500',
    };
  }
  if (r.includes('monitoring')) {
    return {
      label: 'Monitoring',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
      dotClass: 'bg-sky-500',
    };
  }
  return {
    label: 'Staff',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
  };
}

const roleFilterDropdownOptions: CustomDropdownOption[] = [
  { value: 'ALL', label: 'All Roles', badge: 'All', badgeColor: 'bg-slate-100 text-slate-700' },
  { value: 'admin', label: 'Admin', dotColor: '#004AC6', badge: 'System', badgeColor: 'bg-blue-50 text-[#004AC6]' },
  { value: 'monitoring', label: 'Monitoring', dotColor: '#0284C7', badge: 'Operational', badgeColor: 'bg-sky-50 text-sky-700' },
  { value: 'staff', label: 'Staff', dotColor: '#64748B', badge: 'Standard', badgeColor: 'bg-slate-100 text-slate-700' },
];

export default function ShiftScheduleCalendarPage() {
  const { user, isViewOnly } = useAuth();
  const isSettingsViewOnly = isViewOnly('Settings');

  // Loading & Sync States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Dynamic Database Data
  const [profiles, setProfiles] = useState<OfficerAssignment[]>([]);
  const [shiftSchedules, setShiftSchedules] = useState<ShiftScheduleItem[]>([]);
  const [dbAssignments, setDbAssignments] = useState<DutyRosterAssignmentRecord[]>([]);

  // Current viewed month in the grid
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Selected day for inspection modal
  const [selectedDaySchedule, setSelectedDaySchedule] = useState<DayDutySchedule | null>(null);

  // Dropdown Filters: Shift & User Role
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');

  // ===========================================================================
  // ADD SHIFT SCHEDULE MODAL STATE (MULTI-DATE PICKER)
  // ===========================================================================
  const [isAddScheduleModalOpen, setIsAddScheduleModalOpen] = useState(false);
  const [scheduleMonth, setScheduleMonth] = useState(format(currentMonth, 'yyyy-MM'));
  const [selectedShiftScheduleId, setSelectedShiftScheduleId] = useState<string>('');
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);

  // Selected multi-dates for Duty Schedule and Day Off
  const [selectedDutyDates, setSelectedDutyDates] = useState<string[]>([]);
  const [selectedDayOffDates, setSelectedDayOffDates] = useState<string[]>([]);

  // Active Picker Mode: 'DUTY' | 'DAY_OFF'
  const [datePickerMode, setDatePickerMode] = useState<'DUTY' | 'DAY_OFF'>('DUTY');

  // Print & XLSX Modal State
  const [isPrintXLSXModalOpen, setIsPrintXLSXModalOpen] = useState(false);

  // ===========================================================================
  // EDIT DAY SHIFT ROSTER MODAL STATE
  // ===========================================================================
  const [isEditDayModalOpen, setIsEditDayModalOpen] = useState(false);
  const [editingDayDate, setEditingDayDate] = useState<Date | null>(null);
  const [editingDayAssignments, setEditingDayAssignments] = useState<EditDayAssignment[]>([]);
  const [isSavingDay, setIsSavingDay] = useState(false);
  const [selectedAddProfileId, setSelectedAddProfileId] = useState<{ [shiftKey: string]: string }>({});

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Month date parsed from scheduleMonth (e.g. "2026-09")
  const scheduleMonthDate = useMemo(() => {
    const [year, month] = scheduleMonth.split('-').map(Number);
    if (!year || !month) return new Date();
    return new Date(year, month - 1, 1);
  }, [scheduleMonth]);

  // Dynamic Shift Filter Options based on database shift schedules
  const shiftFilterDropdownOptions: CustomDropdownOption[] = useMemo(() => {
    const base: CustomDropdownOption[] = [
      { value: 'ALL', label: 'All Shifts', badge: 'All', badgeColor: 'bg-slate-100 text-slate-700' },
    ];
    shiftSchedules.forEach((s) => {
      base.push({
        value: s.id,
        label: s.name,
        dotColor: s.color || '#004AC6',
        badge: s.time || `${s.startTime || '08:00'}–${s.endTime || '16:00'}`,
        badgeColor: 'bg-blue-50 text-[#004AC6]',
      });
    });
    return base;
  }, [shiftSchedules]);

  // ===========================================================================
  // DATA FETCHING (SUPABASE INTEGRATION)
  // ===========================================================================
  const fetchRosterData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Fetch Profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, position_title, role, default_shift, avatar_url, is_active')
        .order('full_name', { ascending: true });

      if (profilesError) {
        console.warn('Profiles query notice:', profilesError.message);
      }

      if (profilesData && profilesData.length > 0) {
        let deactList: string[] = [];
        let delList: string[] = [];
        let editedMap: Record<string, any> = {};
        try {
          deactList = JSON.parse(localStorage.getItem('pdrrmo_deactivated_users') || '[]');
          delList = JSON.parse(localStorage.getItem('pdrrmo_deleted_users') || '[]');
          editedMap = JSON.parse(localStorage.getItem('pdrrmo_edited_users') || '{}');
        } catch (e) {}

        const mappedProfiles: OfficerAssignment[] = profilesData
          .filter((p) => {
            const isDel = delList.includes(p.id) || (p.email && delList.includes(p.email));
            const isDeact = deactList.includes(p.id) || (p.email && deactList.includes(p.email));
            const userEdit = editedMap[p.id] || (p.email ? editedMap[p.email.toLowerCase()] : null);
            const isEditDeact = userEdit?.status === 'Inactive';
            return !isDel && !isDeact && !isEditDeact && p.is_active !== false;
          })
          .map((p) => {
            const userEdit = editedMap[p.id] || (p.email ? editedMap[p.email.toLowerCase()] : null) || {};
            const finalName = userEdit.name || p.full_name || 'Monitoring Responder';
            const finalRole = userEdit.positionTitle || p.position_title || p.role || 'Duty Responder';
            const finalUserRole = (userEdit.role || p.role || 'staff').toLowerCase();
            const finalShift = userEdit.shift || p.default_shift || '';

            return {
              id: p.id,
              name: finalName,
              role: finalRole,
              userRole: finalUserRole,
              badgeNumber: `OPC-${p.id.slice(0, 4).toUpperCase()}`,
              avatarInitials: getInitials(finalName || 'OP'),
              defaultShift: finalShift,
              avatarUrl: userEdit.avatarUrl !== undefined ? userEdit.avatarUrl : p.avatar_url,
            };
          });
        setProfiles(mappedProfiles);
      } else {
        setProfiles([]);
      }

      // 2. Fetch Shift Schedules
      const { data: schedData, error: schedError } = await supabase
        .from('shift_schedules')
        .select('*')
        .order('sort_order', { ascending: true });

      if (schedError) {
        console.warn('Shift schedules query notice:', schedError.message);
      }

      if (schedData && schedData.length > 0) {
        const mappedSchedules: ShiftScheduleItem[] = schedData.map((s) => ({
          id: s.id,
          name: s.name,
          time: `${s.start_time || '08:00'} – ${s.end_time || '16:00'}`,
          duration: s.duration || '8 Hours',
          color: s.color || '#004AC6',
          startTime: s.start_time || '08:00',
          endTime: s.end_time || '16:00',
          targetRole: s.target_role,
          sortOrder: s.sort_order ?? 0,
        }));
        setShiftSchedules(mappedSchedules);
      } else {
        setShiftSchedules([]);
      }

      // 3. Fetch Month Duty Roster Assignments
      const monthStartStr = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEndStr = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { data: assignData, error: assignError } = await supabase
        .from('duty_roster_assignments')
        .select('*')
        .gte('duty_date', monthStartStr)
        .lte('duty_date', monthEndStr);

      if (assignError) {
        console.warn('Duty roster assignments notice:', assignError.message);
      } else if (assignData) {
        setDbAssignments(assignData as DutyRosterAssignmentRecord[]);
      } else {
        setDbAssignments([]);
      }
    } catch (err) {
      console.error('Error fetching shift roster data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth]);

  // Initial load and current month change trigger
  useEffect(() => {
    fetchRosterData();
  }, [fetchRosterData]);

  // Realtime subscription for duty_roster_assignments and shift_schedules
  useEffect(() => {
    const channel = supabase
      .channel('duty_roster_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'duty_roster_assignments' },
        () => {
          fetchRosterData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_schedules' },
        () => {
          fetchRosterData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRosterData]);

  // Helper to resolve officer by profile_id
  const getOfficerById = useCallback(
    (id: string): OfficerAssignment => {
      const found = profiles.find((p) => p.id === id);
      if (found) return found;
      return {
        id,
        name: 'Duty Responder',
        role: 'Operations Desk',
        userRole: 'staff',
        badgeNumber: `OPC-${id.slice(0, 4).toUpperCase()}`,
        avatarInitials: 'OP',
        defaultShift: '',
      };
    },
    [profiles]
  );

  // Helper to generate dynamic schedule for any given date strictly from database assignments
  const getScheduleForDate = useCallback(
    (date: Date): DayDutySchedule => {
      const dateKey = format(date, 'yyyy-MM-dd');

      // Check if we have dynamic database assignments for this date
      const dayAssignments = dbAssignments.filter((a) => a.duty_date === dateKey);
      if (dayAssignments.length === 0) {
        return {
          date,
          dateKey,
          shifts: [],
          restDayPersonnel: [],
        };
      }

      const dutyAssigns = dayAssignments.filter((a) => a.assignment_type === 'duty');
      const restAssigns = dayAssignments.filter((a) => a.assignment_type === 'rest');
      const restDayPersonnel = restAssigns.map((a) => getOfficerById(a.profile_id));

      // Group duty assignments by shift_schedule_id
      const groupMap = new Map<
        string,
        {
          sched: ShiftScheduleItem | null;
          assignments: DutyRosterAssignmentRecord[];
        }
      >();

      dutyAssigns.forEach((assign) => {
        let key = assign.shift_schedule_id || 'unassigned';
        let matchedSched = shiftSchedules.find((s) => s.id === assign.shift_schedule_id);

        // If unlinked shift_schedule_id, attempt match by officer defaultShift
        if (!matchedSched && !assign.shift_schedule_id) {
          const officer = getOfficerById(assign.profile_id);
          if (officer.defaultShift) {
            matchedSched = shiftSchedules.find(
              (s) => s.name.toLowerCase() === officer.defaultShift.toLowerCase()
            );
            if (matchedSched) {
              key = matchedSched.id;
            }
          }
        }

        if (!groupMap.has(key)) {
          groupMap.set(key, { sched: matchedSched || null, assignments: [] });
        }
        groupMap.get(key)!.assignments.push(assign);
      });

      const shifts: AssignedShiftGroup[] = [];
      let fallbackIndex = 0;
      const fallbackColors = ['#004AC6', '#D97706', '#7C3AED', '#0284C7', '#059669', '#DC2626', '#E11D48'];

      groupMap.forEach((group, key) => {
        const sched = group.sched;
        const officers = group.assignments.map((a) => ({
          ...getOfficerById(a.profile_id),
          isLead: a.is_lead,
        }));

        const leadOfficer = officers.find((o) => o.isLead) || (officers.length > 0 ? officers[0] : null);
        const members = leadOfficer ? officers.filter((o) => o.id !== leadOfficer.id) : officers;

        const shiftColor = sched?.color || fallbackColors[fallbackIndex % fallbackColors.length];
        fallbackIndex++;

        shifts.push({
          scheduleId: sched?.id || key,
          scheduleName: sched?.name || 'Operational Shift',
          startTime: sched?.startTime || '08:00',
          endTime: sched?.endTime || '16:00',
          timeLabel: sched?.time || `${sched?.startTime || '08:00'} – ${sched?.endTime || '16:00'}`,
          duration: sched?.duration || '8 Hours',
          color: shiftColor,
          targetRole: sched?.targetRole,
          sortOrder: sched?.sortOrder ?? fallbackIndex,
          leadOfficer: leadOfficer ? { ...leadOfficer, isLead: true } : null,
          members,
          station: 'PDRRMO Emergency Operations Center',
        });
      });

      // Sort shifts by sortOrder
      shifts.sort((a, b) => a.sortOrder - b.sortOrder);

      return {
        date,
        dateKey,
        shifts,
        restDayPersonnel,
      };
    },
    [dbAssignments, shiftSchedules, getOfficerById]
  );

  // Set default initial shift schedule selection in Add Modal
  useEffect(() => {
    if (isAddScheduleModalOpen && shiftSchedules.length > 0) {
      if (!selectedShiftScheduleId || !shiftSchedules.some((s) => s.id === selectedShiftScheduleId)) {
        const initialId = shiftSchedules[0].id;
        setSelectedShiftScheduleId(initialId);
      }
    }
  }, [isAddScheduleModalOpen, shiftSchedules, selectedShiftScheduleId]);

  // Filter personnel by chosen shift schedule in modal
  const visiblePersonnel = useMemo(() => {
    const targetSched = shiftSchedules.find((s) => s.id === selectedShiftScheduleId);
    if (!targetSched) return profiles;

    // 1. If target_role is set on shift schedule, filter profiles by target role
    if (targetSched.targetRole && targetSched.targetRole !== 'ALL') {
      const roleMatches = profiles.filter((p) => matchesRole(p, targetSched.targetRole!));
      if (roleMatches.length > 0) return roleMatches;
    }

    // 2. If profile has default_shift matching schedule name
    const shiftMatches = profiles.filter(
      (p) => p.defaultShift && p.defaultShift.toLowerCase() === targetSched.name.toLowerCase()
    );
    if (shiftMatches.length > 0) return shiftMatches;

    // 3. Fallback: all active profiles
    return profiles;
  }, [profiles, selectedShiftScheduleId, shiftSchedules]);

  // Handle shift schedule change: auto-select personnel matching the shift
  const handleShiftScheduleChange = (newSchedId: string) => {
    setSelectedShiftScheduleId(newSchedId);
    const targetSched = shiftSchedules.find((s) => s.id === newSchedId);
    if (targetSched) {
      let matching: OfficerAssignment[] = [];
      if (targetSched.targetRole && targetSched.targetRole !== 'ALL') {
        matching = profiles.filter((p) => matchesRole(p, targetSched.targetRole!));
      }
      if (matching.length === 0) {
        matching = profiles.filter(
          (p) => p.defaultShift && p.defaultShift.toLowerCase() === targetSched.name.toLowerCase()
        );
      }
      setSelectedPersonnelIds(matching.length > 0 ? matching.map((m) => m.id) : visiblePersonnel.map((p) => p.id));
    }
  };

  // When modal opens or shift changes, auto-select matching personnel
  useEffect(() => {
    if (isAddScheduleModalOpen && visiblePersonnel.length > 0) {
      setSelectedPersonnelIds(visiblePersonnel.map((p) => p.id));
    }
  }, [isAddScheduleModalOpen, selectedShiftScheduleId, visiblePersonnel]);

  // Toggle single personnel selection
  const handleTogglePersonnel = (id: string) => {
    setSelectedPersonnelIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  // Toggle all personnel in the visible list
  const handleToggleAllPersonnel = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedPersonnelIds(visiblePersonnel.map((p) => p.id));
    } else {
      setSelectedPersonnelIds([]);
    }
  };

  // Calendar days grid for the picker modal based on scheduleMonth
  const pickerCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(scheduleMonthDate);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((d) => {
      const dateKey = format(d, 'yyyy-MM-dd');
      const isCurMonth = isSameMonth(d, scheduleMonthDate);
      const isDuty = selectedDutyDates.includes(dateKey);
      const isDayOff = selectedDayOffDates.includes(dateKey);
      const dayOfWeek = d.getDay();

      return {
        date: d,
        dateKey,
        dayNum: d.getDate(),
        isCurrentMonth: isCurMonth,
        isToday: isToday(d),
        isDuty,
        isDayOff,
        dayOfWeek,
      };
    });
  }, [scheduleMonthDate, selectedDutyDates, selectedDayOffDates]);

  // Current month active days only in the picker
  const pickerMonthDays = useMemo(() => {
    return pickerCalendarDays.filter((d) => d.isCurrentMonth);
  }, [pickerCalendarDays]);

  // Toggle a single date in the picker
  const handleTogglePickerDate = (dateKey: string) => {
    if (datePickerMode === 'DUTY') {
      if (selectedDutyDates.includes(dateKey)) {
        setSelectedDutyDates((prev) => prev.filter((d) => d !== dateKey));
      } else {
        setSelectedDutyDates((prev) => [...prev, dateKey].sort());
        setSelectedDayOffDates((prev) => prev.filter((d) => d !== dateKey));
      }
    } else {
      if (selectedDayOffDates.includes(dateKey)) {
        setSelectedDayOffDates((prev) => prev.filter((d) => d !== dateKey));
      } else {
        setSelectedDayOffDates((prev) => [...prev, dateKey].sort());
        setSelectedDutyDates((prev) => prev.filter((d) => d !== dateKey));
      }
    }
  };

  const handleClearAllDates = () => {
    setSelectedDutyDates([]);
    setSelectedDayOffDates([]);
  };

  // Calendar Grid Days Calculation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    return days.map((d) => ({
      date: d,
      isCurrentMonth: isSameMonth(d, currentMonth),
      isCurrentDay: isToday(d),
      schedule: getScheduleForDate(d),
    }));
  }, [currentMonth, getScheduleForDate]);

  // Current month active days only (for XLSX table & print)
  const monthActiveDays = useMemo(() => {
    return calendarDays.filter((d) => d.isCurrentMonth);
  }, [calendarDays]);

  // Dynamic KPI Metrics Calculation strictly based on real database records
  const kpiMetrics = useMemo(() => {
    const todaySchedule = getScheduleForDate(new Date());
    let totalDutyToday = 0;
    todaySchedule.shifts.forEach((s) => {
      totalDutyToday += (s.leadOfficer ? 1 : 0) + s.members.length;
    });
    const totalRestToday = todaySchedule.restDayPersonnel.length;
    const totalActive = profiles.length;

    return {
      dutyPersonnelCount: totalDutyToday,
      restPersonnelCount: totalRestToday,
      activePersonnelCount: totalActive,
    };
  }, [getScheduleForDate, profiles]);

  // Month navigation handlers
  const handlePrevMonth = () => setCurrentMonth((prev) => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth((prev) => addMonths(prev, 1));
  const handleJumpToToday = () => {
    setCurrentMonth(new Date());
    showToast('Jumped to current month view');
  };

  // ===========================================================================
  // EDIT DAY SHIFT ROSTER HANDLERS (SUPABASE INTEGRATION)
  // ===========================================================================
  const handleOpenEditDay = (daySchedule: DayDutySchedule) => {
    const dateKey = daySchedule.dateKey;
    setEditingDayDate(daySchedule.date);

    // Map existing assignments for this date
    const currentForDate = dbAssignments.filter((a) => a.duty_date === dateKey);
    const initialAssignments: EditDayAssignment[] = currentForDate.map((a) => ({
      profileId: a.profile_id,
      shiftScheduleId: a.shift_schedule_id || null,
      assignmentType: a.assignment_type as 'duty' | 'rest',
      isLead: !!a.is_lead,
    }));

    setEditingDayAssignments(initialAssignments);
    setSelectedAddProfileId({});
    setIsEditDayModalOpen(true);
  };

  const handleAddOfficerToShift = (shiftScheduleId: string, profileId: string) => {
    if (!profileId) return;
    setEditingDayAssignments((prev) => {
      const filtered = prev.filter((a) => a.profileId !== profileId);
      return [
        ...filtered,
        {
          profileId,
          shiftScheduleId,
          assignmentType: 'duty',
          isLead: false,
        },
      ];
    });
    setSelectedAddProfileId((prev) => ({ ...prev, [shiftScheduleId]: '' }));
  };

  const handleAddOfficerToRest = (profileId: string) => {
    if (!profileId) return;
    setEditingDayAssignments((prev) => {
      const filtered = prev.filter((a) => a.profileId !== profileId);
      return [
        ...filtered,
        {
          profileId,
          shiftScheduleId: null,
          assignmentType: 'rest',
          isLead: false,
        },
      ];
    });
    setSelectedAddProfileId((prev) => ({ ...prev, rest: '' }));
  };

  const handleRemoveOfficerFromDay = (profileId: string) => {
    setEditingDayAssignments((prev) => prev.filter((a) => a.profileId !== profileId));
  };



  const handleSaveDaySchedule = async () => {
    if (!editingDayDate) return;
    const dateKey = format(editingDayDate, 'yyyy-MM-dd');

    try {
      setIsSavingDay(true);

      // 1. Delete previous assignments for this date
      const { error: deleteError } = await supabase
        .from('duty_roster_assignments')
        .delete()
        .eq('duty_date', dateKey);

      if (deleteError) {
        console.warn('Delete error notice:', deleteError.message);
      }

      // 2. Insert updated assignments
      if (editingDayAssignments.length > 0) {
        const recordsToInsert = editingDayAssignments.map((a) => ({
          profile_id: a.profileId,
          shift_schedule_id: a.assignmentType === 'duty' ? a.shiftScheduleId : null,
          duty_date: dateKey,
          assignment_type: a.assignmentType,
          is_lead: a.isLead,
          created_by: user?.id || null,
        }));

        const { error: insertError } = await supabase
          .from('duty_roster_assignments')
          .insert(recordsToInsert);

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      showToast(`Roster for ${format(editingDayDate, 'MMMM d, yyyy')} updated successfully.`);
      await fetchRosterData();
      setIsEditDayModalOpen(false);
      setSelectedDaySchedule(null);

      // Broadcast update across tabs
      if (typeof window !== 'undefined') {
        try {
          const bc = new BroadcastChannel('pdrrmo_shift_sync');
          bc.postMessage({ type: 'shift_state_updated', timestamp: Date.now() });
          bc.close();
        } catch (e) {}
        localStorage.setItem('pdrrmo_shift_sync', Date.now().toString());
      }
    } catch (err: any) {
      console.error('Error saving day schedule:', err);
      showToast(`Error saving schedule: ${err.message || 'Database error'}`);
    } finally {
      setIsSavingDay(false);
    }
  };

  const handleClearDaySchedule = async () => {
    if (!editingDayDate) return;
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

      showToast(`All assignments cleared for ${format(editingDayDate, 'MMMM d, yyyy')}.`);
      await fetchRosterData();
      setIsEditDayModalOpen(false);
      setSelectedDaySchedule(null);

      if (typeof window !== 'undefined') {
        try {
          const bc = new BroadcastChannel('pdrrmo_shift_sync');
          bc.postMessage({ type: 'shift_state_updated', timestamp: Date.now() });
          bc.close();
        } catch (e) {}
        localStorage.setItem('pdrrmo_shift_sync', Date.now().toString());
      }
    } catch (err: any) {
      console.error('Error clearing day assignments:', err);
      showToast(`Failed to clear assignments: ${err.message}`);
    } finally {
      setIsSavingDay(false);
    }
  };

  // ===========================================================================
  // BATCH SAVE SHIFT SCHEDULE (SUPABASE UPSERT WITH PROPER UUID)
  // ===========================================================================
  const handleSaveShiftSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (shiftSchedules.length === 0) {
      showToast('No shift schedules available in system. Please add shift schedules in Access Control first.');
      return;
    }
    if (!selectedShiftScheduleId) {
      showToast('Please select a valid shift schedule.');
      return;
    }
    if (selectedPersonnelIds.length === 0) {
      showToast('Please select at least one personnel member.');
      return;
    }
    if (selectedDutyDates.length === 0 && selectedDayOffDates.length === 0) {
      showToast('Please select at least one duty date or day off date.');
      return;
    }

    try {
      setIsSaving(true);

      const records: DutyRosterAssignmentRecord[] = [];

      for (const profileId of selectedPersonnelIds) {
        // Add duty dates with the exact shift_schedule_id UUID
        for (const dateStr of selectedDutyDates) {
          records.push({
            profile_id: profileId,
            shift_schedule_id: selectedShiftScheduleId,
            duty_date: dateStr,
            assignment_type: 'duty',
            is_lead: false,
            created_by: user?.id || null,
          });
        }
        // Add day off dates (shift_schedule_id is null for rest days)
        for (const dateStr of selectedDayOffDates) {
          records.push({
            profile_id: profileId,
            shift_schedule_id: null,
            duty_date: dateStr,
            assignment_type: 'rest',
            is_lead: false,
            created_by: user?.id || null,
          });
        }
      }

      // Upsert to Supabase
      const { error } = await supabase
        .from('duty_roster_assignments')
        .upsert(records, { onConflict: 'profile_id,duty_date' });

      if (error) {
        console.warn('Upsert error:', error.message);
        showToast(`Error saving roster: ${error.message}`);
        return;
      }

      const targetSched = shiftSchedules.find((s) => s.id === selectedShiftScheduleId);
      showToast(
        `Configured ${targetSched?.name || 'Shift'}: ${selectedPersonnelIds.length} personnel (${selectedDutyDates.length} Duty, ${selectedDayOffDates.length} Day Off)`
      );
      await fetchRosterData();
      setIsAddScheduleModalOpen(false);
    } catch (err) {
      console.error('Error saving shift assignments:', err);
      showToast('Failed to save shift assignments.');
    } finally {
      setIsSaving(false);
    }
  };

  // Download real .xlsx workbook via SheetJS with dynamic shift columns
  const handleDownloadXLSX = () => {
    try {
      const data = monthActiveDays.map((d) => {
        const s = d.schedule;
        const row: Record<string, string> = {
          Date: format(d.date, 'yyyy-MM-dd'),
          Day: format(d.date, 'EEEE'),
        };

        if (shiftSchedules.length > 0) {
          shiftSchedules.forEach((sched) => {
            const matchedShift = s.shifts.find(
              (sh) => sh.scheduleId === sched.id || sh.scheduleName.toLowerCase() === sched.name.toLowerCase()
            );
            if (matchedShift) {
              const officers = [
                ...(matchedShift.leadOfficer ? [`${matchedShift.leadOfficer.name} (Lead)`] : []),
                ...matchedShift.members.map((m) => m.name),
              ];
              row[`${sched.name} (${sched.time})`] = officers.length > 0 ? officers.join('\n') : '—';
            } else {
              row[`${sched.name} (${sched.time})`] = '—';
            }
          });
        } else {
          const summaries = s.shifts.map((sh) => {
            const officers = [
              ...(sh.leadOfficer ? [`${sh.leadOfficer.name} (Lead)`] : []),
              ...sh.members.map((m) => m.name),
            ];
            return `${sh.scheduleName} (${sh.timeLabel}):\n${officers.join(', ')}`;
          });
          row['Duty Assignments'] = summaries.length > 0 ? summaries.join('\n\n') : '—';
        }

        row['Rest Day / Off-Duty'] =
          s.restDayPersonnel.length > 0 ? s.restDayPersonnel.map((p) => p.name).join('\n') : '—';

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, format(currentMonth, 'MMM yyyy'));
      const filename = `PDRRMO_Shift_Schedule_${format(currentMonth, 'yyyy_MM')}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast(`Exported ${filename} successfully.`);
    } catch (err) {
      console.error('Error generating XLSX:', err);
      showToast('Could not export XLSX file.');
    }
  };

  // Print pure clean table document following Template-Example-FileFormat-MLS.docx
  const handlePrintTable = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const cebuSealUrl = `${origin}/assets/cebu-seal.png`;
    const pdrrmoLogoUrl = `${origin}/assets/pdrrmo-logo.png`;

    const dynamicTh =
      shiftSchedules.length > 0
        ? shiftSchedules.map((sched) => `<th>${sched.name} (${sched.time})</th>`).join('')
        : '<th>Duty Assignments</th>';

    const rowsHtml = monthActiveDays
      .map((cell, idx) => {
        const s = cell.schedule;
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        let shiftTds = '';
        if (shiftSchedules.length > 0) {
          shiftTds = shiftSchedules
            .map((sched) => {
              const matchedShift = s.shifts.find(
                (sh) => sh.scheduleId === sched.id || sh.scheduleName.toLowerCase() === sched.name.toLowerCase()
              );
              if (matchedShift) {
                const officers = [
                  ...(matchedShift.leadOfficer
                    ? [`<strong>${matchedShift.leadOfficer.name}</strong> <span style="font-size:7pt;color:#004AC6;">(Lead)</span>`]
                    : []),
                  ...matchedShift.members.map((m) => m.name),
                ];
                return `<td style="padding: 6px 8px; border: 1px solid #94a3b8; vertical-align: top; line-height: 1.35; color: #1e293b;">${officers.join('<br/>')}</td>`;
              }
              return `<td style="padding: 6px 8px; border: 1px solid #94a3b8; vertical-align: top; line-height: 1.35; color: #94a3b8; text-align: center;">—</td>`;
            })
            .join('');
        } else {
          const summaries = s.shifts.map((sh) => {
            const officers = [
              ...(sh.leadOfficer ? [`<strong>${sh.leadOfficer.name}</strong> (Lead)`] : []),
              ...sh.members.map((m) => m.name),
            ];
            return `<strong>${sh.scheduleName} (${sh.timeLabel}):</strong><br/>${officers.join(', ')}`;
          });
          shiftTds = `<td style="padding: 6px 8px; border: 1px solid #94a3b8; vertical-align: top; line-height: 1.35; color: #1e293b;">${summaries.length > 0 ? summaries.join('<br/><br/>') : '<span style="color:#94a3b8;">—</span>'}</td>`;
        }

        const restDayNames =
          s.restDayPersonnel.length > 0
            ? s.restDayPersonnel.map((p) => p.name).join('<br/>')
            : '<span style="color: #94a3b8;">—</span>';

        return `
          <tr style="background-color: ${rowBg}; border-bottom: 1px solid #cbd5e1; page-break-inside: avoid;">
            <td style="padding: 6px 8px; border: 1px solid #94a3b8; font-family: monospace; font-weight: bold; text-align: center; vertical-align: top;">${format(cell.date, 'yyyy-MM-dd')}</td>
            <td style="padding: 6px 8px; border: 1px solid #94a3b8; font-weight: bold; text-align: center; vertical-align: top;">${format(cell.date, 'EEEE')}</td>
            ${shiftTds}
            <td style="padding: 6px 8px; border: 1px solid #94a3b8; vertical-align: top; line-height: 1.35; color: #1e293b;">${restDayNames}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>PDRRMO Shift Schedule - ${format(currentMonth, 'MMMM yyyy')}</title>
          <style>
            @page {
              size: landscape;
              margin: 8mm 10mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 6px;
              background: #ffffff;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 6px;
            }
            .header-table td {
              border: none !important;
              padding: 0;
            }
            .logo-cell {
              width: 75px;
              text-align: center;
              vertical-align: middle;
            }
            .logo-img {
              width: 65px;
              height: 65px;
              object-fit: contain;
            }
            .text-cell {
              text-align: center;
              vertical-align: middle;
              padding: 0 10px;
            }
            .gov-line-1 {
              font-size: 9pt;
              color: #1e293b;
              margin: 0;
              line-height: 1.25;
            }
            .gov-line-2 {
              font-size: 9pt;
              color: #1e293b;
              margin: 0;
              line-height: 1.25;
            }
            .gov-office {
              font-size: 11pt;
              font-weight: bold;
              color: #000000;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              margin: 2px 0;
            }
            .gov-contact {
              font-size: 7.5pt;
              color: #475569;
              margin: 1px 0;
            }
            .gov-system {
              font-size: 8.5pt;
              font-weight: 600;
              color: #004AC6;
              margin: 1px 0 0 0;
            }
            .divider-line {
              border: none;
              border-top: 1.5px solid #334155;
              margin: 5px 0 8px 0;
            }
            .meta-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 9pt;
              font-weight: bold;
              margin-bottom: 8px;
              color: #0f172a;
            }
            .meta-bar .title {
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta-bar .month {
              color: #004AC6;
            }
            table.schedule-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 8.5pt;
            }
            table.schedule-table th {
              background-color: #004AC6 !important;
              color: #ffffff !important;
              padding: 7px 6px;
              border: 1px solid #00379b;
              text-align: left;
              font-weight: bold;
              text-transform: uppercase;
              font-size: 8pt;
              letter-spacing: 0.3px;
            }
            table.schedule-table th.center {
              text-align: center;
            }
            .footer {
              margin-top: 10px;
              display: flex;
              justify-content: space-between;
              font-size: 7.5pt;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td class="logo-cell">
                <img src="${cebuSealUrl}" class="logo-img" alt="Province of Cebu Seal" onerror="this.style.display='none'" />
              </td>
              <td class="text-cell">
                <div class="gov-line-1">Republic of the Philippines</div>
                <div class="gov-line-2">Province of Cebu</div>
                <div class="gov-office">PROVINCIAL DISASTER RISK MANAGEMENT OFFICE</div>
                <div class="gov-contact">(032) 888-2328 LOCAL 2301 or 2302 | Email: pdrrmo.cebu@gmail.com</div>
                <div class="gov-system">Monitoring Logs System</div>
              </td>
              <td class="logo-cell">
                <img src="${pdrrmoLogoUrl}" class="logo-img" alt="PDRRMO Logo" onerror="this.style.display='none'" />
              </td>
            </tr>
          </table>

          <hr class="divider-line" />

          <div class="meta-bar">
            <span class="title">Disaster Operations Center · Shift Schedule Duty Roster</span>
            <span class="month">Month of ${format(currentMonth, 'MMMM yyyy')}</span>
          </div>

          <table class="schedule-table">
            <thead>
              <tr>
                <th class="center" style="width: 88px;">Date</th>
                <th class="center" style="width: 82px;">Day</th>
                ${dynamicTh}
                <th style="width: 170px;">Rest Day / Off-Duty</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <span>Total ${monthActiveDays.length} operational schedule rows for ${format(currentMonth, 'MMMM yyyy')}</span>
            <span>Generated from Provincial Disaster Risk Reduction and Management Office (PDRRMO)</span>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <AppLayoutShell
      title="Shift Schedule Calendar"
      subtitle="Monthly operational duty assignments, shift rotations, and personnel roster."
    >
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* ========================================================================= */}
        {/* 1. HEADER SECTION */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
                Shift Schedule Calendar
              </h1>
              {isLoading && (
                <div className="flex items-center gap-1 text-xs text-[#004AC6] font-semibold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Syncing Roster...</span>
                </div>
              )}
            </div>
            <p className="text-sm sm:text-base text-[#505F76] mt-1 font-medium">
              View and audit monthly operational shift rotations, officer station assignments, and duty rosters.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Refresh Button */}
            <SecondaryButton
              size="md"
              pill
              onClick={fetchRosterData}
              disabled={isLoading}
              leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </SecondaryButton>

            {/* Print Button: Opens XLSX Table Preview */}
            <SecondaryButton
              size="md"
              pill
              onClick={() => setIsPrintXLSXModalOpen(true)}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              Print
            </SecondaryButton>

            {/* Add Shift Schedule Button */}
            {!isSettingsViewOnly && (
              <PrimaryButton
                size="md"
                pill
                onClick={() => setIsAddScheduleModalOpen(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add Shift Schedule
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* View-Only Banner */}
        <ViewOnlyNotice
          screen="Settings"
          message="Shift schedules and officer assignments are presented in live database audit mode."
        />

        {/* ========================================================================= */}
        {/* 2. SUMMARY METRICS CARDS ROW */}
        {/* ========================================================================= */}
        {isLoading ? (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </section>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Total Duty Personnel */}
            <SummaryCard
              title="Total Duty Personnel"
              value={kpiMetrics.dutyPersonnelCount.toString()}
              change={kpiMetrics.dutyPersonnelCount > 0 ? "Scheduled Today" : "None Today"}
              changeType={kpiMetrics.dutyPersonnelCount > 0 ? "positive" : "neutral"}
              ambientColor="bg-[#004AC6]/5"
              iconBg="bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15"
              icon={<Users className="w-6 h-6" />}
              subtitle="Personnel active on operational shifts today"
            />

            {/* Card 2: Total Rest Day Personnel */}
            <SummaryCard
              title="Total Rest Day Personnel"
              value={kpiMetrics.restPersonnelCount.toString()}
              change={kpiMetrics.restPersonnelCount > 0 ? "Scheduled Off" : "None Off"}
              changeType="neutral"
              ambientColor="bg-[#D97706]/5"
              iconBg="bg-amber-50 text-amber-700 border border-amber-200"
              icon={<UserCheck className="w-6 h-6" />}
              subtitle="Personnel on scheduled rotation rest day"
            />

            {/* Card 3: Total Active Personnel */}
            <SummaryCard
              title="Total Active Personnel"
              value={kpiMetrics.activePersonnelCount.toString()}
              change="Registered Personnel"
              changeType="positive"
              ambientColor="bg-emerald-500/5"
              iconBg="bg-emerald-50 text-emerald-700 border border-emerald-200"
              icon={<ShieldCheck className="w-6 h-6" />}
              subtitle="Total registered responder roster capacity"
            />
          </section>
        )}

        {/* ========================================================================= */}
        {/* 3. CALENDAR UI/UX: MONTHLY GRID VIEW WITH DYNAMIC SHIFT FILTERS */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm overflow-visible flex flex-col">
          {/* Calendar Toolbar Header */}
          <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white rounded-t-[1.75rem]">
            {/* Month Navigation Controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-full p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:bg-white hover:text-[#1E293B] hover:shadow-2xs transition-all cursor-pointer"
                  aria-label="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm sm:text-base font-bold text-[#1E293B] px-4 min-w-[170px] text-center select-none">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:bg-white hover:text-[#1E293B] hover:shadow-2xs transition-all cursor-pointer"
                  aria-label="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleJumpToToday}
                className="text-xs font-semibold px-3.5 py-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] text-[#505F76] hover:bg-[#004AC6] hover:text-white hover:border-[#004AC6] transition-all cursor-pointer"
              >
                Today
              </button>
            </div>

            {/* Dropdown Filters: Dynamic Shift & User Role Dropdowns */}
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {/* 1. Dynamic Shift Filter Dropdown */}
              <div className="w-48 sm:w-56 shrink-0">
                <CustomDropdown
                  options={shiftFilterDropdownOptions}
                  value={selectedShiftFilter}
                  onChange={(val) => setSelectedShiftFilter(val)}
                  leftIcon={<CalendarDays className="w-3.5 h-3.5 text-[#004AC6]" />}
                  placeholder="Filter Shift"
                  size="sm"
                  pill
                />
              </div>

              {/* 2. User Role Filter Dropdown */}
              <div className="w-40 sm:w-44 shrink-0">
                <CustomDropdown
                  options={roleFilterDropdownOptions}
                  value={selectedRoleFilter}
                  onChange={(val) => setSelectedRoleFilter(val)}
                  leftIcon={<Shield className="w-3.5 h-3.5 text-[#004AC6]" />}
                  placeholder="Filter Role"
                  size="sm"
                  pill
                />
              </div>
            </div>
          </div>

          {/* Monthly 7-Column Grid Table */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <CalendarSkeleton variant="full" daysCount={35} />
            ) : (
              <div className="min-w-[840px]">
                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
                    (dayName) => (
                      <div
                        key={dayName}
                        className="py-3 px-3 text-center text-xs font-bold text-[#505F76] uppercase tracking-wider border-r border-[#E2E8F0] last:border-r-0"
                      >
                        <span className="hidden sm:inline">{dayName}</span>
                        <span className="sm:hidden">{dayName.slice(0, 3)}</span>
                      </div>
                    )
                  )}
                </div>

                {/* Day Cells Grid */}
                <div className="grid grid-cols-7 divide-y divide-[#E2E8F0]">
                  {calendarDays.map((cell, index) => {
                    const { date, isCurrentMonth, isCurrentDay, schedule } = cell;
                    const dayNum = date.getDate();

                    // Filter shifts based on selectedShiftFilter
                    const visibleShifts = schedule.shifts.filter((shift) => {
                      if (selectedShiftFilter === 'ALL') return true;
                      return (
                        shift.scheduleId === selectedShiftFilter ||
                        shift.scheduleName.toLowerCase().includes(selectedShiftFilter.toLowerCase())
                      );
                    });

                    return (
                      <div
                        key={cell.schedule.dateKey + index}
                        onClick={() => setSelectedDaySchedule(schedule)}
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
                                    {shift.startTime?.replace(/H/gi, '')}–{shift.endTime?.replace(/H/gi, '')}
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
                        </div>

                        {/* Footer Controls on Hover */}
                        <div className="mt-1 flex items-center justify-between text-[10px] text-[#004AC6] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isSettingsViewOnly ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditDay(schedule);
                              }}
                              className="flex items-center gap-0.5 text-[#004AC6] hover:underline cursor-pointer font-bold"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                              <span>Edit</span>
                            </button>
                          ) : <span />}
                          <span className="text-[#505F76] font-medium">Details →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL / INSPECTOR: DYNAMIC DAY SHIFT DUTY ROSTER DETAILS */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedDaySchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDaySchedule(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden z-10 flex flex-col max-h-[88vh]"
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
                  onClick={() => setSelectedDaySchedule(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body: Dynamic Shift Rotations with Category Cards & Dynamic Colors */}
              <div className="p-6 space-y-5 overflow-y-auto">
                {selectedDaySchedule.shifts.length === 0 && selectedDaySchedule.restDayPersonnel.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1E293B]">
                        No Shifts Assigned for this Date
                      </p>
                      <p className="text-xs text-[#757680] mt-0.5">
                        There are no duty assignments or off-duty rotations scheduled for {format(selectedDaySchedule.date, 'MMMM d, yyyy')}.
                      </p>
                    </div>
                    {!isSettingsViewOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          const dateKey = selectedDaySchedule.dateKey;
                          setSelectedDaySchedule(null);
                          setScheduleMonth(format(selectedDaySchedule.date, 'yyyy-MM'));
                          setSelectedDutyDates([dateKey]);
                          setSelectedDayOffDates([]);
                          setIsAddScheduleModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#004AC6] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Assign Personnel for this Date</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Render Each Active Shift Card Dynamically with its Own Specific Color & Times */}
                    {selectedDaySchedule.shifts.map((shift) => {
                      const shiftColor = shift.color || '#004AC6';
                      const allOfficers = [
                        ...(shift.leadOfficer ? [shift.leadOfficer] : []),
                        ...shift.members,
                      ];
                      const matchingOfficers = allOfficers.filter((o) => matchesRole(o, selectedRoleFilter));

                      return (
                        <div
                          key={shift.scheduleId}
                          style={{
                            backgroundColor: `${shiftColor}0D`,
                            borderColor: `${shiftColor}40`,
                          }}
                          className="p-4 rounded-2xl border space-y-3 transition-all"
                        >
                          {/* Shift Header */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                                  style={{ backgroundColor: shiftColor }}
                                />
                                <h4 className="text-sm sm:text-base font-bold text-[#1E293B]">
                                  {shift.scheduleName}
                                </h4>
                                {shift.targetRole && shift.targetRole !== 'ALL' && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 shadow-2xs">
                                    {shift.targetRole}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#505F76] font-mono block mt-0.5">
                                {shift.startTime} – {shift.endTime} {shift.duration ? `· ${shift.duration}` : ''}
                              </span>
                            </div>

                            <span
                              style={{
                                color: shiftColor,
                                borderColor: `${shiftColor}40`,
                              }}
                              className="text-xs font-bold bg-white px-3 py-1 rounded-full border shadow-2xs"
                            >
                              {shift.scheduleName.split(' ')[0]} Shift
                            </span>
                          </div>

                          {/* Personnel Grid */}
                          {matchingOfficers.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {/* Lead Officer Card */}
                              {shift.leadOfficer && matchesRole(shift.leadOfficer, selectedRoleFilter) && (() => {
                                const lead = shift.leadOfficer;
                                const badge = getRoleBadge(lead.userRole);
                                return (
                                  <div
                                    key={lead.id}
                                    style={{ borderColor: `${shiftColor}30` }}
                                    className="p-2.5 rounded-xl bg-white border flex items-center justify-between shadow-2xs ring-1 ring-black/5"
                                  >
                                    <div className="min-w-0 pr-2">
                                      <span className="text-xs font-bold text-[#1E293B] block truncate">
                                        {lead.name}
                                      </span>
                                      <span className="text-[10px] text-[#757680] block truncate">
                                        {lead.role}
                                      </span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                      <span
                                        style={{
                                          color: shiftColor,
                                          backgroundColor: `${shiftColor}15`,
                                        }}
                                        className="text-[10px] font-bold px-2 py-0.5 rounded"
                                      >
                                        Lead Officer
                                      </span>
                                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${badge.badgeClass}`}>
                                        {badge.label}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Member Officer Cards */}
                              {shift.members
                                .filter((m) => matchesRole(m, selectedRoleFilter) && m.id !== shift.leadOfficer?.id)
                                .map((member) => {
                                  const badge = getRoleBadge(member.userRole);
                                  return (
                                    <div
                                      key={member.id}
                                      className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between shadow-2xs"
                                    >
                                      <div className="min-w-0 pr-2">
                                        <span className="text-xs font-bold text-[#1E293B] block truncate">
                                          {member.name}
                                        </span>
                                        <span className="text-[10px] text-[#757680] block truncate">
                                          {member.role}
                                        </span>
                                      </div>
                                      <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                          Duty Member
                                        </span>
                                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${badge.badgeClass}`}>
                                          {badge.label}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <div className="py-2 text-center text-xs text-slate-400 italic">
                              No {selectedRoleFilter !== 'ALL' ? selectedRoleFilter : ''} personnel assigned to this shift.
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Rest Day / Off-Duty Card */}
                    {selectedDaySchedule.restDayPersonnel.length > 0 && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider block">
                          Off-Duty / Rest Day Personnel
                        </span>
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {selectedDaySchedule.restDayPersonnel
                            .filter((person) => matchesRole(person, selectedRoleFilter))
                            .map((person) => {
                              const badge = getRoleBadge(person.userRole);
                              return (
                                <span
                                  key={person.id}
                                  className="text-xs font-semibold bg-white border border-[#E2E8F0] px-3 py-1.5 rounded-xl text-slate-700 shadow-2xs flex items-center gap-2"
                                >
                                  <span>{person.name} ({person.role})</span>
                                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${badge.badgeClass}`}>
                                    {badge.label}
                                  </span>
                                </span>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center shrink-0">
                {!isSettingsViewOnly ? (
                  <SecondaryButton
                    size="md"
                    pill
                    onClick={() => handleOpenEditDay(selectedDaySchedule)}
                    leftIcon={<Edit2 className="w-3.5 h-3.5 text-[#004AC6]" />}
                  >
                    Edit Day Roster
                  </SecondaryButton>
                ) : (
                  <div />
                )}
                <PrimaryButton
                  size="md"
                  pill
                  onClick={() => setSelectedDaySchedule(null)}
                >
                  Close
                </PrimaryButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 4.5 MODAL: EDIT DAY SHIFT ROSTER SCHEDULE (100% DYNAMIC EDIT FEATURE) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEditDayModalOpen && editingDayDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSavingDay && setIsEditDayModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
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
                      Assign, reassign, or remove personnel and manage shift duty rosters for this date
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSavingDay}
                  onClick={() => setIsEditDayModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body: Editable Shifts & Rest Day */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* 1. Shift Schedule Groups */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[#505F76] uppercase tracking-wider">
                    Shift Roster Rotations ({shiftSchedules.length} Timetables)
                  </h4>

                  {shiftSchedules.map((sched) => {
                    const shiftColor = sched.color || '#004AC6';
                    // Officers currently assigned to this shift in the edit state
                    const assignedToThisShift = editingDayAssignments.filter(
                      (a) => a.assignmentType === 'duty' && a.shiftScheduleId === sched.id
                    );

                    const currentSelectedAdd = selectedAddProfileId[sched.id] || '';

                    return (
                      <div
                        key={sched.id}
                        style={{
                          backgroundColor: `${shiftColor}08`,
                          borderColor: `${shiftColor}30`,
                        }}
                        className="p-4 rounded-2xl border space-y-3"
                      >
                        {/* Shift Title Bar */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: shiftColor }}
                            />
                            <h5 className="text-sm font-bold text-[#1E293B]">{sched.name}</h5>
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
                            style={{ color: shiftColor, borderColor: `${shiftColor}30` }}
                            className="text-xs font-bold bg-white px-2.5 py-0.5 rounded-full border shadow-2xs"
                          >
                            {assignedToThisShift.length} Personnel
                          </span>
                        </div>

                        {/* Assigned Officers List */}
                        <div className="space-y-2">
                          {assignedToThisShift.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {assignedToThisShift.map((assignment) => {
                                const officer = profiles.find((p) => p.id === assignment.profileId);
                                const badge = getRoleBadge(officer?.userRole);
                                const officerName = officer?.name || 'Duty Responder';
                                const officerRole = officer?.role || 'Responder';

                                return (
                                  <div
                                    key={assignment.profileId}
                                    className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 shadow-2xs transition-all"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-7 h-7 rounded-full bg-[#004AC6] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                        {officer?.avatarInitials || 'OP'}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <p className="text-xs font-bold text-[#1E293B] truncate">
                                            {officerName}
                                          </p>
                                          <span className={`text-[8px] font-semibold px-1 py-0.2 rounded border ${badge.badgeClass}`}>
                                            {badge.label}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-[#757680] truncate">
                                          {officerRole}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {/* Remove Officer from Shift */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveOfficerFromDay(assignment.profileId)
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
                          ) : (
                            <div className="p-3 text-center text-xs text-slate-400 bg-white/50 rounded-xl border border-dashed border-slate-200">
                              No personnel assigned to {sched.name} yet.
                            </div>
                          )}
                        </div>

                        {/* Quick Add Personnel into this Shift */}
                        <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <select
                            value={currentSelectedAdd}
                            onChange={(e) =>
                              setSelectedAddProfileId((prev) => ({
                                ...prev,
                                [sched.id]: e.target.value,
                              }))
                            }
                            className="bg-white border border-[#CBD5E1] rounded-xl py-1.5 px-3 text-xs text-[#1E293B] focus:outline-none focus:border-[#004AC6] flex-1 min-w-[200px]"
                          >
                            <option value="">-- Select Personnel to Add --</option>
                            {profiles.map((p) => {
                              const isAlreadyInDay = editingDayAssignments.some(
                                (a) => a.profileId === p.id
                              );
                              return (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.role}) {isAlreadyInDay ? '· Already in Roster' : ''}
                                </option>
                              );
                            })}
                          </select>

                          <button
                            type="button"
                            disabled={!currentSelectedAdd}
                            onClick={() =>
                              handleAddOfficerToShift(sched.id, currentSelectedAdd)
                            }
                            className="px-3 py-1.5 bg-[#004AC6] hover:bg-[#003ca3] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Add Officer</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. Rest Day / Off-Duty Section */}
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarX className="w-4 h-4 text-amber-700" />
                      <h4 className="text-sm font-bold text-amber-900">
                        Rest Day / Off-Duty Personnel
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-amber-800 bg-white px-2.5 py-0.5 rounded-full border border-amber-200">
                      {
                        editingDayAssignments.filter((a) => a.assignmentType === 'rest')
                          .length
                      }{' '}
                      Personnel
                    </span>
                  </div>

                  {/* Rest Personnel Tags */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {editingDayAssignments.filter((a) => a.assignmentType === 'rest').length >
                    0 ? (
                      editingDayAssignments
                        .filter((a) => a.assignmentType === 'rest')
                        .map((assignment) => {
                          const officer = profiles.find((p) => p.id === assignment.profileId);
                          return (
                            <span
                              key={assignment.profileId}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-xs font-bold text-slate-800 shadow-2xs"
                            >
                              <span>{officer?.name || 'Officer'}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveOfficerFromDay(assignment.profileId)
                                }
                                className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Remove from rest day"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          );
                        })
                    ) : (
                      <div className="text-xs text-amber-800/80 italic py-1">
                        No personnel scheduled for rest day on this date.
                      </div>
                    )}
                  </div>

                  {/* Add Officer to Rest Day */}
                  <div className="pt-2 border-t border-amber-200 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <select
                      value={selectedAddProfileId['rest'] || ''}
                      onChange={(e) =>
                        setSelectedAddProfileId((prev) => ({
                          ...prev,
                          rest: e.target.value,
                        }))
                      }
                      className="bg-white border border-amber-300 rounded-xl py-1.5 px-3 text-xs text-[#1E293B] focus:outline-none focus:border-amber-600 flex-1 min-w-[200px]"
                    >
                      <option value="">-- Add Officer to Rest Day --</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.role})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={!selectedAddProfileId['rest']}
                      onClick={() =>
                        handleAddOfficerToRest(selectedAddProfileId['rest'])
                      }
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Set as Rest Day</span>
                    </button>
                  </div>
                </div>
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
                    onClick={() => setIsEditDayModalOpen(false)}
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
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. MODAL: ADD SHIFT SCHEDULE (MULTI-DATE PICKER + SUPABASE BATCH SAVE) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAddScheduleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSaving && setIsAddScheduleModalOpen(false)}
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
                    Configure multi-date duty rotations and day-off schedules for designated shift personnel
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsAddScheduleModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveShiftSchedule} className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* 1. Month of & Shift Schedule Dropdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Month of */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                      Month of
                    </label>
                    <input
                      type="month"
                      required
                      value={scheduleMonth}
                      onChange={(e) => setScheduleMonth(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-2.5 px-3.5 text-sm text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all font-medium"
                    />
                  </div>

                  {/* Shift Schedule Dropdown (Stored by ID) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                      Shift Schedule
                    </label>
                    {shiftSchedules.length > 0 ? (
                      <select
                        value={selectedShiftScheduleId}
                        onChange={(e) => handleShiftScheduleChange(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-2.5 px-3.5 text-sm text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all font-medium"
                      >
                        {shiftSchedules.map((sched) => (
                          <option key={sched.id} value={sched.id}>
                            {sched.name} · {sched.time} {sched.targetRole ? `(${sched.targetRole})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        No shift schedules found. Please create one in <strong>Settings → Access Control</strong>.
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Personnel Checklist */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                      Assigned Personnel ({visiblePersonnel.length} available)
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleAllPersonnel(true)}
                        className="text-[#004AC6] font-semibold hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAllPersonnel(false)}
                        className="text-[#505F76] hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5 max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {visiblePersonnel.length > 0 ? (
                      visiblePersonnel.map((officer) => {
                        const isChecked = selectedPersonnelIds.includes(officer.id);
                        const badge = getRoleBadge(officer.userRole);
                        return (
                          <label
                            key={officer.id}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                              isChecked
                                ? 'bg-white border-[#004AC6]/40 shadow-xs ring-1 ring-[#004AC6]/20'
                                : 'bg-white/60 border-[#E2E8F0] opacity-70 hover:opacity-100 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePersonnel(officer.id)}
                                className="w-4 h-4 rounded text-[#004AC6] focus:ring-[#004AC6] shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-[#1E293B] block truncate">
                                  {officer.name}
                                </span>
                                <span className="text-[11px] text-[#757680] block truncate">
                                  {officer.role} · <span className="font-mono">{officer.badgeNumber}</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.badgeClass}`}>
                                {badge.label}
                              </span>
                              {officer.defaultShift && (
                                <span className="text-[10px] font-bold text-[#004AC6] bg-blue-50 px-2 py-0.5 rounded">
                                  {officer.defaultShift.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <div className="col-span-full py-4 text-center text-xs text-slate-500">
                        No active personnel registered in system.
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. UNIFIED MULTI-DATE PICKER CARD (DUTY & DAY OFF DATES) */}
                <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                  {/* Card Header with Single Picker Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-[#004AC6]" />
                        <h4 className="text-sm font-bold text-[#1E293B]">
                          Schedule Dates Multi-Picker ({format(scheduleMonthDate, 'MMMM yyyy')})
                        </h4>
                      </div>
                      <p className="text-[11px] text-[#505F76] mt-0.5">
                        Click any date to assign it as Duty (Blue) or Day Off (Amber).
                      </p>
                    </div>

                    {/* Quick Reset Link */}
                    <button
                      type="button"
                      onClick={handleClearAllDates}
                      className="text-[11px] text-slate-500 hover:text-red-600 font-semibold flex items-center gap-1 transition-colors self-end sm:self-auto cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Reset All Dates
                    </button>
                  </div>

                  {/* Picker Button / Segmented Controller: Choose Active Mode */}
                  <div className="grid grid-cols-2 p-1 bg-slate-200/80 rounded-2xl gap-1">
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
                      <span>Duty Schedule Dates</span>
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
                      <span>Day Off Dates</span>
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
                  </div>

                  {/* Mode Guidance Alert */}
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                      datePickerMode === 'DUTY'
                        ? 'bg-blue-50/90 border-blue-200 text-[#004AC6]'
                        : 'bg-amber-50/90 border-amber-200 text-amber-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold">
                        {datePickerMode === 'DUTY' ? '🔵 Duty Mode:' : '🟠 Day Off Mode:'}
                      </span>
                      <span>
                        {datePickerMode === 'DUTY'
                          ? 'Click dates on the calendar to mark them as Active Duty.'
                          : 'Click dates on the calendar to mark them as Scheduled Day Off.'}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Month Multi-Date Picker Grid */}
                  <div className="bg-white border border-[#CBD5E1] rounded-2xl p-3 shadow-2xs overflow-hidden">
                    {/* Weekday Header */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#505F76] uppercase tracking-wider pb-2 border-b border-slate-100">
                      <span>Sun</span>
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                      <span>Sat</span>
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1.5 pt-2">
                      {pickerCalendarDays.map((cell) => {
                        const { dateKey, dayNum, isCurrentMonth, isDuty, isDayOff } = cell;

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
                                : 'bg-[#F8FAFC] text-slate-700 hover:bg-slate-200/80 border border-[#E2E8F0]'
                            }`}
                          >
                            <span className="leading-tight">{dayNum}</span>
                            <span
                              className={`text-[8px] uppercase tracking-tighter leading-none mt-0.5 ${
                                isDuty || isDayOff ? 'text-white/90 font-medium' : 'text-slate-400 font-normal'
                              }`}
                            >
                              {isDuty ? 'Duty' : isDayOff ? 'Off' : '—'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1 border-t border-slate-200 text-[#505F76]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1.5 font-bold text-[#004AC6]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#004AC6]" />
                        Duty: {selectedDutyDates.length} Days
                      </span>
                      <span className="flex items-center gap-1.5 font-bold text-amber-700">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                        Day Off: {selectedDayOffDates.length} Days
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-slate-500">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        Unscheduled:{' '}
                        {Math.max(
                          0,
                          pickerMonthDays.length - selectedDutyDates.length - selectedDayOffDates.length
                        )}{' '}
                        Days
                      </span>
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
                    onClick={() => setIsAddScheduleModalOpen(false)}
                  >
                    Cancel
                  </SecondaryButton>

                  <PrimaryButton
                    type="submit"
                    size="md"
                    pill
                    disabled={isSaving || shiftSchedules.length === 0}
                    leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  >
                    {isSaving ? 'Saving Roster...' : 'Save Shift Schedule'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6. MODAL: PRINT PREVIEW (.XLSX TABULAR FORMAT) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isPrintXLSXModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPrintXLSXModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-[#1E293B]">
                        Shift Schedule Table Preview ({format(currentMonth, 'MMMM yyyy')})
                      </h3>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        .XLSX Format
                      </span>
                    </div>
                    <p className="text-xs text-[#757680] mt-0.5">
                      Spreadsheet tabular preview for print and workbook export
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <SecondaryButton
                    size="sm"
                    pill
                    onClick={handleDownloadXLSX}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    Download .XLSX
                  </SecondaryButton>

                  <PrimaryButton
                    size="sm"
                    pill
                    onClick={handlePrintTable}
                    leftIcon={<Printer className="w-3.5 h-3.5" />}
                  >
                    Print Table
                  </PrimaryButton>

                  <button
                    type="button"
                    onClick={() => setIsPrintXLSXModalOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 ml-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Excel Table Spreadsheet Preview */}
              <div className="p-6 overflow-auto flex-1 bg-[#F8FAFC]/50">
                <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-xs overflow-hidden p-6">
                  {/* Official Government Header Banner */}
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-300 mb-4">
                    <div className="w-16 h-16 flex items-center justify-center shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/cebu-seal.png"
                        alt="Province of Cebu Seal"
                        className="w-14 h-14 object-contain"
                      />
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-xs text-slate-700 leading-tight">Republic of the Philippines</p>
                      <p className="text-xs text-slate-700 leading-tight">Province of Cebu</p>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide my-0.5">
                        PROVINCIAL DISASTER RISK MANAGEMENT OFFICE
                      </h4>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        (032) 888-2328 LOCAL 2301 or 2302 | Email: pdrrmo.cebu@gmail.com
                      </p>
                      <p className="text-xs font-semibold text-[#004AC6] mt-0.5">
                        Monitoring Logs System
                      </p>
                    </div>
                    <div className="w-16 h-16 flex items-center justify-center shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/pdrrmo-logo.png"
                        alt="PDRRMO Logo"
                        className="w-14 h-14 object-contain"
                      />
                    </div>
                  </div>

                  {/* Document Title & Meta Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 text-xs font-bold text-[#1E293B]">
                    <span className="uppercase tracking-wider">
                      Disaster Operations Center · Shift Schedule Duty Roster
                    </span>
                    <span className="text-[#004AC6]">
                      Month of {format(currentMonth, 'MMMM yyyy')}
                    </span>
                  </div>

                  {/* Dynamic Table Component */}
                  <div className="border border-[#CBD5E1] rounded-lg overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-medium text-[#1E293B]">
                      <thead>
                        <tr className="bg-[#004AC6] text-white text-[11px] font-bold uppercase tracking-wider divide-x divide-blue-500">
                          <th className="py-2.5 px-3 w-28 text-center">Date</th>
                          <th className="py-2.5 px-3 w-24 text-center">Day</th>
                          {shiftSchedules.length > 0 ? (
                            shiftSchedules.map((sched) => (
                              <th key={sched.id} className="py-2.5 px-3">
                                {sched.name} ({sched.time})
                              </th>
                            ))
                          ) : (
                            <th className="py-2.5 px-3">Duty Assignments</th>
                          )}
                          <th className="py-2.5 px-3 w-56">Rest Day / Off-Duty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {monthActiveDays.map((cell, rowIdx) => {
                          const s = cell.schedule;
                          const isEven = rowIdx % 2 === 0;

                          return (
                            <tr
                              key={s.dateKey}
                              className={`divide-x divide-[#E2E8F0] ${
                                cell.isCurrentDay
                                  ? 'bg-blue-50/70 font-semibold'
                                  : isEven
                                  ? 'bg-white'
                                  : 'bg-slate-50/60'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-[#505F76] whitespace-nowrap align-top">
                                {format(cell.date, 'yyyy-MM-dd')}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-[#1E293B] whitespace-nowrap align-top">
                                {format(cell.date, 'EEEE')}
                              </td>
                              {shiftSchedules.length > 0 ? (
                                shiftSchedules.map((sched) => {
                                  const matchedShift = s.shifts.find(
                                    (sh) =>
                                      sh.scheduleId === sched.id ||
                                      sh.scheduleName.toLowerCase() === sched.name.toLowerCase()
                                  );
                                  return (
                                    <td key={sched.id} className="py-2.5 px-3 align-top">
                                      {matchedShift ? (
                                        <div className="space-y-0.5 text-[#1E293B]">
                                          {matchedShift.leadOfficer && (
                                            <div className="font-bold text-[#004AC6]">
                                              {matchedShift.leadOfficer.name} (Lead)
                                            </div>
                                          )}
                                          {matchedShift.members.map((m) => (
                                            <div key={m.id}>{m.name}</div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-slate-400 italic text-center">—</div>
                                      )}
                                    </td>
                                  );
                                })
                              ) : (
                                <td className="py-2.5 px-3 align-top">
                                  {s.shifts.length > 0 ? (
                                    <div className="space-y-2 text-[#1E293B]">
                                      {s.shifts.map((sh) => (
                                        <div key={sh.scheduleId} className="text-xs">
                                          <div className="font-bold" style={{ color: sh.color }}>
                                            {sh.scheduleName} ({sh.timeLabel}):
                                          </div>
                                          <div className="text-slate-700">
                                            {[
                                              ...(sh.leadOfficer ? [`${sh.leadOfficer.name} (Lead)`] : []),
                                              ...sh.members.map((m) => m.name),
                                            ].join(', ')}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-slate-400 italic">—</div>
                                  )}
                                </td>
                              )}
                              <td className="py-2.5 px-3 align-top">
                                <div className="space-y-0.5 text-[#1E293B]">
                                  {s.restDayPersonnel.length > 0 ? (
                                    s.restDayPersonnel.map((p) => (
                                      <div key={p.id}>{p.name}</div>
                                    ))
                                  ) : (
                                    <div className="text-slate-400 italic">—</div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center shrink-0">
                <span className="text-xs text-[#757680]">
                  Total {monthActiveDays.length} operational schedule rows for {format(currentMonth, 'MMMM yyyy')}
                </span>
                <PrimaryButton
                  size="md"
                  pill
                  onClick={() => setIsPrintXLSXModalOpen(false)}
                >
                  Close Preview
                </PrimaryButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-[#1E293B] text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3"
          >
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-100">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
