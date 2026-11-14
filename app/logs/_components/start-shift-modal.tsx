'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Clock, Loader2, Play, Users, X } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CheckboxInput, RichTextEditor } from '@/components/input';
import type { ActiveShiftScheduleInfo, DutyPersonnel } from './types';

interface StartShiftModalProps {
  isSubmitting: boolean;
  startShiftDutyTitle: string;
  isStartingFirstShift: boolean;
  activeShiftScheduleInfo: ActiveShiftScheduleInfo;
  designatedOfficers: DutyPersonnel[];
  selectedPersonnelIds: string[];
  startShiftMonitoringDetails: string;
  onClose: () => void;
  onSelectAll: (selectAll: boolean) => void;
  onTogglePersonnel: (id: string) => void;
  onMonitoringDetailsChange: (html: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function StartShiftModal({
  isSubmitting,
  startShiftDutyTitle,
  isStartingFirstShift,
  activeShiftScheduleInfo,
  designatedOfficers,
  selectedPersonnelIds,
  startShiftMonitoringDetails,
  onClose,
  onSelectAll,
  onTogglePersonnel,
  onMonitoringDetailsChange,
  onSubmit,
}: StartShiftModalProps) {
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
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[#1E293B] leading-tight">
                  {startShiftDutyTitle}
                </h2>
                <span className="text-[11px] font-bold text-[#004AC6] bg-blue-50 border border-[#004AC6]/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-[#004AC6]" />
                  <span>{activeShiftScheduleInfo.name}</span>
                  {activeShiftScheduleInfo.time && (
                    <span className="text-blue-500 font-mono text-[10px]">
                      ({activeShiftScheduleInfo.time})
                    </span>
                  )}
                </span>
              </div>
              <p className="text-xs text-[#757680] mt-0.5">
                Auto-fetched active personnel designated for {activeShiftScheduleInfo.name}.
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
          <div className="p-6 space-y-5 max-h-[62vh] overflow-y-auto custom-scrollbar">
            {/* Quick Action Toolbar */}
            <div className="flex items-center justify-between bg-slate-50 border border-[#E2E8F0] rounded-2xl px-4 py-2.5">
              <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider">
                Duty Personnel Roster ({selectedPersonnelIds.length} of{' '}
                {designatedOfficers.length} Selected)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectAll(true)}
                  className="text-xs font-bold text-[#004AC6] hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 text-xs">•</span>
                <button
                  type="button"
                  onClick={() => onSelectAll(false)}
                  className="text-xs font-bold text-[#757680] hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Checklist of Personnel */}
            <div className="space-y-2.5">
              {designatedOfficers.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">
                    No personnel designated for {activeShiftScheduleInfo.name}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Assign officers to this shift in User Management (/users).
                  </p>
                </div>
              ) : (
                designatedOfficers.map((person) => {
                  const isSelected = selectedPersonnelIds.includes(person.id);

                  return (
                    <div
                      key={person.id}
                      onClick={() => onTogglePersonnel(person.id)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'bg-blue-50/50 border-[#004AC6]/30 shadow-2xs ring-1 ring-[#004AC6]/10'
                          : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <CheckboxInput
                          checked={isSelected}
                          onChange={() => onTogglePersonnel(person.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="w-9 h-9 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center font-bold text-xs border border-[#004AC6]/15 shrink-0">
                          {person.avatarInitials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-[#1E293B]">
                              {person.name}
                            </h4>
                            {person.defaultShift && (
                              <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                                {person.defaultShift}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#757680] font-medium">
                            {person.role}
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-[#505F76] border border-slate-200">
                        {person.badgeNumber}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Monitoring Details with Visual WYSIWYG Rich Text Editor */}
            <div className="pt-3 border-t border-slate-200">
              <RichTextEditor
                label="Monitoring Details & Briefing"
                value={startShiftMonitoringDetails}
                onChange={onMonitoringDetailsChange}
                placeholder="Enter shift briefing notes, monitoring priorities, or telemetric instructions..."
                minHeight="110px"
              />
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
              disabled={selectedPersonnelIds.length === 0 || isSubmitting}
              leftIcon={
                isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )
              }
            >
              {isSubmitting
                ? isStartingFirstShift
                  ? 'Starting Shift...'
                  : 'Assuming Duty...'
                : `Confirm ${
                    isStartingFirstShift ? 'Start Shift' : 'Assume Duty'
                  } (${selectedPersonnelIds.length})`}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
