'use client';

import React from 'react';
import { Skeleton } from './skeleton';
import { twMerge } from 'tailwind-merge';

export interface CardSkeletonProps {
  className?: string;
  hasHeader?: boolean;
  lines?: number;
}

export function CardSkeleton({
  className,
  hasHeader = true,
  lines = 3,
}: CardSkeletonProps) {
  return (
    <div
      className={twMerge(
        'bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-6 space-y-4',
        className
      )}
    >
      {hasHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" className="w-9 h-9" />
            <Skeleton variant="rounded" className="h-5 w-32" />
          </div>
          <Skeleton variant="circular" className="w-8 h-8" />
        </div>
      )}
      <div className="space-y-2.5 pt-2">
        {Array.from({ length: lines }).map((_, idx) => (
          <Skeleton
            key={idx}
            variant="rounded"
            className={`h-4 ${idx === lines - 1 ? 'w-2/3' : 'w-full'}`}
          />
        ))}
      </div>
    </div>
  );
}

export interface SummaryCardSkeletonProps {
  className?: string;
}

export function SummaryCardSkeleton({ className }: SummaryCardSkeletonProps) {
  return (
    <div
      className={twMerge(
        'bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-6 flex flex-col justify-between min-h-[160px] relative overflow-hidden',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" className="w-10 h-10" />
          <Skeleton variant="rounded" className="h-4 w-28" />
        </div>
        <Skeleton variant="pill" className="h-5 w-14" />
      </div>

      <div className="mt-4 space-y-2">
        <Skeleton variant="rounded" className="h-8 w-24" />
        <Skeleton variant="rounded" className="h-3 w-36" />
      </div>
    </div>
  );
}

export interface ChartCardSkeletonProps {
  className?: string;
  height?: number;
}

export function ChartCardSkeleton({
  className,
  height = 240,
}: ChartCardSkeletonProps) {
  return (
    <div
      className={twMerge(
        'bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-6 sm:p-7 space-y-6',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="rounded" className="h-5 w-40" />
          <Skeleton variant="rounded" className="h-3.5 w-60" />
        </div>
        <Skeleton variant="pill" className="h-8 w-28" />
      </div>

      <div
        className="w-full flex items-end gap-3 pt-4 border-b border-slate-100"
        style={{ height: `${height}px` }}
      >
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <Skeleton
              variant="rounded"
              className="w-full rounded-t-lg"
              style={{ height: `${25 + ((idx * 37) % 65)}%` }}
            />
            <Skeleton variant="rounded" className="h-2.5 w-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default CardSkeleton;
