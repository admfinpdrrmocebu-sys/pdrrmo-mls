'use client';

import React from 'react';
import {
  ExternalLink,
  Edit2,
  Trash2,
  Check,
  Copy,
  Camera,
  Globe,
  Lock,
  Loader2,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  AffiliatedAppRecord,
  formatUpdatedDate,
  normalizeDisplayHost,
} from './types';

interface AffiliatedAppCardProps {
  app: AffiliatedAppRecord;
  canModify: boolean;
  isCopied: boolean;
  isResnapping: boolean;
  isBrokenImage: boolean;
  skipInitialMotion: boolean;
  animationIndex: number;
  onImageError: (appId: string) => void;
  onCopyUrl: (app: AffiliatedAppRecord) => void;
  onToggleActive: (app: AffiliatedAppRecord) => void;
  onResnap: (app: AffiliatedAppRecord) => void;
  onEdit: (app: AffiliatedAppRecord) => void;
  onDelete: (app: AffiliatedAppRecord) => void;
}

export const AffiliatedAppCard = React.memo(function AffiliatedAppCard({
  app,
  canModify,
  isCopied,
  isResnapping,
  isBrokenImage,
  skipInitialMotion,
  animationIndex,
  onImageError,
  onCopyUrl,
  onToggleActive,
  onResnap,
  onEdit,
  onDelete,
}: AffiliatedAppCardProps) {
  const host = normalizeDisplayHost(app.appUrl);

  return (
    <motion.div
      initial={skipInitialMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: skipInitialMotion ? 0 : animationIndex * 0.04 }}
      className="bg-white rounded-[1.5rem] border border-[#E2E8F0] hover:border-[#CBD5E1] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between group"
    >
      <div>
        {/* Mini Browser Chrome Header */}
        <div className="h-8 bg-[#F8FAFC] border-b border-[#E2E8F0] px-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 shrink-0" />
            <div className="ml-2 flex items-center gap-1 text-[11px] font-mono text-[#505F76] truncate">
              <Lock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
              <span className="truncate">{host}</span>
            </div>
          </div>

          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
              app.isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {app.isActive ? 'Published' : 'Hidden'}
          </span>
        </div>

        {/* 16:10 Saved Picture Frame */}
        <div className="relative w-full aspect-[16/10] bg-[#F1F5F9] overflow-hidden border-b border-[#E2E8F0]">
          {app.imageUrl && !isBrokenImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={app.imageUrl}
              alt={`${app.name} preview`}
              onError={() => onImageError(app.id)}
              className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#757680] p-4 text-center">
              <Globe className="w-8 h-8 text-[#004AC6]/60" />
              <span className="text-xs font-semibold text-[#505F76] truncate max-w-full">
                {host}
              </span>
            </div>
          )}

          {isResnapping && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white p-4">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span className="text-xs font-semibold">
                Snapping fresh picture...
              </span>
            </div>
          )}

          {/* Hover Quick Open Overlay */}
          <a
            href={app.appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/25 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
          >
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 text-[#1E293B] text-xs font-bold shadow-lg">
              <span>Open Web App</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#004AC6]" />
            </span>
          </a>
        </div>

        {/* App Name & Link Body */}
        <div className="p-5 pb-3 space-y-2">
          <h3 className="text-base font-bold text-[#1E293B] truncate">
            {app.name}
          </h3>

          <div className="flex items-center justify-between gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2">
            <a
              href={app.appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[#004AC6] hover:underline truncate flex-1"
              title={app.appUrl}
            >
              {app.appUrl}
            </a>
            <button
              type="button"
              onClick={() => onCopyUrl(app)}
              className="text-[#757680] hover:text-[#1E293B] transition-colors shrink-0 cursor-pointer"
              title="Copy App Link"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Card Footer Controls */}
      <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC]/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {canModify ? (
            <button
              type="button"
              onClick={() => onToggleActive(app)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#505F76] hover:text-[#1E293B] cursor-pointer"
              title={
                app.isActive
                  ? 'Click to hide from Affiliated Apps directory'
                  : 'Click to publish to Affiliated Apps directory'
              }
            >
              <div
                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex items-center ${
                  app.isActive
                    ? 'bg-[#004AC6] justify-end'
                    : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-white shadow-2xs" />
              </div>
              <span>{app.isActive ? 'Visible' : 'Hidden'}</span>
            </button>
          ) : (
            <span className="text-[11px] text-[#757680] font-medium">
              Updated {formatUpdatedDate(app.updatedAt)}
            </span>
          )}
        </div>

        {canModify && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onResnap(app)}
              disabled={isResnapping}
              title="Re-snap Live Picture"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:text-[#004AC6] hover:bg-[#004AC6]/10 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(app)}
              title="Edit Affiliated App"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:text-[#004AC6] hover:bg-[#004AC6]/10 transition-colors cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(app)}
              title="Delete Affiliated App"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});
