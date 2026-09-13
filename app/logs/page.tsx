'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Radio,
  FileText,
  Search,
  Filter,
  Plus,
  Play,
  Square,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  X,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Tag,
  Users,
  CheckCircle2,
  AlertTriangle,
  Check,
  ShieldAlert,
  PlusCircle,
  Loader2,
  Lock,
  Info,
  Archive as ArchiveIcon,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton, ToggleButton } from '@/components/button';
import { CustomDropdown, CustomDropdownOption, CheckboxInput, RichTextEditor, stripEmojis } from '@/components/input';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { generateDailyLogsPDF } from '@/lib/pdf-generator';
import { Skeleton } from '@/components/skeleton';
import { format } from 'date-fns';

// =============================================================================
// INTERFACES & TYPES
// =============================================================================

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
}

// =============================================================================
// FALLBACK SEED DATA
// =============================================================================

const fallbackPersonnelList: DutyPersonnel[] = [
  { id: 'p-1', name: 'Alex Thompson', role: 'System Admin / Lead Officer', avatarInitials: 'AT', badgeNumber: 'OPC-1001', defaultShift: 'Day Shift (Alpha)' },
  { id: 'p-2', name: 'Supervisor Elena Cruz', role: 'Chief Dispatch Operations', avatarInitials: 'EC', badgeNumber: 'OPC-1042', defaultShift: 'Day Shift (Alpha)' },
  { id: 'p-3', name: 'Mark Salazar', role: 'SecOps Node #04 Responder', avatarInitials: 'MS', badgeNumber: 'OPC-8821', defaultShift: 'Day Shift (Alpha)' },
  { id: 'p-4', name: 'Sarah Jenkins', role: 'Telemetry & Radio Operator', avatarInitials: 'SJ', badgeNumber: 'OPC-3012', defaultShift: 'Swing Shift (Bravo)' },
  { id: 'p-5', name: 'David Tan', role: 'Emergency Dispatcher', avatarInitials: 'DT', badgeNumber: 'OPC-2045', defaultShift: 'Swing Shift (Bravo)' },
  { id: 'p-6', name: 'Maria Santos', role: 'Communications Specialist', avatarInitials: 'MS', badgeNumber: 'OPC-4109', defaultShift: 'Graveyard Shift (Charlie)' },
];


const fallbackSchedules: ShiftScheduleItem[] = [
  { id: 'sched-1', name: 'Day Shift (Alpha)', start_time: '06:00', end_time: '14:00', duration: '8 Hours', is_active: true },
  { id: 'sched-2', name: 'Swing Shift (Bravo)', start_time: '14:00', end_time: '22:00', duration: '8 Hours', is_active: true },
  { id: 'sched-3', name: 'Graveyard Shift (Charlie)', start_time: '22:00', end_time: '06:00', duration: '8 Hours', is_active: true },
];

