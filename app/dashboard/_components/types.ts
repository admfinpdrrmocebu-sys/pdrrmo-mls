import { format } from 'date-fns';

export type DashboardTimeRange = 'Last 24 Hours' | 'Last 7 Days' | 'Last 30 Days';

export interface ActiveShiftInfo {
  id: string;
  shift_label: string;
  lead_officer_name: string;
  lead_officer_role?: string;
  lead_officer_avatar?: string | null;
  started_at: string;
  start_time?: string;
  status: 'active' | 'inactive';
}

export interface ShiftLogRow {
  id: string;
  title: string;
  report_type_name: string;
  log_date: string;
  log_time: string;
  created_at: string;
}

export interface RollCallSessionRow {
  id: string;
  session_date: string;
  session_time: string;
  present_count: number;
  absent_count: number;
  exempted_count: number;
  total_stations: number;
  created_at: string;
}

export interface ReportTypeRow {
  id: string;
  name: string;
  code: string;
  color: string;
}

export interface DistributionItem {
  name: string;
  value: number;
  color: string;
  count: number;
}

export interface ActivityTrendPoint {
  time: string;
  logs: number;
}

export interface RollCallAttendancePoint {
  day: string;
  date: string;
  attendance: number;
  stations: number;
}

export const DEFAULT_COLORS = [
  '#004AC6',
  '#60A5FA',
  '#505F76',
  '#E11D48',
  '#D97706',
  '#059669',
  '#7C3AED',
  '#943700',
  '#CBD5E1',
];

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i] || 'MB'}`;
}

export function parseLogHour(logTime: string, createdAt: string): number {
  if (logTime) {
    const clean = logTime.replace(/H$/i, '').trim();
    if (clean.includes(':')) {
      const h = parseInt(clean.split(':')[0], 10);
      if (!isNaN(h)) return h;
    }
    if (clean.length === 4) {
      const h = parseInt(clean.slice(0, 2), 10);
      if (!isNaN(h)) return h;
    }
  }
  if (createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      return d.getHours();
    }
  }
  return 12;
}

export function getInitials(name: string): string {
  if (!name) return 'MO';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function formatShiftStartTime(startedAt?: string | null, startTime?: string | null): string {
  if (startedAt) {
    try {
      const d = new Date(startedAt);
      if (!isNaN(d.getTime())) {
        return format(d, 'h:mm a');
      }
    } catch {
      // Ignore format error
    }
  }
  if (startTime) {
    const cleaned = startTime.replace(/H$/i, '').trim();
    if (cleaned.includes(':')) {
      const [h, m] = cleaned.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const dummy = new Date();
        dummy.setHours(h, m, 0, 0);
        return format(dummy, 'h:mm a');
      }
    }
    return startTime;
  }
  return 'Recently';
}
