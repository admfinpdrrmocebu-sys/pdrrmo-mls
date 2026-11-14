'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { stripEmojis, type CustomDropdownOption } from '@/components/input';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { generateDailyLogsPDF, sortLogsChronologically } from '@/lib/pdf-generator';
import {
  getCachedLogsScreenData,
  patchCachedLogsScreenData,
  setCachedLogsScreenData,
  type CachedLogsScreenData,
} from '@/lib/cache/screen-data-cache';
import {
  DEFAULT_MONITORING_DETAILS,
  fallbackPersonnelList,
  fallbackSchedules,
  getInitials,
  getMilitaryTime,
  type ActiveShiftRecord,
  type ActiveShiftScheduleInfo,
  type DutyPersonnel,
  type LogEntry,
  type ScheduleEligibility,
  type ShiftScheduleItem,
  type ShiftToastState,
} from './_components/types';
import { LogsStatusCards } from './_components/logs-status-cards';
import { LogsTableSection } from './_components/logs-table-section';

export type { LogEntry, DutyPersonnel, ActiveShiftRecord, ShiftScheduleItem };

const StartShiftModal = dynamic(() => import('./_components/start-shift-modal'), {
  ssr: false,
});
const EndShiftModal = dynamic(() => import('./_components/end-shift-modal'), {
  ssr: false,
});
const AddEditLogDrawer = dynamic(() => import('./_components/add-edit-log-drawer'), {
  ssr: false,
});
const ViewLogModal = dynamic(() => import('./_components/view-log-modal'), {
  ssr: false,
});
const AddCategoryModal = dynamic(() => import('./_components/add-category-modal'), {
  ssr: false,
});

const FALLBACK_POLL_MS = 30_000;
const REALTIME_DEBOUNCE_MS = 400;
const ITEMS_PER_PAGE = 10;

const PROFILE_COLUMNS =
  'id, full_name, position_title, role, avatar_url, default_shift';
const REPORT_TYPE_COLUMNS = 'id, name, description, color, is_active, created_at';
const SCHEDULE_COLUMNS =
  'id, name, start_time, end_time, duration, color, is_active, sort_order';

interface SupabaseReportTypeRow {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  is_active?: boolean | null;
}

interface SupabaseScheduleRow {
  id: string;
  name: string;
  start_time?: string | null;
  end_time?: string | null;
  duration?: string | null;
  color?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}

interface SupabaseProfileRow {
  id: string;
  full_name?: string | null;
  position_title?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  default_shift?: string | null;
}

interface SupabaseShiftPersonnelJoinedRow {
  id: string;
  profile_id: string;
  role_in_shift?: string | null;
  is_lead?: boolean | null;
  present_at_end?: boolean | null;
  profile?: SupabaseProfileRow | SupabaseProfileRow[] | null;
}

interface SupabaseActiveShiftRow {
  id: string;
  shift_label: string;
  shift_date: string;
  start_time: string;
  end_time?: string | null;
  status: 'active' | 'completed' | 'cancelled';
  lead_officer_id: string;
  start_monitoring_details?: string | null;
  started_at: string;
  lead_officer?: SupabaseProfileRow | SupabaseProfileRow[] | null;
  shift_duty_personnel?: SupabaseShiftPersonnelJoinedRow[] | null;
}

interface SupabaseJoinedShiftSummary {
  id: string;
  shift_label?: string | null;
  shift_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: 'active' | 'completed' | 'cancelled' | null;
  lead_officer_id?: string | null;
}

interface SupabaseShiftLogRow {
  id: string;
  shift_id?: string | null;
  title: string;
  report_type_id?: string | null;
  report_type_name: string;
  log_date?: string | null;
  log_time?: string | null;
  status?: string | null;
  description?: string | null;
  operator_id?: string | null;
  operator_name?: string | null;
  created_at?: string | null;
  shift?: SupabaseJoinedShiftSummary | SupabaseJoinedShiftSummary[] | null;
}

interface ArchiveDutyPersonnelRow {
  profile_id: string;
  role_in_shift?: string | null;
  present_at_end?: boolean | null;
  profile?: {
    id?: string;
    full_name?: string | null;
    position_title?: string | null;
    default_shift?: string | null;
  } | null;
}

interface ArchiveRawLogRow {
  id: string;
  shift_id: string | null;
  log_time: string;
  log_date: string;
  created_at: string;
  status: string;
  title: string;
  report_type_name: string;
  description: string;
  operator_name: string;
  operator_id: string | null;
}

function buildLogsSignature(params: {
  logs: LogEntry[];
  activeShift: ActiveShiftRecord | null;
  availableOfficers: DutyPersonnel[];
  shiftSchedules: ShiftScheduleItem[];
  reportTypeOptionsList: CustomDropdownOption[];
}): string {
  const {
    logs,
    activeShift,
    availableOfficers,
    shiftSchedules,
    reportTypeOptionsList,
  } = params;

  const shiftKey = activeShift
    ? `${activeShift.id}:${activeShift.status}:${activeShift.shift_label}:${activeShift.lead_officer_id}:${activeShift.lead_officer_name ?? ''}:${activeShift.lead_officer_avatar ?? ''}:${activeShift.started_at}:${activeShift.personnel.map((p) => p.id).join(',')}`
    : 'none';

  const logsKey = logs
    .map(
      (l) =>
        `${l.id}|${l.title}|${l.reportType}|${l.time}|${l.date}|${l.status}|${l.shiftStatus ?? ''}|${l.description.length}`
    )
    .join(';');

  const typesKey = reportTypeOptionsList
    .map((r) => `${r.value}:${r.dotColor ?? ''}`)
    .join(',');

  const schedulesKey = shiftSchedules
    .map((s) => `${s.id}:${s.name}:${s.start_time}:${s.end_time}:${s.sort_order ?? 0}`)
    .join(',');

  const officersKey = availableOfficers
    .map((o) => `${o.id}:${o.name}:${o.defaultShift ?? ''}:${o.avatarUrl ?? ''}`)
    .join(',');

  return [shiftKey, logsKey, typesKey, schedulesKey, officersKey].join('::');
}

function computeActiveShiftScheduleInfo(
  userDefaultShift: string,
  shiftSchedules: ShiftScheduleItem[]
): ActiveShiftScheduleInfo {
  if (userDefaultShift) {
    const match = shiftSchedules.find(
      (s) => s.name.toLowerCase() === userDefaultShift.toLowerCase()
    );
    if (match) {
      return {
        name: match.name,
        time: `${match.start_time} - ${match.end_time}`,
        item: match,
      };
    }
    return { name: userDefaultShift, time: '', item: null };
  }

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  for (const sched of shiftSchedules) {
    const [sH, sM] = (sched.start_time || '06:00')
      .split(':')
      .map((v) => parseInt(v, 10) || 0);
    const [eH, eM] = (sched.end_time || '14:00')
      .split(':')
      .map((v) => parseInt(v, 10) || 0);
    const startMins = sH * 60 + sM;
    const endMins = eH * 60 + eM;

    if (startMins < endMins) {
      if (currentMins >= startMins && currentMins < endMins) {
        return {
          name: sched.name,
          time: `${sched.start_time} - ${sched.end_time}`,
          item: sched,
        };
      }
    } else if (currentMins >= startMins || currentMins < endMins) {
      return {
        name: sched.name,
        time: `${sched.start_time} - ${sched.end_time}`,
        item: sched,
      };
    }
  }

  const fallback = shiftSchedules[0] || fallbackSchedules[0];
  return {
    name: fallback.name,
    time: `${fallback.start_time} - ${fallback.end_time}`,
    item: fallback,
  };
}

