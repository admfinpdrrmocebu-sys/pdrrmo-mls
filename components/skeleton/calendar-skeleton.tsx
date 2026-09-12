'use client';

import React from 'react';
import { Skeleton } from './skeleton';
import { twMerge } from 'tailwind-merge';

export interface CalendarSkeletonProps {
  variant?: 'full' | 'compact' | 'personal';
  daysCount?: number;
  className?: string;
  hasToolbar?: boolean;
}

export function CalendarSkeleton({
  variant = 'full',
  daysCount = 35,
  className,
  hasToolbar = false,
}: CalendarSkeletonProps) {
  const isFull = variant === 'full';

  return (
    <div
      className={twMerge(
        'w-full flex flex-col',
        className
      )}
    >
      {/* Optional Toolbar Skeleton */}
      {hasToolbar && (
        <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white rounded-t-[1.75rem]">
          <div className="flex items-center gap-3">
            <Skeleton variant="pill" className="h-10 w-44 sm:w-52" />
            <Skeleton variant="pill" className="h-8 w-16" />
          </div>
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <Skeleton variant="pill" className="h-9 w-44 sm:w-52" />
            <Skeleton variant="pill" className="h-9 w-36 sm:w-44" />
          </div>
        </div>
      )}

      {/* 7-Column Day Headers */}
      <div className="grid grid-cols-7 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName) => (
          <div
            key={dayName}
            className="py-3 px-3 text-center text-xs font-bold text-[#505F76] uppercase tracking-wider border-r border-[#E2E8F0] last:border-r-0 flex justify-center"
          >
            <span className="hidden sm:inline">{dayName}</span>
            <span className="sm:hidden">{dayName.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      {/* Grid of Cells */}
      <div
        className={twMerge(
          'grid grid-cols-7 divide-y divide-[#E2E8F0]',
          isFull ? 'min-w-[840px]' : ''
        )}
      >
        {Array.from({ length: daysCount }).map((_, idx) => (
          <div
            key={idx}
            className={twMerge(
              'border-r border-[#E2E8F0] last:border-r-0 flex flex-col justify-between transition-all bg-white',
              isFull ? 'min-h-[140px] p-2 sm:p-2.5' : 'min-h-[85px] p-2'
            )}
          >
            {/* Header: Date Number + Pill */}
            <div className="flex items-center justify-between mb-1.5">
              <Skeleton variant="circular" className={isFull ? 'w-6 h-6' : 'w-5 h-5'} />
              {isFull && idx % 3 === 0 && (
                <Skeleton variant="pill" className="h-4 w-9" />
              )}
            </div>

            {/* Middle: Shift/Duty placeholders */}
            <div className="space-y-1.5 my-auto py-1">
              {idx % 4 === 1 ? (
                <Skeleton variant="rounded" className="h-4 w-14 bg-amber-100/70" />
              ) : idx % 3 === 0 ? (
                <>
                  <Skeleton variant="rounded" className="h-5 w-full rounded-lg" />
                  <Skeleton variant="rounded" className="h-5 w-4/5 rounded-lg" />
                </>
              ) : (
                <Skeleton variant="rounded" className="h-5 w-full rounded-lg" />
              )}
            </div>

            {/* Footer: Avatars row */}
            {isFull && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100/60 mt-1">
                <div className="flex -space-x-1">
                  <Skeleton variant="circular" className="w-5 h-5" />
                  <Skeleton variant="circular" className="w-5 h-5" />
                </div>
                <Skeleton variant="rounded" className="h-2.5 w-8" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PersonalCalendarSkeleton({
  daysCount = 35,
  className,
}: {
  daysCount?: number;
  className?: string;
}) {
  return (
    <div className={twMerge('grid grid-cols-7 gap-1.5', className)}>
      {Array.from({ length: daysCount }).map((_, idx) => (
        <div
          key={idx}
          className="min-h-[85px] p-2 rounded-2xl border border-[#E2E8F0] bg-white flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <Skeleton variant="circular" className="w-5 h-5" />
          </div>
          <div className="space-y-1 my-auto">
            {idx % 3 === 0 ? (
              <Skeleton variant="rounded" className="h-4 w-full rounded-md bg-blue-100/70" />
            ) : idx % 5 === 2 ? (
              <Skeleton variant="rounded" className="h-4 w-12 rounded-md bg-amber-100/70" />
            ) : (
              <Skeleton variant="rounded" className="h-4 w-3/4 rounded-md" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PersonnelGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 rounded-2xl border border-[#E2E8F0] bg-white shadow-xs space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" className="w-10 h-10 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton variant="rounded" className="h-4 w-28" />
              <Skeleton variant="rounded" className="h-3 w-16" />
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton variant="rounded" className="h-3 w-10" />
              <Skeleton variant="pill" className="h-4 w-14" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton variant="rounded" className="h-3 w-12" />
              <Skeleton variant="pill" className="h-4 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PersonalDayDetailSkeleton() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-xs space-y-5">
      <div className="pb-3 border-b border-[#E2E8F0] space-y-2">
        <Skeleton variant="rounded" className="h-6 w-40" />
        <Skeleton variant="rounded" className="h-3 w-28" />
      </div>
      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton variant="pill" className="h-5 w-20" />
          <Skeleton variant="pill" className="h-5 w-16" />
        </div>
        <Skeleton variant="rounded" className="h-5 w-32" />
        <Skeleton variant="rounded" className="h-3 w-48" />
      </div>
      <div className="space-y-3">
        <Skeleton variant="rounded" className="h-4 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50">
              <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton variant="rounded" className="h-3.5 w-24" />
                <Skeleton variant="rounded" className="h-2.5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CalendarSkeleton;
