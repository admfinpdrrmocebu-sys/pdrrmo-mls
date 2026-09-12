'use client';

import React from 'react';
import { Skeleton } from './skeleton';
import { twMerge } from 'tailwind-merge';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  className,
}: TableSkeletonProps) {
  return (
    <div className={twMerge('w-full divide-y divide-[#E2E8F0]', className)}>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center gap-4 py-4 px-6">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <div key={cIdx} className="flex-1">
              <Skeleton
                variant="rounded"
                className={`h-4 ${cIdx === 0 ? 'w-3/4' : cIdx === columns - 1 ? 'w-1/2 ml-auto' : 'w-2/3'}`}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export interface RollCallTableSkeletonProps {
  rowCount?: number;
  className?: string;
}

export function RollCallTableSkeleton({
  rowCount = 5,
  className,
}: RollCallTableSkeletonProps) {
  return (
    <div className={twMerge('w-full divide-y divide-[#E2E8F0] min-w-[720px]', className)}>
      {Array.from({ length: rowCount }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center py-3.5 px-6 animate-fadeIn transition-opacity"
          style={{ animationDelay: `${idx * 40}ms` }}
        >
          {/* LGU Code Circle + Text */}
          <div className="flex-1 flex items-center gap-3">
            <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
            <div className="space-y-1.5 flex-1 max-w-[140px]">
              <Skeleton variant="rounded" className="h-4 w-full" />
              <Skeleton variant="rounded" className="h-2.5 w-16" />
            </div>
          </div>

          {/* Radio Present */}
          <div className="w-20 flex justify-center">
            <Skeleton variant="circular" className="w-4 h-4" />
          </div>

          {/* Radio Absent */}
          <div className="w-20 flex justify-center">
            <Skeleton variant="circular" className="w-4 h-4" />
          </div>

          {/* Radio Exempt */}
          <div className="w-20 flex justify-center">
            <Skeleton variant="circular" className="w-4 h-4" />
          </div>

          {/* Weather Status Dropdown Pill */}
          <div className="w-44 px-2">
            <Skeleton variant="pill" className="h-8 w-full" />
          </div>

          {/* Port Status Dropdown Pill */}
          <div className="w-44 px-2">
            <Skeleton variant="pill" className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default TableSkeleton;
