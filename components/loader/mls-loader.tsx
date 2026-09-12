'use client';

import React from 'react';
import { motion } from 'motion/react';
import { twMerge } from 'tailwind-merge';
import { ShieldAlert, Activity, Radio, Lock } from 'lucide-react';

export interface MLSLoaderProps {
  /** Size variant of the loader */
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
  /** Primary label displayed below the radar beacon */
  label?: string;
  /** Subtitle status / telemetry message */
  sublabel?: string;
  /** Center icon choice: 'radar' | 'shield' | 'lock' | 'activity' | 'dot' */
  iconVariant?: 'radar' | 'shield' | 'lock' | 'activity' | 'dot';
  /** Custom extra classes */
  className?: string;
}

/**
 * MLS Tactical Radar Loader
 * =========================
 * Minimalist, high-precision telemetry loader designed for PDRRMO MLS.
 * Combines smooth GPU-accelerated concentric radar sweeps, glowing pulse nodes,
 * and clean monospace telemetry indicators.
 */
export function MLSLoader({
  size = 'md',
  label = 'PDRRMO MLS',
  sublabel = 'INITIALIZING TELEMETRY...',
  iconVariant = 'radar',
  className,
}: MLSLoaderProps) {
  const isFullscreen = size === 'fullscreen';

  // Sizing definitions for radar rings
  const radarDimensions = {
    sm: 'w-12 h-12',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    fullscreen: 'w-28 h-28',
  }[size];

  const coreSize = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    fullscreen: 'w-9 h-9',
  }[size];

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    fullscreen: 'w-4.5 h-4.5',
  }[size];

  const content = (
    <div className={twMerge('flex flex-col items-center justify-center select-none', className)}>
      {/* 1. Radar Telemetry Graphic */}
      <div className={twMerge('relative flex items-center justify-center', radarDimensions)}>
        {/* Ambient Soft Glow Background */}
        <div className="absolute inset-0 rounded-full bg-[#004AC6]/10 blur-xl animate-pulse" />

        {/* Outer Circular Track with Cardinal Coordinate Ticks */}
        <div className="absolute inset-0 rounded-full border border-[#004AC6]/20">
          <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#004AC6] rounded-full" />
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#004AC6]/40 rounded-full" />
          <span className="absolute top-1/2 -left-0.5 -translate-y-1/2 w-1 h-1 bg-[#004AC6]/40 rounded-full" />
          <span className="absolute top-1/2 -right-0.5 -translate-y-1/2 w-1 h-1 bg-[#004AC6]/40 rounded-full" />
        </div>

        {/* Outer Rotating Radar Beam with Conic Gradient Sweep */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, rgba(0, 74, 198, 0.4) 0deg, rgba(0, 74, 198, 0) 65deg, transparent 360deg)',
          }}
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration: 2.4,
            ease: 'linear',
          }}
        />

        {/* Middle Counter-Rotating Dashed Orbit */}
        <motion.div
          className="absolute inset-2 rounded-full border border-dashed border-[#004AC6]/35"
          animate={{ rotate: -360 }}
          transition={{
            repeat: Infinity,
            duration: 8,
            ease: 'linear',
          }}
        />

        {/* Inner Concentric Pulse Ring */}
        <div className="absolute inset-5 rounded-full border border-[#004AC6]/25 animate-ping opacity-30" />

        {/* Center Glowing Beacon Node */}
        <div
          className={twMerge(
            'relative z-10 rounded-full bg-gradient-to-tr from-[#003594] to-[#004AC6] flex items-center justify-center text-white shadow-lg shadow-[#004AC6]/30 border border-white/20',
            coreSize
          )}
        >
          {iconVariant === 'shield' && <ShieldAlert className={iconSizes} />}
          {iconVariant === 'lock' && <Lock className={iconSizes} />}
          {iconVariant === 'activity' && <Activity className={iconSizes} />}
          {iconVariant === 'radar' && <Radio className={twMerge(iconSizes, 'animate-pulse')} />}
          {iconVariant === 'dot' && (
            <div className="w-2 h-2 rounded-full bg-white animate-ping" />
          )}
        </div>
      </div>

      {/* 2. Telemetry Status & Monospace Tracking Labels (omitted for size='sm') */}
      {size !== 'sm' && (
        <div className="mt-6 flex flex-col items-center text-center">
          {/* Main Title Badge */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#004AC6] animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-[#1E293B]">
              {label}
            </h3>
            <span className="w-1.5 h-1.5 rounded-full bg-[#004AC6] animate-pulse" />
          </div>

          {/* Subtitle Telemetry Line */}
          {sublabel && (
            <p className="text-[10px] font-mono font-medium text-[#505F76] tracking-widest mt-1.5 uppercase">
              {sublabel}
            </p>
          )}

          {/* Sleek Horizontal Micro-Progress Indicator */}
          <div className="w-32 h-[2px] bg-slate-200 rounded-full mt-3 overflow-hidden relative">
            <motion.div
              className="absolute top-0 bottom-0 w-12 bg-gradient-to-r from-transparent via-[#004AC6] to-transparent rounded-full"
              animate={{
                x: [-48, 128],
              }}
              transition={{
                repeat: Infinity,
                duration: 1.4,
                ease: 'easeInOut',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F8FAFC]/90 backdrop-blur-md transition-all">
        {content}
      </div>
    );
  }

  return content;
}

export default MLSLoader;
