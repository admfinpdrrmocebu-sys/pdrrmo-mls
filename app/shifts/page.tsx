'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  LayoutDashboard,
  UserCheck,
  UserX,
  Users,
  ShieldCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  Coffee,
  CalendarCheck,
  CalendarX,
  Edit2,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Shield,
  Layers,
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
  isSameDay,
  isToday,
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { SummaryCard } from '@/components/card';
import { Skeleton, SummaryCardSkeleton, PersonalCalendarSkeleton, PersonnelGridSkeleton, PersonalDayDetailSkeleton } from '@/components/skeleton';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';

// =============================================================================
// TYPES & ROSTER MODELS
// =============================================================================

export interface OfficerMember {
  id: string;
  name: string;
  role: string;
  userRole?: string;
  badgeNumber: string;
  avatarInitials: string;
  phone?: string;
  station: string;
  defaultShift?: string;
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

function getInitials(name: string): string {
  if (!name) return 'OP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function matchesRole(officer: OfficerMember, filter: string): boolean {
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

// Helper to determine the current active shift schedule based on current time
function getLiveShiftSchedule(schedules: ShiftScheduleItem[]): ShiftScheduleItem | null {
  if (!schedules || schedules.length === 0) return null;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const s of schedules) {
    if (!s.startTime || !s.endTime) continue;
    const startParts = s.startTime.replace(/[^0-9:]/g, '').split(':').map(Number);
    const endParts = s.endTime.replace(/[^0-9:]/g, '').split(':').map(Number);
    if (startParts.length < 2 || endParts.length < 2) continue;
    const [sh, sm] = startParts;
    const [eh, em] = endParts;
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) continue;

    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;

    if (startM <= endM) {
      if (currentMinutes >= startM && currentMinutes < endM) {
        return s;
      }
    } else {
      // Overnight shift spanning midnight
      if (currentMinutes >= startM || currentMinutes < endM) {
        return s;
      }
    }
  }

  return schedules[0];
}

// =============================================================================
// COMPONENT: SHIFT SCHEDULE OPERATIONS SCREEN (100% DYNAMIC DATABASE DATA)
// =============================================================================

