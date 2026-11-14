'use client';

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  DEFAULT_COLORS,
  type DistributionItem,
  type ReportTypeRow,
  type ShiftLogRow,
} from './types';

interface LogDistributionCardProps {
  allLogs: ShiftLogRow[];
  reportTypes: ReportTypeRow[];
  isDark: boolean;
  animateCharts: boolean;
}

export const LogDistributionCard = React.memo(function LogDistributionCard({
  allLogs,
  reportTypes,
  isDark,
  animateCharts,
}: LogDistributionCardProps) {
  const distributionData: DistributionItem[] = useMemo(() => {
    const colorMap = new Map<string, string>();
    reportTypes.forEach((rt, idx) => {
      colorMap.set(
        rt.name.toLowerCase(),
        rt.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
      );
    });

    const counts: Record<string, number> = {};
    allLogs.forEach((log) => {
      const typeName = log.report_type_name || 'General';
      counts[typeName] = (counts[typeName] || 0) + 1;
    });

    const total = allLogs.length;

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

  const pieData = useMemo(
    () =>
      allLogs.length > 0
        ? distributionData
        : [
            {
              name: 'Empty',
              value: 100,
              color: isDark ? '#1E293B' : '#E2E8F0',
              count: 0,
            },
          ],
    [allLogs.length, distributionData, isDark]
  );

  return (
    <motion.div
      initial={animateCharts ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={animateCharts ? { duration: 0.35, delay: 0.2 } : { duration: 0 }}
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
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={allLogs.length > 0 ? 4 : 0}
                dataKey="value"
                stroke="none"
                isAnimationActive={animateCharts}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
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
            <div
              key={item.name}
              className="flex items-center justify-between text-xs font-medium"
            >
              <div className="flex items-center gap-2.5 truncate pr-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[#505F76] truncate">{item.name}</span>
              </div>
              <span className="font-bold text-[#1E293B] shrink-0">
                {item.value}%{' '}
                {item.count > 0 && (
                  <span className="font-normal text-[#757680] text-[10px]">
                    ({item.count})
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
});
