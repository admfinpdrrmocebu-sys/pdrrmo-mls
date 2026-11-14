'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Clock,
  Edit2,
  FileText,
  Lock,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import type { ActiveShiftRecord, LogEntry } from './types';

function renderFormattedDescription(content: string) {
  if (!content) {
    return (
      <span className="text-[#757680] italic">
        No operational remarks recorded.
      </span>
    );
  }

  if (content.includes('<') && content.includes('>')) {
    return (
      <div
        className="text-sm text-[#1E293B] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:my-2 [&_b]:font-bold [&_strong]:font-bold"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  const lines = content.split('\n');
  return (
    <div className="space-y-1 text-sm text-[#1E293B]">
      {lines.map((line, lineIdx) => {
        const isBullet = line.trim().startsWith('•');
        const cleanLine = isBullet ? line.replace(/^\s*•\s*/, '') : line;
        const segments = cleanLine.split(/(\*\*.*?\*\*)/g);

        const renderedSegments = segments.map((seg, segIdx) => {
          if (seg.startsWith('**') && seg.endsWith('**')) {
            return (
              <strong key={segIdx} className="font-bold text-[#1E293B]">
                {seg.slice(2, -2)}
              </strong>
            );
          }
          return seg;
        });

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-2">
              <span className="text-[#004AC6] font-bold shrink-0 leading-relaxed">
                •
              </span>
              <span className="leading-relaxed flex-1">{renderedSegments}</span>
            </div>
          );
        }

        if (line.trim() === '') {
          return <div key={lineIdx} className="h-2" />;
        }

        return (
          <p key={lineIdx} className="leading-relaxed">
            {renderedSegments}
          </p>
        );
      })}
    </div>
  );
}

interface ViewLogModalProps {
  log: LogEntry;
  isShiftActive: boolean;
  activeShift: ActiveShiftRecord | null;
  isSubmitting: boolean;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (log: LogEntry) => void;
  onDelete: (id: string) => void;
}

export default function ViewLogModal({
  log,
  isShiftActive,
  activeShift,
  isSubmitting,
  canEdit,
  onClose,
  onEdit,
  onDelete,
}: ViewLogModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* View Drawer */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full sm:w-[480px] bg-white h-full shadow-2xl border-l border-[#E2E8F0] flex flex-col justify-between overflow-hidden z-10"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1E293B]">
                Incident Log Details
              </h2>
              <p className="text-xs text-[#757680] font-mono">{log.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Title Card */}
          <div className="bg-[#F8FAFC] rounded-2xl p-5 border border-[#E2E8F0] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                {log.reportType}
              </span>
            </div>
            <h3 className="text-xl font-bold text-[#1E293B] leading-snug">
              {log.title}
            </h3>
          </div>

          {/* Formatted Operational Description */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
              Operational Description
            </span>
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] leading-relaxed">
              {renderFormattedDescription(log.description)}
            </div>
          </div>

          {/* Timestamp & Operator Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs space-y-1">
              <div className="text-xs text-[#757680] font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#505F76]" /> Log Time
              </div>
              <div className="text-sm font-bold text-[#1E293B] font-mono">
                {log.time} · {log.date}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs space-y-1">
              <div className="text-xs text-[#757680] font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#505F76]" /> Operator
              </div>
              <div className="text-sm font-semibold text-[#1E293B] truncate">
                {log.operator}
              </div>
            </div>
          </div>

          {/* User's Shift & Duty Operations Details */}
          <div className="p-4.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#004AC6] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#004AC6]" /> Shift &amp; Duty
                Operations
              </span>
              {log.shiftStatus === 'active' ||
              (isShiftActive && activeShift?.id === log.shift_id) ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Shift
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-[#505F76] border border-slate-200">
                  <CheckCircle2 className="w-3 h-3 text-slate-500" />
                  Shift Ended
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="space-y-1">
                <span className="text-[#757680] font-medium block">
                  Duty Shift:
                </span>
                <span className="font-bold text-[#1E293B] block truncate">
                  {log.shiftLabel || log.operatorShift || 'Day Shift (Alpha)'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[#757680] font-medium block">
                  Shift Schedule:
                </span>
                <span className="font-bold text-[#1E293B] font-mono block">
                  {log.shiftStartTime && log.shiftEndTime
                    ? `${log.shiftStartTime} – ${log.shiftEndTime}`
                    : '06:00 – 14:00'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[#757680] font-medium block">
                  Recorded By:
                </span>
                <span className="font-semibold text-[#1E293B] block truncate">
                  {log.operator}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[#757680] font-medium block">
                  Designation:
                </span>
                <span className="font-medium text-[#505F76] block truncate">
                  {log.operatorRole || 'Monitoring Officer'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between gap-3">
          {canEdit ? (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onDelete(log.id)}
                className="px-4 py-2.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Delete Log
              </button>

              <PrimaryButton
                size="md"
                pill
                onClick={() => onEdit(log)}
                leftIcon={<Edit2 className="w-4 h-4" />}
                className="flex-1 justify-center"
              >
                Edit Log
              </PrimaryButton>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs text-[#757680] flex items-center gap-1.5 italic">
                <Lock className="w-3.5 h-3.5 text-[#94A3B8]" />
                Shift is ended (Log entries are locked)
              </span>
              <SecondaryButton size="sm" pill onClick={onClose}>
                Close
              </SecondaryButton>
            </div>
          )}
        </div>
      </motion.aside>
    </div>
  );
}
