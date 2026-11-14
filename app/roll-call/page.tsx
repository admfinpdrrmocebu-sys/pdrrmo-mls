"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Radio as RadioIcon,
  X,
  CheckCircle2,
  Archive,
  BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { format } from 'date-fns';
import { AppLayoutShell } from '@/components/nav-route';
import { SecondaryButton } from '@/components/button';
import { RollCallTableSkeleton, Skeleton } from '@/components/skeleton';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import {
  generateRollCallPDF,
  PAPER_DIMENSIONS,
  type PaperSize,
  type RollCallTemplateType,
} from '@/lib/pdf-generator';
import {
  getCachedRollCallScreenData,
  setCachedRollCallScreenData,
  patchCachedRollCallScreenData,
} from '@/lib/cache/screen-data-cache';
import { OperationsTab } from './_components/operations-tab';
import { AnalyticsTab } from './_components/analytics-tab';
import {
  getMilitaryTime,
  isRowComplete,
  type MunicipalityRow,
  type RollCallSessionRecord,
  type RollCallHistorySession,
  type LGUAnalyticsSummary,
  type RollCallAlertBanner,
  type RollCallSaveToast,
  type EditLguFormState,
} from './_components/types';
import type { PreviewFilterType } from './_components/record-preview-modal';

export type {
  MunicipalityRow,
  RollCallSessionRecord,
  RollCallHistorySession,
  LGUAnalyticsSummary,
};

const ViewLguDrawer = dynamic(
  () => import('./_components/view-lgu-drawer').then((m) => m.ViewLguDrawer),
  { ssr: false }
);
const EditLguModal = dynamic(
  () => import('./_components/edit-lgu-modal').then((m) => m.EditLguModal),
  { ssr: false }
);
const RecordPreviewModal = dynamic(
  () =>
    import('./_components/record-preview-modal').then(
      (m) => m.RecordPreviewModal
    ),
  { ssr: false }
);

// =============================================================================
// DB ROW TYPES & PURE HELPERS
// =============================================================================

interface AreaDbRow {
  id: string;
  code: string | null;
  name: string;
  has_port: boolean | null;
  port_name: string | null;
  sort_order: number | null;
  is_active: boolean | null;
}

interface ConductorProfileRow {
  id?: string;
  full_name: string | null;
  avatar_url: string | null;
  position_title: string | null;
  role: string | null;
}

interface RollCallEntryDbRow {
  id: string;
  session_id: string;
  area_id: string | null;
  area_code: string | null;
  area_name: string | null;
  attendance: 'Present' | 'Absent' | 'Exempted' | null;
  weather_status: string | null;
  port_status: string | null;
  time_responded: string | null;
  created_at?: string | null;
}

interface RollCallSessionDbRow {
  id: string;
  session_date: string;
  session_time: string;
  frequency: string | null;
  radio_script?: string | null;
  conducted_by: string | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  total_stations: number | null;
  present_count: number | null;
  absent_count: number | null;
  exempted_count: number | null;
  weather_summary: string | null;
  created_at: string;
  conductor?: ConductorProfileRow | ConductorProfileRow[] | null;
  roll_call_entries?: RollCallEntryDbRow[] | null;
}

function unwrapConductor(
  conductor: ConductorProfileRow | ConductorProfileRow[] | null | undefined
): ConductorProfileRow | null {
  if (!conductor) return null;
  return Array.isArray(conductor) ? conductor[0] ?? null : conductor;
}

function resolveRoleTitle(prof: ConductorProfileRow | null): string | null {
  if (!prof) return null;
  if (prof.position_title) return prof.position_title;
  if (prof.role === 'admin') return 'System Administrator';
  return null;
}

function buildAreasSignature(areas: MunicipalityRow[]): string {
  return areas
    .map(
      (a) =>
        `${a.id}|${a.code}|${a.name}|${a.hasPort ? 1 : 0}|${a.portName ?? ''}`
    )
    .join(';');
}

function buildSessionSignature(session: RollCallSessionRecord | null): string {
  if (!session) return 'NONE';
  return [
    session.id,
    session.status,
    session.present_count,
    session.absent_count,
    session.exempted_count,
    session.conducted_by ?? '',
    session.conducted_by_name ?? '',
  ].join('|');
}

function buildMunicipalitiesSignature(muns: MunicipalityRow[]): string {
  return muns
    .map(
      (m) =>
        `${m.id}|${m.name}|${m.attendance ?? ''}|${m.weatherStatus ?? ''}|${m.portStatus ?? ''}|${m.timeResponded ?? ''}`
    )
    .join(';');
}

function buildAnalyticsSignature(sessions: RollCallHistorySession[]): string {
  return sessions
    .map(
      (s) =>
        `${s.id}|${s.status}|${s.present_count}|${s.absent_count}|${s.exempted_count}|${s.entries.length}`
    )
    .join(';');
}

function mergeSessionEntriesWithAreas(
  targetAreas: MunicipalityRow[],
  entriesData: RollCallEntryDbRow[] | null | undefined
): MunicipalityRow[] {
  if (!entriesData || entriesData.length === 0) {
    return targetAreas.map((a) => ({
      ...a,
      attendance: 'Absent' as const,
      weatherStatus: null,
      portStatus: null,
      timeResponded: null,
    }));
  }

  const entryMap = new Map<string, RollCallEntryDbRow>();
  for (const e of entriesData) {
    if (e.area_id) entryMap.set(e.area_id, e);
    if (e.area_code) entryMap.set(e.area_code, e);
  }

  return targetAreas.map((area) => {
    const matched = entryMap.get(area.id) || entryMap.get(area.code);
    if (matched) {
      return {
        ...area,
        attendance: matched.attendance || null,
        weatherStatus: matched.weather_status || null,
        portStatus: matched.port_status || null,
        timeResponded: matched.time_responded || null,
      };
    }
    return {
      ...area,
      attendance: 'Absent' as const,
      weatherStatus: null,
      portStatus: null,
      timeResponded: null,
    };
  });
}

