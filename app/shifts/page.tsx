'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  MapPin,
  LocateFixed,
  LogIn,
  LogOut,
  Compass,
  Plane,
  Search,
  User,
  Mail,
  Building2,
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
import { LocationAccessBanner } from '@/components/location-access-modal';
import {
  GeofenceConfig,
  DEFAULT_GEOFENCE_CONFIG,
  UserCoordinates,
  checkGeofenceCoverage,
  formatDistance,
  getUserCoordinates,
  loadGeofenceCache,
  saveGeofenceCache,
} from '@/lib/geo/geofence';

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
  email?: string | null;
  division?: string;
  station: string;
  defaultShift?: string;
  avatarUrl?: string | null;
  isLead?: boolean;
  isTravelOrder?: boolean;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  attendanceStatus?: 'checked_in' | 'checked_out' | 'absent';
  isLate?: boolean;
  unclosedFromDate?: string | null;
  assignedStartTime?: string | null;
}

export interface DutyAttendanceRecord {
  id?: string;
  profile_id: string;
  duty_date: string;
  shift_schedule_id?: string | null;
  geofence_id?: string | null;
  check_in_time: string;
  check_out_time?: string | null;
  status: 'checked_in' | 'checked_out';
  notes?: string | null;
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

export interface ActiveShiftRecord {
  id: string;
  shift_label: string;
  shift_date: string;
  start_time: string;
  end_time?: string | null;
  status: 'active' | 'completed' | 'cancelled';
  lead_officer_id: string;
  start_monitoring_details?: string | null;
  started_at: string;
  ended_at?: string | null;
}

export interface ShiftDutyPersonnelRecord {
  id?: string;
  shift_id: string;
  profile_id: string;
  role_in_shift?: string | null;
  is_lead: boolean;
  present_at_end: boolean;
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
  { value: 'ALL', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'staff', label: 'Staff' },
];

const attendanceFilterDropdownOptions: CustomDropdownOption[] = [
  { value: 'ALL', label: 'All Attendance' },
  { value: 'ON_TIME', label: 'On Time' },
  { value: 'LATE', label: 'Late' },
  { value: 'TRAVEL_ORDER', label: 'Travel Order' },
];

function parseLocalDateParts(
  dateStr?: string | null
): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

function formatDutyDateShort(dateStr?: string | null): string {
  const parts = parseLocalDateParts(dateStr);
  if (!parts) return dateStr || '';
  return format(new Date(parts.year, parts.month, parts.day), 'MMM d');
}

function parseScheduleTimeParts(
  timeStr?: string | null
): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) return null;

  if (!meridiem && hours === 24 && minutes === 0) {
    return { hours: 0, minutes: 0 };
  }
  if (meridiem === 'PM' && hours < 12) {
    hours += 12;
  } else if (meridiem === 'AM' && hours === 12) {
    hours = 0;
  }
  if (hours < 0 || hours > 23) return null;
  return { hours, minutes };
}

// Strict 0-minute grace period: checking in past startHours:startMinutes:59.999 is Late
function computeIsOfficerLate(
  checkInIso?: string | null,
  dutyDateStr?: string | null,
  startTimeStr?: string | null,
  endTimeStr?: string | null
): boolean {
  if (!checkInIso || !dutyDateStr || !startTimeStr) return false;
  const checkInDate = new Date(checkInIso);
  if (isNaN(checkInDate.getTime())) return false;

  const dateParts = parseLocalDateParts(dutyDateStr);
  const startParts = parseScheduleTimeParts(startTimeStr);
  if (!dateParts || !startParts) return false;

  const endParts = parseScheduleTimeParts(endTimeStr);
  const startM = startParts.hours * 60 + startParts.minutes;
  const endM = endParts ? endParts.hours * 60 + endParts.minutes : null;

  let dayOffset = 0;
  // If overnight shift (startM > endM) and officer checked in after midnight (before endM) on dutyDateStr,
  // the scheduled shift actually started on the previous calendar evening.
  if (endM !== null && startM > endM) {
    const checkInLocalKey = format(checkInDate, 'yyyy-MM-dd');
    const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
    if (checkInLocalKey === dutyDateStr && checkInMinutes < endM) {
      dayOffset = -1;
    }
  }

  const scheduledStartLimit = new Date(
    dateParts.year,
    dateParts.month,
    dateParts.day + dayOffset,
    startParts.hours,
    startParts.minutes,
    59,
    999
  );

  return checkInDate.getTime() > scheduledStartLimit.getTime();
}

// Check Out unlocks 30 minutes before assigned shift end_time
function computeCheckOutUnlockTime(
  dutyDateStr?: string | null,
  startTimeStr?: string | null,
  endTimeStr?: string | null,
  checkInIso?: string | null
): Date | null {
  if (!dutyDateStr || !endTimeStr) return null;
  const dateParts = parseLocalDateParts(dutyDateStr);
  const endParts = parseScheduleTimeParts(endTimeStr);
  if (!dateParts || !endParts) return null;

  const startParts = parseScheduleTimeParts(startTimeStr);
  const startM = startParts ? startParts.hours * 60 + startParts.minutes : null;
  const endM = endParts.hours * 60 + endParts.minutes;

  let endDayOffset = 0;
  if (startM !== null && endM <= startM) {
    // Overnight shift spanning midnight: ends on day + 1 unless check-in occurred post-midnight on dutyDateStr
    endDayOffset = 1;
    if (checkInIso) {
      const checkInDate = new Date(checkInIso);
      if (!isNaN(checkInDate.getTime())) {
        const checkInLocalKey = format(checkInDate, 'yyyy-MM-dd');
        const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
        if (checkInLocalKey === dutyDateStr && checkInMinutes < endM) {
          endDayOffset = 0;
        }
      }
    }
  }

  const shiftEndDate = new Date(
    dateParts.year,
    dateParts.month,
    dateParts.day + endDayOffset,
    endParts.hours,
    endParts.minutes,
    0,
    0
  );

  return new Date(shiftEndDate.getTime() - 30 * 60 * 1000);
}

// Helper to determine the current active shift schedule based on current time
function getLiveShiftSchedule(
  schedules: ShiftScheduleItem[],
  now: Date = new Date()
): ShiftScheduleItem | null {
  if (!schedules || schedules.length === 0) return null;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const s of schedules) {
    const startParts = parseScheduleTimeParts(s.startTime);
    const endParts = parseScheduleTimeParts(s.endTime);
    if (!startParts || !endParts) continue;

    const startM = startParts.hours * 60 + startParts.minutes;
    const endM = endParts.hours * 60 + endParts.minutes;

    if (startM < endM) {
      if (currentMinutes >= startM && currentMinutes < endM) {
        return s;
      }
    } else if (startM > endM) {
      // Overnight shift spanning midnight
      if (currentMinutes >= startM || currentMinutes < endM) {
        return s;
      }
    } else {
      return s;
    }
  }

  return schedules[0];
}

// =============================================================================
// =============================================================================
// OFFICER AVATAR COMPONENT WITH REAL PROFILE PICTURE & INITIALS FALLBACK
// =============================================================================
interface OfficerAvatarProps {
  officer?: {
    name?: string;
    avatarUrl?: string | null;
    avatarInitials?: string;
    userRole?: string;
  } | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallbackBg?: string;
  className?: string;
}

function OfficerAvatar({
  officer,
  size = 'md',
  fallbackBg,
  className = '',
}: OfficerAvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [officer?.avatarUrl]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-14 h-14 text-base',
  };

  const hasImage = Boolean(officer?.avatarUrl && !imgError);
  const initials = officer?.avatarInitials || getInitials(officer?.name || 'OP');
  const defaultBg = fallbackBg || 'bg-[#004AC6] text-white';

  if (hasImage) {
    return (
      <img
        src={officer!.avatarUrl!}
        alt={officer?.name || 'Officer Avatar'}
        onError={() => setImgError(true)}
        className={`${sizeClasses[size]} rounded-full object-cover border border-[#E2E8F0] shadow-xs shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full font-bold flex items-center justify-center shadow-xs shrink-0 select-none ${defaultBg} ${className}`}
    >
      {initials}
    </div>
  );
}

// =============================================================================
// MEMOIZED SUB-COMPONENTS (HYBRID REALTIME & RENDERING OPTIMIZATION)
// =============================================================================

export interface PresentOfficerCardProps {
  member: OfficerMember;
  onSelect?: (member: OfficerMember) => void;
  isClickable?: boolean;
}

