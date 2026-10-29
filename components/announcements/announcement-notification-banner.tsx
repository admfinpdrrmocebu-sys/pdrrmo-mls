'use client';

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Megaphone, X, ArrowRight, Bell } from 'lucide-react';

export interface AnnouncementBannerData {
  id: string;
  title: string;
  description: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
}

interface AnnouncementNotificationBannerProps {
  announcement: AnnouncementBannerData;
  onView: (id: string) => void;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function AnnouncementNotificationBanner({
  announcement,
  onView,
  onDismiss,
  autoDismissMs = 8000,
}: AnnouncementNotificationBannerProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissMs]);

  // Strip html tags or markdown symbols from preview
  const cleanSnippet = (announcement.description || '')
    .replace(/<[^>]*>?/gm, '')
    .replace(/[*_#`~]/g, '')
    .trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: -40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.95 }}
      transition={{ type: 'spring', damping: 24, stiffness: 300 }}
      className="fixed top-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 pointer-events-auto"
      role="alert"
      aria-live="assertive"
    >
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-blue-200/90 dark:border-blue-800/80 rounded-2xl shadow-2xl shadow-blue-950/15 p-4 flex flex-col gap-3 relative overflow-hidden ring-1 ring-blue-500/10">
        {/* Top Accent Stripe with Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#004AC6] via-sky-400 to-[#004AC6]" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Animated Pulsing Icon */}
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200/80 dark:border-blue-800 text-[#004AC6] dark:text-sky-400 flex items-center justify-center shrink-0 relative">
              <Megaphone className="w-4 h-4 animate-bounce" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900 animate-ping" />
            </div>

            <div className="min-w-0">
              <span className="text-[10px] font-bold text-[#004AC6] dark:text-sky-400 uppercase tracking-wider block">
                Official Announcement
              </span>
              <h4 className="text-sm font-bold text-[#1E293B] dark:text-white truncate mt-0.5">
                {announcement.title}
              </h4>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#757680] hover:text-[#1E293B] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Snippet Preview */}
        {cleanSnippet && (
          <p className="text-xs text-[#505F76] dark:text-slate-300 line-clamp-2 pl-0.5 leading-relaxed">
            {cleanSnippet}
          </p>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[10px] text-[#757680] truncate">
            {announcement.createdByName ? `By ${announcement.createdByName}` : 'Just now'}
          </span>

          <button
            type="button"
            onClick={() => onView(announcement.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#004AC6] hover:bg-[#003594] text-white text-xs font-bold transition-all shadow-xs cursor-pointer group"
          >
            <span>View Bulletin</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Progress Countdown Bar */}
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: autoDismissMs / 1000, ease: 'linear' }}
          className="absolute bottom-0 left-0 h-0.5 bg-[#004AC6]/40"
        />
      </div>
    </motion.div>
  );
}
