'use client';

import React from 'react';
import { Skeleton } from '@/components/skeleton';

export function DashboardSummarySkeleton() {
  return (
    <div className="space-y-6">
      {/* Full-width Shift Status Card Skeleton */}
      <div className="w-full bg-white rounded-2xl sm:rounded-[1.75rem] p-4 sm:p-5 border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Skeleton variant="circular" className="w-12 h-12 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton variant="rounded" className="h-4 w-36" />
            <Skeleton variant="rounded" className="h-3 w-48" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Skeleton variant="pill" className="h-7 w-28" />
          <Skeleton variant="rounded" className="h-5 w-24" />
        </div>
      </div>

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
    </div>
  );
}

export function DashboardChartsSkeleton() {
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
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
              >
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
            <div
              key={idx}
              className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
            >
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
