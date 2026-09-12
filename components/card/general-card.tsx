'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { twMerge } from 'tailwind-merge';

export interface GeneralCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  title?: string;
  subtitle?: string;
  topAccentColor?: string;
  className?: string;
  contentClassName?: string;
}

/**
 * GeneralCard Component
 * =====================
 * Modern Fintech Precision card surface.
 * Pure white background, subtle 1px border (#E2E8F0), soft ambient shadow.
 */
export function GeneralCard({
  children,
  header,
  footer,
  title,
  subtitle,
  topAccentColor,
  className,
  contentClassName,
  ...props
}: GeneralCardProps) {
  const hasHeaderOrFooter = Boolean(header || title || footer);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={twMerge(
        'relative w-full rounded-2xl bg-white border border-[#E2E8F0] shadow-sm shadow-slate-200/50 overflow-hidden',
        !hasHeaderOrFooter && 'p-6',
        className
      )}
      {...props}
    >
      {/* Optional Top Accent Stripe */}
      {topAccentColor && (
        <div
          className="h-1 w-full"
          style={{ backgroundColor: topAccentColor }}
        />
      )}

      {/* Header / Title */}
      {(header || title) && (
        <div className="border-b border-[#E2E8F0] px-6 py-4">
          {header ? (
            header
          ) : (
            <div>
              {title && (
                <h3 className="text-base font-semibold text-[#1E293B]">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="mt-0.5 text-xs text-[#757680]">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Card Content */}
      {hasHeaderOrFooter ? (
        <div className={twMerge('p-6', contentClassName)}>{children}</div>
      ) : (
        children
      )}

      {/* Optional Footer */}
      {footer && (
        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC]/60 px-6 py-3.5">
          {footer}
        </div>
      )}
    </motion.div>
  );
}

export default GeneralCard;
