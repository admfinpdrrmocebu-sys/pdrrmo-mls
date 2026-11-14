'use client';

import { format } from 'date-fns';
import type { CustomDropdownOption } from '@/components/input';

export interface MunicipalityRow {
  id: string; // area id (UUID from public.areas)
  code: string;
  name: string;
  hasPort?: boolean;
  portName?: string;
  sortOrder?: number;
  isActive?: boolean;
  attendance: 'Present' | 'Absent' | 'Exempted' | null;
  weatherStatus: string | null;
  portStatus: string | null;
  timeResponded?: string | null;
}

export interface RollCallSessionRecord {
  id: string;
  session_date: string;
  session_time: string;
  frequency: string;
  radio_script: string;
  conducted_by?: string | null;
  conducted_by_name?: string;
  conducted_by_avatar?: string | null;
  conducted_by_role?: string | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  total_stations: number;
  present_count: number;
  absent_count: number;
  exempted_count: number;
  weather_summary?: string | null;
  created_at: string;
}

export interface RollCallHistorySession {
  id: string;
  session_date: string;
  session_time: string;
  frequency: string;
  conducted_by?: string | null;
  conducted_by_name?: string;
  conducted_by_avatar?: string | null;
  conducted_by_role?: string | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  total_stations: number;
  present_count: number;
  absent_count: number;
  exempted_count: number;
  weather_summary?: string | null;
  created_at: string;
  entries: {
    id: string;
    session_id: string;
    area_id: string;
    area_code: string;
    area_name: string;
    attendance: 'Present' | 'Absent' | 'Exempted' | null;
    weather_status?: string | null;
    port_status?: string | null;
    time_responded?: string | null;
    created_at?: string;
  }[];
}

export interface LGUAnalyticsSummary {
  id: string;
  code: string;
  name: string;
  hasPort: boolean;
  portName?: string;
  sortOrder: number;
  isActive: boolean;
  totalPresent: number;
  totalAbsent: number;
  totalExempted: number;
  totalSessions: number;
  attendanceRate: number; // 0 to 100
  latestWeather?: string | null;
  latestPortStatus?: string | null;
  lastModeratorName?: string;
  lastModeratorAvatar?: string | null;
  lastModeratorRole?: string | null;
  lastFrequency?: string;
  lastSessionDate?: string | null;
  lastSessionTime?: string | null;
  presentRecords: {
    id: string;
    sessionId: string;
    sessionDate: string;
    sessionTime: string;
    weatherStatus?: string | null;
    portStatus?: string | null;
    timeResponded?: string | null;
    conductedByName?: string;
    conductedByAvatar?: string | null;
    frequency?: string;
  }[];
  absentRecords: {
    id: string;
    sessionId: string;
    sessionDate: string;
    sessionTime: string;
    conductedByName?: string;
    conductedByAvatar?: string | null;
    frequency?: string;
  }[];
  trendData: {
    sessionLabel: string;
    date: string;
    time: string;
    attendance: 'Present' | 'Absent' | 'Exempted' | 'No Record';
    value: number;
    presentScore: number;
    absentScore: number;
    conductedBy?: string;
  }[];
}

export interface RollCallAlertBanner {
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  incompleteStations?: string[];
}

export interface RollCallSavedSummary {
  id: string;
  date: string;
  time: string;
  present: number;
  absent: number;
  exempted: number;
  total: number;
  filename: string;
}

export interface RollCallSaveToast {
  title: string;
  subtitle: string;
}

export interface EditLguFormState {
  name: string;
  code: string;
  hasPort: boolean;
  portName: string;
}

export const weatherDropdownOptions: CustomDropdownOption[] = [
  { value: 'Clear', label: 'Clear', dotColor: '#059669', badge: 'Optimal', badgeColor: 'bg-emerald-50 text-emerald-700' },
  { value: 'Fair', label: 'Fair', dotColor: '#10B981', badge: 'Fair', badgeColor: 'bg-emerald-50 text-emerald-700' },
  { value: 'Cloudy', label: 'Cloudy', dotColor: '#64748B', badge: 'Overcast', badgeColor: 'bg-slate-100 text-[#505F76]' },
  { value: 'Light Rain', label: 'Light Rain', dotColor: '#0EA5E9', badge: 'Light', badgeColor: 'bg-sky-50 text-sky-700' },
  { value: 'Moderate Rain', label: 'Moderate Rain', dotColor: '#F59E0B', badge: 'Moderate', badgeColor: 'bg-amber-50 text-amber-800' },
  { value: 'Heavy Rain', label: 'Heavy Rain', dotColor: '#EA580C', badge: 'Heavy', badgeColor: 'bg-orange-50 text-orange-800' },
  { value: 'Stormy', label: 'Stormy', dotColor: '#DC2626', badge: 'Severe', badgeColor: 'bg-rose-50 text-rose-700' },
];

export const portDropdownOptions: CustomDropdownOption[] = [
  { value: 'Operational', label: 'Operational', dotColor: '#059669', badge: 'Active', badgeColor: 'bg-emerald-50 text-emerald-700' },
  { value: 'Limited', label: 'Limited', dotColor: '#D97706', badge: 'Restricted', badgeColor: 'bg-amber-50 text-amber-800' },
  { value: 'Suspended', label: 'Suspended', dotColor: '#DC2626', badge: 'Closed', badgeColor: 'bg-rose-50 text-rose-700' },
  { value: 'None', label: 'No Port / Inland', dotColor: '#94A3B8', badge: 'N/A', badgeColor: 'bg-slate-100 text-[#505F76]' },
];

export function getInitials(name: string): string {
  if (!name) return 'MO';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function formatRollCallStartTime(session: RollCallSessionRecord | null): string {
  if (!session) return '';
  if (session.created_at) {
    try {
      const d = new Date(session.created_at);
      if (!isNaN(d.getTime())) {
        return format(d, 'h:mm a');
      }
    } catch {
      // Fall back to formatted session_time below
    }
  }
  if (session.session_time) {
    const cleaned = session.session_time.replace(/[^0-9:]/g, '');
    if (cleaned.includes(':')) {
      const [h, m] = cleaned.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const dummy = new Date();
        dummy.setHours(h, m, 0, 0);
        return format(dummy, 'h:mm a');
      }
    }
    return session.session_time;
  }
  return 'Recently';
}

export function getMilitaryTime(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}H`;
}

export function isRowComplete(mun: MunicipalityRow): boolean {
  if (!mun.attendance) return false;
  if (mun.attendance === 'Absent' || mun.attendance === 'Exempted') return true;
  if (mun.attendance === 'Present') {
    const hasWeather = Boolean(mun.weatherStatus && mun.weatherStatus !== 'N/A');
    const hasPortRequirement = !mun.hasPort || Boolean(mun.portStatus && mun.portStatus !== 'N/A');
    return hasWeather && hasPortRequirement;
  }
  return false;
}
