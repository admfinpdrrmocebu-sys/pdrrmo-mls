'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  Loader2,
  Lock,
  Trash2,
  User,
} from 'lucide-react';
import { GeneralCard } from '@/components/card';
import {
  Announcement,
  AnnouncementAcknowledgment,
  getAvatarColorClass,
  getInitials,
} from './types';

// Single profile avatar circle with image and initials fallback
export const AcknowledgmentAvatar = React.memo(function AcknowledgmentAvatar({
  ack,
  size = 'w-7 h-7',
}: {
  ack: AnnouncementAcknowledgment;
  size?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(ack.userName);
  const colorClass = getAvatarColorClass(ack.userId || ack.userName);

  if (ack.userAvatarUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ack.userAvatarUrl}
        alt={ack.userName}
        onError={() => setImgError(true)}
        title={`${ack.userName} (${ack.userRole || 'Officer'}) · ${ack.createdAt}`}
        className={`${size} rounded-full object-cover border-2 border-white ring-1 ring-slate-200/80 shadow-2xs shrink-0 select-none`}
      />
    );
  }

  return (
    <div
      title={`${ack.userName} (${ack.userRole || 'Officer'}) · ${ack.createdAt}`}
      className={`${size} rounded-full font-bold text-[10px] flex items-center justify-center border-2 border-white ring-1 ring-slate-200/80 shadow-2xs shrink-0 select-none text-white ${colorClass}`}
    >
      {initials}
    </div>
  );
});

// Overlapped avatar stack: max 3 avatars + 4th circle with +count
export const AcknowledgmentAvatarStack = React.memo(function AcknowledgmentAvatarStack({
  acknowledgments,
  size = 'w-7 h-7',
}: {
  acknowledgments: AnnouncementAcknowledgment[];
  size?: string;
}) {
  if (!acknowledgments || acknowledgments.length === 0) {
    return <span className="text-xs text-[#94A3B8] italic">No acknowledgments yet</span>;
  }

  const visibleAcks = acknowledgments.slice(0, 3);
  const remainingCount = acknowledgments.length - 3;
  const remainingNames = acknowledgments
    .slice(3)
    .map((a) => a.userName)
    .join(', ');

  return (
    <div className="flex items-center -space-x-2 overflow-visible">
      {visibleAcks.map((ack) => (
        <AcknowledgmentAvatar key={ack.id} ack={ack} size={size} />
      ))}

      {remainingCount > 0 && (
        <div
          title={`+${remainingCount} more: ${remainingNames}`}
          className={`${size} rounded-full bg-slate-100 border-2 border-white ring-1 ring-slate-200/80 text-[#004AC6] font-bold text-[10px] flex items-center justify-center shadow-2xs shrink-0 cursor-default select-none`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
});

export interface AnnouncementCardProps {
  item: Announcement;
  isOwner: boolean;
  isCreator: boolean;
  hasAcknowledged: boolean;
  isAcknowledging: boolean;
  onView: (item: Announcement) => void;
  onEdit: (item: Announcement) => void;
  onDeleteRequest: (id: string) => void;
  onAcknowledge: (id: string) => void;
}

export const AnnouncementCard = React.memo(function AnnouncementCard({
  item,
  isOwner,
  isCreator,
  hasAcknowledged,
  isAcknowledging,
  onView,
  onEdit,
  onDeleteRequest,
  onAcknowledge,
}: AnnouncementCardProps) {
  return (
    <GeneralCard
      className="p-5 sm:p-6 border-[#E2E8F0] shadow-xs hover:border-[#CBD5E1] transition-all cursor-pointer group"
      onClick={() => onView(item)}
    >
      <div className="flex flex-col gap-3">
        {/* Header Row: Title & Action Controls */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-base sm:text-lg font-bold text-[#1E293B] group-hover:text-[#004AC6] transition-colors tracking-tight">
              {item.title}
            </h2>
          </div>

          {/* Action Buttons (Only for creator or Admin) */}
          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  title="Edit Announcement"
                  className="p-2 text-[#505F76] hover:text-[#004AC6] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRequest(item.id)}
                  title="Delete Announcement"
                  className="p-2 text-[#505F76] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <span
                title="Read only: Created by another officer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#757680] bg-slate-100 px-2.5 py-0.5 rounded-full"
              >
                <Lock className="w-3 h-3" />
                <span>Read only</span>
              </span>
            )}
          </div>
        </div>

        {/* Rich Formatted Preview Description */}
        <div>
          <div
            className="text-sm text-[#334155] leading-relaxed line-clamp-3 space-y-1 [&_strong]:font-bold [&_b]:font-bold [&_strong]:text-[#0F172A] [&_b]:text-[#0F172A] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_p]:my-0.5"
            dangerouslySetInnerHTML={{ __html: item.sanitizedDescription }}
          />
          {item.isTruncated && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onView(item);
              }}
              className="mt-2 text-xs font-semibold text-[#004AC6] hover:text-[#003594] transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              Read full announcement →
            </button>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 mt-1 border-t border-[#F1F5F9] text-xs text-[#757680]">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#004AC6]" />
            <span>
              Created by <strong className="text-[#1E293B] font-semibold">{item.createdBy}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#757680]" />
            <span>{item.createdAt}</span>
          </div>

          {item.updatedBy && item.updatedAt && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#004AC6] font-medium bg-blue-50 px-2.5 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />
              <span>
                Updated by {item.updatedBy} · {item.updatedAt}
              </span>
            </div>
          )}
        </div>

        {/* Acknowledgment Section */}
        <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-[#F1F5F9]">
          <div
            className="flex items-center gap-2 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs font-semibold text-[#505F76] shrink-0">
              Acknowledge by:
            </span>
            <AcknowledgmentAvatarStack
              acknowledgments={item.acknowledgments}
              size="w-7 h-7"
            />
          </div>

          {!isCreator && (
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                disabled={isAcknowledging || hasAcknowledged}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasAcknowledged) {
                    onAcknowledge(item.id);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all select-none ${
                  hasAcknowledged
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/90 cursor-default opacity-95'
                    : 'bg-[#004AC6] text-white hover:bg-[#003594] hover:shadow-xs active:scale-95 cursor-pointer disabled:opacity-60 disabled:pointer-events-none'
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
            </div>
          )}
        </div>
      </div>
    </GeneralCard>
  );
});
