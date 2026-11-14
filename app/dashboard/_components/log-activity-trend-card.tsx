'use client';

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Activity } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  parseLogHour,
  type ActivityTrendPoint,
  type DashboardTimeRange,
  type ShiftLogRow,
} from './types';

interface LogActivityTrendCardProps {
  allLogs: ShiftLogRow[];
  timeRange: DashboardTimeRange;
  onTimeRangeChange: (value: DashboardTimeRange) => void;
  isDark: boolean;
  animateCharts: boolean;
}

export const LogActivityTrendCard = React.memo(function LogActivityTrendCard({
  allLogs,
  timeRange,
  onTimeRangeChange,
  isDark,
  animateCharts,
}: LogActivityTrendCardProps) {
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
        const bucket =
          buckets.find((b) => hour >= b.start && hour < b.end) ||
          buckets[buckets.length - 2];
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

      const label = `${startD.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`;

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

  return (
    <motion.div
      initial={animateCharts ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={animateCharts ? { duration: 0.35, delay: 0.15 } : { duration: 0 }}
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
          onChange={(e) => onTimeRangeChange(e.target.value as DashboardTimeRange)}
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
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? '#1E293B' : '#E2E8F0'}
            />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={{ stroke: isDark ? '#1E293B' : '#E2E8F0' }}
              tick={{ fill: isDark ? '#94A3B8' : '#757680', fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: isDark ? '#94A3B8' : '#757680', fontSize: 12 }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                color: isDark ? '#F1F5F9' : '#1E293B',
                borderRadius: '12px',
                border: isDark ? '1px solid #1E293B' : '1px solid #E2E8F0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                fontSize: '12px',
              }}
              formatter={(val) => [`${val ?? 0} Log Entries`, 'Volume']}
            />
            <Area
              type="monotone"
              dataKey="logs"
              stroke={isDark ? '#3B82F6' : '#004AC6'}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#logTrendGradient)"
              isAnimationActive={animateCharts}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
});
