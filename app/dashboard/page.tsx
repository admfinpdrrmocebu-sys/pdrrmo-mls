'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { useTheme } from '@/lib/theme/theme-context';
import { supabase } from '@/lib/supabase/client';
import {
  getCachedDashboardData,
  patchCachedDashboardData,
  setCachedDashboardData,
  type CachedDashboardData,
} from '@/lib/cache/screen-data-cache';
import {
  formatBytes,
  type ActiveShiftInfo,
  type DashboardTimeRange,
  type ReportTypeRow,
  type RollCallSessionRow,
  type ShiftLogRow,
} from './_components/types';
import {
  DashboardChartsSkeleton,
  DashboardSummarySkeleton,
} from './_components/dashboard-skeletons';
import { ActiveShiftBanner } from './_components/active-shift-banner';
import { DashboardSummarySection } from './_components/dashboard-summary-section';
import { LogActivityTrendCard } from './_components/log-activity-trend-card';
import { LogDistributionCard } from './_components/log-distribution-card';
import { RollCallAttendanceCard } from './_components/roll-call-attendance-card';

const FALLBACK_POLL_MS = 30_000;
const REALTIME_DEBOUNCE_MS = 400;

interface LeadOfficerJoinedRow {
  full_name: string | null;
  position_title: string | null;
  role: string | null;
  avatar_url: string | null;
}

interface ActiveShiftQueryRow {
  id: string;
  shift_label: string | null;
  lead_officer_id: string | null;
  started_at: string;
  start_time: string | null;
  lead_officer?: LeadOfficerJoinedRow | LeadOfficerJoinedRow[] | null;
}

function buildDashboardSignature(params: {
  todayCount: number;
  yesterdayCount: number;
  totalFiles: number;
  totalBytes: number;
  totalUsers: number;
  activeShift: ActiveShiftInfo | null;
  recentLogs: ShiftLogRow[];
  reportTypes: ReportTypeRow[];
  rollCallSessions: RollCallSessionRow[];
}): string {
  const {
    todayCount,
    yesterdayCount,
    totalFiles,
    totalBytes,
    totalUsers,
    activeShift,
    recentLogs,
    reportTypes,
    rollCallSessions,
  } = params;

  const shiftKey = activeShift
    ? `${activeShift.id}:${activeShift.shift_label}:${activeShift.lead_officer_name}:${activeShift.lead_officer_role}:${activeShift.lead_officer_avatar ?? ''}:${activeShift.started_at}`
    : 'none';

  const latestLog = recentLogs[0];
  const logsKey = `${recentLogs.length}:${latestLog?.id ?? ''}:${latestLog?.created_at ?? ''}:${latestLog?.report_type_name ?? ''}`;
  const typesKey = reportTypes
    .map((rt) => `${rt.id}:${rt.name}:${rt.color ?? ''}`)
    .join('|');
  const rollCallKey = rollCallSessions
    .map(
      (s) =>
        `${s.id}:${s.session_date}:${s.present_count}:${s.absent_count}:${s.exempted_count}:${s.total_stations}`
    )
    .join('|');

  return [
    todayCount,
    yesterdayCount,
    totalFiles,
    totalBytes,
    totalUsers,
    shiftKey,
    logsKey,
    typesKey,
    rollCallKey,
  ].join('::');
}

function computeLogsTrend(
  todayCount: number,
  yesterdayCount: number
): { changeStr: string; changeType: 'positive' | 'negative' | 'neutral' } {
  if (yesterdayCount === 0) {
    if (todayCount > 0) {
      return { changeStr: '+100%', changeType: 'positive' };
    }
    return { changeStr: '0%', changeType: 'neutral' };
  }

  const diff = todayCount - yesterdayCount;
  const pct = Math.round((diff / yesterdayCount) * 100);
  if (pct > 0) return { changeStr: `+${pct}%`, changeType: 'positive' };
  if (pct < 0) return { changeStr: `${pct}%`, changeType: 'negative' };
  return { changeStr: '0%', changeType: 'neutral' };
}

