'use client';

import React from 'react';
import { Users, Mail, Clock, TrendingUp } from 'lucide-react';

export function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="relative bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs overflow-hidden animate-pulse"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="h-4 w-28 bg-slate-200 rounded-md" />
            <div className="w-9 h-9 rounded-2xl bg-slate-200" />
          </div>
          <div className="flex items-end gap-4">
            <div className="h-10 w-16 bg-slate-200 rounded-lg" />
            <div className="h-6 w-24 bg-slate-200 rounded-full mb-1" />
          </div>
          <div className="mt-4 h-3 w-48 bg-slate-200 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export interface UsersSummaryCardsProps {
  isLoading: boolean;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingCount: number;
}

export const UsersSummaryCards = React.memo(function UsersSummaryCards({
  isLoading,
  totalUsers,
  activeUsers,
  inactiveUsers,
  pendingCount,
}: UsersSummaryCardsProps) {
  if (isLoading) {
    return <SummaryCardsSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Card 1: Total Users */}
      <div className="relative bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs overflow-hidden group hover:border-[#CBD5E1] transition-all">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#004AC6]/5 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out pointer-events-none" />
        <div className="flex justify-between items-start mb-3 relative z-10">
          <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider">
            Total Users
          </span>
          <div className="w-9 h-9 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-end gap-4 relative z-10">
          <span className="text-4xl sm:text-5xl font-extrabold text-[#1E293B] tracking-tight leading-none">
            {totalUsers}
          </span>
          <div className="flex items-center gap-1 bg-[#004AC6]/10 text-[#004AC6] px-3 py-1 rounded-full text-xs font-bold mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Live Sync
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-[#757680] font-medium relative z-10">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {activeUsers} Active
          </span>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            {inactiveUsers} Inactive
          </span>
        </div>
      </div>

      {/* Card 2: Pending Invitations */}
      <div className="relative bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs overflow-hidden group hover:border-[#CBD5E1] transition-all">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/5 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out pointer-events-none" />
        <div className="flex justify-between items-start mb-3 relative z-10">
          <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider">
            Pending Invitations (SMTP)
          </span>
          <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Mail className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-end gap-4 relative z-10">
          <span className="text-4xl sm:text-5xl font-extrabold text-[#1E293B] tracking-tight leading-none">
            {pendingCount}
          </span>
          <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/60 px-3 py-1 rounded-full text-xs font-bold mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Awaiting Onboarding
          </div>
        </div>
        <div className="mt-3 text-xs text-[#757680] font-medium relative z-10">
          Tokens remain active for 7 days until registered.
        </div>
      </div>
    </div>
  );
});