function computeLguAnalyticsList(
  areasList: MunicipalityRow[],
  filteredAnalyticsSessions: RollCallHistorySession[]
): LGUAnalyticsSummary[] {
  return areasList
    .map((area) => {
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

      for (const sess of filteredAnalyticsSessions) {
        const entry = sess.entries.find(
          (e) => e.area_id === area.id || e.area_code === area.code
        );
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

          if (!lastDate) {
            lastDate = sess.session_date;
            lastTime = sess.session_time;
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
      }

      const chronologicTrend = [...trendList].reverse();
      const attendanceRate =
        totalSess > 0 ? Math.round((presCount / totalSess) * 100) : 0;

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
        presentRecords: presentRecs,
        absentRecords: absentRecs,
        trendData: chronologicTrend,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function RollCallPage() {
  const { user, profile, canWrite, isViewOnly } = useAuth();
  const isRollCallViewOnly = isViewOnly('Roll Call') || !canWrite('Roll Call');
  const canModifyRollCall = canWrite('Roll Call') && !isViewOnly('Roll Call');

  const [initialCache] = useState(() => getCachedRollCallScreenData());

  // Active Screen View Switcher: 'operations' | 'analytics'
  const [activeTab, setActiveTab] = useState<'operations' | 'analytics'>(
    initialCache?.activeTab ?? 'operations'
  );

  // Loading States (no blocking skeleton when cache snapshot exists)
  const [isLoading, setIsLoading] = useState(!initialCache);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(
    initialCache?.analyticsLoaded ?? false
  );

  // Municipalities & Session State - dynamically populated from public.areas
  const [areasList, setAreasList] = useState<MunicipalityRow[]>(
    initialCache?.areasList ?? []
  );
  const [municipalities, setMunicipalities] = useState<MunicipalityRow[]>(
    initialCache?.municipalities ?? []
  );
  const [activeSession, setActiveSession] =
    useState<RollCallSessionRecord | null>(initialCache?.activeSession ?? null);
  const [stationsPage, setStationsPage] = useState(
    initialCache?.stationsPage ?? 1
  );
  const stationsPerPage = 10;

  // Analytics History Sessions
  const [analyticsSessions, setAnalyticsSessions] = useState<
    RollCallHistorySession[]
  >(initialCache?.analyticsSessions ?? []);
  const [selectedMonthFilter] = useState<string>(
    initialCache?.selectedMonthFilter ?? 'all'
  );
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState(
    initialCache?.analyticsSearchQuery ?? ''
  );
  const [activeAnalyticsMenuId, setActiveAnalyticsMenuId] = useState<
    string | null
  >(null);

  // Lazy-mounted Side Drawer & Modals
  const [selectedLguForView, setSelectedLguForView] =
    useState<LGUAnalyticsSummary | null>(null);
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [hasOpenedViewDrawer, setHasOpenedViewDrawer] = useState(false);

  const [editingLgu, setEditingLgu] = useState<MunicipalityRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [hasOpenedEditModal, setHasOpenedEditModal] = useState(false);
  const [isSavingLgu, setIsSavingLgu] = useState(false);
  const [editLguForm, setEditLguForm] = useState<EditLguFormState>({
    name: '',
    code: '',
    hasPort: false,
    portName: '',
  });

  // Record Preview Modal State
  const [isRecordPreviewModalOpen, setIsRecordPreviewModalOpen] =
    useState(false);
  const [hasOpenedPreviewModal, setHasOpenedPreviewModal] = useState(false);
  const [previewFilter, setPreviewFilter] =
    useState<PreviewFilterType>('all');
  const [previewSearchQuery, setPreviewSearchQuery] = useState('');
  const [selectedTemplateType, setSelectedTemplateType] =
    useState<RollCallTemplateType>('net_calling');
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>('a4');

  // Auto-advance timer ref (hidden timer for smooth focus progression)
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Success Confirmation Toast & Alert Banner
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [saveToastMessage, setSaveToastMessage] = useState<RollCallSaveToast>({
    title: 'Roll Call Session Saved',
    subtitle: 'Session records successfully archived.',
  });
  const [alertBanner, setAlertBanner] = useState<RollCallAlertBanner | null>(
    null
  );

  // Stable refs for background sync & deduplication
  const areasListRef = useRef<MunicipalityRow[]>(initialCache?.areasList ?? []);
  const municipalitiesRef = useRef<MunicipalityRow[]>(
    initialCache?.municipalities ?? []
  );
  const activeSessionRef = useRef<RollCallSessionRecord | null>(
    initialCache?.activeSession ?? null
  );
  const analyticsSessionsRef = useRef<RollCallHistorySession[]>(
    initialCache?.analyticsSessions ?? []
  );
  const analyticsLoadedRef = useRef<boolean>(
    initialCache?.analyticsLoaded ?? false
  );
  const activeTabRef = useRef<'operations' | 'analytics'>(
    initialCache?.activeTab ?? 'operations'
  );

  // Signatures to avoid useless React re-renders
  const areasSigRef = useRef<string>(
    initialCache ? buildAreasSignature(initialCache.areasList) : ''
  );
  const sessionSigRef = useRef<string>(
    initialCache ? buildSessionSignature(initialCache.activeSession) : ''
  );
  const munsSigRef = useRef<string>(
    initialCache ? buildMunicipalitiesSignature(initialCache.municipalities) : ''
  );
  const analyticsSigRef = useRef<string>(
    initialCache
      ? buildAnalyticsSignature(initialCache.analyticsSessions)
      : ''
  );

  // In-flight & debounce locks
  const opsSyncInFlightRef = useRef(false);
  const analyticsSyncInFlightRef = useRef(false);
  const opsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyticsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null
  );

  // Standard Radio Broadcast Script & extracted auth primitives (React Compiler safe)
  const profileFullName = profile?.full_name || 'Monitoring Officer';
  const profilePositionTitle = profile?.position_title ?? null;
  const profileRole = profile?.role ?? null;
  const profileAvatarUrl = profile?.avatar_url ?? null;
  const radioScript = useMemo(() => {
    return `"Attention all station 3X, Please Standby for the 4PM net roll call, This is ${profileFullName}, Your Opcen Monitoring Personnel on Duty. Let's Start with LGU."`;
  }, [profileFullName]);

  const isRollCallActive = activeSession !== null;

  const currentUserId = user?.id ?? null;
  const currentProfileId = profile?.id ?? null;
  const conductedById = activeSession?.conducted_by ?? null;

  const isCurrentModerator = useMemo(() => {
    if (!isRollCallActive || !conductedById) return false;
    return Boolean(
      (currentUserId && conductedById === currentUserId) ||
        (currentProfileId && conductedById === currentProfileId)
    );
  }, [isRollCallActive, conductedById, currentUserId, currentProfileId]);

  const canModerateRollCall = useMemo(() => {
    if (!canModifyRollCall || isRollCallViewOnly) return false;
    if (!isRollCallActive) return true;
    return isCurrentModerator;
  }, [canModifyRollCall, isRollCallViewOnly, isRollCallActive, isCurrentModerator]);

  // Keep refs synchronized
  useEffect(() => {
    areasListRef.current = areasList;
  }, [areasList]);

  useEffect(() => {
    municipalitiesRef.current = municipalities;
  }, [municipalities]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    analyticsSessionsRef.current = analyticsSessions;
  }, [analyticsSessions]);

  useEffect(() => {
    analyticsLoadedRef.current = analyticsLoaded;
  }, [analyticsLoaded]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Helper to persist full cache snapshot cleanly
  const writeCacheSnapshot = useCallback(
    (overrides?: {
      areasList?: MunicipalityRow[];
      municipalities?: MunicipalityRow[];
      activeSession?: RollCallSessionRecord | null;
      analyticsSessions?: RollCallHistorySession[];
      analyticsLoaded?: boolean;
      activeTab?: 'operations' | 'analytics';
      stationsPage?: number;
      analyticsSearchQuery?: string;
    }) => {
      setCachedRollCallScreenData({
        activeTab: overrides?.activeTab ?? activeTabRef.current,
        areasList: overrides?.areasList ?? areasListRef.current,
        municipalities: overrides?.municipalities ?? municipalitiesRef.current,
        activeSession:
          overrides && 'activeSession' in overrides
            ? overrides.activeSession ?? null
            : activeSessionRef.current,
        analyticsSessions:
          overrides?.analyticsSessions ?? analyticsSessionsRef.current,
        analyticsLoaded:
          overrides?.analyticsLoaded ?? analyticsLoadedRef.current,
        stationsPage: overrides?.stationsPage ?? stationsPage,
        selectedMonthFilter,
        analyticsSearchQuery:
          overrides?.analyticsSearchQuery ?? analyticsSearchQuery,
        cachedAt: Date.now(),
      });
    },
    [stationsPage, selectedMonthFilter, analyticsSearchQuery]
  );

  // Patch lightweight UI state changes into cache
  useEffect(() => {
    patchCachedRollCallScreenData({
      activeTab,
      stationsPage,
      selectedMonthFilter,
      analyticsSearchQuery,
    });
  }, [activeTab, stationsPage, selectedMonthFilter, analyticsSearchQuery]);

  // Close 3-dot dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveAnalyticsMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // ===========================================================================
  // 1. PARALLEL & JOINED DATA FETCHING
  // ===========================================================================

  const fetchAreas = useCallback(async (): Promise<MunicipalityRow[]> => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('id, code, name, has_port, port_name, sort_order, is_active')
        .order('name', { ascending: true });

      if (!error && data) {
        const activeData = (data as AreaDbRow[]).filter(
          (a) => a.is_active !== false
        );
        const mapped: MunicipalityRow[] = activeData
          .map((a) => ({
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
            timeResponded: null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const nextSig = buildAreasSignature(mapped);
        if (nextSig !== areasSigRef.current) {
          areasSigRef.current = nextSig;
          areasListRef.current = mapped;
          setAreasList(mapped);
        }

        return mapped;
      }
      return areasListRef.current;
    } catch (err) {
      console.warn('Could not load areas from database:', err);
      return areasListRef.current;
    }
  }, []);

  const fetchRawActiveSession = useCallback(async (): Promise<{
    sessionRecord: RollCallSessionRecord | null;
    entriesData: RollCallEntryDbRow[];
    errored: boolean;
  }> => {
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('roll_call_sessions')
        .select(
          `
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
          created_at,
          conductor:profiles!roll_call_sessions_conducted_by_fkey (
            full_name,
            avatar_url,
            position_title,
            role
          ),
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
        `
        )
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) {
        console.warn(
          'Error querying active roll call session:',
          sessionError.message
        );
        return { sessionRecord: null, entriesData: [], errored: true };
      }

      if (!sessionData) {
        return { sessionRecord: null, entriesData: [], errored: false };
      }

      const raw = sessionData as RollCallSessionDbRow;
      let conductorProf = unwrapConductor(raw.conductor);

      if (!conductorProf && raw.conducted_by) {
        const { data: fallbackProf } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, position_title, role')
          .eq('id', raw.conducted_by)
          .maybeSingle();
        if (fallbackProf) {
          conductorProf = fallbackProf as ConductorProfileRow;
        }
      }

      let entriesData = Array.isArray(raw.roll_call_entries)
        ? raw.roll_call_entries
        : null;
      if (!entriesData) {
        const { data: fallbackEntries } = await supabase
          .from('roll_call_entries')
          .select('*')
          .eq('session_id', raw.id);
        entriesData = (fallbackEntries as RollCallEntryDbRow[]) ?? [];
      }

      const sessionRecord: RollCallSessionRecord = {
        id: raw.id,
        session_date: raw.session_date,
        session_time: raw.session_time,
        frequency: raw.frequency || '142.500 MHz',
        radio_script: raw.radio_script || 'Standby for Net Roll Call',
        conducted_by: raw.conducted_by || null,
        conducted_by_name: conductorProf?.full_name || 'Monitoring Officer',
        conducted_by_avatar: conductorProf?.avatar_url || null,
        conducted_by_role: resolveRoleTitle(conductorProf),
        status: raw.status,
        total_stations: raw.total_stations ?? 0,
        present_count: raw.present_count ?? 0,
        absent_count: raw.absent_count ?? 0,
        exempted_count: raw.exempted_count ?? 0,
        weather_summary: raw.weather_summary,
        created_at: raw.created_at,
      };

      return { sessionRecord, entriesData, errored: false };
    } catch (err) {
      console.error('Error fetching active roll call session:', err);
      return { sessionRecord: null, entriesData: [], errored: true };
    }
  }, []);

  const syncOperationsData = useCallback(
    async ({ refreshAreas = true }: { refreshAreas?: boolean } = {}) => {
      if (opsSyncInFlightRef.current) return;
      opsSyncInFlightRef.current = true;
      try {
        const [targetAreas, sessionResult] = await Promise.all([
          refreshAreas ? fetchAreas() : Promise.resolve(areasListRef.current),
          fetchRawActiveSession(),
        ]);

        if (sessionResult.errored) {
          return;
        }

        const nextSession = sessionResult.sessionRecord;
        const nextSessionSig = buildSessionSignature(nextSession);
        if (nextSessionSig !== sessionSigRef.current) {
          sessionSigRef.current = nextSessionSig;
          activeSessionRef.current = nextSession;
          setActiveSession(nextSession);
        }

        const mergedMuns = nextSession
          ? mergeSessionEntriesWithAreas(targetAreas, sessionResult.entriesData)
          : targetAreas.map((a) => ({
              ...a,
              attendance: 'Absent' as const,
              weatherStatus: null,
              portStatus: null,
              timeResponded: null,
            }));

        const nextMunsSig = buildMunicipalitiesSignature(mergedMuns);
        if (nextMunsSig !== munsSigRef.current) {
          munsSigRef.current = nextMunsSig;
          municipalitiesRef.current = mergedMuns;
          setMunicipalities(mergedMuns);
        }

        setCachedRollCallScreenData({
          activeTab: activeTabRef.current,
          areasList: targetAreas,
          municipalities: mergedMuns,
          activeSession: nextSession,
          analyticsSessions: analyticsSessionsRef.current,
          analyticsLoaded: analyticsLoadedRef.current,
          stationsPage,
          selectedMonthFilter,
          analyticsSearchQuery,
          cachedAt: Date.now(),
        });
      } finally {
        opsSyncInFlightRef.current = false;
      }
    },
    [
      fetchAreas,
      fetchRawActiveSession,
      stationsPage,
      selectedMonthFilter,
      analyticsSearchQuery,
    ]
  );

  // ===========================================================================
  // 2. JOINED & ON-DEMAND ANALYTICS DATA FETCHING
  // ===========================================================================

  const fetchAnalyticsData = useCallback(
    async ({ silentIfLoaded = true }: { silentIfLoaded?: boolean } = {}) => {
      if (analyticsSyncInFlightRef.current) return;
      analyticsSyncInFlightRef.current = true;
      if (!analyticsLoadedRef.current || !silentIfLoaded) {
        setIsLoadingAnalytics(true);
      }
      try {
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('roll_call_sessions')
          .select(
            `
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
            conductor:profiles!roll_call_sessions_conducted_by_fkey (
              full_name,
              avatar_url,
              position_title,
              role
            ),
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
          `
          )
          .order('session_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (sessionsError) {
          console.warn(
            'Error querying analytics sessions:',
            sessionsError.message
          );
          return;
        }

        if (sessionsData) {
          const rows = sessionsData as RollCallSessionDbRow[];
          const missingConductorIds = Array.from(
            new Set(
              rows
                .filter((s) => s.conducted_by && !unwrapConductor(s.conductor))
                .map((s) => s.conducted_by as string)
            )
          );

          const fallbackProfileMap = new Map<string, ConductorProfileRow>();
          if (missingConductorIds.length > 0) {
            const { data: profs } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, position_title, role')
              .in('id', missingConductorIds);
            if (profs) {
              for (const p of profs as ConductorProfileRow[]) {
                if (p.id) fallbackProfileMap.set(p.id, p);
              }
            }
          }

          const formattedSessions: RollCallHistorySession[] = rows.map((s) => {
            const prof =
              unwrapConductor(s.conductor) ||
              (s.conducted_by
                ? fallbackProfileMap.get(s.conducted_by) ?? null
                : null);

            let roleTitle = prof?.position_title || null;
            if (!roleTitle && prof?.role === 'admin') {
              roleTitle = 'System Administrator';
            }
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
              entries: (s.roll_call_entries || []).map((e) => ({
                id: e.id,
                session_id: e.session_id,
                area_id: e.area_id || '',
                area_code: e.area_code || '',
                area_name: e.area_name || '',
                attendance: e.attendance,
                weather_status: e.weather_status,
                port_status: e.port_status,
                time_responded: e.time_responded,
                created_at: e.created_at || undefined,
              })),
            };
          });

          const nextSig = buildAnalyticsSignature(formattedSessions);
          if (
            nextSig !== analyticsSigRef.current ||
            !analyticsLoadedRef.current
          ) {
            analyticsSigRef.current = nextSig;
            analyticsSessionsRef.current = formattedSessions;
            setAnalyticsSessions(formattedSessions);
          }

          analyticsLoadedRef.current = true;
          setAnalyticsLoaded(true);
          patchCachedRollCallScreenData({
            analyticsSessions: formattedSessions,
            analyticsLoaded: true,
            cachedAt: Date.now(),
          });
        }
      } catch (err) {
        console.error('Failed to load roll call analytics:', err);
      } finally {
        analyticsSyncInFlightRef.current = false;
        setIsLoadingAnalytics(false);
      }
    },
    []
  );

  // Initial mount: synchronous cache display + background parallel refresh
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await syncOperationsData({ refreshAreas: true });
      if (!mounted) return;
      setIsLoading(false);

      // Only load analytics immediately if the user returned directly to Analytics tab
      if (activeTabRef.current === 'analytics') {
        await fetchAnalyticsData({ silentIfLoaded: true });
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [syncOperationsData, fetchAnalyticsData]);

  // ===========================================================================
  // 3. DEBOUNCED REALTIME, VISIBILITY RESYNC & 30S POLLING
  // ===========================================================================

  const broadcastSync = useCallback(
    (
      event:
        | 'roll_call_updated'
        | 'roll_call_completed'
        | 'roll_call_reset'
        | 'archives_updated'
    ) => {
      try {
        const ch =
          broadcastChannelRef.current ||
          supabase.channel('realtime_roll_call_broadcast');
        ch.send({
          type: 'broadcast',
          event,
          payload: { timestamp: Date.now() },
        });
      } catch (e) {
        console.warn('Could not broadcast roll call sync:', e);
      }
    },
    []
  );

  useEffect(() => {
    const scheduleOpsSync = (refreshAreas = false, delayMs = 400) => {
      if (opsDebounceRef.current) clearTimeout(opsDebounceRef.current);
      opsDebounceRef.current = setTimeout(() => {
        opsDebounceRef.current = null;
        void syncOperationsData({ refreshAreas });
      }, delayMs);
    };

    const scheduleAnalyticsSync = (force = false, delayMs = 450) => {
      if (!force && activeTabRef.current !== 'analytics') return;
      if (analyticsDebounceRef.current) {
        clearTimeout(analyticsDebounceRef.current);
      }
      analyticsDebounceRef.current = setTimeout(() => {
        analyticsDebounceRef.current = null;
        void fetchAnalyticsData({ silentIfLoaded: true });
      }, delayMs);
    };

    const broadcastChannel = supabase
      .channel('realtime_roll_call_broadcast', {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'roll_call_updated' }, () => {
        scheduleOpsSync(true, 300);
      })
      .on('broadcast', { event: 'roll_call_completed' }, () => {
        scheduleOpsSync(false, 300);
        if (analyticsLoadedRef.current || activeTabRef.current === 'analytics') {
          scheduleAnalyticsSync(true, 400);
        }
      })
      .on('broadcast', { event: 'roll_call_reset' }, () => {
        scheduleOpsSync(false, 300);
        if (analyticsLoadedRef.current || activeTabRef.current === 'analytics') {
          scheduleAnalyticsSync(true, 400);
        }
      })
      .subscribe();

    broadcastChannelRef.current = broadcastChannel;

    const cdcChannel = supabase
      .channel('realtime_roll_call_cdc')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roll_call_sessions' },
        () => {
          scheduleOpsSync(false, 400);
          scheduleAnalyticsSync(false, 500);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roll_call_entries' },
        () => {
          scheduleOpsSync(false, 400);
          scheduleAnalyticsSync(false, 500);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'areas' },
        () => {
          scheduleOpsSync(true, 400);
        }
      )
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncOperationsData({ refreshAreas: true });
        if (activeTabRef.current === 'analytics') {
          void fetchAnalyticsData({ silentIfLoaded: true });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Low-overhead 30s visibility-gated fallback polling
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncOperationsData({ refreshAreas: false });
      }
    }, 30_000);

    return () => {
      if (opsDebounceRef.current) clearTimeout(opsDebounceRef.current);
      if (analyticsDebounceRef.current) {
        clearTimeout(analyticsDebounceRef.current);
      }
      broadcastChannelRef.current = null;
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(cdcChannel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [syncOperationsData, fetchAnalyticsData]);

  // ===========================================================================
  // 4. COMPUTED TELEMETRY & ANALYTICS DERIVATIONS
  // ===========================================================================

  const totalCount = municipalities.length;
  const { presentCount, absentCount, exemptedCount } = useMemo(() => {
    let p = 0;
    let a = 0;
    let e = 0;
    for (const m of municipalities) {
      if (m.attendance === 'Present') p++;
      else if (m.attendance === 'Absent') a++;
      else if (m.attendance === 'Exempted') e++;
    }
    return { presentCount: p, absentCount: a, exemptedCount: e };
  }, [municipalities]);
  const recordedCount = presentCount + absentCount + exemptedCount;

  const totalStationPages = Math.max(
    1,
    Math.ceil(totalCount / stationsPerPage)
  );
  const effectiveStationsPage = Math.min(stationsPage, totalStationPages);
  const paginatedMunicipalities = useMemo(() => {
    const start = (effectiveStationsPage - 1) * stationsPerPage;
    return municipalities.slice(start, start + stationsPerPage);
  }, [municipalities, effectiveStationsPage, stationsPerPage]);

  const currentMonthKey = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const currentMonthName = useMemo(() => format(new Date(), 'MMMM yyyy'), []);

  const filteredAnalyticsSessions = useMemo(() => {
    if (selectedMonthFilter === 'all') return analyticsSessions;
    return analyticsSessions.filter(
      (s) => s.session_date && s.session_date.startsWith(selectedMonthFilter)
    );
  }, [analyticsSessions, selectedMonthFilter]);

  const { monthlyPresentCount, monthlyAbsentCount } = useMemo(() => {
    let presentTotal = 0;
    let absentTotal = 0;
    for (const s of analyticsSessions) {
      if (s.session_date && s.session_date.startsWith(currentMonthKey)) {
        presentTotal += s.present_count || 0;
        absentTotal += s.absent_count || 0;
      }
    }
    return {
      monthlyPresentCount: presentTotal,
      monthlyAbsentCount: absentTotal,
    };
  }, [analyticsSessions, currentMonthKey]);

  const totalRegisteredLgus = areasList.length;

  const lguAnalyticsList = useMemo(
    () => computeLguAnalyticsList(areasList, filteredAnalyticsSessions),
    [areasList, filteredAnalyticsSessions]
  );

  const filteredLguAnalytics = useMemo(() => {
    if (!analyticsSearchQuery.trim()) return lguAnalyticsList;
    const q = analyticsSearchQuery.toLowerCase();
    return lguAnalyticsList.filter(
      (lgu) =>
        lgu.name.toLowerCase().includes(q) || lgu.code.toLowerCase().includes(q)
    );
  }, [lguAnalyticsList, analyticsSearchQuery]);

  const filteredPreviewItems = useMemo(() => {
    return municipalities.filter((mun) => {
      if (previewFilter === 'Present' && mun.attendance !== 'Present') {
        return false;
      }
      if (previewFilter === 'Absent' && mun.attendance !== 'Absent') {
        return false;
      }
      if (previewFilter === 'Exempted' && mun.attendance !== 'Exempted') {
        return false;
      }
      if (previewFilter === 'incomplete' && isRowComplete(mun)) return false;

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

  // Helper to update incomplete-stations alert banner dynamically on edits
  const syncIncompleteBanner = useCallback(
    (updatedList: MunicipalityRow[]) => {
      setAlertBanner((prev) => {
        if (!prev?.incompleteStations?.length) return prev;
        const incomplete = updatedList.filter((m) => !isRowComplete(m));
        if (incomplete.length === 0) return null;
        if (incomplete.length === prev.incompleteStations.length) return prev;
        return {
          ...prev,
          incompleteStations: incomplete.map((s) => s.name),
        };
      });
    },
    []
  );

  // ===========================================================================
  // 5. EDIT & VIEW LGU HANDLERS
  // ===========================================================================

  const handleOpenEditLgu = useCallback(
    (lgu: MunicipalityRow | LGUAnalyticsSummary) => {
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
        code: lgu.code,
        hasPort: Boolean(lgu.hasPort),
        portName: lgu.portName && lgu.portName !== 'None' ? lgu.portName : '',
      });
      setHasOpenedEditModal(true);
      setIsEditModalOpen(true);
      setActiveAnalyticsMenuId(null);
    },
    []
  );

  const handleSaveLguDetails = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isRollCallViewOnly || !canModifyRollCall) return;
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

        await syncOperationsData({ refreshAreas: true });

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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Error updating LGU details:', err);
        alert(`Could not save LGU: ${msg}`);
      } finally {
        setIsSavingLgu(false);
      }
    },
    [
      isRollCallViewOnly,
      canModifyRollCall,
      editingLgu,
      editLguForm,
      syncOperationsData,
      selectedLguForView,
      broadcastSync,
    ]
  );

  const handleOpenViewDrawer = useCallback(
    (lguSummary: LGUAnalyticsSummary) => {
      setSelectedLguForView(lguSummary);
      setHasOpenedViewDrawer(true);
      setIsViewDrawerOpen(true);
      setActiveAnalyticsMenuId(null);
    },
    []
  );

  // ===========================================================================
  // 6. LIVE ROLL CALL OPERATIONAL HANDLERS
  // ===========================================================================

  const triggerAutoAdvance = useCallback(
    (
      currentMunId: string,
      updatedRow: MunicipalityRow,
      updatedList: MunicipalityRow[]
    ) => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }

      if (isRowComplete(updatedRow)) {
        const currentIndex = updatedList.findIndex(
          (m) => m.id === currentMunId
        );
        const nextIncompleteMun = updatedList.find(
          (m, idx) => idx > currentIndex && !isRowComplete(m)
        );

        if (nextIncompleteMun) {
          const nextMunIndex = updatedList.findIndex(
            (m) => m.id === nextIncompleteMun.id
          );
          if (nextMunIndex !== -1) {
            const targetPage = Math.floor(nextMunIndex / stationsPerPage) + 1;
            setStationsPage((prev) => (prev !== targetPage ? targetPage : prev));
          }
          autoAdvanceTimerRef.current = setTimeout(() => {
            const el = document.getElementById(
              `station-row-${nextIncompleteMun.id}`
            );
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('bg-blue-50/80');
              setTimeout(() => el.classList.remove('bg-blue-50/80'), 1200);
            }
          }, 600);
        }
      }
    },
    [stationsPerPage]
  );

  const handleStartRollCall = useCallback(async () => {
    if (isRollCallViewOnly) return;
    setStationsPage(1);
    setIsSubmitting(true);
    try {
      const now = new Date();
      const militaryTime = getMilitaryTime(now);
      const dateFormatted = format(now, 'yyyy-MM-dd');
      const officerId = currentUserId || currentProfileId;
      const officerName = profileFullName;
      const officerRole =
        profilePositionTitle ||
        (profileRole === 'admin'
          ? 'System Administrator'
          : 'Monitoring Officer');

      const { data: newSession, error: createError } = await supabase
        .from('roll_call_sessions')
        .insert({
          session_date: dateFormatted,
          session_time: militaryTime,
          frequency: '142.500 MHz',
          radio_script: radioScript,
          conducted_by: officerId,
          status: 'in_progress',
          total_stations: areasListRef.current.length,
          present_count: 0,
          absent_count: areasListRef.current.length,
          exempted_count: 0,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      if (areasListRef.current.length > 0) {
        try {
          const initialEntries = areasListRef.current.map((area) => ({
            session_id: newSession.id,
            area_id: area.id,
            area_code: area.code,
            area_name: area.name,
            attendance: 'Absent' as const,
            weather_status: null,
            port_status: null,
            time_responded: null,
          }));
          await supabase
            .from('roll_call_entries')
            .upsert(initialEntries, { onConflict: 'session_id,area_id' });
        } catch (initErr) {
          console.warn('Initial entries sync notice:', initErr);
        }
      }

      const sessionRecord: RollCallSessionRecord = {
        id: newSession.id,
        session_date: newSession.session_date,
        session_time: newSession.session_time,
        frequency: newSession.frequency,
        radio_script: newSession.radio_script,
        conducted_by: officerId,
        conducted_by_name: officerName,
        conducted_by_avatar: profileAvatarUrl,
        conducted_by_role: officerRole,
        status: newSession.status,
        total_stations: newSession.total_stations,
        present_count: 0,
        absent_count: areasListRef.current.length,
        exempted_count: 0,
        weather_summary: null,
        created_at: newSession.created_at,
      };

      const resetMuns: MunicipalityRow[] = areasListRef.current.map((a) => ({
        ...a,
        attendance: 'Absent' as const,
        weatherStatus: null,
        portStatus: null,
        timeResponded: null,
      }));

      sessionSigRef.current = buildSessionSignature(sessionRecord);
      munsSigRef.current = buildMunicipalitiesSignature(resetMuns);
      activeSessionRef.current = sessionRecord;
      municipalitiesRef.current = resetMuns;
      setActiveSession(sessionRecord);
      setMunicipalities(resetMuns);

      writeCacheSnapshot({
        activeSession: sessionRecord,
        municipalities: resetMuns,
        stationsPage: 1,
      });

      broadcastSync('roll_call_updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error starting roll call session:', err);
      alert(`Could not start roll call session: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isRollCallViewOnly,
    currentUserId,
    currentProfileId,
    profileFullName,
    profilePositionTitle,
    profileRole,
    profileAvatarUrl,
    radioScript,
    writeCacheSnapshot,
    broadcastSync,
  ]);

  const handleToggleAttendance = useCallback(
    async (munId: string) => {
      if (isRollCallViewOnly || !canModerateRollCall) return;

      const currentMuns = municipalitiesRef.current;
      const targetMun = currentMuns.find((m) => m.id === munId);
      if (!targetMun) return;

      const isCurrentlyPresent = targetMun.attendance === 'Present';
      const newAttendance: 'Present' | 'Absent' = isCurrentlyPresent
        ? 'Absent'
        : 'Present';

      let newWeather = targetMun.weatherStatus;
      let newPort = targetMun.portStatus;
      let timeResponded = targetMun.timeResponded;

      if (newAttendance === 'Present') {
        timeResponded = timeResponded || getMilitaryTime();
        if (!newWeather || newWeather === 'N/A') newWeather = 'Fair';
        if (targetMun.hasPort && (!newPort || newPort === 'N/A')) {
          newPort = 'Operational';
        }
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

      const updatedList = currentMuns.map((m) =>
        m.id === munId ? updatedRow : m
      );
      munsSigRef.current = buildMunicipalitiesSignature(updatedList);
      municipalitiesRef.current = updatedList;
      setMunicipalities(updatedList);
      syncIncompleteBanner(updatedList);

      const session = activeSessionRef.current;
      if (session) {
        try {
          await supabase.from('roll_call_entries').upsert(
            {
              session_id: session.id,
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

          const pCount = updatedList.filter(
            (m) => m.attendance === 'Present'
          ).length;
          const aCount = updatedList.filter(
            (m) => m.attendance === 'Absent'
          ).length;
          const eCount = updatedList.filter(
            (m) => m.attendance === 'Exempted'
          ).length;

          await supabase
            .from('roll_call_sessions')
            .update({
              present_count: pCount,
              absent_count: aCount,
              exempted_count: eCount,
            })
            .eq('id', session.id);

          const nextSession: RollCallSessionRecord = {
            ...session,
            present_count: pCount,
            absent_count: aCount,
            exempted_count: eCount,
          };
          sessionSigRef.current = buildSessionSignature(nextSession);
          activeSessionRef.current = nextSession;
          setActiveSession(nextSession);

          writeCacheSnapshot({
            activeSession: nextSession,
            municipalities: updatedList,
          });
          broadcastSync('roll_call_updated');
        } catch (dbErr) {
          console.warn('Could not sync entry to database:', dbErr);
        }
      } else {
        writeCacheSnapshot({ municipalities: updatedList });
      }

      triggerAutoAdvance(munId, updatedRow, updatedList);
    },
    [
      isRollCallViewOnly,
      canModerateRollCall,
      syncIncompleteBanner,
      writeCacheSnapshot,
      broadcastSync,
      triggerAutoAdvance,
    ]
  );

  const handleWeatherChange = useCallback(
    async (munId: string, weather: string) => {
      if (isRollCallViewOnly || !canModerateRollCall) return;

      const currentMuns = municipalitiesRef.current;
      const targetMun = currentMuns.find((m) => m.id === munId);
      if (!targetMun) return;

      const updatedRow: MunicipalityRow = { ...targetMun, weatherStatus: weather };
      const updatedList = currentMuns.map((m) =>
        m.id === munId ? updatedRow : m
      );

      munsSigRef.current = buildMunicipalitiesSignature(updatedList);
      municipalitiesRef.current = updatedList;
      setMunicipalities(updatedList);
      syncIncompleteBanner(updatedList);
      writeCacheSnapshot({ municipalities: updatedList });

      const session = activeSessionRef.current;
      if (session && targetMun.attendance) {
        try {
          await supabase.from('roll_call_entries').upsert(
            {
              session_id: session.id,
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

      triggerAutoAdvance(munId, updatedRow, updatedList);
    },
    [
      isRollCallViewOnly,
      canModerateRollCall,
      syncIncompleteBanner,
      writeCacheSnapshot,
      broadcastSync,
      triggerAutoAdvance,
    ]
  );

  const handlePortChange = useCallback(
    async (munId: string, portStatus: string) => {
      if (isRollCallViewOnly || !canModerateRollCall) return;

      const currentMuns = municipalitiesRef.current;
      const targetMun = currentMuns.find((m) => m.id === munId);
      if (!targetMun) return;

      const updatedRow: MunicipalityRow = { ...targetMun, portStatus };
      const updatedList = currentMuns.map((m) =>
        m.id === munId ? updatedRow : m
      );

      munsSigRef.current = buildMunicipalitiesSignature(updatedList);
      municipalitiesRef.current = updatedList;
      setMunicipalities(updatedList);
      syncIncompleteBanner(updatedList);
      writeCacheSnapshot({ municipalities: updatedList });

      const session = activeSessionRef.current;
      if (session && targetMun.attendance) {
        try {
          await supabase.from('roll_call_entries').upsert(
            {
              session_id: session.id,
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

      triggerAutoAdvance(munId, updatedRow, updatedList);
    },
    [
      isRollCallViewOnly,
      canModerateRollCall,
      syncIncompleteBanner,
      writeCacheSnapshot,
      broadcastSync,
      triggerAutoAdvance,
    ]
  );

  const handleOpenFinalizeModal = useCallback(() => {
    const incomplete = municipalitiesRef.current.filter(
      (m) => !isRowComplete(m)
    );
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
    setHasOpenedPreviewModal(true);
    setIsRecordPreviewModalOpen(true);
  }, []);

  const handleFinalizeSaveRecord = useCallback(async () => {
    const session = activeSessionRef.current;
    if (!session || isRollCallViewOnly) return;

    const currentMuns = municipalitiesRef.current;
    const total = currentMuns.length;
    const pres = currentMuns.filter((m) => m.attendance === 'Present').length;
    const abs = currentMuns.filter((m) => m.attendance === 'Absent').length;
    const ex = currentMuns.filter((m) => m.attendance === 'Exempted').length;

    setIsSubmitting(true);
    try {
      const now = new Date();
      const dateFormatted = format(now, 'yyyy-MM-dd');
      const timeFormatted = format(now, 'HHmm') + 'H';
      const officerId = currentUserId || currentProfileId;
      const officerName = profileFullName;
      const officerRole =
        profilePositionTitle ||
        (profileRole === 'admin'
          ? 'System Administrator'
          : 'Monitoring Officer');

      const weatherCounts = currentMuns
        .filter((m) => m.attendance === 'Present' && m.weatherStatus)
        .reduce((acc, m) => {
          acc[m.weatherStatus!] = (acc[m.weatherStatus!] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const weatherSummaryText =
        Object.entries(weatherCounts)
          .map(([w, c]) => `${w}: ${c}`)
          .join(', ') || 'No weather telemetry recorded';

      const entriesList = currentMuns.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        hasPort: m.hasPort,
        portName: m.portName,
        attendance: m.attendance || 'Absent',
        weatherStatus:
          m.attendance === 'Present' ? m.weatherStatus || 'Fair' : 'N/A',
        portStatus:
          m.attendance === 'Present'
            ? !m.hasPort
              ? 'No Port (Inland)'
              : m.portStatus || 'Operational'
            : 'N/A',
        timeResponded:
          m.attendance === 'Present' ? m.timeResponded || timeFormatted : null,
        dutyOperator: 'Station Duty Officer',
      }));

      const snapshotPayload = {
        sessionId: session.id,
        sessionDate: dateFormatted,
        sessionTime: session.session_time,
        frequency: session.frequency,
        radioScript: session.radio_script,
        conductedBy: officerName,
        conductedByRole: officerRole,
        totalStations: total,
        present: pres,
        absent: abs,
        exempted: ex,
        weatherSummary: weatherSummaryText,
        entries: entriesList,
        records: entriesList.map((m) => ({
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
        fileHash = hashArray
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      } catch {
        fileHash = `HASH-${Date.now()}`;
      }

      const archiveFilename = `ROLLCALL-REPORT-${dateFormatted.replace(
        /-/g,
        ''
      )}-${timeFormatted}.pdf`;

      const { blob: pdfBlob, sizeBytes: pdfSize } = await generateRollCallPDF({
        filename: archiveFilename,
        sessionDate: dateFormatted,
        sessionTime: timeFormatted,
        frequency: session.frequency,
        radioScript: session.radio_script,
        conductedBy: officerName,
        conductedByRole: officerRole,
        signatureUrl: null,
        totalStations: total,
        present: pres,
        absent: abs,
        exempted: ex,
        weatherSummary: weatherSummaryText,
        entries: entriesList,
        fileHash,
        snapshotPayload: {
          ...snapshotPayload,
          templateType: selectedTemplateType,
          paperSize: selectedPaperSize,
        },
        templateType: selectedTemplateType,
        paperSize: selectedPaperSize,
      });

      let storagePath = `RC/${archiveFilename}`;
      let fileUrl: string | null = null;
      try {
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('archive-documents')
          .upload(storagePath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (!uploadErr && uploadData) {
          storagePath = uploadData.path;
          const { data: urlData } = supabase.storage
            .from('archive-documents')
            .getPublicUrl(storagePath);
          fileUrl = urlData?.publicUrl || null;
        }
      } catch (sErr) {
        console.warn('Could not upload roll call PDF to storage:', sErr);
      }

      if (currentMuns.length > 0) {
        try {
          const allFinalEntries = currentMuns.map((m) => ({
            session_id: session.id,
            area_id: m.id,
            area_code: m.code,
            area_name: m.name,
            attendance: m.attendance || 'Absent',
            weather_status:
              m.attendance === 'Present' ? m.weatherStatus || 'Fair' : null,
            port_status:
              m.attendance === 'Present' && m.hasPort
                ? m.portStatus || 'Operational'
                : null,
            time_responded:
              m.attendance === 'Present'
                ? m.timeResponded || getMilitaryTime()
                : null,
          }));

          await supabase
            .from('roll_call_entries')
            .upsert(allFinalEntries, { onConflict: 'session_id,area_id' });
        } catch (bErr) {
          console.warn('Batch entries sync error on finalize:', bErr);
        }
      }

      await supabase
        .from('roll_call_sessions')
        .update({
          status: 'completed',
          completed_at: now.toISOString(),
          weather_summary: weatherSummaryText,
          present_count: pres,
          absent_count: abs,
          exempted_count: ex,
        })
        .eq('id', session.id);

      const isUuid = (str: string | undefined | null) =>
        Boolean(
          str &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              str
            )
        );

      const validSessionId = isUuid(session.id) ? session.id : null;
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
          item_count: total,
          file_size_bytes: pdfSize,
          storage_path: storagePath,
          file_url: fileUrl,
          file_hash: fileHash,
          summary: `Roll Call Session completed on ${dateFormatted} at ${timeFormatted}. Present: ${pres}, Absent: ${abs}, Exempted: ${ex}. Frequency: ${session.frequency}. Weather summary: ${weatherSummaryText}`,
          status: 'Verified',
          snapshot_data: snapshotPayload,
          generated_at: now.toISOString(),
        });
      } catch (aErr) {
        console.warn('Archives insert notice:', aErr);
      }

      broadcastSync('archives_updated');
      broadcastSync('roll_call_completed');

      setSaveToastMessage({
        title: 'Roll Call Session Saved',
        subtitle: `Session archived with ${pres} present and ${abs} absent.`,
      });

      const resetMuns: MunicipalityRow[] = areasListRef.current.map((a) => ({
        ...a,
        attendance: 'Absent' as const,
        weatherStatus: null,
        portStatus: null,
        timeResponded: null,
      }));

      sessionSigRef.current = buildSessionSignature(null);
      munsSigRef.current = buildMunicipalitiesSignature(resetMuns);
      activeSessionRef.current = null;
      municipalitiesRef.current = resetMuns;

      setIsRecordPreviewModalOpen(false);
      setShowSaveToast(true);
      setActiveSession(null);
      setMunicipalities(resetMuns);

      writeCacheSnapshot({
        activeSession: null,
        municipalities: resetMuns,
      });

      await fetchAnalyticsData({ silentIfLoaded: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error finalizing roll call record:', err);
      alert(`Could not save record: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isRollCallViewOnly,
    currentUserId,
    currentProfileId,
    profileFullName,
    profilePositionTitle,
    profileRole,
    selectedTemplateType,
    selectedPaperSize,
    broadcastSync,
    writeCacheSnapshot,
    fetchAnalyticsData,
  ]);

  const handleQuickExportPDF = useCallback(
    async (
      templateOverride?: RollCallTemplateType,
      paperOverride?: PaperSize
    ) => {
      try {
        const tpl = templateOverride || selectedTemplateType;
        const pSize = paperOverride || selectedPaperSize;
        const now = new Date();
        const session = activeSessionRef.current;
        const currentMuns = municipalitiesRef.current;
        const dateFormatted =
          session?.session_date || now.toISOString().split('T')[0];
        const timeFormatted =
          session?.session_time || format(now, 'HHmm') + 'H';
        const officerName =
          session?.conducted_by_name || profileFullName;
        const officerRole =
          session?.conducted_by_role ||
          profilePositionTitle ||
          'Duty Operations Officer';

        const pres = currentMuns.filter(
          (m) => m.attendance === 'Present'
        ).length;
        const abs = currentMuns.filter((m) => m.attendance === 'Absent').length;
        const ex = currentMuns.filter(
          (m) => m.attendance === 'Exempted'
        ).length;

        const entriesList = currentMuns.map((m) => ({
          name: m.name,
          code: m.code,
          attendance: m.attendance || 'Absent',
          weatherStatus: m.weatherStatus || null,
          portStatus: m.portStatus || null,
          hasPort: m.hasPort,
          portName: m.portName,
          timeResponded: m.timeResponded || null,
        }));

        const tplTag = tpl === 'net_calling' ? 'NETCALL' : 'OFFICIAL';
        const sizeTag = pSize.toUpperCase();
        const filename = `ROLLCALL-${tplTag}-${sizeTag}-${dateFormatted.replace(
          /-/g,
          ''
        )}-${timeFormatted}.pdf`;

        const { blob } = await generateRollCallPDF({
          filename,
          sessionDate: dateFormatted,
          sessionTime: timeFormatted,
          frequency: session?.frequency || '142.500 MHz Primary VHF Net',
          radioScript: session?.radio_script || radioScript,
          conductedBy: officerName,
          conductedByRole: officerRole,
          signatureUrl: null,
          totalStations: currentMuns.length,
          present: pres,
          absent: abs,
          exempted: ex,
          weatherSummary: `${pres} Present · ${abs} Absent · ${ex} Exempted`,
          entries: entriesList,
          fileHash: `PREVIEW-${Date.now()}`,
          templateType: tpl,
          paperSize: pSize,
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        setSaveToastMessage({
          title: 'Roll Call PDF Exported',
          subtitle: `Downloaded ${
            tpl === 'net_calling' ? 'Net Calling Sheet' : 'Official MLS Table'
          } (${PAPER_DIMENSIONS[pSize].shortLabel}).`,
        });
        setShowSaveToast(true);
      } catch (err) {
        console.error('Error exporting roll call PDF:', err);
      }
    },
    [
      selectedTemplateType,
      selectedPaperSize,
      profileFullName,
      profilePositionTitle,
      radioScript,
    ]
  );

  // ===========================================================================
  // 7. INITIAL LOADING SKELETON (COLD BOOT ONLY)
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
                void fetchAnalyticsData({ silentIfLoaded: true });
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
          <OperationsTab
            isRollCallActive={isRollCallActive}
            activeSession={activeSession}
            totalCount={totalCount}
            presentCount={presentCount}
            absentCount={absentCount}
            recordedCount={recordedCount}
            alertBanner={alertBanner}
            onDismissAlert={() => setAlertBanner(null)}
            canModerateRollCall={canModerateRollCall}
            radioScript={radioScript}
            isSubmitting={isSubmitting}
            canModifyRollCall={canModifyRollCall}
            isRollCallViewOnly={isRollCallViewOnly}
            onStartRollCall={handleStartRollCall}
            onOpenFinalizeModal={handleOpenFinalizeModal}
            stationsPage={effectiveStationsPage}
            totalStationPages={totalStationPages}
            stationsPerPage={stationsPerPage}
            paginatedMunicipalities={paginatedMunicipalities}
            onPageChange={setStationsPage}
            onToggleAttendance={handleToggleAttendance}
            onWeatherChange={handleWeatherChange}
            onPortChange={handlePortChange}
          />
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: ROLL CALL ANALYTICS */}
        {/* ========================================================================= */}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            isLoadingAnalytics={isLoadingAnalytics}
            analyticsLoaded={analyticsLoaded}
            totalRegisteredLgus={totalRegisteredLgus}
            currentMonthName={currentMonthName}
            monthlyPresentCount={monthlyPresentCount}
            monthlyAbsentCount={monthlyAbsentCount}
            filteredLguAnalytics={filteredLguAnalytics}
            analyticsSearchQuery={analyticsSearchQuery}
            onSearchChange={setAnalyticsSearchQuery}
            activeAnalyticsMenuId={activeAnalyticsMenuId}
            onToggleAnalyticsMenu={setActiveAnalyticsMenuId}
            onOpenViewDrawer={handleOpenViewDrawer}
            onOpenEditLgu={handleOpenEditLgu}
          />
        )}

        {/* Lazy-loaded View Analytics & History Slide-Over Drawer */}
        {hasOpenedViewDrawer && (
          <ViewLguDrawer
            isOpen={isViewDrawerOpen}
            selectedLgu={selectedLguForView}
            onClose={() => setIsViewDrawerOpen(false)}
          />
        )}

        {/* Lazy-loaded Edit LGU Details Modal */}
        {hasOpenedEditModal && (
          <EditLguModal
            isOpen={isEditModalOpen}
            editingLgu={editingLguAnalyticsAdapter(editingLgu)}
            editLguForm={editLguForm}
            isSavingLgu={isSavingLgu}
            onChangeForm={setEditLguForm}
            onSubmit={handleSaveLguDetails}
            onClose={() => setIsEditModalOpen(false)}
          />
        )}

        {/* Lazy-loaded Review & Finalize Modal */}
        {hasOpenedPreviewModal && (
          <RecordPreviewModal
            isOpen={isRecordPreviewModalOpen}
            activeSession={activeSession}
            profileFullName={profileFullName}
            presentCount={presentCount}
            absentCount={absentCount}
            exemptedCount={exemptedCount}
            recordedCount={recordedCount}
            selectedTemplateType={selectedTemplateType}
            selectedPaperSize={selectedPaperSize}
            previewFilter={previewFilter}
            previewSearchQuery={previewSearchQuery}
            filteredPreviewItems={filteredPreviewItems}
            isSubmitting={isSubmitting}
            onChangeTemplateType={setSelectedTemplateType}
            onChangePaperSize={setSelectedPaperSize}
            onChangeFilter={setPreviewFilter}
            onChangeSearchQuery={setPreviewSearchQuery}
            onQuickExportPDF={handleQuickExportPDF}
            onFinalizeSaveRecord={handleFinalizeSaveRecord}
            onClose={() => setIsRecordPreviewModalOpen(false)}
          />
        )}

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
                <h4 className="text-sm font-bold text-[#1E293B]">
                  {saveToastMessage.title}
                </h4>
                <p className="text-xs text-[#505F76] mt-0.5">
                  {saveToastMessage.subtitle}
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
      </div>
    </AppLayoutShell>
  );
}

function editingLguAnalyticsAdapter(
  lgu: MunicipalityRow | null
): LGUAnalyticsSummary | null {
  if (!lgu) return null;
  return {
    id: lgu.id,
    code: lgu.code,
    name: lgu.name,
    hasPort: Boolean(lgu.hasPort),
    portName: lgu.portName,
    sortOrder: lgu.sortOrder ?? 0,
    isActive: lgu.isActive ?? true,
    totalPresent: 0,
    totalAbsent: 0,
    totalExempted: 0,
    totalSessions: 0,
    attendanceRate: 0,
    presentRecords: [],
    absentRecords: [],
    trendData: [],
  };
}