export default function DashboardPage() {
  const { isDark } = useTheme();
  const [initialCache] = useState<CachedDashboardData | null>(() =>
    getCachedDashboardData()
  );

  // Skip entrance & chart draw delays when returning with cached data
  const [animateInitialMount] = useState<boolean>(() => !initialCache);

  const [timeRange, setTimeRange] = useState<DashboardTimeRange>(
    () => initialCache?.timeRange ?? 'Last 24 Hours'
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialCache);

  // Active Shift State (Realtime)
  const [activeShift, setActiveShift] = useState<ActiveShiftInfo | null>(
    () => initialCache?.activeShift ?? null
  );

  // Summary Metrics State
  const [todayLogsCount, setTodayLogsCount] = useState<number>(
    () => initialCache?.todayLogsCount ?? 0
  );
  const [yesterdayLogsCount, setYesterdayLogsCount] = useState<number>(
    () => initialCache?.yesterdayLogsCount ?? 0
  );
  const [logsChangeStr, setLogsChangeStr] = useState<string>(
    () => initialCache?.logsChangeStr ?? '0%'
  );
  const [logsChangeType, setLogsChangeType] = useState<
    'positive' | 'negative' | 'neutral'
  >(() => initialCache?.logsChangeType ?? 'neutral');

  const [totalFilesCount, setTotalFilesCount] = useState<number>(
    () => initialCache?.totalFilesCount ?? 0
  );
  const [totalStorageStr, setTotalStorageStr] = useState<string>(
    () => initialCache?.totalStorageStr ?? '0 KB'
  );

  const [totalUsersCount, setTotalUsersCount] = useState<number>(
    () => initialCache?.totalUsersCount ?? 0
  );

  // Raw Database Data for Dynamic Charting
  const [allLogs, setAllLogs] = useState<ShiftLogRow[]>(
    () => initialCache?.allLogs ?? []
  );
  const [reportTypes, setReportTypes] = useState<ReportTypeRow[]>(
    () => initialCache?.reportTypes ?? []
  );
  const [rollCallSessions, setRollCallSessions] = useState<
    RollCallSessionRow[]
  >(() => initialCache?.rollCallSessions ?? []);

  // Refs for concurrency deduplication, unchanged-payload skipping & mount safety
  const mountedRef = useRef(true);
  const fetchInFlightRef = useRef<Promise<void> | null>(null);
  const signatureRef = useRef<string>(initialCache?.signature ?? '');
  const timeRangeRef = useRef<DashboardTimeRange>(timeRange);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    timeRangeRef.current = timeRange;
  }, [timeRange]);

  const handleTimeRangeChange = useCallback((nextRange: DashboardTimeRange) => {
    timeRangeRef.current = nextRange;
    setTimeRange(nextRange);
    patchCachedDashboardData({ timeRange: nextRange });
  }, []);

  // ===========================================================================
  // 1. FETCH LIVE DATABASE DATA (SWR + Deduplication + Snapshot Diffing)
  // ===========================================================================
  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (fetchInFlightRef.current) {
      return fetchInFlightRef.current;
    }

    const runFetch = async () => {
      try {
        if (!isBackground && mountedRef.current) {
          setIsLoading(true);
        }

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

        const [
          todayLogsRes,
          yesterdayLogsRes,
          archivesRes,
          profilesRes,
          reportTypesRes,
          recentLogsRes,
          rollCallRes,
          activeShiftRes,
        ] = await Promise.all([
          // 1. Today's Logs Count
          supabase
            .from('shift_logs')
            .select('id', { count: 'exact', head: true })
            .eq('log_date', todayStr),

          // 2. Yesterday's Logs Count
          supabase
            .from('shift_logs')
            .select('id', { count: 'exact', head: true })
            .eq('log_date', yesterdayStr),

          // 3. Archives Total Files and Total Storage Size
          supabase.from('archives').select('id, file_size_bytes'),

          // 4. Total Active Profiles
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true),

          // 5. Active Report Types & Color Schemes
          supabase
            .from('report_types')
            .select('id, name, code, color')
            .eq('is_active', true),

          // 6. Recent Shift Logs (past 30 days) for Trends & Distribution
          supabase
            .from('shift_logs')
            .select('id, title, report_type_name, log_date, log_time, created_at')
            .gte('log_date', thirtyDaysAgoStr)
            .order('created_at', { ascending: false }),

          // 7. Recent Net Roll Call Sessions
          supabase
            .from('roll_call_sessions')
            .select(
              'id, session_date, session_time, present_count, absent_count, exempted_count, total_stations, created_at'
            )
            .order('session_date', { ascending: false })
            .limit(7),

          // 8. Active Shift with embedded Lead Officer join (eliminates waterfall query)
          supabase
            .from('shifts')
            .select(
              'id, shift_label, lead_officer_id, started_at, start_time, lead_officer:lead_officer_id(full_name, position_title, role, avatar_url)'
            )
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const todayCount = todayLogsRes.count ?? 0;
        const yesterdayCount = yesterdayLogsRes.count ?? 0;
        const { changeStr, changeType } = computeLogsTrend(
          todayCount,
          yesterdayCount
        );

        const archivesData = archivesRes.data || [];
        const totalFiles = archivesData.length;
        const totalBytes = archivesData.reduce(
          (acc, row) => acc + (Number(row.file_size_bytes) || 0),
          0
        );
        const formattedStorage = formatBytes(totalBytes);

        const activeUsers =
          profilesRes.count ?? (profilesRes.data ? profilesRes.data.length : 1);
        const safeTotalUsers = Math.max(activeUsers, 1);

        // Process Active Shift (prefer embedded join, fallback query only if missing)
        let nextActiveShift: ActiveShiftInfo | null = null;
        const shiftData =
          activeShiftRes.data as ActiveShiftQueryRow | null;

        if (shiftData) {
          let leadOfficerName = 'Lead Officer';
          let leadOfficerRole = 'Monitoring Officer';
          let leadOfficerAvatar: string | null = null;

          const joinedRaw = shiftData.lead_officer;
          let leadProf: LeadOfficerJoinedRow | null = Array.isArray(joinedRaw)
            ? joinedRaw[0] ?? null
            : joinedRaw ?? null;

          if (!leadProf && shiftData.lead_officer_id) {
            const { data: fallbackProf } = await supabase
              .from('profiles')
              .select('full_name, position_title, role, avatar_url')
              .eq('id', shiftData.lead_officer_id)
              .maybeSingle();
            leadProf = fallbackProf as LeadOfficerJoinedRow | null;
          }

          if (leadProf) {
            leadOfficerName = leadProf.full_name || leadOfficerName;
            leadOfficerRole =
              leadProf.position_title ||
              (leadProf.role === 'admin'
                ? 'System Administrator'
                : 'Monitoring Officer');
            leadOfficerAvatar = leadProf.avatar_url || null;
          }

          nextActiveShift = {
            id: shiftData.id,
            shift_label: shiftData.shift_label || 'Current Shift',
            lead_officer_name: leadOfficerName,
            lead_officer_role: leadOfficerRole,
            lead_officer_avatar: leadOfficerAvatar,
            started_at: shiftData.started_at,
            start_time: shiftData.start_time ?? undefined,
            status: 'active',
          };
        }

        const nextReportTypes = (reportTypesRes.data || []) as ReportTypeRow[];
        const nextAllLogs = (recentLogsRes.data || []) as ShiftLogRow[];
        const nextRollCall = (rollCallRes.data || []) as RollCallSessionRow[];

        const nextSignature = buildDashboardSignature({
          todayCount,
          yesterdayCount,
          totalFiles,
          totalBytes,
          totalUsers: safeTotalUsers,
          activeShift: nextActiveShift,
          recentLogs: nextAllLogs,
          reportTypes: nextReportTypes,
          rollCallSessions: nextRollCall,
        });

        // Skip React state updates (and chart SVG redraws) when payload is identical
        if (nextSignature === signatureRef.current && signatureRef.current !== '') {
          patchCachedDashboardData({ fetchedAt: Date.now() });
          return;
        }

        signatureRef.current = nextSignature;

        const cachePayload: CachedDashboardData = {
          todayLogsCount: todayCount,
          yesterdayLogsCount: yesterdayCount,
          logsChangeStr: changeStr,
          logsChangeType: changeType,
          totalFilesCount: totalFiles,
          totalStorageStr: formattedStorage,
          totalUsersCount: safeTotalUsers,
          activeShift: nextActiveShift,
          allLogs: nextAllLogs,
          reportTypes: nextReportTypes,
          rollCallSessions: nextRollCall,
          timeRange: timeRangeRef.current,
          signature: nextSignature,
          fetchedAt: Date.now(),
        };
        setCachedDashboardData(cachePayload);

        if (!mountedRef.current) return;

        setTodayLogsCount(todayCount);
        setYesterdayLogsCount(yesterdayCount);
        setLogsChangeStr(changeStr);
        setLogsChangeType(changeType);
        setTotalFilesCount(totalFiles);
        setTotalStorageStr(formattedStorage);
        setTotalUsersCount(safeTotalUsers);
        setActiveShift(nextActiveShift);
        setReportTypes(nextReportTypes);
        setAllLogs(nextAllLogs);
        setRollCallSessions(nextRollCall);
      } catch (err) {
        console.error('Error fetching dashboard Supabase metrics:', err);
      } finally {
        fetchInFlightRef.current = null;
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    const promise = runFetch();
    fetchInFlightRef.current = promise;
    return promise;
  }, []);

  // ===========================================================================
  // 2. INITIAL SYNC + DEBOUNCED REALTIME + VISIBILITY-GATED FALLBACK POLL
  // ===========================================================================
  useEffect(() => {
    void fetchDashboardData(Boolean(initialCache));

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleBackgroundRefresh = () => {
      if (document.hidden) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void fetchDashboardData(true);
      }, REALTIME_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel('pdrrmo-mls-live-logs', {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        scheduleBackgroundRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_logs' },
        scheduleBackgroundRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'archives' },
        scheduleBackgroundRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roll_call_sessions' },
        scheduleBackgroundRefresh
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        scheduleBackgroundRefresh
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'profiles' },
        scheduleBackgroundRefresh
      )
      .on('broadcast', { event: 'shift_logs_updated' }, scheduleBackgroundRefresh)
      .on('broadcast', { event: 'shift_state_updated' }, scheduleBackgroundRefresh)
      .subscribe();

    const syncInterval = setInterval(() => {
      if (!document.hidden) {
        void fetchDashboardData(true);
      }
    }, FALLBACK_POLL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void fetchDashboardData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchDashboardData, initialCache]);

  return (
    <AppLayoutShell
      title="MLS Terminal"
      subtitle="Monitoring Logging System"
    >
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="dashboard-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <DashboardSummarySkeleton />
              <DashboardChartsSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard-content"
              initial={animateInitialMount ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={animateInitialMount ? { duration: 0.3 } : { duration: 0 }}
              className="space-y-6"
            >
              <ActiveShiftBanner activeShift={activeShift} />

              <DashboardSummarySection
                todayLogsCount={todayLogsCount}
                yesterdayLogsCount={yesterdayLogsCount}
                logsChangeStr={logsChangeStr}
                logsChangeType={logsChangeType}
                totalFilesCount={totalFilesCount}
                totalStorageStr={totalStorageStr}
                totalUsersCount={totalUsersCount}
              />

              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <LogActivityTrendCard
                  allLogs={allLogs}
                  timeRange={timeRange}
                  onTimeRangeChange={handleTimeRangeChange}
                  isDark={isDark}
                  animateCharts={animateInitialMount}
                />

                <LogDistributionCard
                  allLogs={allLogs}
                  reportTypes={reportTypes}
                  isDark={isDark}
                  animateCharts={animateInitialMount}
                />

                <RollCallAttendanceCard
                  rollCallSessions={rollCallSessions}
                  isDark={isDark}
                  animateCharts={animateInitialMount}
                />
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayoutShell>
  );
}
