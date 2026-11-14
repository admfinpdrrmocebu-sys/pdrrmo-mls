'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import {
  getCachedAccessScreenData,
  patchCachedAccessScreenData,
  setCachedAccessScreenData,
} from '@/lib/cache/screen-data-cache';
import {
  RawDbAccessRoleRow,
  RawDbShiftScheduleRow,
  RoleItem,
  RolePermission,
  ShiftScheduleItem,
  broadcastRolesUpdate,
  calculateDuration,
  computeAccessSignature,
  defaultRoles,
  formatTimeDisplay,
  getRoleDisplayNameFromList,
  mapDbRoleRow,
  mapDbShiftRow,
} from './_components/types';
import { RoleCard } from './_components/role-card';
import { ShiftCard } from './_components/shift-card';

export type {
  RolePermission,
  RoleItem,
  ShiftScheduleItem,
  TimeSlotOption,
} from './_components/types';

const RoleModal = dynamic(() => import('./_components/role-modal'), {
  ssr: false,
});

const ShiftModal = dynamic(() => import('./_components/shift-modal'), {
  ssr: false,
});

const DeleteConfirmModal = dynamic(
  () => import('./_components/delete-confirm-modal'),
  { ssr: false }
);

function RolesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-7 shadow-sm flex flex-col justify-between gap-5"
        >
          <div className="flex justify-between items-start gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Skeleton variant="rounded" className="h-5 w-32" />
                <Skeleton variant="pill" className="h-4 w-16" />
              </div>
              <Skeleton variant="rounded" className="h-3 w-56" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton variant="circular" className="w-8 h-8 rounded-full" />
              <Skeleton variant="circular" className="w-8 h-8 rounded-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton variant="rounded" className="h-3 w-24" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Skeleton key={s} variant="pill" className="h-6 w-24 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShiftsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col justify-between gap-5"
        >
          <div className="flex justify-between items-start gap-3">
            <div className="space-y-1.5">
              <Skeleton variant="rounded" className="h-5 w-36" />
              <Skeleton variant="pill" className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton variant="circular" className="w-8 h-8 rounded-full" />
              <Skeleton variant="circular" className="w-8 h-8 rounded-full" />
            </div>
          </div>

          <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Skeleton variant="rounded" className="h-3 w-16" />
                <Skeleton variant="rounded" className="h-4 w-20" />
              </div>
              <div className="space-y-1">
                <Skeleton variant="rounded" className="h-3 w-16" />
                <Skeleton variant="rounded" className="h-4 w-20" />
              </div>
            </div>
            <div className="pt-2 border-t border-[#E2E8F0] flex justify-between">
              <Skeleton variant="rounded" className="h-3 w-20" />
              <Skeleton variant="pill" className="h-4 w-16" />
            </div>
          </div>

          <Skeleton variant="rounded" className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function ManageAccessPage() {
  const { canWrite, isViewOnly, refreshRoles } = useAuth();
  const canModifySettings = canWrite('Settings');
  const isAccessViewOnly = isViewOnly('Settings') || !canModifySettings;

  // Synchronous SWR Cache Hydration
  const [initialCache] = useState(() => getCachedAccessScreenData());

  const [activeTab, setActiveTab] = useState<'roles' | 'shifts'>(
    () => initialCache?.activeTab ?? 'roles'
  );
  const [selectedShiftRoleFilter, setSelectedShiftRoleFilter] = useState<string>(
    () => initialCache?.selectedShiftRoleFilter ?? 'ALL'
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialCache);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [roles, setRoles] = useState<RoleItem[]>(
    () => initialCache?.roles ?? []
  );
  const [shiftSchedules, setShiftSchedules] = useState<ShiftScheduleItem[]>(
    () => initialCache?.shiftSchedules ?? []
  );

  // Lazy modal state
  const [roleModalState, setRoleModalState] = useState<{
    open: boolean;
    editingRole: RoleItem | null;
  }>({ open: false, editingRole: null });

  const [shiftModalState, setShiftModalState] = useState<{
    open: boolean;
    editingShift: ShiftScheduleItem | null;
    presetRole: string;
  }>({ open: false, editingShift: null, presetRole: 'monitoring' });

  const [deleteConfirmRole, setDeleteConfirmRole] = useState<RoleItem | null>(null);
  const [deleteConfirmShift, setDeleteConfirmShift] =
    useState<ShiftScheduleItem | null>(null);

  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Refs for latest state inside stable callbacks and signature diffing
  const rolesRef = useRef<RoleItem[]>(initialCache?.roles ?? []);
  const shiftsRef = useRef<ShiftScheduleItem[]>(initialCache?.shiftSchedules ?? []);
  const activeTabRef = useRef<'roles' | 'shifts'>(
    initialCache?.activeTab ?? 'roles'
  );
  const filterRef = useRef<string>(initialCache?.selectedShiftRoleFilter ?? 'ALL');
  const accessSigRef = useRef<string>(initialCache?.signature ?? '');
  const debounceFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    rolesRef.current = roles;
  }, [roles]);

  useEffect(() => {
    shiftsRef.current = shiftSchedules;
  }, [shiftSchedules]);

  const handleSetActiveTab = useCallback((tab: 'roles' | 'shifts') => {
    activeTabRef.current = tab;
    setActiveTab(tab);
    patchCachedAccessScreenData({ activeTab: tab });
  }, []);

  const handleSetShiftRoleFilter = useCallback((val: string) => {
    filterRef.current = val;
    setSelectedShiftRoleFilter(val);
    patchCachedAccessScreenData({ selectedShiftRoleFilter: val });
  }, []);

  const showToast = useCallback(
    (text: string, type: 'success' | 'error' = 'success') => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastMessage({ text, type });
      toastTimerRef.current = setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    },
    []
  );

  const persistSnapshot = useCallback(
    (
      nextRoles: RoleItem[],
      nextShifts: ShiftScheduleItem[],
      explicitSignature?: string
    ) => {
      const nextSig =
        explicitSignature ?? computeAccessSignature(nextRoles, nextShifts);
      accessSigRef.current = nextSig;
      setCachedAccessScreenData({
        roles: nextRoles,
        shiftSchedules: nextShifts,
        activeTab: activeTabRef.current,
        selectedShiftRoleFilter: filterRef.current,
        signature: nextSig,
        fetchedAt: Date.now(),
      });
    },
    []
  );

  // 1. Background / Initial Fetch with slice signature diffing (never toggles isLoading = true)
  const fetchData = useCallback(async () => {
    try {
      const [rolesRes, shiftsRes] = await Promise.all([
        supabase
          .from('access_roles')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase
          .from('shift_schedules')
          .select('*')
          .order('target_role', { ascending: true })
          .order('sort_order', { ascending: true }),
      ]);

      let resolvedRoles: RoleItem[] = rolesRef.current;
      if (!rolesRes.error && rolesRes.data && rolesRes.data.length > 0) {
        resolvedRoles = (rolesRes.data as RawDbAccessRoleRow[]).map(mapDbRoleRow);
        try {
          localStorage.setItem('pdrrmo_custom_roles', JSON.stringify(resolvedRoles));
        } catch {
          // Ignore storage errors
        }
      } else if (rolesRef.current.length === 0) {
        try {
          const local = localStorage.getItem('pdrrmo_custom_roles');
          resolvedRoles = local ? (JSON.parse(local) as RoleItem[]) : defaultRoles;
        } catch {
          resolvedRoles = defaultRoles;
        }
      }

      let resolvedShifts: ShiftScheduleItem[] = shiftsRef.current;
      if (!shiftsRes.error && shiftsRes.data) {
        resolvedShifts = (shiftsRes.data as RawDbShiftScheduleRow[]).map(
          mapDbShiftRow
        );
      } else if (shiftsRes.error) {
        console.warn(
          'Could not fetch shift_schedules from Supabase:',
          shiftsRes.error.message
        );
        if (shiftsRef.current.length === 0) {
          resolvedShifts = [];
        }
      }

      const nextSig = computeAccessSignature(resolvedRoles, resolvedShifts);
      if (nextSig !== accessSigRef.current) {
        const [prevRoleSig, prevShiftSig] = accessSigRef.current.split('##');
        const [nextRoleSig, nextShiftSig] = nextSig.split('##');

        if (nextRoleSig !== prevRoleSig || rolesRef.current.length === 0) {
          setRoles(resolvedRoles);
        }
        if (nextShiftSig !== prevShiftSig || shiftsRef.current.length === 0) {
          setShiftSchedules(resolvedShifts);
        }
        persistSnapshot(resolvedRoles, resolvedShifts, nextSig);
      } else {
        patchCachedAccessScreenData({ fetchedAt: Date.now() });
      }
    } catch (err) {
      console.error('Error loading access settings from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, [persistSnapshot]);

  const scheduleBackgroundRefresh = useCallback(() => {
    if (debounceFetchTimerRef.current) {
      clearTimeout(debounceFetchTimerRef.current);
    }
    debounceFetchTimerRef.current = setTimeout(() => {
      debounceFetchTimerRef.current = null;
      void fetchData();
    }, 350);
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void fetchData();
    });

    const channelName = `access-settings-realtime-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'access_roles' },
        () => scheduleBackgroundRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_schedules' },
        () => scheduleBackgroundRefresh()
      )
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleBackgroundRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (debounceFetchTimerRef.current) clearTimeout(debounceFetchTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [fetchData, scheduleBackgroundRefresh]);

  // Derived dropdown options & filtered shifts
  const roleDropdownOptions: CustomDropdownOption[] = useMemo(() => {
    const opts: CustomDropdownOption[] = [];
    roles.forEach((r) => {
      const roleVal = r.code || r.id;
      if (!opts.some((o) => o.value === roleVal)) {
        opts.push({
          value: roleVal,
          label: r.name,
          badge: r.badge || 'Role',
          badgeColor:
            r.badgeType === 'system'
              ? 'bg-blue-50 text-[#004AC6]'
              : r.badgeType === 'operational'
              ? 'bg-sky-50 text-sky-700'
              : 'bg-slate-100 text-slate-700',
          description:
            r.description || `Designated shift timetable specifically for ${r.name}`,
        });
      }
    });
    return opts;
  }, [roles]);

  const filterRoleDropdownOptions: CustomDropdownOption[] = useMemo(() => {
    const opts: CustomDropdownOption[] = [
      {
        value: 'ALL',
        label: 'All Configured Roles',
        badge: `${shiftSchedules.length} Shifts`,
        badgeColor: 'bg-slate-100 text-slate-700',
        description: 'View all shift schedules across all roles',
      },
    ];

    roles.forEach((r) => {
      const rCode = r.code || r.id;
      const count = shiftSchedules.filter(
        (s) => s.targetRole?.toLowerCase() === rCode.toLowerCase()
      ).length;

      opts.push({
        value: rCode,
        label: r.name,
        badge: `${count} Shifts`,
        badgeColor:
          r.badgeType === 'system'
            ? 'bg-blue-50 text-[#004AC6]'
            : r.badgeType === 'operational'
            ? 'bg-sky-50 text-sky-700'
            : 'bg-slate-100 text-slate-700',
        description: `${count} operational shifts configured for ${r.name}`,
      });
    });

    return opts;
  }, [roles, shiftSchedules]);

  const roleNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    roles.forEach((r) => {
      if (r.code) map[r.code.toLowerCase()] = r.name;
      if (r.id) map[r.id.toLowerCase()] = r.name;
      map[r.name.toLowerCase()] = r.name;
    });
    return map;
  }, [roles]);

  const getRoleDisplayName = useCallback(
    (roleCode?: string) => {
      if (!roleCode) return 'Unassigned';
      const lower = roleCode.toLowerCase();
      if (roleNameMap[lower]) return roleNameMap[lower];
      return getRoleDisplayNameFromList(roles, roleCode);
    },
    [roleNameMap, roles]
  );

  const filteredShiftSchedules = useMemo(() => {
    if (selectedShiftRoleFilter === 'ALL') {
      return [...shiftSchedules].sort((a, b) => {
        if (a.targetRole === b.targetRole) {
          return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        }
        return a.targetRole.localeCompare(b.targetRole);
      });
    }
    return shiftSchedules
      .filter(
        (s) => s.targetRole?.toLowerCase() === selectedShiftRoleFilter.toLowerCase()
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [shiftSchedules, selectedShiftRoleFilter]);

  // Stable card & modal handlers (React.memo on RoleCard & ShiftCard stays intact)
  const handleOpenAddRoleModal = useCallback(() => {
    if (isAccessViewOnly) {
      showToast('Action restricted under View-Only clearance.', 'error');
      return;
    }
    setRoleModalState({ open: true, editingRole: null });
  }, [isAccessViewOnly, showToast]);

  const handleOpenEditRoleModal = useCallback(
    (role: RoleItem) => {
      if (isAccessViewOnly) {
        showToast('Action restricted under View-Only clearance.', 'error');
        return;
      }
      setRoleModalState({ open: true, editingRole: role });
    },
    [isAccessViewOnly, showToast]
  );

  const handleRequestDeleteRole = useCallback(
    (role: RoleItem) => {
      setDeleteConfirmRole(role);
    },
    []
  );

  const handleSaveRole = useCallback(
    async ({
      editingRoleId,
      name,
      description,
      permissions,
    }: {
      editingRoleId: string | null;
      name: string;
      description: string;
      permissions: Record<string, 'View Only' | 'Full Access' | 'None'>;
    }) => {
      if (isAccessViewOnly) {
        showToast('Action restricted under View-Only clearance.', 'error');
        return;
      }
      if (!name.trim()) return;

      try {
        setIsSubmitting(true);
        const permArray: RolePermission[] = Object.entries(permissions).map(
          ([screen, level]) => ({
            screen,
            level,
          })
        );

        let updatedRolesList: RoleItem[] = [];

        if (editingRoleId) {
          const existingRole = rolesRef.current.find((r) => r.id === editingRoleId);
          const code =
            existingRole?.code ||
            name.toLowerCase().replace(/[^a-z0-9]/g, '-');

          const { error } = await supabase
            .from('access_roles')
            .update({
              name: name.trim(),
              description: description.trim() || 'Custom operational role',
              permissions: permArray,
              updated_at: new Date().toISOString(),
            })
            .or(`id.eq.${editingRoleId},code.eq.${code}`);

          if (error) {
            console.warn('Notice updating role in database:', error.message);
          }

          updatedRolesList = rolesRef.current.map((r) =>
            r.id === editingRoleId || r.code === code
              ? {
                  ...r,
                  name: name.trim(),
                  description: description.trim() || r.description,
                  permissions: permArray,
                }
              : r
          );
          setRoles(updatedRolesList);
          showToast(`Role "${name.trim()}" updated successfully.`);
        } else {
          const code = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const newRolePayload = {
            code,
            name: name.trim(),
            badge: 'Custom',
            badge_type: 'operational',
            description: description.trim() || 'Custom operational role',
            permissions: permArray,
            is_system: false,
          };

          const { data, error } = await supabase
            .from('access_roles')
            .insert([newRolePayload])
            .select()
            .maybeSingle();

          if (error) {
            console.warn('Notice inserting role into database:', error.message);
          }

          const newRole: RoleItem = data
            ? mapDbRoleRow(data as RawDbAccessRoleRow)
            : {
                id: `role-${Date.now()}`,
                code,
                name: name.trim(),
                badge: 'Custom',
                badgeType: 'operational',
                description: description.trim() || 'Custom operational role',
                permissions: permArray,
                isSystem: false,
              };

          updatedRolesList = [...rolesRef.current, newRole];
          setRoles(updatedRolesList);
          showToast(`Role "${newRole.name}" created successfully.`);
        }

        persistSnapshot(updatedRolesList, shiftsRef.current);
        broadcastRolesUpdate(updatedRolesList);
        await refreshRoles();
        setRoleModalState({ open: false, editingRole: null });
      } catch (err) {
        console.error('Error saving role:', err);
        showToast('Failed to save role.', 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [isAccessViewOnly, showToast, persistSnapshot, refreshRoles]
  );

  const handleConfirmDeleteRole = useCallback(async () => {
    if (isAccessViewOnly) {
      showToast('Action restricted under View-Only clearance.', 'error');
      return;
    }
    if (!deleteConfirmRole) return;
    const { id, name, isSystem, code } = deleteConfirmRole;

    if (isSystem) {
      showToast(`Cannot delete system role "${name}".`, 'error');
      setDeleteConfirmRole(null);
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('access_roles')
        .delete()
        .or(`id.eq.${id},code.eq.${code}`);
      if (error) {
        console.warn('Notice deleting role in database:', error.message);
      }

      const updatedRolesList = rolesRef.current.filter(
        (r) => r.id !== id && r.code !== code
      );
      setRoles(updatedRolesList);
      persistSnapshot(updatedRolesList, shiftsRef.current);
      broadcastRolesUpdate(updatedRolesList);
      await refreshRoles();
      showToast(`Role "${name}" deleted.`);
    } catch (err) {
      console.error('Error deleting role:', err);
      showToast('Failed to delete role.', 'error');
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmRole(null);
    }
  }, [isAccessViewOnly, deleteConfirmRole, showToast, persistSnapshot, refreshRoles]);

  const handleOpenAddShiftModal = useCallback(
    (presetRole?: string) => {
      if (isAccessViewOnly) {
        showToast('Action restricted under View-Only clearance.', 'error');
        return;
      }
      let initialRole = presetRole;
      if (!initialRole && filterRef.current !== 'ALL') {
        initialRole = filterRef.current;
      }
      if (!initialRole) {
        initialRole = roleDropdownOptions[0]?.value || 'monitoring';
      }
      setShiftModalState({
        open: true,
        editingShift: null,
        presetRole: initialRole,
      });
    },
    [isAccessViewOnly, showToast, roleDropdownOptions]
  );

  const handleOpenEditShiftModal = useCallback(
    (shift: ShiftScheduleItem) => {
      if (isAccessViewOnly) {
        showToast('Action restricted under View-Only clearance.', 'error');
        return;
      }
      setShiftModalState({
        open: true,
        editingShift: shift,
        presetRole: shift.targetRole || 'monitoring',
      });
    },
    [isAccessViewOnly, showToast]
  );

  const handleRequestDeleteShift = useCallback(
    (shift: ShiftScheduleItem) => {
      setDeleteConfirmShift(shift);
    },
    []
  );

  const handleSaveShiftSchedule = useCallback(
    async ({
      editingShiftId,
      shiftName,
      startShiftTime,
      endShiftTime,
      targetRole,
      sortOrder,
      isDefaultSchedule,
    }: {
      editingShiftId: string | null;
      shiftName: string;
      startShiftTime: string;
      endShiftTime: string;
      targetRole: string;
      sortOrder: number;
      isDefaultSchedule: boolean;
    }) => {
      if (isAccessViewOnly) {
        showToast('Action restricted under View-Only clearance.', 'error');
        return;
      }
      if (!shiftName.trim()) return;

      const isDuplicate = shiftsRef.current.some(
        (s) =>
          s.id !== editingShiftId &&
          s.targetRole?.toLowerCase() === targetRole.toLowerCase() &&
          s.startTime === startShiftTime &&
          s.endTime === endShiftTime
      );

      if (isDuplicate) {
        showToast(
          `A shift schedule from ${formatTimeDisplay(startShiftTime)} to ${formatTimeDisplay(endShiftTime)} already exists for ${getRoleDisplayNameFromList(rolesRef.current, targetRole)}.`,
          'error'
        );
        return;
      }

      try {
        setIsSubmitting(true);
        const computedDuration =
          calculateDuration(startShiftTime, endShiftTime) || '8 Hours';
        const safeSortOrder = isDefaultSchedule
          ? 0
          : Math.max(1, Number(sortOrder) || 1);

        let updatedShifts: ShiftScheduleItem[] = [];

        if (editingShiftId) {
          const { error } = await supabase
            .from('shift_schedules')
            .update({
              name: shiftName.trim(),
              start_time: startShiftTime,
              end_time: endShiftTime,
              duration: computedDuration,
              target_role: targetRole,
              sort_order: safeSortOrder,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingShiftId);

          if (error) {
            console.error('Could not update shift in database:', error.message);
            showToast(`Error updating shift: ${error.message}`, 'error');
            return;
          }

          updatedShifts = shiftsRef.current.map((s) =>
            s.id === editingShiftId
              ? {
                  ...s,
                  name: shiftName.trim(),
                  startTime: startShiftTime,
                  endTime: endShiftTime,
                  duration: computedDuration,
                  targetRole,
                  sortOrder: safeSortOrder,
                }
              : s
          );
          setShiftSchedules(updatedShifts);
          showToast(
            isDefaultSchedule
              ? `Default Shift schedule "${shiftName.trim()}" updated.`
              : `Shift schedule "${shiftName.trim()}" updated (Position #${safeSortOrder}).`
          );
        } else {
          const shiftPayload = {
            name: shiftName.trim(),
            start_time: startShiftTime,
            end_time: endShiftTime,
            duration: computedDuration,
            target_role: targetRole,
            sort_order: safeSortOrder,
            color: '#004AC6',
          };

          const { data, error } = await supabase
            .from('shift_schedules')
            .insert([shiftPayload])
            .select()
            .maybeSingle();

          if (error) {
            console.error(
              'Could not insert shift schedule into database:',
              error.message
            );
            if (error.code === '23505') {
              showToast(
                'A shift with this time pattern or name already exists in the database.',
                'error'
              );
            } else {
              showToast(`Database error: ${error.message}`, 'error');
            }
            return;
          }

          const newShift: ShiftScheduleItem = data
            ? mapDbShiftRow(data as RawDbShiftScheduleRow)
            : {
                id: `shift-${Date.now()}`,
                name: shiftName.trim(),
                startTime: startShiftTime,
                endTime: endShiftTime,
                duration: computedDuration,
                targetRole,
                sortOrder: safeSortOrder,
                color: '#004AC6',
                isActive: true,
              };

          updatedShifts = [...shiftsRef.current, newShift];
          setShiftSchedules(updatedShifts);
          const displayRole = getRoleDisplayNameFromList(
            rolesRef.current,
            targetRole
          );
          showToast(
            isDefaultSchedule
              ? `Default schedule "${shiftName.trim()}" added for ${displayRole} (Sort 0).`
              : `Monitoring shift "${shiftName.trim()}" added for ${displayRole} (Position #${safeSortOrder}).`
          );
        }

        persistSnapshot(rolesRef.current, updatedShifts);
        setShiftModalState((prev) => ({
          ...prev,
          open: false,
          editingShift: null,
        }));
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Failed to save shift schedule.';
        console.error('Error saving shift schedule:', err);
        showToast(msg, 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [isAccessViewOnly, showToast, persistSnapshot]
  );

  const handleConfirmDeleteShift = useCallback(async () => {
    if (isAccessViewOnly) {
      showToast('Action restricted under View-Only clearance.', 'error');
      return;
    }
    if (!deleteConfirmShift) return;
    const { id, name } = deleteConfirmShift;

    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('shift_schedules').delete().eq('id', id);
      if (error) {
        console.warn(
          'Could not delete shift in database, updating locally:',
          error.message
        );
      }

      const updatedShifts = shiftsRef.current.filter((s) => s.id !== id);
      setShiftSchedules(updatedShifts);
      persistSnapshot(rolesRef.current, updatedShifts);
      showToast(`Shift schedule "${name}" removed.`);
    } catch (err) {
      console.error('Error deleting shift schedule:', err);
      showToast('Failed to delete shift schedule.', 'error');
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmShift(null);
    }
  }, [isAccessViewOnly, deleteConfirmShift, showToast, persistSnapshot]);

  return (
    <AppLayoutShell
      title="Manage Access & Schedules"
      subtitle="Role-Based Access Control (RBAC) & Shift Schedule Timetable Configurations"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* 1. TOP TOGGLE BUTTON & TAB CONTROLS */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <div className="flex bg-[#F1F5F9] p-1.5 rounded-full border border-[#E2E8F0]/70">
            <button
              type="button"
              onClick={() => handleSetActiveTab('roles')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'roles'
                  ? 'bg-white text-[#004AC6] shadow-2xs font-bold'
                  : 'text-[#505F76] hover:text-[#1E293B]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>User Roles ({roles.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetActiveTab('shifts')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'shifts'
                  ? 'bg-white text-[#004AC6] shadow-2xs font-bold'
                  : 'text-[#505F76] hover:text-[#1E293B]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Shift Schedules ({shiftSchedules.length})</span>
            </button>
          </div>

          <div>
            {isAccessViewOnly ? (
              <ViewOnlyNotice
                screen="Settings"
                message="Viewing roles and shift schedules in read-only mode."
              />
            ) : activeTab === 'roles' ? (
              <PrimaryButton
                size="md"
                pill
                onClick={handleOpenAddRoleModal}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add User Role
              </PrimaryButton>
            ) : (
              <PrimaryButton
                size="md"
                pill
                onClick={() =>
                  handleOpenAddShiftModal(
                    selectedShiftRoleFilter !== 'ALL'
                      ? selectedShiftRoleFilter
                      : undefined
                  )
                }
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add Shift Schedule
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* 2. TAB CONTENT: USER ROLES */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            {isLoading ? (
              <RolesGridSkeleton />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {roles.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    isAccessViewOnly={isAccessViewOnly}
                    onEdit={handleOpenEditRoleModal}
                    onDelete={handleRequestDeleteRole}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. TAB CONTENT: SHIFT SCHEDULE */}
        {activeTab === 'shifts' && (
          <div className="space-y-6">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 overflow-visible relative z-20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#004AC6] flex items-center justify-center shrink-0 border border-blue-100">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider">
                      Filter Role
                    </span>
                    <span className="text-[11px] font-bold text-[#004AC6] bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-full font-mono">
                      {filteredShiftSchedules.length}{' '}
                      {filteredShiftSchedules.length === 1 ? 'Shift' : 'Shifts'}
                    </span>
                  </div>
                  <p className="text-xs text-[#757680] font-medium">
                    {selectedShiftRoleFilter === 'ALL'
                      ? 'Viewing shift schedules across all configured roles'
                      : `Viewing shift schedules designated for ${getRoleDisplayName(selectedShiftRoleFilter)}`}
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-64 shrink-0">
                <CustomDropdown
                  options={filterRoleDropdownOptions}
                  value={selectedShiftRoleFilter}
                  onChange={handleSetShiftRoleFilter}
                  placeholder="Select Role Filter"
                  leftIcon={<Filter className="w-3.5 h-3.5 text-[#004AC6]" />}
                  size="sm"
                  pill
                />
              </div>
            </div>

            {isLoading ? (
              <ShiftsGridSkeleton />
            ) : filteredShiftSchedules.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-12 text-center flex flex-col items-center justify-center gap-4 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center">
                  <Clock className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h3 className="text-base font-bold text-[#1E293B]">
                    {selectedShiftRoleFilter !== 'ALL'
                      ? `No Shift Schedules for ${getRoleDisplayName(selectedShiftRoleFilter)}`
                      : 'No Shift Schedules Configured Yet'}
                  </h3>
                  <p className="text-xs text-[#757680] leading-relaxed">
                    {selectedShiftRoleFilter !== 'ALL'
                      ? `Customize operational duty shifts specifically for ${getRoleDisplayName(selectedShiftRoleFilter)}.`
                      : 'Start by creating customized shift schedules and timetable rotations per user role.'}
                  </p>
                </div>
                {!isAccessViewOnly && (
                  <PrimaryButton
                    size="sm"
                    pill
                    onClick={() =>
                      handleOpenAddShiftModal(
                        selectedShiftRoleFilter !== 'ALL'
                          ? selectedShiftRoleFilter
                          : undefined
                      )
                    }
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Add Shift for{' '}
                    {selectedShiftRoleFilter !== 'ALL'
                      ? getRoleDisplayName(selectedShiftRoleFilter)
                      : 'Role'}
                  </PrimaryButton>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredShiftSchedules.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    roleDisplayName={getRoleDisplayName(shift.targetRole)}
                    isAccessViewOnly={isAccessViewOnly}
                    onEdit={handleOpenEditShiftModal}
                    onDelete={handleRequestDeleteShift}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. LAZY MODAL: ADD / EDIT SHIFT SCHEDULE */}
      <AnimatePresence>
        {shiftModalState.open && (
          <ShiftModal
            key={shiftModalState.editingShift?.id || 'create-shift'}
            editingShift={shiftModalState.editingShift}
            initialPresetRole={shiftModalState.presetRole}
            roles={roles}
            shiftSchedules={shiftSchedules}
            roleDropdownOptions={roleDropdownOptions}
            isSubmitting={isSubmitting}
            onClose={() =>
              setShiftModalState((prev) => ({
                ...prev,
                open: false,
                editingShift: null,
              }))
            }
            onSave={handleSaveShiftSchedule}
          />
        )}
      </AnimatePresence>

      {/* 5. LAZY MODAL: ADD / EDIT USER ROLE */}
      <AnimatePresence>
        {roleModalState.open && (
          <RoleModal
            key={roleModalState.editingRole?.id || 'create-role'}
            editingRole={roleModalState.editingRole}
            isSubmitting={isSubmitting}
            onClose={() => setRoleModalState({ open: false, editingRole: null })}
            onSave={handleSaveRole}
          />
        )}
      </AnimatePresence>

      {/* 6. LAZY MODAL: CONFIRM DELETE */}
      <AnimatePresence>
        {(deleteConfirmRole || deleteConfirmShift) && (
          <DeleteConfirmModal
            kind={deleteConfirmRole ? 'role' : 'shift'}
            itemName={deleteConfirmRole?.name || deleteConfirmShift?.name || ''}
            isSubmitting={isSubmitting}
            onCancel={() => {
              setDeleteConfirmRole(null);
              setDeleteConfirmShift(null);
            }}
            onConfirm={
              deleteConfirmRole ? handleConfirmDeleteRole : handleConfirmDeleteShift
            }
          />
        )}
      </AnimatePresence>

      {/* 7. TOAST FEEDBACK NOTIFICATION */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 text-white px-5 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-medium flex items-center gap-2 border ${
              toastMessage.type === 'error'
                ? 'bg-rose-900 border-rose-700'
                : 'bg-[#1E293B] border-slate-700'
            }`}
          >
            {toastMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
