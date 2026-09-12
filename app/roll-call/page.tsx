'use client';

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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { RollCallTableSkeleton, Skeleton } from '@/components/skeleton';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { generateRollCallPDF } from '@/lib/pdf-generator';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface MunicipalityRow {
  id: string; // area id (UUID from public.areas)
  code: string;
  name: string;
  hasPort?: boolean;
  portName?: string;
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
  status: 'in_progress' | 'completed' | 'cancelled';
  total_stations: number;
  present_count: number;
  absent_count: number;
  exempted_count: number;
  weather_summary?: string | null;
  created_at: string;
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

function getMilitaryTime(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}H`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function RollCallPage() {
  const { user, profile, isAdmin, canWrite, isViewOnly } = useAuth();
  const canModifyRollCall = canWrite('Roll Call');

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Municipalities & Session State - dynamically populated from public.areas
  const [areasList, setAreasList] = useState<MunicipalityRow[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityRow[]>([]);
  const [activeSession, setActiveSession] = useState<RollCallSessionRecord | null>(null);

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

  // ===========================================================================
  // 1. DATA FETCHING (AREAS & ACTIVE SESSION DYNAMICALLY FROM SUPABASE)
  // ===========================================================================

  // Fetch Areas dynamically from public.areas table
  const fetchAreas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (!error && data) {
        const activeData = data.filter((a: any) => a.is_active !== false);
        const mapped: MunicipalityRow[] = activeData.map((a: any) => ({
          id: a.id,
          code: a.code || a.name.slice(0, 2).toUpperCase(),
          name: a.name,
          hasPort: a.has_port ?? false,
          portName: a.port_name || 'None',
          attendance: null,
          weatherStatus: null,
          portStatus: null,
        }));

        // Check if area list actually changed before updating state
        const prevList = areasListRef.current;
        let changed = prevList.length !== mapped.length;
        if (!changed) {
          for (let i = 0; i < mapped.length; i++) {
            if (
              mapped[i].id !== prevList[i]?.id ||
              mapped[i].name !== prevList[i]?.name ||
              mapped[i].code !== prevList[i]?.code ||
              mapped[i].hasPort !== prevList[i]?.hasPort
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
        // Resolve operator name
        let conductedByName = 'Monitoring Officer';
        if (sessionData.conducted_by) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', sessionData.conducted_by)
            .maybeSingle();
          if (prof?.full_name) {
            conductedByName = prof.full_name;
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
          return { ...area, attendance: null, weatherStatus: null, portStatus: null };
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
        const resetMuns = targetAreas.map((a) => ({ ...a, attendance: null, weatherStatus: null, portStatus: null }));
        
        let munsChanged = prevMuns.length !== resetMuns.length;
        if (!munsChanged) {
          for (let i = 0; i < resetMuns.length; i++) {
            if (resetMuns[i].id !== prevMuns[i]?.id || prevMuns[i]?.attendance !== null) {
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

  // Initialize Page & Area Data Once on Mount
  useEffect(() => {
    let mounted = true;
    const initializeData = async () => {
      setIsLoading(true);
      const loadedAreas = await fetchAreas();
      if (mounted) {
        await fetchActiveRollCallSession(loadedAreas, false);
      }
      if (mounted) {
        setIsLoading(false);
      }
    };
    initializeData();
    return () => {
      mounted = false;
    };
  }, [fetchAreas, fetchActiveRollCallSession]);

  // ===========================================================================
  // 2. REAL-TIME SUBSCRIPTIONS & MULTI-USER BROADCASTING
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
      })
      .on('broadcast', { event: 'roll_call_reset' }, async () => {
        const freshAreas = await fetchAreas();
        fetchActiveRollCallSession(freshAreas, true);
      })
      .subscribe();

    // 2. PostgreSQL CDC Channel for table-level changes (including areas table!)
    const cdcChannel = supabase
      .channel('realtime_roll_call_cdc')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roll_call_sessions' },
        () => {
          fetchActiveRollCallSession(undefined, true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roll_call_entries' },
        () => {
          fetchActiveRollCallSession(undefined, true);
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

    // 3. Fallback Heartbeat Pulse every 5 seconds (fetches latest areas & active session)
    const interval = setInterval(async () => {
      const freshAreas = await fetchAreas();
      fetchActiveRollCallSession(freshAreas, true);
    }, 5000);

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(cdcChannel);
      clearInterval(interval);
    };
  }, [fetchAreas, fetchActiveRollCallSession]);

  // Clean up auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  // ===========================================================================
  // 3. COMPUTED METRICS
  // ===========================================================================

  const totalCount = municipalities.length > 0 ? municipalities.length : areasList.length;
  const presentCount = municipalities.filter((m) => m.attendance === 'Present').length;
  const absentCount = municipalities.filter((m) => m.attendance === 'Absent').length;
  const exemptedCount = municipalities.filter((m) => m.attendance === 'Exempted').length;
  const recordedCount = presentCount + absentCount + exemptedCount;

  // Helper: check if a specific row is completely filled (all fields required)
  const isRowComplete = (mun: MunicipalityRow) => {
    if (!mun.attendance) return false;
    if (mun.attendance === 'Absent' || mun.attendance === 'Exempted') return true;
    if (mun.attendance === 'Present') {
      if (!mun.weatherStatus || mun.weatherStatus === 'N/A') return false;
      if (mun.hasPort) {
        return Boolean(mun.portStatus && mun.portStatus !== 'N/A' && mun.portStatus !== 'None');
      }
      return true; // inland station requires weather status
    }
    return false;
  };

  // ===========================================================================
  // 4. AUTO-ADVANCE ENGINE & INTERACTIVE SELECTIONS
  // ===========================================================================

  const triggerAutoAdvance = (currentMunId: string, updatedRow: MunicipalityRow) => {
    if (!isRowComplete(updatedRow)) return;

    const currentIndex = municipalities.findIndex((m) => m.id === currentMunId);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex < municipalities.length) {
      const nextMun = municipalities[nextIndex];

      setAutoAdvancingNotice(`Recorded for ${updatedRow.name}. Next: ${nextMun.name}...`);

      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }

      autoAdvanceTimerRef.current = setTimeout(() => {
        setAutoAdvancingNotice(null);
      }, 900);
    } else {
      setAutoAdvancingNotice(`All stations recorded! Ready to save record.`);
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      autoAdvanceTimerRef.current = setTimeout(() => {
        setAutoAdvancingNotice(null);
      }, 1500);
    }
  };

  // 4a. Update Attendance (Optimistic + Supabase Upsert with full row data)
  const handleAttendanceChange = async (id: string, status: 'Present' | 'Absent' | 'Exempted') => {
    if (!canModerateRollCall) return;

    const targetMun = municipalitiesRef.current.find((m) => m.id === id);
    if (!targetMun) return;

    const nowMilitary = getMilitaryTime();
    const isInactive = status === 'Absent' || status === 'Exempted';
    const updatedRow: MunicipalityRow = {
      ...targetMun,
      attendance: status,
      timeResponded: status === 'Present' ? nowMilitary : null,
      weatherStatus: isInactive
        ? 'N/A'
        : (targetMun.weatherStatus === 'N/A' ? null : targetMun.weatherStatus),
      portStatus: isInactive
        ? 'N/A'
        : (!targetMun.hasPort ? 'None' : (targetMun.portStatus === 'N/A' ? null : targetMun.portStatus)),
    };

    setMunicipalities((prev) => {
      const next = prev.map((mun) => (mun.id === id ? updatedRow : mun));
      municipalitiesRef.current = next;
      return next;
    });

    // Persist to Supabase if session active
    if (activeSession) {
      try {
        const { error } = await supabase.from('roll_call_entries').upsert(
          {
            session_id: activeSession.id,
            area_id: id,
            area_code: updatedRow.code || '',
            area_name: updatedRow.name || '',
            attendance: status,
            weather_status: updatedRow.weatherStatus || null,
            port_status: updatedRow.portStatus || (!updatedRow.hasPort ? 'None' : null),
            time_responded: status === 'Present' ? nowMilitary : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,area_id' }
        );
        if (error) {
          console.error('Error persisting attendance status:', error);
        } else {
          broadcastSync('roll_call_updated');
        }
      } catch (err) {
        console.warn('Could not persist attendance update:', err);
      }
    }

    triggerAutoAdvance(id, updatedRow);
  };

  // 4b. Update Weather Condition (Preserves all columns in Supabase Upsert)
  const handleWeatherChange = async (id: string, weather: string) => {
    if (!canModerateRollCall) return;

    const targetMun = municipalitiesRef.current.find((m) => m.id === id);
    if (!targetMun) return;

    const updatedRow: MunicipalityRow = { ...targetMun, weatherStatus: weather };

    setMunicipalities((prev) => {
      const next = prev.map((mun) => (mun.id === id ? updatedRow : mun));
      municipalitiesRef.current = next;
      return next;
    });

    if (activeSession) {
      try {
        const { error } = await supabase.from('roll_call_entries').upsert(
          {
            session_id: activeSession.id,
            area_id: id,
            area_code: updatedRow.code || '',
            area_name: updatedRow.name || '',
            attendance: updatedRow.attendance || null,
            weather_status: weather,
            port_status: !updatedRow.hasPort ? 'None' : (updatedRow.portStatus || null),
            time_responded: updatedRow.timeResponded || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,area_id' }
        );
        if (error) {
          console.error('Error persisting weather status:', error);
        } else {
          broadcastSync('roll_call_updated');
        }
      } catch (err) {
        console.warn('Could not persist weather update:', err);
      }
    }

    triggerAutoAdvance(id, updatedRow);
  };

  // 4c. Update Port Status (Preserves all columns in Supabase Upsert)
  const handlePortChange = async (id: string, portStatus: string) => {
    if (!canModerateRollCall) return;

    const targetMun = municipalitiesRef.current.find((m) => m.id === id);
    if (!targetMun) return;

    const updatedRow: MunicipalityRow = { ...targetMun, portStatus };

    setMunicipalities((prev) => {
      const next = prev.map((mun) => (mun.id === id ? updatedRow : mun));
      municipalitiesRef.current = next;
      return next;
    });

    if (activeSession) {
      try {
        const { error } = await supabase.from('roll_call_entries').upsert(
          {
            session_id: activeSession.id,
            area_id: id,
            area_code: updatedRow.code || '',
            area_name: updatedRow.name || '',
            attendance: updatedRow.attendance || null,
            weather_status: updatedRow.weatherStatus || null,
            port_status: !updatedRow.hasPort ? 'None' : portStatus,
            time_responded: updatedRow.timeResponded || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,area_id' }
        );
        if (error) {
          console.error('Error persisting port status:', error);
        } else {
          broadcastSync('roll_call_updated');
        }
      } catch (err) {
        console.warn('Could not persist port update:', err);
      }
    }

    triggerAutoAdvance(id, updatedRow);
  };

  // ===========================================================================
  // 5. SESSION LIFECYCLE: START, FINALIZE & ARCHIVE
  // ===========================================================================

  // Start Roll Call (Inserts public.roll_call_sessions & initial entries)
  const handleStartRollCall = async () => {
    if (!canModerateRollCall || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const now = new Date();
      const dateFormatted = now.toISOString().split('T')[0];
      const timeFormatted = getMilitaryTime(now);
      const conductorId = profile?.id || user?.id || null;

      // 1. Insert session record into public.roll_call_sessions
      const { data: newSession, error: sessionError } = await supabase
        .from('roll_call_sessions')
        .insert({
          session_date: dateFormatted,
          session_time: timeFormatted,
          frequency: '142.500 MHz',
          radio_script: radioScript,
          conducted_by: conductorId,
          status: 'in_progress',
          total_stations: areasList.length,
          present_count: 0,
          absent_count: 0,
          exempted_count: 0,
        })
        .select()
        .single();

      if (sessionError || !newSession) {
        throw new Error(sessionError?.message || 'Failed to start roll call session');
      }

      // 2. Insert initial entry placeholders for each area
      if (areasList.length > 0) {
        const entryRows = areasList.map((area) => ({
          session_id: newSession.id,
          area_id: area.id,
          area_code: area.code,
          area_name: area.name,
          attendance: null,
          weather_status: null,
          port_status: null,
        }));

        await supabase.from('roll_call_entries').insert(entryRows);
      }

      const sessionRec: RollCallSessionRecord = {
        id: newSession.id,
        session_date: dateFormatted,
        session_time: timeFormatted,
        frequency: '142.500 MHz',
        radio_script: radioScript,
        conducted_by: conductorId,
        conducted_by_name: profile?.full_name || 'Monitoring Officer',
        status: 'in_progress',
        total_stations: areasList.length,
        present_count: 0,
        absent_count: 0,
        exempted_count: 0,
        created_at: now.toISOString(),
      };

      setActiveSession(sessionRec);
      setMunicipalities(areasList.map((a) => ({ ...a, attendance: null, weatherStatus: null, portStatus: null })));

      broadcastSync('roll_call_updated');
    } catch (err: any) {
      console.error('Error starting roll call:', err);
      setAlertBanner({
        type: 'error',
        title: 'Could Not Start Roll Call Session',
        message: err.message || 'An unexpected error occurred while initiating the roll call session. Please verify database connectivity and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Click Save Record -> Opens Editable Preview Modal (Validates that every field is required and complete)
  const handleOpenSavePreview = () => {
    if (!canModerateRollCall) return;
    const incomplete = municipalities.filter((m) => !isRowComplete(m));
    if (incomplete.length > 0) {
      setAlertBanner({
        type: 'warning',
        title: 'Required Fields Incomplete',
        message: 'All fields are required. Please record attendance and weather/port status for all stations before saving.',
        incompleteStations: incomplete.map((s) => s.name),
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setAlertBanner(null);
    setIsRecordPreviewModalOpen(true);
  };

  // Finalize & Confirm Save in Preview Modal -> Updates session, archives document, and returns to standby
  const handleFinalizeSaveRecord = async () => {
    if (!canModerateRollCall || !activeSession || isSubmitting) return;

    const incomplete = municipalities.filter((m) => !isRowComplete(m));
    if (incomplete.length > 0) {
      setAlertBanner({
        type: 'warning',
        title: 'Required Fields Incomplete',
        message: 'All fields are required. Please complete all stations before finalizing the session record.',
        incompleteStations: incomplete.map((s) => s.name),
      });
      setIsRecordPreviewModalOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date();
      const dateFormatted = now.toISOString().split('T')[0];
      const timeFormatted = getMilitaryTime(now);
      const officerId = profile?.id || user?.id;
      const officerName = profile?.full_name || 'Alex Thompson';
      const officerRole = profile?.position_title || (isAdmin ? 'System Administrator' : 'Opcen Dispatcher');

      // Weather Summary calculation (excluding Absent / Exempted / N/A stations)
      const weatherCounts: Record<string, number> = {};
      municipalities.forEach((m) => {
        if (m.weatherStatus && m.weatherStatus !== 'N/A' && m.attendance !== 'Absent' && m.attendance !== 'Exempted') {
          weatherCounts[m.weatherStatus] = (weatherCounts[m.weatherStatus] || 0) + 1;
        }
      });
      const weatherSummaryText = Object.entries(weatherCounts)
        .map(([w, cnt]) => `${w}: ${cnt}`)
        .join(', ') || 'All active reporting stations normal';

      // 1. Update public.roll_call_sessions to completed
      const { error: sessionError } = await supabase
        .from('roll_call_sessions')
        .update({
          status: 'completed',
          total_stations: totalCount,
          present_count: presentCount,
          absent_count: absentCount,
          exempted_count: exemptedCount,
          weather_summary: weatherSummaryText,
          completed_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', activeSession.id);

      if (sessionError) {
        console.warn('Could not finalize session record:', sessionError.message);
      }

      // 2. Generate SHA-256 Hash and save certified record to public.archives
      const snapshotPayload = {
        sessionId: activeSession.id,
        sessionDate: dateFormatted,
        sessionTime: timeFormatted,
        frequency: activeSession.frequency,
        radioScript: activeSession.radio_script,
        conductedBy: officerName,
        totalStations: totalCount,
        present: presentCount,
        absent: absentCount,
        exempted: exemptedCount,
        entries: municipalities,
        completedAt: now.toISOString(),
      };

      const payloadString = JSON.stringify(snapshotPayload);
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

      const archiveFilename = `ROLLCALL-REPORT-${dateFormatted.replace(/-/g, '')}-${timeFormatted}.pdf`;

      // 1. Generate compressed official PDF document with attached profile signature
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

      console.log(`[Roll Call] Official PDF generated: ${archiveFilename} (${pdfSize} bytes)`);

      // 2. Upload official PDF to Supabase storage bucket 'archive-documents' under RC/ folder
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
          console.log(`[Roll Call] Uploaded to storage bucket: ${storagePath}`);
        } else if (uploadErr) {
          console.warn('Storage upload notice:', uploadErr.message);
        }
      } catch (sErr) {
        console.warn('Could not upload roll call PDF to storage bucket:', sErr);
      }

      // 3. Check for valid UUIDs before inserting into database
      const isUuid = (str: string | undefined | null) =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

      const validSessionId = isUuid(activeSession.id) ? activeSession.id : null;
      const validOfficerId = isUuid(officerId) ? officerId : null;

      try {
        const { error: archiveErr } = await supabase.from('archives').insert({
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
        if (archiveErr) {
          console.warn('Archives table insert notice:', archiveErr.message);
        }
      } catch (aErr) {
        console.warn('Archives insert error:', aErr);
      }

      broadcastSync('archives_updated');

      // 3. Reset local session state & close preview modal
      setSavedSummary({
        present: presentCount,
        absent: absentCount,
        exempted: exemptedCount,
        total: totalCount,
      });

      setIsRecordPreviewModalOpen(false);
      setShowSaveToast(true);
      setActiveSession(null);
      setMunicipalities(areasList.map((a) => ({ ...a, attendance: null, weatherStatus: null, portStatus: null })));

      broadcastSync('roll_call_completed');
    } catch (err: any) {
      console.error('Error finalizing roll call record:', err);
      alert(`Could not save record: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview Filtered Items
  const filteredPreviewItems = useMemo(() => {
    return municipalities.filter((mun) => {
      // Filter tab
      if (previewFilter === 'Present' && mun.attendance !== 'Present') return false;
      if (previewFilter === 'Absent' && mun.attendance !== 'Absent') return false;
      if (previewFilter === 'Exempted' && mun.attendance !== 'Exempted') return false;
      if (previewFilter === 'incomplete' && isRowComplete(mun)) return false;

      // Search Query
      if (previewSearchQuery.trim()) {
        const q = previewSearchQuery.toLowerCase();
        return (
          mun.name.toLowerCase().includes(q) ||
          mun.code.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [municipalities, previewFilter, previewSearchQuery]);

  // ===========================================================================
  // 6. INITIAL LOADING SKELETON (FULL BENTO SHAPE TO PREVENT LAYOUT SHIFTS)
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

          {/* Bento Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column Skeleton */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton variant="rounded" className="h-5 w-32" />
                  <Skeleton variant="pill" className="h-5 w-20" />
                </div>
                <Skeleton variant="rounded" className="h-28 w-full rounded-2xl" />
                <Skeleton variant="pill" className="h-12 w-full" />
              </div>
              <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] p-6 grid grid-cols-3 gap-3">
                <Skeleton variant="rounded" className="h-14 w-full" />
                <Skeleton variant="rounded" className="h-14 w-full" />
                <Skeleton variant="rounded" className="h-14 w-full" />
              </div>
            </div>

            {/* Right Column Table Skeleton */}
            <div className="lg:col-span-8">
              <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] overflow-hidden min-h-[520px]">
                <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Skeleton variant="circular" className="w-10 h-10" />
                    <div className="space-y-1.5">
                      <Skeleton variant="rounded" className="h-5 w-48" />
                      <Skeleton variant="rounded" className="h-3 w-32" />
                    </div>
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
  // 7. MAIN INTERFACE JSX
  // ===========================================================================

  return (
    <AppLayoutShell
      title="Roll Call Operations"
      subtitle="Live Station Monitoring & Telemetry Recording"
    >
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* VIEW-ONLY ROLE RESTRICTION BANNER */}
        {/* ========================================================================= */}
        <ViewOnlyNotice
          screen="Roll Call"
          message="You are currently viewing live roll call telemetry in read-only audit mode. Station recording and status toggling are disabled."
        />

        {/* Live Concurrency & Moderator Status Banner */}
        {isRollCallActive && (
          <>
            {isCurrentModerator ? (
              <div className="p-3.5 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-950 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 border border-emerald-200/60">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-emerald-900">Session Moderator: </span>
                    <span className="text-emerald-800">
                      You are actively conducting this roll call session. Telemetry inputs are broadcasted live to all stations.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wider shrink-0 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active Moderator</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-blue-50/90 border border-blue-200/90 rounded-2xl flex items-center justify-between gap-3 text-xs text-blue-950 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-[#004AC6] shrink-0 border border-blue-200/60">
                    <RadioIcon className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-blue-900">Live Roll Call in Progress: </span>
                    <span className="text-blue-800">
                      Conducted by <strong>{activeSession?.conducted_by_name || 'Monitoring Officer'}</strong>. Controls are locked to the active moderator to prevent conflicting entries.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-[#004AC6] font-bold text-[10px] uppercase tracking-wider shrink-0 border border-blue-200">
                  <Lock className="w-3 h-3" />
                  <span>Live Read-Only</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* HEADER SECTION & LIVE STATUS INDICATOR */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
                Roll Call Operations
              </h2>
            </div>
            <p className="text-sm sm:text-base text-[#505F76] mt-1 font-medium">
              {isRollCallActive
                ? `Active Session • Started at ${activeSession?.session_time} by ${activeSession?.conducted_by_name || 'Monitoring Officer'}`
                : 'Standby for Operational Roll Call • 142.500 MHz Net Radio'}
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
        {/* IN-APP ALERT BANNER (REPLACES NATIVE WINDOW.ALERT NOTIFICATIONS) */}
        {/* ========================================================================= */}
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
                    <h4
                      className={`font-bold text-sm sm:text-base ${
                        alertBanner.type === 'error'
                          ? 'text-rose-900'
                          : alertBanner.type === 'warning'
                          ? 'text-amber-900'
                          : 'text-blue-900'
                      }`}
                    >
                      {alertBanner.title}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        alertBanner.type === 'error'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : alertBanner.type === 'warning'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {alertBanner.type}
                    </span>
                  </div>

                  <p
                    className={`text-xs sm:text-sm font-medium leading-relaxed ${
                      alertBanner.type === 'error'
                        ? 'text-rose-800'
                        : alertBanner.type === 'warning'
                        ? 'text-amber-800'
                        : 'text-blue-800'
                    }`}
                  >
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
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  alertBanner.type === 'error'
                    ? 'text-rose-600 hover:bg-rose-100'
                    : alertBanner.type === 'warning'
                    ? 'text-amber-700 hover:bg-amber-100'
                    : 'text-blue-600 hover:bg-blue-100'
                }`}
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* MAIN BENTO CONTAINER */}
        {/* ========================================================================= */}
        <div className="relative">
          {/* Subtle auto-advance feedback notice */}
          <AnimatePresence>
            {autoAdvancingNotice && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute -top-12 right-0 z-20 bg-[#004AC6] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{autoAdvancingNotice}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ==================== LEFT COLUMN (4 COLS: SCRIPT & STATS) ==================== */}
            <div className="lg:col-span-4 space-y-6">
              {/* Net Radio Script Card */}
              <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-6 relative overflow-hidden flex flex-col justify-between">
                {/* Decorative background aura */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#004AC6]/5 rounded-bl-[100px] pointer-events-none" />

                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2 text-[#004AC6] font-bold text-sm tracking-wide">
                      <RadioIcon className="w-4 h-4" />
                      <span>Net Radio Script</span>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-blue-50 text-[#004AC6] border-blue-200">
                      Standard Net
                    </span>
                  </div>

                  {/* Script Display Quote Box */}
                  <div className="bg-[#F8FAFC] px-5 py-6 rounded-2xl mb-6 relative z-10 border border-[#E2E8F0] shadow-2xs">
                    <p className="text-sm sm:text-base text-[#1E293B] font-medium leading-relaxed text-center italic">
                      {radioScript}
                    </p>
                  </div>
                </div>

                {/* Start Roll Call Main Action Button */}
                <button
                  type="button"
                  disabled={isRollCallActive || !canModifyRollCall || isSubmitting || totalCount === 0}
                  onClick={handleStartRollCall}
                  className={`w-full py-3.5 px-6 rounded-full font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 relative z-10 ${
                    isRollCallActive
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none select-none'
                      : totalCount === 0
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-[#004AC6] hover:bg-[#003ea8] text-white shadow-md shadow-[#004AC6]/25 hover:shadow-lg cursor-pointer active:scale-[0.99]'
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                  <span>
                    {isRollCallActive
                      ? isCurrentModerator
                        ? 'Roll Call in Progress (You are Moderating)'
                        : `In Progress by ${activeSession?.conducted_by_name || 'Operator'}`
                      : totalCount === 0
                      ? 'No Stations Available'
                      : 'Start Roll Call'}
                  </span>
                </button>
              </div>

              {/* Live Stats Widget Card */}
              <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-6 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#004AC6] mb-0.5">
                    {totalCount}
                  </div>
                  <div className="text-[11px] font-semibold text-[#757680] uppercase tracking-wider">
                    Total LGUs
                  </div>
                </div>

                <div className="border-l border-r border-slate-200">
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-600 mb-0.5">
                    {isRollCallActive ? presentCount : '--'}
                  </div>
                  <div className="text-[11px] font-semibold text-[#757680] uppercase tracking-wider">
                    Present
                  </div>
                </div>

                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-rose-600 mb-0.5">
                    {isRollCallActive ? absentCount : '--'}
                  </div>
                  <div className="text-[11px] font-semibold text-[#757680] uppercase tracking-wider">
                    Absent
                  </div>
                </div>
              </div>
            </div>

            {/* ==================== RIGHT COLUMN (8 COLS: DATA TABLE) ==================== */}
            <div className="lg:col-span-8">
              <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden min-h-[520px]">
                {/* Table Header */}
                <div className="p-5 sm:p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center font-bold text-sm">
                      <RadioIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1E293B] text-base sm:text-lg">
                        {isRollCallActive
                          ? 'Active Station Telemetry Roster'
                          : 'Operational Municipality Roster'}
                      </h3>
                      <p className="text-xs text-[#757680]">
                        {isRollCallActive
                          ? `${recordedCount} of ${totalCount} stations logged • Live sync active`
                          : `${totalCount} active telemetry stations loaded from database`}
                      </p>
                    </div>
                  </div>

                  {totalCount === 0 && (
                    <Link href="/settings/areas">
                      <SecondaryButton size="sm" pill leftIcon={<MapPin className="w-3.5 h-3.5" />}>
                        Configure LGUs
                      </SecondaryButton>
                    </Link>
                  )}
                </div>

                {/* Empty State when no areas exist in database */}
                {totalCount === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center my-auto">
                    <div className="w-16 h-16 rounded-full bg-slate-100 text-[#505F76] flex items-center justify-center mb-4">
                      <MapPin className="w-8 h-8 text-[#004AC6]" />
                    </div>
                    <h3 className="text-lg font-bold text-[#1E293B] mb-1">
                      No LGUs Configured in Database
                    </h3>
                    <p className="text-sm text-[#505F76] max-w-md mx-auto mb-6">
                      Add and configure active regional municipalities in Area Settings to monitor them during roll call sessions.
                    </p>
                    <Link href="/settings/areas">
                      <PrimaryButton size="md" pill rightIcon={<ArrowRight className="w-4 h-4" />}>
                        Go to Area Settings
                      </PrimaryButton>
                    </Link>
                  </div>
                ) : !isRollCallActive ? (
                  /* Standby Banner if Session Not Started */
                  <div className="p-12 text-center flex flex-col items-center justify-center my-auto">
                    <div className="w-16 h-16 rounded-full bg-blue-50 text-[#004AC6] flex items-center justify-center mb-4">
                      <Mic className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-[#1E293B] mb-1">
                      Roll Call Session on Standby
                    </h3>
                    <p className="text-sm text-[#505F76] max-w-md mx-auto mb-6">
                      Click <strong className="text-[#1E293B]">Start Roll Call</strong> on the left console to initiate real-time logging, live telemetry responses, and multi-user synchronization across {totalCount} active stations.
                    </p>
                    <PrimaryButton
                      size="md"
                      pill
                      disabled={!canModerateRollCall || isSubmitting}
                      onClick={handleStartRollCall}
                      leftIcon={<Mic className="w-4 h-4" />}
                    >
                      Start Roll Call Session
                    </PrimaryButton>
                  </div>
                ) : (
                  /* Live Roll Call Active Table */
                  <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-[#E2E8F0] bg-slate-50 text-[11px] font-bold text-[#505F76] uppercase tracking-wider">
                          <th className="py-3.5 px-6">LGU / Municipality</th>
                          <th className="py-3.5 px-4 text-center w-24">Present</th>
                          <th className="py-3.5 px-4 text-center w-24">Absent</th>
                          <th className="py-3.5 px-4 text-center w-24">Exempted</th>
                          <th className="py-3.5 px-6 min-w-[170px]">Weather Status <span className="text-rose-500">*</span></th>
                          <th className="py-3.5 px-6 min-w-[170px]">Port Status</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 text-sm">
                        {municipalities.map((mun) => {
                          const isAbsent = mun.attendance === 'Absent';
                          const isExempted = mun.attendance === 'Exempted';
                          const isInactive = isAbsent || isExempted;
                          const rowDone = isRowComplete(mun);

                          return (
                            <tr
                              key={mun.id}
                              className={`transition-colors duration-150 ${
                                rowDone
                                  ? 'bg-emerald-50/20 hover:bg-emerald-50/30'
                                  : 'hover:bg-[#F8FAFC]'
                              }`}
                            >
                              {/* Municipality Name & Icon */}
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-50 text-[#004AC6] flex items-center justify-center shrink-0 border border-blue-100">
                                    <MapPin className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="font-semibold text-[#1E293B] block">{mun.name}</span>
                                    {rowDone ? (
                                      <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Complete
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-amber-600 font-medium">
                                        Required
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Radio: Present */}
                              <td className="py-4 px-4 text-center">
                                <label className={`inline-flex items-center justify-center p-1 ${!canModerateRollCall ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                  <input
                                    type="radio"
                                    disabled={!canModerateRollCall}
                                    name={`attend_${mun.id}`}
                                    checked={mun.attendance === 'Present'}
                                    onChange={() => handleAttendanceChange(mun.id, 'Present')}
                                    className="w-4 h-4 text-[#004AC6] focus:ring-[#004AC6] accent-[#004AC6] cursor-pointer disabled:cursor-not-allowed"
                                  />
                                </label>
                              </td>

                              {/* Radio: Absent */}
                              <td className="py-4 px-4 text-center">
                                <label className={`inline-flex items-center justify-center p-1 ${!canModerateRollCall ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                  <input
                                    type="radio"
                                    disabled={!canModerateRollCall}
                                    name={`attend_${mun.id}`}
                                    checked={isAbsent}
                                    onChange={() => handleAttendanceChange(mun.id, 'Absent')}
                                    className="w-4 h-4 text-rose-600 focus:ring-rose-600 accent-rose-600 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                </label>
                              </td>

                              {/* Radio: Exempted */}
                              <td className="py-4 px-4 text-center">
                                <label className={`inline-flex items-center justify-center p-1 ${!canModerateRollCall ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                  <input
                                    type="radio"
                                    disabled={!canModerateRollCall}
                                    name={`attend_${mun.id}`}
                                    checked={isExempted}
                                    onChange={() => handleAttendanceChange(mun.id, 'Exempted')}
                                    className="w-4 h-4 text-[#505F76] focus:ring-[#505F76] accent-[#505F76] cursor-pointer disabled:cursor-not-allowed"
                                  />
                                </label>
                              </td>

                              {/* Weather Status Dropdown (Disabled automatically if Absent/Exempted or View-Only) */}
                              <td className="py-4 px-6">
                                <CustomDropdown
                                  options={weatherDropdownOptions}
                                  value={isInactive ? '' : (mun.weatherStatus && mun.weatherStatus !== 'N/A' ? mun.weatherStatus : '')}
                                  onChange={(val) => handleWeatherChange(mun.id, val)}
                                  placeholder={isInactive ? `N/A (${mun.attendance})` : 'Select Weather *'}
                                  disabled={!canModerateRollCall || isInactive}
                                  size="sm"
                                  pill
                                />
                              </td>

                              {/* Port Status Dropdown (Disabled automatically if Absent/Exempted, View-Only, or if LGU has no port) */}
                              <td className="py-4 px-6">
                                <CustomDropdown
                                  options={portDropdownOptions}
                                  value={isInactive ? '' : (!mun.hasPort ? 'None' : (mun.portStatus && mun.portStatus !== 'N/A' ? mun.portStatus : ''))}
                                  onChange={(val) => handlePortChange(mun.id, val)}
                                  placeholder={isInactive ? `N/A (${mun.attendance})` : (!mun.hasPort ? 'No Port (Inland)' : 'Select Port Status')}
                                  disabled={!canModerateRollCall || isInactive || !mun.hasPort}
                                  size="sm"
                                  pill
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Save Footer */}
                {isRollCallActive && (
                  <div className="p-5 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <span className="text-xs text-[#757680] font-medium">
                      {recordedCount} of {totalCount} stations recorded •{' '}
                      {isCurrentModerator
                        ? 'Live session ready for archival'
                        : `Moderated by ${activeSession?.conducted_by_name || 'Monitoring Officer'}`}
                    </span>

                    {/* Save Record Primary Button (Opens Editable Preview for Moderator Only) */}
                    {isCurrentModerator ? (
                      <PrimaryButton
                        size="md"
                        pill
                        onClick={handleOpenSavePreview}
                        leftIcon={<Save className="w-4 h-4" />}
                      >
                        Save Record
                      </PrimaryButton>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#505F76] bg-slate-100 px-4 py-2 rounded-full border border-slate-200 select-none">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Moderated by {activeSession?.conducted_by_name || 'Monitoring Officer'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL: EDITABLE RECORD PREVIEW & FINAL ARCHIVAL CONFIRMATION */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isRecordPreviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRecordPreviewModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden z-10"
            >
              {/* Header */}
              <div className="px-6 sm:px-8 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#1E293B]">
                      Review & Finalize Operational Roll Call
                    </h2>
                    <p className="text-xs text-[#757680]">
                      Review station telemetry records and attendance before finalizing to secure archives
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecordPreviewModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Session Overview Strip */}
              <div className="px-6 sm:px-8 py-3 bg-slate-50 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[#757680]">Session Date:</span>{' '}
                    <strong className="text-[#1E293B]">{activeSession?.session_date || new Date().toISOString().split('T')[0]}</strong>
                  </div>
                  <div>
                    <span className="text-[#757680]">Frequency:</span>{' '}
                    <strong className="text-[#1E293B]">{activeSession?.frequency || '142.500 MHz'}</strong>
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
              <div className="px-6 sm:px-8 py-3.5 border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-center gap-3">
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

              {/* Editable Preview Table Container */}
              <div className="flex-1 overflow-y-auto max-h-[45vh] p-6 sm:p-8">
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
                            ) : (
                              mun.weatherStatus && mun.weatherStatus !== 'N/A' ? mun.weatherStatus : (
                                <span className="text-amber-600 font-bold">Required</span>
                              )
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[#1E293B] font-medium">
                            {mun.attendance === 'Absent' || mun.attendance === 'Exempted' ? (
                              <span className="text-slate-400 italic">N/A ({mun.attendance})</span>
                            ) : !mun.hasPort ? (
                              'No Port (Inland)'
                            ) : (
                              mun.portStatus && mun.portStatus !== 'N/A' && mun.portStatus !== 'None' ? mun.portStatus : (
                                <span className="text-amber-600 font-bold">Required</span>
                              )
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-6 sm:px-8 py-4.5 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-[#757680]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Submitting will generate a certified archive document with SHA-256 integrity hash</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
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
                    leftIcon={
                      isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )
                    }
                    className="w-full sm:w-auto justify-center"
                  >
                    {isSubmitting ? 'Archiving...' : 'Confirm & Finalize Record'}
                  </PrimaryButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. SUCCESS NOTIFICATION TOAST */}
      {/* ========================================================================= */}
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
              <h4 className="text-sm font-bold text-[#1E293B]">Roll Call Session Saved</h4>
              <p className="text-xs text-[#505F76] mt-0.5">
                Session closed with {savedSummary.present} present, {savedSummary.absent} absent. Archived report generated in archives.
              </p>
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
    </AppLayoutShell>
  );
}
