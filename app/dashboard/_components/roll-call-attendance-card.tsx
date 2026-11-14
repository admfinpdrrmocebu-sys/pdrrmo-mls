'use client';

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Calendar, Radio } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { RollCallAttendancePoint, RollCallSessionRow } from './types';

interface RollCallAttendanceCardProps {
  rollCallSessions: RollCallSessionRow[];
  isDark: boolean;
  animateCharts: boolean;
}

export const RollCallAttendanceCard = React.memo(function RollCallAttendanceCard({
  rollCallSessions,
  isDark,
  animateCharts,
}: RollCallAttendanceCardProps) {
  const { rollCallAttendanceData, rollCallDateRange } = useMemo(() => {
    if (rollCallSessions.length === 0) {
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

    const sorted = [...rollCallSessions].sort(
      (a, b) =>
        new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
    );

    const points: RollCallAttendancePoint[] = sorted.map((session) => {
      const total =
        session.total_stations ||
        session.present_count + session.absent_count + session.exempted_count ||
        1;
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
    <motion.div
      initial={animateCharts ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={animateCharts ? { duration: 0.35, delay: 0.25 } : { duration: 0 }}
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
              <linearGradient
                id="netAttendanceGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#004AC6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#004AC6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              vertical={false}
              stroke={isDark ? '#1E293B' : '#E2E8F0'}
            />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={{ stroke: isDark ? '#1E293B' : '#E2E8F0' }}
              tick={{ fill: isDark ? '#94A3B8' : '#757680', fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: isDark ? '#94A3B8' : '#757680', fontSize: 12 }}
              domain={[0, 100]}
              unit="%"
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
              formatter={(val) => [`${val ?? 0}% Attendance`, 'Station Response']}
            />
            <Area
              type="monotone"
              dataKey="attendance"
              stroke={isDark ? '#3B82F6' : '#004AC6'}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#netAttendanceGradient)"
              isAnimationActive={animateCharts}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
});
