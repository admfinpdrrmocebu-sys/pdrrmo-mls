'use client';

import React from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, type CustomDropdownOption } from '@/components/input';
import { UserAvatar } from './user-avatar';
import type { UserAccount } from './types';

export interface EditUserModalProps {
  isOpen: boolean;
  editingUser: UserAccount | null;
  isSavingEdit: boolean;
  editName: string;
  editEmail: string;
  editPosition: string;
  editShift: string;
  editStatus: 'Active' | 'Inactive';
  positionOptions: CustomDropdownOption[];
  shiftScheduleOptions: CustomDropdownOption[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onNameChange: (val: string) => void;
  onSelectPosition: (val: string, label: string) => void;
  onSelectShift: (val: string) => void;
  onToggleStatus: () => void;
}

export default function EditUserModal({
  isOpen,
  editingUser,
  isSavingEdit,
  editName,
  editEmail,
  editPosition,
  editShift,
  editStatus,
  positionOptions,
  shiftScheduleOptions,
  onClose,
  onSubmit,
  onNameChange,
  onSelectPosition,
  onSelectShift,
  onToggleStatus,
}: EditUserModalProps) {
  return (
    <AnimatePresence>
      {isOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isSavingEdit && onClose()}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-visible z-10"
          >
            <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center rounded-t-3xl">
              <div className="flex items-center gap-3.5">
                <UserAvatar user={editingUser} size="lg" showStatus />
                <div>
                  <h2 className="text-lg font-bold text-[#1E293B]">Edit User Account</h2>
                  <p className="text-xs text-[#757680] font-mono">{editingUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => onNameChange(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 px-4 text-sm text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={editEmail}
                  className="w-full bg-slate-100 border border-[#E2E8F0] rounded-full py-2.5 px-4 text-sm text-[#757680] cursor-not-allowed select-none"
                />
              </div>

              <div className="space-y-1.5">
                <CustomDropdown
                  label="Position / Role"
                  options={positionOptions}
                  value={editPosition}
                  onChange={(val) => {
                    const opt = positionOptions.find((o) => o.value === val || o.label === val);
                    onSelectPosition(val, opt?.label || val);
                  }}
                  size="md"
                  pill
                />
              </div>

              <div className="space-y-1.5">
                <CustomDropdown
                  label="Shift Schedule"
                  options={shiftScheduleOptions}
                  value={editShift}
                  onChange={onSelectShift}
                  size="md"
                  pill
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]">
                <div>
                  <span className="text-xs font-bold text-[#1E293B]">Account Status</span>
                  <p className="text-[11px] text-[#757680]">
                    {editStatus === 'Active'
                      ? 'User has active terminal access'
                      : 'User access is suspended'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleStatus}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    editStatus === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-200 text-[#505F76]'
                  }`}
                >
                  {editStatus}
                </button>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                <SecondaryButton
                  type="button"
                  size="md"
                  pill
                  disabled={isSavingEdit}
                  onClick={onClose}
                >
                  Cancel
                </SecondaryButton>

                <PrimaryButton
                  type="submit"
                  size="md"
                  pill
                  isLoading={isSavingEdit}
                  leftIcon={<Check className="w-4 h-4" />}
                >
                  Save Changes
                </PrimaryButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
