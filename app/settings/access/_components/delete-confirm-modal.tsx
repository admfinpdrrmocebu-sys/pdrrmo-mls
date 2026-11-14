'use client';

import React from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { SecondaryButton } from '@/components/button';

export interface DeleteConfirmModalProps {
  kind: 'role' | 'shift';
  itemName: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmModal({
  kind,
  itemName,
  isSubmitting,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-6 max-w-md w-full z-10 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1E293B]">
              {kind === 'role' ? 'Delete User Role' : 'Delete Shift Schedule'}
            </h3>
            <p className="text-xs text-[#757680]">
              This action cannot be undone.
            </p>
          </div>
        </div>
        <p className="text-sm text-[#505F76]">
          Are you sure you want to delete{' '}
          <span className="font-bold text-[#1E293B]">&quot;{itemName}&quot;</span>
          ?
        </p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <SecondaryButton
            size="sm"
            pill
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </SecondaryButton>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isSubmitting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>Delete</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default DeleteConfirmModal;
