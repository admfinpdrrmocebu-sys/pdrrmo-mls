'use client';

import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { SecondaryButton } from '@/components/button';

export interface DeleteAnnouncementModalProps {
  deletingId: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteAnnouncementModal({
  deletingId,
  isSubmitting,
  onCancel,
  onConfirm,
}: DeleteAnnouncementModalProps) {
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
        <h3 className="text-base font-bold text-[#1E293B]">Delete Announcement?</h3>
        <p className="text-xs text-[#505F76] mt-1 mb-5">
          Are you sure you want to remove this bulletin? This action cannot be undone.
        </p>
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
            disabled={isSubmitting}
            onClick={() => void onConfirm(deletingId)}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-full shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Confirm Delete</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default DeleteAnnouncementModal;
