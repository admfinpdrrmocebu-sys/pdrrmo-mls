'use client';

import React from 'react';
import { BarChart3, Folder, Users } from 'lucide-react';
import { SummaryCard } from '@/components/card';

export interface DashboardSummarySectionProps {
  todayLogsCount: number;
  yesterdayLogsCount: number;
  logsChangeStr: string;
  logsChangeType: 'positive' | 'negative' | 'neutral';
  totalFilesCount: number;
  totalStorageStr: string;
  totalUsersCount: number;
}

const LOGS_ICON = <BarChart3 className="w-6 h-6" />;
const FILES_ICON = <Folder className="w-6 h-6" />;
const USERS_ICON = <Users className="w-6 h-6" />;

export const DashboardSummarySection = React.memo(function DashboardSummarySection({
  todayLogsCount,
  yesterdayLogsCount,
  logsChangeStr,
  logsChangeType,
  totalFilesCount,
  totalStorageStr,
  totalUsersCount,
}: DashboardSummarySectionProps) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <SummaryCard
        title="Today's Logs"
        value={todayLogsCount.toLocaleString()}
        change={logsChangeStr}
        changeType={logsChangeType}
        ambientColor="bg-[#004AC6]/5"
        iconBg="bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15"
        icon={LOGS_ICON}
        subtitle={
          yesterdayLogsCount > 0
            ? `${yesterdayLogsCount} logs logged yesterday`
            : 'Live shift incident entries'
        }
      />

      <SummaryCard
        title="Total Files"
        value={totalFilesCount.toLocaleString()}
        change={totalStorageStr}
        changeType="neutral"
        ambientColor="bg-[#505F76]/5"
        iconBg="bg-slate-100 text-[#505F76] border border-slate-200"
        icon={FILES_ICON}
        subtitle="Encrypted PDF & DOCX archives"
      />

      <SummaryCard
        title="Total Users"
        value={totalUsersCount.toLocaleString()}
        ambientColor="bg-[#943700]/5"
        iconBg="bg-slate-100 text-[#505F76] border border-slate-200"
        icon={USERS_ICON}
        subtitle="Registered emergency personnel"
      />
    </section>
  );
});
