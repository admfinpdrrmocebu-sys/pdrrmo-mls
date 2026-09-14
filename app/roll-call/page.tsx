"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Radio as RadioIcon,
  Mic,
  MoreVertical,
  X,
  Save,
  CheckCircle2,
  ShieldCheck,
  Check,
  Archive,
  Search,
  Filter,
  AlertTriangle,
  Loader2,
  MapPin,
  ArrowRight,
  Lock,
  Clock,
  BarChart3,
  TrendingUp,
  Calendar,
  Edit2,
  Eye,
  Activity,
  Layers,
  Sun,
  CloudRain,
  Anchor,
  Sparkles,
  Users,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { SummaryCard } from '@/components/card';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { RollCallTableSkeleton, Skeleton } from '@/components/skeleton';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { generateRollCallPDF } from '@/lib/pdf-generator';
import { format } from 'date-fns';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

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

const weatherDropdownOptions: CustomDropdownOption[] = [
  { value: 'Clear', label: 'Clear', dotColor: '#059669', badge: 'Optimal', badgeColor: 'bg-emerald-50 text-emerald-700' },
  { value: 'Fair', label: 'Fair', dotColor: '#10B981', badge: 'Fair', badgeColor: 'bg-emerald-50 text-emerald-700' },
  { value: 'Cloudy', label: 'Cloudy', dotColor: '#64748B', badge: 'Overcast', badgeColor: 'bg-slate-100 text-[#505F76]' },
  { value: 'Light Rain', label: 'Light Rain', dotColor: '#0EA5E9', badge: 'Light', badgeColor: 'bg-sky-50 text-sky-700' },
  { value: 'Moderate Rain', label: 'Moderate Rain', dotColor: '#F59E0B', badge: 'Moderate', badgeColor: 'bg-amber-50 text-amber-800' },
  { value: 'Heavy Rain', label: 'Heavy Rain', dotColor: '#EA580C', badge: 'Heavy', badgeColor: 'bg-orange-50 text-orange-800' },
  { value: 'Stormy', label: 'Stormy', dotColor: '#DC2626', badge: 'Severe', badgeColor: 'bg-rose-50 text-rose-700' },
];

