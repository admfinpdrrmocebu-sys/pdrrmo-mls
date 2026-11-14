'use client';

import React from 'react';
import { UserPlus, Mail, X, Sparkles, ExternalLink, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, type CustomDropdownOption } from '@/components/input';

export interface InviteUserModalProps {
  isOpen: boolean;
  isSendingInvitations: boolean;
  inviteEmails: string[];
  currentEmailInput: string;
  invitePosition: string;
  inviteShift: string;
  positionOptions: CustomDropdownOption[];
  shiftScheduleOptions: CustomDropdownOption[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onCurrentEmailInputChange: (val: string) => void;
  onAddEmail: (rawText?: string) => void;
  onRemoveEmail: (email: string) => void;
  onSelectPosition: (val: string, label: string) => void;
  onSelectShift: (val: string) => void;
  onOpenEmailPreview: () => void;
}

export default function InviteUserModal({
  isOpen,
  isSendingInvitations,
  inviteEmails,
  currentEmailInput,
  invitePosition,
  inviteShift,
  positionOptions,
  shiftScheduleOptions,
  onClose,
  onSubmit,
  onCurrentEmailInputChange,
  onAddEmail,
  onRemoveEmail,
  onSelectPosition,
  onSelectShift,
  onOpenEmailPreview,
}: InviteUserModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isSendingInvitations && onClose()}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-visible z-10"
          >
            <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1E293B]">Invite Users via SMTP</h2>
                  <p className="text-xs text-[#757680]">
                    Dispatches official branded invitation emails with secure tokens
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSendingInvitations}
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                    Recipient Email Address(es)
                  </label>
                  {inviteEmails.length > 0 && (
                    <span className="text-xs font-bold text-[#004AC6]">
                      {inviteEmails.length} {inviteEmails.length === 1 ? 'recipient' : 'recipients'}
                    </span>
                  )}
                </div>

                <div className="min-h-[96px] max-h-44 overflow-y-auto custom-scrollbar w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-2.5 focus-within:border-[#004AC6] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#004AC6]/15 transition-all flex flex-wrap gap-2 items-start content-start">
                  {inviteEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E2E8F0] text-[#1E293B] rounded-full text-xs font-medium shadow-2xs group hover:border-slate-300 transition-colors"
                    >
                      <Mail className="w-3 h-3 text-[#004AC6]" />
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveEmail(email)}
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  <input
                    type="text"
                    value={currentEmailInput}
                    onChange={(e) => onCurrentEmailInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') {
                        e.preventDefault();
                        onAddEmail();
                      } else if (e.key === 'Backspace' && !currentEmailInput && inviteEmails.length > 0) {
                        onRemoveEmail(inviteEmails[inviteEmails.length - 1]);
                      }
                    }}
                    onBlur={() => onAddEmail()}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteData = e.clipboardData.getData('text');
                      onAddEmail(pasteData);
                    }}
                    placeholder={
                      inviteEmails.length === 0
                        ? 'Enter email address(es) (e.g. officer@pdrrmo.gov.ph)...'
                        : 'Add another email...'
                    }
                    className="flex-1 min-w-[200px] bg-transparent border-none py-1 px-1 text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-[#757680]">
                  Separate multiple emails with commas, spaces, or press Enter.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <CustomDropdown
                    label="Assigned Position / Access Level"
                    options={positionOptions}
                    value={invitePosition}
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
                    label="Assigned Shift Schedule"
                    options={shiftScheduleOptions}
                    value={inviteShift}
                    onChange={onSelectShift}
                    size="md"
                    pill
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#004AC6] font-medium">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Branded HTML Email Template will be dispatched</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenEmailPreview}
                  className="font-bold text-[#004AC6] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Preview Email</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                <SecondaryButton
                  type="button"
                  size="md"
                  pill
                  disabled={isSendingInvitations}
                  onClick={onClose}
                >
                  Cancel
                </SecondaryButton>

                <PrimaryButton
                  type="submit"
                  size="md"
                  pill
                  isLoading={isSendingInvitations}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Send Invitation
                </PrimaryButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
