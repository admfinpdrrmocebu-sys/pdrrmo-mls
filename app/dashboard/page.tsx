'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Folder,
  Users,
  BarChart3,
  Calendar,
  ChevronDown,
  Activity,
  PieChart as PieIcon,
  Radio,
  Clock,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AppLayoutShell } from '@/components/nav-route';
import { SummaryCard } from '@/components/card';
import { Skeleton } from '@/components/skeleton';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface ActiveShiftInfo {
  id: string;
  shift_label: string;
  lead_officer_name: string;
  started_at: string;
}

interface ShiftLogRow {
  id: string;
  title: string;
  report_type_name: string;
  log_date: string;
  log_time: string;
  created_at: string;
}

interface RollCallSessionRow {
  id: string;
  session_date: string;
  session_time: string;
  present_count: number;
  absent_count: number;
  exempted_count: number;
  total_stations: number;
  created_at: string;
}

interface ReportTypeRow {
  id: string;
  name: string;
  code: string;
  color: string;
}

interface DistributionItem {
  name: string;
  value: number;
  color: string;
  count: number;
}

interface ActivityTrendPoint {
  time: string;
  logs: number;
}

interface RollCallAttendancePoint {
  day: string;
  date: string;
  attendance: number;
  stations: number;
}

// Fallback color palette for report types
const DEFAULT_COLORS = [
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

// Helper: Format bytes to human-readable size
function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i] || 'MB'}`;
}

// Helper: Parse log time to hour (handles '0830H', '08:30', '14:00', ISO strings)
function parseLogHour(logTime: string, createdAt: string): number {
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
  return 12; // default midday
}

// =============================================================================
// SKELETON PLACEHOLDER COMPONENTS
// =============================================================================

function DashboardSummarySkeleton() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="relative bg-white rounded-[1.75rem] p-6 sm:p-7 border border-[#E2E8F0] shadow-sm flex flex-col justify-between overflow-hidden"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Skeleton variant="rounded" className="h-4 w-24" />
              <div className="flex items-baseline gap-3 pt-1">
                <Skeleton variant="rounded" className="h-9 w-28" />
                <Skeleton variant="pill" className="h-5 w-14" />
              </div>
            </div>
            <Skeleton variant="circular" className="w-12 h-12 rounded-full shrink-0" />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <Skeleton variant="rounded" className="h-3 w-40" />
          </div>
        </div>
      ))}
    </section>
  );
}

function DashboardChartsSkeleton() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Log Activity Trend Skeleton (2 cols) */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]/40">
          <div className="flex items-center gap-2.5">
            <Skeleton variant="circular" className="w-5 h-5" />
            <Skeleton variant="rounded" className="h-5 w-44" />
          </div>
          <Skeleton variant="pill" className="h-7 w-32" />
        </div>
        <div className="p-6 flex-1 min-h-[320px] flex flex-col justify-between">
          <div className="h-[240px] w-full flex items-end gap-3 pt-4 border-b border-slate-100">
            {[40, 25, 60, 85, 95, 75, 55, 45, 30].map((h, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <Skeleton
                  variant="rounded"
                  className="w-full rounded-t-lg"
                  style={{ height: `${h}%` }}
                />
                <Skeleton variant="rounded" className="h-2.5 w-7" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Donut Distribution Skeleton (1 col) */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Skeleton variant="circular" className="w-5 h-5" />
            <Skeleton variant="rounded" className="h-5 w-36" />
          </div>
          <Skeleton variant="rounded" className="h-5 w-16" />
        </div>
        <div className="p-6 flex-1 flex flex-col items-center justify-center">
          <div className="relative w-44 h-44 flex items-center justify-center">
            <Skeleton variant="circular" className="w-40 h-40 rounded-full" />
            <div className="absolute inset-0 m-auto w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center" />
          </div>
          <div className="mt-6 w-full space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Skeleton variant="circular" className="w-2.5 h-2.5" />
                  <Skeleton variant="rounded" className="h-3.5 w-28" />
                </div>
                <Skeleton variant="rounded" className="h-3.5 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Roll Call Attendance Skeleton (3 cols) */}
      <div className="lg:col-span-3 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Skeleton variant="circular" className="w-5 h-5" />
            <Skeleton variant="rounded" className="h-5 w-60" />
          </div>
          <Skeleton variant="rounded" className="h-7 w-44 rounded-xl" />
        </div>
        <div className="p-6 h-[280px] w-full flex items-end gap-4 border-b border-slate-100">
          {[70, 85, 90, 82, 95, 78, 88].map((h, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <Skeleton
                variant="rounded"
                className="w-full rounded-t-lg"
                style={{ height: `${h}%` }}
              />
              <Skeleton variant="rounded" className="h-2.5 w-8" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

export default function DashboardPage() {
  const { profile } = useAuth();
  const [timeRange, setTimeRange] = useState<'Last 24 Hours' | 'Last 7 Days' | 'Last 30 Days'>('Last 24 Hours');
  const [isLoading, setIsLoading] = useState(true);

  // Active Shift State (Realtime)
  const [activeShift, setActiveShift] = useState<ActiveShiftInfo | null>(null);

  // Summary Metrics State
  const [todayLogsCount, setTodayLogsCount] = useState<number>(0);
  const [yesterdayLogsCount, setYesterdayLogsCount] = useState<number>(0);
  const [logsChangeStr, setLogsChangeStr] = useState<string>('0%');
  const [logsChangeType, setLogsChangeType] = useState<'positive' | 'negative' | 'neutral'>('neutral');

  const [totalFilesCount, setTotalFilesCount] = useState<number>(0);
  const [totalStorageStr, setTotalStorageStr] = useState<string>('0 KB');

  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);

  // Raw Database Data for Dynamic Charting
  const [allLogs, setAllLogs] = useState<ShiftLogRow[]>([]);
  const [reportTypes, setReportTypes] = useState<ReportTypeRow[]>([]);
  const [rollCallSessions, setRollCallSessions] = useState<RollCallSessionRow[]>([]);

  // ===========================================================================
  // 1. FETCH LIVE DATABASE DATA
  // ===========================================================================
  const fetchDashboardData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true);

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Thirty days ago filter for logs
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      // Parallel Queries to Supabase Tables
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
        supabase
          .from('archives')
          .select('id, file_size_bytes'),

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
          .select('id, session_date, session_time, present_count, absent_count, exempted_count, total_stations, created_at')
          .order('session_date', { ascending: false })
          .limit(7),

        // 8. Active Shift
        supabase
          .from('shifts')
          .select('id, shift_label, lead_officer_id, started_at')
          .eq('status', 'active')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      // --- Process Metric 1: Today's Logs ---
      const todayCount = todayLogsRes.count ?? 0;
      const yesterdayCount = yesterdayLogsRes.count ?? 0;
      setTodayLogsCount(todayCount);
      setYesterdayLogsCount(yesterdayCount);

      if (yesterdayCount === 0) {
        if (todayCount > 0) {
          setLogsChangeStr('+100%');
          setLogsChangeType('positive');
        } else {
          setLogsChangeStr('0%');
          setLogsChangeType('neutral');
        }
      } else {
        const diff = todayCount - yesterdayCount;
        const pct = Math.round((diff / yesterdayCount) * 100);
        if (pct > 0) {
          setLogsChangeStr(`+${pct}%`);
          setLogsChangeType('positive');
        } else if (pct < 0) {
          setLogsChangeStr(`${pct}%`);
          setLogsChangeType('negative');
        } else {
          setLogsChangeStr('0%');
          setLogsChangeType('neutral');
        }
      }

      // --- Process Metric 2: Total Files & Storage Size ---
      const archivesData = archivesRes.data || [];
      const totalFiles = archivesData.length;
      const totalBytes = archivesData.reduce((acc, row) => acc + (Number(row.file_size_bytes) || 0), 0);
      setTotalFilesCount(totalFiles);
      setTotalStorageStr(formatBytes(totalBytes));

      // --- Process Metric 3: Total Users ---
      const activeUsers = profilesRes.count ?? (profilesRes.data ? profilesRes.data.length : 1);
      setTotalUsersCount(Math.max(activeUsers, 1));

      // --- Process Active Shift ---
      const shiftData = activeShiftRes.data;
      if (shiftData) {
        let leadOfficerName = 'Lead Officer';
        if (shiftData.lead_officer_id) {
          const { data: leadProf } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', shiftData.lead_officer_id)
            .maybeSingle();
          if (leadProf?.full_name) {
            leadOfficerName = leadProf.full_name;
          }
        }
        setActiveShift({
          id: shiftData.id,
          shift_label: shiftData.shift_label,
          lead_officer_name: leadOfficerName,
          started_at: shiftData.started_at,
        });
      } else {
        setActiveShift(null);
      }

      // Store fetched lists
      setReportTypes(reportTypesRes.data || []);
      setAllLogs(recentLogsRes.data || []);
      setRollCallSessions(rollCallRes.data || []);
    } catch (err) {
      console.error('Error fetching dashboard Supabase metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial Load, Realtime Subscriptions & Background Polling Setup
  useEffect(() => {
    fetchDashboardData();

    // Setup Real-time Channel across operational tables & WebSocket broadcasts
    const channel = supabase
      .channel('pdrrmo-mls-live-logs', {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => fetchDashboardData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_logs' },
        () => fetchDashboardData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'archives' },
        () => fetchDashboardData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roll_call_sessions' },
        () => fetchDashboardData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchDashboardData(true)
      )
      .on('broadcast', { event: 'shift_logs_updated' }, () => {
        fetchDashboardData(true);
      })
      .on('broadcast', { event: 'shift_state_updated' }, () => {
        fetchDashboardData(true);
      })
      .subscribe();

    // 4-second continuous background auto-sync
    const syncInterval = setInterval(() => {
      fetchDashboardData(true);
    }, 4000);

    // Tab focus / visibility sync
    const handleVisibilitySync = () => {
      if (!document.hidden) {
        fetchDashboardData(true);
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
  }, [fetchDashboardData]);

  // ===========================================================================
  // 2. COMPUTED CHART DATA: LOG ACTIVITY TREND
  // ===========================================================================
  const activityTrendData: ActivityTrendPoint[] = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (timeRange === 'Last 24 Hours') {
      // 3-hour bucket intervals: 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00, 24:00
      const buckets = [
        { time: '00:00', start: 0, end: 3, logs: 0 },
        { time: '03:00', start: 3, end: 6, logs: 0 },
        { time: '06:00', start: 6, end: 9, logs: 0 },
        { time: '09:00', start: 9, end: 12, logs: 0 },
        { time: '12:00', start: 12, end: 15, logs: 0 },
        { time: '15:00', start: 15, end: 18, logs: 0 },
        { time: '18:00', start: 18, end: 21, logs: 0 },
        { time: '21:00', start: 21, end: 24, logs: 0 },
        { time: '24:00', start: 24, end: 24, logs: 0 },
      ];

      const relevantLogs = allLogs.filter((l) => l.log_date === todayStr);

      relevantLogs.forEach((log) => {
        const hour = parseLogHour(log.log_time, log.created_at);
        const bucket = buckets.find((b) => hour >= b.start && hour < b.end) || buckets[buckets.length - 2];
        if (bucket) bucket.logs += 1;
      });

      return buckets.map((b) => ({ time: b.time, logs: b.logs }));
    }

    if (timeRange === 'Last 7 Days') {
      const daysMap: Record<string, { label: string; logs: number }> = {};
      const result: ActivityTrendPoint[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
        daysMap[dateStr] = { label: dayLabel, logs: 0 };
      }

      allLogs.forEach((log) => {
        if (daysMap[log.log_date]) {
          daysMap[log.log_date].logs += 1;
        }
      });

      Object.keys(daysMap).forEach((dateStr) => {
        result.push({
          time: daysMap[dateStr].label,
          logs: daysMap[dateStr].logs,
        });
      });

      return result;
    }

    // Last 30 Days (Grouped into 6 5-day intervals)
    const result: ActivityTrendPoint[] = [];
    const intervalDays = 5;
    for (let i = 5; i >= 0; i--) {
      const endD = new Date();
      endD.setDate(endD.getDate() - i * intervalDays);
      const startD = new Date(endD);
      startD.setDate(startD.getDate() - intervalDays + 1);

      const label = `${startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      const logsInPeriod = allLogs.filter((l) => {
        const logD = new Date(l.log_date);
        return logD >= startD && logD <= endD;
      }).length;

      result.push({
        time: label,
        logs: logsInPeriod,
      });
    }

    return result;
  }, [allLogs, timeRange]);

  // ===========================================================================
  // 3. COMPUTED CHART DATA: LOG DISTRIBUTION (DONUT)
  // ===========================================================================
  const distributionData: DistributionItem[] = useMemo(() => {
    // Map report types to known colors
    const colorMap = new Map<string, string>();
    reportTypes.forEach((rt, idx) => {
      colorMap.set(rt.name.toLowerCase(), rt.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]);
    });

    const counts: Record<string, number> = {};
    allLogs.forEach((log) => {
      const typeName = log.report_type_name || 'General';
      counts[typeName] = (counts[typeName] || 0) + 1;
    });

    const total = allLogs.length;

    // If no logs yet, provide clean initial distribution based on defined report types
    if (total === 0) {
      if (reportTypes.length > 0) {
        return reportTypes.slice(0, 4).map((rt, idx) => ({
          name: rt.name,
          value: 0,
          color: rt.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
          count: 0,
        }));
      }
      return [
        { name: 'Security', value: 0, color: '#004AC6', count: 0 },
        { name: 'Natural Disaster', value: 0, color: '#E11D48', count: 0 },
        { name: 'Weather Disturbance', value: 0, color: '#60A5FA', count: 0 },
        { name: 'System Operations', value: 0, color: '#505F76', count: 0 },
      ];
    }

    const items: DistributionItem[] = Object.keys(counts).map((name, idx) => {
      const count = counts[name];
      const percentage = Math.round((count / total) * 100);
      const color =
        colorMap.get(name.toLowerCase()) ||
        DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      return {
        name,
        value: percentage,
        color,
        count,
      };
    });

    return items.sort((a, b) => b.count - a.count);
  }, [allLogs, reportTypes]);

  // ===========================================================================
  // 4. COMPUTED CHART DATA: ROLL CALL ATTENDANCE
  // ===========================================================================
  const { rollCallAttendanceData, rollCallDateRange } = useMemo(() => {
    if (rollCallSessions.length === 0) {
      // Clean 7-day fallback baseline if no sessions recorded yet
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const dateRangeStr = `${sevenDaysAgo.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} - ${today.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;

      const emptyData: RollCallAttendancePoint[] = days.map((d) => ({
        day: d,
        date: '',
        attendance: 0,
        stations: 0,
      }));

      return { rollCallAttendanceData: emptyData, rollCallDateRange: dateRangeStr };
    }

    // Sort chronologically ascending for chart
    const sorted = [...rollCallSessions].sort(
      (a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
    );

    const points: RollCallAttendancePoint[] = sorted.map((session) => {
      const total = session.total_stations || session.present_count + session.absent_count + session.exempted_count || 1;
      const pct = Math.min(100, Math.round((session.present_count / total) * 100));
      const dateObj = new Date(session.session_date);
      const dayName = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('en-US', { weekday: 'short' })
        : 'Session';

      return {
        day: dayName,
        date: session.session_date,
        attendance: pct,
        stations: session.total_stations || session.present_count,
      };
    });

    const firstDateObj = new Date(sorted[0].session_date);
    const lastDateObj = new Date(sorted[sorted.length - 1].session_date);

    const dateRangeStr = `${firstDateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} - ${lastDateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;

    return { rollCallAttendanceData: points, rollCallDateRange: dateRangeStr };
  }, [rollCallSessions]);

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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Header Info Status Bar */}
              <div className="flex items-center gap-2 flex-wrap">
                {activeShift ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                    </span>
                    Started by {activeShift.lead_officer_name || 'Lead Officer'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[#505F76] border border-slate-200 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    Shift Inactive
                  </span>
                )}

                {/* Assigned Schedule Info */}
                {profile?.default_shift && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-full">
                    <Info className="w-3 h-3 text-[#004AC6]" />
                    Assigned: <span className="font-semibold text-slate-700">{profile.default_shift}</span>
                  </span>
                )}
              </div>

              {/* ========================================================================= */}
              {/* 1. SUMMARY METRIC CARDS ROW */}
              {/* ========================================================================= */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Card 1: Today's Logs */}
                <SummaryCard
                  title="Today's Logs"
                  value={todayLogsCount.toLocaleString()}
                  change={logsChangeStr}
                  changeType={logsChangeType}
                  ambientColor="bg-[#004AC6]/5"
                  iconBg="bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15"
                  icon={<BarChart3 className="w-6 h-6" />}
                  subtitle={
                    yesterdayLogsCount > 0
                      ? `${yesterdayLogsCount} logs logged yesterday`
                      : 'Live shift incident entries'
                  }
                />

                {/* Card 2: Total Files */}
                <SummaryCard
                  title="Total Files"
                  value={totalFilesCount.toLocaleString()}
                  change={totalStorageStr}
                  changeType="neutral"
                  ambientColor="bg-[#505F76]/5"
                  iconBg="bg-slate-100 text-[#505F76] border border-slate-200"
                  icon={<Folder className="w-6 h-6" />}
                  subtitle="Encrypted PDF & DOCX archives"
                />

                {/* Card 3: Total Users */}
                <SummaryCard
                  title="Total Users"
                  value={totalUsersCount.toLocaleString()}
                  ambientColor="bg-[#943700]/5"
                  iconBg="bg-slate-100 text-[#505F76] border border-slate-200"
                  icon={<Users className="w-6 h-6" />}
                  subtitle="Registered emergency personnel"
                />
              </section>

              {/* ========================================================================= */}
              {/* 2. BENTO GRID CHARTS ROW */}
              {/* ========================================================================= */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Area Chart: Log Activity Trend (Spans 2 cols) */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.15 }}
                  className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden"
                >
                  {/* Chart Header */}
                  <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]/40">
                    <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
                      <Activity className="w-5 h-5 text-[#004AC6]" />
                      Log Activity Trend
                    </h3>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value as any)}
                      className="bg-white border border-[#E2E8F0] rounded-full px-3.5 py-1.5 text-xs font-medium text-[#505F76] focus:outline-none focus:border-[#004AC6] cursor-pointer shadow-2xs"
                    >
                      <option value="Last 24 Hours">Last 24 Hours</option>
                      <option value="Last 7 Days">Last 7 Days</option>
                      <option value="Last 30 Days">Last 30 Days</option>
                    </select>
                  </div>

                  {/* Area Chart Container */}
                  <div className="p-6 flex-1 min-h-[320px] w-full">
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart
                        data={activityTrendData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="logTrendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#004AC6" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#004AC6" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis
                          dataKey="time"
                          tickLine={false}
                          axisLine={{ stroke: '#E2E8F0' }}
                          tick={{ fill: '#757680', fontSize: 12 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#757680', fontSize: 12 }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '12px',
                            border: '1px solid #E2E8F0',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            fontSize: '12px',
                          }}
                          formatter={(val: any) => [`${val} Log Entries`, 'Volume']}
                        />
                        <Area
                          type="monotone"
                          dataKey="logs"
                          stroke="#004AC6"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#logTrendGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                {/* Distribution Donut Chart (Spans 1 col) */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 }}
                  className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden"
                >
                  {/* Chart Header */}
                  <div className="p-5 sm:p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/40 flex items-center justify-between">
                    <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
                      <PieIcon className="w-5 h-5 text-[#004AC6]" />
                      Log Distribution
                    </h3>
                    <span className="text-[11px] font-semibold text-[#757680] bg-slate-100 px-2 py-0.5 rounded-md">
                      {allLogs.length} Total
                    </span>
                  </div>

                  {/* Donut Chart Body */}
                  <div className="p-6 flex-1 flex flex-col items-center justify-center">
                    <div className="relative w-48 h-48 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={allLogs.length > 0 ? distributionData : [{ name: 'Empty', value: 100, color: '#E2E8F0', count: 0 }]}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={allLogs.length > 0 ? 4 : 0}
                            dataKey="value"
                          >
                            {(allLogs.length > 0 ? distributionData : [{ name: 'Empty', value: 100, color: '#E2E8F0', count: 0 }]).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center Badge */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                        <span className="text-xl font-bold text-[#1E293B]">
                          {allLogs.length > 0 ? `${allLogs.length}` : '0'}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-[#757680] font-semibold">
                          Total Logs
                        </span>
                      </div>
                    </div>

                    {/* Legend List */}
                    <div className="mt-6 w-full space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                      {distributionData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs font-medium">
                          <div className="flex items-center gap-2.5 truncate pr-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-[#505F76] truncate">{item.name}</span>
                          </div>
                          <span className="font-bold text-[#1E293B] shrink-0">
                            {item.value}% {item.count > 0 && <span className="font-normal text-[#757680] text-[10px]">({item.count})</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Net Roll Call Attendance Chart (Spans full 3 cols) */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.25 }}
                  className="lg:col-span-3 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden"
                >
                  {/* Header with Date Range */}
                  <div className="p-5 sm:p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Radio className="w-5 h-5 text-[#004AC6]" />
                      <h3 className="text-base font-bold text-[#1E293B]">
                        Net Roll Call Attendance Chart
                      </h3>
                      <span className="text-xs text-[#757680] font-normal hidden md:inline">
                        (Station Response Rate %)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#1E293B] shadow-2xs">
                      <Calendar className="w-4 h-4 text-[#505F76]" />
                      <span>{rollCallDateRange}</span>
                    </div>
                  </div>

                  {/* Chart Area */}
                  <div className="p-6 h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={rollCallAttendanceData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="netAttendanceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#004AC6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#004AC6" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" />
                        <XAxis
                          dataKey="day"
                          tickLine={false}
                          axisLine={{ stroke: '#E2E8F0' }}
                          tick={{ fill: '#757680', fontSize: 12 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#757680', fontSize: 12 }}
                          domain={[0, 100]}
                          unit="%"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '12px',
                            border: '1px solid #E2E8F0',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            fontSize: '12px',
                          }}
                          formatter={(val: any) => [`${val}% Attendance`, 'Station Response']}
                        />
                        <Area
                          type="monotone"
                          dataKey="attendance"
                          stroke="#004AC6"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#netAttendanceGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayoutShell>
  );
}