export default function LogsPage() {
  const { user, profile, isAdmin, canWrite, isViewOnly } = useAuth();
  const isLogsViewOnly = isViewOnly('Logs') || !canWrite('Logs');
  const canModifyLogs = canWrite('Logs') && !isViewOnly('Logs');

  const [initialCache] = useState<CachedLogsScreenData | null>(() =>
    getCachedLogsScreenData()
  );

  // Loading & Submission States
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialCache);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data States (hydrated synchronously from SWR cache on navigation return)
  const [logs, setLogs] = useState<LogEntry[]>(() => initialCache?.logs ?? []);
  const [searchQuery, setSearchQuery] = useState<string>(
    () => initialCache?.searchQuery ?? ''
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>(
    () => initialCache?.searchQuery ?? ''
  );
  const [reportTypeFilter, setReportTypeFilter] = useState<string>(
    () => initialCache?.reportTypeFilter ?? 'ALL'
  );
  const [currentPage, setCurrentPage] = useState<number>(
    () => initialCache?.currentPage ?? 1
  );

  // Debounce search input by 300ms for fast and responsive table filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Shift States (Dynamic & Realtime from Supabase)
  const [activeShift, setActiveShift] = useState<ActiveShiftRecord | null>(
    () => initialCache?.activeShift ?? null
  );
  const [availableOfficers, setAvailableOfficers] = useState<DutyPersonnel[]>(
    () => initialCache?.availableOfficers ?? fallbackPersonnelList
  );
  const [shiftSchedules, setShiftSchedules] = useState<ShiftScheduleItem[]>(
    () => initialCache?.shiftSchedules ?? fallbackSchedules
  );

  // Modals & Drawers
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [isEndShiftModalOpen, setIsEndShiftModalOpen] = useState(false);
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>(
    () => initialCache?.activeShift?.personnel.map((p) => p.id) ?? []
  );
  const [isIncidentReportOn, setIsIncidentReportOn] = useState(false);
  const [incidentDetails, setIncidentDetails] = useState('');
  const [shiftToast, setShiftToast] = useState<ShiftToastState | null>(null);

  const [startShiftMonitoringDetails, setStartShiftMonitoringDetails] =
    useState(DEFAULT_MONITORING_DETAILS);

  // Report Type Options State
  const [reportTypeOptionsList, setReportTypeOptionsList] = useState<
    CustomDropdownOption[]
  >(() => initialCache?.reportTypeOptionsList ?? []);
  const [filterDropdownOptions, setFilterDropdownOptions] = useState<
    CustomDropdownOption[]
  >(
    () =>
      initialCache?.filterDropdownOptions ?? [
        { value: 'ALL', label: 'All Report Types' },
      ]
  );

  // Add Category Modal State
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#004AC6');

  // Active Dropdown Menu on table rows
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Drawer States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewLog, setViewLog] = useState<LogEntry | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [isAddingLog, setIsAddingLog] = useState(false);

  // Form State for Log Drawer
  const [formTitle, setFormTitle] = useState('');
  const [formReportType, setFormReportType] = useState('');
  const [formDate, setFormDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [formTime, setFormTime] = useState(() => getMilitaryTime());
  const [formDescription, setFormDescription] = useState('');

  // Concurrency, staleness, & UI state refs (updated only outside render)
  const mountedRef = useRef(true);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const signatureRef = useRef<string>(initialCache?.signature ?? '');
  const shiftModalOpenRef = useRef(false);
  const officersRef = useRef<DutyPersonnel[]>(availableOfficers);
  const shiftSchedulesRef = useRef<ShiftScheduleItem[]>(shiftSchedules);
  const reportTypeOptionsRef = useRef<CustomDropdownOption[]>(reportTypeOptionsList);
  const filterOptionsRef = useRef<CustomDropdownOption[]>(filterDropdownOptions);
  const activeShiftRef = useRef<ActiveShiftRecord | null>(activeShift);
  const logsRef = useRef<LogEntry[]>(logs);
  const searchQueryRef = useRef(searchQuery);
  const reportTypeFilterRef = useRef(reportTypeFilter);
  const currentPageRef = useRef(currentPage);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    shiftModalOpenRef.current = isStartShiftModalOpen || isEndShiftModalOpen;
  }, [isStartShiftModalOpen, isEndShiftModalOpen]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    reportTypeFilterRef.current = reportTypeFilter;
  }, [reportTypeFilter]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Derived Shift Active Status
  const isShiftActive = activeShift !== null;

  // ===========================================================================
  // 1. SHIFT SCHEDULE & HANDOVER ELIGIBILITY ENGINE
  // ===========================================================================

  const scheduleEligibility: ScheduleEligibility = useMemo(() => {
    if (isAdmin || profile?.role === 'admin') {
      return {
        isEligible: true,
        scheduleName: 'Admin / System Clearance',
        scheduleHours: '24/7 Access',
        reason: null,
      };
    }

    const userShiftName = profile?.default_shift || 'Day Shift (Alpha)';
    const matchedSchedule =
      shiftSchedules.find(
        (s) => s.name.toLowerCase() === userShiftName.toLowerCase()
      ) ||
      shiftSchedules[0] ||
      fallbackSchedules[0];

    const startTimeStr = matchedSchedule.start_time || '06:00';
    const endTimeStr = matchedSchedule.end_time || '14:00';

    const [startH, startM] = startTimeStr
      .split(':')
      .map((v) => parseInt(v, 10) || 0);
    const [endH, endM] = endTimeStr
      .split(':')
      .map((v) => parseInt(v, 10) || 0);

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    const bufferMins = 45;
    let isWithinWindow = false;

    if (startMins < endMins) {
      isWithinWindow =
        currentMins >= startMins - bufferMins &&
        currentMins <= endMins + bufferMins;
    } else {
      isWithinWindow =
        currentMins >= startMins - bufferMins ||
        currentMins <= endMins + bufferMins;
    }

    return {
      isEligible: isWithinWindow,
      scheduleName: matchedSchedule.name,
      scheduleHours: `${startTimeStr} – ${endTimeStr}`,
      reason: isWithinWindow
        ? null
        : `Your assigned shift is ${matchedSchedule.name} (${startTimeStr} – ${endTimeStr}). You can only start during your scheduled shift window.`,
    };
  }, [isAdmin, profile, shiftSchedules]);

  const canEndCurrentShift = useMemo(() => {
    if (!activeShift) return false;
    if (isAdmin || profile?.role === 'admin') return true;

    const currentUserId = profile?.id || user?.id;
    if (currentUserId && activeShift.lead_officer_id === currentUserId)
      return true;
    if (
      currentUserId &&
      activeShift.personnel.some((p) => p.id === currentUserId)
    )
      return true;

    const userShift = (profile?.default_shift || 'Day Shift (Alpha)')
      .trim()
      .toLowerCase();
    const activeShiftLabel = (activeShift.shift_label || '').trim().toLowerCase();
    return userShift === activeShiftLabel;
  }, [activeShift, isAdmin, profile, user]);

  const canAddLogs = isShiftActive && canModifyLogs && canEndCurrentShift;

  const userDefaultShift = profile?.default_shift?.trim() ?? '';

  const activeShiftScheduleInfo: ActiveShiftScheduleInfo = useMemo(
    () => computeActiveShiftScheduleInfo(userDefaultShift, shiftSchedules),
    [userDefaultShift, shiftSchedules]
  );

  const designatedOfficers = useMemo(() => {
    const shiftTarget = activeShiftScheduleInfo.name.trim().toLowerCase();
    const filtered = availableOfficers.filter((officer) => {
      const officerShift = (officer.defaultShift || 'Day Shift (Alpha)')
        .trim()
        .toLowerCase();
      return officerShift === shiftTarget;
    });

    return filtered.length > 0 ? filtered : availableOfficers;
  }, [availableOfficers, activeShiftScheduleInfo.name]);

  const shiftScheduleSequenceInfo = useMemo(() => {
    const monitoringShifts = shiftSchedules.filter(
      (s) => (s.sort_order ?? 0) >= 1
    );
    const activeList =
      monitoringShifts.length > 0 ? monitoringShifts : shiftSchedules;

    if (activeList.length === 0) {
      return {
        firstShift: fallbackSchedules[0],
        lastShift: fallbackSchedules[fallbackSchedules.length - 1],
        isLastShift: true,
      };
    }

    const sorted = [...activeList].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const activeLabel = (activeShift?.shift_label || '').trim().toLowerCase();
    const isLast = Boolean(
      last && activeLabel === last.name.trim().toLowerCase()
    );

    return {
      firstShift: first,
      lastShift: last,
      isLastShift: isLast,
    };
  }, [activeShift?.shift_label, shiftSchedules]);

  const isStartingFirstShift = useMemo(() => {
    if (!activeShiftScheduleInfo.item || !shiftScheduleSequenceInfo.firstShift)
      return true;
    const currentSort = activeShiftScheduleInfo.item.sort_order ?? 0;
    const firstSort = shiftScheduleSequenceInfo.firstShift.sort_order ?? 0;
    return (
      activeShiftScheduleInfo.item.id ===
        shiftScheduleSequenceInfo.firstShift.id || currentSort <= firstSort
    );
  }, [activeShiftScheduleInfo.item, shiftScheduleSequenceInfo.firstShift]);

  const startShiftDutyTitle = isStartingFirstShift
    ? 'Start of monitoring Duty'
    : 'Assume monitoring Duty';

  // ===========================================================================
  // 2. DATA FETCHING (CONSOLIDATED QUERIES, DEDUPLICATION, SNAPSHOT DIFFING)
  // ===========================================================================

  const persistCache = useCallback(
    (next: {
      logs: LogEntry[];
      activeShift: ActiveShiftRecord | null;
      availableOfficers: DutyPersonnel[];
      shiftSchedules: ShiftScheduleItem[];
      reportTypeOptionsList: CustomDropdownOption[];
      filterDropdownOptions: CustomDropdownOption[];
      signature: string;
    }) => {
      setCachedLogsScreenData({
        ...next,
        searchQuery: searchQueryRef.current,
        reportTypeFilter: reportTypeFilterRef.current,
        currentPage: currentPageRef.current,
        fetchedAt: Date.now(),
      });
    },
    []
  );

  const queryReportTypes = useCallback(async (): Promise<{
    modalOpts: CustomDropdownOption[];
    filterOpts: CustomDropdownOption[];
  }> => {
    try {
      const { data, error } = await supabase
        .from('report_types')
        .select(REPORT_TYPE_COLUMNS)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const rows = (data as SupabaseReportTypeRow[]).filter(
          (rt) => rt.is_active !== false
        );
        const modalOpts: CustomDropdownOption[] = rows.map((rt) => ({
          value: rt.name,
          label: rt.name,
          description: rt.description || `${rt.name} operational classification`,
          dotColor: rt.color || '#004AC6',
        }));
        const filterOpts: CustomDropdownOption[] = [
          { value: 'ALL', label: 'All Report Types' },
          ...rows.map((rt) => ({
            value: rt.name,
            label: rt.name,
            dotColor: rt.color || '#004AC6',
          })),
        ];
        return { modalOpts, filterOpts };
      }
    } catch (err) {
      console.warn('Could not load report_types from database:', err);
    }
    return {
      modalOpts: [],
      filterOpts: [{ value: 'ALL', label: 'All Report Types' }],
    };
  }, []);

  const queryShiftSchedules = useCallback(async (): Promise<
    ShiftScheduleItem[]
  > => {
    try {
      const { data, error } = await supabase
        .from('shift_schedules')
        .select(SCHEDULE_COLUMNS)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: ShiftScheduleItem[] = (data as SupabaseScheduleRow[]).map(
          (s) => ({
            id: s.id,
            name: s.name,
            start_time: s.start_time || '08:00',
            end_time: s.end_time || '16:00',
            duration: s.duration || '8 Hours',
            color: s.color || '#004AC6',
            is_active: s.is_active ?? true,
            sort_order: s.sort_order ?? 0,
          })
        );
        const monitoringShifts = mapped.filter(
          (s) => (s.sort_order ?? 0) >= 1
        );
        return monitoringShifts.length > 0 ? monitoringShifts : mapped;
      }
    } catch (err) {
      console.warn('Could not load shift_schedules, using fallbacks:', err);
    }
    return fallbackSchedules;
  }, []);

  const queryAvailableOfficers = useCallback(async (): Promise<
    DutyPersonnel[]
  > => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      if (!error && data && data.length > 0) {
        return (data as SupabaseProfileRow[]).map((p) => ({
          id: p.id,
          name: p.full_name || 'Monitoring Personnel',
          role:
            p.position_title ||
            (p.role === 'admin' ? 'System Administrator' : 'Monitoring Officer'),
          avatarInitials: getInitials(p.full_name || ''),
          badgeNumber: `OPC-${p.id.slice(0, 4).toUpperCase()}`,
          avatarUrl: p.avatar_url,
          defaultShift: p.default_shift || 'Day Shift (Alpha)',
        }));
      }
    } catch (err) {
      console.warn('Could not load profiles, using fallback duty roster:', err);
    }
    return fallbackPersonnelList;
  }, []);

  const queryActiveShift = useCallback(async (): Promise<{
    shift: ActiveShiftRecord | null;
    ok: boolean;
  }> => {
    try {
      // Single-pass active shift query with embedded lead officer and duty personnel
      const { data, error } = await supabase
        .from('shifts')
        .select(
          `
          id,
          shift_label,
          shift_date,
          start_time,
          end_time,
          status,
          lead_officer_id,
          start_monitoring_details,
          started_at,
          lead_officer:profiles!shifts_lead_officer_id_fkey(id, full_name, position_title, role, avatar_url),
          shift_duty_personnel(
            id,
            profile_id,
            role_in_shift,
            is_lead,
            profile:profiles!shift_duty_personnel_profile_id_fkey(id, full_name, position_title, avatar_url, default_shift)
          )
        `
        )
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Error querying active shift:', error.message);
        return { shift: null, ok: false };
      }

      const shiftData = data as SupabaseActiveShiftRow | null;
      if (!shiftData) {
        return { shift: null, ok: true };
      }

      const joinedPersonnel = shiftData.shift_duty_personnel || [];
      const mappedPersonnel: DutyPersonnel[] = joinedPersonnel.map((dp) => {
        const dpProfile = Array.isArray(dp.profile)
          ? dp.profile[0]
          : dp.profile;
        const pid = dpProfile?.id || dp.profile_id;
        return {
          id: pid,
          name: dpProfile?.full_name || 'Monitoring Officer',
          role:
            dp.role_in_shift ||
            dpProfile?.position_title ||
            'Monitoring Officer',
          avatarInitials: getInitials(dpProfile?.full_name || ''),
          badgeNumber: `OPC-${pid.slice(0, 4).toUpperCase()}`,
          avatarUrl: dpProfile?.avatar_url,
          defaultShift: dpProfile?.default_shift || 'Day Shift (Alpha)',
        };
      });

      const leadRaw = shiftData.lead_officer;
      const leadOfficerObj = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw;
      let leadOfficerName = leadOfficerObj?.full_name ?? undefined;
      let leadOfficerAvatar = leadOfficerObj?.avatar_url ?? null;
      let leadOfficerRole =
        leadOfficerObj?.position_title ||
        (leadOfficerObj?.role === 'admin'
          ? 'System Administrator'
          : 'Lead Officer');

      if ((!leadOfficerName || !leadOfficerAvatar) && shiftData.lead_officer_id) {
        const { data: leadProf } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, position_title, role')
          .eq('id', shiftData.lead_officer_id)
          .maybeSingle();

        const profRow = leadProf as SupabaseProfileRow | null;
        if (profRow) {
          if (profRow.full_name) leadOfficerName = profRow.full_name;
          if (profRow.avatar_url) leadOfficerAvatar = profRow.avatar_url;
          if (profRow.position_title) {
            leadOfficerRole = profRow.position_title;
          } else if (profRow.role === 'admin') {
            leadOfficerRole = 'System Administrator';
          }
        }
      }

      return {
        shift: {
          id: shiftData.id,
          shift_label: shiftData.shift_label,
          shift_date: shiftData.shift_date,
          start_time: shiftData.start_time,
          end_time: shiftData.end_time,
          status: shiftData.status,
          lead_officer_id: shiftData.lead_officer_id,
          lead_officer_name: leadOfficerName || 'Lead Officer',
          lead_officer_avatar: leadOfficerAvatar || null,
          lead_officer_role: leadOfficerRole || 'Shift Lead',
          start_monitoring_details: shiftData.start_monitoring_details,
          started_at: shiftData.started_at,
          personnel: mappedPersonnel,
        },
        ok: true,
      };
    } catch (err) {
      console.error('Error fetching active shift:', err);
      return { shift: null, ok: false };
    }
  }, []);

  const queryLogs = useCallback(
    async (
      officersSnapshot: DutyPersonnel[],
      shiftSnapshot: ActiveShiftRecord | null
    ): Promise<LogEntry[] | null> => {
      try {
        const { data, error } = await supabase
          .from('shift_logs')
          .select(
            `
            id,
            shift_id,
            title,
            report_type_id,
            report_type_name,
            log_date,
            log_time,
            status,
            description,
            operator_id,
            operator_name,
            created_at,
            shift:shifts(id, shift_label, shift_date, start_time, end_time, status, lead_officer_id)
          `
          )
          .order('created_at', { ascending: false });

        if (error || !data) {
          if (error) console.warn('Could not fetch shift_logs:', error.message);
          return null;
        }

        const officerById = new Map(officersSnapshot.map((o) => [o.id, o]));
        const fallbackToday = new Date().toISOString().split('T')[0];

        return (data as SupabaseShiftLogRow[]).map((item) => {
          const shiftObj = Array.isArray(item.shift) ? item.shift[0] : item.shift;
          const operatorObj = item.operator_id
            ? officerById.get(item.operator_id)
            : undefined;
          const matchesActive = Boolean(
            shiftSnapshot && shiftSnapshot.id === item.shift_id
          );

          return {
            id: item.id,
            shift_id: item.shift_id,
            time: item.log_time || '1200H',
            date: item.log_date || fallbackToday,
            status: (item.status as LogEntry['status']) || 'Active',
            title: item.title,
            reportType: item.report_type_name,
            reportTypeId: item.report_type_id,
            description: item.description || '',
            operator:
              item.operator_name || operatorObj?.name || 'Monitoring Officer',
            operatorId: item.operator_id,
            operatorRole: operatorObj?.role || 'Monitoring Personnel',
            operatorShift:
              operatorObj?.defaultShift ||
              shiftObj?.shift_label ||
              'Day Shift (Alpha)',
            shiftLabel:
              shiftObj?.shift_label ||
              (matchesActive && shiftSnapshot
                ? shiftSnapshot.shift_label
                : 'Operational Shift'),
            shiftDate: shiftObj?.shift_date || item.log_date,
            shiftStartTime: shiftObj?.start_time || '06:00',
            shiftEndTime: shiftObj?.end_time || '14:00',
            shiftStatus:
              shiftObj?.status || (matchesActive ? 'active' : 'completed'),
            createdAt: item.created_at ?? undefined,
          };
        });
      } catch (err) {
        console.error('Error fetching shift_logs:', err);
        return null;
      }
    },
    []
  );

  const syncLogsScreen = useCallback(
    async (options?: { isBackground?: boolean; includeMeta?: boolean }) => {
      const isBackground = options?.isBackground ?? true;
      const includeMeta = options?.includeMeta ?? false;

      if (syncInFlightRef.current) {
        return syncInFlightRef.current;
      }

      const run = async () => {
        try {
          if (!isBackground && mountedRef.current) {
            setIsLoading(true);
          }

          let nextReportTypes = reportTypeOptionsRef.current;
          let nextFilterOpts = filterOptionsRef.current;
          let nextSchedules = shiftSchedulesRef.current;
          let nextOfficers = officersRef.current;

          const metaPromise = includeMeta
            ? Promise.all([
                queryReportTypes(),
                queryShiftSchedules(),
                queryAvailableOfficers(),
              ])
            : null;

          const activeShiftPromise = queryActiveShift();

          if (metaPromise) {
            const [typesRes, schedulesRes, officersRes] = await metaPromise;
            nextReportTypes = typesRes.modalOpts;
            nextFilterOpts = typesRes.filterOpts;
            nextSchedules = schedulesRes;
            nextOfficers = officersRes;
          }

          const shiftRes = await activeShiftPromise;
          const nextShift = shiftRes.ok ? shiftRes.shift : activeShiftRef.current;

          const fetchedLogs = await queryLogs(nextOfficers, nextShift);
          const nextLogs = fetchedLogs ?? logsRef.current;

          const nextSignature = buildLogsSignature({
            logs: nextLogs,
            activeShift: nextShift,
            availableOfficers: nextOfficers,
            shiftSchedules: nextSchedules,
            reportTypeOptionsList: nextReportTypes,
          });

          if (
            nextSignature === signatureRef.current &&
            signatureRef.current !== ''
          ) {
            patchCachedLogsScreenData({ fetchedAt: Date.now() });
            return;
          }

          signatureRef.current = nextSignature;
          officersRef.current = nextOfficers;
          shiftSchedulesRef.current = nextSchedules;
          reportTypeOptionsRef.current = nextReportTypes;
          filterOptionsRef.current = nextFilterOpts;
          activeShiftRef.current = nextShift;
          logsRef.current = nextLogs;

          persistCache({
            logs: nextLogs,
            activeShift: nextShift,
            availableOfficers: nextOfficers,
            shiftSchedules: nextSchedules,
            reportTypeOptionsList: nextReportTypes,
            filterDropdownOptions: nextFilterOpts,
            signature: nextSignature,
          });

          if (!mountedRef.current) return;

          setReportTypeOptionsList(nextReportTypes);
          setFilterDropdownOptions(nextFilterOpts);
          setShiftSchedules(nextSchedules);
          setAvailableOfficers(nextOfficers);
          setActiveShift(nextShift);
          setLogs(nextLogs);

          if (nextShift && !shiftModalOpenRef.current) {
            setSelectedPersonnelIds(nextShift.personnel.map((p) => p.id));
          }
        } catch (err) {
          console.error('Error syncing logs screen:', err);
        } finally {
          syncInFlightRef.current = null;
          if (mountedRef.current) {
            setIsLoading(false);
          }
        }
      };

      const promise = run();
      syncInFlightRef.current = promise;
      return promise;
    },
    [
      persistCache,
      queryActiveShift,
      queryAvailableOfficers,
      queryLogs,
      queryReportTypes,
      queryShiftSchedules,
    ]
  );

  // Helper to broadcast changes across all active tabs in realtime
  const broadcastSync = useCallback(
    (
      event:
        | 'shift_logs_updated'
        | 'shift_state_updated'
        | 'archives_updated'
    ) => {
      try {
        void supabase.channel('pdrrmo-mls-live-logs').send({
          type: 'broadcast',
          event,
          payload: { timestamp: Date.now() },
        });
      } catch (err) {
        console.warn('Realtime broadcast notice skipped:', err);
      }
    },
    []
  );

  // Initialize Data, Debounced Realtime Subscriptions & Visibility-Gated Polling
  useEffect(() => {
    void syncLogsScreen({
      isBackground: Boolean(initialCache),
      includeMeta: true,
    });

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingMeta = false;

    const scheduleRefresh = (includeMeta = false) => {
      if (document.hidden) return;
      if (includeMeta) pendingMeta = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const shouldFetchMeta = pendingMeta;
        pendingMeta = false;
        debounceTimer = null;
        void syncLogsScreen({ isBackground: true, includeMeta: shouldFetchMeta });
      }, REALTIME_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel('pdrrmo-mls-live-logs', {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_logs' },
        () => scheduleRefresh(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => scheduleRefresh(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_duty_personnel' },
        () => scheduleRefresh(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_types' },
        () => scheduleRefresh(true)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        () => scheduleRefresh(true)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'profiles' },
        () => scheduleRefresh(true)
      )
      .on('broadcast', { event: 'shift_logs_updated' }, () =>
        scheduleRefresh(false)
      )
      .on('broadcast', { event: 'shift_state_updated' }, () =>
        scheduleRefresh(false)
      )
      .subscribe();

    const syncInterval = setInterval(() => {
      if (!document.hidden) {
        void syncLogsScreen({ isBackground: true, includeMeta: false });
      }
    }, FALLBACK_POLL_MS);

    const handleVisibilitySync = () => {
      if (!document.hidden) {
        void syncLogsScreen({ isBackground: true, includeMeta: false });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilitySync);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibilitySync);
    };
  }, [initialCache, syncLogsScreen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
    patchCachedLogsScreenData({ searchQuery: val, currentPage: 1 });
  }, []);

  const handleReportTypeFilterChange = useCallback((val: string) => {
    setReportTypeFilter(val);
    setCurrentPage(1);
    patchCachedLogsScreenData({ reportTypeFilter: val, currentPage: 1 });
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    patchCachedLogsScreenData({ currentPage: page });
  }, []);

  // Filtered Logs with Debounced Search Query & Report Type Filtering
  const filteredLogs = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesSearch =
        !q ||
        (log.title && log.title.toLowerCase().includes(q)) ||
        (log.reportType && log.reportType.toLowerCase().includes(q)) ||
        (log.time && log.time.toLowerCase().includes(q)) ||
        (log.description && log.description.toLowerCase().includes(q)) ||
        (log.operator && log.operator.toLowerCase().includes(q)) ||
        (log.id && log.id.toLowerCase().includes(q));
      const matchesReportType =
        reportTypeFilter === 'ALL' || log.reportType === reportTypeFilter;
      return matchesSearch && matchesReportType;
    });
  }, [logs, debouncedSearchQuery, reportTypeFilter]);

  const totalFilteredCount = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / ITEMS_PER_PAGE));
  const effectivePage = Math.min(currentPage, totalPages);

  const paginatedLogs = useMemo(() => {
    const start = (effectivePage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLogs, effectivePage]);

  // ===========================================================================
  // 3. LOG CRUD HANDLERS
  // ===========================================================================

  const canEditLog = useCallback(
    (log: LogEntry | null): boolean => {
      if (!log) return false;
      if (!canModifyLogs) return false;
      if (!isShiftActive || !activeShift) return false;
      if (!canEndCurrentShift) return false;
      if (log.shift_id && activeShift.id !== log.shift_id) return false;
      if (log.shiftStatus === 'completed' || log.shiftStatus === 'cancelled')
        return false;
      if (log.date && activeShift.shift_date && log.date !== activeShift.shift_date)
        return false;

      return true;
    },
    [canModifyLogs, isShiftActive, activeShift, canEndCurrentShift]
  );

  const handleOpenAddModal = useCallback(() => {
    if (!canAddLogs) return;
    setEditingLogId(null);
    setFormTitle('');
    setFormReportType(reportTypeOptionsList[0]?.value || '');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormTime(getMilitaryTime());
    setFormDescription('');
    setIsAddModalOpen(true);
    setActiveMenuId(null);
  }, [canAddLogs, reportTypeOptionsList]);

  const handleOpenEditModal = useCallback(
    (log: LogEntry) => {
      if (!canEditLog(log)) return;
      setEditingLogId(log.id);
      setFormTitle(log.title);
      setFormReportType(log.reportType);
      setFormDate(log.date);
      setFormTime(log.time);
      setFormDescription(log.description);
      setIsAddModalOpen(true);
      setActiveMenuId(null);
      setViewLog(null);
    },
    [canEditLog]
  );

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || isSubmitting || !canModifyLogs || !canEndCurrentShift)
      return;

    const isCreating = !editingLogId;
    try {
      setIsSubmitting(true);
      if (isCreating) {
        setIsAddingLog(true);
        setIsAddModalOpen(false);
      }

      const operatorName = profile?.full_name || 'Monitoring Officer';
      const operatorId = profile?.id || user?.id;
      const titleToSave = stripEmojis(formTitle.trim());
      const reportTypeToSave = stripEmojis(formReportType);
      const descToSave = stripEmojis(formDescription.trim());
      const dateToSave = formDate;
      const timeToSave = formTime.trim() || getMilitaryTime();

      if (editingLogId) {
        const { error } = await supabase
          .from('shift_logs')
          .update({
            title: titleToSave,
            report_type_name: reportTypeToSave,
            description: descToSave,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingLogId);

        if (error) throw error;

        setShiftToast({
          type: 'start',
          message: 'Incident Log Updated',
          submessage: `"${titleToSave}" was updated successfully.`,
        });
        setIsAddModalOpen(false);
        setEditingLogId(null);
      } else {
        const { error } = await supabase.from('shift_logs').insert({
          shift_id: activeShift?.id || null,
          title: titleToSave,
          report_type_name: reportTypeToSave,
          log_date: dateToSave,
          log_time: timeToSave,
          status: 'Active',
          description: descToSave,
          operator_id: operatorId,
          operator_name: operatorName,
        });

        if (error) throw error;

        setShiftToast({
          type: 'start',
          message: 'New Incident Logged',
          submessage: `"${titleToSave}" has been recorded to live telemetry.`,
        });
      }

      await syncLogsScreen({ isBackground: true, includeMeta: false });
      broadcastSync('shift_logs_updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error saving log:', err);
      alert(`Could not save log entry: ${msg}`);
    } finally {
      setIsSubmitting(false);
      setIsAddingLog(false);
      setEditingLogId(null);
      setTimeout(() => setShiftToast(null), 4000);
    }
  };

  const handleDeleteLog = useCallback(
    async (id: string) => {
      if (isSubmitting || !canModifyLogs || !canEndCurrentShift) return;
      try {
        setIsSubmitting(true);
        const { error } = await supabase.from('shift_logs').delete().eq('id', id);
        if (error) throw error;

        await syncLogsScreen({ isBackground: true, includeMeta: false });
        broadcastSync('shift_logs_updated');
        setViewLog((prev) => (prev?.id === id ? null : prev));
        setActiveMenuId(null);

        setShiftToast({
          type: 'info',
          message: 'Log Entry Deleted',
          submessage: 'The record was removed from telemetry logs.',
        });
        setTimeout(() => setShiftToast(null), 3500);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Error deleting log:', err);
        alert(`Could not delete log: ${msg}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [broadcastSync, canEndCurrentShift, canModifyLogs, isSubmitting, syncLogsScreen]
  );

  // ===========================================================================
  // 4. SHIFT LIFECYCLE (START & END SHIFT)
  // ===========================================================================

  const handleShiftButtonClick = useCallback(() => {
    if (isLoading) return;
    if (!isShiftActive) {
      if (!scheduleEligibility.isEligible) return;

      const shiftTarget = activeShiftScheduleInfo.name.trim().toLowerCase();
      const matchedOfficers = availableOfficers.filter(
        (o) =>
          (o.defaultShift || 'Day Shift (Alpha)').trim().toLowerCase() ===
          shiftTarget
      );
      const initialSelection =
        matchedOfficers.length > 0 ? matchedOfficers : availableOfficers;
      setSelectedPersonnelIds(initialSelection.map((o) => o.id));
      setIsStartShiftModalOpen(true);
    } else {
      if (!canEndCurrentShift) return;

      setIsIncidentReportOn(false);
      setIncidentDetails('');
      setIsEndShiftModalOpen(true);
    }
  }, [
    activeShiftScheduleInfo.name,
    availableOfficers,
    canEndCurrentShift,
    isLoading,
    isShiftActive,
    scheduleEligibility.isEligible,
  ]);

  const handleTogglePersonnel = useCallback((id: string) => {
    setSelectedPersonnelIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAllPersonnel = useCallback(
    (selectAll: boolean) => {
      if (selectAll) {
        setSelectedPersonnelIds(designatedOfficers.map((p) => p.id));
      } else {
        setSelectedPersonnelIds([]);
      }
    },
    [designatedOfficers]
  );

  const handleConfirmStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPersonnelIds.length === 0 || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const assignedPersonnel = availableOfficers.filter((p) =>
        selectedPersonnelIds.includes(p.id)
      );

      const leadOfficerId = profile?.id || user?.id;
      const leadOfficerName = profile?.full_name || 'Alex Thompson';
      const shiftLabel = activeShiftScheduleInfo.name;
      const now = new Date();
      const timeFormatted = getMilitaryTime(now);
      const dateFormatted = now.toISOString().split('T')[0];

      const { data: newShift, error: shiftError } = await supabase
        .from('shifts')
        .insert({
          shift_label: shiftLabel,
          shift_date: dateFormatted,
          start_time: timeFormatted,
          status: 'active',
          lead_officer_id: leadOfficerId,
          start_monitoring_details: startShiftMonitoringDetails.trim() || null,
          started_at: now.toISOString(),
        })
        .select()
        .single();

      if (shiftError || !newShift) {
        throw new Error(shiftError?.message || 'Failed to start shift');
      }

      if (assignedPersonnel.length > 0) {
        const dutyPersonnelRows = assignedPersonnel.map((p) => ({
          shift_id: newShift.id,
          profile_id: p.id,
          role_in_shift: p.role,
          is_lead: p.id === leadOfficerId,
          present_at_end: true,
        }));

        await supabase.from('shift_duty_personnel').insert(dutyPersonnelRows);
      }

      const personnelNames = assignedPersonnel
        .map((p) => `${p.name} (${p.role})`)
        .join(', ');
      const cleanBriefing = stripEmojis(startShiftMonitoringDetails.trim());
      const descriptionContent = cleanBriefing
        ? `<p><strong>Active personnel assigned on duty:</strong> ${personnelNames}</p><br /><p><strong>Monitoring Details & Briefing:</strong></p>${cleanBriefing}`
        : `<p><strong>Active personnel assigned on duty:</strong> ${personnelNames}</p>`;

      const shiftTitle = `${startShiftDutyTitle} (List of Personnel asisgned on this shift)`;

      await supabase.from('shift_logs').insert({
        shift_id: newShift.id,
        title: shiftTitle,
        report_type_name: 'Roll Call Alert',
        log_date: dateFormatted,
        log_time: timeFormatted,
        status: 'Active',
        description: descriptionContent,
        operator_id: leadOfficerId,
        operator_name: leadOfficerName,
      });

      setIsStartShiftModalOpen(false);
      await syncLogsScreen({ isBackground: true, includeMeta: false });
      broadcastSync('shift_state_updated');
      broadcastSync('shift_logs_updated');

      setShiftToast({
        message: `${startShiftDutyTitle} Logged`,
        submessage: `${assignedPersonnel.length} personnel on duty. "Add Logs" is now enabled in real-time.`,
        type: 'start',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error starting shift:', err);
      alert(`Could not start shift: ${msg}`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setShiftToast(null), 4000);
    }
  };

  const handleConfirmEndShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || !canEndCurrentShift || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const now = new Date();
      const timeFormatted = getMilitaryTime(now);
      const dateFormatted = now.toISOString().split('T')[0];

      const personnelNames =
        activeShift.personnel.length > 0
          ? activeShift.personnel.map((p) => `${p.name} (${p.role})`).join(', ')
          : availableOfficers.map((p) => `${p.name} (${p.role})`).join(', ');

      const cleanIncidentDetails = stripEmojis(incidentDetails.trim());
      const situationText =
        isIncidentReportOn && cleanIncidentDetails
          ? `Incident Report: ${cleanIncidentDetails}`
          : 'Situation Remain Normal';

      const { error: updateShiftError } = await supabase
        .from('shifts')
        .update({
          status: 'completed',
          end_time: timeFormatted,
          ended_at: now.toISOString(),
          end_shift_handover_status: situationText,
          incident_report_details:
            isIncidentReportOn && cleanIncidentDetails
              ? cleanIncidentDetails
              : null,
          updated_at: now.toISOString(),
        })
        .eq('id', activeShift.id);

      if (updateShiftError) throw updateShiftError;

      const leadOfficerId = profile?.id || user?.id;
      const leadOfficerName = profile?.full_name || 'Monitoring Officer';
      const leadOfficerRole =
        profile?.position_title || 'Lead Operations Officer';

      await supabase.from('shift_logs').insert({
        shift_id: activeShift.id,
        title: 'End of monitoringduty (List of personnel assigned on this shift)',
        report_type_name: isIncidentReportOn
          ? 'Incident Report'
          : 'Roll Call Alert',
        log_date: dateFormatted,
        log_time: timeFormatted,
        status: isIncidentReportOn ? 'Warning' : 'Info',
        description: `<p><strong>Personnel on duty:</strong> ${personnelNames}</p><p><strong>Handover Status:</strong> ${situationText}</p>`,
        operator_id: leadOfficerId,
        operator_name: leadOfficerName,
      });

      let archiveFilename: string | null = null;

      try {
        const shiftSlug = (activeShift.shift_label || 'SHIFT')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        archiveFilename = `PDRRMO-MLS-${dateFormatted.replace(/-/g, '')}-${shiftSlug}.pdf`;

        const [dutyPersonnelRes, shiftLogsRes, profilesRes] = await Promise.all([
          supabase
            .from('shift_duty_personnel')
            .select(
              `
              id,
              shift_id,
              profile_id,
              role_in_shift,
              is_lead,
              present_at_end,
              profile:profiles!shift_duty_personnel_profile_id_fkey(id, full_name, position_title, default_shift)
            `
            )
            .eq('shift_id', activeShift.id),
          supabase
            .from('shift_logs')
            .select('*')
            .eq('shift_id', activeShift.id)
            .order('created_at', { ascending: true }),
          supabase.from('profiles').select('id, full_name, position_title'),
        ]);

        const dutyPersonnel = (dutyPersonnelRes.data ||
          []) as ArchiveDutyPersonnelRow[];
        const rawShiftLogs = (shiftLogsRes.data || []) as ArchiveRawLogRow[];
        const allProfiles = (profilesRes.data || []) as Array<{
          id: string;
          full_name: string | null;
          position_title: string | null;
        }>;

        const profMap = new Map<
          string,
          { full_name?: string | null; position_title?: string | null }
        >();
        allProfiles.forEach((p) => {
          if (p.id) profMap.set(p.id.toLowerCase(), p);
          if (p.full_name) profMap.set(p.full_name.toLowerCase().trim(), p);
        });
        if (profile) {
          if (profile.id) profMap.set(profile.id.toLowerCase(), profile);
          if (profile.full_name)
            profMap.set(profile.full_name.toLowerCase().trim(), profile);
        }

        const shiftRoster = dutyPersonnel.map((dp) => ({
          name: dp.profile?.full_name || 'Officer',
          role:
            dp.role_in_shift ||
            dp.profile?.position_title ||
            'Monitoring Officer',
          badgeNumber: `OPC-${(dp.profile_id || '').slice(0, 4).toUpperCase()}`,
          presentAtEnd: dp.present_at_end !== false,
        }));

        const singleShiftItem = {
          id: activeShift.id,
          shiftLabel: activeShift.shift_label,
          startTime: activeShift.start_time || '0800H',
          endTime: activeShift.end_time || timeFormatted,
          leadOfficer: leadOfficerName,
          leadOfficerRole: leadOfficerRole,
          handoverStatus: situationText,
          incidentDetails: isIncidentReportOn ? incidentDetails.trim() : null,
          monitoringBriefing: activeShift.start_monitoring_details || null,
          roster: shiftRoster,
          logsCount: rawShiftLogs.length,
        };

        const sortedShiftLogs = sortLogsChronologically(
          rawShiftLogs,
          activeShift.start_time || '0800H'
        );

        const allShiftLogs = sortedShiftLogs.map((l) => {
          const opProf =
            (l.operator_id ? profMap.get(l.operator_id.toLowerCase()) : undefined) ||
            (l.operator_name
              ? profMap.get(l.operator_name.toLowerCase().trim())
              : undefined);
          return {
            id: l.id,
            shift_id: l.shift_id ?? undefined,
            time: l.log_time,
            date: l.log_date,
            created_at: l.created_at,
            status: l.status,
            title: l.title,
            reportType: l.report_type_name,
            description: l.description,
            operator: l.operator_name,
            operator_id: l.operator_id ?? undefined,
            operatorRole: opProf?.position_title || 'Monitoring',
            signatureUrl: null,
          };
        });

        const shiftSnapshot = {
          dailyReportDate: dateFormatted,
          isDailyCombined: false,
          shiftLabel: activeShift.shift_label,
          startTime: activeShift.start_time || '0800H',
          endTime: timeFormatted,
          leadOfficer: leadOfficerName,
          leadOfficerRole: leadOfficerRole,
          handoverStatus: situationText,
          incidentDetails: isIncidentReportOn ? incidentDetails.trim() : null,
          monitoringBriefing: activeShift.start_monitoring_details || null,
          dutyPersonnelRoster: shiftRoster,
          shifts: [singleShiftItem],
          logs: allShiftLogs,
          totalLogsArchived: allShiftLogs.length,
          finalHandoverStatus: situationText,
          finalOfficer: leadOfficerName,
          generatedAt: now.toISOString(),
        };

        const payloadString = JSON.stringify(shiftSnapshot);
        let fileHash = 'sha256-' + Math.random().toString(36).substring(2, 15);
        if (
          typeof window !== 'undefined' &&
          window.crypto &&
          window.crypto.subtle
        ) {
          try {
            const enc = new TextEncoder().encode(payloadString);
            const hashBuf = await window.crypto.subtle.digest('SHA-256', enc);
            fileHash = Array.from(new Uint8Array(hashBuf))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
          } catch (hErr) {
            console.warn('Hash generation fallback:', hErr);
          }
        }

        const { blob: pdfBlob, sizeBytes: pdfSize } = await generateDailyLogsPDF({
          filename: archiveFilename,
          dailyReportDate: dateFormatted,
          totalShiftsCount: 1,
          finalOfficer: leadOfficerName,
          finalOfficerRole: leadOfficerRole,
          finalHandoverStatus: situationText,
          signatureUrl: null,
          signaturesMap: {},
          shifts: [singleShiftItem],
          logs: allShiftLogs,
          fileHash: fileHash,
          snapshotPayload: shiftSnapshot,
        });

        let storagePath = `MLS/${archiveFilename}`;
        let fileUrl = null;
        try {
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('archive-documents')
            .upload(storagePath, pdfBlob, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (!uploadErr && uploadData) {
            storagePath = uploadData.path;
            const { data: urlData } = supabase.storage
              .from('archive-documents')
              .getPublicUrl(storagePath);
            fileUrl = urlData?.publicUrl || null;
          } else if (uploadErr) {
            console.warn('Shift log storage upload notice:', uploadErr.message);
          }
        } catch (sErr) {
          console.warn(
            'Could not upload shift log PDF to storage bucket:',
            sErr
          );
        }

        await supabase.from('archives').insert({
          filename: archiveFilename,
          category: 'log',
          shift_id: activeShift.id,
          lead_officer_id: activeShift.lead_officer_id || leadOfficerId,
          lead_officer_name: leadOfficerName,
          lead_officer_role: leadOfficerRole,
          shift_label: activeShift.shift_label,
          shift_hours: `${activeShift.start_time || '0800H'} - ${timeFormatted}`,
          item_count: allShiftLogs.length,
          file_size_bytes: pdfSize,
          storage_path: storagePath,
          file_url: fileUrl,
          file_hash: fileHash,
          summary: `Official Shift Operations Archive for ${activeShift.shift_label} (${dateFormatted}, ${activeShift.start_time || ''} - ${timeFormatted}). Total operational logs archived: ${allShiftLogs.length}. Handover status: ${situationText}.`,
          status: 'Verified',
          snapshot_data: shiftSnapshot,
          created_by: leadOfficerId,
        });

        broadcastSync('archives_updated');
      } catch (archErr) {
        console.error('Archival process notice:', archErr);
      }

      setIsEndShiftModalOpen(false);
      await syncLogsScreen({ isBackground: true, includeMeta: false });
      broadcastSync('shift_state_updated');
      broadcastSync('shift_logs_updated');

      if (archiveFilename) {
        setShiftToast({
          message: 'Shift Completed & Archive Document Created',
          submessage: `${activeShift.shift_label} concluded successfully. Certified operations PDF (${archiveFilename}) generated and saved to Archives with SHA-256 integrity hash.`,
          type: 'end',
        });
      } else {
        setShiftToast({
          message: 'Shift Concluded',
          submessage: `${activeShift.shift_label} concluded successfully.`,
          type: 'info',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error ending shift:', err);
      alert(`Could not complete shift handover: ${msg}`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setShiftToast(null), 5000);
    }
  };

  const handleOpenAddCategory = useCallback(() => {
    if (isLogsViewOnly || !canModifyLogs) return;
    setNewCategoryName('');
    setNewCategoryColor('#004AC6');
    setIsAddCategoryModalOpen(true);
  }, [canModifyLogs, isLogsViewOnly]);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogsViewOnly || !canModifyLogs) return;
    const cleanCatName = stripEmojis(newCategoryName.trim());
    if (!cleanCatName || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const trimmedName = cleanCatName;
      const code = `RPT-${trimmedName.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

      const { error } = await supabase.from('report_types').insert({
        code,
        name: trimmedName,
        description: `Custom event classification: ${trimmedName}`,
        color: newCategoryColor,
        is_active: true,
        created_by: profile?.id || user?.id,
      });

      if (error) throw error;

      await syncLogsScreen({ isBackground: true, includeMeta: true });
      broadcastSync('shift_logs_updated');
      setFormReportType(trimmedName);
      setIsAddCategoryModalOpen(false);

      setShiftToast({
        type: 'start',
        message: 'New Report Type Added',
        submessage: `"${trimmedName}" is now available in telemetry classifications.`,
      });
      setTimeout(() => setShiftToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error saving report type:', err);
      alert(`Could not add report type: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayoutShell
      title="Log Monitoring"
      subtitle="Track, audit, and log real-time telemetry events and shift handovers."
    >
      <div className="space-y-8">
        {/* Top Header Title & Subtitle */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
            Operational Log Records
          </h1>
          <p className="text-sm sm:text-base text-[#505F76] mt-1 font-medium max-w-2xl">
            Chronological real-time log stream of disaster events, weather disturbance warnings, and operational shift duties.
          </p>
        </div>

        {/* 1. Top Status & Summary Cards */}
        <LogsStatusCards
          isLoading={isLoading}
          isShiftActive={isShiftActive}
          activeShift={activeShift}
          totalLogsCount={logs.length}
        />

        {/* View-Only Banner */}
        <ViewOnlyNotice
          screen="Logs"
          message="Shift duty start/end operations and new incident logging are disabled under View-Only clearance."
        />

        {/* 2. Search Toolbar, Shift Action Button, Data Table & Pagination */}
        <LogsTableSection
          isLoading={isLoading}
          isAddingLog={isAddingLog}
          searchQuery={searchQuery}
          debouncedSearchQuery={debouncedSearchQuery}
          onSearchChange={handleSearchChange}
          filterDropdownOptions={filterDropdownOptions}
          reportTypeFilter={reportTypeFilter}
          onReportTypeFilterChange={handleReportTypeFilterChange}
          reportTypeOptionsList={reportTypeOptionsList}
          canModifyLogs={canModifyLogs}
          isShiftActive={isShiftActive}
          activeShift={activeShift}
          canEndCurrentShift={canEndCurrentShift}
          canAddLogs={canAddLogs}
          scheduleEligibility={scheduleEligibility}
          onShiftButtonClick={handleShiftButtonClick}
          onOpenAddModal={handleOpenAddModal}
          paginatedLogs={paginatedLogs}
          filteredLogsCount={totalFilteredCount}
          currentPage={effectivePage}
          totalPages={totalPages}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={handlePageChange}
          activeMenuId={activeMenuId}
          onToggleMenu={setActiveMenuId}
          onSelectLog={setViewLog}
          onEditLog={handleOpenEditModal}
          onDeleteLog={handleDeleteLog}
          canEditLog={canEditLog}
        />
      </div>

      {/* 3. Lazy-loaded Modals & Drawers */}
      <AnimatePresence>
        {isStartShiftModalOpen && (
          <StartShiftModal
            isSubmitting={isSubmitting}
            startShiftDutyTitle={startShiftDutyTitle}
            isStartingFirstShift={isStartingFirstShift}
            activeShiftScheduleInfo={activeShiftScheduleInfo}
            designatedOfficers={designatedOfficers}
            selectedPersonnelIds={selectedPersonnelIds}
            startShiftMonitoringDetails={startShiftMonitoringDetails}
            onClose={() => setIsStartShiftModalOpen(false)}
            onSelectAll={handleSelectAllPersonnel}
            onTogglePersonnel={handleTogglePersonnel}
            onMonitoringDetailsChange={setStartShiftMonitoringDetails}
            onSubmit={handleConfirmStartShift}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEndShiftModalOpen && (
          <EndShiftModal
            isSubmitting={isSubmitting}
            activeShift={activeShift}
            availableOfficers={availableOfficers}
            selectedPersonnelIds={selectedPersonnelIds}
            isIncidentReportOn={isIncidentReportOn}
            incidentDetails={incidentDetails}
            onClose={() => setIsEndShiftModalOpen(false)}
            onToggleIncidentReport={setIsIncidentReportOn}
            onIncidentDetailsChange={setIncidentDetails}
            onSubmit={handleConfirmEndShift}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddModalOpen && (
          <AddEditLogDrawer
            isSubmitting={isSubmitting}
            editingLogId={editingLogId}
            formTitle={formTitle}
            formReportType={formReportType}
            formDate={formDate}
            formTime={formTime}
            formDescription={formDescription}
            reportTypeOptionsList={reportTypeOptionsList}
            onClose={() => setIsAddModalOpen(false)}
            onTitleChange={setFormTitle}
            onReportTypeChange={setFormReportType}
            onDescriptionChange={setFormDescription}
            onOpenAddCategory={handleOpenAddCategory}
            onSubmit={handleSaveLog}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewLog && (
          <ViewLogModal
            log={viewLog}
            isShiftActive={isShiftActive}
            activeShift={activeShift}
            isSubmitting={isSubmitting}
            canEdit={canEditLog(viewLog)}
            onClose={() => setViewLog(null)}
            onEdit={handleOpenEditModal}
            onDelete={handleDeleteLog}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddCategoryModalOpen && (
          <AddCategoryModal
            isSubmitting={isSubmitting}
            newCategoryName={newCategoryName}
            newCategoryColor={newCategoryColor}
            onClose={() => setIsAddCategoryModalOpen(false)}
            onNameChange={setNewCategoryName}
            onColorChange={setNewCategoryColor}
            onSubmit={handleSaveCategory}
          />
        )}
      </AnimatePresence>

      {/* 7. Toast Notification */}
      <AnimatePresence>
        {shiftToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-[#1E293B] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                shiftToast.type === 'start'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : shiftToast.type === 'end'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {shiftToast.type === 'start' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : shiftToast.type === 'end' ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold">{shiftToast.message}</p>
              {shiftToast.submessage && (
                <p className="text-xs text-slate-300">{shiftToast.submessage}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
