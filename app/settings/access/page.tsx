'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Shield,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Ban,
  X,
  LayoutDashboard,
  FileText,
  Radio,
  Megaphone,
  Users,
  Archive,
  Settings as SettingsIcon,
  Clock,
  Calendar,
  Layers,
  ChevronDown,
  Search,
  Check,
  Loader2,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';

// =============================================================================
// INTERFACES & TYPES
// =============================================================================
export interface RolePermission {
  screen: string;
  level: 'Full Access' | 'View Only' | 'None';
}

export interface RoleItem {
  id: string;
  code?: string;
  name: string;
  badge: string;
  badgeType: 'system' | 'operational' | 'standard';
  description: string;
  permissions: RolePermission[];
  isSystem?: boolean;
}

export interface ShiftScheduleItem {
  id: string;
  name: string;
  startTime: string; // "HH:MM" in 24-hr format
  endTime: string;   // "HH:MM" in 24-hr format
  duration: string;
  description?: string;
  targetRole: string; // 'monitoring' | 'admin' | 'staff' | string
  sortOrder?: number;
  color?: string;
  isActive?: boolean;
}

export interface TimeSlotOption {
  value: string; // "HH:MM"
  time12: string; // "08:00 AM"
  military: string; // "0800H"
}

// =============================================================================
// TIME HELPER UTILITIES & OPTION GENERATOR
// =============================================================================
const generateTimeOptions = (): TimeSlotOption[] => {
  const options: TimeSlotOption[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (const min of [0, 30]) {
      const hStr = String(hour).padStart(2, '0');
      const mStr = String(min).padStart(2, '0');
      const value = `${hStr}:${mStr}`;
      const military = `${hStr}${mStr}H`;

      const ampm = hour >= 12 ? 'PM' : 'AM';
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      const time12 = `${String(h12).padStart(2, '0')}:${mStr} ${ampm}`;

      options.push({
        value,
        time12,
        military,
      });
    }
  }
  return options;
};

const allTimeOptions = generateTimeOptions();

// Helper: Format 24-hr time string to 12-hour AM/PM with 24H military notation
const formatTimeDisplay = (time24: string) => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${mStr} ${ampm} (${hStr}${mStr}H)`;
};

// Helper: Calculate duration between start and end time
const calculateDuration = (start: string, end: string) => {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return '';

  let totalMinutes = eh * 60 + em - (sh * 60 + sm);
  if (totalMinutes <= 0) {
    totalMinutes += 24 * 60; // Crosses midnight
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} Hours`;
};

// =============================================================================
// SIMPLE CLEAN TIME PICKER DROPDOWN COMPONENT
// =============================================================================
interface TimePickerDropdownProps {
  label: string;
  value: string; // "HH:MM"
  onChange: (val: string) => void;
}

