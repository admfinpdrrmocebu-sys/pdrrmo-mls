'use client';

import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { SecondaryButton } from '@/components/button';

export interface DeleteAnnouncementTarget {
  id: string;
  title: string;
}

export interface DeleteAnnouncementModalProps {
  targets: DeleteAnnouncementTarget[];
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAnnouncementModal({
  targets,
  isSubmitting,
  onCancel,
  onConfirm,
}: DeleteAnnouncementModalProps) {
  const isBatch = targets.length > 1;
  const count = targets.length;
  const visiblePreview = targets.slice(0, 5);
  const remainingCount = Math.max(0, count - visiblePreview.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-sm p-6 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#1E293B]">
          {isBatch
            ? `Delete ${count} Selected Announcements?`
            : 'Delete Announcement?'}
        </h3>
        <p className="text-xs text-[#505F76] mt-1 mb-4">
          {isBatch
            ? `Are you sure you want to permanently remove these ${count} bulletins? This action cannot be undone.`
            : 'Are you sure you want to remove this bulletin? This action cannot be undone.'}
        </p>

        {count > 0 && (
          <div className="mb-5 text-left rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 max-h-36 overflow-y-auto space-y-1.5">
            {visiblePreview.map((item) => (
              <div
                key={item.id}
                className="text-xs font-semibold text-[#1E293B] truncate flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span className="truncate">{item.title}</span>
              </div>
            ))}
            {remainingCount > 0 && (
              <p className="text-[11px] font-medium text-[#757680] pl-3.5">
                +{remainingCount} more selected bulletin{remainingCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-2.5">
          <SecondaryButton
            size="md"
            pill
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </SecondaryButton>
          <button
            type="button"
            disabled={isSubmitting || count === 0}
            onClick={() => void onConfirm()}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-full shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>
                {isBatch ? `Confirm Delete (${count})` : 'Confirm Delete'}
              </span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default DeleteAnnouncementModal;
