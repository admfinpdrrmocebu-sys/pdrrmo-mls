'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Archive as ArchiveIcon,
  Check,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Square,
  Users,
  X,
} from 'lucide-react';
import { PrimaryButton, SecondaryButton, ToggleButton } from '@/components/button';
import { stripEmojis } from '@/components/input';
import type { ActiveShiftRecord, DutyPersonnel } from './types';

interface EndShiftModalProps {
  isSubmitting: boolean;
  activeShift: ActiveShiftRecord | null;
  availableOfficers: DutyPersonnel[];
  selectedPersonnelIds: string[];
  isIncidentReportOn: boolean;
  incidentDetails: string;
  onClose: () => void;
  onToggleIncidentReport: (checked: boolean) => void;
  onIncidentDetailsChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function EndShiftModal({
  isSubmitting,
  activeShift,
  availableOfficers,
  selectedPersonnelIds,
  isIncidentReportOn,
  incidentDetails,
  onClose,
  onToggleIncidentReport,
  onIncidentDetailsChange,
  onSubmit,
}: EndShiftModalProps) {
  const presentPersonnel =
    activeShift?.personnel && activeShift.personnel.length > 0
      ? activeShift.personnel
      : availableOfficers.filter((p) => selectedPersonnelIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !isSubmitting && onClose()}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden z-10"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1E293B] leading-tight">
                End of monitoringduty (List of personnel assigned on this shift)
              </h2>
              <p className="text-xs text-[#757680] mt-0.5">
                Verify present shift personnel and report incident status before closing shift.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={onSubmit} className="flex flex-col">
          <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {/* Section 1: Present Personnel in this shift */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#004AC6]" />
                  Present Personnel on Duty (
                  {activeShift?.personnel.length || selectedPersonnelIds.length})
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Shift Verified
                </span>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 space-y-2">
                {presentPersonnel.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200 shrink-0">
                        {person.avatarInitials}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#1E293B] block">
                          {person.name}
                        </span>
                        <span className="text-[11px] text-[#757680]">
                          {person.role}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50/80 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> Present
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Automatic Single-Shift Operations Archive Notice */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4.5 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#004AC6] flex items-center justify-center border border-blue-100 shrink-0">
                  <ArchiveIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-[#1E293B]">
                      Automatic Shift Operations Archive
                    </h4>
                    <span className="text-[10px] font-bold text-[#004AC6] bg-blue-50 border border-[#004AC6]/20 px-2 py-0.5 rounded-full">
                      {activeShift?.shift_label || 'Current Shift'}
                    </span>
                  </div>
                  <p className="text-xs text-[#757680] mt-0.5">
                    Ending this shift automatically generates a certified{' '}
                    <strong>{activeShift?.shift_label || 'Current Shift'}</strong>{' '}
                    operations PDF document in <strong>Archives</strong>, formatted with
                    signature fields ready for in-person physical signing.
                  </p>
                </div>
              </div>

              <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-[#004AC6] flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-[#004AC6]" />
                <span>
                  <strong>Shift-Specific Record:</strong> Personnel roster, timestamps,
                  and Area of Responsibility logs for this shift will be sealed with a
                  SHA-256 integrity hash and securely uploaded to the archive repository.
                </span>
              </div>
            </div>

            {/* Section 3: Incident Report Toggle */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4.5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#1E293B]">Incident Report</h4>
                  <p className="text-xs text-[#757680] mt-0.5">
                    Toggle ON if incidents occurred during shift duty.
                  </p>
                </div>

                <ToggleButton
                  checked={isIncidentReportOn}
                  onChange={onToggleIncidentReport}
                />
              </div>

              <AnimatePresence mode="wait">
                {!isIncidentReportOn ? (
                  <motion.div
                    key="normal-state"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide block">
                        Handover Status
                      </span>
                      <p className="text-sm font-bold text-emerald-900">
                        Situation Remain Normal
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="incident-input"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5 pt-2"
                  >
                    <label className="text-xs font-semibold text-rose-700 uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Incident Report Details (Required)
                    </label>
                    <textarea
                      rows={4}
                      required={isIncidentReportOn}
                      value={incidentDetails}
                      onChange={(e) => onIncidentDetailsChange(stripEmojis(e.target.value))}
                      placeholder="Enter details of incidents encountered, dispatch responses, ongoing advisories, or critical notes for the incoming shift..."
                      className="w-full bg-white border border-rose-200 rounded-2xl p-3.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 transition-all resize-none leading-relaxed"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4.5 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between gap-3">
            <SecondaryButton
              type="button"
              size="md"
              pill
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancel
            </SecondaryButton>

            <PrimaryButton
              type="submit"
              size="md"
              pill
              disabled={(isIncidentReportOn && !incidentDetails.trim()) || isSubmitting}
              leftIcon={
                isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4 fill-white" />
                )
              }
              className="bg-amber-600 hover:bg-amber-700 border-amber-700"
            >
              {isSubmitting ? 'Closing Shift...' : 'Confirm End Shift'}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