export const PresentOfficerCard = React.memo(
  function PresentOfficerCard({ member, onSelect, isClickable = false }: PresentOfficerCardProps) {
    const formattedCheckIn = useMemo(() => {
      if (!member.checkInTime) return null;
      const d = new Date(member.checkInTime);
      if (isNaN(d.getTime())) return null;
      if (member.unclosedFromDate) {
        return `${formatDutyDateShort(member.unclosedFromDate)}, ${format(d, 'hh:mm a')}`;
      }
      return format(d, 'hh:mm a');
    }, [member.checkInTime, member.unclosedFromDate]);

    return (
      <div
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? () => onSelect?.(member) : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(member);
                }
              }
            : undefined
        }
        className={`group p-3.5 rounded-2xl border border-[#E2E8F0] bg-white transition-all shadow-2xs flex items-center justify-between gap-3 ${
          isClickable
            ? 'cursor-pointer hover:border-[#004AC6]/50 hover:shadow-xs active:scale-[0.99] select-none'
            : 'hover:border-[#CBD5E1]'
        }`}
        title={isClickable ? `Click to view profile & attendance details for ${member.name}` : undefined}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <OfficerAvatar officer={member} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs sm:text-sm font-bold text-[#1E293B] truncate group-hover:text-[#004AC6] transition-colors">
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
              {formattedCheckIn ? ` · In ${formattedCheckIn}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {member.isLate && !member.isTravelOrder && (
            <span className="text-[9px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 shadow-2xs">
              <Clock className="w-2.5 h-2.5" />
              Late
            </span>
          )}
          {member.isTravelOrder && (
            <span className="text-[9px] font-bold bg-purple-500/15 text-purple-700 border border-purple-300/80 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
              <Plane className="w-2.5 h-2.5" />
              Travel Order
            </span>
          )}
          {isClickable && (
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#004AC6] group-hover:translate-x-0.5 transition-all shrink-0 ml-0.5" />
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.member.id === next.member.id &&
      prev.member.name === next.member.name &&
      prev.member.role === next.member.role &&
      prev.member.isLead === next.member.isLead &&
      prev.member.isTravelOrder === next.member.isTravelOrder &&
      prev.member.isLate === next.member.isLate &&
      prev.member.checkInTime === next.member.checkInTime &&
      prev.member.unclosedFromDate === next.member.unclosedFromDate &&
      prev.member.avatarUrl === next.member.avatarUrl &&
      prev.member.userRole === next.member.userRole &&
      prev.isClickable === next.isClickable &&
      prev.onSelect === next.onSelect
    );
  }
);

export interface AbsentOfficerCardProps {
  person: OfficerMember;
  onSelect?: (person: OfficerMember) => void;
  isClickable?: boolean;
}

export const AbsentOfficerCard = React.memo(
  function AbsentOfficerCard({ person, onSelect, isClickable = false }: AbsentOfficerCardProps) {
    return (
      <div
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? () => onSelect?.(person) : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(person);
                }
              }
            : undefined
        }
        className={`group p-3.5 rounded-2xl border border-rose-200 bg-rose-50/40 shadow-2xs flex items-center justify-between gap-3 transition-all ${
          isClickable
            ? 'cursor-pointer hover:border-rose-400 hover:shadow-xs active:scale-[0.99] select-none'
            : ''
        }`}
        title={isClickable ? `Click to view profile & attendance details for ${person.name}` : undefined}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <OfficerAvatar officer={person} size="md" fallbackBg="bg-rose-600 text-white" />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-[#1E293B] truncate group-hover:text-rose-700 transition-colors">
              {person.name}
            </h4>
            <p className="text-[11px] text-rose-700 truncate font-medium">
              {person.role}
            </p>
          </div>
        </div>
        {isClickable && (
          <ChevronRight className="w-4 h-4 text-rose-300 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all shrink-0" />
        )}
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.person.id === next.person.id &&
      prev.person.name === next.person.name &&
      prev.person.role === next.person.role &&
      prev.person.avatarUrl === next.person.avatarUrl &&
      prev.person.userRole === next.person.userRole &&
      prev.isClickable === next.isClickable &&
      prev.onSelect === next.onSelect
    );
  }
);

export interface RestDayOfficerCardProps {
  person: OfficerMember;
  onSelect?: (person: OfficerMember) => void;
  isClickable?: boolean;
}

export const RestDayOfficerCard = React.memo(
  function RestDayOfficerCard({ person, onSelect, isClickable = false }: RestDayOfficerCardProps) {
    return (
      <div
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? () => onSelect?.(person) : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(person);
                }
              }
            : undefined
        }
        className={`group p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 shadow-2xs transition-all ${
          isClickable
            ? 'cursor-pointer hover:border-slate-400 hover:shadow-xs active:scale-[0.99] select-none'
            : ''
        }`}
        title={isClickable ? `Click to view profile & attendance details for ${person.name}` : undefined}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <OfficerAvatar officer={person} size="sm" fallbackBg="bg-slate-200 text-slate-700" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#1E293B] truncate group-hover:text-[#004AC6] transition-colors">{person.name}</p>
            <p className="text-[11px] text-[#757680] truncate">{person.role}</p>
          </div>
        </div>
        {isClickable && (
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
        )}
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.person.id === next.person.id &&
      prev.person.name === next.person.name &&
      prev.person.role === next.person.role &&
      prev.person.avatarUrl === next.person.avatarUrl &&
      prev.person.userRole === next.person.userRole &&
      prev.isClickable === next.isClickable &&
      prev.onSelect === next.onSelect
    );
  }
);

/**
 * Optimized Paginated Personnel List:
 * - Maximum 5 personnel per page
 * - Simple '<' and '>' controls
 * - Lazy Page Mounting: Data is NOT rendered if not viewed yet
 * - Persistent Page Nodes: Once viewed, pages remain in the DOM so they do NOT re-render
 */
export function PaginatedPersonnelList<T extends { id: string }>({
  items,
  pageSize = 5,
  page,
  onPageChange,
  renderItem,
  emptyState,
  containerClassName = 'space-y-3',
}: {
  items: T[];
  pageSize?: number;
  page: number;
  onPageChange: (newPage: number) => void;
  renderItem: (item: T) => React.ReactNode;
  emptyState: React.ReactNode;
  containerClassName?: string;
}) {
  const [visitedPages, setVisitedPages] = useState<Set<number>>(() => new Set([1]));

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  // If item IDs change (e.g. role filter changed, item removed/added), reset visited pages to current page
  const itemsSignature = useMemo(() => items.map((i) => i.id).join(','), [items]);
  useEffect(() => {
    setVisitedPages(new Set([safePage]));
  }, [itemsSignature, safePage]);

  // Track newly visited page
  useEffect(() => {
    setVisitedPages((prev) => {
      if (prev.has(safePage)) return prev;
      const next = new Set(prev);
      next.add(safePage);
      return next;
    });
  }, [safePage]);

  // Pre-chunk into pages of max 5
  const pagesData = useMemo(() => {
    const chunks: T[][] = [];
    for (let p = 0; p < totalPages; p++) {
      chunks.push(items.slice(p * pageSize, (p + 1) * pageSize));
    }
    return chunks;
  }, [items, totalPages, pageSize]);

  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  const startIdx = (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, items.length);

  return (
    <div className="flex flex-col flex-1 min-h-0 justify-between">
      {/* Pages Container: Only pages that have been viewed are rendered in the DOM */}
      <div className={containerClassName}>
        {pagesData.map((pageItems, idx) => {
          const pageNum = idx + 1;
          // Unviewed pages are NOT rendered in the DOM
          if (!visitedPages.has(pageNum)) {
            return null;
          }

          const isActive = pageNum === safePage;
          return (
            <div
              key={pageNum}
              className={isActive ? containerClassName : 'hidden'}
              aria-hidden={!isActive}
            >
              {pageItems.map((item) => renderItem(item))}
            </div>
          );
        })}
      </div>

      {/* Pagination Bar (< 1 / 3 >) */}
      {totalPages > 1 && (
        <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#757680] mt-3 shrink-0 select-none">
          <span className="text-[11px] font-medium font-mono text-[#757680]">
            {startIdx}–{endIdx} of {items.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E2E8F0] bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-[#1E293B] transition-colors shadow-2xs"
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-[#1E293B] px-1 font-mono min-w-9 text-center select-none">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E2E8F0] bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-[#1E293B] transition-colors shadow-2xs"
              aria-label="Next page"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface CalendarDayCellProps {
  cell: {
    date: Date;
    isCurrentMonth: boolean;
    isCurrentDay: boolean;
    isSelected: boolean;
    assignment: {
      type: 'DUTY' | 'REST' | 'TRAVEL' | 'NONE';
      shift?: ShiftScheduleItem | null;
      isLead?: boolean;
    };
  };
  onSelectDate: (date: Date) => void;
}

export const CalendarDayCell = React.memo(function CalendarDayCell({ cell, onSelectDate }: CalendarDayCellProps) {
  const isDuty = cell.assignment.type === 'DUTY';
  const isRest = cell.assignment.type === 'REST';
  const isTravel = cell.assignment.type === 'TRAVEL';
  const shiftColor = cell.assignment.shift?.color || '#004AC6';

  return (
    <button
      type="button"
      onClick={() => onSelectDate(cell.date)}
      className={`min-h-[52px] sm:min-h-[85px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl text-left border flex flex-col justify-between transition-all cursor-pointer relative ${
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
          <span className="hidden sm:inline text-[9px] font-bold text-[#004AC6]">Today</span>
        )}
      </div>

      {/* Shift Badge on Day */}
      <div className="mt-1 w-full">
        {isDuty ? (
          <>
            {/* Mobile screen: colored circle indicator */}
            <div className="flex justify-center sm:hidden py-0.5">
              <span
                style={{ backgroundColor: shiftColor }}
                className="w-2.5 h-2.5 rounded-full shadow-2xs"
              />
            </div>
            {/* PC screen: badge with shift name */}
            <div
              style={{
                color: shiftColor,
                backgroundColor: `${shiftColor}15`,
                borderColor: `${shiftColor}30`,
              }}
              className="hidden sm:block px-1.5 py-0.5 rounded-lg text-[10px] font-bold border leading-tight truncate"
            >
              {cell.assignment.shift?.name ? cell.assignment.shift.name.split(' ')[0] : 'Duty'}
            </div>
          </>
        ) : isRest ? (
          <>
            {/* Mobile screen: colored circle indicator */}
            <div className="flex justify-center sm:hidden py-0.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-2xs" />
            </div>
            {/* PC screen: badge with Rest Day */}
            <div className="hidden sm:block px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60 leading-tight truncate">
              Rest Day
            </div>
          </>
        ) : isTravel ? (
          <>
            {/* Mobile screen: colored circle indicator */}
            <div className="flex justify-center sm:hidden py-0.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shadow-2xs" />
            </div>
            {/* PC screen: badge with Travel Order */}
            <div className="hidden sm:block px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-purple-500/15 text-purple-700 border border-purple-300/60 leading-tight truncate">
              Travel Order
            </div>
          </>
        ) : (
          <div className="hidden sm:block text-[10px] text-slate-300 italic px-1">
            —
          </div>
        )}
      </div>
    </button>
  );
}, (prev, next) => {
  return (
    prev.cell.isSelected === next.cell.isSelected &&
    prev.cell.isCurrentMonth === next.cell.isCurrentMonth &&
    prev.cell.isCurrentDay === next.cell.isCurrentDay &&
    prev.cell.date.getTime() === next.cell.date.getTime() &&
    prev.cell.assignment.type === next.cell.assignment.type &&
    prev.cell.assignment.shift?.id === next.cell.assignment.shift?.id &&
    prev.cell.assignment.shift?.name === next.cell.assignment.shift?.name &&
    prev.cell.assignment.shift?.color === next.cell.assignment.shift?.color &&
    prev.cell.assignment.isLead === next.cell.assignment.isLead &&
    prev.onSelectDate === next.onSelectDate
  );
});

interface DutyInspectorContentProps {
  selectedDate: Date;
  selectedDayInfo: {
    assignment: {
      type: 'DUTY' | 'REST' | 'TRAVEL' | 'NONE';
      shift?: {
        id?: string;
        name: string;
        color?: string;
        duration?: string;
        time?: string;
      } | null;
      isLead?: boolean;
    };
    teammates: OfficerMember[];
  };
  onClose?: () => void;
  isModal?: boolean;
}

export const DutyInspectorContent = React.memo(function DutyInspectorContent({
  selectedDate,
  selectedDayInfo,
  onClose,
  isModal = false,
}: DutyInspectorContentProps) {
  const [teammatePage, setTeammatePage] = useState<number>(1);

  // Reset pagination when selectedDate or assigned shift changes
  useEffect(() => {
    setTeammatePage(1);
  }, [selectedDate, selectedDayInfo.assignment.shift?.id]);

  return (
    <div className={isModal ? 'flex flex-col h-full overflow-hidden' : 'space-y-5'}>
      {/* Header */}
      <div className={`pb-3 border-b border-[#E2E8F0] ${isModal ? 'p-5 bg-slate-50/70 flex items-start justify-between shrink-0' : ''}`}>
        <div>
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
        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-100 text-[#505F76] transition-colors cursor-pointer shadow-2xs"
            aria-label="Close Inspector"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className={isModal ? 'p-5 flex-1 overflow-y-auto space-y-5' : 'space-y-5'}>
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
              <PaginatedPersonnelList<OfficerMember>
                items={selectedDayInfo.teammates}
                pageSize={5}
                page={teammatePage}
                onPageChange={setTeammatePage}
                containerClassName="space-y-1.5"
                renderItem={(mate) => (
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
                  </div>
                )}
                emptyState={
                  <div className="py-2 text-center text-xs text-slate-400 italic">
                    No other teammates assigned to this shift on this date.
                  </div>
                }
              />
            </div>
          </div>
        ) : selectedDayInfo.assignment.type === 'TRAVEL' ? (
          <div className="p-6 rounded-2xl bg-purple-500/10 border border-purple-300/60 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-purple-500/15 text-purple-700 border border-purple-300/60 flex items-center justify-center mx-auto">
              <Plane className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1E293B]">Official Travel Order</h4>
              <p className="text-xs text-purple-700 font-medium mt-1">
                You are on official business / travel order for this date.
              </p>
              <span className="inline-block mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 border border-purple-300/80">
                Automatically Present On-Duty
              </span>
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
    </div>
  );
});

// =============================================================================
// PERSISTENT CLIENT-SIDE MEMORY CACHE (ZERO RE-FETCH / ZERO SKELETON ON ROUTE NAV)
// =============================================================================
interface ShiftOperationsMemoryCache {
  hasLoadedOnce: boolean;
  profiles: OfficerMember[];
  shiftSchedules: ShiftScheduleItem[];
  activeShift: ActiveShiftRecord | null;
  shiftDutyPersonnel: ShiftDutyPersonnelRecord[];
  absentOfficerIds: string[];
  geofenceConfig: GeofenceConfig;
  todayAttendance: DutyAttendanceRecord[];
  userCoords: UserCoordinates | null;
  monthAssignmentsMap: Map<string, DutyRosterAssignmentRecord[]>;
  todayAssignments: DutyRosterAssignmentRecord[];
  lastFetchedAt: number;
}

const shiftOperationsMemoryCache: ShiftOperationsMemoryCache = {
  hasLoadedOnce: false,
  profiles: [],
  shiftSchedules: [],
  activeShift: null,
  shiftDutyPersonnel: [],
  absentOfficerIds: [],
  geofenceConfig: DEFAULT_GEOFENCE_CONFIG,
  todayAttendance: [],
  userCoords: null,
  monthAssignmentsMap: new Map<string, DutyRosterAssignmentRecord[]>(),
  todayAssignments: [],
  lastFetchedAt: 0,
};

function getMergedCachedAssignments(): DutyRosterAssignmentRecord[] {
  const byKey = new Map<string, DutyRosterAssignmentRecord>();
  shiftOperationsMemoryCache.todayAssignments.forEach((a) => {
    const k = a.id || `${a.profile_id}_${a.duty_date}_${a.assignment_type}`;
    byKey.set(k, a);
  });
  shiftOperationsMemoryCache.monthAssignmentsMap.forEach((records) => {
    records.forEach((a) => {
      const k = a.id || `${a.profile_id}_${a.duty_date}_${a.assignment_type}`;
      byKey.set(k, a);
    });
  });
  return Array.from(byKey.values());
}

function areJsonEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

// COMPONENT: SHIFT SCHEDULE OPERATIONS SCREEN (100% DYNAMIC DATABASE DATA)
// =============================================================================

