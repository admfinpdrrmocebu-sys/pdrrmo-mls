'use client';

import React from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  Loader2,
  Lock,
  Megaphone,
  User,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { Announcement } from './types';
import {
  AcknowledgmentAvatar,
  AcknowledgmentAvatarStack,
} from './announcement-card';

export interface AnnouncementViewModalProps {
  announcement: Announcement;
  canModify: boolean;
  isCreator: boolean;
  hasAcknowledged: boolean;
  isAcknowledging: boolean;
  onClose: () => void;
  onEdit: (item: Announcement) => void;
  onAcknowledge: (id: string) => void;
}

export function AnnouncementViewModal({
  announcement,
  canModify,
  isCreator,
  hasAcknowledged,
  isAcknowledging,
  onClose,
  onEdit,
  onAcknowledge,
}: AnnouncementViewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-[#E2E8F0] bg-slate-50/50">
          <div className="flex items-start gap-3 pr-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004AC6] flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#004AC6] uppercase tracking-wider">
                Official Announcement
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-[#1E293B] mt-0.5 leading-snug">
                {announcement.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#757680] hover:text-[#1E293B] p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          <div>
            <h4 className="text-xs font-bold text-[#757680] uppercase tracking-wider mb-2">
              Announcement Details
            </h4>
            <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
              <div
                className="text-sm text-[#334155] leading-relaxed space-y-2 [&_strong]:font-bold [&_b]:font-bold [&_strong]:text-[#0F172A] [&_b]:text-[#0F172A] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1 [&_p]:my-1"
                dangerouslySetInnerHTML={{ __html: announcement.sanitizedDescription }}
              />
            </div>
          </div>

          {/* Audit & Author Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-[#E2E8F0]/60 space-y-1">
              <span className="text-[#757680] font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#004AC6]" /> Posted by
              </span>
              <p className="font-bold text-[#1E293B] pl-5">{announcement.createdBy}</p>
              <p className="text-[11px] text-[#757680] pl-5 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3" /> {announcement.createdAt}
              </p>
            </div>

            {announcement.updatedBy && announcement.updatedAt ? (
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                <span className="text-[#004AC6] font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#004AC6]" /> Last Modified
                </span>
                <p className="font-bold text-[#1E293B] pl-5">
                  {announcement.updatedBy}
                </p>
                <p className="text-[11px] text-[#505F76] pl-5 mt-0.5">
                  {announcement.updatedAt}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-[#E2E8F0]/60 flex items-center text-[#757680]">
                <span className="text-[11px] italic">No revisions recorded</span>
              </div>
            )}
          </div>

          {/* Personnel Acknowledgment Section */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-[#E2E8F0]/70 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#004AC6]" />
                <span className="text-xs font-bold text-[#1E293B]">
                  Acknowledged by ({announcement.acknowledgments?.length || 0})
                </span>
              </div>
              <AcknowledgmentAvatarStack
                acknowledgments={announcement.acknowledgments}
                size="w-7 h-7"
              />
            </div>

            {announcement.acknowledgments && announcement.acknowledgments.length > 0 ? (
              <div className="pt-2 border-t border-slate-200/60 max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {announcement.acknowledgments.map((ack) => (
                  <div
                    key={ack.id}
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white border border-slate-200/60"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AcknowledgmentAvatar ack={ack} size="w-5 h-5" />
                      <span className="font-semibold text-[#1E293B] truncate">{ack.userName}</span>
                      <span className="text-[10px] text-[#505F76] bg-slate-100 px-1.5 py-0.5 rounded">
                        {ack.userRole || 'Personnel'}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#757680] shrink-0">{ack.createdAt}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#94A3B8] italic">
                No personnel have acknowledged this announcement yet.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-[#E2E8F0] bg-slate-50/50">
          <div className="flex items-center gap-2">
            {canModify ? (
              <SecondaryButton
                size="sm"
                pill
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                onClick={() => onEdit(announcement)}
              >
                Edit Announcement
              </SecondaryButton>
            ) : (
              <span className="text-xs text-[#757680] flex items-center gap-1">
                <Lock className="w-3 h-3" /> Read only access
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isCreator && (
              <button
                type="button"
                disabled={isAcknowledging || hasAcknowledged}
                onClick={() => {
                  if (!hasAcknowledged) {
                    onAcknowledge(announcement.id);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all select-none ${
                  hasAcknowledged
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default opacity-95'
                    : 'bg-[#004AC6] text-white hover:bg-[#003594] active:scale-95 cursor-pointer disabled:opacity-60 disabled:pointer-events-none'
                }`}
                title={
                  hasAcknowledged
                    ? 'You have acknowledged this announcement'
                    : 'Click to acknowledge reading this announcement'
                }
              >
                {isAcknowledging ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : hasAcknowledged ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                    <span>Acknowledged</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-white/90" />
                    <span>Acknowledge</span>
                  </>
                )}
              </button>
            )}

            <PrimaryButton
              size="md"
              pill
              onClick={onClose}
            >
              Close
            </PrimaryButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default AnnouncementViewModal;
