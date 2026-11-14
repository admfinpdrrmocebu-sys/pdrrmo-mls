'use client';

import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SecondaryButton } from '@/components/button';
import { UserAvatar } from './user-avatar';
import type { UserAccount } from './types';

export interface DeleteUserModalProps {
  isOpen: boolean;
  deletingUser: UserAccount | null;
  onClose: () => void;
  onConfirmDelete: () => void;
}

export default function DeleteUserModal({
  isOpen,
  deletingUser,
  onClose,
  onConfirmDelete,
}: DeleteUserModalProps) {
  return (
    <AnimatePresence>
      {isOpen && deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden z-10"
          >
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-[#1E293B]">Remove User Account?</h3>
                <p className="text-xs text-[#505F76] mt-1.5 leading-relaxed">
                  Are you sure you want to remove{' '}
                  <strong className="text-[#1E293B] font-semibold">{deletingUser.name}</strong> (
                  {deletingUser.email})? This will revoke terminal credentials immediately.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-left">
                <UserAvatar user={deletingUser} size="md" showStatus />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#1E293B] truncate">{deletingUser.name}</p>
                  <p className="text-[11px] text-[#757680] font-mono truncate">
                    {deletingUser.email}
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-[#505F76]">
                  {deletingUser.position}
                </span>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <SecondaryButton size="md" pill onClick={onClose}>
                  Cancel
                </SecondaryButton>

                <button
                  type="button"
                  onClick={onConfirmDelete}
                  className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Removal</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
