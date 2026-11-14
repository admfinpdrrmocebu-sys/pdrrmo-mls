import type { CustomDropdownOption } from '@/components/input';

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
  assignment_type: 'duty' | 'rest' | 'travel';
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
  travelOrderPersonnel: OfficerAssignment[];
}

export interface EditDayAssignment {
  profileId: string;
  shiftScheduleId: string | null;
  assignmentType: 'duty' | 'rest' | 'travel';
  isLead: boolean;
}

export interface CalendarCellItem {
  date: Date;
  isCurrentMonth: boolean;
  isCurrentDay: boolean;
  schedule: DayDutySchedule;
}

export const roleFilterDropdownOptions: CustomDropdownOption[] = [
  { value: 'ALL', label: 'All Roles', badge: 'All', badgeColor: 'bg-slate-100 text-slate-700' },
  { value: 'admin', label: 'Admin', dotColor: '#004AC6', badge: 'System', badgeColor: 'bg-blue-50 text-[#004AC6]' },
  { value: 'monitoring', label: 'Monitoring', dotColor: '#0284C7', badge: 'Operational', badgeColor: 'bg-sky-50 text-sky-700' },
  { value: 'staff', label: 'Staff', dotColor: '#64748B', badge: 'Standard', badgeColor: 'bg-slate-100 text-slate-700' },
];

export function getInitials(name: string): string {
  if (!name) return 'OP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function matchesRole(officer: OfficerAssignment, filter: string): boolean {
  if (!filter || filter === 'ALL') return true;
  const f = filter.toLowerCase();
  const uRole = officer.userRole?.toLowerCase() || '';
  const pRole = officer.role?.toLowerCase() || '';
  return uRole === f || uRole.includes(f) || pRole.includes(f);
}

export function getRoleBadge(userRole?: string) {
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

export function broadcastShiftSync(): void {
  if (typeof window === 'undefined') return;
  try {
    const bc = new BroadcastChannel('pdrrmo_shift_sync');
    bc.postMessage({ type: 'shift_state_updated', timestamp: Date.now() });
    bc.close();
  } catch {
    // Ignore BroadcastChannel errors in restricted browsers
  }
  try {
    localStorage.setItem('pdrrmo_shift_sync', Date.now().toString());
  } catch {
    // Ignore storage access errors
  }
}

export function computeProfilesSignature(profiles: OfficerAssignment[]): string {
  return profiles
    .map(
      (p) =>
        `${p.id}:${p.name}:${p.role}:${p.userRole ?? ''}:${p.defaultShift}:${p.avatarUrl ?? ''}`
    )
    .join('|');
}

export function computeShiftSchedulesSignature(
  schedules: ShiftScheduleItem[]
): string {
  return schedules
    .map(
      (s) =>
        `${s.id}:${s.name}:${s.startTime ?? ''}:${s.endTime ?? ''}:${s.duration}:${
          s.color ?? ''
        }:${s.targetRole ?? ''}:${s.sortOrder ?? 0}`
    )
    .join('|');
}

export function computeAssignmentsSignature(
  records: DutyRosterAssignmentRecord[]
): string {
  return records
    .map(
      (a) =>
        `${a.id ?? ''}:${a.profile_id}:${a.duty_date}:${a.shift_schedule_id ?? ''}:${
          a.assignment_type
        }:${a.is_lead ? 1 : 0}:${a.notes ?? ''}`
    )
    .sort()
    .join('|');
}
