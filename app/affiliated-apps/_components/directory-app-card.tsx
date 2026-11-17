'use client';

import React from 'react';
import { ArrowUpRight, ExternalLink, Lock, Pin } from 'lucide-react';
import { motion } from 'motion/react';
import type { CachedAffiliatedApp } from '@/lib/cache/screen-data-cache';
import { normalizeDisplayHost } from '@/app/settings/affiliated-apps/_components/types';
import { AppPreviewImage } from '@/app/settings/affiliated-apps/_components/app-preview-image';

interface DirectoryAppCardProps {
  app: CachedAffiliatedApp;
  variant?: 'pinned' | 'standard';
  isBrokenImage: boolean;
  skipInitialMotion: boolean;
  animationIndex: number;
  onImageError: (appId: string) => void;
}

export const DirectoryAppCard = React.memo(function DirectoryAppCard({
  app,
  variant = 'standard',
  isBrokenImage,
  skipInitialMotion,
  animationIndex,
  onImageError,
}: DirectoryAppCardProps) {
  const host = normalizeDisplayHost(app.appUrl);
  const isPinnedStyle = variant === 'pinned' || app.isPinned;

  return (
    <motion.a
      href={app.appUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={skipInitialMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: skipInitialMotion ? 0 : animationIndex * 0.04 }}
      whileHover={{ y: -4 }}
      className={`bg-white rounded-[1.5rem] border shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col justify-between group cursor-pointer ${
        isPinnedStyle
          ? 'pinned-app-card border-amber-300/90 hover:border-amber-400 ring-1 ring-amber-200/50'
          : 'border-[#E2E8F0] hover:border-[#004AC6]/40'
      }`}
    >
      <div>
        {/* Mini Browser Chrome Bar */}
        <div
          className={`h-8 bg-[#F8FAFC] border-b border-[#E2E8F0] px-3.5 flex items-center justify-between gap-2 ${
            isPinnedStyle ? 'pinned-app-card-bar' : ''
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 shrink-0" />
            <div className="ml-2 flex items-center gap-1 text-[11px] font-mono text-[#505F76] truncate">
              <Lock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
              <span className="truncate">{host}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {app.isPinned && (
              <span className="pinned-badge inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200/90">
                <Pin className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                Pinned
              </span>
            )}
            <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#004AC6] transition-colors shrink-0" />
          </div>
        </div>

        {/* 16:10 Snapped Website Picture */}
        <div className="relative w-full aspect-[16/10] bg-[#F1F5F9] overflow-hidden border-b border-[#E2E8F0]">
          <AppPreviewImage
            src={app.imageUrl}
            alt={app.name}
            host={host}
            isBroken={isBrokenImage}
            priority={variant === 'pinned'}
            onError={() => onImageError(app.id)}
          />

          {/* Hover Launch Pill */}
          <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 text-[#1E293B] text-xs font-bold shadow-lg">
              <span>Open Application</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#004AC6]" />
            </span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="p-5 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-[#1E293B] group-hover:text-[#004AC6] transition-colors truncate">
            {app.name}
          </h2>
          <p className="text-xs text-[#505F76] truncate mt-0.5 font-medium">
            {app.appUrl}
          </p>
        </div>

        <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] group-hover:bg-[#004AC6] group-hover:text-white flex items-center justify-center shrink-0 transition-all duration-200 shadow-2xs">
          <ArrowUpRight className="w-4.5 h-4.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </div>
      </div>
    </motion.a>
  );
});
