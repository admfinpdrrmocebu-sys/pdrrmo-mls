'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Users,
  UserCheck,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  CheckCircle2,
  CalendarDays,
  Loader2,
  RefreshCw,
  Shield,
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
import { AppLayoutShell } from '@/components/nav-route';
import { SummaryCard } from '@/components/card';
import { SummaryCardSkeleton, CalendarSkeleton } from '@/components/skeleton';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { LocationAccessModal } from '@/components/location-access-modal';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import {
  getCachedShiftSettingsScreenData,
  setCachedShiftSettingsScreenData,
  patchCachedShiftSettingsScreenData,
} from '@/lib/cache/screen-data-cache';
import CalendarDayCell from './_components/calendar-day-cell';
import {
  getInitials,
  roleFilterDropdownOptions,
  computeProfilesSignature,
  computeShiftSchedulesSignature,
  computeAssignmentsSignature,
  type OfficerAssignment,
  type ShiftScheduleItem,
  type DutyRosterAssignmentRecord,
  type AssignedShiftGroup,
  type DayDutySchedule,
  type EditDayAssignment,
  type CalendarCellItem,
} from './_components/types';

export type {
  OfficerAssignment,
  ShiftScheduleItem,
  DutyRosterAssignmentRecord,
  AssignedShiftGroup,
  DayDutySchedule,
  EditDayAssignment,
} from './_components/types';

const DayDetailsModal = dynamic(() => import('./_components/day-details-modal'), {
  ssr: false,
});
const EditDayRosterModal = dynamic(
  () => import('./_components/edit-day-roster-modal'),
  { ssr: false }
);
const AddShiftScheduleModal = dynamic(
  () => import('./_components/add-shift-schedule-modal'),
  { ssr: false }
);
const PrintExportModal = dynamic(
  () => import('./_components/print-export-modal'),
  { ssr: false }
);

const _dayScheduleMemoCache = new Map<
  string,
  { signature: string; schedule: DayDutySchedule }
>();

function parseMonthIso(iso?: string): Date {
  if (!iso) return new Date();
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return new Date();
  return new Date(y, m - 1, 1);
}

