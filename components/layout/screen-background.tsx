'use client';

import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ScreenBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  variant?: 'default' | 'login' | 'dashboard' | 'subtle';
  withGrid?: boolean;
  withGlow?: boolean;
  className?: string;
}

/**
 * ScreenBackground Component
 * ==========================
 * Standardized background wrapper inspired by Google Stitch (ID: 16431745712621379672)
 * 'MLS Login - Modern Fintech Style' and 'MLS Insight Monitor'.
 *
 * Provides:
 * 1. Base cool canvas (#F8FAFC)
 * 2. 40px x 40px precision fintech engineering grid
 * 3. Subtle ambient radial lighting with primary (#004AC6) tints
 */
export function ScreenBackground({
  children,
  variant = 'default',
  withGrid = true,
  withGlow = true,
  className,
  ...props
}: ScreenBackgroundProps) {
  return (
    <div
      className={twMerge(
        'relative min-h-screen w-full bg-[#F8FAFC] text-[#1E293B] overflow-x-hidden',
        className
      )}
      {...props}
    >
      {/* 1. Precision Grid Layer (40px x 40px) */}
      {withGrid && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 opacity-100"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(0, 74, 198, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 74, 198, 0.04) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            backgroundAttachment: 'fixed',
          }}
        />
      )}

      {/* 2. Ambient Radial Lighting / Glows */}
      {withGlow && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        >
          {/* Top Center Primary Ambient Glow */}
          <div
            className="absolute -top-[20%] left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full opacity-60 blur-3xl pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(0, 74, 198, 0.08), rgba(0, 74, 198, 0.02) 50%, transparent 70%)',
            }}
          />

          {/* Bottom Right Secondary Accent Glow for Depth */}
          <div
            className="absolute -bottom-[15%] -right-[10%] h-[500px] w-[600px] rounded-full opacity-40 blur-3xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(80, 95, 118, 0.06), transparent 70%)',
            }}
          />
        </div>
      )}

      {/* 3. Screen Content Wrapper */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {children}
      </div>
    </div>
  );
}

export default ScreenBackground;