export default function ShiftSchedulePage() {
  const { profile, isViewOnly } = useAuth();
  const isShiftViewOnly = isViewOnly('Shifts');

  // Top Tab Switcher: 'dashboard' (Schedule Dashboard) | 'my-schedule' (My Schedule)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'my-schedule'>('dashboard');

  // Loading & Sync States
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic Database Data
  const [profiles, setProfiles] = useState<OfficerMember[]>([]);
  const [shiftSchedules, setShiftSchedules] = useState<ShiftScheduleItem[]>([]);
  const [dbAssignments, setDbAssignments] = useState<DutyRosterAssignmentRecord[]>([]);

  // Role Filter State
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');

  // Attendance State (Tracks absent officers for the active shift)
  const [absentOfficerIds, setAbsentOfficerIds] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // "My Schedule" Calendar State
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ===========================================================================
  // DATA FETCHING (SUPABASE)
  // ===========================================================================
  const fetchShiftData = useCallback(async () => {
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
        const mappedProfiles: OfficerMember[] = profilesData
          .filter((p) => p.is_active !== false)
          .map((p) => ({
            id: p.id,
            name: p.full_name || 'Duty Officer',
            role: p.position_title || p.role || 'Duty Responder',
            userRole: p.role?.toLowerCase() || 'staff',
            badgeNumber: `OPC-${p.id.slice(0, 4).toUpperCase()}`,
            avatarInitials: getInitials(p.full_name || 'OP'),
            avatarUrl: p.avatar_url,
            station: 'DOC Command Center',
            defaultShift: p.default_shift || '',
          }));
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

      // 3. Fetch Month Duty Roster Assignments (Covering viewed calendar month + current date)
      const monthStartStr = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
      const monthEndStr = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const { data: assignData, error: assignError } = await supabase
        .from('duty_roster_assignments')
        .select('*')
        .or(`and(duty_date.gte.${monthStartStr},duty_date.lte.${monthEndStr}),duty_date.eq.${todayStr}`);

      if (assignError) {
        console.warn('Duty roster query notice:', assignError.message);
      } else if (assignData) {
        setDbAssignments(assignData as DutyRosterAssignmentRecord[]);
      } else {
        setDbAssignments([]);
      }
    } catch (err) {
      console.error('Error fetching dynamic shift operations data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [calendarMonth]);

  // Initial load and calendar month change trigger
  useEffect(() => {
    fetchShiftData();
  }, [fetchShiftData]);

  // Realtime subscription for duty_roster_assignments and shift_schedules
  useEffect(() => {
    const channel = supabase
      .channel('shift_operations_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'duty_roster_assignments' },
        () => {
          fetchShiftData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_schedules' },
        () => {
          fetchShiftData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchShiftData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchShiftData]);

  // Helper to resolve officer by profile_id
  const getOfficerById = useCallback(
    (id: string): OfficerMember => {
      const found = profiles.find((p) => p.id === id);
      if (found) return found;
      return {
        id,
        name: 'Duty Responder',
        role: 'Operations Desk',
        userRole: 'staff',
        badgeNumber: `OPC-${id.slice(0, 4).toUpperCase()}`,
        avatarInitials: 'OP',
        station: 'DOC Command Center',
        defaultShift: '',
      };
    },
    [profiles]
  );

  // Active Live Shift Schedule determined dynamically from database
  const liveShiftSchedule = useMemo(() => {
    return getLiveShiftSchedule(shiftSchedules);
  }, [shiftSchedules]);

  // Today's Date String
  const todayKey = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  // Today's dynamic database duty and rest assignments
  const todayAssignments = useMemo(() => {
    return dbAssignments.filter((a) => a.duty_date === todayKey);
  }, [dbAssignments, todayKey]);

  // Today's On-Duty assignments
  const todayDutyAssignments = useMemo(() => {
    return todayAssignments.filter((a) => a.assignment_type === 'duty');
  }, [todayAssignments]);

  // Today's Rest Day assignments
  const todayRestAssignments = useMemo(() => {
    return todayAssignments.filter((a) => a.assignment_type === 'rest');
  }, [todayAssignments]);

  // Officers assigned on Duty for the Current Live Shift
  const liveShiftOfficers = useMemo(() => {
    if (!liveShiftSchedule) {
      return todayDutyAssignments.map((a) => ({
        ...getOfficerById(a.profile_id),
        isLead: a.is_lead,
      }));
    }

    const matchedAssigns = todayDutyAssignments.filter((a) => {
      if (a.shift_schedule_id === liveShiftSchedule.id) return true;
      if (!a.shift_schedule_id) {
        const officer = getOfficerById(a.profile_id);
        return officer.defaultShift && officer.defaultShift.toLowerCase() === liveShiftSchedule.name.toLowerCase();
      }
      return false;
    });

    const finalAssigns = matchedAssigns.length > 0 ? matchedAssigns : todayDutyAssignments;

    return finalAssigns.map((a) => ({
      ...getOfficerById(a.profile_id),
      isLead: a.is_lead,
    }));
  }, [liveShiftSchedule, todayDutyAssignments, getOfficerById]);

  // Derived Present vs Absent lists for the live shift
  const presentOfficers = useMemo(() => {
    return liveShiftOfficers.filter((o) => !absentOfficerIds.includes(o.id));
  }, [liveShiftOfficers, absentOfficerIds]);

  const absentOfficers = useMemo(() => {
    return liveShiftOfficers.filter((o) => absentOfficerIds.includes(o.id));
  }, [liveShiftOfficers, absentOfficerIds]);

  // Role-filtered Present & Absent Officers
  const filteredPresentOfficers = useMemo(() => {
    return presentOfficers.filter((o) => matchesRole(o, selectedRoleFilter));
  }, [presentOfficers, selectedRoleFilter]);

  const filteredAbsentOfficers = useMemo(() => {
    return absentOfficers.filter((o) => matchesRole(o, selectedRoleFilter));
  }, [absentOfficers, selectedRoleFilter]);

  // Today's Rest Day Personnel
  const todayRestPersonnel = useMemo(() => {
    return todayRestAssignments.map((a) => getOfficerById(a.profile_id));
  }, [todayRestAssignments, getOfficerById]);

  // Toggle officer attendance
  const handleSetPresent = (officerId: string) => {
    setAbsentOfficerIds((prev) => prev.filter((id) => id !== officerId));
    showToast('Officer marked present for duty');
  };

  const handleSetAbsent = (officerId: string) => {
    setAbsentOfficerIds((prev) => (prev.includes(officerId) ? prev : [...prev, officerId]));
    showToast('Officer marked absent / on leave');
  };

  // Currently logged-in officer profile for My Schedule view
  const currentOfficer = useMemo(() => {
    if (profile?.id) {
      const found = profiles.find((p) => p.id === profile.id);
      if (found) return found;
      return {
        id: profile.id,
        name: profile.full_name || 'Duty Responder',
        role: profile.position_title || profile.role || 'Duty Officer',
        userRole: profile.role?.toLowerCase() || 'staff',
        badgeNumber: `OPC-${profile.id.slice(0, 4).toUpperCase()}`,
        avatarInitials: getInitials(profile.full_name || 'OP'),
        avatarUrl: profile.avatar_url,
        station: 'DOC Command Center',
        defaultShift: profile.default_shift || '',
      };
    }
    return profiles[0] || null;
  }, [profile, profiles]);

  // Helper to get logged-in officer's schedule for any given date from dbAssignments
  const getOfficerAssignmentForDate = useCallback(
    (officerId: string, date: Date) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const assign = dbAssignments.find(
        (a) => a.profile_id === officerId && a.duty_date === dateKey
      );

      if (!assign) {
        return { type: 'NONE' as const, shift: null, isLead: false };
      }

      if (assign.assignment_type === 'rest') {
        return { type: 'REST' as const, shift: null, isLead: false };
      }

      const matchedShift = shiftSchedules.find((s) => s.id === assign.shift_schedule_id) || null;
      return {
        type: 'DUTY' as const,
        shift: matchedShift,
        isLead: assign.is_lead,
      };
    },
    [dbAssignments, shiftSchedules]
  );

  // Generate calendar days for My Schedule
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map((date) => {
      const isCurrentMonth = isSameMonth(date, calendarMonth);
      const isSelected = isSameDay(date, selectedDate);
      const isCurrentDay = isToday(date);
      const assignment = currentOfficer
        ? getOfficerAssignmentForDate(currentOfficer.id, date)
        : { type: 'NONE' as const, shift: null, isLead: false };

      return {
        date,
        isCurrentMonth,
        isSelected,
        isCurrentDay,
        assignment,
      };
    });
  }, [calendarMonth, selectedDate, currentOfficer, getOfficerAssignmentForDate]);

  // Selected day detail in My Schedule
  const selectedDayInfo = useMemo(() => {
    const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
    const assignment = currentOfficer
      ? getOfficerAssignmentForDate(currentOfficer.id, selectedDate)
      : { type: 'NONE' as const, shift: null, isLead: false };

    // Find teammates on duty for the same shift on that day
    let teammates: OfficerMember[] = [];
    if (assignment.type === 'DUTY' && assignment.shift) {
      const shiftId = assignment.shift.id;
      teammates = dbAssignments
        .filter(
          (a) =>
            a.duty_date === selectedDateKey &&
            a.assignment_type === 'duty' &&
            a.shift_schedule_id === shiftId &&
            a.profile_id !== currentOfficer?.id
        )
        .map((a) => getOfficerById(a.profile_id));
    }

    return {
      date: selectedDate,
      dateKey: selectedDateKey,
      assignment,
      teammates,
    };
  }, [selectedDate, currentOfficer, getOfficerAssignmentForDate, dbAssignments, getOfficerById]);

  // Monthly stats for My Schedule
  const monthlyStats = useMemo(() => {
    if (!currentOfficer) {
      return { dutyDays: 0, restDays: 0, totalHours: 0 };
    }

    const daysInMonth = eachDayOfInterval({
      start: startOfMonth(calendarMonth),
      end: endOfMonth(calendarMonth),
    });

    let dutyCount = 0;
    let restCount = 0;

    daysInMonth.forEach((day) => {
      const assign = getOfficerAssignmentForDate(currentOfficer.id, day);
      if (assign.type === 'DUTY') dutyCount++;
      else if (assign.type === 'REST') restCount++;
    });

    return {
      dutyDays: dutyCount,
      restDays: restCount,
      totalHours: dutyCount * 8,
    };
  }, [calendarMonth, currentOfficer, getOfficerAssignmentForDate]);

  return (
    <AppLayoutShell
      title="Shift Schedule Operations"
      subtitle="Real-time duty attendance, active shift rotation, and personal roster calendar."
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* ========================================================================= */}
        {/* 1. TOP HEADER BANNER & SEGMENTED VIEW TOGGLE BUTTON */}
        {/* ========================================================================= */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/20 shrink-0">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-bold text-[#1E293B]">
                  PDRRMO Shift Schedule Console
                </h1>
                {isLoading && (
                  <div className="flex items-center gap-1 text-[11px] text-[#004AC6] font-semibold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Syncing...</span>
                  </div>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#505F76] mt-0.5">
                Live Disaster Operations Center attendance and personnel duty rotation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchShiftData}
              disabled={isLoading}
              className="p-2 rounded-xl border border-[#E2E8F0] text-[#505F76] hover:text-[#1E293B] hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Roster Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Segmented Tab Switcher Toggle */}
            <div className="bg-[#F1F5F9] p-1 rounded-2xl flex items-center gap-1 border border-[#E2E8F0] shrink-0 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-[#004AC6] shadow-sm'
                    : 'text-[#505F76] hover:text-[#1E293B] hover:bg-white/50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Schedule Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('my-schedule')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'my-schedule'
                    ? 'bg-[#004AC6] text-white shadow-sm'
                    : 'text-[#505F76] hover:text-[#1E293B] hover:bg-white/50'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>My Schedule</span>
              </button>
            </div>
          </div>
        </div>

        {/* View-Only Banner */}
        <ViewOnlyNotice
          screen="Shifts"
          message="Shift schedules and live personnel assignments are synchronized with database duty rosters."
        />

        {/* ========================================================================= */}
        {/* VIEW 1: SCHEDULE DASHBOARD */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Top 3 Summary Cards */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <SummaryCardSkeleton />
                <SummaryCardSkeleton />
                <SummaryCardSkeleton />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <SummaryCard
                  title="Present Right Now"
                  value={`${presentOfficers.length} Officers`}
                  subtitle={liveShiftSchedule ? `${liveShiftSchedule.name} Active` : 'No Active Shift'}
                  icon={<UserCheck className="w-5 h-5 text-emerald-600" />}
                  iconBg="bg-emerald-50 text-emerald-600"
                  change={presentOfficers.length > 0 ? "On Duty" : "None"}
                  changeType={presentOfficers.length > 0 ? "positive" : "neutral"}
                />

                <SummaryCard
                  title="Rest Day Personnel"
                  value={`${todayRestPersonnel.length} Officers`}
                  subtitle="Scheduled Off-Duty Today"
                  icon={<Coffee className="w-5 h-5 text-amber-600" />}
                  iconBg="bg-amber-50 text-amber-600"
                  change={todayRestPersonnel.length > 0 ? "Rest Day" : "None"}
                  changeType="neutral"
                />

                <SummaryCard
                  title="Total Active Roster"
                  value={`${profiles.length} Officers`}
                  subtitle={`${shiftSchedules.length} Shift Rotations Configured`}
                  icon={<Users className="w-5 h-5 text-indigo-600" />}
                  iconBg="bg-indigo-50 text-indigo-600"
                  change="Full Roster"
                  changeType="positive"
                />
              </div>
            )}

            {/* 1. Present On-Duty Personnel (Right Now) */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
                {/* Left Side: Icon + Title & Shift Name Tag below title */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 mt-0.5"
                    style={{
                      backgroundColor: liveShiftSchedule ? `${liveShiftSchedule.color || '#004AC6'}15` : '#EFF6FF',
                      borderColor: liveShiftSchedule ? `${liveShiftSchedule.color || '#004AC6'}30` : '#BFDBFE',
                      color: liveShiftSchedule?.color || '#004AC6',
                    }}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                      Present On-Duty Personnel (Right Now)
                    </h2>
                    {/* Shift Name Tag placed directly below the title */}
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {liveShiftSchedule && (
                        <span
                          style={{
                            color: liveShiftSchedule.color || '#004AC6',
                            borderColor: `${liveShiftSchedule.color || '#004AC6'}40`,
                            backgroundColor: `${liveShiftSchedule.color || '#004AC6'}10`,
                          }}
                          className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs"
                        >
                          {liveShiftSchedule.name}
                        </span>
                      )}
                      <p className="text-xs text-[#757680]">
                        {liveShiftSchedule
                          ? `${liveShiftSchedule.time} · ${liveShiftSchedule.duration}`
                          : 'No shift active at this hour'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Side Controls: Filter Role Dropdown besides/left of Edit Attendance Button */}
                <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap sm:flex-nowrap">
                  {/* Filter Role Dropdown */}
                  <div className="w-36 sm:w-44 shrink-0">
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

                  {/* Edit Attendance Button */}
                  {liveShiftOfficers.length > 0 && !isShiftViewOnly && (
                    <SecondaryButton
                      type="button"
                      size="sm"
                      pill
                      onClick={() => setIsEditModalOpen(true)}
                      leftIcon={<Edit2 className="w-3.5 h-3.5 text-[#004AC6]" />}
                    >
                      Edit Attendance
                    </SecondaryButton>
                  )}
                </div>
              </div>

              {/* Present On Duty Officers Grid */}
              {isLoading ? (
                <PersonnelGridSkeleton count={4} />
              ) : filteredPresentOfficers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredPresentOfficers.map((member) => {
                    const badge = getRoleBadge(member.userRole);
                    return (
                      <div
                        key={member.id}
                        className="p-4 rounded-2xl border border-[#E2E8F0] bg-white hover:border-[#CBD5E1] transition-all shadow-xs space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#004AC6] text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                            {member.avatarInitials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs sm:text-sm font-bold text-[#1E293B] truncate">
                                {member.name}
                              </h4>
                              {member.isLead && (
                                <span className="text-[9px] font-bold bg-blue-100 text-[#004AC6] px-1.5 py-0.2 rounded shrink-0">
                                  LEAD
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#757680] truncate font-medium">
                              {member.role}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 text-[11px] text-[#505F76] space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Role:</span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${badge.badgeClass}`}>
                              {badge.label}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Status:</span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                              Present / On-Duty
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : presentOfficers.length > 0 && selectedRoleFilter !== 'ALL' ? (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <Shield className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-[#1E293B]">
                    No {selectedRoleFilter.toUpperCase()} Personnel Present
                  </p>
                  <p className="text-xs text-[#757680]">
                    There are no officers with role &quot;{selectedRoleFilter}&quot; currently on duty for this shift.
                  </p>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-[#1E293B]">
                    No Officers Currently Scheduled On Duty
                  </p>
                  <p className="text-xs text-[#757680] max-w-md mx-auto">
                    There are no duty assignments recorded for the current shift in the database. You can configure shifts in <strong>Settings → Shift Schedule Calendar</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* 2. Absent Personnel Card */}
            {filteredAbsentOfficers.length > 0 && (
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
                      <UserX className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
                        Absent Personnel Today ({filteredAbsentOfficers.length})
                      </h3>
                      <p className="text-xs text-[#757680]">
                        Personnel assigned to duty but reported absent or on leave today
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
                    Absent / Leave
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredAbsentOfficers.map((person) => (
                    <div
                      key={person.id}
                      className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 shadow-xs space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                          {person.avatarInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-bold text-[#1E293B] truncate">
                            {person.name}
                          </h4>
                          <p className="text-[11px] text-rose-700 truncate font-medium">
                            {person.role}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-rose-200/60 text-[11px] text-[#505F76] space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Status:</span>
                          <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full text-[10px]">
                            Reported Absent
                          </span>
                        </div>
                      </div>
                      {!isShiftViewOnly && (
                        <button
                          type="button"
                          onClick={() => handleSetPresent(person.id)}
                          className="w-full py-1.5 px-3 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark as Present
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Rest Day / Off-Duty Personnel Panel */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
                      Rest Day Personnel Today ({isLoading ? '...' : todayRestPersonnel.length})
                    </h3>
                    <p className="text-xs text-[#757680]">
                      Personnel scheduled for mandatory rest day / scheduled off today
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  Off Duty
                </span>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center gap-3"
                    >
                      <Skeleton variant="circular" className="w-9 h-9 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <Skeleton variant="rounded" className="h-3.5 w-24" />
                        <Skeleton variant="rounded" className="h-2.5 w-16" />
                      </div>
                      <Skeleton variant="pill" className="h-4 w-12" />
                    </div>
                  ))}
                </div>
              ) : todayRestPersonnel.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {todayRestPersonnel.map((person) => {
                    const badge = getRoleBadge(person.userRole);
                    return (
                      <div
                        key={person.id}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {person.avatarInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#1E293B] truncate">{person.name}</p>
                          <p className="text-[11px] text-[#757680] truncate">{person.role}</p>
                        </div>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${badge.badgeClass}`}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-400 italic">
                  No personnel scheduled for rest day today.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: MY SCHEDULE (PERSONAL CALENDAR) */}
        {/* ========================================================================= */}
        {activeTab === 'my-schedule' && (
          <motion.div
            key="my-schedule-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Personal Profile Bar */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
              {isLoading ? (
                <div className="flex items-center gap-3.5">
                  <Skeleton variant="circular" className="w-12 h-12 shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton variant="rounded" className="h-5 w-40" />
                    <Skeleton variant="rounded" className="h-3 w-32" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full bg-[#004AC6] text-white flex items-center justify-center text-base font-bold shadow-sm shrink-0">
                    {currentOfficer?.avatarInitials || 'ME'}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                      {currentOfficer?.name || 'Personal Schedule'}
                    </h2>
                    <p className="text-xs text-[#757680] mt-0.5">
                      {currentOfficer?.role || 'Responder'} · {currentOfficer?.badgeNumber}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Personal KPI Summary Cards */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <SummaryCardSkeleton />
                <SummaryCardSkeleton />
                <SummaryCardSkeleton />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <SummaryCard
                  title="Assigned Duty Days"
                  value={`${monthlyStats.dutyDays} Days`}
                  subtitle={`Month of ${format(calendarMonth, 'MMMM yyyy')}`}
                  icon={<CalendarCheck className="w-5 h-5 text-[#004AC6]" />}
                  iconBg="bg-blue-50 text-[#004AC6]"
                />

                <SummaryCard
                  title="Rest Days / Off-Duty"
                  value={`${monthlyStats.restDays} Days`}
                  subtitle="Scheduled Off-Duty & Rest"
                  icon={<CalendarX className="w-5 h-5 text-amber-600" />}
                  iconBg="bg-amber-50 text-amber-600"
                />

                <SummaryCard
                  title="Total Scheduled Hours"
                  value={`${monthlyStats.totalHours} Hours`}
                  subtitle="Based on database assignments"
                  icon={<Clock className="w-5 h-5 text-emerald-600" />}
                  iconBg="bg-emerald-50 text-emerald-600"
                />
              </div>
            )}

            {/* Main Calendar Grid & Day Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Personal Monthly Calendar */}
              <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-xs space-y-4">
                {/* Calendar Month Header Controls */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#1E293B]">
                      {format(calendarMonth, 'MMMM yyyy')}
                    </h3>
                    <p className="text-xs text-[#757680]">
                      Personal Duty Calendar & Shift Assignments
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCalendarMonth(new Date());
                        setSelectedDate(new Date());
                      }}
                      className="px-3 py-1 rounded-full border border-[#CBD5E1] text-xs font-bold text-[#505F76] hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center border border-[#CBD5E1] text-[#505F76] hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center border border-[#CBD5E1] text-[#505F76] hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Legend Bar */}
                <div className="flex items-center gap-4 text-xs font-semibold text-[#505F76] pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-[#004AC6]" />
                    Duty Day
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-amber-500" />
                    Rest Day
                  </span>
                </div>

                {/* Calendar Days Header */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-[#757680] uppercase tracking-wider py-1 border-b border-slate-100">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                {/* Calendar Day Grid */}
                {isLoading ? (
                  <PersonalCalendarSkeleton daysCount={35} />
                ) : (
                  <div className="grid grid-cols-7 gap-1.5">
                    {calendarDays.map((cell, idx) => {
                    const isDuty = cell.assignment.type === 'DUTY';
                    const isRest = cell.assignment.type === 'REST';
                    const shiftColor = cell.assignment.shift?.color || '#004AC6';

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedDate(cell.date)}
                        className={`min-h-[85px] p-2 rounded-2xl text-left border flex flex-col justify-between transition-all cursor-pointer relative ${
                          !cell.isCurrentMonth
                            ? 'opacity-35 bg-slate-50/50 border-slate-100'
                            : cell.isSelected
                            ? 'border-[#004AC6] ring-2 ring-[#004AC6]/20 bg-blue-50/40 shadow-xs'
                            : cell.isCurrentDay
                            ? 'border-blue-300 bg-blue-50/20'
                            : 'border-[#E2E8F0] bg-white hover:border-blue-200 hover:bg-slate-50/50'
                        }`}
                      >
                        {/* Day Number Header */}
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-xs font-bold ${
                              cell.isCurrentDay
                                ? 'w-5 h-5 rounded-full bg-[#004AC6] text-white flex items-center justify-center text-[10px]'
                                : cell.isSelected
                                ? 'text-[#004AC6]'
                                : 'text-[#1E293B]'
                            }`}
                          >
                            {format(cell.date, 'd')}
                          </span>

                          {cell.isCurrentDay && !cell.isSelected && (
                            <span className="text-[9px] font-bold text-[#004AC6]">Today</span>
                          )}
                        </div>

                        {/* Shift Badge on Day */}
                        <div className="mt-1">
                          {isDuty ? (
                            <div
                              style={{
                                color: shiftColor,
                                backgroundColor: `${shiftColor}15`,
                                borderColor: `${shiftColor}30`,
                              }}
                              className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold border leading-tight truncate"
                            >
                              {cell.assignment.shift?.name ? cell.assignment.shift.name.split(' ')[0] : 'Duty'}
                            </div>
                          ) : isRest ? (
                            <div className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60 leading-tight truncate">
                              Rest Day
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-300 italic px-1">
                              —
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  </div>
                )}
              </div>

              {/* Right 1 Col: Selected Day Duty Inspector Card */}
              {isLoading ? (
                <PersonalDayDetailSkeleton />
              ) : (
                <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-xs space-y-5">
                  <div className="pb-3 border-b border-[#E2E8F0]">
                  <span className="text-[11px] font-bold text-[#004AC6] uppercase tracking-wider block">
                    Duty Day Inspector
                  </span>
                  <h3 className="text-base font-bold text-[#1E293B] mt-0.5">
                    {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
                  </h3>
                  {isToday(selectedDate) && (
                    <span className="inline-block mt-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Today&apos;s Date
                    </span>
                  )}
                </div>

                {selectedDayInfo.assignment.type === 'DUTY' && selectedDayInfo.assignment.shift ? (
                  <div className="space-y-4">
                    {/* Shift Banner */}
                    <div
                      style={{
                        backgroundColor: `${selectedDayInfo.assignment.shift.color || '#004AC6'}10`,
                        borderColor: `${selectedDayInfo.assignment.shift.color || '#004AC6'}30`,
                      }}
                      className="p-4 rounded-2xl border space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="text-xs font-bold"
                          style={{ color: selectedDayInfo.assignment.shift.color || '#004AC6' }}
                        >
                          {selectedDayInfo.assignment.shift.name}
                        </span>
                        <span
                          style={{ backgroundColor: selectedDayInfo.assignment.shift.color || '#004AC6' }}
                          className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full shadow-2xs"
                        >
                          {selectedDayInfo.assignment.shift.duration || '8 Hours'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#1E293B]">
                        {selectedDayInfo.assignment.shift.time}
                      </p>
                    </div>

                    {/* Fellow Shift Teammates */}
                    <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                      <span className="text-xs font-bold text-[#1E293B] block">
                        Shift Teammates On Duty With You ({selectedDayInfo.teammates.length}):
                      </span>
                      {selectedDayInfo.teammates.length > 0 ? (
                        <div className="space-y-1.5">
                          {selectedDayInfo.teammates.map((mate) => {
                            const badge = getRoleBadge(mate.userRole);
                            return (
                              <div
                                key={mate.id}
                                className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 border border-slate-100"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-[#004AC6] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {mate.avatarInitials}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-[#1E293B] truncate">{mate.name}</p>
                                    <p className="text-[10px] text-[#757680] truncate">{mate.role}</p>
                                  </div>
                                </div>
                                <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${badge.badgeClass}`}>
                                  {badge.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-2 text-center text-xs text-slate-400 italic">
                          No other teammates assigned to this shift on this date.
                        </div>
                      )}
                    </div>
                  </div>
                ) : selectedDayInfo.assignment.type === 'REST' ? (
                  <div className="p-6 rounded-2xl bg-amber-50/40 border border-amber-200/60 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                      <Coffee className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1E293B]">Rest Day / Off-Duty</h4>
                      <p className="text-xs text-[#757680] mt-1">
                        You have a scheduled rest day on this date.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1E293B]">No Scheduled Assignment</h4>
                      <p className="text-xs text-[#757680] mt-1">
                        No duty assignment is recorded for you on this date.
                      </p>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL: EDIT ATTENDANCE (PRESENT / ABSENT OPTION) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/20 shrink-0">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#1E293B]">
                      Manage Shift Attendance
                    </h3>
                    <p className="text-xs text-[#757680] mt-0.5">
                      Mark {liveShiftSchedule?.name || 'Current Shift'} assigned officers as Present or Absent
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Roster List with Present / Absent Toggles */}
              <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
                <div className="flex items-center justify-between text-xs text-[#505F76] font-semibold px-1 pb-1 border-b border-slate-100">
                  <span>Assigned Officer ({liveShiftOfficers.length})</span>
                  <span>Attendance Status</span>
                </div>

                {liveShiftOfficers.map((officer) => {
                  const isAbsent = absentOfficerIds.includes(officer.id);
                  const badge = getRoleBadge(officer.userRole);

                  return (
                    <div
                      key={officer.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isAbsent
                          ? 'border-rose-200 bg-rose-50/30'
                          : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0 ${
                            isAbsent ? 'bg-rose-600' : 'bg-[#004AC6]'
                          }`}
                        >
                          {officer.avatarInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-[#1E293B] truncate">
                              {officer.name}
                            </h4>
                            {officer.isLead && (
                              <span className="text-[9px] font-bold bg-blue-100 text-[#004AC6] px-1.5 py-0.2 rounded">
                                LEAD
                              </span>
                            )}
                            <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${badge.badgeClass}`}>
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#757680] truncate font-medium">
                            {officer.role} · {officer.station}
                          </p>
                        </div>
                      </div>

                      {/* Present / Absent Segmented Switcher */}
                      <div className="bg-[#F1F5F9] p-1 rounded-xl flex items-center gap-1 border border-[#E2E8F0] self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetPresent(officer.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            !isAbsent
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-[#505F76] hover:text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAbsent(officer.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            isAbsent
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-[#505F76] hover:text-rose-700 hover:bg-rose-50'
                          }`}
                        >
                          <X className="w-3 h-3" />
                          Absent
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center shrink-0">
                <span className="text-xs text-[#757680]">
                  {presentOfficers.length} Present · {absentOfficers.length} Absent
                </span>
                <PrimaryButton
                  type="button"
                  size="md"
                  pill
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Save & Apply Attendance
                </PrimaryButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. TOAST NOTIFICATION */}
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