export default function ShiftScheduleCalendarPage() {
  const { user, isViewOnly, canWrite } = useAuth();
  const isSettingsViewOnly = isViewOnly('Settings') || !canWrite('Settings');

  const [initialCache] = useState(() => getCachedShiftSettingsScreenData());
  const [initialMonth] = useState(() =>
    parseMonthIso(initialCache?.currentMonthIso)
  );
  const initialMonthKey = format(initialMonth, 'yyyy-MM');

  // Loading & Sync States
  const [isInitialLoading, setIsInitialLoading] = useState(() => !initialCache);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // SWR Hydrated Database Data
  const [profiles, setProfiles] = useState<OfficerAssignment[]>(
    () => initialCache?.profiles ?? []
  );
  const [shiftSchedules, setShiftSchedules] = useState<ShiftScheduleItem[]>(
    () => initialCache?.shiftSchedules ?? []
  );
  const [dbAssignments, setDbAssignments] = useState<DutyRosterAssignmentRecord[]>(
    () => initialCache?.assignmentsByMonth[initialMonthKey] ?? []
  );

  // Current viewed month & filters (restored from SWR cache)
  const [currentMonth, setCurrentMonth] = useState<Date>(() => initialMonth);
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>(
    () => initialCache?.selectedShiftFilter ?? 'ALL'
  );
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>(
    () => initialCache?.selectedRoleFilter ?? 'ALL'
  );

  // Modal Triggers & Lightweight Target Payloads
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [editingDayTarget, setEditingDayTarget] = useState<{
    date: Date;
    initialAssignments: EditDayAssignment[];
  } | null>(null);
  const [addModalConfig, setAddModalConfig] = useState<{
    initialMonth: Date;
    initialDutyDateKey?: string | null;
  } | null>(null);
  const [isPrintXLSXModalOpen, setIsPrintXLSXModalOpen] = useState(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable Cache & Signature Refs (survives re-renders without extra churn)
  const hasLoadedOnceRef = useRef<boolean>(Boolean(initialCache));
  const currentMonthRef = useRef<Date>(initialMonth);
  const profilesRef = useRef<OfficerAssignment[]>(profiles);
  const shiftSchedulesRef = useRef<ShiftScheduleItem[]>(shiftSchedules);
  const assignmentsByMonthRef = useRef<Record<string, DutyRosterAssignmentRecord[]>>(
    initialCache?.assignmentsByMonth ? { ...initialCache.assignmentsByMonth } : {}
  );
  const profilesSigRef = useRef<string>(initialCache?.profilesSignature ?? '');
  const schedulesSigRef = useRef<string>(initialCache?.schedulesSignature ?? '');
  const monthSigMapRef = useRef<Record<string, string>>(
    initialCache?.monthSignatures ? { ...initialCache.monthSignatures } : {}
  );
  const selectedShiftFilterRef = useRef<string>(selectedShiftFilter);
  const selectedRoleFilterRef = useRef<string>(selectedRoleFilter);

  useEffect(() => {
    currentMonthRef.current = currentMonth;
  }, [currentMonth]);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    shiftSchedulesRef.current = shiftSchedules;
  }, [shiftSchedules]);

  useEffect(() => {
    selectedShiftFilterRef.current = selectedShiftFilter;
  }, [selectedShiftFilter]);

  useEffect(() => {
    selectedRoleFilterRef.current = selectedRoleFilter;
  }, [selectedRoleFilter]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const syncCacheSnapshot = useCallback(() => {
    const payload = {
      profiles: profilesRef.current,
      shiftSchedules: shiftSchedulesRef.current,
      assignmentsByMonth: { ...assignmentsByMonthRef.current },
      currentMonthIso: format(currentMonthRef.current, 'yyyy-MM'),
      selectedShiftFilter: selectedShiftFilterRef.current,
      selectedRoleFilter: selectedRoleFilterRef.current,
      profilesSignature: profilesSigRef.current,
      schedulesSignature: schedulesSigRef.current,
      monthSignatures: { ...monthSigMapRef.current },
      fetchedAt: Date.now(),
    };
    setCachedShiftSettingsScreenData(payload);
  }, []);

  // ===========================================================================
  // DATA FETCHING (STATIC METADATA + TARGETED MONTH ASSIGNMENTS + SIGNATURES)
  // ===========================================================================
  const fetchStaticMetadata = useCallback(async () => {
    const [profilesResult, schedResult] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, full_name, email, position_title, role, default_shift, avatar_url, is_active'
        )
        .order('full_name', { ascending: true }),
      supabase
        .from('shift_schedules')
        .select('*')
        .order('sort_order', { ascending: true }),
    ]);

    if (profilesResult.error) {
      console.warn('Profiles query notice:', profilesResult.error.message);
    }

    if (profilesResult.data && profilesResult.data.length > 0) {
      let deactList: string[] = [];
      let delList: string[] = [];
      try {
        deactList = JSON.parse(
          localStorage.getItem('pdrrmo_deactivated_users') || '[]'
        );
        delList = JSON.parse(
          localStorage.getItem('pdrrmo_deleted_users') || '[]'
        );
      } catch {
        // Ignore storage read issues
      }

      const mappedProfiles: OfficerAssignment[] = profilesResult.data
        .filter((p) => {
          const isDel =
            delList.includes(p.id) || (p.email && delList.includes(p.email));
          const isDeact =
            deactList.includes(p.id) || (p.email && deactList.includes(p.email));
          return !isDel && !isDeact && p.is_active !== false;
        })
        .map((p) => {
          const finalName = p.full_name || 'Monitoring Responder';
          const finalRole = p.position_title || p.role || 'Duty Responder';
          const finalUserRole = (p.role || 'staff').toLowerCase();
          const finalShift = p.default_shift || '';

          return {
            id: p.id,
            name: finalName,
            role: finalRole,
            userRole: finalUserRole,
            badgeNumber: `OPC-${p.id.slice(0, 4).toUpperCase()}`,
            avatarInitials: getInitials(finalName || 'OP'),
            defaultShift: finalShift,
            avatarUrl: p.avatar_url,
          };
        });

      const nextProfilesSig = computeProfilesSignature(mappedProfiles);
      if (nextProfilesSig !== profilesSigRef.current) {
        profilesSigRef.current = nextProfilesSig;
        profilesRef.current = mappedProfiles;
        setProfiles(mappedProfiles);
      }
    } else if (!profilesResult.error) {
      if (profilesSigRef.current !== '') {
        profilesSigRef.current = '';
        profilesRef.current = [];
        setProfiles([]);
      }
    }

    if (schedResult.error) {
      console.warn('Shift schedules query notice:', schedResult.error.message);
    }

    if (schedResult.data && schedResult.data.length > 0) {
      const mappedSchedules: ShiftScheduleItem[] = schedResult.data.map((s) => ({
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
      const nextSchedSig = computeShiftSchedulesSignature(mappedSchedules);
      if (nextSchedSig !== schedulesSigRef.current) {
        schedulesSigRef.current = nextSchedSig;
        shiftSchedulesRef.current = mappedSchedules;
        setShiftSchedules(mappedSchedules);
      }
    } else if (!schedResult.error) {
      if (schedulesSigRef.current !== '') {
        schedulesSigRef.current = '';
        shiftSchedulesRef.current = [];
        setShiftSchedules([]);
      }
    }
  }, []);

  const fetchMonthAssignments = useCallback(
    async (targetMonth: Date = currentMonthRef.current) => {
      const monthKey = format(targetMonth, 'yyyy-MM');
      const monthStart = startOfMonth(targetMonth);
      const monthEnd = endOfMonth(monthStart);
      const gridStartStr = format(
        startOfWeek(monthStart, { weekStartsOn: 0 }),
        'yyyy-MM-dd'
      );
      const gridEndStr = format(
        endOfWeek(monthEnd, { weekStartsOn: 0 }),
        'yyyy-MM-dd'
      );
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const { data: assignData, error: assignError } = await supabase
        .from('duty_roster_assignments')
        .select('*')
        .or(
          `and(duty_date.gte.${gridStartStr},duty_date.lte.${gridEndStr}),duty_date.eq.${todayStr}`
        );

      if (assignError) {
        console.warn('Duty roster assignments notice:', assignError.message);
        return;
      }

      if (assignData) {
        const records = assignData as DutyRosterAssignmentRecord[];
        const nextSig = computeAssignmentsSignature(records);
        const prevSig = monthSigMapRef.current[monthKey];

        assignmentsByMonthRef.current[monthKey] = records;
        monthSigMapRef.current[monthKey] = nextSig;

        // Only update rendered state if viewing this month AND signature changed (or uncached)
        if (
          format(currentMonthRef.current, 'yyyy-MM') === monthKey &&
          nextSig !== prevSig
        ) {
          setDbAssignments(records);
        }
      }
    },
    []
  );

  const fetchRosterData = useCallback(
    async (options?: {
      assignmentsOnly?: boolean;
      targetMonth?: Date;
      showRefreshIndicator?: boolean;
    }) => {
      const month = options?.targetMonth ?? currentMonthRef.current;
      try {
        if (!hasLoadedOnceRef.current) {
          setIsInitialLoading(true);
        } else if (options?.showRefreshIndicator) {
          setIsRefreshing(true);
        }

        if (options?.assignmentsOnly && hasLoadedOnceRef.current) {
          await fetchMonthAssignments(month);
        } else {
          await Promise.all([
            fetchStaticMetadata(),
            fetchMonthAssignments(month),
          ]);
        }

        hasLoadedOnceRef.current = true;
        syncCacheSnapshot();
      } catch (err) {
        console.error('Error fetching shift roster data:', err);
      } finally {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [fetchStaticMetadata, fetchMonthAssignments, syncCacheSnapshot]
  );

  // Initial mount fetch + stable Realtime/Storage/Broadcast/Visibility sync
  useEffect(() => {
    let cancelled = false;
    let assignDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let metaDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    Promise.resolve().then(() => {
      if (!cancelled) void fetchRosterData();
    });

    const scheduleSilentSync = () => {
      if (assignDebounceTimer) clearTimeout(assignDebounceTimer);
      assignDebounceTimer = setTimeout(() => {
        if (!cancelled) {
          void fetchMonthAssignments(currentMonthRef.current).then(() => {
            syncCacheSnapshot();
          });
        }
      }, 300);
    };

    const scheduleMetadataSync = () => {
      if (metaDebounceTimer) clearTimeout(metaDebounceTimer);
      metaDebounceTimer = setTimeout(() => {
        if (!cancelled) {
          void fetchStaticMetadata().then(() => {
            syncCacheSnapshot();
          });
        }
      }, 300);
    };

    const channel = supabase
      .channel('duty_roster_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'duty_roster_assignments' },
        (payload) => {
          const viewedKey = format(currentMonthRef.current, 'yyyy-MM');
          if (
            payload.eventType === 'INSERT' ||
            payload.eventType === 'UPDATE'
          ) {
            const newRow = payload.new as DutyRosterAssignmentRecord;
            if (newRow && newRow.profile_id && newRow.duty_date) {
              setDbAssignments((prev) => {
                const key = `${newRow.profile_id}_${newRow.duty_date}`;
                let matched = false;
                const next = prev.map((item) => {
                  if (
                    `${item.profile_id}_${item.duty_date}` === key ||
                    (newRow.id && item.id === newRow.id)
                  ) {
                    matched = true;
                    return newRow;
                  }
                  return item;
                });
                const result = matched ? next : [...prev, newRow];
                assignmentsByMonthRef.current[viewedKey] = result;
                monthSigMapRef.current[viewedKey] =
                  computeAssignmentsSignature(result);
                syncCacheSnapshot();
                return result;
              });
              return;
            }
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<DutyRosterAssignmentRecord>;
            if (oldRow?.id) {
              setDbAssignments((prev) => {
                const result = prev.filter((item) => item.id !== oldRow.id);
                assignmentsByMonthRef.current[viewedKey] = result;
                monthSigMapRef.current[viewedKey] =
                  computeAssignmentsSignature(result);
                syncCacheSnapshot();
                return result;
              });
              return;
            }
          }
          scheduleSilentSync();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_schedules' },
        scheduleMetadataSync
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        scheduleMetadataSync
      )
      .subscribe();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pdrrmo_shift_sync') {
        scheduleSilentSync();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('pdrrmo_shift_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'shift_state_updated') {
          scheduleSilentSync();
        }
      };
    } catch {
      // BroadcastChannel unavailable
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        void fetchRosterData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (assignDebounceTimer) clearTimeout(assignDebounceTimer);
      if (metaDebounceTimer) clearTimeout(metaDebounceTimer);
      supabase.removeChannel(channel);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (bc) bc.close();
    };
  }, [
    fetchRosterData,
    fetchMonthAssignments,
    fetchStaticMetadata,
    syncCacheSnapshot,
  ]);

  // ===========================================================================
  // O(1) INDEXED LOOKUP MAPS & REFERENCE-STABLE DAY SCHEDULE CACHE
  // ===========================================================================
  const profilesById = useMemo(() => {
    const map = new Map<string, OfficerAssignment>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const schedulesById = useMemo(() => {
    const map = new Map<string, ShiftScheduleItem>();
    shiftSchedules.forEach((s) => map.set(s.id, s));
    return map;
  }, [shiftSchedules]);

  const schedulesByNameLower = useMemo(() => {
    const map = new Map<string, ShiftScheduleItem>();
    shiftSchedules.forEach((s) => map.set(s.name.toLowerCase(), s));
    return map;
  }, [shiftSchedules]);

  const shiftFilterDropdownOptions: CustomDropdownOption[] = useMemo(() => {
    const base: CustomDropdownOption[] = [
      {
        value: 'ALL',
        label: 'All Shifts',
        badge: 'All',
        badgeColor: 'bg-slate-100 text-slate-700',
      },
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

  const effectiveShiftSchedules: ShiftScheduleItem[] = useMemo(() => {
    if (shiftSchedules.length > 0) {
      return [...shiftSchedules].sort((a, b) => {
        const aIsDefault =
          a.name.toLowerCase().includes('default') || a.sortOrder === 0;
        const bIsDefault =
          b.name.toLowerCase().includes('default') || b.sortOrder === 0;
        if (aIsDefault && !bIsDefault) return -1;
        if (!aIsDefault && bIsDefault) return 1;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      });
    }
    return [
      {
        id: 'default-schedule',
        name: 'Default Schedule',
        time: '08:00 – 16:00',
        duration: '8 Hours',
        color: '#004AC6',
        startTime: '08:00',
        endTime: '16:00',
        sortOrder: 0,
      },
    ];
  }, [shiftSchedules]);

  const shiftRotationDropdownOptions: CustomDropdownOption[] = useMemo(() => {
    const list: CustomDropdownOption[] = effectiveShiftSchedules.map(
      (sched) => ({
        value: sched.id,
        label: sched.name,
        badge:
          sched.time ||
          `${sched.startTime || '08:00'} – ${sched.endTime || '16:00'}`,
        badgeColor: 'bg-blue-50 text-[#004AC6]',
        dotColor: sched.color || '#004AC6',
      })
    );
    list.push({
      value: 'ALL',
      label: 'All Rotations',
      badge: 'All',
      badgeColor: 'bg-slate-100 text-slate-700',
      dotColor: '#505F76',
    });
    return list;
  }, [effectiveShiftSchedules]);

  const assignmentsByDateMap = useMemo(() => {
    const map = new Map<string, DutyRosterAssignmentRecord[]>();
    dbAssignments.forEach((a) => {
      const list = map.get(a.duty_date);
      if (list) {
        list.push(a);
      } else {
        map.set(a.duty_date, [a]);
      }
    });
    return map;
  }, [dbAssignments]);

  const getOfficerById = useCallback(
    (id: string): OfficerAssignment => {
      const found = profilesById.get(id);
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
    [profilesById]
  );

  const metadataSignature = useMemo(
    () =>
      `${computeProfilesSignature(profiles)}##${computeShiftSchedulesSignature(
        shiftSchedules
      )}`,
    [profiles, shiftSchedules]
  );

  const getScheduleForDate = useCallback(
    (date: Date): DayDutySchedule => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const dayAssignments = assignmentsByDateMap.get(dateKey) || [];

      const assignSig =
        dayAssignments.length === 0
          ? 'EMPTY'
          : dayAssignments
              .map(
                (a) =>
                  `${a.profile_id}:${a.shift_schedule_id || ''}:${
                    a.assignment_type
                  }:${a.is_lead ? 1 : 0}:${a.notes || ''}`
              )
              .sort()
              .join('|');
      const signature = `${metadataSignature}::${assignSig}`;

      const cached = _dayScheduleMemoCache.get(dateKey);
      if (cached && cached.signature === signature) {
        return cached.schedule;
      }

      if (_dayScheduleMemoCache.size > 500) {
        _dayScheduleMemoCache.clear();
      }

      if (dayAssignments.length === 0) {
        const emptySchedule: DayDutySchedule = {
          date,
          dateKey,
          shifts: [],
          restDayPersonnel: [],
          travelOrderPersonnel: [],
        };
        _dayScheduleMemoCache.set(dateKey, {
          signature,
          schedule: emptySchedule,
        });
        return emptySchedule;
      }

      const dutyAssigns = dayAssignments.filter(
        (a) => a.assignment_type === 'duty'
      );
      const restAssigns = dayAssignments.filter(
        (a) => a.assignment_type === 'rest'
      );
      const travelAssigns = dayAssignments.filter(
        (a) => a.assignment_type === 'travel'
      );
      const restDayPersonnel = restAssigns.map((a) =>
        getOfficerById(a.profile_id)
      );
      const travelOrderPersonnel = travelAssigns.map((a) =>
        getOfficerById(a.profile_id)
      );

      const groupMap = new Map<
        string,
        {
          sched: ShiftScheduleItem | null;
          assignments: DutyRosterAssignmentRecord[];
        }
      >();

      dutyAssigns.forEach((assign) => {
        let key = assign.shift_schedule_id || 'unassigned';
        let matchedSched = assign.shift_schedule_id
          ? schedulesById.get(assign.shift_schedule_id)
          : undefined;

        if (!matchedSched && !assign.shift_schedule_id) {
          const officer = getOfficerById(assign.profile_id);
          if (officer.defaultShift) {
            matchedSched = schedulesByNameLower.get(
              officer.defaultShift.toLowerCase()
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
      const fallbackColors = [
        '#004AC6',
        '#D97706',
        '#7C3AED',
        '#0284C7',
        '#059669',
        '#DC2626',
        '#E11D48',
      ];

      groupMap.forEach((group, key) => {
        const sched = group.sched;
        const officers = group.assignments.map((a) => ({
          ...getOfficerById(a.profile_id),
          isLead: a.is_lead,
        }));

        const leadOfficer =
          officers.find((o) => o.isLead) ||
          (officers.length > 0 ? officers[0] : null);
        const members = leadOfficer
          ? officers.filter((o) => o.id !== leadOfficer.id)
          : officers;

        const shiftColor =
          sched?.color || fallbackColors[fallbackIndex % fallbackColors.length];
        fallbackIndex++;

        shifts.push({
          scheduleId: sched?.id || key,
          scheduleName: sched?.name || 'Operational Shift',
          startTime: sched?.startTime || '08:00',
          endTime: sched?.endTime || '16:00',
          timeLabel:
            sched?.time ||
            `${sched?.startTime || '08:00'} – ${sched?.endTime || '16:00'}`,
          duration: sched?.duration || '8 Hours',
          color: shiftColor,
          targetRole: sched?.targetRole,
          sortOrder: sched?.sortOrder ?? fallbackIndex,
          leadOfficer: leadOfficer ? { ...leadOfficer, isLead: true } : null,
          members,
          station: 'PDRRMO Emergency Operations Center',
        });
      });

      shifts.sort((a, b) => a.sortOrder - b.sortOrder);

      const computedSchedule: DayDutySchedule = {
        date,
        dateKey,
        shifts,
        restDayPersonnel,
        travelOrderPersonnel,
      };
      _dayScheduleMemoCache.set(dateKey, {
        signature,
        schedule: computedSchedule,
      });
      return computedSchedule;
    },
    [
      assignmentsByDateMap,
      schedulesById,
      schedulesByNameLower,
      getOfficerById,
      metadataSignature,
    ]
  );

  // Derived selected day schedule for Inspector modal
  const selectedDaySchedule = useMemo(() => {
    if (!selectedDateKey) return null;
    const [year, month, day] = selectedDateKey.split('-').map(Number);
    if (!year || !month || !day) return null;
    return getScheduleForDate(new Date(year, month - 1, day));
  }, [selectedDateKey, getScheduleForDate]);

  // Calendar Grid Days Calculation
  const calendarDays: CalendarCellItem[] = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    return days.map((d) => ({
      date: d,
      isCurrentMonth: isSameMonth(d, currentMonth),
      isCurrentDay: isToday(d),
      schedule: getScheduleForDate(d),
    }));
  }, [currentMonth, getScheduleForDate]);

  const monthActiveDays = useMemo(
    () => calendarDays.filter((d) => d.isCurrentMonth),
    [calendarDays]
  );

  // Dynamic KPI Metrics
  const kpiMetrics = useMemo(() => {
    const todaySchedule = getScheduleForDate(new Date());
    let totalDutyToday = 0;
    todaySchedule.shifts.forEach((s) => {
      totalDutyToday += (s.leadOfficer ? 1 : 0) + s.members.length;
    });
    return {
      dutyPersonnelCount: totalDutyToday,
      restPersonnelCount: todaySchedule.restDayPersonnel.length,
      activePersonnelCount: profiles.length,
    };
  }, [getScheduleForDate, profiles.length]);

  // ===========================================================================
  // MONTH NAVIGATION & FILTER HANDLERS (SWR PER-MONTH CACHE)
  // ===========================================================================
  const switchMonth = useCallback(
    (nextMonth: Date) => {
      const nextKey = format(nextMonth, 'yyyy-MM');
      currentMonthRef.current = nextMonth;
      setCurrentMonth(nextMonth);
      patchCachedShiftSettingsScreenData({ currentMonthIso: nextKey });

      const cachedRows = assignmentsByMonthRef.current[nextKey];
      if (cachedRows) {
        setDbAssignments(cachedRows);
      }

      void fetchRosterData({
        assignmentsOnly: true,
        targetMonth: nextMonth,
      });
    },
    [fetchRosterData]
  );

  const handlePrevMonth = useCallback(() => {
    switchMonth(subMonths(currentMonthRef.current, 1));
  }, [switchMonth]);

  const handleNextMonth = useCallback(() => {
    switchMonth(addMonths(currentMonthRef.current, 1));
  }, [switchMonth]);

  const handleJumpToToday = useCallback(() => {
    switchMonth(new Date());
    showToast('Jumped to current month view');
  }, [switchMonth, showToast]);

  const handleShiftFilterChange = useCallback((val: string) => {
    setSelectedShiftFilter(val);
    selectedShiftFilterRef.current = val;
    patchCachedShiftSettingsScreenData({ selectedShiftFilter: val });
  }, []);

  const handleRoleFilterChange = useCallback((val: string) => {
    setSelectedRoleFilter(val);
    selectedRoleFilterRef.current = val;
    patchCachedShiftSettingsScreenData({ selectedRoleFilter: val });
  }, []);

  // ===========================================================================
  // MODAL OPENING & COMPLETION CALLBACKS
  // ===========================================================================
  const handleSelectDay = useCallback((dateKey: string) => {
    setSelectedDateKey(dateKey);
  }, []);

  const handleOpenEditDay = useCallback(
    (daySchedule: DayDutySchedule) => {
      if (isSettingsViewOnly) {
        showToast(
          'You have view-only access. Modifying rosters is restricted.'
        );
        return;
      }
      const currentForDate =
        assignmentsByDateMap.get(daySchedule.dateKey) || [];
      const initialAssignments: EditDayAssignment[] = currentForDate.map(
        (a) => ({
          profileId: a.profile_id,
          shiftScheduleId: a.shift_schedule_id || null,
          assignmentType: a.assignment_type as 'duty' | 'rest' | 'travel',
          isLead: !!a.is_lead,
        })
      );
      setEditingDayTarget({
        date: daySchedule.date,
        initialAssignments,
      });
    },
    [isSettingsViewOnly, assignmentsByDateMap, showToast]
  );

  const handleDayRosterSaved = useCallback(
    (
      dateKey: string,
      updatedRows: DutyRosterAssignmentRecord[],
      message: string
    ) => {
      const viewedKey = format(currentMonthRef.current, 'yyyy-MM');
      setDbAssignments((prev) => {
        const next = [
          ...prev.filter((a) => a.duty_date !== dateKey),
          ...updatedRows,
        ];
        assignmentsByMonthRef.current[viewedKey] = next;
        monthSigMapRef.current[viewedKey] = computeAssignmentsSignature(next);
        syncCacheSnapshot();
        return next;
      });
      setEditingDayTarget(null);
      setSelectedDateKey(null);
      showToast(message);
    },
    [syncCacheSnapshot, showToast]
  );

  const handleOpenAddScheduleModal = useCallback(() => {
    setAddModalConfig({
      initialMonth: currentMonthRef.current,
      initialDutyDateKey: null,
    });
  }, []);

  const handleOpenAddForDate = useCallback((date: Date, dateKey: string) => {
    setSelectedDateKey(null);
    setAddModalConfig({
      initialMonth: date,
      initialDutyDateKey: dateKey,
    });
  }, []);

  const handleBatchScheduleSaved = useCallback(
    ({
      savedRecords,
      targetMonthDate,
      message,
    }: {
      savedRecords: DutyRosterAssignmentRecord[];
      targetMonthDate: Date;
      message: string;
    }) => {
      const targetKey = format(targetMonthDate, 'yyyy-MM');
      const viewedKey = format(currentMonthRef.current, 'yyyy-MM');

      const existingTarget = assignmentsByMonthRef.current[targetKey] ?? [];
      const targetMap = new Map<string, DutyRosterAssignmentRecord>();
      existingTarget.forEach((item) =>
        targetMap.set(`${item.profile_id}_${item.duty_date}`, item)
      );
      savedRecords.forEach((item) =>
        targetMap.set(`${item.profile_id}_${item.duty_date}`, item)
      );
      const mergedTarget = Array.from(targetMap.values());
      assignmentsByMonthRef.current[targetKey] = mergedTarget;
      monthSigMapRef.current[targetKey] =
        computeAssignmentsSignature(mergedTarget);

      if (targetKey !== viewedKey) {
        const normalizedTarget = new Date(
          targetMonthDate.getFullYear(),
          targetMonthDate.getMonth(),
          1
        );
        currentMonthRef.current = normalizedTarget;
        setCurrentMonth(normalizedTarget);
        setDbAssignments(mergedTarget);
        void fetchRosterData({
          assignmentsOnly: true,
          targetMonth: normalizedTarget,
        });
      } else {
        setDbAssignments(mergedTarget);
      }

      syncCacheSnapshot();
      setAddModalConfig(null);
      showToast(message);
    },
    [fetchRosterData, syncCacheSnapshot, showToast]
  );

  return (
    <AppLayoutShell
      title="Shift Schedule Calendar"
      subtitle="Monthly operational duty assignments, shift rotations, and personnel roster."
    >
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* =================================================================== */}
        {/* 1. HEADER SECTION                                                   */}
        {/* =================================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
                Shift Schedule Calendar
              </h1>
              {(isInitialLoading || isRefreshing) && (
                <div className="flex items-center gap-1 text-xs text-[#004AC6] font-semibold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Syncing Roster...</span>
                </div>
              )}
            </div>
            <p className="text-sm sm:text-base text-[#505F76] mt-1 font-medium">
              View and audit monthly operational shift rotations, officer station
              assignments, and duty rosters.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <SecondaryButton
              size="md"
              pill
              onClick={() => fetchRosterData({ showRefreshIndicator: true })}
              disabled={isInitialLoading || isRefreshing}
              leftIcon={
                <RefreshCw
                  className={`w-4 h-4 ${
                    isInitialLoading || isRefreshing ? 'animate-spin' : ''
                  }`}
                />
              }
            >
              Refresh
            </SecondaryButton>

            <SecondaryButton
              size="md"
              pill
              onClick={() => setIsPrintXLSXModalOpen(true)}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              Print
            </SecondaryButton>

            {!isSettingsViewOnly && (
              <PrimaryButton
                size="md"
                pill
                onClick={handleOpenAddScheduleModal}
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

        {/* =================================================================== */}
        {/* 2. SUMMARY METRICS CARDS ROW                                        */}
        {/* =================================================================== */}
        {isInitialLoading ? (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </section>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <SummaryCard
              title="Total Duty Personnel"
              value={kpiMetrics.dutyPersonnelCount.toString()}
              change={
                kpiMetrics.dutyPersonnelCount > 0
                  ? 'Scheduled Today'
                  : 'None Today'
              }
              changeType={
                kpiMetrics.dutyPersonnelCount > 0 ? 'positive' : 'neutral'
              }
              ambientColor="bg-[#004AC6]/5"
              iconBg="bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15"
              icon={<Users className="w-6 h-6" />}
              subtitle="Personnel active on operational shifts today"
            />

            <SummaryCard
              title="Total Rest Day Personnel"
              value={kpiMetrics.restPersonnelCount.toString()}
              change={
                kpiMetrics.restPersonnelCount > 0
                  ? 'Scheduled Off'
                  : 'None Off'
              }
              changeType="neutral"
              ambientColor="bg-[#D97706]/5"
              iconBg="bg-amber-50 text-amber-700 border border-amber-200"
              icon={<UserCheck className="w-6 h-6" />}
              subtitle="Personnel on scheduled rotation rest day"
            />

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

        {/* =================================================================== */}
        {/* 3. CALENDAR UI/UX: MONTHLY GRID VIEW WITH DYNAMIC SHIFT FILTERS     */}
        {/* =================================================================== */}
        <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm overflow-visible flex flex-col">
          {/* Calendar Toolbar Header */}
          <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white rounded-t-[1.75rem]">
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

            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="w-48 sm:w-56 shrink-0">
                <CustomDropdown
                  options={shiftFilterDropdownOptions}
                  value={selectedShiftFilter}
                  onChange={handleShiftFilterChange}
                  leftIcon={
                    <CalendarDays className="w-3.5 h-3.5 text-[#004AC6]" />
                  }
                  placeholder="Filter Shift"
                  size="sm"
                  pill
                />
              </div>

              <div className="w-40 sm:w-44 shrink-0">
                <CustomDropdown
                  options={roleFilterDropdownOptions}
                  value={selectedRoleFilter}
                  onChange={handleRoleFilterChange}
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
            {isInitialLoading ? (
              <CalendarSkeleton variant="full" daysCount={35} />
            ) : (
              <div className="min-w-[840px]">
                <div className="grid grid-cols-7 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  {[
                    'Sunday',
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                    'Saturday',
                  ].map((dayName) => (
                    <div
                      key={dayName}
                      className="py-3 px-3 text-center text-xs font-bold text-[#505F76] uppercase tracking-wider border-r border-[#E2E8F0] last:border-r-0"
                    >
                      <span className="hidden sm:inline">{dayName}</span>
                      <span className="sm:hidden">{dayName.slice(0, 3)}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 divide-y divide-[#E2E8F0]">
                  {calendarDays.map((cell) => (
                    <CalendarDayCell
                      key={cell.schedule.dateKey}
                      date={cell.date}
                      isCurrentMonth={cell.isCurrentMonth}
                      isCurrentDay={cell.isCurrentDay}
                      schedule={cell.schedule}
                      selectedShiftFilter={selectedShiftFilter}
                      selectedRoleFilter={selectedRoleFilter}
                      isSettingsViewOnly={isSettingsViewOnly}
                      onSelectDay={handleSelectDay}
                      onEditDay={handleOpenEditDay}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. LAZY MODAL: DAY SHIFT DUTY ROSTER INSPECTOR                        */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {selectedDaySchedule && (
          <DayDetailsModal
            key={selectedDaySchedule.dateKey}
            selectedDaySchedule={selectedDaySchedule}
            selectedRoleFilter={selectedRoleFilter}
            isSettingsViewOnly={isSettingsViewOnly}
            onClose={() => setSelectedDateKey(null)}
            onEditDay={handleOpenEditDay}
            onOpenAddForDate={handleOpenAddForDate}
          />
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 5. LAZY MODAL: EDIT DAY SHIFT ROSTER SCHEDULE                         */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {editingDayTarget && (
          <EditDayRosterModal
            key={format(editingDayTarget.date, 'yyyy-MM-dd')}
            editingDayDate={editingDayTarget.date}
            initialAssignments={editingDayTarget.initialAssignments}
            profiles={profiles}
            profilesById={profilesById}
            effectiveShiftSchedules={effectiveShiftSchedules}
            shiftRotationDropdownOptions={shiftRotationDropdownOptions}
            currentUserId={user?.id || null}
            isSettingsViewOnly={isSettingsViewOnly}
            onClose={() => setEditingDayTarget(null)}
            onSavedDay={handleDayRosterSaved}
            onToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 6. LAZY MODAL: ADD SHIFT SCHEDULE (MULTI-DATE PICKER)                 */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {addModalConfig && (
          <AddShiftScheduleModal
            key={`${format(addModalConfig.initialMonth, 'yyyy-MM')}-${
              addModalConfig.initialDutyDateKey ?? 'default'
            }`}
            initialMonth={addModalConfig.initialMonth}
            initialDutyDateKey={addModalConfig.initialDutyDateKey}
            profiles={profiles}
            shiftSchedules={shiftSchedules}
            schedulesById={schedulesById}
            currentUserId={user?.id || null}
            isSettingsViewOnly={isSettingsViewOnly}
            onClose={() => setAddModalConfig(null)}
            onBatchSaved={handleBatchScheduleSaved}
            onToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 7. LAZY MODAL: PRINT PREVIEW & DYNAMIC .XLSX EXPORT                   */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isPrintXLSXModalOpen && (
          <PrintExportModal
            currentMonth={currentMonth}
            monthActiveDays={monthActiveDays}
            shiftSchedules={shiftSchedules}
            onClose={() => setIsPrintXLSXModalOpen(false)}
            onToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 8. TOAST NOTIFICATION                                                 */}
      {/* ===================================================================== */}
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
            <p className="text-xs sm:text-sm font-bold text-slate-100">
              {toastMessage}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <LocationAccessModal screenName="Shift Schedule Management" />
    </AppLayoutShell>
  );
}