function TimePickerDropdown({ label, value, onChange }: TimePickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Find selected option metadata
  const currentOption = allTimeOptions.find((opt) => opt.value === value) || {
    value,
    time12: formatTimeDisplay(value).split(' (')[0],
    military: `${value.replace(':', '')}H`,
  };

  // Filtered options based on search query
  const filteredOptions = allTimeOptions.filter((opt) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      opt.value.includes(query) ||
      opt.time12.toLowerCase().includes(query) ||
      opt.military.toLowerCase().includes(query)
    );
  });

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={dropdownRef} className="space-y-1.5 relative w-full">
      {/* Label */}
      <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[11px] font-mono text-[#505F76] font-semibold">
          {currentOption.military}
        </span>
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-[#F8FAFC] border rounded-full py-2.5 px-4 text-left transition-all cursor-pointer flex items-center justify-between group shadow-2xs ${
          isOpen
            ? 'border-[#004AC6] bg-white ring-2 ring-[#004AC6]/15'
            : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#1E293B] font-mono">
            {currentOption.time12}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-[#505F76] font-mono">
            {currentOption.military}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-[#757680] group-hover:text-[#1E293B] transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#004AC6]' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl overflow-hidden flex flex-col w-full ring-1 ring-black/5"
          >
            {/* Search Input */}
            <div className="p-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search time (e.g., 08:00, 2 PM, 1400H)..."
                  className="w-full bg-white border border-[#E2E8F0] rounded-full py-1.5 pl-8 pr-3 text-xs text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#1E293B]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Time Choices List */}
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#757680]">
                  No matching time slots found for &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full px-3 py-2 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#004AC6]/10 text-[#004AC6] font-bold'
                          : 'hover:bg-slate-50 text-[#1E293B]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold font-mono">
                          {opt.time12}
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-[#505F76] font-medium">
                          {opt.military}
                        </span>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-[#004AC6] stroke-[2.5]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// DEFAULT FALLBACK DATA
// =============================================================================
const defaultRoles: RoleItem[] = [
  {
    id: 'admin',
    code: 'admin',
    name: 'Admin',
    badge: 'System',
    badgeType: 'system',
    description: 'Full System Access & Configuration',
    isSystem: true,
    permissions: [
      { screen: 'Dashboard', level: 'Full Access' },
      { screen: 'Logs', level: 'Full Access' },
      { screen: 'Roll Call', level: 'Full Access' },
      { screen: 'Users', level: 'Full Access' },
      { screen: 'Archives', level: 'Full Access' },
      { screen: 'Settings', level: 'Full Access' },
      { screen: 'Announcements', level: 'Full Access' },
      { screen: 'Shifts', level: 'Full Access' },
    ],
  },
  {
    id: 'monitoring',
    code: 'monitoring',
    name: 'Monitoring Officer',
    badge: 'Operational',
    badgeType: 'operational',
    description: 'Dashboard, Logs, and Roll Call Operations',
    isSystem: true,
    permissions: [
      { screen: 'Dashboard', level: 'Full Access' },
      { screen: 'Logs', level: 'Full Access' },
      { screen: 'Roll Call', level: 'Full Access' },
      { screen: 'Users', level: 'None' },
      { screen: 'Archives', level: 'View Only' },
      { screen: 'Settings', level: 'None' },
      { screen: 'Announcements', level: 'Full Access' },
      { screen: 'Shifts', level: 'Full Access' },
    ],
  },
  {
    id: 'staff',
    code: 'staff',
    name: 'Staff',
    badge: 'Standard',
    badgeType: 'standard',
    description: 'Default View Access and Monitoring Telemetry',
    isSystem: true,
    permissions: [
      { screen: 'Dashboard', level: 'View Only' },
      { screen: 'Logs', level: 'None' },
      { screen: 'Roll Call', level: 'None' },
      { screen: 'Users', level: 'None' },
      { screen: 'Archives', level: 'View Only' },
      { screen: 'Settings', level: 'None' },
      { screen: 'Announcements', level: 'View Only' },
      { screen: 'Shifts', level: 'View Only' },
    ],
  },
];

const screenList = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Logs', icon: FileText },
  { name: 'Roll Call', icon: Radio },
  { name: 'Users', icon: Users },
  { name: 'Archives', icon: Archive },
  { name: 'Settings', icon: SettingsIcon },
  { name: 'Announcements', icon: Megaphone },
  { name: 'Shifts', icon: Calendar },
];

// =============================================================================
// SKELETON PLACEHOLDERS
// =============================================================================
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

// =============================================================================
// MAIN COMPONENT: MANAGE ACCESS & SCHEDULES PAGE
// =============================================================================
export default function ManageAccessPage() {
  const { isViewOnly } = useAuth();
  const isAccessViewOnly = isViewOnly('Settings');

  // Active Tab State: 'roles' | 'shifts'
  const [activeTab, setActiveTab] = useState<'roles' | 'shifts'>('roles');

  // Shift Schedule Role Sub-Filter: 'ALL' | specific role code
  const [selectedShiftRoleFilter, setSelectedShiftRoleFilter] = useState<string>('ALL');

  // Loading & Async State
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Roles State
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [permissions, setPermissions] = useState<
    Record<string, 'View Only' | 'Full Access' | 'None'>
  >({
    Dashboard: 'View Only',
    Logs: 'Full Access',
    'Roll Call': 'View Only',
    Users: 'None',
    Archives: 'View Only',
    Settings: 'None',
  });

  // Shift Schedule State
  const [shiftSchedules, setShiftSchedules] = useState<ShiftScheduleItem[]>([]);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftName, setShiftName] = useState('');
  const [startShiftTime, setStartShiftTime] = useState('08:00');
  const [endShiftTime, setEndShiftTime] = useState('16:00');
  const [targetRole, setTargetRole] = useState<string>('monitoring');
  const [sortOrder, setSortOrder] = useState<number>(1);

  // Confirmation Delete Modals
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<RoleItem | null>(null);
  const [deleteConfirmShift, setDeleteConfirmShift] = useState<ShiftScheduleItem | null>(null);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ===========================================================================
  // 1. DATA FETCHING (SUPABASE & RESILIENT FALLBACK)
  // ===========================================================================
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [rolesRes, shiftsRes] = await Promise.all([
        supabase.from('access_roles').select('*').order('created_at', { ascending: true }),
        supabase
          .from('shift_schedules')
          .select('*')
          .order('target_role', { ascending: true })
          .order('sort_order', { ascending: true }),
      ]);

      // Process Roles
      if (!rolesRes.error && rolesRes.data) {
        const mappedRoles: RoleItem[] = rolesRes.data.map((r: any) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          badge: r.badge || 'Operational',
          badgeType: (r.badge_type as any) || 'operational',
          description: r.description || '',
          isSystem: r.is_system ?? false,
          permissions: Array.isArray(r.permissions) ? r.permissions : [],
        }));
        setRoles(mappedRoles);
      } else if (rolesRes.error) {
        console.warn('Could not fetch access_roles from Supabase:', rolesRes.error.message);
        setRoles([]);
      }

      // Process Shift Schedules
      if (!shiftsRes.error && shiftsRes.data) {
        const mappedShifts: ShiftScheduleItem[] = shiftsRes.data.map((s: any) => ({
          id: s.id,
          name: s.name,
          startTime: s.start_time || '08:00',
          endTime: s.end_time || '16:00',
          duration: s.duration || calculateDuration(s.start_time, s.end_time) || '8 Hours',
          description: s.description || '',
          targetRole: s.target_role || 'monitoring',
          sortOrder: s.sort_order ?? 1,
          color: s.color || '#004AC6',
          isActive: s.is_active ?? true,
        }));
        setShiftSchedules(mappedShifts);
      } else if (shiftsRes.error) {
        console.warn('Could not fetch shift_schedules from Supabase:', shiftsRes.error.message);
        setShiftSchedules([]);
      }
    } catch (err) {
      console.error('Error loading access settings from Supabase:', err);
      setRoles([]);
      setShiftSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Supabase Real-time Sync
    const channel = supabase
      .channel('access-settings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'access_roles' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_schedules' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Dynamic role dropdown options for the Shift Schedule Modal (No ALL fallback - strictly customizable per role)
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
          description: r.description || `Designated shift timetable specifically for ${r.name}`,
        });
      }
    });

    return opts;
  }, [roles]);

  // Dropdown options for filtering shifts by role in the Shifts tab
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

  // Helper to resolve clean display name for a role code
  const getRoleDisplayName = useCallback(
    (roleCode?: string) => {
      if (!roleCode) return 'Unassigned';
      const found = roles.find(
        (r) =>
          r.code?.toLowerCase() === roleCode.toLowerCase() ||
          r.id?.toLowerCase() === roleCode.toLowerCase() ||
          r.name.toLowerCase() === roleCode.toLowerCase()
      );
      if (found) return found.name;
      if (roleCode.toLowerCase() === 'admin') return 'Admin';
      if (roleCode.toLowerCase() === 'monitoring') return 'Monitoring Officer';
      if (roleCode.toLowerCase() === 'staff') return 'Staff';
      return roleCode;
    },
    [roles]
  );

  // Filtered shift schedules based on selected role sub-filter
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
      .filter((s) => s.targetRole?.toLowerCase() === selectedShiftRoleFilter.toLowerCase())
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [shiftSchedules, selectedShiftRoleFilter]);

  // ---------------------------------------------------------------------------
  // ROLE HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenAddRoleModal = () => {
    setEditingRoleId(null);
    setRoleName('');
    setRoleDescription('');
    setPermissions({
      Dashboard: 'View Only',
      Logs: 'Full Access',
      'Roll Call': 'View Only',
      Users: 'None',
      Archives: 'View Only',
      Settings: 'None',
      Announcements: 'Full Access',
      Shifts: 'Full Access',
    });
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRoleModal = (role: RoleItem) => {
    setEditingRoleId(role.id);
    setRoleName(role.name);
    setRoleDescription(role.description);

    const permMap: Record<string, 'View Only' | 'Full Access' | 'None'> = {
      Dashboard: 'None',
      Logs: 'None',
      'Roll Call': 'None',
      Users: 'None',
      Archives: 'None',
      Settings: 'None',
      Announcements: 'None',
      Shifts: 'None',
    };
    if (role.permissions && Array.isArray(role.permissions)) {
      role.permissions.forEach((p) => {
        permMap[p.screen] = p.level;
      });
    }
    setPermissions(permMap);
    setIsRoleModalOpen(true);
  };

  const handlePermissionChange = (screen: string, level: 'View Only' | 'Full Access' | 'None') => {
    setPermissions((prev) => ({ ...prev, [screen]: level }));
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) return;

    try {
      setIsSubmitting(true);
      const permArray: RolePermission[] = Object.entries(permissions).map(([screen, level]) => ({
        screen,
        level,
      }));

      if (editingRoleId) {
        // Try updating in Supabase
        const { error } = await supabase
          .from('access_roles')
          .update({
            name: roleName.trim(),
            description: roleDescription.trim() || 'Custom operational role',
            permissions: permArray,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRoleId);

        if (error) {
          console.warn('Could not update role in database (table pending migration), updating locally:', error.message);
        }

        setRoles((prev) =>
          prev.map((r) =>
            r.id === editingRoleId
              ? {
                  ...r,
                  name: roleName.trim(),
                  description: roleDescription.trim() || r.description,
                  permissions: permArray,
                }
              : r
          )
        );
        showToast(`Role "${roleName.trim()}" updated successfully.`);
      } else {
        const code = roleName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const newRolePayload = {
          code,
          name: roleName.trim(),
          badge: 'Custom',
          badge_type: 'operational',
          description: roleDescription.trim() || 'Custom operational role',
          permissions: permArray,
          is_system: false,
        };

        const { data, error } = await supabase
          .from('access_roles')
          .insert([newRolePayload])
          .select()
          .maybeSingle();

        if (error) {
          console.warn('Could not insert role into database, updating locally:', error.message);
        }

        const newRole: RoleItem = {
          id: data?.id || `role-${Date.now()}`,
          code,
          name: roleName.trim(),
          badge: 'Custom',
          badgeType: 'operational',
          description: roleDescription.trim() || 'Custom operational role',
          permissions: permArray,
          isSystem: false,
        };

        setRoles((prev) => [...prev, newRole]);
        showToast(`Role "${newRole.name}" created successfully.`);
      }

      setIsRoleModalOpen(false);
    } catch (err) {
      console.error('Error saving role:', err);
      showToast('Failed to save role.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteRole = async () => {
    if (!deleteConfirmRole) return;
    const { id, name, isSystem } = deleteConfirmRole;

    if (isSystem) {
      showToast(`Cannot delete system role "${name}".`, 'error');
      setDeleteConfirmRole(null);
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('access_roles').delete().eq('id', id);
      if (error) {
        console.warn('Could not delete role in database, updating locally:', error.message);
      }

      setRoles((prev) => prev.filter((r) => r.id !== id));
      showToast(`Role "${name}" deleted.`);
    } catch (err) {
      console.error('Error deleting role:', err);
      showToast('Failed to delete role.', 'error');
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmRole(null);
    }
  };

  // ---------------------------------------------------------------------------
  // SHIFT SCHEDULE HANDLERS (PER-ROLE SORT ORDER, EDITABLE ORDER & DUPLICATE CHECK)
  // ---------------------------------------------------------------------------
  const handleOpenAddShiftModal = (presetRole?: string) => {
    setEditingShiftId(null);
    setShiftName('');
    setStartShiftTime('08:00');
    setEndShiftTime('16:00');

    // Default to presetRole -> active role tab -> first available role -> 'monitoring'
    let initialRole = presetRole;
    if (!initialRole && selectedShiftRoleFilter !== 'ALL') {
      initialRole = selectedShiftRoleFilter;
    }
    if (!initialRole) {
      initialRole = roleDropdownOptions[0]?.value || 'monitoring';
    }
    setTargetRole(initialRole);

    const existingCount = shiftSchedules.filter(
      (s) => s.targetRole?.toLowerCase() === initialRole.toLowerCase()
    ).length;
    setSortOrder(existingCount + 1);

    setIsShiftModalOpen(true);
  };

  const handleOpenEditShiftModal = (shift: ShiftScheduleItem) => {
    setEditingShiftId(shift.id);
    setShiftName(shift.name);
    setStartShiftTime(shift.startTime);
    setEndShiftTime(shift.endTime);
    setTargetRole(shift.targetRole || roleDropdownOptions[0]?.value || 'monitoring');
    setSortOrder(shift.sortOrder ?? 1);
    setIsShiftModalOpen(true);
  };

  const handleTargetRoleChange = (newRole: string) => {
    setTargetRole(newRole);
    if (!editingShiftId) {
      const existingCount = shiftSchedules.filter(
        (s) => s.targetRole?.toLowerCase() === newRole.toLowerCase()
      ).length;
      setSortOrder(existingCount + 1);
    }
  };

  const handleSaveShiftSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftName.trim()) return;

    // 1. DUPLICATION CHECK: Prevent same start_time and end_time for the same role
    const isDuplicate = shiftSchedules.some(
      (s) =>
        s.id !== editingShiftId &&
        s.targetRole?.toLowerCase() === targetRole.toLowerCase() &&
        s.startTime === startShiftTime &&
        s.endTime === endShiftTime
    );

    if (isDuplicate) {
      showToast(
        `A shift schedule from ${formatTimeDisplay(startShiftTime)} to ${formatTimeDisplay(endShiftTime)} already exists for ${getRoleDisplayName(targetRole)}.`,
        'error'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const computedDuration = calculateDuration(startShiftTime, endShiftTime) || '8 Hours';
      const safeSortOrder = Math.max(1, Number(sortOrder) || 1);

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
          setIsSubmitting(false);
          return;
        }

        setShiftSchedules((prev) =>
          prev.map((s) =>
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
          )
        );
        showToast(`Shift schedule "${shiftName.trim()}" updated successfully.`);
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
          console.error('Could not insert shift schedule into database:', error.message);
          if (error.code === '23505') {
            showToast(`A shift with this time pattern or name already exists in the database.`, 'error');
          } else {
            showToast(`Database error: ${error.message}`, 'error');
          }
          setIsSubmitting(false);
          return;
        }

        const newShift: ShiftScheduleItem = {
          id: data?.id || `shift-${Date.now()}`,
          name: shiftName.trim(),
          startTime: startShiftTime,
          endTime: endShiftTime,
          duration: computedDuration,
          targetRole,
          sortOrder: safeSortOrder,
          color: '#004AC6',
          isActive: true,
        };

        setShiftSchedules((prev) => [...prev, newShift]);
        showToast(
          `Shift "${shiftName.trim()}" added for ${getRoleDisplayName(targetRole)} (Position #${safeSortOrder}).`
        );
      }

      setIsShiftModalOpen(false);
      setEditingShiftId(null);
    } catch (err: any) {
      console.error('Error saving shift schedule:', err);
      showToast(err?.message || 'Failed to save shift schedule.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteShift = async () => {
    if (!deleteConfirmShift) return;
    const { id, name } = deleteConfirmShift;

    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('shift_schedules').delete().eq('id', id);
      if (error) {
        console.warn('Could not delete shift in database, updating locally:', error.message);
      }

      setShiftSchedules((prev) => prev.filter((s) => s.id !== id));
      showToast(`Shift schedule "${name}" removed.`);
    } catch (err) {
      console.error('Error deleting shift schedule:', err);
      showToast('Failed to delete shift schedule.', 'error');
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmShift(null);
    }
  };

  return (
    <AppLayoutShell
      title="Manage Access & Schedules"
      subtitle="Role-Based Access Control (RBAC) & Shift Schedule Timetable Configurations"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* ========================================================================= */}
        {/* 1. TOP TOGGLE BUTTON & TAB CONTROLS */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
          {/* Segmented Toggle Buttons */}
          <div className="flex bg-[#F1F5F9] p-1.5 rounded-full border border-[#E2E8F0]/70">
            <button
              type="button"
              onClick={() => setActiveTab('roles')}
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
              onClick={() => setActiveTab('shifts')}
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

          {/* Action Button: Add Role or Add Shift Schedule */}
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
                    selectedShiftRoleFilter !== 'ALL' ? selectedShiftRoleFilter : undefined
                  )
                }
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add Shift Schedule
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. TAB CONTENT: USER ROLES */}
        {/* ========================================================================= */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="roles-skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <RolesGridSkeleton />
                </motion.div>
              ) : (
                <motion.div
                  key="roles-content"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                  {roles.map((role, idx) => (
                    <motion.div
                      key={role.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.05 }}
                      className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 relative overflow-hidden group"
                    >
                      {/* Role Header */}
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-base font-bold text-[#1E293B]">{role.name}</h3>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                                role.badgeType === 'system'
                                  ? 'bg-blue-50 text-[#004AC6] border-blue-200'
                                  : role.badgeType === 'operational'
                                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {role.badge}
                            </span>
                            {role.isSystem && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                                Protected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#757680] mt-1 font-medium leading-relaxed">
                            {role.description || 'System access role definition'}
                          </p>
                        </div>

                        {/* Edit & Delete Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRoleModal(role)}
                            title="Edit Role"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#004AC6]/10 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!role.isSystem && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmRole(role)}
                              title="Delete Role"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Screen Access Badges */}
                      <div>
                        <p className="text-[11px] font-semibold text-[#757680] uppercase tracking-wider mb-2.5">
                          Screen Access Permissions
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {role.permissions.map((p) => {
                            const isGranted = p.level !== 'None';

                            return (
                              <span
                                key={p.screen}
                                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border transition-all ${
                                  isGranted
                                    ? 'bg-[#F8FAFC] text-[#1E293B] border-[#E2E8F0]'
                                    : 'bg-[#F8FAFC]/50 text-[#94A3B8] border-dashed border-[#CBD5E1] opacity-60'
                                }`}
                              >
                                {isGranted ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#004AC6]" />
                                ) : (
                                  <Ban className="w-3.5 h-3.5 text-[#94A3B8]" />
                                )}
                                <span>
                                  {p.screen}
                                  {p.level === 'View Only' && ' (View Only)'}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. TAB CONTENT: SHIFT SCHEDULE */}
        {/* ========================================================================= */}
        {activeTab === 'shifts' && (
          <div className="space-y-6">
            {/* Role Filter Toolbar: justify-between with 'Filter Role' and Dropdown */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 overflow-visible relative z-20">
              {/* Left: Filter Role Text & Details */}
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
                      {filteredShiftSchedules.length} {filteredShiftSchedules.length === 1 ? 'Shift' : 'Shifts'}
                    </span>
                  </div>
                  <p className="text-xs text-[#757680] font-medium">
                    {selectedShiftRoleFilter === 'ALL'
                      ? 'Viewing shift schedules across all configured roles'
                      : `Viewing shift schedules designated for ${getRoleDisplayName(selectedShiftRoleFilter)}`}
                  </p>
                </div>
              </div>

              {/* Right: Dropdown Filter */}
              <div className="w-full sm:w-64 shrink-0">
                <CustomDropdown
                  options={filterRoleDropdownOptions}
                  value={selectedShiftRoleFilter}
                  onChange={(val) => setSelectedShiftRoleFilter(val)}
                  placeholder="Select Role Filter"
                  leftIcon={<Filter className="w-3.5 h-3.5 text-[#004AC6]" />}
                  size="sm"
                  pill
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="shifts-skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ShiftsGridSkeleton />
                </motion.div>
              ) : filteredShiftSchedules.length === 0 ? (
                <motion.div
                  key="shifts-empty"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-12 text-center flex flex-col items-center justify-center gap-4 shadow-xs"
                >
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
                  <PrimaryButton
                    size="sm"
                    pill
                    onClick={() =>
                      handleOpenAddShiftModal(
                        selectedShiftRoleFilter !== 'ALL' ? selectedShiftRoleFilter : undefined
                      )
                    }
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Add Shift for {selectedShiftRoleFilter !== 'ALL' ? getRoleDisplayName(selectedShiftRoleFilter) : 'Role'}
                  </PrimaryButton>
                </motion.div>
              ) : (
                <motion.div
                  key="shifts-content"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {filteredShiftSchedules.map((shift, idx) => {
                    const durationText = calculateDuration(shift.startTime, shift.endTime) || shift.duration;

                    return (
                      <motion.div
                        key={shift.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.04 }}
                        className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 relative overflow-hidden group"
                      >
                        {/* Header: Shift Name, Active Badge & Target Role, Sort Order, Actions */}
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-[#1E293B]">{shift.name}</h3>
                              {shift.sortOrder != null && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-[#505F76] border border-slate-200 font-mono">
                                  Position #{shift.sortOrder}
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
                                {getRoleDisplayName(shift.targetRole)}
                              </span>
                            </div>
                          </div>

                          {/* Edit & Delete Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditShiftModal(shift)}
                              title="Edit Shift Schedule"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#004AC6]/10 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmShift(shift)}
                              title="Delete Shift Schedule"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Time Breakdown Card */}
                        <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0] space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {/* Start Shift */}
                            <div className="space-y-1">
                              <div className="text-[11px] font-semibold text-[#757680] uppercase tracking-wider">
                                Start Shift
                              </div>
                              <div className="text-sm font-bold text-[#1E293B] font-mono">
                                {formatTimeDisplay(shift.startTime)}
                              </div>
                            </div>

                            {/* End Shift */}
                            <div className="space-y-1">
                              <div className="text-[11px] font-semibold text-[#757680] uppercase tracking-wider">
                                End Shift
                              </div>
                              <div className="text-sm font-bold text-[#1E293B] font-mono">
                                {formatTimeDisplay(shift.endTime)}
                              </div>
                            </div>
                          </div>

                          {/* Duration Pill */}
                          <div className="pt-2 border-t border-[#E2E8F0]/80 flex items-center justify-between text-xs text-[#505F76]">
                            <span>Shift Duration:</span>
                            <span className="font-bold text-[#004AC6] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60 font-mono">
                              {durationText}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL: ADD / EDIT SHIFT SCHEDULE */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isShiftModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShiftModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Card Surface */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-lg overflow-visible z-10"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between rounded-t-3xl">
                <div>
                  <h2 className="text-lg font-bold text-[#1E293B]">
                    {editingShiftId ? 'Edit Shift Schedule' : 'Add Shift Schedule'}
                  </h2>
                  <p className="text-xs text-[#757680]">
                    Customize shift duration and timetable for {getRoleDisplayName(targetRole)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form Body */}
              <form onSubmit={handleSaveShiftSchedule} className="p-6 space-y-5">
                {/* 1. Shift Name */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="shiftName"
                    className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
                  >
                    Shift Name
                  </label>
                  <input
                    id="shiftName"
                    type="text"
                    required
                    value={shiftName}
                    onChange={(e) => setShiftName(e.target.value)}
                    placeholder="e.g., Morning Shift (Alpha), Swing Shift (Bravo)"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  />
                </div>

                {/* 2. Target Role Dropdown & Sort Order (Two Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Target Role Dropdown (2 cols) */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide flex items-center justify-between">
                      <span>Target Role</span>
                      <span className="text-[11px] text-[#94A3B8] font-medium lowercase">
                        What role is this for?
                      </span>
                    </label>
                    <CustomDropdown
                      options={roleDropdownOptions}
                      value={targetRole}
                      onChange={handleTargetRoleChange}
                      placeholder="Select Target Role"
                      leftIcon={<Shield className="w-4 h-4 text-[#004AC6]" />}
                      size="md"
                      pill
                    />
                  </div>

                  {/* Sort Order Input (1 col) */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="sortOrder"
                      className="text-xs font-semibold text-[#505F76] uppercase tracking-wide flex items-center justify-between"
                    >
                      <span>Sort Order</span>
                      <span className="text-[11px] text-[#94A3B8] font-medium">
                        Position #
                      </span>
                    </label>
                    <div className="relative">
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="sortOrder"
                        type="number"
                        min={1}
                        max={99}
                        required
                        value={sortOrder}
                        onChange={(e) => setSortOrder(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full pl-9 pr-3 py-2.5 text-sm text-[#1E293B] font-mono font-bold focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Dropdown Time Pickers: Start Shift & End Shift */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Start Shift Time Dropdown */}
                    <TimePickerDropdown
                      label="Start Shift"
                      value={startShiftTime}
                      onChange={(val) => setStartShiftTime(val)}
                    />

                    {/* End Shift Time Dropdown */}
                    <TimePickerDropdown
                      label="End Shift"
                      value={endShiftTime}
                      onChange={(val) => setEndShiftTime(val)}
                    />
                  </div>
                </div>

                {/* 4. Calculated Duration Preview Card */}
                <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-[#E2E8F0] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#505F76] block">
                      Calculated Shift Duration:
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      From {formatTimeDisplay(startShiftTime)} to {formatTimeDisplay(endShiftTime)}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[#004AC6] bg-white border border-[#E2E8F0] px-3 py-1 rounded-full shadow-2xs font-mono">
                    {calculateDuration(startShiftTime, endShiftTime) || '8 Hours'}
                  </span>
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                  <SecondaryButton
                    type="button"
                    size="md"
                    pill
                    onClick={() => setIsShiftModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </SecondaryButton>

                  <PrimaryButton
                    type="submit"
                    size="md"
                    pill
                    disabled={isSubmitting}
                    leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  >
                    {isSubmitting ? 'Saving...' : editingShiftId ? 'Save Changes' : 'Add Shift Schedule'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. MODAL: ADD / EDIT USER ROLE */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isRoleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRoleModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Card Surface */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden z-10"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1E293B]">
                    {editingRoleId ? 'Edit User Role' : 'Add New User Role'}
                  </h2>
                  <p className="text-xs text-[#757680]">Define access levels across core system screens</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form Body */}
              <form onSubmit={handleSaveRole} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                  {/* Role Name */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="roleName"
                      className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
                    >
                      Role Name
                    </label>
                    <input
                      id="roleName"
                      type="text"
                      required
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      placeholder="e.g., Tactical Officer, Logistics Lead"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                    />
                  </div>

                  {/* Role Description */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="roleDescription"
                      className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
                    >
                      Description
                    </label>
                    <input
                      id="roleDescription"
                      type="text"
                      value={roleDescription}
                      onChange={(e) => setRoleDescription(e.target.value)}
                      placeholder="e.g., Communications and field emergency dispatcher"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                    />
                  </div>

                  {/* Screen Access Permissions Section */}
                  <div>
                    <h3 className="text-sm font-bold text-[#1E293B] border-b border-[#E2E8F0] pb-2 mb-3">
                      Screen Access Permissions
                    </h3>

                    <div className="space-y-2">
                      {screenList.map((screenItem, index) => {
                        const Icon = screenItem.icon;
                        const currentLevel = permissions[screenItem.name] || 'None';

                        return (
                          <div
                            key={screenItem.name}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl transition-colors gap-2 ${
                              index % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'
                            } border border-transparent hover:border-[#E2E8F0]`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-4 h-4 text-[#004AC6]" />
                              <span className="text-sm font-semibold text-[#1E293B]">
                                {screenItem.name}
                              </span>
                            </div>

                            {/* Radio Group */}
                            <div className="flex items-center gap-4 text-xs">
                              {(['View Only', 'Full Access', 'None'] as const).map((level) => (
                                <label
                                  key={level}
                                  className="flex items-center gap-1.5 cursor-pointer text-[#505F76] hover:text-[#1E293B]"
                                >
                                  <input
                                    type="radio"
                                    name={`perm_${screenItem.name}`}
                                    checked={currentLevel === level}
                                    onChange={() => handlePermissionChange(screenItem.name, level)}
                                    className="text-[#004AC6] focus:ring-[#004AC6] h-3.5 w-3.5 cursor-pointer accent-[#004AC6]"
                                  />
                                  <span>{level}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
                  <SecondaryButton
                    type="button"
                    size="md"
                    pill
                    onClick={() => setIsRoleModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </SecondaryButton>

                  <PrimaryButton
                    type="submit"
                    size="md"
                    pill
                    disabled={isSubmitting}
                    leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  >
                    {isSubmitting ? 'Saving...' : editingRoleId ? 'Save Changes' : 'Create Role'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6. CONFIRM DELETE MODALS */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {(deleteConfirmRole || deleteConfirmShift) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setDeleteConfirmRole(null);
                setDeleteConfirmShift(null);
              }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-6 max-w-md w-full z-10 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">
                    {deleteConfirmRole ? 'Delete User Role' : 'Delete Shift Schedule'}
                  </h3>
                  <p className="text-xs text-[#757680]">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-[#505F76]">
                Are you sure you want to delete{' '}
                <span className="font-bold text-[#1E293B]">
                  &quot;{deleteConfirmRole?.name || deleteConfirmShift?.name}&quot;
                </span>
                ?
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <SecondaryButton
                  size="sm"
                  pill
                  onClick={() => {
                    setDeleteConfirmRole(null);
                    setDeleteConfirmShift(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </SecondaryButton>
                <button
                  type="button"
                  onClick={deleteConfirmRole ? handleConfirmDeleteRole : handleConfirmDeleteShift}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Delete</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. TOAST FEEDBACK NOTIFICATION */}
      {/* ========================================================================= */}
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