const portDropdownOptions: CustomDropdownOption[] = [
  { value: 'Operational', label: 'Operational', dotColor: '#059669', badge: 'Active', badgeColor: 'bg-emerald-50 text-emerald-700' },
  { value: 'Limited', label: 'Limited', dotColor: '#D97706', badge: 'Restricted', badgeColor: 'bg-amber-50 text-amber-800' },
  { value: 'Suspended', label: 'Suspended', dotColor: '#DC2626', badge: 'Closed', badgeColor: 'bg-rose-50 text-rose-700' },
  { value: 'None', label: 'No Port / Inland', dotColor: '#94A3B8', badge: 'N/A', badgeColor: 'bg-slate-100 text-[#505F76]' },
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

// Helper to format roll call start time concisely
function formatRollCallStartTime(session: RollCallSessionRecord | null): string {
  if (!session) return '';
  if (session.created_at) {
    try {
      const d = new Date(session.created_at);
      if (!isNaN(d.getTime())) {
        return format(d, 'h:mm a');
      }
    } catch (_) {}
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
  const initials = officer?.avatarInitials || getInitials(officer?.name || 'MO');
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

function getMilitaryTime(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}H`;
}

// Custom Tooltip for Aggregated Attendance Bar Chart (Present vs Absent)
const CustomChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1E293B] text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700/80 space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: data.fill || (data.category === 'Present' ? '#10B981' : '#EF4444') }}
          />
          <p className="font-bold text-slate-200">{data.category} Sessions</p>
        </div>
        <div className="pt-0.5">
          <p className="text-sm font-extrabold text-white">
            {data.count} <span className="text-xs font-normal text-slate-300">({data.percentage}%)</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function RollCallPage() {
  const { user, profile, isAdmin, canWrite, isViewOnly } = useAuth();
  const canModifyRollCall = canWrite('Roll Call');
  const isRollCallViewOnly = isViewOnly('Roll Call');

  // Active Screen View Switcher: 'operations' | 'analytics'
  const [activeTab, setActiveTab] = useState<'operations' | 'analytics'>('operations');

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Municipalities & Session State - dynamically populated from public.areas
  const [areasList, setAreasList] = useState<MunicipalityRow[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityRow[]>([]);
  const [activeSession, setActiveSession] = useState<RollCallSessionRecord | null>(null);

  // Analytics History Sessions
  const [analyticsSessions, setAnalyticsSessions] = useState<RollCallHistorySession[]>([]);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState('');
  const [activeAnalyticsMenuId, setActiveAnalyticsMenuId] = useState<string | null>(null);

  // Side Drawer & Edit Modal State
  const [selectedLguForView, setSelectedLguForView] = useState<LGUAnalyticsSummary | null>(null);
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [absentPage, setAbsentPage] = useState(1);
  const [presentPage, setPresentPage] = useState(1);
  const [editingLgu, setEditingLgu] = useState<MunicipalityRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingLgu, setIsSavingLgu] = useState(false);

  // Edit LGU Form State
  const [editLguForm, setEditLguForm] = useState({
    name: '',
    hasPort: false,
    portName: '',
  });

  // Stable references to prevent dependency cascades and unnecessary re-renders
  const areasListRef = useRef<MunicipalityRow[]>([]);
  const municipalitiesRef = useRef<MunicipalityRow[]>([]);
  const activeSessionRef = useRef<RollCallSessionRecord | null>(null);

  // Standard Radio Broadcast Script
  const radioScript = useMemo(() => {
    const officerName = profile?.full_name || 'Monitoring Officer';
    return `"Attention all station 3X, Please Standby for the 4PM net roll call, This is ${officerName}, Your Opcen Monitoring Personnel on Duty. Let's Start with LGU."`;
  }, [profile?.full_name]);

  // Auto-advance banner notice
  const [autoAdvancingNotice, setAutoAdvancingNotice] = useState<string | null>(null);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Record Preview Modal State (Editable Preview)
  const [isRecordPreviewModalOpen, setIsRecordPreviewModalOpen] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'Present' | 'Absent' | 'Exempted' | 'incomplete'>('all');
  const [previewSearchQuery, setPreviewSearchQuery] = useState('');

  // Success Confirmation State & Summary Storage
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [saveToastMessage, setSaveToastMessage] = useState<{ title: string; subtitle: string }>({
    title: 'Roll Call Session Saved',
    subtitle: 'Session records successfully archived.',
  });
  const [savedSummary, setSavedSummary] = useState({ present: 0, absent: 0, exempted: 0, total: 0 });

  // In-app Alert Banner State (replaces native window.alert)
  const [alertBanner, setAlertBanner] = useState<{
    type: 'error' | 'warning' | 'info';
    title: string;
    message: string;
    incompleteStations?: string[];
  } | null>(null);

  const isRollCallActive = activeSession !== null;

  // Single-moderator concurrency lock:
  // When a roll call session is active, ONLY the user who initiated the session can moderate (modify entries & save).
  // Other authenticated users can view the live telemetry in real-time, with controls locked.
  const isCurrentModerator = useMemo(() => {
    if (!isRollCallActive || !activeSession?.conducted_by) return false;
    const currentUserId = user?.id;
    const currentProfileId = profile?.id;
    return Boolean(
      (currentUserId && activeSession.conducted_by === currentUserId) ||
      (currentProfileId && activeSession.conducted_by === currentProfileId)
    );
  }, [isRollCallActive, activeSession?.conducted_by, user?.id, profile?.id]);

  const canModerateRollCall = useMemo(() => {
    if (!canModifyRollCall) return false;
    if (!isRollCallActive) return true;
    return isCurrentModerator;
  }, [canModifyRollCall, isRollCallActive, isCurrentModerator]);

  // Keep refs in sync with state
  useEffect(() => {
    areasListRef.current = areasList;
  }, [areasList]);

  useEffect(() => {
    municipalitiesRef.current = municipalities;

    // Auto-update or dismiss incomplete alert banner dynamically as stations are completed
    if (alertBanner && alertBanner.incompleteStations && alertBanner.incompleteStations.length > 0) {
      const incomplete = municipalities.filter((m) => !isRowComplete(m));
      if (incomplete.length === 0) {
        setAlertBanner(null);
      } else if (incomplete.length !== alertBanner.incompleteStations.length) {
        setAlertBanner((prev) => (prev ? { ...prev, incompleteStations: incomplete.map((s) => s.name) } : null));
      }
    }
  }, [municipalities, alertBanner]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Close 3-dot dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveAnalyticsMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // ===========================================================================
  // 1. DATA FETCHING (AREAS & ACTIVE SESSION DYNAMICALLY FROM SUPABASE)
  // ===========================================================================

  // Fetch Areas dynamically from public.areas table (sorted alphabetically by name)
  const fetchAreas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('id, code, name, has_port, port_name, sort_order, is_active')
        .order('name', { ascending: true });

      if (!error && data) {
        const activeData = data.filter((a: any) => a.is_active !== false);
        const mapped: MunicipalityRow[] = activeData
          .map((a: any) => ({
            id: a.id,
            code: a.code || a.name.slice(0, 2).toUpperCase(),
            name: a.name,
            hasPort: a.has_port ?? false,
            portName: a.port_name || 'None',
            sortOrder: a.sort_order ?? 0,
            isActive: a.is_active ?? true,
            attendance: 'Absent' as const,
            weatherStatus: null,
            portStatus: null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        // Check if area list actually changed before updating state
        const prevList = areasListRef.current;
        let changed = prevList.length !== mapped.length;
        if (!changed) {
          for (let i = 0; i < mapped.length; i++) {
            if (
              mapped[i].id !== prevList[i]?.id ||
              mapped[i].name !== prevList[i]?.name ||
              mapped[i].code !== prevList[i]?.code ||
              mapped[i].hasPort !== prevList[i]?.hasPort ||
              mapped[i].portName !== prevList[i]?.portName
            ) {
              changed = true;
              break;
            }
          }
        }

        if (changed) {
          areasListRef.current = mapped;
          setAreasList(mapped);
        }

        return mapped;
      }
      return [];
    } catch (err) {
      console.warn('Could not load areas from database:', err);
      return [];
    }
  }, []);

  // Fetch Active Roll Call Session & Entries from public.roll_call_sessions & public.roll_call_entries
  const fetchActiveRollCallSession = useCallback(async (baseAreas?: MunicipalityRow[], isBackground = false) => {
    try {
      const targetAreas = baseAreas || areasListRef.current;

      // 1. Query active in_progress session
      const { data: sessionData, error: sessionError } = await supabase
        .from('roll_call_sessions')
        .select(`
          id,
          session_date,
          session_time,
          frequency,
          radio_script,
          conducted_by,
          status,
          total_stations,
          present_count,
          absent_count,
          exempted_count,
          weather_summary,
          created_at
        `)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) {
        console.warn('Error querying active roll call session:', sessionError.message);
        if (activeSessionRef.current !== null) {
          setActiveSession(null);
        }
        return;
      }

      if (sessionData) {
        // Resolve operator name and profile details
        let conductedByName = 'Monitoring Officer';
        let conductedByAvatar: string | null = null;
        let conductedByRole: string | null = null;

        if (sessionData.conducted_by) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, position_title, role')
            .eq('id', sessionData.conducted_by)
            .maybeSingle();
          if (prof) {
            if (prof.full_name) conductedByName = prof.full_name;
            if (prof.avatar_url) conductedByAvatar = prof.avatar_url;
            if (prof.position_title) {
              conductedByRole = prof.position_title;
            } else if (prof.role === 'admin') {
              conductedByRole = 'System Administrator';
            }
          }
        }

        const sessionRec: RollCallSessionRecord = {
          id: sessionData.id,
          session_date: sessionData.session_date,
          session_time: sessionData.session_time,
          frequency: sessionData.frequency || '142.500 MHz',
          radio_script: sessionData.radio_script || 'Standby for Net Roll Call',
          conducted_by: sessionData.conducted_by || null,
          conducted_by_name: conductedByName,
          conducted_by_avatar: conductedByAvatar,
          conducted_by_role: conductedByRole,
          status: sessionData.status,
          total_stations: sessionData.total_stations,
          present_count: sessionData.present_count,
          absent_count: sessionData.absent_count,
          exempted_count: sessionData.exempted_count,
          weather_summary: sessionData.weather_summary,
          created_at: sessionData.created_at,
        };

        // Compare against activeSessionRef to avoid useless re-renders
        const prevSession = activeSessionRef.current;
        const sessionChanged =
          !prevSession ||
          prevSession.id !== sessionRec.id ||
          prevSession.status !== sessionRec.status ||
          prevSession.present_count !== sessionRec.present_count ||
          prevSession.absent_count !== sessionRec.absent_count ||
          prevSession.exempted_count !== sessionRec.exempted_count ||
          prevSession.conducted_by !== sessionRec.conducted_by;

        if (sessionChanged) {
          setActiveSession(sessionRec);
        }

        // 2. Fetch linked responses from public.roll_call_entries
        const { data: entriesData } = await supabase
          .from('roll_call_entries')
          .select('*')
          .eq('session_id', sessionData.id);

        const entryMap = new Map<string, any>();
        if (entriesData) {
          entriesData.forEach((e: any) => {
            entryMap.set(e.area_id || e.area_code, e);
          });
        }

        // Merge entries with base areas list
        const merged: MunicipalityRow[] = targetAreas.map((area) => {
          const matched = entryMap.get(area.id) || entryMap.get(area.code);
          if (matched) {
            return {
              ...area,
              attendance: (matched.attendance as any) || null,
              weatherStatus: matched.weather_status || null,
              portStatus: matched.port_status || null,
              timeResponded: matched.time_responded || null,
            };
          }
          return { ...area, attendance: 'Absent', weatherStatus: null, portStatus: null };
        });

        // Compare merged against municipalitiesRef to avoid useless re-renders
        const prevMuns = municipalitiesRef.current;
        let entriesChanged = prevMuns.length !== merged.length;
        if (!entriesChanged) {
          for (let i = 0; i < merged.length; i++) {
            const m = merged[i];
            const p = prevMuns[i];
            if (
              !p ||
              m.id !== p.id ||
              m.attendance !== p.attendance ||
              m.weatherStatus !== p.weatherStatus ||
              m.portStatus !== p.portStatus ||
              m.timeResponded !== p.timeResponded
            ) {
              entriesChanged = true;
              break;
            }
          }
        }

        if (entriesChanged) {
          setMunicipalities(merged);
        }
      } else {
        // No active session in progress -> Standby mode with dynamic areas list
        if (activeSessionRef.current !== null) {
          setActiveSession(null);
        }
        const prevMuns = municipalitiesRef.current;
        const resetMuns: MunicipalityRow[] = targetAreas.map((a) => ({ ...a, attendance: 'Absent', weatherStatus: null, portStatus: null }));

        let munsChanged = prevMuns.length !== resetMuns.length;
        if (!munsChanged) {
          for (let i = 0; i < resetMuns.length; i++) {
            if (resetMuns[i].id !== prevMuns[i]?.id || prevMuns[i]?.attendance !== resetMuns[i].attendance) {
              munsChanged = true;
              break;
            }
          }
        }
        if (munsChanged) {
          setMunicipalities(resetMuns);
        }
      }
    } catch (err) {
      console.error('Error fetching active roll call session:', err);
    }
  }, []);

  // ===========================================================================
  // 2. EGRESS-OPTIMIZED ANALYTICS DATA FETCHING
  // ===========================================================================

  const fetchAnalyticsData = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('roll_call_sessions')
        .select(`
          id,
          session_date,
          session_time,
          frequency,
          conducted_by,
          status,
          total_stations,
          present_count,
          absent_count,
          exempted_count,
          weather_summary,
          created_at,
          roll_call_entries (
            id,
            session_id,
            area_id,
            area_code,
            area_name,
            attendance,
            weather_status,
            port_status,
            time_responded,
            created_at
          )
        `)
        .order('session_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (sessionsError) {
        console.warn('Error querying analytics sessions:', sessionsError.message);
        return;
      }

      if (sessionsData) {
        // Collect conductor profile IDs to batch resolve in a single egress query
        const conductorIds = Array.from(
          new Set(sessionsData.map((s: any) => s.conducted_by).filter(Boolean))
        );

        let profileMap = new Map<string, { full_name: string; avatar_url: string | null; position_title: string | null; role: string }>();
        if (conductorIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, position_title, role')
            .in('id', conductorIds);
          if (profs) {
            profs.forEach((p) => {
              profileMap.set(p.id, {
                full_name: p.full_name,
                avatar_url: p.avatar_url,
                position_title: p.position_title,
                role: p.role,
              });
            });
          }
        }

        const formattedSessions: RollCallHistorySession[] = sessionsData.map((s: any) => {
          const prof = s.conducted_by ? profileMap.get(s.conducted_by) : null;
          let roleTitle = prof?.position_title;
          if (!roleTitle && prof?.role === 'admin') roleTitle = 'System Administrator';
          if (!roleTitle) roleTitle = 'Monitoring Officer';

          return {
            id: s.id,
            session_date: s.session_date,
            session_time: s.session_time,
            frequency: s.frequency || '142.500 MHz',
            conducted_by: s.conducted_by,
            conducted_by_name: prof?.full_name || 'Monitoring Officer',
            conducted_by_avatar: prof?.avatar_url || null,
            conducted_by_role: roleTitle,
            status: s.status,
            total_stations: s.total_stations || 0,
            present_count: s.present_count || 0,
            absent_count: s.absent_count || 0,
            exempted_count: s.exempted_count || 0,
            weather_summary: s.weather_summary,
            created_at: s.created_at,
            entries: (s.roll_call_entries || []).map((e: any) => ({
              id: e.id,
              session_id: e.session_id,
              area_id: e.area_id,
              area_code: e.area_code,
              area_name: e.area_name,
              attendance: e.attendance,
              weather_status: e.weather_status,
              port_status: e.port_status,
              time_responded: e.time_responded,
              created_at: e.created_at,
            })),
          };
        });

        setAnalyticsSessions(formattedSessions);
      }
    } catch (err) {
      console.error('Failed to load roll call analytics:', err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, []);

  // Initialize Page & Area Data Once on Mount
  useEffect(() => {
    let mounted = true;
    const initializeData = async () => {
      setIsLoading(true);
      const loadedAreas = await fetchAreas();
      if (mounted) {
        await fetchActiveRollCallSession(loadedAreas, false);
        await fetchAnalyticsData();
      }
      if (mounted) {
        setIsLoading(false);
      }
    };
    initializeData();
    return () => {
      mounted = false;
    };
  }, [fetchAreas, fetchActiveRollCallSession, fetchAnalyticsData]);

  // ===========================================================================
  // 3. REAL-TIME SUBSCRIPTIONS & MULTI-USER BROADCASTING
  // ===========================================================================

  // Broadcast sync signal to peer screens
  const broadcastSync = (event: 'roll_call_updated' | 'roll_call_completed' | 'roll_call_reset' | 'archives_updated') => {
    try {
      const channel = supabase.channel('realtime_roll_call_broadcast');
      channel.send({
        type: 'broadcast',
        event,
        payload: { timestamp: Date.now() },
      });
    } catch (e) {
      console.warn('Could not broadcast roll call sync:', e);
    }
  };

  useEffect(() => {
    // 1. WebSocket Broadcast Channel
    const broadcastChannel = supabase
      .channel('realtime_roll_call_broadcast', {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'roll_call_updated' }, async () => {
        const freshAreas = await fetchAreas();
        fetchActiveRollCallSession(freshAreas, true);
      })
      .on('broadcast', { event: 'roll_call_completed' }, async () => {
        const freshAreas = await fetchAreas();
        fetchActiveRollCallSession(freshAreas, true);
        fetchAnalyticsData();
      })
      .on('broadcast', { event: 'roll_call_reset' }, async () => {
        const freshAreas = await fetchAreas();
        fetchActiveRollCallSession(freshAreas, true);
        fetchAnalyticsData();
      })
      .subscribe();

    // 2. PostgreSQL CDC Channel for table-level changes
    const cdcChannel = supabase
      .channel('realtime_roll_call_cdc')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roll_call_sessions' },
        () => {
          fetchActiveRollCallSession(undefined, true);
          fetchAnalyticsData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roll_call_entries' },
        () => {
          fetchActiveRollCallSession(undefined, true);
          fetchAnalyticsData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'areas' },
        async () => {
          const freshAreas = await fetchAreas();
          fetchActiveRollCallSession(freshAreas, true);
        }
      )
      .subscribe();

    // 3. Fallback Heartbeat Pulse every 5 seconds
    const interval = setInterval(async () => {
      const freshAreas = await fetchAreas();
      fetchActiveRollCallSession(freshAreas, true);
    }, 5000);

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(cdcChannel);
      clearInterval(interval);
    };
  }, [fetchAreas, fetchActiveRollCallSession, fetchAnalyticsData]);

  // ===========================================================================
  // 4. COMPUTED TELEMETRY & ANALYTICS DERIVATIONS (IN-MEMORY FOR ZERO EGRESS)
  // ===========================================================================

  // Current Operations Counts
  const totalCount = municipalities.length;
  const presentCount = municipalities.filter((m) => m.attendance === 'Present').length;
  const absentCount = municipalities.filter((m) => m.attendance === 'Absent').length;
  const exemptedCount = municipalities.filter((m) => m.attendance === 'Exempted').length;
  const recordedCount = presentCount + absentCount + exemptedCount;

  // Filter analytics sessions by selected month
  const currentMonthKey = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const currentMonthName = useMemo(() => format(new Date(), 'MMMM yyyy'), []);

  // Filter sessions according to selectedMonthFilter
  const filteredAnalyticsSessions = useMemo(() => {
    if (selectedMonthFilter === 'all') return analyticsSessions;
    return analyticsSessions.filter((s) => {
      if (!s.session_date) return false;
      return s.session_date.startsWith(selectedMonthFilter);
    });
  }, [analyticsSessions, selectedMonthFilter]);

  // Aggregate monthly counts for the selected month (or current month)
  const currentMonthSessions = useMemo(() => {
    return analyticsSessions.filter((s) => s.session_date && s.session_date.startsWith(currentMonthKey));
  }, [analyticsSessions, currentMonthKey]);

  // Monthly Present & Absent Counts
  const monthlyPresentCount = useMemo(() => {
    return currentMonthSessions.reduce((acc, s) => acc + (s.present_count || 0), 0);
  }, [currentMonthSessions]);

  const monthlyAbsentCount = useMemo(() => {
    return currentMonthSessions.reduce((acc, s) => acc + (s.absent_count || 0), 0);
  }, [currentMonthSessions]);

  const totalRegisteredLgus = areasList.length;

  // Compute Per-LGU Statistics
  const lguAnalyticsList = useMemo<LGUAnalyticsSummary[]>(() => {
    return areasList.map((area) => {
      let presCount = 0;
      let absCount = 0;
      let exCount = 0;
      let totalSess = 0;

      const presentRecs: LGUAnalyticsSummary['presentRecords'] = [];
      const absentRecs: LGUAnalyticsSummary['absentRecords'] = [];
      const trendList: LGUAnalyticsSummary['trendData'] = [];

      let latestWeather: string | null = null;
      let latestPortStatus: string | null = null;
      let lastModeratorName: string | undefined = undefined;
      let lastModeratorAvatar: string | null | undefined = undefined;
      let lastModeratorRole: string | null | undefined = undefined;
      let lastFreq: string | undefined = undefined;
      let lastDate: string | null = null;
      let lastTime: string | null = null;
      let lastAttendance: 'Present' | 'Absent' | 'Exempted' | null = null;

      // Scan through all sessions (chronologically newest to oldest)
      filteredAnalyticsSessions.forEach((sess) => {
        const entry = sess.entries.find((e) => e.area_id === area.id || e.area_code === area.code);
        if (entry && entry.attendance) {
          totalSess++;
          if (entry.attendance === 'Present') {
            presCount++;
            presentRecs.push({
              id: entry.id,
              sessionId: sess.id,
              sessionDate: sess.session_date,
              sessionTime: sess.session_time,
              weatherStatus: entry.weather_status,
              portStatus: entry.port_status,
              timeResponded: entry.time_responded,
              conductedByName: sess.conducted_by_name,
              conductedByAvatar: sess.conducted_by_avatar,
              frequency: sess.frequency,
            });
          } else if (entry.attendance === 'Absent') {
            absCount++;
            absentRecs.push({
              id: entry.id,
              sessionId: sess.id,
              sessionDate: sess.session_date,
              sessionTime: sess.session_time,
              conductedByName: sess.conducted_by_name,
              conductedByAvatar: sess.conducted_by_avatar,
              frequency: sess.frequency,
            });
          } else if (entry.attendance === 'Exempted') {
            exCount++;
          }

          // Capture latest session details
          if (!lastDate) {
            lastDate = sess.session_date;
            lastTime = sess.session_time;
            lastAttendance = entry.attendance;
            latestWeather = entry.weather_status || null;
            latestPortStatus = entry.port_status || null;
            lastModeratorName = sess.conducted_by_name;
            lastModeratorAvatar = sess.conducted_by_avatar;
            lastModeratorRole = sess.conducted_by_role;
            lastFreq = sess.frequency;
          }

          trendList.push({
            sessionLabel: `${sess.session_date} ${sess.session_time}`,
            date: sess.session_date,
            time: sess.session_time,
            attendance: entry.attendance,
            value: 100,
            presentScore: entry.attendance === 'Present' ? 100 : 0,
            absentScore: entry.attendance === 'Absent' ? 100 : 0,
            conductedBy: sess.conducted_by_name,
          });
        }
      });

      // Reverse trend so chart reads from oldest -> newest left-to-right
      const chronologicTrend = [...trendList].reverse();

      const attendanceRate = totalSess > 0 ? Math.round((presCount / totalSess) * 100) : 0;

      return {
        id: area.id,
        code: area.code,
        name: area.name,
        hasPort: Boolean(area.hasPort),
        portName: area.portName,
        sortOrder: area.sortOrder ?? 0,
        isActive: area.isActive ?? true,
        totalPresent: presCount,
        totalAbsent: absCount,
        totalExempted: exCount,
        totalSessions: totalSess,
        attendanceRate,
        latestWeather,
        latestPortStatus,
        lastModeratorName,
        lastModeratorAvatar,
        lastModeratorRole,
        lastFrequency: lastFreq,
        lastSessionDate: lastDate,
        lastSessionTime: lastTime,
        lastAttendance,
        presentRecords: presentRecs,
        absentRecords: absentRecs,
        trendData: chronologicTrend,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [areasList, filteredAnalyticsSessions]);

  // Filtered LGU list based on search input
  const filteredLguAnalytics = useMemo(() => {
    if (!analyticsSearchQuery.trim()) return lguAnalyticsList;
    const q = analyticsSearchQuery.toLowerCase();
    return lguAnalyticsList.filter(
      (lgu) => lgu.name.toLowerCase().includes(q) || lgu.code.toLowerCase().includes(q)
    );
  }, [lguAnalyticsList, analyticsSearchQuery]);

  // Available Month Filter Options from Recorded Sessions
  const availableMonthOptions = useMemo(() => {
    const monthSet = new Set<string>();
    monthSet.add(currentMonthKey);
    analyticsSessions.forEach((s) => {
      if (s.session_date && s.session_date.length >= 7) {
        monthSet.add(s.session_date.slice(0, 7));
      }
    });

    const list = Array.from(monthSet).sort().reverse();
    return list.map((mKey) => {
      try {
        const d = new Date(`${mKey}-01`);
        return {
          key: mKey,
          label: format(d, 'MMMM yyyy'),
        };
      } catch (_) {
        return { key: mKey, label: mKey };
      }
    });
  }, [analyticsSessions, currentMonthKey]);

  // ===========================================================================
  // 5. EDIT LGU HANDLERS
  // ===========================================================================

  const handleOpenEditLgu = (lgu: MunicipalityRow | LGUAnalyticsSummary) => {
    setEditingLgu({
      id: lgu.id,
      code: lgu.code,
      name: lgu.name,
      hasPort: lgu.hasPort,
      portName: lgu.portName || 'None',
      sortOrder: lgu.sortOrder ?? 0,
      isActive: lgu.isActive ?? true,
      attendance: null,
      weatherStatus: null,
      portStatus: null,
    });
    setEditLguForm({
      name: lgu.name,
      hasPort: Boolean(lgu.hasPort),
      portName: lgu.portName && lgu.portName !== 'None' ? lgu.portName : '',
    });
    setIsEditModalOpen(true);
    setActiveAnalyticsMenuId(null);
  };

  const handleSaveLguDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLgu || !editLguForm.name.trim()) return;

    setIsSavingLgu(true);
    try {
      const updatedPortName = editLguForm.hasPort
        ? editLguForm.portName.trim() || `${editLguForm.name.trim()} Port`
        : 'None';

      const { error } = await supabase
        .from('areas')
        .update({
          name: editLguForm.name.trim(),
          has_port: editLguForm.hasPort,
          port_name: updatedPortName,
        })
        .eq('id', editingLgu.id);

      if (error) {
        throw error;
      }

      // Refresh areas dynamically (sorted alphabetically)
      const freshAreas = await fetchAreas();
      fetchActiveRollCallSession(freshAreas, true);

      // If currently viewing this LGU in side drawer, update view
      if (selectedLguForView && selectedLguForView.id === editingLgu.id) {
        setSelectedLguForView((prev) =>
          prev
            ? {
                ...prev,
                name: editLguForm.name.trim(),
                hasPort: editLguForm.hasPort,
                portName: updatedPortName,
              }
            : null
        );
      }

      setIsEditModalOpen(false);
      setSaveToastMessage({
        title: 'LGU Details Updated',
        subtitle: `Station details for ${editLguForm.name.trim()} saved to database.`,
      });
      setShowSaveToast(true);
      broadcastSync('roll_call_updated');
    } catch (err: any) {
      console.error('Error updating LGU details:', err);
      alert(`Could not save LGU: ${err.message || err}`);
    } finally {
      setIsSavingLgu(false);
    }
  };

  const handleOpenViewDrawer = (lguSummary: LGUAnalyticsSummary) => {
    setSelectedLguForView(lguSummary);
    setAbsentPage(1);
    setPresentPage(1);
    setIsViewDrawerOpen(true);
    setActiveAnalyticsMenuId(null);
  };

  // Helper validation for operations
  const isRowComplete = (mun: MunicipalityRow) => {
    if (!mun.attendance) return false;
    if (mun.attendance === 'Absent' || mun.attendance === 'Exempted') return true;
    if (mun.attendance === 'Present') {
      const hasWeather = Boolean(mun.weatherStatus && mun.weatherStatus !== 'N/A');
      const hasPortRequirement = !mun.hasPort || Boolean(mun.portStatus && mun.portStatus !== 'N/A');
      return hasWeather && hasPortRequirement;
    }
    return false;
  };

  // ===========================================================================
  // 6. LIVE ROLL CALL OPERATIONAL HANDLERS
  // ===========================================================================

  const triggerAutoAdvance = (currentMunId: string, updatedRow: MunicipalityRow) => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }

    if (isRowComplete(updatedRow)) {
      const currentIndex = municipalities.findIndex((m) => m.id === currentMunId);
      const nextIncompleteMun = municipalities.find(
        (m, idx) => idx > currentIndex && !isRowComplete(m)
      );

      if (nextIncompleteMun) {
        setAutoAdvancingNotice(`Auto-advancing to ${nextIncompleteMun.name}...`);
        autoAdvanceTimerRef.current = setTimeout(() => {
          const el = document.getElementById(`station-row-${nextIncompleteMun.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('bg-blue-50/80');
            setTimeout(() => el.classList.remove('bg-blue-50/80'), 1200);
          }
          setAutoAdvancingNotice(null);
        }, 600);
      }
    }
  };

  // Start Live Roll Call Session
  const handleStartRollCall = async () => {
    if (isRollCallViewOnly) return;
    setIsSubmitting(true);
    try {
      const now = new Date();
      const militaryTime = getMilitaryTime(now);
      const dateFormatted = format(now, 'yyyy-MM-dd');
      const officerId = user?.id || profile?.id;
      const officerName = profile?.full_name || 'Monitoring Officer';
      const officerRole = profile?.position_title || (profile?.role === 'admin' ? 'System Administrator' : 'Monitoring Officer');

      const { data: newSession, error: createError } = await supabase
        .from('roll_call_sessions')
        .insert({
          session_date: dateFormatted,
          session_time: militaryTime,
          frequency: '142.500 MHz',
          radio_script: radioScript,
          conducted_by: officerId,
          status: 'in_progress',
          total_stations: areasList.length,
          present_count: 0,
          absent_count: areasList.length,
          exempted_count: 0,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Batch insert default 'Absent' entries for all registered areas into public.roll_call_entries
      if (areasList.length > 0) {
        try {
          const initialEntries = areasList.map((area) => ({
            session_id: newSession.id,
            area_id: area.id,
            area_code: area.code,
            area_name: area.name,
            attendance: 'Absent' as const,
            weather_status: null,
            port_status: null,
            time_responded: null,
          }));
          await supabase.from('roll_call_entries').upsert(initialEntries, { onConflict: 'session_id,area_id' });
        } catch (initErr) {
          console.warn('Initial entries sync notice:', initErr);
        }
      }

      // Populate fresh active session
      const sessionRecord: RollCallSessionRecord = {
        id: newSession.id,
        session_date: newSession.session_date,
        session_time: newSession.session_time,
        frequency: newSession.frequency,
        radio_script: newSession.radio_script,
        conducted_by: officerId,
        conducted_by_name: officerName,
        conducted_by_avatar: profile?.avatar_url,
        conducted_by_role: officerRole,
        status: newSession.status,
        total_stations: newSession.total_stations,
        present_count: 0,
        absent_count: areasList.length,
        exempted_count: 0,
        weather_summary: null,
        created_at: newSession.created_at,
      };

      setActiveSession(sessionRecord);
      setMunicipalities(areasList.map((a) => ({ ...a, attendance: 'Absent' as const, weatherStatus: null, portStatus: null })));
      broadcastSync('roll_call_updated');
    } catch (err: any) {
      console.error('Error starting roll call session:', err);
      alert(`Could not start roll call session: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Attendance Status (Default Absent -> Single Click to Toggle Present)
  const handleToggleAttendance = async (munId: string) => {
    if (isRollCallViewOnly || !canModerateRollCall) return;

    const targetMun = municipalities.find((m) => m.id === munId);
    if (!targetMun) return;

    const isCurrentlyPresent = targetMun.attendance === 'Present';
    const newAttendance: 'Present' | 'Absent' = isCurrentlyPresent ? 'Absent' : 'Present';

    let newWeather = targetMun.weatherStatus;
    let newPort = targetMun.portStatus;
    let timeResponded = targetMun.timeResponded;

    if (newAttendance === 'Present') {
      timeResponded = timeResponded || getMilitaryTime();
      if (!newWeather || newWeather === 'N/A') newWeather = 'Fair';
      if (targetMun.hasPort && (!newPort || newPort === 'N/A')) newPort = 'Operational';
    } else {
      newWeather = null;
      newPort = null;
      timeResponded = null;
    }

    const updatedRow: MunicipalityRow = {
      ...targetMun,
      attendance: newAttendance,
      weatherStatus: newWeather,
      portStatus: newPort,
      timeResponded,
    };

    setMunicipalities((prev) => prev.map((m) => (m.id === munId ? updatedRow : m)));

    // Upsert entry into public.roll_call_entries if session is active
    if (activeSession) {
      try {
        await supabase.from('roll_call_entries').upsert(
          {
            session_id: activeSession.id,
            area_id: munId,
            area_code: targetMun.code,
            area_name: targetMun.name,
            attendance: newAttendance,
            weather_status: newWeather,
            port_status: newPort,
            time_responded: timeResponded,
          },
          { onConflict: 'session_id,area_id' }
        );

        // Update session live counters
        const updatedList = municipalities.map((m) => (m.id === munId ? updatedRow : m));
        const pCount = updatedList.filter((m) => m.attendance === 'Present').length;
        const aCount = updatedList.filter((m) => m.attendance === 'Absent').length;
        const eCount = updatedList.filter((m) => m.attendance === 'Exempted').length;

        await supabase
          .from('roll_call_sessions')
          .update({
            present_count: pCount,
            absent_count: aCount,
            exempted_count: eCount,
          })
          .eq('id', activeSession.id);

        setActiveSession((prev) =>
          prev
            ? {
                ...prev,
                present_count: pCount,
                absent_count: aCount,
                exempted_count: eCount,
              }
            : null
        );

        broadcastSync('roll_call_updated');
      } catch (dbErr) {
        console.warn('Could not sync entry to database:', dbErr);
      }
    }

    triggerAutoAdvance(munId, updatedRow);
  };

  // Weather Status Change Handler
  const handleWeatherChange = async (munId: string, weather: string) => {
    if (isRollCallViewOnly || !canModerateRollCall) return;

    const targetMun = municipalities.find((m) => m.id === munId);
    if (!targetMun) return;

    const updatedRow: MunicipalityRow = { ...targetMun, weatherStatus: weather };
    setMunicipalities((prev) => prev.map((m) => (m.id === munId ? updatedRow : m)));

    if (activeSession && targetMun.attendance) {
      try {
        await supabase.from('roll_call_entries').upsert(
          {
            session_id: activeSession.id,
            area_id: munId,
            area_code: targetMun.code,
            area_name: targetMun.name,
            attendance: targetMun.attendance,
            weather_status: weather,
            port_status: targetMun.portStatus,
            time_responded: targetMun.timeResponded,
          },
          { onConflict: 'session_id,area_id' }
        );
        broadcastSync('roll_call_updated');
      } catch (dbErr) {
        console.warn('Could not sync weather update to DB:', dbErr);
      }
    }

    triggerAutoAdvance(munId, updatedRow);
  };

  // Port Status Change Handler
  const handlePortChange = async (munId: string, portStatus: string) => {
    if (isRollCallViewOnly || !canModerateRollCall) return;

    const targetMun = municipalities.find((m) => m.id === munId);
    if (!targetMun) return;

    const updatedRow: MunicipalityRow = { ...targetMun, portStatus };
    setMunicipalities((prev) => prev.map((m) => (m.id === munId ? updatedRow : m)));

    if (activeSession && targetMun.attendance) {
      try {
        await supabase.from('roll_call_entries').upsert(
          {
            session_id: activeSession.id,
            area_id: munId,
            area_code: targetMun.code,
            area_name: targetMun.name,
            attendance: targetMun.attendance,
            weather_status: targetMun.weatherStatus,
            port_status: portStatus,
            time_responded: targetMun.timeResponded,
          },
          { onConflict: 'session_id,area_id' }
        );
        broadcastSync('roll_call_updated');
      } catch (dbErr) {
        console.warn('Could not sync port update to DB:', dbErr);
      }
    }

    triggerAutoAdvance(munId, updatedRow);
  };

  // Open Finalize & Review Modal
  const handleOpenFinalizeModal = () => {
    const incomplete = municipalities.filter((m) => !isRowComplete(m));
    if (incomplete.length > 0) {
      setAlertBanner({
        type: 'warning',
        title: 'Incomplete Station Records',
        message: `${incomplete.length} municipality record(s) need completion before finalizing. Please record attendance and required weather/port telemetry.`,
        incompleteStations: incomplete.map((s) => s.name),
      });
      return;
    }
    setAlertBanner(null);
    setIsRecordPreviewModalOpen(true);
  };

  // Finalize & Archive Roll Call Session (Certified SHA-256 PDF + Storage Upload)
  const handleFinalizeSaveRecord = async () => {
    if (!activeSession || isRollCallViewOnly) return;

    setIsSubmitting(true);
    try {
      const now = new Date();
      const militaryTime = getMilitaryTime(now);
      const dateFormatted = format(now, 'yyyy-MM-dd');
      const timeFormatted = format(now, 'HHmm') + 'H';
      const officerId = user?.id || profile?.id;
      const officerName = profile?.full_name || 'Monitoring Officer';
      const officerRole = profile?.position_title || (profile?.role === 'admin' ? 'System Administrator' : 'Monitoring Officer');

      // Weather condition breakdown summary
      const weatherCounts = municipalities
        .filter((m) => m.attendance === 'Present' && m.weatherStatus)
        .reduce((acc, m) => {
          acc[m.weatherStatus!] = (acc[m.weatherStatus!] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const weatherSummaryText =
        Object.entries(weatherCounts)
          .map(([w, c]) => `${w}: ${c}`)
          .join(', ') || 'No weather telemetry recorded';

      // 1. Generate SHA-256 integrity hash payload
      const snapshotPayload = {
        sessionId: activeSession.id,
        sessionDate: dateFormatted,
        sessionTime: activeSession.session_time,
        frequency: activeSession.frequency,
        radioScript: activeSession.radio_script,
        conductedBy: officerName,
        conductedByRole: officerRole,
        totalStations: totalCount,
        present: presentCount,
        absent: absentCount,
        exempted: exemptedCount,
        weatherSummary: weatherSummaryText,
        records: municipalities.map((m) => ({
          code: m.code,
          name: m.name,
          attendance: m.attendance,
          weather: m.weatherStatus,
          port: m.portStatus,
          time: m.timeResponded,
        })),
        timestamp: now.toISOString(),
      };

      const payloadString = JSON.stringify(snapshotPayload);
      let fileHash = 'PENDING-HASH';
      try {
        const msgBuffer = new TextEncoder().encode(payloadString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        fileHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (hErr) {
        fileHash = `HASH-${Date.now()}`;
      }

      const archiveFilename = `ROLLCALL-REPORT-${dateFormatted.replace(/-/g, '')}-${timeFormatted}.pdf`;

      // 2. Generate PDF document
      const { blob: pdfBlob, sizeBytes: pdfSize } = await generateRollCallPDF({
        filename: archiveFilename,
        sessionDate: dateFormatted,
        sessionTime: timeFormatted,
        frequency: activeSession.frequency,
        radioScript: activeSession.radio_script,
        conductedBy: officerName,
        conductedByRole: officerRole,
        signatureUrl: profile?.signature_url,
        totalStations: totalCount,
        present: presentCount,
        absent: absentCount,
        exempted: exemptedCount,
        weatherSummary: weatherSummaryText,
        entries: municipalities,
        fileHash: fileHash,
        snapshotPayload: snapshotPayload,
      });

      // 3. Upload to storage bucket 'archive-documents'
      let storagePath = `RC/${archiveFilename}`;
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
        }
      } catch (sErr) {
        console.warn('Could not upload roll call PDF to storage:', sErr);
      }

      // 4. Batch sync all station entries into public.roll_call_entries
      if (municipalities.length > 0) {
        try {
          const allFinalEntries = municipalities.map((m) => ({
            session_id: activeSession.id,
            area_id: m.id,
            area_code: m.code,
            area_name: m.name,
            attendance: m.attendance || 'Absent',
            weather_status: m.attendance === 'Present' ? m.weatherStatus || 'Fair' : null,
            port_status: m.attendance === 'Present' && m.hasPort ? m.portStatus || 'Operational' : null,
            time_responded: m.attendance === 'Present' ? m.timeResponded || getMilitaryTime() : null,
          }));

          await supabase
            .from('roll_call_entries')
            .upsert(allFinalEntries, { onConflict: 'session_id,area_id' });
        } catch (bErr) {
          console.warn('Batch entries sync error on finalize:', bErr);
        }
      }

      // 5. Update session status to completed
      await supabase
        .from('roll_call_sessions')
        .update({
          status: 'completed',
          completed_at: now.toISOString(),
          weather_summary: weatherSummaryText,
          present_count: presentCount,
          absent_count: absentCount,
          exempted_count: exemptedCount,
        })
        .eq('id', activeSession.id);

      // 5. Insert into archives table
      const isUuid = (str: string | undefined | null) =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

      const validSessionId = isUuid(activeSession.id) ? activeSession.id : null;
      const validOfficerId = isUuid(officerId) ? officerId : null;

      try {
        await supabase.from('archives').insert({
          filename: archiveFilename,
          category: 'roll-call',
          roll_call_session_id: validSessionId,
          lead_officer_id: validOfficerId,
          lead_officer_name: officerName,
          lead_officer_role: officerRole,
          shift_label: 'Day Shift (Alpha)',
          shift_hours: `${timeFormatted} Roll Call`,
          item_count: totalCount,
          file_size_bytes: pdfSize,
          storage_path: storagePath,
          file_url: fileUrl,
          file_hash: fileHash,
          summary: `Roll Call Session completed on ${dateFormatted} at ${timeFormatted}. Present: ${presentCount}, Absent: ${absentCount}, Exempted: ${exemptedCount}. Frequency: ${activeSession.frequency}. Weather summary: ${weatherSummaryText}`,
          status: 'Verified',
          snapshot_data: snapshotPayload,
          generated_at: now.toISOString(),
        });
      } catch (aErr) {
        console.warn('Archives insert notice:', aErr);
      }

      broadcastSync('archives_updated');
      broadcastSync('roll_call_completed');

      // 6. Reset local state & show confirmation
      setSavedSummary({
        present: presentCount,
        absent: absentCount,
        exempted: exemptedCount,
        total: totalCount,
      });

      setSaveToastMessage({
        title: 'Roll Call Session Saved',
        subtitle: `Session archived with ${presentCount} present and ${absentCount} absent.`,
      });

      setIsRecordPreviewModalOpen(false);
      setShowSaveToast(true);
      setActiveSession(null);
      setMunicipalities(areasList.map((a) => ({ ...a, attendance: 'Absent' as const, weatherStatus: null, portStatus: null })));

      // Refresh analytics data immediately
      await fetchAnalyticsData();
    } catch (err: any) {
      console.error('Error finalizing roll call record:', err);
      alert(`Could not save record: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview Filtered Items for Modal
  const filteredPreviewItems = useMemo(() => {
    return municipalities.filter((mun) => {
      if (previewFilter === 'Present' && mun.attendance !== 'Present') return false;
      if (previewFilter === 'Absent' && mun.attendance !== 'Absent') return false;
      if (previewFilter === 'Exempted' && mun.attendance !== 'Exempted') return false;
      if (previewFilter === 'incomplete' && isRowComplete(mun)) return false;

      if (previewSearchQuery.trim()) {
        const q = previewSearchQuery.toLowerCase();
        return mun.name.toLowerCase().includes(q) || mun.code.toLowerCase().includes(q);
      }
      return true;
    });
  }, [municipalities, previewFilter, previewSearchQuery]);

  // ===========================================================================
  // 7. INITIAL LOADING SKELETON
  // ===========================================================================

  if (isLoading) {
    return (
      <AppLayoutShell
        title="Roll Call Operations"
        subtitle="Live Station Monitoring & Telemetry Recording"
      >
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2">
              <Skeleton variant="rounded" className="h-8 w-64" />
              <Skeleton variant="rounded" className="h-4 w-96 max-w-full" />
            </div>
            <Skeleton variant="pill" className="h-10 w-36" />
          </div>

          {/* Toggle Switch Skeleton */}
          <div className="flex gap-2">
            <Skeleton variant="pill" className="h-10 w-44" />
            <Skeleton variant="pill" className="h-10 w-44" />
          </div>

          {/* Bento Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] p-6 space-y-4">
                <Skeleton variant="rounded" className="h-5 w-32" />
                <Skeleton variant="rounded" className="h-28 w-full rounded-2xl" />
                <Skeleton variant="pill" className="h-12 w-full" />
              </div>
            </div>
            <div className="lg:col-span-8">
              <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] overflow-hidden min-h-[520px]">
                <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Skeleton variant="circular" className="w-10 h-10" />
                    <Skeleton variant="rounded" className="h-5 w-48" />
                  </div>
                  <Skeleton variant="pill" className="h-8 w-32" />
                </div>
                <RollCallTableSkeleton rowCount={7} />
              </div>
            </div>
          </div>
        </div>
      </AppLayoutShell>
    );
  }

  // ===========================================================================
  // 8. MAIN INTERFACE JSX
  // ===========================================================================

  return (
    <AppLayoutShell
      title="Roll Call Operations"
      subtitle="Live Station Monitoring, Telemetry Recording & Analytics"
    >
      <div className="space-y-6">
        {/* View-Only Role Restriction Banner */}
        <ViewOnlyNotice
          screen="Roll Call"
          message="You are currently viewing live roll call telemetry in read-only audit mode. Station recording and status toggling are disabled."
        />

        {/* Top Header Title, Subtitle & Action Links */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
              Roll Call Operations
            </h1>
            <p className="text-sm sm:text-base text-[#505F76] mt-1 font-medium max-w-2xl">
              Live VHF net radio station telemetry, disaster preparedness attendance, and long-term station analytics.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/archives" className="w-full sm:w-auto">
              <SecondaryButton
                size="md"
                pill
                leftIcon={<Archive className="w-4 h-4" />}
                className="w-full sm:w-auto justify-center"
              >
                Archived Reports
              </SecondaryButton>
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* HEADER VIEW SWITCHER: OPERATIONS VS ANALYTICS */}
        {/* ========================================================================= */}
        <div className="flex items-center flex-wrap gap-3 pb-1 border-b border-[#E2E8F0]">
          <div className="inline-flex p-1.5 bg-[#F1F5F9] rounded-full border border-[#E2E8F0] shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('operations')}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'operations'
                  ? 'bg-[#004AC6] text-white shadow-sm'
                  : 'text-[#505F76] hover:text-[#1E293B] hover:bg-slate-200/60'
              }`}
            >
              <RadioIcon className="w-4 h-4" />
              <span>Roll Call Operations</span>
              {isRollCallActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('analytics');
                fetchAnalyticsData();
              }}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-[#004AC6] text-white shadow-sm'
                  : 'text-[#505F76] hover:text-[#1E293B] hover:bg-slate-200/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Roll Call Analytics</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: ROLL CALL OPERATIONS (LIVE RADIO MONITORING) */}
        {/* ========================================================================= */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            {/* 1. TOP STATS & CURRENT ROLL CALL MODERATOR CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
              {/* Card 1: Net Radio Moderator / Conductor Card */}
              <div className="col-span-1 md:col-span-1 lg:col-span-7 bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden group">
                <div
                  className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -mr-6 -mt-6 pointer-events-none transition-transform duration-300 group-hover:scale-110 ${
                    isRollCallActive ? 'bg-emerald-500/5' : 'bg-slate-500/5'
                  }`}
                />

                <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
                  <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
                    <RadioIcon className="w-3.5 h-3.5 text-[#004AC6]" />
                    Net Radio Moderator
                  </span>
                  {isRollCallActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                      </span>
                      Roll Call Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[#505F76] border border-slate-200 text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Standby Mode
                    </span>
                  )}
                </div>

                <div className="relative z-10 flex items-center gap-4">
                  {isRollCallActive && activeSession ? (
                    <>
                      <OfficerAvatar
                        officer={{
                          name: activeSession.conducted_by_name || 'Monitoring Officer',
                          avatarUrl: activeSession.conducted_by_avatar,
                          avatarInitials: getInitials(activeSession.conducted_by_name || ''),
                        }}
                        size="lg"
                        className="ring-2 ring-emerald-500/20 shadow-xs shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-bold text-[#1E293B] truncate">
                          {activeSession.conducted_by_name || 'Monitoring Officer'}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-[#505F76] font-medium mt-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Started at <strong className="text-[#1E293B] font-semibold">{formatRollCallStartTime(activeSession)}</strong>
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
                          No Active Roll Call Session
                        </h3>
                        <p className="text-xs text-[#757680] mt-0.5">
                          Ready to conduct VHF station check. Click &quot;Start Roll Call&quot; below to begin.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Card 2: Station Telemetry Summary Card */}
              <div className="col-span-1 md:col-span-1 lg:col-span-5 bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-28 h-28 bg-[#004AC6]/5 rounded-bl-[100px] -mr-6 -mt-6 pointer-events-none transition-transform duration-300 group-hover:scale-110" />

                <div className="flex justify-between items-start mb-3 relative z-10">
                  <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#004AC6]" />
                    Station Telemetry
                  </span>
                </div>

                <div className="relative z-10 grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-slate-50/80 rounded-2xl py-2 px-1 border border-slate-100">
                    <div className="text-xl sm:text-2xl font-bold text-[#004AC6]">
                      {totalCount}
                    </div>
                    <div className="text-[10px] font-bold text-[#505F76] uppercase">
                      LGU
                    </div>
                  </div>
                  <div className="bg-emerald-50/80 rounded-2xl py-2 px-1 border border-emerald-100">
                    <div className="text-xl sm:text-2xl font-bold text-emerald-700">
                      {isRollCallActive ? presentCount : '--'}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">
                      Present
                    </div>
                  </div>
                  <div className="bg-rose-50/80 rounded-2xl py-2 px-1 border border-rose-100">
                    <div className="text-xl sm:text-2xl font-bold text-rose-700">
                      {isRollCallActive ? absentCount : '--'}
                    </div>
                    <div className="text-[10px] font-bold text-rose-700 uppercase">
                      Absent
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* In-App Alert Banner */}
            <AnimatePresence>
              {alertBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className={`p-4 sm:p-5 rounded-2xl border shadow-sm flex items-start justify-between gap-4 ${
                    alertBanner.type === 'error'
                      ? 'bg-rose-50/95 border-rose-200 text-rose-950'
                      : alertBanner.type === 'warning'
                      ? 'bg-amber-50/95 border-amber-200 text-amber-950'
                      : 'bg-blue-50/95 border-blue-200 text-blue-950'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        alertBanner.type === 'error'
                          ? 'bg-rose-100 text-rose-700 border-rose-200'
                          : alertBanner.type === 'warning'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-blue-100 text-[#004AC6] border-blue-200'
                      }`}
                    >
                      {alertBanner.type === 'error' ? (
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                      ) : alertBanner.type === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-700" />
                      ) : (
                        <RadioIcon className="w-5 h-5 text-[#004AC6]" />
                      )}
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm sm:text-base">
                          {alertBanner.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/60 border border-slate-300/60">
                          {alertBanner.type}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm font-medium leading-relaxed">
                        {alertBanner.message}
                      </p>

                      {alertBanner.incompleteStations && alertBanner.incompleteStations.length > 0 && (
                        <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-amber-900 mr-1">
                            Incomplete Stations ({alertBanner.incompleteStations.length}):
                          </span>
                          {alertBanner.incompleteStations.map((stationName) => (
                            <span
                              key={stationName}
                              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/90 text-amber-950 border border-amber-300 shadow-2xs"
                            >
                              {stationName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAlertBanner(null)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Single Moderator Concurrency Alert */}
            {isRollCallActive && !canModerateRollCall && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900 text-xs sm:text-sm">
                <Lock className="w-5 h-5 text-amber-700 shrink-0" />
                <p>
                  <strong>Session Locked by {activeSession?.conducted_by_name || 'Moderator'}:</strong>{' '}
                  Only the officer who initiated this roll call can mark entries or finalize records. You are viewing live telemetry in real-time.
                </p>
              </div>
            )}

            {/* Main Operational Split: Left Script & Controls, Right Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (4 Cols): Broadcast Script & Moderator Actions */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-[#004AC6]" />
                      Net Radio Script
                    </span>
                    <span className="text-[11px] font-bold text-[#004AC6] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      Standard Prompt
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm text-[#1E293B] italic font-medium leading-relaxed">
                    {radioScript}
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="space-y-3 pt-2">
                    {!isRollCallActive ? (
                      <PrimaryButton
                        size="lg"
                        pill
                        disabled={isSubmitting || !canModifyRollCall || isRollCallViewOnly}
                        onClick={handleStartRollCall}
                        leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RadioIcon className="w-4 h-4" />}
                        className="w-full justify-center text-sm font-bold shadow-md hover:shadow-lg"
                      >
                        {isSubmitting ? 'Initializing Session...' : 'Start Live Roll Call'}
                      </PrimaryButton>
                    ) : (
                      <PrimaryButton
                        size="lg"
                        pill
                        disabled={isSubmitting || !canModerateRollCall || recordedCount === 0}
                        onClick={handleOpenFinalizeModal}
                        leftIcon={<ShieldCheck className="w-4 h-4" />}
                        className="w-full justify-center text-sm font-bold bg-emerald-600 hover:bg-emerald-700 shadow-md"
                      >
                        Review & Finalize Record ({recordedCount}/{totalCount})
                      </PrimaryButton>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (8 Cols): Stations Table */}
              <div className="lg:col-span-8">
                <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm overflow-hidden min-h-[560px] flex flex-col">
                  {/* Table Header Strip */}
                  <div className="p-5 sm:p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center font-bold">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                          Monitoring Stations & LGUs
                        </h2>
                        <p className="text-xs text-[#505F76]">
                          {totalCount} Municipalities & Coastal Ports in Cebu Province
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#505F76]">
                        Progress: <strong className="text-[#1E293B]">{recordedCount} / {totalCount}</strong>
                      </span>
                      <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-[#004AC6] transition-all duration-300"
                          style={{ width: `${totalCount > 0 ? (recordedCount / totalCount) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stations Table */}
                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider bg-slate-50/50">
                          <th className="py-3 px-4 sm:px-6">LGU / Station</th>
                          <th className="py-3 px-3 sm:px-4 text-center">Attendance</th>
                          <th className="py-3 px-3 sm:px-4">Weather Telemetry</th>
                          <th className="py-3 px-4 sm:px-6">Port / Pier Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {municipalities.map((mun) => {
                          const isComplete = isRowComplete(mun);
                          return (
                            <tr
                              key={mun.id}
                              id={`station-row-${mun.id}`}
                              className={`transition-colors hover:bg-slate-50/70 ${
                                mun.attendance === 'Present'
                                  ? 'bg-emerald-50/20'
                                  : mun.attendance === 'Absent'
                                  ? 'bg-rose-50/20'
                                  : ''
                              }`}
                            >
                              {/* Station Name & Code */}
                              <td className="py-3.5 px-4 sm:px-6">
                                <div className="flex items-center gap-2.5">
                                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-[#505F76] border border-slate-200 shrink-0">
                                    {mun.code}
                                  </span>
                                  <div>
                                    <span className="font-bold text-[#1E293B] block">
                                      {mun.name}
                                    </span>
                                    {mun.hasPort && (
                                      <span className="text-[10px] text-sky-700 font-medium flex items-center gap-1">
                                        <Anchor className="w-2.5 h-2.5" />
                                        {mun.portName || 'Coastal Port'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Attendance Toggle Button (Default Absent -> Click for Present) */}
                              <td className="py-3.5 px-3 sm:px-4">
                                <div className="flex items-center justify-center">
                                  <button
                                    type="button"
                                    disabled={!isRollCallActive || !canModerateRollCall}
                                    onClick={() => handleToggleAttendance(mun.id)}
                                    className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                                      mun.attendance === 'Present'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs hover:bg-emerald-100/80'
                                        : 'bg-slate-100/90 text-[#505F76] border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    title={mun.attendance === 'Present' ? 'Station is Present. Click to switch to Absent' : 'Station is Absent. Click to mark Present'}
                                  >
                                    {/* Animated Pill Switch */}
                                    <span
                                      className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                                        mun.attendance === 'Present'
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-slate-300 group-hover:bg-emerald-500 text-white'
                                      }`}
                                    >
                                      {mun.attendance === 'Present' ? (
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      ) : (
                                        <X className="w-2.5 h-2.5 stroke-[3]" />
                                      )}
                                    </span>

                                    <span>{mun.attendance === 'Present' ? 'Present' : 'Absent'}</span>
                                  </button>
                                </div>
                              </td>

                              {/* Weather Condition Select */}
                              <td className="py-3.5 px-3 sm:px-4">
                                {mun.attendance === 'Present' ? (
                                  <div className="w-36">
                                    <CustomDropdown
                                      options={weatherDropdownOptions}
                                      value={mun.weatherStatus || 'Fair'}
                                      onChange={(val) => handleWeatherChange(mun.id, val)}
                                      disabled={!canModerateRollCall}
                                      size="sm"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">
                                    {mun.attendance ? `N/A (${mun.attendance})` : 'Awaiting Check'}
                                  </span>
                                )}
                              </td>

                              {/* Port Status Select */}
                              <td className="py-3.5 px-4 sm:px-6">
                                {mun.attendance === 'Present' ? (
                                  mun.hasPort ? (
                                    <div className="w-36">
                                      <CustomDropdown
                                        options={portDropdownOptions}
                                        value={mun.portStatus || 'Operational'}
                                        onChange={(val) => handlePortChange(mun.id, val)}
                                        disabled={!canModerateRollCall}
                                        size="sm"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400 font-medium">
                                      No Port / Inland
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-slate-400 italic">
                                    {mun.attendance ? `N/A (${mun.attendance})` : 'Awaiting Check'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: ROLL CALL ANALYTICS (TELEMETRY, TRENDS & LGU HISTORY) */}
        {/* ========================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* 1. Summary Cards Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {/* Card 1: Total LGU Registered */}
              <SummaryCard
                title="Total LGU Registered"
                value={totalRegisteredLgus}
                subtitle="Active VHF monitoring stations in Cebu"
                icon={<MapPin className="w-5 h-5" />}
                iconBg="bg-[#004AC6]/10 text-[#004AC6]"
                ambientColor="bg-[#004AC6]/5"
              />

              {/* Card 2: Total Present Counted (Monthly Count) */}
              <SummaryCard
                title={`Total Present Counted (${currentMonthName})`}
                value={monthlyPresentCount}
                subtitle="Present check-ins recorded this month"
                change={monthlyPresentCount > 0 ? `${monthlyPresentCount} Responses` : 'No logs yet'}
                changeType={monthlyPresentCount > 0 ? 'positive' : 'neutral'}
                icon={<CheckCircle2 className="w-5 h-5" />}
                iconBg="bg-emerald-50 text-emerald-600"
                ambientColor="bg-emerald-500/5"
              />

              {/* Card 3: Total Absent Counted (Monthly Count) */}
              <SummaryCard
                title={`Total Absent Counted (${currentMonthName})`}
                value={monthlyAbsentCount}
                subtitle="Absent marks recorded this month"
                change={monthlyAbsentCount > 0 ? `${monthlyAbsentCount} Unresponsive` : 'Zero Absents'}
                changeType={monthlyAbsentCount > 0 ? 'negative' : 'positive'}
                icon={<AlertCircle className="w-5 h-5" />}
                iconBg="bg-rose-50 text-rose-600"
                ambientColor="bg-rose-500/5"
              />
            </div>

            {/* 2. LGU Analytics Table Card */}
            <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm overflow-hidden">
              {/* Table Toolbar */}
              <div className="p-5 sm:p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center font-bold">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                      LGU Telemetry & Attendance Records
                    </h2>
                    <p className="text-xs text-[#505F76]">
                      Aggregated VHF roll call performance across {filteredLguAnalytics.length} registered stations
                    </p>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#757680]" />
                  <input
                    type="text"
                    value={analyticsSearchQuery}
                    onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                    placeholder="Search LGU or code..."
                    className="w-full bg-white border border-[#E2E8F0] rounded-full pl-9 pr-4 py-2 text-xs text-[#1E293B] placeholder-[#757680] focus:outline-none focus:border-[#004AC6] shadow-2xs"
                  />
                </div>
              </div>

              {/* Table Content */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3.5 px-4 sm:px-6">LGU Name</th>
                      <th className="py-3.5 px-4 sm:px-6 text-center">Total Present</th>
                      <th className="py-3.5 px-4 sm:px-6 text-center">Total Absent</th>
                      <th className="py-3.5 px-4 sm:px-6 text-center">Attendance Rate</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLguAnalytics.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <Activity className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                          <p className="font-semibold text-sm">No LGU stations match your search</p>
                        </td>
                      </tr>
                    ) : (
                      filteredLguAnalytics.map((lgu) => (
                        <tr
                          key={lgu.id}
                          className="hover:bg-slate-50/70 transition-colors group"
                        >
                          {/* LGU Name & Code */}
                          <td className="py-4 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-[#505F76] border border-slate-200 shrink-0">
                                {lgu.code}
                              </span>
                              <div>
                                <span className="font-bold text-[#1E293B] block text-sm">
                                  {lgu.name}
                                </span>
                                {lgu.hasPort ? (
                                  <span className="text-[11px] text-sky-700 font-semibold flex items-center gap-1 mt-0.5">
                                    <Anchor className="w-3 h-3" />
                                    {lgu.portName && lgu.portName !== 'None' ? lgu.portName : 'Coastal Port'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    Inland Station
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Total Present */}
                          <td className="py-4 px-4 sm:px-6 text-center">
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {lgu.totalPresent} Present
                            </span>
                          </td>

                          {/* Total Absent */}
                          <td className="py-4 px-4 sm:px-6 text-center">
                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold ${
                              lgu.totalAbsent > 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-[#505F76] border border-slate-200'
                            }`}>
                              {lgu.totalAbsent} Absent
                            </span>
                          </td>

                          {/* Attendance Rate */}
                          <td className="py-4 px-4 sm:px-6 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                                lgu.totalSessions === 0
                                  ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                  : lgu.attendanceRate >= 90
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : lgu.attendanceRate >= 75
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}>
                                {lgu.totalSessions > 0 ? `${lgu.attendanceRate}%` : 'No Data'}
                              </span>
                              {lgu.totalSessions > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {lgu.totalPresent}/{lgu.totalSessions} sessions
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Action (Three Dots Dropdown) */}
                          <td className="py-4 px-4 sm:px-6 text-right relative">
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveAnalyticsMenuId(activeAnalyticsMenuId === lgu.id ? null : lgu.id);
                                }}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                                aria-label="LGU actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {/* Dropdown Menu */}
                              <AnimatePresence>
                                {activeAnalyticsMenuId === lgu.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                    transition={{ duration: 0.12 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 mt-2 w-48 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleOpenViewDrawer(lgu)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-[#004AC6]" />
                                      View Analytics & History
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditLgu(lgu)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-[#505F76]" />
                                      Edit LGU Details
                                    </button>
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
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW SIDE MODAL / SLIDE-OVER DRAWER (LGU DETAILS, CHART & HISTORY) */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {isViewDrawerOpen && selectedLguForView && (
            <div className="fixed inset-0 z-50 overflow-hidden">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsViewDrawerOpen(false)}
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
              />

              <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 w-full sm:w-auto">
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                  className="w-full sm:w-screen sm:max-w-xl bg-white shadow-2xl flex flex-col h-full border-l border-[#E2E8F0]"
                >
                  {/* Drawer Header */}
                  <div className="p-4 sm:p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/90 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 sm:w-11 h-10 sm:h-11 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center font-bold shrink-0">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base sm:text-lg font-bold text-[#1E293B] truncate">
                            {selectedLguForView.name}
                          </h2>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-200 text-[#1E293B]">
                            {selectedLguForView.code}
                          </span>
                        </div>
                        <p className="text-xs text-[#505F76] mt-0.5 truncate">
                          {selectedLguForView.hasPort
                            ? `Coastal Municipality • Port: ${selectedLguForView.portName || 'Active Pier'}`
                            : 'Inland Station Municipality'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsViewDrawerOpen(false)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Drawer Scrollable Body */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
                    {/* Quick Stats Strip */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-center">
                        <span className="text-[10px] font-bold text-[#505F76] uppercase">Total Checks</span>
                        <p className="text-lg font-bold text-[#004AC6] mt-0.5">{selectedLguForView.totalSessions}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100 text-center">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase">Present</span>
                        <p className="text-lg font-bold text-emerald-700 mt-0.5">{selectedLguForView.totalPresent}</p>
                      </div>
                      <div className="bg-rose-50 rounded-2xl p-3 border border-rose-100 text-center">
                        <span className="text-[10px] font-bold text-rose-700 uppercase">Absent</span>
                        <p className="text-lg font-bold text-rose-700 mt-0.5">{selectedLguForView.totalAbsent}</p>
                      </div>
                    </div>

                    {/* 1. Bar Chart Trend */}
                    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5 uppercase tracking-wider">
                          <BarChart3 className="w-3.5 h-3.5 text-[#004AC6]" />
                          Attendance Trend Over Time
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Present ({selectedLguForView.totalPresent})
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Absent ({selectedLguForView.totalAbsent})
                          </span>
                          <span className="text-[11px] font-bold text-[#004AC6] bg-[#004AC6]/10 px-2 py-0.5 rounded-full border border-[#004AC6]/20">
                            {selectedLguForView.attendanceRate}% Presence
                          </span>
                        </div>
                      </div>

                      {selectedLguForView.totalSessions === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          No historical roll call session records available yet.
                        </div>
                      ) : (
                        <div className="h-44 w-full pt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={[
                                {
                                  category: 'Present',
                                  count: selectedLguForView.totalPresent,
                                  percentage: selectedLguForView.totalSessions > 0
                                    ? Math.round((selectedLguForView.totalPresent / selectedLguForView.totalSessions) * 100)
                                    : 0,
                                  fill: '#10B981',
                                },
                                {
                                  category: 'Absent',
                                  count: selectedLguForView.totalAbsent,
                                  percentage: selectedLguForView.totalSessions > 0
                                    ? Math.round((selectedLguForView.totalAbsent / selectedLguForView.totalSessions) * 100)
                                    : 0,
                                  fill: '#EF4444',
                                },
                              ]}
                              margin={{ top: 12, right: 20, left: -15, bottom: 0 }}
                              barCategoryGap="18%"
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                              <XAxis
                                dataKey="category"
                                tick={{ fontSize: 12, fontWeight: 700, fill: '#1E293B' }}
                                tickLine={false}
                                axisLine={{ stroke: '#E2E8F0' }}
                              />
                              <YAxis
                                allowDecimals={false}
                                tick={{ fontSize: 10, fill: '#64748B' }}
                                tickLine={false}
                                axisLine={false}
                              />
                              <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(0, 74, 198, 0.04)' }} />
                              <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={110} maxBarSize={140}>
                                <Cell fill="#10B981" />
                                <Cell fill="#EF4444" />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* 2. Last Roll Call Conductor / Moderator Details */}
                    <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-4 space-y-3">
                      <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
                        <RadioIcon className="w-3.5 h-3.5 text-[#004AC6]" />
                        Latest Roll Call Moderator Details
                      </span>

                      {selectedLguForView.lastModeratorName ? (
                        <div className="flex items-center gap-3.5 bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs">
                          <OfficerAvatar
                            officer={{
                              name: selectedLguForView.lastModeratorName,
                              avatarUrl: selectedLguForView.lastModeratorAvatar,
                              avatarInitials: getInitials(selectedLguForView.lastModeratorName),
                            }}
                            size="md"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-bold text-[#1E293B] truncate">
                              {selectedLguForView.lastModeratorName}
                            </h4>
                            <p className="text-[11px] text-[#505F76] font-medium">
                              {selectedLguForView.lastModeratorRole || 'Monitoring Officer'} • {selectedLguForView.lastFrequency || '142.500 MHz'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[11px] font-bold text-[#1E293B] block">
                              {selectedLguForView.lastSessionDate}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-semibold">
                              {selectedLguForView.lastSessionTime}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 py-2">
                          No recent moderator records found.
                        </div>
                      )}
                    </div>

                    {/* 3. Absent Dates Records */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          Absent Dates Records ({selectedLguForView.absentRecords.length})
                        </span>
                      </div>

                      {selectedLguForView.absentRecords.length === 0 ? (
                        <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>No absences recorded — Outstanding attendance record!</span>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {selectedLguForView.absentRecords
                              .slice((absentPage - 1) * 5, absentPage * 5)
                              .map((rec) => (
                                <div
                                  key={rec.id}
                                  className="p-3 rounded-xl bg-rose-50/50 border border-rose-200 flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                    <div>
                                      <span className="font-bold text-rose-950 block">
                                        {rec.sessionDate} • {rec.sessionTime}
                                      </span>
                                      <span className="text-[10px] text-rose-700 font-medium">
                                        Conducted by {rec.conductedByName || 'Duty Officer'}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                    Unresponsive
                                  </span>
                                </div>
                              ))}
                          </div>

                          {Math.ceil(selectedLguForView.absentRecords.length / 5) > 1 && (
                            <div className="flex items-center justify-center gap-1.5 pt-1">
                              <button
                                type="button"
                                disabled={absentPage === 1}
                                onClick={() => setAbsentPage((prev) => Math.max(1, prev - 1))}
                                className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#1E293B] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors cursor-pointer"
                                aria-label="Previous page"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>

                              {Array.from({ length: Math.ceil(selectedLguForView.absentRecords.length / 5) }, (_, i) => i + 1).map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setAbsentPage(p)}
                                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    absentPage === p
                                      ? 'bg-rose-600 text-white shadow-2xs'
                                      : 'bg-white border border-[#E2E8F0] text-[#505F76] hover:bg-slate-50 hover:text-[#1E293B]'
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}

                              <button
                                type="button"
                                disabled={absentPage === Math.ceil(selectedLguForView.absentRecords.length / 5)}
                                onClick={() => setAbsentPage((prev) => Math.min(Math.ceil(selectedLguForView.absentRecords.length / 5), prev + 1))}
                                className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#1E293B] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors cursor-pointer"
                                aria-label="Next page"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* 4. Present Details Records */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Present Details Records ({selectedLguForView.presentRecords.length})
                      </span>

                      {selectedLguForView.presentRecords.length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs">
                          No present responses recorded yet.
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {selectedLguForView.presentRecords
                              .slice((presentPage - 1) * 5, presentPage * 5)
                              .map((rec) => (
                                <div
                                  key={rec.id}
                                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-white transition-colors text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[#1E293B]">
                                      {rec.sessionDate} • {rec.sessionTime}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Present
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-[#505F76]">
                                    <span>Weather: <strong className="text-[#1E293B]">{rec.weatherStatus || 'Fair'}</strong></span>
                                    {selectedLguForView.hasPort && (
                                      <span>Port: <strong className="text-[#1E293B]">{rec.portStatus || 'Operational'}</strong></span>
                                    )}
                                    <span>Mod: <strong className="text-[#1E293B]">{rec.conductedByName || 'Officer'}</strong></span>
                                  </div>
                                </div>
                              ))}
                          </div>

                          {Math.ceil(selectedLguForView.presentRecords.length / 5) > 1 && (
                            <div className="flex items-center justify-center gap-1.5 pt-1">
                              <button
                                type="button"
                                disabled={presentPage === 1}
                                onClick={() => setPresentPage((prev) => Math.max(1, prev - 1))}
                                className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#1E293B] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors cursor-pointer"
                                aria-label="Previous page"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>

                              {Array.from({ length: Math.ceil(selectedLguForView.presentRecords.length / 5) }, (_, i) => i + 1).map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setPresentPage(p)}
                                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    presentPage === p
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-white border border-[#E2E8F0] text-[#505F76] hover:bg-slate-50 hover:text-[#1E293B]'
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}

                              <button
                                type="button"
                                disabled={presentPage === Math.ceil(selectedLguForView.presentRecords.length / 5)}
                                onClick={() => setPresentPage((prev) => Math.min(Math.ceil(selectedLguForView.presentRecords.length / 5), prev + 1))}
                                className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#1E293B] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors cursor-pointer"
                                aria-label="Next page"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Drawer Footer */}
                  <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
                    <SecondaryButton
                      size="sm"
                      pill
                      onClick={() => setIsViewDrawerOpen(false)}
                    >
                      Close Details
                    </SecondaryButton>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* EDIT LGU DETAILS MODAL */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {isEditModalOpen && editingLgu && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="w-full sm:max-w-lg bg-white rounded-t-[1.75rem] sm:rounded-[1.75rem] border border-[#E2E8F0] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
              >
                {/* Modal Header */}
                <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center font-bold shrink-0">
                      <Edit2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
                        Edit LGU Station Details
                      </h3>
                      <p className="text-[11px] sm:text-xs text-[#505F76]">
                        Update municipality name and coastal seaport metadata
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSaveLguDetails} className="flex-1 overflow-y-auto">
                  <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
                    <div>
                      <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                        Municipality / City Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editLguForm.name}
                        onChange={(e) => setEditLguForm({ ...editLguForm, name: e.target.value })}
                        placeholder="e.g. Alcantara"
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#004AC6]"
                      />
                    </div>

                    {/* Coastal / Port Presence Toggle */}
                    <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-[#1E293B] block">
                            Coastal Seaport Presence
                          </span>
                          <span className="text-[11px] text-[#505F76]">
                            Enable if this LGU has an operational seaport or pier
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={editLguForm.hasPort}
                          onChange={(e) => setEditLguForm({ ...editLguForm, hasPort: e.target.checked })}
                          className="w-4 h-4 rounded text-[#004AC6] focus:ring-[#004AC6] cursor-pointer"
                        />
                      </div>

                      {editLguForm.hasPort && (
                        <div>
                          <label className="block text-xs font-bold text-[#1E293B] mb-1">
                            Port / Pier Name
                          </label>
                          <input
                            type="text"
                            value={editLguForm.portName}
                            onChange={(e) => setEditLguForm({ ...editLguForm, portName: e.target.value })}
                            placeholder="e.g. Bayut Port"
                            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#004AC6]"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end gap-3">
                    <SecondaryButton
                      size="sm"
                      pill
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                    >
                      Cancel
                    </SecondaryButton>

                    <PrimaryButton
                      size="sm"
                      pill
                      type="submit"
                      disabled={isSavingLgu}
                      leftIcon={isSavingLgu ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    >
                      {isSavingLgu ? 'Saving...' : 'Save LGU Details'}
                    </PrimaryButton>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* REVIEW & FINALIZE MODAL (CERTIFIED SHA-256 PDF ARCHIVING) */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {isRecordPreviewModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                className="w-full sm:max-w-4xl bg-white rounded-t-[1.75rem] sm:rounded-[1.75rem] border border-[#E2E8F0] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]"
              >
                {/* Header */}
                <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-xl font-bold text-[#1E293B]">
                        Review & Finalize Operational Roll Call
                      </h2>
                      <p className="text-[11px] sm:text-xs text-[#757680]">
                        Review station telemetry records and attendance before finalizing to secure archives
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRecordPreviewModalOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Session Overview Strip */}
                <div className="px-5 sm:px-8 py-3 bg-slate-50 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                    <div>
                      <span className="text-[#757680]">Session Date:</span>{' '}
                      <strong className="text-[#1E293B]">{activeSession?.session_date || new Date().toISOString().split('T')[0]}</strong>
                    </div>
                    <div>
                      <span className="text-[#757680]">Conducted By:</span>{' '}
                      <strong className="text-[#1E293B]">{activeSession?.conducted_by_name || profile?.full_name || 'Monitoring Officer'}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {presentCount} Present
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      {absentCount} Absent
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-[#505F76] border border-slate-200">
                      {exemptedCount} Exempt
                    </span>
                  </div>
                </div>

                {/* Filter Tabs & Search Bar */}
                <div className="px-4 sm:px-8 py-3.5 border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                    {(['all', 'Present', 'Absent', 'Exempted', 'incomplete'] as const).map((filterVal) => (
                      <button
                        key={filterVal}
                        type="button"
                        onClick={() => setPreviewFilter(filterVal)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer capitalize ${
                          previewFilter === filterVal
                            ? 'bg-[#004AC6] text-white shadow-sm'
                            : 'bg-slate-100 text-[#505F76] hover:bg-slate-200'
                        }`}
                      >
                        {filterVal === 'incomplete' ? 'Needs Review' : filterVal}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#757680]" />
                    <input
                      type="text"
                      value={previewSearchQuery}
                      onChange={(e) => setPreviewSearchQuery(e.target.value)}
                      placeholder="Search municipality..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full pl-8 pr-3 py-1 text-xs text-[#1E293B] focus:outline-none focus:border-[#004AC6]"
                    />
                  </div>
                </div>

                {/* Table Container */}
                <div className="flex-1 overflow-y-auto max-h-[45vh] p-4 sm:p-8">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider bg-slate-50/50">
                        <th className="py-2.5 px-4">LGU / Municipality</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4">Weather Condition</th>
                        <th className="py-2.5 px-4">Port / Pier Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPreviewItems.map((mun) => (
                        <tr key={mun.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-semibold text-[#1E293B]">
                            <span>{mun.name}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                mun.attendance === 'Present'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : mun.attendance === 'Absent'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : mun.attendance === 'Exempted'
                                  ? 'bg-slate-100 text-[#505F76] border border-slate-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {mun.attendance || 'Pending'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[#1E293B] font-medium">
                              {mun.attendance === 'Absent' || mun.attendance === 'Exempted' ? (
                                <span className="text-slate-400 italic">N/A ({mun.attendance})</span>
                              ) : mun.weatherStatus && mun.weatherStatus !== 'N/A' ? (
                                mun.weatherStatus
                              ) : (
                                <span className="text-amber-600 font-bold">Required</span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[#1E293B] font-medium">
                              {mun.attendance === 'Absent' || mun.attendance === 'Exempted' ? (
                                <span className="text-slate-400 italic">N/A ({mun.attendance})</span>
                              ) : !mun.hasPort ? (
                                'No Port (Inland)'
                              ) : mun.portStatus && mun.portStatus !== 'N/A' && mun.portStatus !== 'None' ? (
                                mun.portStatus
                              ) : (
                                <span className="text-amber-600 font-bold">Required</span>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-4 sm:px-8 py-4 sm:py-4.5 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-col sm:flex-row justify-end items-center gap-3">
                  <SecondaryButton
                    size="md"
                    pill
                    onClick={() => setIsRecordPreviewModalOpen(false)}
                    className="w-full sm:w-auto justify-center"
                  >
                    Continue Editing
                  </SecondaryButton>

                  <PrimaryButton
                    size="md"
                    pill
                    disabled={isSubmitting || recordedCount === 0}
                    onClick={handleFinalizeSaveRecord}
                    leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    className="w-full sm:w-auto justify-center"
                  >
                    {isSubmitting ? 'Archiving...' : 'Confirm & Finalize Record'}
                  </PrimaryButton>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Success Confirmation Toast */}
        <AnimatePresence>
          {showSaveToast && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-50 bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-2xl max-w-sm flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-[#1E293B]">{saveToastMessage.title}</h4>
                <p className="text-xs text-[#505F76] mt-0.5">{saveToastMessage.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveToast(false)}
                className="text-[#757680] hover:text-[#1E293B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayoutShell>
  );
}