// Helper to compute initials from full name
function getInitials(name: string): string {
  if (!name) return 'MO';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Helper to format shift start time concisely
function formatShiftStartTime(shift: ActiveShiftRecord | null): string {
  if (!shift) return '';
  if (shift.started_at) {
    try {
      const d = new Date(shift.started_at);
      if (!isNaN(d.getTime())) {
        return format(d, 'h:mm a');
      }
    } catch (_) {}
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

// OfficerAvatar component with profile image & fallback initials
interface OfficerAvatarProps {
  officer?: {
    name?: string;
    avatarUrl?: string | null;
    avatarInitials?: string;
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

// Helper to format timestamps to 24H military notation: "1430H"
function getMilitaryTime(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}H`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function LogsPage() {
  const { user, profile, isAdmin, canWrite, isViewOnly } = useAuth();
  const isLogsViewOnly = isViewOnly('Logs');
  const canModifyLogs = canWrite('Logs');

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data States
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('ALL');

  // Debounce search input by 300ms for fast and responsive table filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Shift States (Dynamic & Realtime from Supabase)
  const [activeShift, setActiveShift] = useState<ActiveShiftRecord | null>(null);
  const [availableOfficers, setAvailableOfficers] = useState<DutyPersonnel[]>(fallbackPersonnelList);
  const [shiftSchedules, setShiftSchedules] = useState<ShiftScheduleItem[]>(fallbackSchedules);

  // Modals & Drawers
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [isEndShiftModalOpen, setIsEndShiftModalOpen] = useState(false);
  const [selectedShiftSchedule, setSelectedShiftSchedule] = useState<string>('Day Shift (Alpha)');
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);
  const [isIncidentReportOn, setIsIncidentReportOn] = useState(false);
  const [incidentDetails, setIncidentDetails] = useState('');
  const [shiftToast, setShiftToast] = useState<{ message: string; submessage?: string; type: 'start' | 'end' | 'info' } | null>(null);

  // Start Shift Monitoring Details State with Visual Rich Text Editor
  const defaultMonitoringDetails =
    '<ul><li>Coastal and inland telemetry stations operating normally</li><li>Weather radar scanning for localized precipitation</li><li><strong>142.500 MHz</strong> primary emergency frequency monitoring active</li></ul>';
  const [startShiftMonitoringDetails, setStartShiftMonitoringDetails] = useState(defaultMonitoringDetails);

  // Report Type Options State (strictly queried from public.report_types)
  const [reportTypeOptionsList, setReportTypeOptionsList] = useState<CustomDropdownOption[]>([]);
  const [filterDropdownOptions, setFilterDropdownOptions] = useState<CustomDropdownOption[]>([
    { value: 'ALL', label: 'All Report Types' },
  ]);

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
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState(getMilitaryTime());
  const [formDescription, setFormDescription] = useState('');

  // Derived Shift Active Status
  const isShiftActive = activeShift !== null;

  // ===========================================================================
  // 1. SHIFT SCHEDULE & HANDOVER ELIGIBILITY ENGINE
  // ===========================================================================

  // Evaluates if user can START a shift
  const scheduleEligibility = useMemo(() => {
    // 1. System Admins have permanent clearance to start shifts anytime
    if (isAdmin || profile?.role === 'admin') {
      return {
        isEligible: true,
        scheduleName: 'Admin / System Clearance',
        scheduleHours: '24/7 Access',
        reason: null,
      };
    }

    // 2. Determine user's assigned default shift
    const userShiftName = profile?.default_shift || 'Day Shift (Alpha)';
    const matchedSchedule =
      shiftSchedules.find((s) => s.name.toLowerCase() === userShiftName.toLowerCase()) ||
      shiftSchedules[0] ||
      fallbackSchedules[0];

    const startTimeStr = matchedSchedule.start_time || '06:00';
    const endTimeStr = matchedSchedule.end_time || '14:00';

    // Parse start & end hours/minutes
    const [startH, startM] = startTimeStr.split(':').map((v) => parseInt(v, 10) || 0);
    const [endH, endM] = endTimeStr.split(':').map((v) => parseInt(v, 10) || 0);

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    // Buffer: Allow starting up to 45 minutes before shift starts and up to 45 minutes after shift ends for handover
    const bufferMins = 45;
    let isWithinWindow = false;

    if (startMins < endMins) {
      // Normal daytime shift (e.g. 06:00 to 14:00)
      isWithinWindow = currentMins >= startMins - bufferMins && currentMins <= endMins + bufferMins;
    } else {
      // Overnight / Graveyard shift crossing midnight (e.g. 22:00 to 06:00)
      isWithinWindow = currentMins >= startMins - bufferMins || currentMins <= endMins + bufferMins;
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

  // Evaluates if user can END the active shift (Prevents non-designated users from stopping someone else's shift)
  const canEndCurrentShift = useMemo(() => {
    if (!activeShift) return false;
    // 1. System Admins can always perform handover/end shift
    if (isAdmin || profile?.role === 'admin') return true;

    const currentUserId = profile?.id || user?.id;

    // 2. Lead Officer who started this active shift
    if (currentUserId && activeShift.lead_officer_id === currentUserId) return true;

    // 3. Officer is explicitly present in the active shift's duty personnel roster
    if (currentUserId && activeShift.personnel.some((p) => p.id === currentUserId)) return true;

    // 4. Officer's assigned default_shift matches the active shift's label
    const userShift = (profile?.default_shift || 'Day Shift (Alpha)').trim().toLowerCase();
    const activeShiftLabel = (activeShift.shift_label || '').trim().toLowerCase();
    if (userShift === activeShiftLabel) return true;

    return false;
  }, [activeShift, isAdmin, profile, user]);

  // Derived canAddLogs (Requires active shift, write permissions, and duty/schedule authorization)
  const canAddLogs = isShiftActive && canModifyLogs && canEndCurrentShift;

  // Designated Personnel filtered specifically to the selected shift schedule
  const designatedOfficers = useMemo(() => {
    const shiftTarget = (selectedShiftSchedule || profile?.default_shift || 'Day Shift (Alpha)').trim().toLowerCase();
    return availableOfficers.filter((officer) => {
      const officerShift = (officer.defaultShift || 'Day Shift (Alpha)').trim().toLowerCase();
      return officerShift === shiftTarget;
    });
  }, [availableOfficers, selectedShiftSchedule, profile?.default_shift]);

  // ===========================================================================
  // 2. DATA FETCHING (SUPABASE & REALTIME)
  // ===========================================================================

  // Fetch Report Types strictly from public.report_types (matches Settings > Logs)
  const fetchReportTypes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('report_types')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const activeTypes = data.filter((rt: any) => rt.is_active !== false);
        const modalOpts: CustomDropdownOption[] = activeTypes.map((rt: any) => ({
          value: rt.name,
          label: rt.name,
          description: rt.description || `${rt.name} operational classification`,
          dotColor: rt.color || '#004AC6',
        }));
        setReportTypeOptionsList(modalOpts);

        const filterOpts: CustomDropdownOption[] = [
          { value: 'ALL', label: 'All Report Types' },
          ...activeTypes.map((rt: any) => ({
            value: rt.name,
            label: rt.name,
            dotColor: rt.color || '#004AC6',
          })),
        ];
        setFilterDropdownOptions(filterOpts);
      } else {
        setReportTypeOptionsList([]);
        setFilterDropdownOptions([
          { value: 'ALL', label: 'All Report Types' },
        ]);
      }
    } catch (err) {
      console.warn('Could not load report_types from database:', err);
      setReportTypeOptionsList([]);
      setFilterDropdownOptions([
        { value: 'ALL', label: 'All Report Types' },
      ]);
    }
  }, []);

  // Fetch Shift Schedules from public.shift_schedules
  const fetchShiftSchedules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('shift_schedules')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: ShiftScheduleItem[] = data.map((s: any) => ({
          id: s.id,
          name: s.name,
          start_time: s.start_time || '08:00',
          end_time: s.end_time || '16:00',
          duration: s.duration || '8 Hours',
          color: s.color || '#004AC6',
          is_active: s.is_active ?? true,
        }));
        setShiftSchedules(mapped);
      } else {
        setShiftSchedules(fallbackSchedules);
      }
    } catch (err) {
      console.warn('Could not load shift_schedules, using fallbacks:', err);
    }
  }, []);

  // Fetch Available Officers from public.profiles
  const fetchAvailableOfficers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: DutyPersonnel[] = data.map((p: any) => ({
          id: p.id,
          name: p.full_name || 'Monitoring Personnel',
          role: p.position_title || (p.role === 'admin' ? 'System Administrator' : 'Monitoring Officer'),
          avatarInitials: getInitials(p.full_name || ''),
          badgeNumber: `OPC-${p.id.slice(0, 4).toUpperCase()}`,
          avatarUrl: p.avatar_url,
          defaultShift: p.default_shift || 'Day Shift (Alpha)',
        }));
        setAvailableOfficers(mapped);
      } else {
        setAvailableOfficers(fallbackPersonnelList);
      }
    } catch (err) {
      console.warn('Could not load profiles, using fallback duty roster:', err);
    }
  }, []);

  // Fetch Active Shift & Linked Personnel from public.shifts & public.shift_duty_personnel
  const fetchActiveShift = useCallback(async () => {
    try {
      const { data: shiftData, error: shiftError } = await supabase
        .from('shifts')
        .select(`
          id,
          shift_label,
          shift_date,
          start_time,
          end_time,
          status,
          lead_officer_id,
          start_monitoring_details,
          started_at,
          lead_officer:profiles!shifts_lead_officer_id_fkey(id, full_name, position_title, role, avatar_url)
        `)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (shiftError) {
        console.warn('Error querying active shift:', shiftError.message);
        setActiveShift(null);
        return;
      }

      if (shiftData) {
        // Fetch linked duty personnel
        const { data: personnelData } = await supabase
          .from('shift_duty_personnel')
          .select(`
            id,
            profile_id,
            role_in_shift,
            is_lead,
            profile:profiles!shift_duty_personnel_profile_id_fkey(id, full_name, position_title, avatar_url, default_shift)
          `)
          .eq('shift_id', shiftData.id);

        const mappedPersonnel: DutyPersonnel[] =
          personnelData && personnelData.length > 0
            ? personnelData.map((dp: any) => ({
                id: dp.profile?.id || dp.profile_id,
                name: dp.profile?.full_name || 'Monitoring Officer',
                role: dp.role_in_shift || dp.profile?.position_title || 'Monitoring Officer',
                avatarInitials: getInitials(dp.profile?.full_name || ''),
                badgeNumber: `OPC-${(dp.profile?.id || dp.profile_id).slice(0, 4).toUpperCase()}`,
                avatarUrl: dp.profile?.avatar_url,
                defaultShift: dp.profile?.default_shift || 'Day Shift (Alpha)',
              }))
            : [];

        const leadOfficerObj = shiftData.lead_officer as any;
        let leadOfficerName = leadOfficerObj?.full_name;
        let leadOfficerAvatar = leadOfficerObj?.avatar_url;
        let leadOfficerRole = leadOfficerObj?.position_title || (leadOfficerObj?.role === 'admin' ? 'System Administrator' : 'Lead Officer');

        if ((!leadOfficerName || !leadOfficerAvatar) && shiftData.lead_officer_id) {
          const { data: leadProf } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, position_title, role')
            .eq('id', shiftData.lead_officer_id)
            .maybeSingle();
          if (leadProf) {
            if (leadProf.full_name) leadOfficerName = leadProf.full_name;
            if (leadProf.avatar_url) leadOfficerAvatar = leadProf.avatar_url;
            if (leadProf.position_title) {
              leadOfficerRole = leadProf.position_title;
            } else if (leadProf.role === 'admin') {
              leadOfficerRole = 'System Administrator';
            }
          }
        }

        const activeRec: ActiveShiftRecord = {
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
        };

        setActiveShift(activeRec);
        setSelectedPersonnelIds(mappedPersonnel.map((p) => p.id));
      } else {
        setActiveShift(null);
      }
    } catch (err) {
      console.error('Error fetching active shift:', err);
      setActiveShift(null);
    }
  }, []);

  // Fetch Operational Logs from public.shift_logs
  const fetchLogs = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true);
      const { data, error } = await supabase
        .from('shift_logs')
        .select(`
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
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch shift_logs:', error.message);
      } else if (data) {
        const mappedLogs: LogEntry[] = data.map((item: any) => {
          const shiftObj = Array.isArray(item.shift) ? item.shift[0] : item.shift;
          const operatorObj = availableOfficers.find((o) => o.id === item.operator_id);

          return {
            id: item.id,
            shift_id: item.shift_id,
            time: item.log_time || '1200H',
            date: item.log_date || new Date().toISOString().split('T')[0],
            status: (item.status as any) || 'Active',
            title: item.title,
            reportType: item.report_type_name,
            reportTypeId: item.report_type_id,
            description: item.description,
            operator: item.operator_name || operatorObj?.name || 'Monitoring Officer',
            operatorId: item.operator_id,
            operatorRole: operatorObj?.role || 'Monitoring Personnel',
            operatorShift: operatorObj?.defaultShift || shiftObj?.shift_label || 'Day Shift (Alpha)',
            shiftLabel: shiftObj?.shift_label || (activeShift && activeShift.id === item.shift_id ? activeShift.shift_label : 'Operational Shift'),
            shiftDate: shiftObj?.shift_date || item.log_date,
            shiftStartTime: shiftObj?.start_time || '06:00',
            shiftEndTime: shiftObj?.end_time || '14:00',
            shiftStatus: shiftObj?.status || (activeShift && activeShift.id === item.shift_id ? 'active' : 'completed'),
            createdAt: item.created_at,
          };
        });
        setLogs(mappedLogs);
      }
    } catch (err) {
      console.error('Error fetching shift_logs:', err);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, []);

  // Helper to broadcast changes across all active tabs in realtime
  const broadcastSync = useCallback((event: 'shift_logs_updated' | 'shift_state_updated' | 'archives_updated') => {
    try {
      supabase.channel('pdrrmo-mls-live-logs').send({
        type: 'broadcast',
        event,
        payload: { timestamp: Date.now() },
      });
    } catch (err) {
      console.warn('Realtime broadcast notice skipped:', err);
    }
  }, []);

  // Initialize Data, Subscriptions & Background Polling Sync
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchReportTypes(),
        fetchShiftSchedules(),
        fetchAvailableOfficers(),
        fetchActiveShift(),
        fetchLogs(),
      ]);
      setIsLoading(false);
    };

    initialize();

    // Set up Realtime channel with Postgres changes & WebSocket broadcasts
    const channel = supabase
      .channel('pdrrmo-mls-live-logs', {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_logs' },
        () => {
          fetchLogs(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => {
          fetchActiveShift();
          fetchLogs(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_duty_personnel' },
        () => {
          fetchActiveShift();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_types' },
        () => {
          fetchReportTypes();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchAvailableOfficers();
        }
      )
      .on('broadcast', { event: 'shift_logs_updated' }, () => {
        fetchLogs(true);
      })
      .on('broadcast', { event: 'shift_state_updated' }, () => {
        fetchActiveShift();
        fetchLogs(true);
      })
      .subscribe((status) => {
        console.log('[Realtime logs-sync status]:', status);
      });

    // 4-second continuous background auto-sync so all users see data without manual refresh
    const syncInterval = setInterval(() => {
      fetchLogs(true);
      fetchActiveShift();
    }, 4000);

    // Visibility / Tab focus sync
    const handleVisibilitySync = () => {
      if (!document.hidden) {
        fetchLogs(true);
        fetchActiveShift();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilitySync);
    window.addEventListener('focus', handleVisibilitySync);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibilitySync);
      window.removeEventListener('focus', handleVisibilitySync);
    };
  }, [fetchReportTypes, fetchShiftSchedules, fetchAvailableOfficers, fetchActiveShift, fetchLogs]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
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

  // ===========================================================================
  // 3. LOG CRUD HANDLERS
  // ===========================================================================

  // Evaluates if a specific log can be edited or deleted (Only allowed during its active shift)
  const canEditLog = useCallback((log: LogEntry | null): boolean => {
    if (!log) return false;
    // 1. Must have log write permissions
    if (!canModifyLogs) return false;
    // 2. An active shift must be currently running
    if (!isShiftActive || !activeShift) return false;
    // 3. User must be authorized for current active shift
    if (!canEndCurrentShift) return false;
    // 4. If log is linked to a shift, it must be the currently active shift
    if (log.shift_id && activeShift.id !== log.shift_id) return false;
    // 5. If shift status is completed or cancelled, editing is locked
    if (log.shiftStatus === 'completed' || log.shiftStatus === 'cancelled') return false;
    // 6. If log date does not match active shift date
    if (log.date && activeShift.shift_date && log.date !== activeShift.shift_date) return false;

    return true;
  }, [canModifyLogs, isShiftActive, activeShift, canEndCurrentShift]);

  // Open Add Modal (Only allowed if shift is active and user is authorized)
  const handleOpenAddModal = () => {
    if (!canAddLogs) return;
    setEditingLogId(null);
    setFormTitle('');
    setFormReportType(reportTypeOptionsList[0]?.value || '');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormTime(getMilitaryTime());
    setFormDescription('');
    setIsAddModalOpen(true);
    setActiveMenuId(null);
  };

  // Open Edit Modal (Only allowed if log's shift is currently active)
  const handleOpenEditModal = (log: LogEntry) => {
    if (!canEditLog(log)) return;
    setEditingLogId(log.id);
    setFormTitle(log.title);
    setFormReportType(log.reportType);
    setFormDate(log.date);
    setFormTime(log.time);
    setFormDescription(log.description);
    setIsAddModalOpen(true);
    setActiveMenuId(null);
    if (viewLog) setViewLog(null);
  };

  // Save Log (Create or Update to public.shift_logs)
  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || isSubmitting || !canModifyLogs || !canEndCurrentShift) return;

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
        // Update existing log
        const { error } = await supabase
          .from('shift_logs')
          .update({
            title: titleToSave,
            report_type_name: reportTypeToSave,
            description: descToSave,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingLogId);

        if (error) {
          throw error;
        }

        setShiftToast({
          type: 'start',
          message: 'Incident Log Updated',
          submessage: `"${titleToSave}" was updated successfully.`,
        });
        setIsAddModalOpen(false);
        setEditingLogId(null);
      } else {
        // Insert new log
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

        if (error) {
          throw error;
        }

        setShiftToast({
          type: 'start',
          message: 'New Incident Logged',
          submessage: `"${titleToSave}" has been recorded to live telemetry.`,
        });
      }

      await fetchLogs(true);
      broadcastSync('shift_logs_updated');
    } catch (err: any) {
      console.error('Error saving log:', err);
      alert(`Could not save log entry: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
      setIsAddingLog(false);
      setEditingLogId(null);
      setTimeout(() => setShiftToast(null), 4000);
    }
  };

  // Delete Log
  const handleDeleteLog = async (id: string) => {
    if (isSubmitting || !canModifyLogs || !canEndCurrentShift) return;
    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('shift_logs').delete().eq('id', id);
      if (error) throw error;

      await fetchLogs(true);
      broadcastSync('shift_logs_updated');
      if (viewLog?.id === id) setViewLog(null);
      setActiveMenuId(null);

      setShiftToast({
        type: 'info',
        message: 'Log Entry Deleted',
        submessage: 'The record was removed from telemetry logs.',
      });
      setTimeout(() => setShiftToast(null), 3500);
    } catch (err: any) {
      console.error('Error deleting log:', err);
      alert(`Could not delete log: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===========================================================================
  // 4. SHIFT LIFECYCLE (START & END SHIFT)
  // ===========================================================================

  // Shift Button Click Handler
  const handleShiftButtonClick = () => {
    if (!isShiftActive) {
      // Must be eligible by schedule or admin to start
      if (!scheduleEligibility.isEligible) return;

      // Pre-select current user and officers assigned to designated shift schedule
      const userShiftName = profile?.default_shift || 'Day Shift (Alpha)';
      setSelectedShiftSchedule(userShiftName);

      const matchedOfficers = availableOfficers.filter(
        (o) => (o.defaultShift || 'Day Shift (Alpha)').trim().toLowerCase() === userShiftName.trim().toLowerCase()
      );
      setSelectedPersonnelIds(matchedOfficers.map((o) => o.id));
      setIsStartShiftModalOpen(true);
    } else {
      // Must be designated on duty, lead, or admin to end shift
      if (!canEndCurrentShift) return;

      setIsIncidentReportOn(false);
      setIncidentDetails('');
      setIsEndShiftModalOpen(true);
    }
  };

  // Change Shift Schedule in Modal (Admins / Leads can switch shift schedule)
  const handleSelectShiftSchedule = (schedName: string) => {
    setSelectedShiftSchedule(schedName);
    const matched = availableOfficers.filter(
      (o) => (o.defaultShift || 'Day Shift (Alpha)').trim().toLowerCase() === schedName.trim().toLowerCase()
    );
    setSelectedPersonnelIds(matched.map((o) => o.id));
  };

  // Toggle Personnel Selection in Start Shift Modal
  const handleTogglePersonnel = (id: string) => {
    setSelectedPersonnelIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  // Select / Clear All Designated Personnel
  const handleSelectAllPersonnel = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedPersonnelIds(designatedOfficers.map((p) => p.id));
    } else {
      setSelectedPersonnelIds([]);
    }
  };

  // Confirm Start Shift (Inserts public.shifts, public.shift_duty_personnel, and public.shift_logs)
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
      const shiftLabel = selectedShiftSchedule || profile?.default_shift || 'Day Shift (Alpha)';
      const now = new Date();
      const timeFormatted = getMilitaryTime(now);
      const dateFormatted = now.toISOString().split('T')[0];

      // 1. Insert into public.shifts
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

      // 2. Insert assigned personnel into public.shift_duty_personnel
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

      // 3. Insert Start Shift record into public.shift_logs
      const personnelNames = assignedPersonnel.map((p) => `${p.name} (${p.role})`).join(', ');
      const cleanBriefing = stripEmojis(startShiftMonitoringDetails.trim());
      const descriptionContent = cleanBriefing
        ? `<p><strong>Active personnel assigned on duty:</strong> ${personnelNames}</p><br /><p><strong>Monitoring Details & Briefing:</strong></p>${cleanBriefing}`
        : `<p><strong>Active personnel assigned on duty:</strong> ${personnelNames}</p>`;

      await supabase.from('shift_logs').insert({
        shift_id: newShift.id,
        title: 'Start of monitoring Duty (List of Personnel asisgned on this shift)',
        report_type_name: 'Roll Call Alert',
        log_date: dateFormatted,
        log_time: timeFormatted,
        status: 'Active',
        description: descriptionContent,
        operator_id: leadOfficerId,
        operator_name: leadOfficerName,
      });

      // Refresh states
      await Promise.all([fetchActiveShift(), fetchLogs(true)]);
      broadcastSync('shift_state_updated');
      broadcastSync('shift_logs_updated');

      setIsStartShiftModalOpen(false);
      setShiftToast({
        message: 'Start of Monitoring Shift Logged',
        submessage: `${assignedPersonnel.length} personnel on duty. "Add Logs" is now enabled in real-time.`,
        type: 'start',
      });
    } catch (err: any) {
      console.error('Error starting shift:', err);
      alert(`Could not start shift: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setShiftToast(null), 4000);
    }
  };

  // Confirm End Shift (Updates public.shifts, adds end log, and compiles consolidated daily archive on last shift)
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

      // 1. Update active public.shifts record to completed
      const { error: updateShiftError } = await supabase
        .from('shifts')
        .update({
          status: 'completed',
          end_time: timeFormatted,
          ended_at: now.toISOString(),
          end_shift_handover_status: situationText,
          incident_report_details: isIncidentReportOn && cleanIncidentDetails ? cleanIncidentDetails : null,
          updated_at: now.toISOString(),
        })
        .eq('id', activeShift.id);

      if (updateShiftError) {
        throw updateShiftError;
      }

      // 2. Insert End Shift Log into public.shift_logs
      const leadOfficerId = profile?.id || user?.id;
      const leadOfficerName = profile?.full_name || 'Monitoring Officer';
      const leadOfficerRole = profile?.position_title || 'Lead Operations Officer';

      await supabase.from('shift_logs').insert({
        shift_id: activeShift.id,
        title: 'End of monitoringduty (List of personnel assigned on this shift)',
        report_type_name: isIncidentReportOn ? 'Incident Report' : 'Roll Call Alert',
        log_date: dateFormatted,
        log_time: timeFormatted,
        status: isIncidentReportOn ? 'Warning' : 'Info',
        description: `<p><strong>Personnel on duty:</strong> ${personnelNames}</p><p><strong>Handover Status:</strong> ${situationText}</p>`,
        operator_id: leadOfficerId,
        operator_name: leadOfficerName,
      });

      // 3. Automatic Operational Shift & Daily Archiving:
      // Ending shift (End of monitoring duty) automatically compiles, generates, hashes, and stores the official PDF archive.
      let archiveFilename = `PDRRMO-MLS-${dateFormatted.replace(/-/g, '')}-DAILY.pdf`;
      try {
        // Query all shifts from this operational date
        const { data: dayShifts } = await supabase
          .from('shifts')
          .select(`
            id,
            shift_label,
            shift_date,
            start_time,
            end_time,
            status,
            lead_officer_id,
            end_shift_handover_status,
            incident_report_details,
            start_monitoring_details,
            started_at,
            ended_at,
            lead_officer:profiles!shifts_lead_officer_id_fkey(id, full_name, position_title, role)
          `)
          .eq('shift_date', activeShift.shift_date || dateFormatted)
          .order('started_at', { ascending: true });

        const shiftIds = (dayShifts || []).map((s: any) => s.id);
        if (!shiftIds.includes(activeShift.id)) shiftIds.push(activeShift.id);

        // Query all duty personnel for all shifts of the day
        const { data: allDutyPersonnel } = await supabase
          .from('shift_duty_personnel')
          .select(`
            id,
            shift_id,
            profile_id,
            role_in_shift,
            is_lead,
            present_at_end,
            profile:profiles!shift_duty_personnel_profile_id_fkey(id, full_name, position_title, default_shift)
          `)
          .in('shift_id', shiftIds);

        // Query all logs recorded across all shifts of the day
        const { data: dayLogs } = await supabase
          .from('shift_logs')
          .select('*')
          .in('shift_id', shiftIds)
          .order('log_date', { ascending: true })
          .order('log_time', { ascending: true });

        // Compile multi-shift summary
        const compiledShifts = (dayShifts || []).map((s: any) => {
          const shiftRoster = (allDutyPersonnel || [])
            .filter((dp: any) => dp.shift_id === s.id)
            .map((dp: any) => ({
              name: dp.profile?.full_name || 'Officer',
              role: dp.role_in_shift || dp.profile?.position_title || 'Monitoring Officer',
              badgeNumber: `OPC-${(dp.profile_id || '').slice(0, 4).toUpperCase()}`,
              presentAtEnd: dp.present_at_end !== false,
            }));

          const shiftLogsList = (dayLogs || []).filter((l: any) => l.shift_id === s.id);

          return {
            id: s.id,
            shiftLabel: s.shift_label,
            startTime: s.start_time,
            endTime: s.end_time || timeFormatted,
            leadOfficer: (s.lead_officer as any)?.full_name || leadOfficerName,
            leadOfficerRole: (s.lead_officer as any)?.position_title || 'Lead Operations Officer',
            handoverStatus: s.end_shift_handover_status || 'Situation Remain Normal',
            incidentDetails: s.incident_report_details || null,
            monitoringBriefing: s.start_monitoring_details || null,
            roster: shiftRoster,
            logsCount: shiftLogsList.length,
          };
        });

        const allConsolidatedLogs = (dayLogs || []).map((l: any) => ({
          time: l.log_time,
          date: l.log_date,
          status: l.status,
          title: l.title,
          reportType: l.report_type_name,
          description: l.description,
          operator: l.operator_name,
        }));

        const safeShiftLabel = (activeShift.shift_label || 'SHIFT').replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
        archiveFilename = `PDRRMO-MLS-${dateFormatted.replace(/-/g, '')}-${safeShiftLabel}.pdf`;

        const consolidatedSnapshot = {
          dailyReportDate: dateFormatted,
          isDailyCombined: compiledShifts.length > 1,
          totalShiftsCount: compiledShifts.length,
          shifts: compiledShifts,
          logs: allConsolidatedLogs,
          totalLogsArchived: allConsolidatedLogs.length,
          finalHandoverStatus: situationText,
          finalOfficer: leadOfficerName,
          generatedAt: now.toISOString(),
        };

        // Compute SHA-256 Hash across the consolidated daily record
        const payloadString = JSON.stringify(consolidatedSnapshot);
        let fileHash = 'sha256-' + Math.random().toString(36).substring(2, 15);
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
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

        // 1. Generate compressed official Daily Operations PDF with operating user signature
        const { blob: pdfBlob, sizeBytes: pdfSize } = await generateDailyLogsPDF({
          filename: archiveFilename,
          dailyReportDate: dateFormatted,
          totalShiftsCount: compiledShifts.length,
          finalOfficer: leadOfficerName,
          finalOfficerRole: leadOfficerRole,
          finalHandoverStatus: situationText,
          signatureUrl: profile?.signature_url,
          shifts: compiledShifts,
          logs: allConsolidatedLogs,
          fileHash: fileHash,
          snapshotPayload: consolidatedSnapshot,
        });

        console.log(`[Daily Logs] Official PDF generated: ${archiveFilename} (${pdfSize} bytes)`);

        // 2. Upload official PDF to Supabase storage bucket 'archive-documents' (MLS folder)
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
            const { data: urlData } = supabase.storage.from('archive-documents').getPublicUrl(storagePath);
            fileUrl = urlData?.publicUrl || null;
            console.log(`[Daily Logs] Uploaded to storage bucket: ${storagePath}`);
          } else if (uploadErr) {
            console.warn('Daily log storage upload notice:', uploadErr.message);
          }
        } catch (sErr) {
          console.warn('Could not upload daily log PDF to storage bucket:', sErr);
        }

        // Insert consolidated record into public.archives
        const shiftNames = compiledShifts.map((s) => s.shiftLabel).join(' · ');
        await supabase.from('archives').insert({
          filename: archiveFilename,
          category: 'log',
          shift_id: activeShift.id,
          lead_officer_id: activeShift.lead_officer_id || leadOfficerId,
          lead_officer_name: leadOfficerName,
          lead_officer_role: leadOfficerRole,
          shift_label: activeShift.shift_label || (compiledShifts.length > 1 ? `Daily Operations (${shiftNames})` : 'Operations Shift'),
          shift_hours: `${activeShift.start_time || '08:00H'} - ${timeFormatted}`,
          item_count: allConsolidatedLogs.length,
          file_size_bytes: pdfSize,
          storage_path: storagePath,
          file_url: fileUrl,
          file_hash: fileHash,
          summary: `Official Operations Shift Archive for ${activeShift.shift_label || 'Shift'} (${activeShift.start_time || '08:00H'} - ${timeFormatted}). Total operational logs archived: ${allConsolidatedLogs.length}. Handover status: ${situationText}.`,
          status: 'Verified',
          snapshot_data: consolidatedSnapshot,
          created_by: leadOfficerId,
        });

        broadcastSync('archives_updated');
      } catch (archErr) {
        console.error('Archival process notice:', archErr);
      }

      // Refresh states
      await Promise.all([fetchActiveShift(), fetchLogs(true)]);
      broadcastSync('shift_state_updated');
      broadcastSync('shift_logs_updated');

      setIsEndShiftModalOpen(false);
      setShiftToast({
        message: 'End of Monitoring Duty Logged & Archived',
        submessage: `Shift completed. Official certified PDF (${archiveFilename}) uploaded to Archives with SHA-256 integrity hash.`,
        type: 'end',
      });
    } catch (err: any) {
      console.error('Error ending shift:', err);
      alert(`Could not complete shift handover: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setShiftToast(null), 5000);
    }
  };

  // Open Add Category Modal
  const handleOpenAddCategory = () => {
    setNewCategoryName('');
    setNewCategoryColor('#004AC6');
    setIsAddCategoryModalOpen(true);
  };

  // Save New Category to public.report_types
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
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

      await fetchReportTypes();
      broadcastSync('shift_logs_updated');
      setFormReportType(trimmedName);
      setIsAddCategoryModalOpen(false);

      setShiftToast({
        type: 'start',
        message: 'New Report Type Added',
        submessage: `"${trimmedName}" is now available in telemetry classifications.`,
      });
      setTimeout(() => setShiftToast(null), 3500);
    } catch (err: any) {
      console.error('Error saving report type:', err);
      alert(`Could not add report type: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Formatted Text Parser for Log Details View
  const renderFormattedDescription = (content: string) => {
    if (!content) return <span className="text-[#757680] italic">No operational remarks recorded.</span>;

    if (content.includes('<') && content.includes('>')) {
      return (
        <div
          className="text-sm text-[#1E293B] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:my-2 [&_b]:font-bold [&_strong]:font-bold"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    const lines = content.split('\n');
    return (
      <div className="space-y-1 text-sm text-[#1E293B]">
        {lines.map((line, lineIdx) => {
          const isBullet = line.trim().startsWith('•');
          const cleanLine = isBullet ? line.replace(/^\s*•\s*/, '') : line;
          const segments = cleanLine.split(/(\*\*.*?\*\*)/g);

          const renderedSegments = segments.map((seg, segIdx) => {
            if (seg.startsWith('**') && seg.endsWith('**')) {
              return (
                <strong key={segIdx} className="font-bold text-[#1E293B]">
                  {seg.slice(2, -2)}
                </strong>
              );
            }
            return seg;
          });

          if (isBullet) {
            return (
              <div key={lineIdx} className="flex items-start gap-2 pl-2">
                <span className="text-[#004AC6] font-bold shrink-0 leading-relaxed">•</span>
                <span className="leading-relaxed flex-1">{renderedSegments}</span>
              </div>
            );
          }

          if (line.trim() === '') {
            return <div key={lineIdx} className="h-2" />;
          }

          return (
            <p key={lineIdx} className="leading-relaxed">
              {renderedSegments}
            </p>
          );
        })}
      </div>
    );
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

        {/* ========================================================================= */}
        {/* 1. TOP STATS & CURRENT SHIFT SUPERVISOR CARDS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
          {/* Shift Supervisor / Started By Card */}
          <div className="col-span-1 md:col-span-1 lg:col-span-7 bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden group">
            <div
              className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -mr-6 -mt-6 pointer-events-none transition-transform duration-300 group-hover:scale-110 ${
                isShiftActive ? 'bg-emerald-500/5' : 'bg-slate-500/5'
              }`}
            />

            <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
              <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#004AC6]" />
                Current Shift Duty
              </span>
              {isShiftActive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                  </span>
                  Active Shift
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[#505F76] border border-slate-200 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Shift Inactive
                </span>
              )}
            </div>

            <div className="relative z-10 flex items-center gap-4">
              {isLoading ? (
                <div className="flex items-center gap-3.5 w-full">
                  <Skeleton variant="circular" className="w-12 h-12 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton variant="rounded" className="h-5 w-36" />
                    <Skeleton variant="rounded" className="h-3.5 w-48" />
                  </div>
                </div>
              ) : isShiftActive && activeShift ? (
                <>
                  <OfficerAvatar
                    officer={{
                      name: activeShift.lead_officer_name || 'Lead Officer',
                      avatarUrl: activeShift.lead_officer_avatar,
                      avatarInitials: getInitials(activeShift.lead_officer_name || ''),
                    }}
                    size="lg"
                    className="ring-2 ring-emerald-500/20 shadow-xs shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-[#1E293B] truncate">
                        {activeShift.lead_officer_name || 'Lead Officer'}
                      </h3>
                      {activeShift.shift_label && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200 shadow-2xs shrink-0">
                          {activeShift.shift_label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#505F76] font-medium mt-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Started at <strong className="text-[#1E293B] font-semibold">{formatShiftStartTime(activeShift)}</strong>
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200 shrink-0">
                    <Clock className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
                      No Operational Shift Active
                    </h3>
                    <p className="text-xs text-[#757680] mt-0.5">
                      Duty session is currently inactive. Click &quot;Start Shift&quot; below to begin.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Summary Stat Card */}
          <div className="col-span-1 md:col-span-1 lg:col-span-5 bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-[#004AC6]/5 rounded-bl-[100px] -mr-6 -mt-6 pointer-events-none transition-transform duration-300 group-hover:scale-110" />

            <div className="flex justify-between items-start mb-3 relative z-10">
              <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#004AC6]" />
                Total Logs Recorded
              </span>
              <div className="w-8 h-8 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>

            <div className="relative z-10 flex items-baseline justify-between gap-3">
              <div>
                {isLoading ? (
                  <Skeleton variant="rounded" className="h-9 w-20" />
                ) : (
                  <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1E293B]">
                    {logs.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Realtime Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* View-Only Banner */}
        <ViewOnlyNotice
          screen="Logs"
          message="Shift duty start/end operations and new incident logging are disabled under View-Only clearance."
        />

        {/* ========================================================================= */}
        {/* 2. LOG TABLE SECTION */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col">
          {/* Table Header Actions & Toolbar */}
          <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white">
            {/* Search Input with Debounced Filtering */}
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs by title, type, or ID..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 pl-10 pr-10 text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E293B] transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              {/* Filter Custom Dropdown */}
              <div className="w-48 shrink-0">
                <CustomDropdown
                  options={filterDropdownOptions}
                  value={reportTypeFilter}
                  onChange={(val) => setReportTypeFilter(val)}
                  leftIcon={<Filter className="w-3.5 h-3.5" />}
                  size="sm"
                  pill
                />
              </div>

              {canModifyLogs && (
                <>
                  {/* Start / End Shift Button with Schedule Window Verification & Handover Authority Check */}
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={handleShiftButtonClick}
                      disabled={
                        isShiftActive
                          ? !canEndCurrentShift
                          : !scheduleEligibility.isEligible
                      }
                      className={`flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-sm border ${
                        isShiftActive
                          ? canEndCurrentShift
                            ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20 cursor-pointer'
                            : 'bg-slate-200 text-slate-400 border-slate-300 opacity-60 cursor-not-allowed shadow-none'
                          : scheduleEligibility.isEligible
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-emerald-600/20 cursor-pointer'
                          : 'bg-slate-200 text-slate-400 border-slate-300 opacity-60 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {isShiftActive ? (
                        <>
                          {canEndCurrentShift ? (
                            <Square className="w-3.5 h-3.5 fill-white" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>End Shift</span>
                        </>
                      ) : (
                        <>
                          {scheduleEligibility.isEligible ? (
                            <Play className="w-3.5 h-3.5 fill-white" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>Start Shift</span>
                        </>
                      )}
                    </button>

                    {/* Tooltip explaining disabled status if not eligible to start */}
                    {!isShiftActive && !scheduleEligibility.isEligible && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 min-w-[280px]">
                        <div className="bg-[#1E293B] text-white text-[11px] font-semibold py-2 px-3 rounded-xl shadow-xl leading-relaxed text-center">
                          <p className="font-bold text-amber-300 mb-0.5">Shift Window Inactive</p>
                          <p className="text-slate-200">{scheduleEligibility.reason}</p>
                        </div>
                        <div className="w-2 h-2 bg-[#1E293B] rotate-45 -mt-1" />
                      </div>
                    )}

                    {/* Tooltip explaining disabled status if not eligible to end someone else's shift */}
                    {isShiftActive && !canEndCurrentShift && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 min-w-[280px]">
                        <div className="bg-[#1E293B] text-white text-[11px] font-semibold py-2 px-3 rounded-xl shadow-xl leading-relaxed text-center">
                          <p className="font-bold text-amber-300 mb-0.5">Shift Handover Restricted</p>
                          <p className="text-slate-200">
                            Only personnel designated for {activeShift?.shift_label} or System Administrators can end this active shift.
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-[#1E293B] rotate-45 -mt-1" />
                      </div>
                    )}
                  </div>

                  {/* Add Logs Primary Button (Disabled when shift is not started or user is not designated for this shift) */}
                  <div className="relative group">
                    <PrimaryButton
                      size="md"
                      pill
                      disabled={!canAddLogs}
                      onClick={handleOpenAddModal}
                      leftIcon={!canAddLogs && isShiftActive && !canEndCurrentShift ? <Lock className="w-4 h-4 text-slate-400" /> : <Plus className="w-4 h-4" />}
                      className={`shrink-0 ${
                        !canAddLogs
                          ? 'opacity-40 cursor-not-allowed bg-slate-300 text-slate-500 border-slate-300 shadow-none hover:bg-slate-300 pointer-events-auto'
                          : ''
                      }`}
                    >
                      Add Logs
                    </PrimaryButton>

                    {/* Tooltip when disabled: Shift not started */}
                    {!isShiftActive && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                        <div className="bg-[#1E293B] text-white text-[11px] font-semibold py-1.5 px-3 rounded-xl whitespace-nowrap shadow-lg">
                          Please click "Start Shift" to enable adding logs
                        </div>
                        <div className="w-2 h-2 bg-[#1E293B] rotate-45 -mt-1" />
                      </div>
                    )}

                    {/* Tooltip when disabled: View Only permission */}
                    {isShiftActive && !canModifyLogs && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                        <div className="bg-[#1E293B] text-white text-[11px] font-semibold py-1.5 px-3 rounded-xl whitespace-nowrap shadow-lg">
                          You have view-only access to Operational Logs
                        </div>
                        <div className="w-2 h-2 bg-[#1E293B] rotate-45 -mt-1" />
                      </div>
                    )}

                    {/* Tooltip when disabled: Not designated to active shift schedule */}
                    {isShiftActive && canModifyLogs && !canEndCurrentShift && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 min-w-[280px]">
                        <div className="bg-[#1E293B] text-white text-[11px] font-semibold py-2 px-3 rounded-xl shadow-xl leading-relaxed text-center">
                          <p className="font-bold text-amber-300 mb-0.5">Logging Restricted</p>
                          <p className="text-slate-200">
                            Only personnel designated for {activeShift?.shift_label} or System Administrators can record incident logs.
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-[#1E293B] rotate-45 -mt-1" />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto min-h-[320px] pb-12">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#F8FAFC]/80 border-b border-[#E2E8F0] text-[#505F76] text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-6 w-28">Time</th>
                  <th className="py-3.5 px-6">Title</th>
                  <th className="py-3.5 px-6 w-56">Report Type</th>
                  <th className="py-3.5 px-6 text-right w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm font-medium text-[#1E293B]">
                {/* 1. Newly Added Log In-Flight Skeleton Loader Row */}
                {isAddingLog && (
                  <tr className="bg-[#004AC6]/5 border-b border-[#004AC6]/20 transition-all duration-300 animate-pulse">
                    <td className="py-4 px-6">
                      <div className="h-4 w-16 bg-[#004AC6]/20 rounded-md" />
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1.5 max-w-lg">
                        <div className="h-4 w-3/4 bg-[#004AC6]/25 rounded-md" />
                        <div className="h-3 w-1/2 bg-[#004AC6]/15 rounded-md" />
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#004AC6]/40 animate-ping" />
                        <div className="h-4 w-28 bg-[#004AC6]/20 rounded-md" />
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="w-8 h-8 rounded-full bg-[#004AC6]/10 inline-flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-[#004AC6] animate-spin" />
                      </div>
                    </td>
                  </tr>
                )}

                {/* 2. Initial Full Table Loading Skeleton */}
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx}>
                      <td className="py-4 px-6"><Skeleton variant="rounded" className="h-4 w-16" /></td>
                      <td className="py-4 px-6"><Skeleton variant="rounded" className="h-4 w-64" /></td>
                      <td className="py-4 px-6"><Skeleton variant="rounded" className="h-4 w-32" /></td>
                      <td className="py-4 px-6 text-right"><Skeleton variant="circular" className="w-7 h-7 inline-block" /></td>
                    </tr>
                  ))
                ) : filteredLogs.length === 0 && !isAddingLog ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-[#757680]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="w-8 h-8 text-[#94A3B8] opacity-50" />
                        <p className="text-sm font-semibold text-[#505F76]">No logs found</p>
                        <p className="text-xs text-[#94A3B8]">
                          {isShiftActive
                            ? 'Start logging incident telemetry or adjust your search filter.'
                            : 'Click "Start Shift" above to initiate duty and log entries.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50/80 transition-colors group relative ${activeMenuId === log.id ? 'z-50 relative' : 'z-0'}`}
                    >
                      {/* Time */}
                      <td className="py-4 px-6 text-[#505F76] font-mono text-xs font-semibold">
                        {log.time}
                      </td>

                      {/* Title */}
                      <td className="py-4 px-6">
                        <span
                          onClick={() => setViewLog(log)}
                          className="font-semibold text-[#1E293B] hover:text-[#004AC6] transition-colors cursor-pointer block max-w-xl truncate"
                        >
                          {log.title}
                        </span>
                      </td>

                      {/* Report Type */}
                      <td className="py-4 px-6 text-[#505F76] text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                reportTypeOptionsList.find((r) => r.value === log.reportType)?.dotColor || '#004AC6',
                            }}
                          />
                          <span className="truncate">{log.reportType}</span>
                        </div>
                      </td>

                      {/* Actions: Three Dots Menu */}
                      <td className={`py-4 px-6 text-right ${activeMenuId === log.id ? 'relative z-50' : ''}`}>
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            title="Log Actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === log.id ? null : log.id);
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                              activeMenuId === log.id
                                ? 'bg-slate-200 text-[#1E293B]'
                                : 'text-[#757680] hover:text-[#1E293B] hover:bg-slate-100'
                            }`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Popover Dropdown (Floating on top of all rows) */}
                          <AnimatePresence>
                            {activeMenuId === log.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                transition={{ duration: 0.12 }}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1.5 z-[100] w-40 bg-white/95 backdrop-blur-md border border-[#E2E8F0] rounded-2xl shadow-2xl shadow-slate-900/15 p-1.5 space-y-1 text-left ring-1 ring-black/10"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewLog(log);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#004AC6]" />
                                  <span>View Details</span>
                                </button>
                                {canEditLog(log) && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(log)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Edit Log</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteLog(log.id)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                      <span>Delete</span>
                                    </button>
                                  </>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 sm:p-5 border-t border-[#E2E8F0] bg-[#F8FAFC]/50 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#757680]">
            <span>
              Showing <span className="font-bold text-[#1E293B]">{filteredLogs.length}</span> entries
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled
                className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-slate-300 cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-[#004AC6] text-white font-semibold flex items-center justify-center"
              >
                1
              </button>
              <button
                type="button"
                disabled
                className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-slate-300 cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL: START SHIFT (Personnel Checklist + Visual Rich Text Editor) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isStartShiftModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsStartShiftModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden z-10"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-[#1E293B] leading-tight">
                        Start of monitoring Duty
                      </h2>
                      <span className="text-[11px] font-bold text-[#004AC6] bg-blue-50 border border-[#004AC6]/20 px-2 py-0.5 rounded-full">
                        {selectedShiftSchedule}
                      </span>
                    </div>
                    <p className="text-xs text-[#757680] mt-0.5">
                      Checklist of active personnel designated for this shift schedule.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStartShiftModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleConfirmStartShift} className="flex flex-col">
                <div className="p-6 space-y-5 max-h-[62vh] overflow-y-auto custom-scrollbar">
                  {/* Shift Selection Pills (for Admins or Shift switching) */}
                  {shiftSchedules.length > 1 && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                        Designated Shift Schedule
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {shiftSchedules.map((sched) => {
                          const isSchedActive = selectedShiftSchedule.toLowerCase() === sched.name.toLowerCase();
                          return (
                            <button
                              key={sched.id}
                              type="button"
                              onClick={() => handleSelectShiftSchedule(sched.name)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isSchedActive
                                  ? 'bg-blue-50 border-[#004AC6] text-[#004AC6] ring-1 ring-[#004AC6]/20 font-bold'
                                  : 'bg-white border-[#E2E8F0] text-[#505F76] hover:bg-slate-50 font-medium'
                              }`}
                            >
                              <span className="text-xs block truncate">{sched.name}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                                {sched.start_time} - {sched.end_time}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quick Action Toolbar */}
                  <div className="flex items-center justify-between bg-slate-50 border border-[#E2E8F0] rounded-2xl px-4 py-2.5">
                    <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider">
                      Duty Personnel Roster ({selectedPersonnelIds.length} of {designatedOfficers.length} Selected)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectAllPersonnel(true)}
                        className="text-xs font-bold text-[#004AC6] hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300 text-xs">•</span>
                      <button
                        type="button"
                        onClick={() => handleSelectAllPersonnel(false)}
                        className="text-xs font-bold text-[#757680] hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Checklist of Personnel - ONLY designated schedule personnel */}
                  <div className="space-y-2.5">
                    {designatedOfficers.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-600">
                          No personnel designated for {selectedShiftSchedule}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Assign officers to this shift in User Management (/users).
                        </p>
                      </div>
                    ) : (
                      designatedOfficers.map((person) => {
                        const isSelected = selectedPersonnelIds.includes(person.id);

                        return (
                          <div
                            key={person.id}
                            onClick={() => handleTogglePersonnel(person.id)}
                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                              isSelected
                                ? 'bg-blue-50/50 border-[#004AC6]/30 shadow-2xs ring-1 ring-[#004AC6]/10'
                                : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <CheckboxInput
                                checked={isSelected}
                                onChange={() => handleTogglePersonnel(person.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="w-9 h-9 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center font-bold text-xs border border-[#004AC6]/15 shrink-0">
                                {person.avatarInitials}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-[#1E293B]">{person.name}</h4>
                                  {person.defaultShift && (
                                    <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                                      {person.defaultShift}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#757680] font-medium">{person.role}</p>
                              </div>
                            </div>

                            <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-[#505F76] border border-slate-200">
                              {person.badgeNumber}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Monitoring Details with Visual WYSIWYG Rich Text Editor */}
                  <div className="pt-3 border-t border-slate-200">
                    <RichTextEditor
                      label="Monitoring Details & Briefing"
                      value={startShiftMonitoringDetails}
                      onChange={(html) => setStartShiftMonitoringDetails(html)}
                      placeholder="Enter shift briefing notes, monitoring priorities, or telemetric instructions..."
                      minHeight="110px"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4.5 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between gap-3">
                  <SecondaryButton
                    type="button"
                    size="md"
                    pill
                    disabled={isSubmitting}
                    onClick={() => setIsStartShiftModalOpen(false)}
                  >
                    Cancel
                  </SecondaryButton>

                  <PrimaryButton
                    type="submit"
                    size="md"
                    pill
                    disabled={selectedPersonnelIds.length === 0 || isSubmitting}
                    leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                  >
                    {isSubmitting ? 'Starting Shift...' : `Confirm Start Shift (${selectedPersonnelIds.length})`}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 4. MODAL: END SHIFT (Present Personnel & Incident Report Toggle) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEndShiftModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsEndShiftModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden z-10"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1E293B] leading-tight">
                      End of monitoringduty (List of personnel assigned on this shift)
                    </h2>
                    <p className="text-xs text-[#757680] mt-0.5">
                      Verify present shift personnel and report incident status before closing shift.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEndShiftModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleConfirmEndShift} className="flex flex-col">
                <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {/* Section 1: Present Personnel in this shift */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#004AC6]" />
                        Present Personnel on Duty ({activeShift?.personnel.length || selectedPersonnelIds.length})
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        Shift Verified
                      </span>
                    </div>

                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 space-y-2">
                      {(activeShift?.personnel && activeShift.personnel.length > 0
                        ? activeShift.personnel
                        : availableOfficers.filter((p) => selectedPersonnelIds.includes(p.id))
                      ).map((person) => (
                        <div
                          key={person.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200 shrink-0">
                              {person.avatarInitials}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-[#1E293B] block">
                                {person.name}
                              </span>
                              <span className="text-[11px] text-[#757680]">{person.role}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50/80 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Present
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Automatic Official Archive Notice */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4.5 space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#004AC6] flex items-center justify-center border border-blue-100 shrink-0">
                        <ArchiveIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#1E293B]">Automatic Official Archive</h4>
                        <p className="text-xs text-[#757680] mt-0.5">
                          Ending this shift automatically compiles, certifies with SHA-256 integrity hash, and stores the official operational PDF in <strong>Archives</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-[#004AC6] flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#004AC6]" />
                      <span>
                        <strong>Auto-Archiving Enabled:</strong> Operational shift logs and duty handover details will be automatically archived into the <code>archive-documents</code> bucket.
                      </span>
                    </div>
                  </div>

                  {/* Section 3: Incident Report Toggle */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4.5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-[#1E293B]">Incident Report</h4>
                        <p className="text-xs text-[#757680] mt-0.5">
                          Toggle ON if incidents occurred during shift duty.
                        </p>
                      </div>

                      <ToggleButton
                        checked={isIncidentReportOn}
                        onChange={(checked) => setIsIncidentReportOn(checked)}
                      />
                    </div>

                    {/* Conditional Input: Details input if ON, default "Situation Remain Normal" if OFF */}
                    <AnimatePresence mode="wait">
                      {!isIncidentReportOn ? (
                        <motion.div
                          key="normal-state"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide block">
                              Handover Status
                            </span>
                            <p className="text-sm font-bold text-emerald-900">
                              Situation Remain Normal
                            </p>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="incident-input"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1.5 pt-2"
                        >
                          <label className="text-xs font-semibold text-rose-700 uppercase tracking-wide flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            Incident Report Details (Required)
                          </label>
                          <textarea
                            rows={4}
                            required={isIncidentReportOn}
                            value={incidentDetails}
                            onChange={(e) => setIncidentDetails(stripEmojis(e.target.value))}
                            placeholder="Enter details of incidents encountered, dispatch responses, ongoing advisories, or critical notes for the incoming shift..."
                            className="w-full bg-white border border-rose-200 rounded-2xl p-3.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 transition-all resize-none leading-relaxed"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4.5 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between gap-3">
                  <SecondaryButton
                    type="button"
                    size="md"
                    pill
                    disabled={isSubmitting}
                    onClick={() => setIsEndShiftModalOpen(false)}
                  >
                    Cancel
                  </SecondaryButton>

                  <PrimaryButton
                    type="submit"
                    size="md"
                    pill
                    disabled={(isIncidentReportOn && !incidentDetails.trim()) || isSubmitting}
                    leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-white" />}
                    className="bg-amber-600 hover:bg-amber-700 border-amber-700"
                  >
                    {isSubmitting ? 'Closing Shift...' : 'Confirm End Shift'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. SLIDE-OVER DRAWER / MODAL: ADD / EDIT LOG */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsAddModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Slide-over Drawer Panel */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full sm:w-[500px] bg-white h-full shadow-2xl border-l border-[#E2E8F0] flex flex-col justify-between overflow-hidden z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                <div>
                  <h2 className="text-lg font-bold text-[#1E293B]">
                    {editingLogId ? 'Edit Incident Log' : 'Add New Log'}
                  </h2>
                  <p className="text-xs text-[#757680]">Enter details for the environmental event</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveLog} className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                  {/* Event Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                      Event Title
                    </label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(stripEmojis(e.target.value))}
                      placeholder="e.g., Seismic Activity: Magnitude 6.2 Detected"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 px-4 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                    />
                  </div>

                  {/* Report Type Dropdown */}
                  <div>
                    <CustomDropdown
                      label="Report Type"
                      labelRight={
                        <button
                          type="button"
                          onClick={handleOpenAddCategory}
                          className="text-xs font-semibold text-[#004AC6] hover:text-[#003594] flex items-center gap-1 transition-colors group cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform text-[#004AC6]" />
                          <span>Add Category</span>
                        </button>
                      }
                      options={reportTypeOptionsList}
                      value={formReportType}
                      onChange={(val) => setFormReportType(val)}
                      size="md"
                      pill
                    />
                  </div>

                  {/* Timestamp: Date & Time (Disabled) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                      Timestamp
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <input
                          type="text"
                          disabled
                          value={formDate}
                          className="w-full bg-slate-100 border border-[#E2E8F0] rounded-full py-2.5 pl-4 pr-9 text-sm text-[#505F76] opacity-75 cursor-not-allowed focus:outline-none select-none"
                        />
                        <Calendar className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          disabled
                          value={formTime}
                          className="w-full bg-slate-100 border border-[#E2E8F0] rounded-full py-2.5 pl-4 pr-9 text-sm text-[#505F76] font-mono opacity-75 cursor-not-allowed focus:outline-none select-none"
                        />
                        <Clock className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Detailed Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                      Detailed Description
                    </label>
                    <textarea
                      rows={4}
                      value={formDescription}
                      onChange={(e) => setFormDescription(stripEmojis(e.target.value))}
                      placeholder="Provide a detailed operational summary of the event..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex gap-3">
                  <SecondaryButton
                    type="button"
                    size="md"
                    pill
                    disabled={isSubmitting}
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 justify-center"
                  >
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    type="submit"
                    size="md"
                    pill
                    disabled={isSubmitting}
                    className="flex-1 justify-center"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : editingLogId ? (
                      'Save Changes'
                    ) : (
                      'Save Log'
                    )}
                  </PrimaryButton>
                </div>
              </form>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6. DETAILS VIEW MODAL / DRAWER */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {viewLog && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewLog(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* View Drawer */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full sm:w-[480px] bg-white h-full shadow-2xl border-l border-[#E2E8F0] flex flex-col justify-between overflow-hidden z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#1E293B]">Incident Log Details</h2>
                    <p className="text-xs text-[#757680] font-mono">{viewLog.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewLog(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Title Card */}
                <div className="bg-[#F8FAFC] rounded-2xl p-5 border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                      {viewLog.reportType}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-[#1E293B] leading-snug">
                    {viewLog.title}
                  </h3>
                </div>

                {/* Timestamp & Operator Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs space-y-1">
                    <div className="text-xs text-[#757680] font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#505F76]" /> Log Time
                    </div>
                    <div className="text-sm font-bold text-[#1E293B] font-mono">
                      {viewLog.time} · {viewLog.date}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs space-y-1">
                    <div className="text-xs text-[#757680] font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#505F76]" /> Operator
                    </div>
                    <div className="text-sm font-semibold text-[#1E293B] truncate">
                      {viewLog.operator}
                    </div>
                  </div>
                </div>

                {/* User's Shift & Duty Operations Details */}
                <div className="p-4.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#004AC6] uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#004AC6]" /> Shift &amp; Duty Operations
                    </span>
                    {viewLog.shiftStatus === 'active' || (isShiftActive && activeShift?.id === viewLog.shift_id) ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active Shift
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-[#505F76] border border-slate-200">
                        <CheckCircle2 className="w-3 h-3 text-slate-500" />
                        Shift Ended
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="space-y-1">
                      <span className="text-[#757680] font-medium block">Duty Shift:</span>
                      <span className="font-bold text-[#1E293B] block truncate">
                        {viewLog.shiftLabel || viewLog.operatorShift || 'Day Shift (Alpha)'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#757680] font-medium block">Shift Schedule:</span>
                      <span className="font-bold text-[#1E293B] font-mono block">
                        {viewLog.shiftStartTime && viewLog.shiftEndTime
                          ? `${viewLog.shiftStartTime} – ${viewLog.shiftEndTime}`
                          : '06:00 – 14:00'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#757680] font-medium block">Recorded By:</span>
                      <span className="font-semibold text-[#1E293B] block truncate">
                        {viewLog.operator}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#757680] font-medium block">Designation:</span>
                      <span className="font-medium text-[#505F76] block truncate">
                        {viewLog.operatorRole || 'Monitoring Officer'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Formatted Operational Description with bold and bullets */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                    Operational Description
                  </span>
                  <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] leading-relaxed">
                    {renderFormattedDescription(viewLog.description)}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between gap-3">
                {canEditLog(viewLog) ? (
                  <>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleDeleteLog(viewLog.id)}
                      className="px-4 py-2.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Log
                    </button>

                    <PrimaryButton
                      size="md"
                      pill
                      onClick={() => handleOpenEditModal(viewLog)}
                      leftIcon={<Edit2 className="w-4 h-4" />}
                      className="flex-1 justify-center"
                    >
                      Edit Log
                    </PrimaryButton>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between">
                    <span className="text-xs text-[#757680] flex items-center gap-1.5 italic">
                      <Lock className="w-3.5 h-3.5 text-[#94A3B8]" />
                      Shift is ended (Log entries are locked)
                    </span>
                    <SecondaryButton
                      size="sm"
                      pill
                      onClick={() => setViewLog(null)}
                    >
                      Close
                    </SecondaryButton>
                  </div>
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6.5 ADD CATEGORY (REPORT TYPE) MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAddCategoryModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsAddCategoryModalOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                      Add Report Type
                    </h2>
                    <p className="text-xs text-[#757680]">
                      Create a custom event classification
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
                {/* Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                    Report Type Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(stripEmojis(e.target.value))}
                    placeholder="e.g., Hazardous Chemical Spill"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 px-4 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  />
                </div>

                {/* Color Dot Swatches */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                    Indicator Color
                  </label>
                  <div className="flex items-center gap-3 pt-1">
                    {[
                      { color: '#004AC6', name: 'Primary Blue' },
                      { color: '#BA1A1A', name: 'Critical Red' },
                      { color: '#F59E0B', name: 'Warning Amber' },
                      { color: '#10B981', name: 'Active Green' },
                      { color: '#8B5CF6', name: 'Purple' },
                      { color: '#505F76', name: 'Slate Gray' },
                    ].map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => setNewCategoryColor(c.color)}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                          newCategoryColor === c.color ? 'ring-2 ring-offset-2 ring-[#004AC6] scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.color }}
                        title={c.name}
                      >
                        {newCategoryColor === c.color && (
                          <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                  <SecondaryButton
                    type="button"
                    size="md"
                    pill
                    disabled={isSubmitting}
                    onClick={() => setIsAddCategoryModalOpen(false)}
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
                    {isSubmitting ? 'Saving...' : 'Save Category'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. TOAST NOTIFICATION */}
      {/* ========================================================================= */}
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