export default function ShiftSchedulePage() {
  const { user, profile, isViewOnly, canWrite } = useAuth();
  const isShiftViewOnly = isViewOnly('Shifts') || !canWrite('Shifts');
  const currentUserId = user?.id || profile?.id || '';

  // Top Tab Switcher: 'dashboard' (Schedule Dashboard) | 'my-schedule' (My Schedule)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'my-schedule'>('dashboard');

  // Loading & Sync States (Initialize from persistent memory cache to avoid skeleton flashes on route navigation)
  const [isLoading, setIsLoading] = useState<boolean>(!shiftOperationsMemoryCache.hasLoadedOnce);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  // Dynamic Database Data (Initialized from memory cache)
  const [profiles, setProfiles] = useState<OfficerMember[]>(shiftOperationsMemoryCache.profiles);
  const [shiftSchedules, setShiftSchedules] = useState<ShiftScheduleItem[]>(
    shiftOperationsMemoryCache.shiftSchedules
  );
  const [dbAssignments, setDbAssignments] = useState<DutyRosterAssignmentRecord[]>(() =>
    getMergedCachedAssignments()
  );
  const [activeShift, setActiveShift] = useState<ActiveShiftRecord | null>(
    shiftOperationsMemoryCache.activeShift
  );
  const [shiftDutyPersonnel, setShiftDutyPersonnel] = useState<ShiftDutyPersonnelRecord[]>(
    shiftOperationsMemoryCache.shiftDutyPersonnel
  );

  // GeoFence & Daily Check-In / Check-Out Attendance State
  const [geofenceConfig, setGeofenceConfig] = useState<GeofenceConfig>(
    shiftOperationsMemoryCache.geofenceConfig
  );
  const [todayAttendance, setTodayAttendance] = useState<DutyAttendanceRecord[]>(
    shiftOperationsMemoryCache.todayAttendance
  );
  const [userCoords, setUserCoords] = useState<UserCoordinates | null>(
    shiftOperationsMemoryCache.userCoords
  );
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isCheckingInOut, setIsCheckingInOut] = useState<boolean>(false);

  // Side Modal State for Personnel Profile & Attendance Inspector (Full Access Only)
  const [selectedOfficerForDetail, setSelectedOfficerForDetail] = useState<OfficerMember | null>(null);

  const handleSelectOfficerForDetail = useCallback(
    (officer: OfficerMember) => {
      if (isShiftViewOnly) return;
      setSelectedOfficerForDetail(officer);
    },
    [isShiftViewOnly]
  );

  // Auto-close side modal if view-only access is enabled
  useEffect(() => {
    if (isShiftViewOnly && selectedOfficerForDetail) {
      setSelectedOfficerForDetail(null);
    }
  }, [isShiftViewOnly, selectedOfficerForDetail]);

  // Escape key handler for Side Modal
  useEffect(() => {
    if (!selectedOfficerForDetail || isShiftViewOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedOfficerForDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOfficerForDetail, isShiftViewOnly]);

  // Role & Attendance Filter States
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedAttendanceFilter, setSelectedAttendanceFilter] = useState<string>('ALL');

  // Live Clock Ticker (Updates every 15s + tab focus for Check-Out 30-min gate, Per-Shift rollover & 12:00 AM Midnight rollover)
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 15000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setNowTick(Date.now());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Checked Out Floating Modal & Debounced Search States
  const [isCheckedOutModalOpen, setIsCheckedOutModalOpen] = useState<boolean>(false);
  const [checkedOutSearchQuery, setCheckedOutSearchQuery] = useState<string>('');
  const [debouncedCheckedOutSearch, setDebouncedCheckedOutSearch] = useState<string>('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedCheckedOutSearch(checkedOutSearchQuery.trim().toLowerCase());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [checkedOutSearchQuery]);

  useEffect(() => {
    if (!isCheckedOutModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCheckedOutModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCheckedOutModalOpen]);

  // Card Pagination States (Max 5 people per page, lazy/keep-alive rendering)
  const [presentPage, setPresentPage] = useState<number>(1);
  const [absentPage, setAbsentPage] = useState<number>(1);
  const [restPage, setRestPage] = useState<number>(1);

  // Reset pagination when role or attendance filter changes
  useEffect(() => {
    setPresentPage(1);
  }, [selectedRoleFilter, selectedAttendanceFilter]);

  useEffect(() => {
    setAbsentPage(1);
  }, [selectedRoleFilter]);

  // Attendance State (Tracks absent officers for the active shift)
  const [absentOfficerIds, setAbsentOfficerIds] = useState<string[]>(
    shiftOperationsMemoryCache.absentOfficerIds
  );
  const [tempAbsentOfficerIds, setTempAbsentOfficerIds] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // "My Schedule" Calendar State
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const calendarMonthRef = useRef<Date>(calendarMonth);
  useEffect(() => {
    calendarMonthRef.current = calendarMonth;
  }, [calendarMonth]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState<boolean>(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ===========================================================================
  // DATA FETCHING (SUPABASE 100% DYNAMIC WITH SELECTIVE DIFF UPDATES)
  // ===========================================================================
  const fetchShiftData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground && !shiftOperationsMemoryCache.hasLoadedOnce) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const activeMonth = calendarMonthRef.current;
      const monthKey = format(activeMonth, 'yyyy-MM');
      const monthStartStr = format(startOfMonth(activeMonth), 'yyyy-MM-dd');
      const monthEndStr = format(endOfMonth(activeMonth), 'yyyy-MM-dd');
      const todayStr = format(new Date(), 'yyyy-MM-dd');

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
        try {
          deactList = JSON.parse(localStorage.getItem('pdrrmo_deactivated_users') || '[]');
          delList = JSON.parse(localStorage.getItem('pdrrmo_deleted_users') || '[]');
        } catch (e) {}

        const mappedProfiles: OfficerMember[] = profilesData
          .filter((p) => {
            const isDel = delList.includes(p.id) || (p.email && delList.includes(p.email));
            const isDeact = deactList.includes(p.id) || (p.email && deactList.includes(p.email));
            return !isDel && !isDeact && p.is_active !== false;
          })
          .map((p) => {
            const finalName = p.full_name || 'Duty Officer';
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
              avatarUrl: p.avatar_url,
              station: 'DOC Command Center',
              defaultShift: finalShift,
              email: p.email || null,
              division: (p as any).division || 'Provincial Disaster Risk Reduction Management Office',
            };
          });

        if (!areJsonEqual(shiftOperationsMemoryCache.profiles, mappedProfiles)) {
          shiftOperationsMemoryCache.profiles = mappedProfiles;
          setProfiles(mappedProfiles);
        }
      } else if (shiftOperationsMemoryCache.profiles.length > 0) {
        shiftOperationsMemoryCache.profiles = [];
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
        if (!areJsonEqual(shiftOperationsMemoryCache.shiftSchedules, mappedSchedules)) {
          shiftOperationsMemoryCache.shiftSchedules = mappedSchedules;
          setShiftSchedules(mappedSchedules);
        }
      } else if (shiftOperationsMemoryCache.shiftSchedules.length > 0) {
        shiftOperationsMemoryCache.shiftSchedules = [];
        setShiftSchedules([]);
      }

      // 3. Fetch Month Duty Roster Assignments (Covering viewed calendar month + current date)
      const { data: assignData, error: assignError } = await supabase
        .from('duty_roster_assignments')
        .select('*')
        .or(`and(duty_date.gte.${monthStartStr},duty_date.lte.${monthEndStr}),duty_date.eq.${todayStr}`);

      if (assignError) {
        console.warn('Duty roster query notice:', assignError.message);
      } else if (assignData) {
        const typedAssigns = assignData as DutyRosterAssignmentRecord[];
        const monthRecords = typedAssigns.filter(
          (a) => a.duty_date >= monthStartStr && a.duty_date <= monthEndStr
        );
        const todayRecords = typedAssigns.filter((a) => a.duty_date === todayStr);

        shiftOperationsMemoryCache.monthAssignmentsMap.set(monthKey, monthRecords);
        shiftOperationsMemoryCache.todayAssignments = todayRecords;

        const merged = getMergedCachedAssignments();
        setDbAssignments((prev) => (areJsonEqual(prev, merged) ? prev : merged));
      }

      // 4. Fetch Active Operational Shift from public.shifts (status = 'active')
      const { data: activeShiftData, error: shiftError } = await supabase
        .from('shifts')
        .select('*')
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (shiftError) {
        console.warn('Active shift query notice:', shiftError.message);
      }

      if (activeShiftData) {
        const typedShift = activeShiftData as ActiveShiftRecord;
        if (!areJsonEqual(shiftOperationsMemoryCache.activeShift, typedShift)) {
          shiftOperationsMemoryCache.activeShift = typedShift;
          setActiveShift(typedShift);
        }

        // Fetch linked duty personnel for active shift
        const { data: personnelData, error: personnelError } = await supabase
          .from('shift_duty_personnel')
          .select('*')
          .eq('shift_id', activeShiftData.id);

        if (personnelError) {
          console.warn('Shift duty personnel query notice:', personnelError.message);
        }

        if (personnelData && personnelData.length > 0) {
          const typedPersonnel = personnelData as ShiftDutyPersonnelRecord[];
          if (!areJsonEqual(shiftOperationsMemoryCache.shiftDutyPersonnel, typedPersonnel)) {
            shiftOperationsMemoryCache.shiftDutyPersonnel = typedPersonnel;
            setShiftDutyPersonnel(typedPersonnel);
          }
          const absentIds = typedPersonnel
            .filter((p) => p.present_at_end === false)
            .map((p) => p.profile_id);
          if (!areJsonEqual(shiftOperationsMemoryCache.absentOfficerIds, absentIds)) {
            shiftOperationsMemoryCache.absentOfficerIds = absentIds;
            setAbsentOfficerIds(absentIds);
          }
        } else {
          if (shiftOperationsMemoryCache.shiftDutyPersonnel.length > 0) {
            shiftOperationsMemoryCache.shiftDutyPersonnel = [];
            setShiftDutyPersonnel([]);
          }
          const rosterAbsent = (assignData || [])
            .filter((a: any) => a.duty_date === todayStr && a.notes && a.notes.toLowerCase().includes('absent'))
            .map((a: any) => a.profile_id);
          if (!areJsonEqual(shiftOperationsMemoryCache.absentOfficerIds, rosterAbsent)) {
            shiftOperationsMemoryCache.absentOfficerIds = rosterAbsent;
            setAbsentOfficerIds(rosterAbsent);
          }
        }
      } else {
        if (shiftOperationsMemoryCache.activeShift !== null) {
          shiftOperationsMemoryCache.activeShift = null;
          setActiveShift(null);
        }
        if (shiftOperationsMemoryCache.shiftDutyPersonnel.length > 0) {
          shiftOperationsMemoryCache.shiftDutyPersonnel = [];
          setShiftDutyPersonnel([]);
        }
        const rosterAbsent = (assignData || [])
          .filter((a: any) => a.duty_date === todayStr && a.notes && a.notes.toLowerCase().includes('absent'))
          .map((a: any) => a.profile_id);
        if (!areJsonEqual(shiftOperationsMemoryCache.absentOfficerIds, rosterAbsent)) {
          shiftOperationsMemoryCache.absentOfficerIds = rosterAbsent;
          setAbsentOfficerIds(rosterAbsent);
        }
      }

      // 5. Fetch GeoFence Security Configuration
      try {
        const { data: geoData, error: geoError } = await supabase
          .from('geofence_settings')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!geoError && geoData) {
          const loadedGeo: GeofenceConfig = {
            id: geoData.id,
            name: geoData.name || DEFAULT_GEOFENCE_CONFIG.name,
            description: geoData.description || DEFAULT_GEOFENCE_CONFIG.description,
            latitude: Number(geoData.latitude ?? DEFAULT_GEOFENCE_CONFIG.latitude),
            longitude: Number(geoData.longitude ?? DEFAULT_GEOFENCE_CONFIG.longitude),
            radiusMeters: Number(geoData.radius_meters ?? DEFAULT_GEOFENCE_CONFIG.radiusMeters),
            isActive: Boolean(geoData.is_active ?? true),
            updatedAt: geoData.updated_at,
          };
          if (!areJsonEqual(shiftOperationsMemoryCache.geofenceConfig, loadedGeo)) {
            shiftOperationsMemoryCache.geofenceConfig = loadedGeo;
            setGeofenceConfig(loadedGeo);
          }
          saveGeofenceCache(loadedGeo);
        } else {
          const cached = loadGeofenceCache();
          if (cached && !areJsonEqual(shiftOperationsMemoryCache.geofenceConfig, cached)) {
            shiftOperationsMemoryCache.geofenceConfig = cached;
            setGeofenceConfig(cached);
          }
        }
      } catch {
        const cached = loadGeofenceCache();
        if (cached && !areJsonEqual(shiftOperationsMemoryCache.geofenceConfig, cached)) {
          shiftOperationsMemoryCache.geofenceConfig = cached;
          setGeofenceConfig(cached);
        }
      }

      // 6. Fetch Today's Officer Check-In / Check-Out Attendance Records + Any Unclosed Prior-Day Check-Ins
      try {
        const { data: attData, error: attError } = await supabase
          .from('duty_attendance_records')
          .select('*')
          .or(`duty_date.eq.${todayStr},status.eq.checked_in`)
          .order('duty_date', { ascending: false });

        let localAtt: DutyAttendanceRecord[] = [];
        let localUnsynced: DutyAttendanceRecord[] = [];
        try {
          localAtt = JSON.parse(
            localStorage.getItem(`pdrrmo_duty_attendance_${todayStr}`) || '[]'
          );
          localUnsynced = JSON.parse(
            localStorage.getItem('pdrrmo_duty_attendance_unsynced') || '[]'
          );
        } catch {}

        if (!attError && attData) {
          const dbMap = new Map<string, DutyAttendanceRecord>();
          (attData as DutyAttendanceRecord[]).forEach((r) =>
            dbMap.set(`${r.profile_id}_${r.duty_date}`, r)
          );
          // Merge only locally unsynced records (when Supabase write failed offline)
          localUnsynced.forEach((r) => {
            const key = `${r.profile_id}_${r.duty_date}`;
            if (r.duty_date === todayStr || r.status === 'checked_in') {
              if (!dbMap.has(key)) dbMap.set(key, r);
            }
          });
          const merged = Array.from(dbMap.values());
          if (!areJsonEqual(shiftOperationsMemoryCache.todayAttendance, merged)) {
            shiftOperationsMemoryCache.todayAttendance = merged;
            setTodayAttendance(merged);
          }
          try {
            localStorage.setItem(`pdrrmo_duty_attendance_${todayStr}`, JSON.stringify(merged));
          } catch {}
        } else if (!areJsonEqual(shiftOperationsMemoryCache.todayAttendance, localAtt)) {
          shiftOperationsMemoryCache.todayAttendance = localAtt;
          setTodayAttendance(localAtt);
        }
      } catch {
        try {
          const localAtt = JSON.parse(
            localStorage.getItem(`pdrrmo_duty_attendance_${todayStr}`) || '[]'
          );
          if (!areJsonEqual(shiftOperationsMemoryCache.todayAttendance, localAtt)) {
            shiftOperationsMemoryCache.todayAttendance = localAtt;
            setTodayAttendance(localAtt);
          }
        } catch {}
      }

      shiftOperationsMemoryCache.hasLoadedOnce = true;
      shiftOperationsMemoryCache.lastFetchedAt = Date.now();
    } catch (err) {
      console.error('Error fetching dynamic shift operations data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Decoupled Month Assignments Fetcher (Only fetches uncached months without re-querying static tables)
  const fetchMonthAssignmentsIfNeeded = useCallback(async (targetMonth: Date) => {
    const monthKey = format(targetMonth, 'yyyy-MM');
    if (shiftOperationsMemoryCache.monthAssignmentsMap.has(monthKey)) {
      // Already cached in memory — 0 network requests, 0 re-renders!
      return;
    }

    const monthStartStr = format(startOfMonth(targetMonth), 'yyyy-MM-dd');
    const monthEndStr = format(endOfMonth(targetMonth), 'yyyy-MM-dd');

    try {
      const { data: assignData, error: assignError } = await supabase
        .from('duty_roster_assignments')
        .select('*')
        .gte('duty_date', monthStartStr)
        .lte('duty_date', monthEndStr);

      if (!assignError && assignData) {
        shiftOperationsMemoryCache.monthAssignmentsMap.set(
          monthKey,
          assignData as DutyRosterAssignmentRecord[]
        );
        const merged = getMergedCachedAssignments();
        setDbAssignments((prev) => (areJsonEqual(prev, merged) ? prev : merged));
      }
    } catch (err) {
      console.warn('Error fetching month assignments:', err);
    }
  }, []);

  // Acquire Live GPS Coordinates for Geofence Validation
  const refreshGpsLocation = useCallback(async () => {
    setIsLocatingGps(true);
    setGpsError(null);
    try {
      const coords = await getUserCoordinates();
      shiftOperationsMemoryCache.userCoords = coords;
      setUserCoords((prev) => (areJsonEqual(prev, coords) ? prev : coords));
      return coords;
    } catch (err: any) {
      setGpsError(err.message || 'Unable to acquire GPS signal.');
      return null;
    } finally {
      setIsLocatingGps(false);
    }
  }, []);

  // Initial load (Silent background sync if already cached in memory)
  useEffect(() => {
    fetchShiftData(shiftOperationsMemoryCache.hasLoadedOnce);
  }, [fetchShiftData]);

  // Trigger decoupled month fetch when calendarMonth changes
  useEffect(() => {
    if (shiftOperationsMemoryCache.hasLoadedOnce) {
      fetchMonthAssignmentsIfNeeded(calendarMonth);
    }
  }, [calendarMonth, fetchMonthAssignmentsIfNeeded]);

  // Realtime Location Tracking & Permission Listener (Disables / Enables Check In in realtime when location is toggled)
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    let watchId: number | null = null;
    let permStatus: PermissionStatus | null = null;

    // 1. Listen to Permissions API status changes in realtime (Chrome, Edge, Firefox)
    if ('permissions' in navigator && typeof navigator.permissions?.query === 'function') {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          permStatus = status;
          const handlePermChange = () => {
            if (status.state === 'denied' || status.state === 'prompt') {
              // Location turned OFF or revoked -> Instantly disable Check In button!
              shiftOperationsMemoryCache.userCoords = null;
              setUserCoords(null);
              try {
                localStorage.removeItem('pdrrmo_location_granted');
              } catch {}
            } else if (status.state === 'granted') {
              // Location turned ON -> Re-acquire position and verify geofence!
              try {
                localStorage.setItem('pdrrmo_location_granted', 'true');
              } catch {}
              refreshGpsLocation();
            }
          };

          handlePermChange();
          status.onchange = handlePermChange;
        })
        .catch(() => {});
    }

    // 2. Continuous watchPosition: Streams active GPS position and detects when device location is turned off
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords: UserCoordinates = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: Math.round(pos.coords.accuracy || 0),
            timestamp: pos.timestamp,
          };
          shiftOperationsMemoryCache.userCoords = coords;
          setUserCoords((prev) => (areJsonEqual(prev, coords) ? prev : coords));
          try {
            localStorage.setItem('pdrrmo_location_granted', 'true');
          } catch {}
        },
        (err) => {
          // If location is blocked or turned off on the device:
          if (err.code === err.PERMISSION_DENIED || err.code === err.POSITION_UNAVAILABLE) {
            shiftOperationsMemoryCache.userCoords = null;
            setUserCoords(null);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000,
        }
      );
    } catch (e) {
      console.warn('watchPosition error:', e);
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, [refreshGpsLocation]);

  // Realtime subscription for shifts, shift_duty_personnel, duty_roster_assignments, shift_schedules, profiles, geofence_settings, duty_attendance_records
  useEffect(() => {
    const channel = supabase
      .channel('shift_operations_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => {
          fetchShiftData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_duty_personnel' },
        () => {
          fetchShiftData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'duty_roster_assignments' },
        () => {
          fetchShiftData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_schedules' },
        () => {
          fetchShiftData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchShiftData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'geofence_settings' },
        () => {
          fetchShiftData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'duty_attendance_records' },
        () => {
          fetchShiftData(true);
        }
      )
      .subscribe();

    // Cross-tab broadcast & localStorage sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pdrrmo_shift_sync') {
        fetchShiftData(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('pdrrmo_shift_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'shift_state_updated') {
          fetchShiftData(true);
        }
      };
    } catch (e) {}

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('storage', handleStorageChange);
      if (bc) bc.close();
    };
  }, [fetchShiftData]);

  // O(1) Indexed Map for Profiles by ID
  const profilesByIdMap = useMemo(() => {
    const map = new Map<string, OfficerMember>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  // O(1) Indexed Map for Shift Schedules by ID
  const schedulesByIdMap = useMemo(() => {
    const map = new Map<string, ShiftScheduleItem>();
    shiftSchedules.forEach((s) => map.set(s.id, s));
    return map;
  }, [shiftSchedules]);

  // O(1) Indexed Map for Assignments by Officer + Date
  const assignmentsByOfficerDateMap = useMemo(() => {
    const map = new Map<string, DutyRosterAssignmentRecord>();
    dbAssignments.forEach((a) => {
      map.set(`${a.profile_id}_${a.duty_date}`, a);
    });
    return map;
  }, [dbAssignments]);

  // Helper to resolve officer by profile_id in O(1)
  const getOfficerById = useCallback(
    (id: string): OfficerMember => {
      const found = profilesByIdMap.get(id);
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
        email: null,
        division: 'Provincial Disaster Risk Reduction Management Office',
      };
    },
    [profilesByIdMap]
  );

  // Today's Date String (Rolls over automatically at 12:00 AM Midnight via live clock)
  const todayKey = useMemo(() => format(new Date(nowTick), 'yyyy-MM-dd'), [nowTick]);

  // Re-sync roster & attendance automatically when Midnight (12:00 AM) date rollover occurs
  const prevTodayKeyRef = useRef<string>(todayKey);
  useEffect(() => {
    if (prevTodayKeyRef.current !== todayKey) {
      prevTodayKeyRef.current = todayKey;
      fetchShiftData(true);
    }
  }, [todayKey, fetchShiftData]);

  // Active Live Shift Schedule determined dynamically from database & live clock
  const liveShiftSchedule = useMemo(() => {
    return getLiveShiftSchedule(shiftSchedules, new Date(nowTick));
  }, [shiftSchedules, nowTick]);

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

  // Today's Travel Order assignments
  const todayTravelAssignments = useMemo(() => {
    return todayAssignments.filter((a) => a.assignment_type === 'travel');
  }, [todayAssignments]);

  // Set of profile_ids scheduled on Rest Day today
  const restOfficerIds = useMemo(() => {
    return new Set(todayRestAssignments.map((a) => a.profile_id));
  }, [todayRestAssignments]);

  // Set of profile_ids scheduled on Travel Order today
  const travelOfficerIds = useMemo(() => {
    return new Set(todayTravelAssignments.map((a) => a.profile_id));
  }, [todayTravelAssignments]);

  // Resolve an officer's assigned shift schedule for a specific duty date
  const resolveOfficerShiftForDate = useCallback(
    (
      officerId: string,
      dutyDate: string,
      att?: DutyAttendanceRecord | null
    ): ShiftScheduleItem | null => {
      const assign = assignmentsByOfficerDateMap.get(`${officerId}_${dutyDate}`);
      if (assign?.assignment_type === 'duty' && assign.shift_schedule_id) {
        const s = schedulesByIdMap.get(assign.shift_schedule_id);
        if (s) return s;
      }
      if (att?.shift_schedule_id) {
        const s = schedulesByIdMap.get(att.shift_schedule_id);
        if (s) return s;
      }
      const officer = getOfficerById(officerId);
      if (officer.defaultShift) {
        const matched = shiftSchedules.find(
          (s) => s.name.toLowerCase() === officer.defaultShift!.toLowerCase()
        );
        if (matched) return matched;
      }
      return dutyDate === todayKey ? liveShiftSchedule : shiftSchedules[0] || null;
    },
    [
      assignmentsByOfficerDateMap,
      schedulesByIdMap,
      getOfficerById,
      shiftSchedules,
      todayKey,
      liveShiftSchedule,
    ]
  );

  // Resolve active attendance record for an officer:
  // 1. Today's attendance record (unless completed on an earlier shift and officer is assigned to a newly active shift)
  // 2. Fallback to any unclosed prior-day check-in (duty_date < todayKey && status === 'checked_in')
  const getActiveAttendanceForOfficer = useCallback(
    (officerId: string): DutyAttendanceRecord | null => {
      const todayRec = todayAttendance.find(
        (r) => r.profile_id === officerId && r.duty_date === todayKey
      );
      if (todayRec) {
        const isReassignedNewShift = Boolean(
          todayRec.status === 'checked_out' &&
            liveShiftSchedule &&
            todayRec.shift_schedule_id &&
            todayRec.shift_schedule_id !== liveShiftSchedule.id &&
            todayDutyAssignments.some(
              (a) => a.profile_id === officerId && a.shift_schedule_id === liveShiftSchedule.id
            )
        );
        if (isReassignedNewShift) {
          return null;
        }
        return todayRec;
      }

      const unclosedPrior = todayAttendance
        .filter(
          (r) =>
            r.profile_id === officerId &&
            r.status === 'checked_in' &&
            r.duty_date < todayKey
        )
        .sort((a, b) => b.duty_date.localeCompare(a.duty_date))[0];

      return unclosedPrior || null;
    },
    [todayAttendance, todayKey, liveShiftSchedule, todayDutyAssignments]
  );

  // Officers assigned on Duty for the Current Live Shift
  // Default status is Absent until the user clicks Check In.
  // Officers who Checked Out remain 'checked_out' (never reverting to Absent) until next day/shift rollover.
  // Officers with an unclosed prior-day shift remain in Present On-Duty until they Check Out.
  const liveShiftOfficers = useMemo(() => {
    let baseAssigns = todayDutyAssignments.filter((a) => !restOfficerIds.has(a.profile_id));

    if (liveShiftSchedule && baseAssigns.length > 0) {
      const matchedAssigns = baseAssigns.filter((a) => {
        if (a.shift_schedule_id === liveShiftSchedule.id) return true;
        if (!a.shift_schedule_id) {
          const officer = getOfficerById(a.profile_id);
          return (
            officer.defaultShift &&
            officer.defaultShift.toLowerCase() === liveShiftSchedule.name.toLowerCase()
          );
        }
        return false;
      });
      if (matchedAssigns.length > 0) {
        baseAssigns = matchedAssigns;
      }
    }

    const officerMap = new Map<string, OfficerMember>();

    if (baseAssigns.length > 0) {
      baseAssigns.forEach((a) => {
        officerMap.set(a.profile_id, {
          ...getOfficerById(a.profile_id),
          isLead: a.is_lead,
        });
      });
    } else {
      // If no explicit duty assignments exist for today, include all active profiles not on rest day
      profiles.forEach((p) => {
        if (!restOfficerIds.has(p.id)) {
          officerMap.set(p.id, { ...p, isLead: false });
        }
      });
    }

    // Include all officers on Travel Order today
    todayTravelAssignments.forEach((a) => {
      officerMap.set(a.profile_id, {
        ...getOfficerById(a.profile_id),
        isLead: a.is_lead,
        isTravelOrder: true,
      });
    });

    // Ensure the current logged-in user (if not on rest day) is included
    if (currentUserId && !restOfficerIds.has(currentUserId) && !officerMap.has(currentUserId)) {
      officerMap.set(currentUserId, getOfficerById(currentUserId));
    }

    // Include anyone with an open check-in (including unclosed prior-day shifts even if today is rest day)
    // or today's attendance record (if not on rest day)
    todayAttendance.forEach((att) => {
      const isOpenPrior = att.status === 'checked_in' && att.duty_date < todayKey;
      const isTodayActive = att.duty_date === todayKey && !restOfficerIds.has(att.profile_id);
      if ((isOpenPrior || isTodayActive) && !officerMap.has(att.profile_id)) {
        officerMap.set(att.profile_id, getOfficerById(att.profile_id));
      }
    });

    // Enrich each officer with check-in / check-out / late / unclosed status
    return Array.from(officerMap.values()).map((officer): OfficerMember => {
      const att = getActiveAttendanceForOfficer(officer.id);

      // 1. Unclosed prior-day shift takes precedence until closed
      if (att && att.status === 'checked_in' && att.duty_date < todayKey) {
        const sched = resolveOfficerShiftForDate(officer.id, att.duty_date, att);
        const isLate = computeIsOfficerLate(
          att.check_in_time,
          att.duty_date,
          sched?.startTime,
          sched?.endTime
        );
        return {
          ...officer,
          isTravelOrder: false,
          checkInTime: att.check_in_time,
          checkOutTime: null,
          attendanceStatus: 'checked_in',
          isLate,
          unclosedFromDate: att.duty_date,
          assignedStartTime: sched?.startTime || null,
        };
      }

      // 2. Travel Order today is automatically Present On-Duty (never Late)
      if (travelOfficerIds.has(officer.id)) {
        return {
          ...officer,
          isTravelOrder: true,
          attendanceStatus: 'checked_in',
          isLate: false,
          unclosedFromDate: null,
        };
      }

      // 3. Today's Checked-In or Checked-Out record
      if (att) {
        const sched = resolveOfficerShiftForDate(officer.id, att.duty_date, att);
        const isLate = computeIsOfficerLate(
          att.check_in_time,
          att.duty_date,
          sched?.startTime,
          sched?.endTime
        );
        return {
          ...officer,
          checkInTime: att.check_in_time || null,
          checkOutTime: att.check_out_time || null,
          attendanceStatus: att.status,
          isLate,
          unclosedFromDate: null,
          assignedStartTime: sched?.startTime || null,
        };
      }

      // 4. Default: Absent
      const sched = resolveOfficerShiftForDate(officer.id, todayKey, null);
      return {
        ...officer,
        checkInTime: null,
        checkOutTime: null,
        attendanceStatus: 'absent',
        isLate: false,
        unclosedFromDate: null,
        assignedStartTime: sched?.startTime || null,
      };
    });
  }, [
    liveShiftSchedule,
    todayDutyAssignments,
    todayTravelAssignments,
    restOfficerIds,
    travelOfficerIds,
    profiles,
    currentUserId,
    todayAttendance,
    todayKey,
    getOfficerById,
    getActiveAttendanceForOfficer,
    resolveOfficerShiftForDate,
  ]);

  // Derived Present vs Absent vs Checked-Out lists:
  // Present = Officers currently checked in (On Time, Late, Travel Order, or Unclosed Prior Shift)
  // Absent = ONLY scheduled officers who have NOT checked in yet ('absent') — Checked Out officers NEVER revert to Absent!
  const presentOfficers = useMemo(() => {
    return liveShiftOfficers.filter((o) => o.attendanceStatus === 'checked_in');
  }, [liveShiftOfficers]);

  const absentOfficers = useMemo(() => {
    return liveShiftOfficers.filter((o) => o.attendanceStatus === 'absent');
  }, [liveShiftOfficers]);

  // Checked Out Personnel Today (Displayed in the floating Checked Out modal)
  const checkedOutOfficers = useMemo(() => {
    const seen = new Set<string>();
    return todayAttendance
      .filter((r) => r.status === 'checked_out' && r.duty_date === todayKey)
      .sort((a, b) => {
        const timeA = a.check_out_time ? new Date(a.check_out_time).getTime() : 0;
        const timeB = b.check_out_time ? new Date(b.check_out_time).getTime() : 0;
        return timeB - timeA;
      })
      .filter((r) => {
        if (seen.has(r.profile_id)) return false;
        seen.add(r.profile_id);
        return true;
      })
      .map((r) => ({
        officer: getOfficerById(r.profile_id),
        checkOutTime: r.check_out_time || null,
      }));
  }, [todayAttendance, todayKey, getOfficerById]);

  const filteredCheckedOutOfficers = useMemo(() => {
    if (!debouncedCheckedOutSearch) return checkedOutOfficers;
    return checkedOutOfficers.filter((item) =>
      item.officer.name.toLowerCase().includes(debouncedCheckedOutSearch)
    );
  }, [checkedOutOfficers, debouncedCheckedOutSearch]);

  // Role & Attendance filtered Present Officers
  const filteredPresentOfficers = useMemo(() => {
    return presentOfficers.filter((o) => {
      if (!matchesRole(o, selectedRoleFilter)) return false;
      if (selectedAttendanceFilter === 'ON_TIME') {
        return !o.isTravelOrder && !o.isLate;
      }
      if (selectedAttendanceFilter === 'LATE') {
        return !o.isTravelOrder && Boolean(o.isLate);
      }
      if (selectedAttendanceFilter === 'TRAVEL_ORDER') {
        return Boolean(o.isTravelOrder);
      }
      return true;
    });
  }, [presentOfficers, selectedRoleFilter, selectedAttendanceFilter]);

  const filteredAbsentOfficers = useMemo(() => {
    return absentOfficers.filter((o) => matchesRole(o, selectedRoleFilter));
  }, [absentOfficers, selectedRoleFilter]);

  // Today's Rest Day Personnel
  const todayRestPersonnel = useMemo(() => {
    return todayRestAssignments.map((a) => getOfficerById(a.profile_id));
  }, [todayRestAssignments, getOfficerById]);

  // Dynamic Inspector Metrics for the selected officer in Side Modal
  const selectedOfficerAttendance = useMemo(() => {
    if (!selectedOfficerForDetail) return null;
    return getActiveAttendanceForOfficer(selectedOfficerForDetail.id);
  }, [selectedOfficerForDetail, getActiveAttendanceForOfficer]);

  const selectedOfficerSchedule = useMemo(() => {
    if (!selectedOfficerForDetail) return null;
    const targetDate = selectedOfficerAttendance?.duty_date || todayKey;
    return resolveOfficerShiftForDate(
      selectedOfficerForDetail.id,
      targetDate,
      selectedOfficerAttendance
    );
  }, [selectedOfficerForDetail, selectedOfficerAttendance, todayKey, resolveOfficerShiftForDate]);

  const isSelectedOfficerRestDay = useMemo(() => {
    if (!selectedOfficerForDetail) return false;
    return restOfficerIds.has(selectedOfficerForDetail.id);
  }, [selectedOfficerForDetail, restOfficerIds]);

  const isSelectedOfficerTravelOrder = useMemo(() => {
    if (!selectedOfficerForDetail) return false;
    return travelOfficerIds.has(selectedOfficerForDetail.id) || Boolean(selectedOfficerForDetail.isTravelOrder);
  }, [selectedOfficerForDetail, travelOfficerIds]);

  const selectedOfficerDutyDateFormatted = useMemo(() => {
    if (!selectedOfficerForDetail) return '';
    const dateStr = selectedOfficerAttendance?.duty_date || todayKey;
    const parts = parseLocalDateParts(dateStr);
    if (!parts) return dateStr;
    return format(new Date(parts.year, parts.month, parts.day), 'EEEE, MMMM d, yyyy');
  }, [selectedOfficerForDetail, selectedOfficerAttendance, todayKey]);

  const selectedOfficerCheckInFormatted = useMemo(() => {
    if (!selectedOfficerAttendance?.check_in_time) return null;
    const d = new Date(selectedOfficerAttendance.check_in_time);
    if (isNaN(d.getTime())) return null;
    const timeStr = format(d, 'hh:mm:ss a');
    if (selectedOfficerAttendance.duty_date < todayKey) {
      return `${timeStr} (${formatDutyDateShort(selectedOfficerAttendance.duty_date)})`;
    }
    return timeStr;
  }, [selectedOfficerAttendance, todayKey]);

  const selectedOfficerCheckOutFormatted = useMemo(() => {
    if (!selectedOfficerAttendance?.check_out_time) return null;
    const d = new Date(selectedOfficerAttendance.check_out_time);
    if (isNaN(d.getTime())) return null;
    return format(d, 'hh:mm:ss a');
  }, [selectedOfficerAttendance]);

  const selectedOfficerDetailLate = useMemo(() => {
    if (!selectedOfficerForDetail || isSelectedOfficerTravelOrder || isSelectedOfficerRestDay) {
      return false;
    }
    if (selectedOfficerForDetail.isLate) return true;
    if (!selectedOfficerAttendance?.check_in_time) return false;
    return computeIsOfficerLate(
      selectedOfficerAttendance.check_in_time,
      selectedOfficerAttendance.duty_date,
      selectedOfficerSchedule?.startTime,
      selectedOfficerSchedule?.endTime
    );
  }, [
    selectedOfficerForDetail,
    isSelectedOfficerTravelOrder,
    isSelectedOfficerRestDay,
    selectedOfficerAttendance,
    selectedOfficerSchedule,
  ]);

  // ===========================================================================
  // CURRENT USER CHECK-IN / CHECK-OUT, 30-MIN GATE & GEOFENCE SECURITY LOGIC
  // ===========================================================================
  const isMyRestDay = useMemo(() => {
    if (!currentUserId) return false;
    return restOfficerIds.has(currentUserId);
  }, [currentUserId, restOfficerIds]);

  const isMyTravelOrder = useMemo(() => {
    if (!currentUserId) return false;
    return travelOfficerIds.has(currentUserId);
  }, [currentUserId, travelOfficerIds]);

  const myAttendance = useMemo(() => {
    if (!currentUserId) return null;
    return getActiveAttendanceForOfficer(currentUserId);
  }, [currentUserId, getActiveAttendanceForOfficer]);

  const hasUnclosedPriorShift = Boolean(
    myAttendance && myAttendance.status === 'checked_in' && myAttendance.duty_date < todayKey
  );

  const isCheckedIn = myAttendance?.status === 'checked_in';

  const isMyCheckedOutToday = Boolean(
    myAttendance && myAttendance.status === 'checked_out' && myAttendance.duty_date === todayKey
  );

  const myAssignedSchedule = useMemo(() => {
    if (!currentUserId) return liveShiftSchedule;
    const targetDate = myAttendance?.duty_date || todayKey;
    return resolveOfficerShiftForDate(currentUserId, targetDate, myAttendance);
  }, [currentUserId, myAttendance, todayKey, resolveOfficerShiftForDate, liveShiftSchedule]);

  const isMyLate = useMemo(() => {
    if (!isCheckedIn || (!hasUnclosedPriorShift && isMyTravelOrder) || !myAttendance) {
      return false;
    }
    return computeIsOfficerLate(
      myAttendance.check_in_time,
      myAttendance.duty_date,
      myAssignedSchedule?.startTime,
      myAssignedSchedule?.endTime
    );
  }, [isCheckedIn, hasUnclosedPriorShift, isMyTravelOrder, myAttendance, myAssignedSchedule]);

  const checkOutUnlockDate = useMemo(() => {
    if (!isCheckedIn || hasUnclosedPriorShift || !myAttendance) return null;
    return computeCheckOutUnlockTime(
      myAttendance.duty_date,
      myAssignedSchedule?.startTime,
      myAssignedSchedule?.endTime,
      myAttendance.check_in_time
    );
  }, [isCheckedIn, hasUnclosedPriorShift, myAttendance, myAssignedSchedule]);

  const isBeforeCheckOutWindow = Boolean(
    isCheckedIn &&
      !hasUnclosedPriorShift &&
      checkOutUnlockDate &&
      nowTick < checkOutUnlockDate.getTime()
  );

  const geofenceCheck = useMemo(() => {
    if (!userCoords) return null;
    return checkGeofenceCoverage(userCoords, geofenceConfig);
  }, [userCoords, geofenceConfig]);

  const isOutsideGeofence = useMemo(() => {
    if (!geofenceConfig.isActive) return false;
    if (!geofenceCheck) return true;
    return !geofenceCheck.isInside;
  }, [geofenceConfig.isActive, geofenceCheck]);

  // Primary Action Button Disable Rules:
  // - If closing an unclosed prior-day shift: only requires GeoFence & auth (bypasses today's Rest Day / Travel Order)
  // - Otherwise: disabled on Rest Day, Travel Order, Checked Out Today, Before (end_time - 30m), or Outside GeoFence
  const isCheckInOutDisabled = hasUnclosedPriorShift
    ? isOutsideGeofence || isCheckingInOut || !currentUserId
    : isMyRestDay ||
      isMyTravelOrder ||
      isMyCheckedOutToday ||
      isBeforeCheckOutWindow ||
      isOutsideGeofence ||
      isCheckingInOut ||
      !currentUserId;

  const handleToggleCheckInOut = useCallback(async () => {
    if (!currentUserId) {
      showToast('Please sign in to record your duty attendance.');
      return;
    }

    if (!hasUnclosedPriorShift) {
      if (isMyRestDay) {
        showToast('Action disabled: You are scheduled for a Rest Day today.');
        return;
      }

      if (isMyTravelOrder) {
        showToast('Action disabled: You are on an Official Travel Order and automatically Present.');
        return;
      }

      if (isMyCheckedOutToday) {
        showToast('You have already checked out for this shift.');
        return;
      }

      if (isCheckedIn && isBeforeCheckOutWindow && checkOutUnlockDate) {
        showToast(
          `Check Out unlocks at ${format(checkOutUnlockDate, 'hh:mm a')} (30 minutes before shift end).`
        );
        return;
      }
    }

    setIsCheckingInOut(true);
    try {
      let activeCoords = userCoords;
      if (!activeCoords && geofenceConfig.isActive) {
        activeCoords = await refreshGpsLocation();
      }

      if (geofenceConfig.isActive) {
        if (!activeCoords) {
          showToast(
            'GPS Location Required: Allow location access to verify you are within the station geofence.'
          );
          return;
        }
        const coverage = checkGeofenceCoverage(activeCoords, geofenceConfig);
        if (!coverage.isInside) {
          showToast(
            `Outside GeoFence Area: You are ${formatDistance(
              coverage.distanceMeters
            )} away (max allowed: ${formatDistance(coverage.allowedRadiusMeters)}).`
          );
          return;
        }
      }

      const nowIso = new Date().toISOString();
      const isUuidGeo = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        geofenceConfig.id
      );

      if (!isCheckedIn) {
        // PERFORM CHECK IN FOR TODAY
        const targetSchedule = myAssignedSchedule || liveShiftSchedule;
        const newRecord: DutyAttendanceRecord = {
          profile_id: currentUserId,
          duty_date: todayKey,
          shift_schedule_id: targetSchedule?.id || null,
          geofence_id: isUuidGeo ? geofenceConfig.id : null,
          check_in_time: nowIso,
          check_out_time: null,
          status: 'checked_in',
        };

        setTodayAttendance((prev) => {
          const next = [
            newRecord,
            ...prev.filter(
              (r) => !(r.profile_id === currentUserId && r.duty_date === todayKey)
            ),
          ];
          shiftOperationsMemoryCache.todayAttendance = next;
          try {
            localStorage.setItem(`pdrrmo_duty_attendance_${todayKey}`, JSON.stringify(next));
          } catch {}
          return next;
        });

        // Persist Check-In record to Supabase
        const { error: checkInErr } = await supabase
          .from('duty_attendance_records')
          .upsert(newRecord, { onConflict: 'profile_id,duty_date' });

        if (checkInErr) {
          console.warn('Supabase check-in upsert notice (cached locally):', checkInErr.message);
          try {
            const unsynced: DutyAttendanceRecord[] = JSON.parse(
              localStorage.getItem('pdrrmo_duty_attendance_unsynced') || '[]'
            );
            const nextUnsynced = [
              newRecord,
              ...unsynced.filter(
                (r) => !(r.profile_id === currentUserId && r.duty_date === todayKey)
              ),
            ];
            localStorage.setItem('pdrrmo_duty_attendance_unsynced', JSON.stringify(nextUnsynced));
          } catch {}
        } else {
          try {
            const unsynced: DutyAttendanceRecord[] = JSON.parse(
              localStorage.getItem('pdrrmo_duty_attendance_unsynced') || '[]'
            );
            const nextUnsynced = unsynced.filter(
              (r) => !(r.profile_id === currentUserId && r.duty_date === todayKey)
            );
            localStorage.setItem('pdrrmo_duty_attendance_unsynced', JSON.stringify(nextUnsynced));
          } catch {}
        }

        const checkedInLate = computeIsOfficerLate(
          nowIso,
          todayKey,
          targetSchedule?.startTime,
          targetSchedule?.endTime
        );
        showToast(
          checkedInLate
            ? 'Checked In (Late) — Listed under Present On-Duty with Late status.'
            : 'Checked In Successfully — You are now listed as Present On-Duty.'
        );
      } else {
        // PERFORM CHECK OUT (Supports both Today's Shift and Unclosed Prior-Day Shift)
        const targetDutyDate = myAttendance?.duty_date || todayKey;
        const wasPriorShift = targetDutyDate < todayKey;
        const updatedRecord: DutyAttendanceRecord = {
          ...(myAttendance || {
            profile_id: currentUserId,
            duty_date: targetDutyDate,
            check_in_time: nowIso,
          }),
          check_out_time: nowIso,
          status: 'checked_out',
        };

        setTodayAttendance((prev) => {
          const filtered = prev.filter(
            (r) => !(r.profile_id === currentUserId && r.duty_date === targetDutyDate)
          );
          // If closing a prior-day shift, omit from today's active array so today immediately becomes Default: Absent (Check In ready)
          const next = wasPriorShift ? filtered : [updatedRecord, ...filtered];
          shiftOperationsMemoryCache.todayAttendance = next;
          try {
            localStorage.setItem(`pdrrmo_duty_attendance_${todayKey}`, JSON.stringify(next));
          } catch {}
          return next;
        });

        // Persist Check-Out record to Supabase
        const { error: checkOutErr } = await supabase
          .from('duty_attendance_records')
          .upsert(updatedRecord, { onConflict: 'profile_id,duty_date' });

        try {
          const unsynced: DutyAttendanceRecord[] = JSON.parse(
            localStorage.getItem('pdrrmo_duty_attendance_unsynced') || '[]'
          );
          const cleaned = unsynced.filter(
            (r) => !(r.profile_id === currentUserId && r.duty_date === targetDutyDate)
          );
          const nextUnsynced =
            checkOutErr && !wasPriorShift ? [updatedRecord, ...cleaned] : cleaned;
          localStorage.setItem('pdrrmo_duty_attendance_unsynced', JSON.stringify(nextUnsynced));
        } catch {}

        if (checkOutErr) {
          console.warn('Supabase check-out upsert notice (cached locally):', checkOutErr.message);
        }

        showToast(
          wasPriorShift
            ? `Unclosed shift (${formatDutyDateShort(targetDutyDate)}) closed — Ready for today's attendance.`
            : 'Checked Out Successfully — Duty shift completed.'
        );
      }

      if (typeof window !== 'undefined') {
        try {
          const bc = new BroadcastChannel('pdrrmo_shift_sync');
          bc.postMessage({ type: 'shift_state_updated', timestamp: Date.now() });
          bc.close();
        } catch {}
        localStorage.setItem('pdrrmo_shift_sync', Date.now().toString());
      }
    } catch (err: any) {
      console.error('Error toggling duty check-in/out:', err);
      showToast(err.message || 'Failed to update check-in status.');
    } finally {
      setIsCheckingInOut(false);
    }
  }, [
    currentUserId,
    hasUnclosedPriorShift,
    isMyRestDay,
    isMyTravelOrder,
    isMyCheckedOutToday,
    isCheckedIn,
    isBeforeCheckOutWindow,
    checkOutUnlockDate,
    userCoords,
    geofenceConfig,
    refreshGpsLocation,
    myAttendance,
    myAssignedSchedule,
    todayKey,
    liveShiftSchedule,
  ]);

  // Open Edit Attendance Modal with cloned current state
  const handleOpenEditModal = useCallback(() => {
    if (isShiftViewOnly) {
      showToast('You have view-only access. Updating attendance is restricted.');
      return;
    }
    setTempAbsentOfficerIds([...absentOfficerIds]);
    setIsEditModalOpen(true);
  }, [isShiftViewOnly, absentOfficerIds]);

  // Toggle officer attendance directly on card (Mark as Present)
  const handleSetPresent = useCallback(async (officerId: string) => {
    if (isShiftViewOnly) {
      showToast('You have view-only access. Updating attendance is restricted.');
      return;
    }
    const newAbsentIds = absentOfficerIds.filter((id) => id !== officerId);
    setAbsentOfficerIds(newAbsentIds);

    try {
      if (activeShift) {
        await supabase
          .from('shift_duty_personnel')
          .update({ present_at_end: true })
          .eq('shift_id', activeShift.id)
          .eq('profile_id', officerId);
      }

      await supabase
        .from('duty_roster_assignments')
        .update({ notes: null, updated_at: new Date().toISOString() })
        .eq('profile_id', officerId)
        .eq('duty_date', todayKey);

      showToast('Officer marked present for duty');

      // Sync across tabs
      if (typeof window !== 'undefined') {
        try {
          const bc = new BroadcastChannel('pdrrmo_shift_sync');
          bc.postMessage({ type: 'shift_state_updated', timestamp: Date.now() });
          bc.close();
        } catch (e) {}
        localStorage.setItem('pdrrmo_shift_sync', Date.now().toString());
      }
    } catch (err) {
      console.error('Error updating officer attendance in database:', err);
    }
  }, [isShiftViewOnly, absentOfficerIds, activeShift, todayKey]);

  // Toggle officer attendance directly on card (Mark as Absent)
  const handleSetAbsent = useCallback(async (officerId: string) => {
    if (isShiftViewOnly) {
      showToast('You have view-only access. Updating attendance is restricted.');
      return;
    }
    const newAbsentIds = absentOfficerIds.includes(officerId)
      ? absentOfficerIds
      : [...absentOfficerIds, officerId];
    setAbsentOfficerIds(newAbsentIds);

    try {
      if (activeShift) {
        await supabase
          .from('shift_duty_personnel')
          .update({ present_at_end: false })
          .eq('shift_id', activeShift.id)
          .eq('profile_id', officerId);
      }

      await supabase
        .from('duty_roster_assignments')
        .update({ notes: 'Reported Absent / Leave', updated_at: new Date().toISOString() })
        .eq('profile_id', officerId)
        .eq('duty_date', todayKey);

      showToast('Officer marked absent / on leave');

      // Sync across tabs
      if (typeof window !== 'undefined') {
        try {
          const bc = new BroadcastChannel('pdrrmo_shift_sync');
          bc.postMessage({ type: 'shift_state_updated', timestamp: Date.now() });
          bc.close();
        } catch (e) {}
        localStorage.setItem('pdrrmo_shift_sync', Date.now().toString());
      }
    } catch (err) {
      console.error('Error updating officer attendance in database:', err);
    }
  }, [isShiftViewOnly, absentOfficerIds, activeShift, todayKey]);

  // Select Date in Calendar
  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setIsMobileInspectorOpen(true);
  }, []);

  // Save Modal Attendance Changes to Database
  const handleSaveAttendanceModal = async (targetAbsentIds: string[]) => {
    if (isShiftViewOnly) {
      showToast('You have view-only access. Updating attendance is restricted.');
      return;
    }
    try {
      setIsSavingAttendance(true);
      let targetShift = activeShift;

      // 1. If no active operational shift exists in public.shifts, create one
      if (!targetShift) {
        const leadOfficer = liveShiftOfficers.find((o) => o.isLead) || liveShiftOfficers[0] || profiles[0];
        const leadOfficerId = leadOfficer?.id || profile?.id;
        const now = new Date();
        const timeFormatted = format(now, 'HH:mm');

        const { data: newShift, error: createShiftErr } = await supabase
          .from('shifts')
          .insert({
            shift_label: liveShiftSchedule?.name || 'Day Shift (Alpha)',
            shift_date: todayKey,
            start_time: liveShiftSchedule?.startTime || timeFormatted,
            end_time: liveShiftSchedule?.endTime || '16:00',
            status: 'active',
            lead_officer_id: leadOfficerId,
            start_monitoring_details: 'Operational attendance recorded via Shift Console',
            started_at: now.toISOString(),
          })
          .select()
          .single();

        if (createShiftErr || !newShift) {
          throw new Error(createShiftErr?.message || 'Failed to initialize active shift in database');
        }
        targetShift = newShift as ActiveShiftRecord;
        setActiveShift(newShift as ActiveShiftRecord);
      }

      // 2. Upsert assigned personnel into public.shift_duty_personnel
      if (liveShiftOfficers.length > 0 && targetShift) {
        const dutyPersonnelRows = liveShiftOfficers.map((officer) => ({
          shift_id: targetShift!.id,
          profile_id: officer.id,
          role_in_shift: officer.role || 'Duty Officer',
          is_lead: !!officer.isLead,
          present_at_end: !targetAbsentIds.includes(officer.id),
        }));

        const { error: upsertErr } = await supabase
          .from('shift_duty_personnel')
          .upsert(dutyPersonnelRows, { onConflict: 'shift_id,profile_id' });

        if (upsertErr) {
          console.warn('Notice updating shift duty personnel:', upsertErr.message);
        }
      }

      // 3. Update duty_roster_assignments notes for today
      for (const officer of liveShiftOfficers) {
        const isAbsent = targetAbsentIds.includes(officer.id);
        await supabase
          .from('duty_roster_assignments')
          .update({
            notes: isAbsent ? 'Reported Absent / On Leave' : null,
            updated_at: new Date().toISOString(),
          })
          .eq('profile_id', officer.id)
          .eq('duty_date', todayKey);
      }

      // Apply to local state
      setAbsentOfficerIds(targetAbsentIds);
      setIsEditModalOpen(false);
      showToast('Attendance successfully updated and synchronized to database');

      // Sync across tabs
      if (typeof window !== 'undefined') {
        try {
          const bc = new BroadcastChannel('pdrrmo_shift_sync');
          bc.postMessage({ type: 'shift_state_updated', timestamp: Date.now() });
          bc.close();
        } catch (e) {}
        localStorage.setItem('pdrrmo_shift_sync', Date.now().toString());
      }

      fetchShiftData(true);
    } catch (err: any) {
      console.error('Error saving attendance to database:', err);
      showToast(`Error saving attendance: ${err.message || 'Database error'}`);
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // Currently logged-in officer profile for My Schedule view (O(1) lookup)
  const currentOfficer = useMemo(() => {
    if (profile?.id) {
      const found = profilesByIdMap.get(profile.id);
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
  }, [profile, profilesByIdMap, profiles]);

  // Helper to get logged-in officer's schedule for any given date in O(1)
  const getOfficerAssignmentForDate = useCallback(
    (officerId: string, date: Date) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const assign = assignmentsByOfficerDateMap.get(`${officerId}_${dateKey}`);

      if (!assign) {
        return { type: 'NONE' as const, shift: null, isLead: false };
      }

      if (assign.assignment_type === 'rest') {
        return { type: 'REST' as const, shift: null, isLead: false };
      }

      if (assign.assignment_type === 'travel') {
        return { type: 'TRAVEL' as const, shift: null, isLead: false };
      }

      const matchedShift = assign.shift_schedule_id
        ? schedulesByIdMap.get(assign.shift_schedule_id) || null
        : null;
      return {
        type: 'DUTY' as const,
        shift: matchedShift,
        isLead: assign.is_lead,
      };
    },
    [assignmentsByOfficerDateMap, schedulesByIdMap]
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
      return { dutyDays: 0, restDays: 0, travelDays: 0, totalHours: 0 };
    }

    const daysInMonth = eachDayOfInterval({
      start: startOfMonth(calendarMonth),
      end: endOfMonth(calendarMonth),
    });

    let dutyCount = 0;
    let restCount = 0;
    let travelCount = 0;

    daysInMonth.forEach((day) => {
      const assign = getOfficerAssignmentForDate(currentOfficer.id, day);
      if (assign.type === 'DUTY') dutyCount++;
      else if (assign.type === 'REST') restCount++;
      else if (assign.type === 'TRAVEL') travelCount++;
    });

    return {
      dutyDays: dutyCount,
      restDays: restCount,
      travelDays: travelCount,
      totalHours: (dutyCount + travelCount) * 8,
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
              onClick={() => fetchShiftData(true)}
              disabled={isLoading || isRefreshing}
              className="p-2 rounded-xl border border-[#E2E8F0] text-[#505F76] hover:text-[#1E293B] hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Roster Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || isRefreshing ? 'animate-spin text-[#004AC6]' : ''}`} />
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
        {/* VIEW 1: SCHEDULE DASHBOARD (KEEP-ALIVE - NO UNMOUNTING ON TAB SWITCH) */}
        {/* ========================================================================= */}
        <div
          className={activeTab === 'dashboard' ? 'space-y-6 block' : 'hidden'}
          aria-hidden={activeTab !== 'dashboard'}
        >
            {/* ===================================================================== */}
            {/* OFFICER DUTY CHECK-IN / CHECK-OUT & GEOFENCE SECURITY TERMINAL */}
            {/* ===================================================================== */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                {/* Left: Officer Identity & Current Duty Status */}
                <div className="flex items-start sm:items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 shadow-2xs ${
                      hasUnclosedPriorShift
                        ? 'bg-amber-50 text-amber-600 border-amber-300'
                        : isMyTravelOrder
                          ? 'bg-purple-500/15 text-purple-600 border-purple-300/80'
                          : isMyRestDay
                            ? 'bg-amber-50 text-amber-600 border-amber-200'
                            : isCheckedIn
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : isMyCheckedOutToday
                                ? 'bg-blue-50 text-[#004AC6] border-blue-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {hasUnclosedPriorShift ? (
                      <AlertCircle className="w-6 h-6" />
                    ) : isMyTravelOrder ? (
                      <Plane className="w-6 h-6" />
                    ) : isMyRestDay ? (
                      <Coffee className="w-6 h-6" />
                    ) : isCheckedIn ? (
                      <ShieldCheck className="w-6 h-6" />
                    ) : isMyCheckedOutToday ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <Clock className="w-6 h-6" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                        Duty Attendance Check-In Terminal
                      </h2>
                      {hasUnclosedPriorShift && myAttendance ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300">
                          <AlertCircle className="w-3 h-3" />
                          Unclosed Shift ({formatDutyDateShort(myAttendance.duty_date)})
                        </span>
                      ) : isMyTravelOrder ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 border border-purple-300/80">
                          <Plane className="w-3 h-3" />
                          Travel Order
                        </span>
                      ) : isMyRestDay ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Coffee className="w-3 h-3" />
                          Rest Day Schedule
                        </span>
                      ) : isCheckedIn ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Present On-Duty
                        </span>
                      ) : isMyCheckedOutToday ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Checked Out
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          Default: Absent (Not Checked In)
                        </span>
                      )}
                      {isCheckedIn && isMyLate && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300">
                          <Clock className="w-3 h-3" />
                          Late
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#505F76]">
                      {hasUnclosedPriorShift && myAttendance
                        ? `You have an unclosed shift from ${formatDutyDateShort(
                            myAttendance.duty_date
                          )} (checked in at ${format(
                            new Date(myAttendance.check_in_time),
                            'hh:mm a'
                          )}) · Click Check Out first before checking in for today.`
                        : isMyTravelOrder
                          ? 'You are on an Official Travel Order today and are automatically marked Present On-Duty.'
                          : isMyRestDay
                            ? 'You are scheduled for a Rest Day today. Check-In and Check-Out are disabled.'
                            : isCheckedIn && myAttendance?.check_in_time
                              ? isBeforeCheckOutWindow && checkOutUnlockDate
                                ? `Checked in at ${format(
                                    new Date(myAttendance.check_in_time),
                                    'hh:mm a'
                                  )} · Check Out unlocks at ${format(
                                    checkOutUnlockDate,
                                    'hh:mm a'
                                  )} (30 mins before shift end).`
                                : `Checked in at ${format(
                                    new Date(myAttendance.check_in_time),
                                    'hh:mm a'
                                  )} · Click Check Out when completing your shift.`
                              : isMyCheckedOutToday && myAttendance?.check_out_time
                                ? `Completed shift — checked out at ${format(
                                    new Date(myAttendance.check_out_time),
                                    'hh:mm a'
                                  )}. Resets automatically at 12:00 AM or on your next scheduled shift.`
                                : 'All scheduled personnel are marked Absent by default until Checked In within the station geofence.'}
                    </p>
                  </div>
                </div>

                {/* Right: Checked Out List Button + Primary Check In / Check Out Action Button */}
                <div className="flex flex-col items-stretch sm:items-end justify-end gap-2 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-[#E2E8F0]">
                  <div className="flex flex-wrap items-center justify-end gap-2.5 w-full sm:w-auto">
                    {/* Checked Out List Modal Trigger Button (Always Enabled) */}
                    <button
                      type="button"
                      onClick={() => setIsCheckedOutModalOpen(true)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-slate-100 text-[#1E293B] transition-all shadow-2xs cursor-pointer flex-1 sm:flex-initial"
                    >
                      <UserCheck className="w-4 h-4 text-[#004AC6]" />
                      <span>Checked Out</span>
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200 font-mono">
                        {checkedOutOfficers.length}
                      </span>
                    </button>

                    {/* Primary Check In / Check Out / Checked Out Action Button */}
                    <button
                      type="button"
                      onClick={handleToggleCheckInOut}
                      disabled={isCheckInOutDisabled}
                      className={`inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm flex-1 sm:flex-initial ${
                        isCheckInOutDisabled
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75'
                          : isCheckedIn
                            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 cursor-pointer'
                            : 'bg-[#004AC6] hover:bg-[#003896] text-white shadow-[#004AC6]/20 cursor-pointer'
                      }`}
                    >
                      {isCheckingInOut ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : isCheckedIn ? (
                        <>
                          <LogOut className="w-4 h-4" />
                          <span>Check Out</span>
                        </>
                      ) : isMyCheckedOutToday ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Checked Out</span>
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          <span>Check In</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Status / Disabled Reason Indicator */}
                  {hasUnclosedPriorShift ? (
                    isOutsideGeofence ? (
                      <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {!userCoords
                          ? 'Disabled: Location is turned OFF'
                          : 'Disabled: Must be inside GeoFence to close prior shift'}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Close your {formatDutyDateShort(myAttendance?.duty_date)} shift first to unlock today&apos;s Check In
                      </span>
                    )
                  ) : isMyTravelOrder ? (
                    <span className="text-[11px] font-semibold text-purple-700 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Disabled on Travel Order (Auto-Present)
                    </span>
                  ) : isMyRestDay ? (
                    <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Disabled on Rest Day Schedule
                    </span>
                  ) : isMyCheckedOutToday ? (
                    <span className="text-[11px] font-medium text-[#505F76] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      Shift Completed · Resets at 12:00 AM or next shift
                    </span>
                  ) : isOutsideGeofence ? (
                    <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {!userCoords
                        ? 'Disabled: Location is turned OFF'
                        : 'Disabled: Must be inside GeoFence coverage area'}
                    </span>
                  ) : isBeforeCheckOutWindow && checkOutUnlockDate ? (
                    <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      Check Out unlocks at {format(checkOutUnlockDate, 'hh:mm a')} (30 mins before shift end)
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      GeoFence Verified · Ready to {isCheckedIn ? 'Check Out' : 'Check In'}
                    </span>
                  )}
                </div>
              </div>
            </div>

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

            {/* 3-Column Grid Layout: Present, Absent, and Rest Day Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* 1. PRESENT ON-DUTY PERSONNEL CARD */}
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col space-y-4 min-h-[480px]">
                {/* Card Header */}
                <div className="space-y-3 pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-2xl flex items-center justify-center border shrink-0"
                        style={{
                          backgroundColor: liveShiftSchedule ? `${liveShiftSchedule.color || '#004AC6'}15` : '#EFF6FF',
                          borderColor: liveShiftSchedule ? `${liveShiftSchedule.color || '#004AC6'}30` : '#BFDBFE',
                          color: liveShiftSchedule?.color || '#004AC6',
                        }}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-[#1E293B] truncate">
                            Present On-Duty
                          </h3>
                          <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs font-mono shrink-0">
                            {isLoading ? '...' : filteredPresentOfficers.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Controls: Icon-Free Roles & Attendance Filters */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="min-w-0">
                      <CustomDropdown
                        options={roleFilterDropdownOptions}
                        value={selectedRoleFilter}
                        onChange={(val) => setSelectedRoleFilter(val)}
                        placeholder="Roles"
                        size="sm"
                        pill
                      />
                    </div>
                    <div className="min-w-0">
                      <CustomDropdown
                        options={attendanceFilterDropdownOptions}
                        value={selectedAttendanceFilter}
                        onChange={(val) => setSelectedAttendanceFilter(val)}
                        placeholder="Attendance"
                        size="sm"
                        pill
                      />
                    </div>
                  </div>
                </div>

                {/* Present Officers List */}
                <div className="flex-1 flex flex-col justify-between min-h-0">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center gap-3">
                          <Skeleton variant="circular" className="w-9 h-9 shrink-0" />
                          <div className="min-w-0 flex-1 space-y-1">
                            <Skeleton variant="rounded" className="h-3.5 w-24" />
                            <Skeleton variant="rounded" className="h-2.5 w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <PaginatedPersonnelList
                      items={filteredPresentOfficers}
                      pageSize={5}
                      page={presentPage}
                      onPageChange={setPresentPage}
                      renderItem={(member) => (
                        <PresentOfficerCard
                          key={member.id}
                          member={member}
                          isClickable={!isShiftViewOnly}
                          onSelect={handleSelectOfficerForDetail}
                        />
                      )}
                      emptyState={
                        presentOfficers.length > 0 &&
                        (selectedRoleFilter !== 'ALL' || selectedAttendanceFilter !== 'ALL') ? (
                          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5 my-auto">
                            <Users className="w-6 h-6 text-slate-400 mx-auto" />
                            <p className="text-xs font-bold text-[#1E293B]">
                              No Matching Personnel
                            </p>
                            <p className="text-[11px] text-[#757680]">
                              No checked-in officers match the selected role and attendance filters.
                            </p>
                          </div>
                        ) : (
                          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5 my-auto">
                            <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                            <p className="text-xs font-bold text-[#1E293B]">
                              No Officers Checked In Yet
                            </p>
                            <p className="text-[11px] text-[#757680]">
                              Officers appear here once they click Check In within the geofence area.
                            </p>
                          </div>
                        )
                      }
                    />
                  )}
                </div>
              </div>

              {/* 2. ABSENT PERSONNEL CARD */}
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col space-y-4 min-h-[480px]">
                {/* Card Header */}
                <div className="space-y-1.5 pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
                        <UserX className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
                            Absent Personnel
                          </h3>
                          <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs font-mono">
                            {isLoading ? '...' : filteredAbsentOfficers.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full shrink-0">
                      Default: Absent
                    </span>
                  </div>
                </div>

                {/* Absent Officers List */}
                <div className="flex-1 flex flex-col justify-between min-h-0">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/30 flex items-center gap-3">
                          <Skeleton variant="circular" className="w-9 h-9 shrink-0" />
                          <div className="min-w-0 flex-1 space-y-1">
                            <Skeleton variant="rounded" className="h-3.5 w-24" />
                            <Skeleton variant="rounded" className="h-2.5 w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <PaginatedPersonnelList
                      items={filteredAbsentOfficers}
                      pageSize={5}
                      page={absentPage}
                      onPageChange={setAbsentPage}
                      renderItem={(person) => (
                        <AbsentOfficerCard
                          key={person.id}
                          person={person}
                          isClickable={!isShiftViewOnly}
                          onSelect={handleSelectOfficerForDetail}
                        />
                      )}
                      emptyState={
                        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5 my-auto">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                          <p className="text-xs font-bold text-[#1E293B]">
                            No Absent Personnel
                          </p>
                          <p className="text-[11px] text-[#757680]">
                            All scheduled personnel are on-duty or accounted for.
                          </p>
                        </div>
                      }
                    />
                  )}
                </div>
              </div>

              {/* 3. REST DAY / OFF-DUTY PERSONNEL CARD */}
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col space-y-4 min-h-[480px]">
                {/* Card Header */}
                <div className="space-y-1.5 pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                        <Coffee className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
                            Rest Day Personnel
                          </h3>
                          <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs font-mono">
                            {isLoading ? '...' : todayRestPersonnel.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full shrink-0">
                      Off Duty
                    </span>
                  </div>
                </div>

                {/* Rest Day Officers List */}
                <div className="flex-1 flex flex-col justify-between min-h-0">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center gap-3">
                          <Skeleton variant="circular" className="w-9 h-9 shrink-0" />
                          <div className="min-w-0 flex-1 space-y-1">
                            <Skeleton variant="rounded" className="h-3.5 w-24" />
                            <Skeleton variant="rounded" className="h-2.5 w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <PaginatedPersonnelList
                      items={todayRestPersonnel}
                      pageSize={5}
                      page={restPage}
                      onPageChange={setRestPage}
                      renderItem={(person) => (
                        <RestDayOfficerCard
                          key={person.id}
                          person={person}
                          isClickable={!isShiftViewOnly}
                          onSelect={handleSelectOfficerForDetail}
                        />
                      )}
                      emptyState={
                        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5 my-auto">
                          <Coffee className="w-6 h-6 text-slate-400 mx-auto" />
                          <p className="text-xs font-bold text-[#1E293B]">
                            No Rest Day Personnel
                          </p>
                          <p className="text-[11px] text-[#757680]">
                            No personnel scheduled for rest day today.
                          </p>
                        </div>
                      }
                    />
                  )}
                </div>
              </div>
            </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 2: MY SCHEDULE (PERSONAL CALENDAR - KEEP-ALIVE) */}
        {/* ========================================================================= */}
        <div
          className={activeTab === 'my-schedule' ? 'space-y-6 block' : 'hidden'}
          aria-hidden={activeTab !== 'my-schedule'}
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
                  <OfficerAvatar officer={currentOfficer} size="lg" />
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
                <div className="flex items-center gap-4 text-xs font-semibold text-[#505F76] pt-1 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-[#004AC6]" />
                    Duty Day
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-amber-500" />
                    Rest Day
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-purple-600" />
                    Travel Order
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
                    {calendarDays.map((cell) => (
                      <CalendarDayCell
                        key={format(cell.date, 'yyyy-MM-dd')}
                        cell={cell}
                        onSelectDate={handleSelectDate}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Right 1 Col: Selected Day Duty Inspector Card (Desktop screen only) */}
              <div className="hidden lg:block">
                {isLoading ? (
                  <PersonalDayDetailSkeleton />
                ) : (
                  <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-xs">
                    <DutyInspectorContent
                      selectedDate={selectedDate}
                      selectedDayInfo={selectedDayInfo}
                    />
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE FULL-SCREEN MODAL: DUTY DAY INSPECTOR (Mobile screen only) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isMobileInspectorOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full h-full bg-white flex flex-col overflow-hidden"
            >
              <DutyInspectorContent
                selectedDate={selectedDate}
                selectedDayInfo={selectedDayInfo}
                onClose={() => setIsMobileInspectorOpen(false)}
                isModal={true}
              />
              <div className="p-4 border-t border-[#E2E8F0] bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMobileInspectorOpen(false)}
                  className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1E293B] font-bold text-sm transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  const isAbsent = tempAbsentOfficerIds.includes(officer.id);

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
                        <OfficerAvatar
                          officer={officer}
                          size="md"
                          fallbackBg={isAbsent ? 'bg-rose-600 text-white' : 'bg-[#004AC6] text-white'}
                        />
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
                          onClick={() =>
                            setTempAbsentOfficerIds((prev) => prev.filter((id) => id !== officer.id))
                          }
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
                          onClick={() =>
                            setTempAbsentOfficerIds((prev) =>
                              prev.includes(officer.id) ? prev : [...prev, officer.id]
                            )
                          }
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
                  {liveShiftOfficers.length - tempAbsentOfficerIds.length} Present · {tempAbsentOfficerIds.length} Absent
                </span>
                <PrimaryButton
                  type="button"
                  size="md"
                  pill
                  disabled={isSavingAttendance}
                  onClick={() => handleSaveAttendanceModal(tempAbsentOfficerIds)}
                  leftIcon={isSavingAttendance ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                >
                  {isSavingAttendance ? 'Saving Attendance...' : 'Save & Apply Attendance'}
                </PrimaryButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* FLOATING MODAL: CHECKED OUT PERSONNEL LIST (DEBOUNCED SEARCH + PROFILE/NAME/TIME) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isCheckedOutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckedOutModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Floating Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden z-10 flex flex-col max-h-[82vh]"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/20 shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-[#1E293B] truncate">
                        Checked Out Personnel
                      </h3>
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200 font-mono shrink-0">
                        {checkedOutOfficers.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#757680] mt-0.5 truncate">
                      Completed duty check-outs for today ({formatDutyDateShort(todayKey)})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCheckedOutModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                  aria-label="Close Checked Out Modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Debounced Search Bar */}
              <div className="p-4 border-b border-[#E2E8F0] bg-white shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#757680] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={checkedOutSearchQuery}
                    onChange={(e) => setCheckedOutSearchQuery(e.target.value)}
                    placeholder="Search officer name..."
                    className="w-full pl-9 pr-9 py-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  />
                  {checkedOutSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCheckedOutSearchQuery('')}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/70 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Checked Out List (Profile Avatar + Name + Time Checked Out ONLY) */}
              <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                {checkedOutOfficers.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
                    <LogOut className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-[#1E293B]">
                      No Checked Out Personnel Yet
                    </p>
                    <p className="text-[11px] text-[#757680]">
                      Officers who complete their shift and check out today will appear here.
                    </p>
                  </div>
                ) : filteredCheckedOutOfficers.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
                    <Search className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-[#1E293B]">
                      No Matching Officer
                    </p>
                    <p className="text-[11px] text-[#757680]">
                      No checked out officer matches &quot;{checkedOutSearchQuery.trim()}&quot;.
                    </p>
                  </div>
                ) : (
                  filteredCheckedOutOfficers.map((item) => {
                    const formattedOutTime =
                      item.checkOutTime && !isNaN(new Date(item.checkOutTime).getTime())
                        ? format(new Date(item.checkOutTime), 'hh:mm a')
                        : '—';

                    return (
                      <div
                        key={item.officer.id}
                        className="p-3 rounded-2xl border border-[#E2E8F0] bg-white hover:border-[#CBD5E1] transition-all flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <OfficerAvatar officer={item.officer} size="md" />
                          <span className="text-xs sm:text-sm font-bold text-[#1E293B] truncate">
                            {item.officer.name}
                          </span>
                        </div>
                        <span className="text-xs font-bold font-mono text-[#004AC6] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full shrink-0">
                          {formattedOutTime}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. SIDE MODAL: PERSONNEL PROFILE & ATTENDANCE DETAILS (FULL ACCESS ONLY) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {!isShiftViewOnly && selectedOfficerForDetail && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOfficerForDetail(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 w-full sm:w-auto">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="w-full sm:w-screen sm:max-w-md md:max-w-lg bg-[#F8FAFC] shadow-2xl flex flex-col h-full border-l border-[#E2E8F0] overflow-hidden z-10"
              >
                {/* Drawer Header */}
                <div className="p-4 sm:p-5 border-b border-[#E2E8F0] bg-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/20 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-[#1E293B] truncate">
                          Personnel Details
                        </h2>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200">
                          Full Access
                        </span>
                      </div>
                      <p className="text-xs text-[#505F76] truncate mt-0.5">
                        Officer profile and live duty attendance breakdown
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedOfficerForDetail(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                    aria-label="Close Personnel Details"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Scrollable Body: Exactly Two Cards */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                  {/* CARD 1: USER PROFILE */}
                  <div className="bg-white rounded-3xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
                    {/* Card 1 Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#004AC6]" />
                        <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                          User Profile
                        </h3>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          (selectedOfficerForDetail.userRole || '').includes('admin')
                            ? 'bg-blue-50 text-[#004AC6] border-blue-200'
                            : (selectedOfficerForDetail.userRole || '').includes('monitoring')
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {(selectedOfficerForDetail.userRole || 'Staff').toUpperCase()}
                      </span>
                    </div>

                    {/* Officer Hero Block */}
                    <div className="flex items-center gap-3.5">
                      <OfficerAvatar
                        officer={selectedOfficerForDetail}
                        size="xl"
                        className="shadow-xs border-2 border-white ring-2 ring-[#E2E8F0]"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base sm:text-lg font-bold text-[#1E293B] truncate leading-tight">
                            {selectedOfficerForDetail.name}
                          </h4>
                          {selectedOfficerForDetail.isLead && (
                            <span className="text-[9px] font-bold bg-blue-100 text-[#004AC6] px-1.5 py-0.2 rounded shrink-0">
                              LEAD
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-[#505F76] truncate">
                          {selectedOfficerForDetail.role}
                        </p>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11px] font-semibold text-emerald-700">
                            Active Personnel
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Profile Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70">
                        <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
                          Badge Number
                        </span>
                        <span className="text-xs font-bold text-[#1E293B] font-mono mt-0.5 block truncate">
                          {selectedOfficerForDetail.badgeNumber}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70">
                        <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
                          Assigned Station
                        </span>
                        <span className="text-xs font-bold text-[#1E293B] mt-0.5 block truncate">
                          {selectedOfficerForDetail.station || 'DOC Command Center'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70">
                        <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
                          Email Address
                        </span>
                        <span
                          className="text-xs font-bold text-[#1E293B] mt-0.5 block truncate"
                          title={selectedOfficerForDetail.email || undefined}
                        >
                          {selectedOfficerForDetail.email || 'None registered'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70">
                        <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
                          Default Shift
                        </span>
                        <span className="text-xs font-bold text-[#1E293B] mt-0.5 block truncate">
                          {selectedOfficerForDetail.defaultShift || 'Rotational / Dynamic'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70 sm:col-span-2">
                        <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
                          Division / Department
                        </span>
                        <span className="text-xs font-bold text-[#1E293B] mt-0.5 block truncate">
                          {selectedOfficerForDetail.division || 'Provincial Disaster Risk Reduction Management Office'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: ATTENDANCE DETAILS */}
                  <div className="bg-white rounded-3xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
                    {/* Card 2 Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-[#004AC6]" />
                        <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                          Attendance Details
                        </h3>
                      </div>

                      {/* Current Status Pill */}
                      {isSelectedOfficerTravelOrder ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 border border-purple-300/80">
                          <Plane className="w-3 h-3" />
                          Travel Order
                        </span>
                      ) : isSelectedOfficerRestDay ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Coffee className="w-3 h-3" />
                          Rest Day
                        </span>
                      ) : selectedOfficerAttendance?.status === 'checked_in' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Present On-Duty
                        </span>
                      ) : selectedOfficerAttendance?.status === 'checked_out' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Checked Out
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          Default: Absent
                        </span>
                      )}
                    </div>

                    {/* Contextual Status Banner */}
                    {selectedOfficerDetailLate ? (
                      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5">
                        <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-900 leading-relaxed">
                          <span className="font-bold">Late Arrival:</span> Checked in at{' '}
                          <span className="font-semibold">{selectedOfficerCheckInFormatted}</span>, after the scheduled start time of{' '}
                          <span className="font-semibold">{selectedOfficerSchedule?.startTime || '08:00'}</span>.
                        </div>
                      </div>
                    ) : isSelectedOfficerTravelOrder ? (
                      <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-300/80 flex items-start gap-2.5">
                        <Plane className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-purple-900 leading-relaxed">
                          <span className="font-bold">Official Travel Order:</span> Deployed on external official travel. Automatically listed as Present On-Duty.
                        </div>
                      </div>
                    ) : isSelectedOfficerRestDay ? (
                      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5">
                        <Coffee className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-900 leading-relaxed">
                          <span className="font-bold">Rest Day Schedule:</span> Scheduled off-duty today. Shift check-in is not required.
                        </div>
                      </div>
                    ) : selectedOfficerAttendance?.status === 'checked_in' ? (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-emerald-900 leading-relaxed">
                          <span className="font-bold">On-Time Arrival:</span> Checked in on time at{' '}
                          <span className="font-semibold">{selectedOfficerCheckInFormatted}</span>. Currently on active duty.
                        </div>
                      </div>
                    ) : selectedOfficerAttendance?.status === 'checked_out' ? (
                      <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-[#004AC6] shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-900 leading-relaxed">
                          <span className="font-bold">Shift Completed:</span> Checked out today at{' '}
                          <span className="font-semibold">{selectedOfficerCheckOutFormatted}</span>.
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-rose-900 leading-relaxed">
                          <span className="font-bold">Not Checked In:</span> Listed as Absent by default until the officer verifies location and clicks Check In.
                        </div>
                      </div>
                    )}

                    {/* Attendance Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70">
                        <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
                          Duty Date
                        </span>
                        <span className="text-xs font-bold text-[#1E293B] mt-0.5 block truncate">
                          {selectedOfficerDutyDateFormatted}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70">
                        <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
                          Assigned Shift
                        </span>
                        <span className="text-xs font-bold text-[#1E293B] mt-0.5 block truncate">
                          {selectedOfficerSchedule ? `${selectedOfficerSchedule.name} (${selectedOfficerSchedule.time})` : 'Live Shift Rotation'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70">
                        <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
                          Check-In Timestamp
                        </span>
                        <span className="text-xs font-bold font-mono text-[#1E293B] mt-0.5 block truncate">
                          {selectedOfficerCheckInFormatted || 'Not Checked In'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70">
                        <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
                          Check-Out Timestamp
                        </span>
                        <span className="text-xs font-bold font-mono text-[#1E293B] mt-0.5 block truncate">
                          {selectedOfficerCheckOutFormatted || (selectedOfficerAttendance?.status === 'checked_in' ? 'Active On-Duty' : '—')}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70">
                        <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
                          Punctuality Status
                        </span>
                        <span className="text-xs font-bold text-[#1E293B] mt-0.5 block truncate">
                          {isSelectedOfficerTravelOrder
                            ? 'Travel Order (Exempt)'
                            : isSelectedOfficerRestDay
                            ? 'Rest Day (Off Duty)'
                            : selectedOfficerDetailLate
                            ? 'Late Arrival'
                            : selectedOfficerAttendance?.status === 'checked_in'
                            ? 'On Time Check-In'
                            : selectedOfficerAttendance?.status === 'checked_out'
                            ? 'Shift Completed'
                            : 'Pending Check-In'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70">
                        <span className="text-[10px] font-bold text-[#757680] uppercase tracking-wider block">
                          Station GeoFence
                        </span>
                        <span className="text-xs font-bold text-[#1E293B] mt-0.5 block truncate">
                          {geofenceConfig.name || 'DOC Command Perimeter'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drawer Footer */}
                <div className="p-4 sm:p-5 border-t border-[#E2E8F0] bg-white flex items-center justify-between shrink-0">
                  <span className="text-[11px] text-[#757680]">
                    PDRRMO Disaster Operations Center
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedOfficerForDetail(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-[#1E293B] transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
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

      {/* ========================================================================= */}
      {/* 6. LOCATION ACCESS NOTIFICATION BANNER (VISIBLE IF PROMPT OR BLOCKED) */}
      {/* ========================================================================= */}
      <LocationAccessBanner
        screenName="Shift Duty Station"
        onLocationGranted={(coords) => {
          const newCoords = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracyMeters: 10,
            timestamp: Date.now(),
          };
          shiftOperationsMemoryCache.userCoords = newCoords;
          setUserCoords(newCoords);
        }}
        onLocationStateChange={(state) => {
          if (state !== 'granted') {
            shiftOperationsMemoryCache.userCoords = null;
            setUserCoords(null);
          }
        }}
      />
    </AppLayoutShell>
  );
}
