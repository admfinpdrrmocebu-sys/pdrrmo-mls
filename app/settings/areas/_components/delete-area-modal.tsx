'use client';

import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { SecondaryButton } from '@/components/button';
import { AreaItem } from './types';

export interface DeleteAreaModalProps {
  area: AreaItem;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAreaModal({
  area,
  isSubmitting,
  onCancel,
  onConfirm,
}: DeleteAreaModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !isSubmitting && onCancel()}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden z-10 p-6 space-y-4"
      >
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="text-center space-y-1">
          <h3 className="text-base font-bold text-[#1E293B]">
            Delete Monitoring Area
          </h3>
          <p className="text-xs text-[#757680] leading-relaxed">
            Are you sure you want to remove{' '}
            <span className="font-bold text-[#1E293B]">
              &quot;{area.name}&quot;
            </span>
            ? This action will delete the area from the database.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <SecondaryButton
            type="button"
            size="md"
            pill
            disabled={isSubmitting}
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </SecondaryButton>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void onConfirm()}
            className="flex-1 py-2.5 px-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default DeleteAreaModal;
