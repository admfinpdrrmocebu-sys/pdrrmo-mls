'use client';

import React from 'react';
import { motion } from 'motion/react';
import { twMerge } from 'tailwind-merge';

export interface SummaryCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  iconBg?: string;
  subtitle?: string;
  isLive?: boolean;
  liveText?: string;
  ambientColor?: string;
  className?: string;
}

/**
 * SummaryCard Component
 * =====================
 * Extra rounded modern fintech summary card matching
 * 'MLS Dashboard - Refined Analytics' (Stitch ID: 16431745712621379672).
 *
 * Features:
 * - Ultra smooth `rounded-3xl` / `rounded-[1.75rem]` corners
 * - Circular `rounded-full` icon badge
 * - Ambient `rounded-bl-[100px]` corner glow
 * - High-contrast metrics and status pills
 */
export function SummaryCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  iconBg = 'bg-[#004AC6]/10 text-[#004AC6]',
  subtitle,
  isLive = false,
  liveText = 'Active Now',
  ambientColor = 'bg-[#004AC6]/5',
  className,
}: SummaryCardProps) {
  const changeColors = {
    positive: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
    negative: 'text-rose-700 bg-rose-50 border-rose-200/60',
    neutral: 'text-[#505F76] bg-slate-50 border-slate-200/60',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25 }}
      className={twMerge(
        'relative bg-white rounded-[1.75rem] p-6 sm:p-7 border border-[#E2E8F0]',
        'shadow-sm hover:shadow-md hover:border-[#CBD5E1] transition-all duration-200',
        'flex flex-col justify-between overflow-hidden group',
        className
      )}
    >
      {/* Ambient Top-Right Corner Shape (rounded-bl-[100px]) */}
      <div
        className={twMerge(
          'absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -mr-8 -mt-8',
          'transition-transform duration-300 group-hover:scale-110 pointer-events-none',
          ambientColor
        )}
      />

      <div className="flex items-start justify-between gap-4 relative z-10">
        <div>
          <h3 className="text-sm font-semibold text-[#505F76] tracking-tight">{title}</h3>
          <div className="mt-2.5 flex items-baseline gap-3">
            <span className="text-3xl font-bold tracking-tight text-[#1E293B]">
              {value}
            </span>

            {/* Change pill or live beacon */}
            {change && (
              <span
                className={twMerge(
                  'text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1',
                  changeColors[changeType]
                )}
              >
                {change}
              </span>
            )}

            {isLive && (
              <span className="text-xs font-semibold text-[#004AC6] bg-[#004AC6]/10 border border-[#004AC6]/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#004AC6] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#004AC6]" />
                </span>
                {liveText}
              </span>
            )}
          </div>
        </div>

        {/* Circular Icon Badge */}
        {icon && (
          <div
            className={twMerge(
              'w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-200 group-hover:scale-105',
              iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {subtitle && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#757680] relative z-10">
          <span>{subtitle}</span>
        </div>
      )}
    </motion.div>
  );
}

export default SummaryCard;

