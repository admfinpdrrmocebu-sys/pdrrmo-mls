import { format } from 'date-fns';

export interface LogEntry {
  id: string;
  shift_id?: string | null;
  time: string;
  date: string;
  status: 'Critical' | 'Warning' | 'Active' | 'Info';
  title: string;
  reportType: string;
  reportTypeId?: string | null;
  description: string;
  operator: string;
  operatorId?: string | null;
  operatorRole?: string | null;
  operatorShift?: string | null;
  shiftLabel?: string | null;
  shiftDate?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  shiftStatus?: 'active' | 'completed' | 'cancelled' | null;
  createdAt?: string;
}

export interface DutyPersonnel {
  id: string;
  name: string;
  role: string;
  avatarInitials: string;
  badgeNumber: string;
  avatarUrl?: string | null;
  defaultShift?: string | null;
}

export interface ActiveShiftRecord {
  id: string;
  shift_label: string;
  shift_date: string;
  start_time: string;
  end_time?: string | null;
  status: 'active' | 'completed' | 'cancelled';
  lead_officer_id: string;
  lead_officer_name?: string;
  lead_officer_avatar?: string | null;
  lead_officer_role?: string | null;
  start_monitoring_details?: string | null;
  started_at: string;
  personnel: DutyPersonnel[];
}

export interface ShiftScheduleItem {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  duration: string;
  color?: string;
  is_active: boolean;
  sort_order?: number;
}

export interface ShiftToastState {
  message: string;
  submessage?: string;
  type: 'start' | 'end' | 'info';
}

export interface ScheduleEligibility {
  isEligible: boolean;
  scheduleName: string;
  scheduleHours: string;
  reason: string | null;
}

export interface ActiveShiftScheduleInfo {
  name: string;
  time: string;
  item: ShiftScheduleItem | null;
}

export const DEFAULT_MONITORING_DETAILS =
  '<ul><li>Coastal and inland telemetry stations operating normally</li><li>Weather radar scanning for localized precipitation</li><li><strong>142.500 MHz</strong> primary emergency frequency monitoring active</li></ul>';

export const fallbackPersonnelList: DutyPersonnel[] = [
  {
    id: 'p-1',
    name: 'Alex Thompson',
    role: 'System Admin / Lead Officer',
    avatarInitials: 'AT',
    badgeNumber: 'OPC-1001',
    defaultShift: 'Day Shift (Alpha)',
  },
  {
    id: 'p-2',
    name: 'Supervisor Elena Cruz',
    role: 'Chief Dispatch Operations',
    avatarInitials: 'EC',
    badgeNumber: 'OPC-1042',
    defaultShift: 'Day Shift (Alpha)',
  },
  {
    id: 'p-3',
    name: 'Mark Salazar',
    role: 'SecOps Node #04 Responder',
    avatarInitials: 'MS',
    badgeNumber: 'OPC-8821',
    defaultShift: 'Day Shift (Alpha)',
  },
  {
    id: 'p-4',
    name: 'Sarah Jenkins',
    role: 'Telemetry & Radio Operator',
    avatarInitials: 'SJ',
    badgeNumber: 'OPC-3012',
    defaultShift: 'Swing Shift (Bravo)',
  },
  {
    id: 'p-5',
    name: 'David Tan',
    role: 'Emergency Dispatcher',
    avatarInitials: 'DT',
    badgeNumber: 'OPC-2045',
    defaultShift: 'Swing Shift (Bravo)',
  },
  {
    id: 'p-6',
    name: 'Maria Santos',
    role: 'Communications Specialist',
    avatarInitials: 'MS',
    badgeNumber: 'OPC-4109',
    defaultShift: 'Graveyard Shift (Charlie)',
  },
];

export const fallbackSchedules: ShiftScheduleItem[] = [
  {
    id: 'sched-1',
    name: 'Day Shift (Alpha)',
    start_time: '06:00',
    end_time: '14:00',
    duration: '8 Hours',
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'sched-2',
    name: 'Swing Shift (Bravo)',
    start_time: '14:00',
    end_time: '22:00',
    duration: '8 Hours',
    is_active: true,
    sort_order: 2,
  },
  {
    id: 'sched-3',
    name: 'Graveyard Shift (Charlie)',
    start_time: '22:00',
    end_time: '06:00',
    duration: '8 Hours',
    is_active: true,
    sort_order: 3,
  },
];

export function getInitials(name: string): string {
  if (!name) return 'MO';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function formatShiftStartTime(shift: ActiveShiftRecord | null): string {
  if (!shift) return '';
  if (shift.started_at) {
    try {
      const d = new Date(shift.started_at);
      if (!isNaN(d.getTime())) {
        return format(d, 'h:mm a');
      }
    } catch {
      // Fallback to start_time below
    }
  }
  if (shift.start_time) {
    const cleaned = shift.start_time.replace(/[^0-9:]/g, '');
    if (cleaned.includes(':')) {
      const [h, m] = cleaned.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const dummy = new Date();
        dummy.setHours(h, m, 0, 0);
        return format(dummy, 'h:mm a');
      }
    }
    return shift.start_time;
  }
  return 'Recently';
}

export function getMilitaryTime(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}H`;
}
