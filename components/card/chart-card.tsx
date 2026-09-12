'use client';

import React from 'react';
import { motion } from 'motion/react';
import { twMerge } from 'tailwind-merge';

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
}: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={twMerge(
        'rounded-2xl bg-white border border-[#E2E8F0] p-6 shadow-sm shadow-slate-200/40 flex flex-col',
        className
      )}
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h4 className="text-base font-semibold text-[#1E293B]">{title}</h4>
          {subtitle && <p className="text-xs text-[#757680] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="flex-1 w-full">{children}</div>
    </motion.div>
  );
}

export default ChartCard;
