'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Calendar, Clock, Loader2, PlusCircle, X } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import {
  CustomDropdown,
  RichTextEditor,
  stripEmojis,
  type CustomDropdownOption,
} from '@/components/input';

interface AddEditLogDrawerProps {
  isSubmitting: boolean;
  editingLogId: string | null;
  formTitle: string;
  formReportType: string;
  formDate: string;
  formTime: string;
  formDescription: string;
  reportTypeOptionsList: CustomDropdownOption[];
  onClose: () => void;
  onTitleChange: (val: string) => void;
  onReportTypeChange: (val: string) => void;
  onDescriptionChange: (html: string) => void;
  onOpenAddCategory: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AddEditLogDrawer({
  isSubmitting,
  editingLogId,
  formTitle,
  formReportType,
  formDate,
  formTime,
  formDescription,
  reportTypeOptionsList,
  onClose,
  onTitleChange,
  onReportTypeChange,
  onDescriptionChange,
  onOpenAddCategory,
  onSubmit,
}: AddEditLogDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !isSubmitting && onClose()}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Slide-over Drawer Panel */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full sm:w-[500px] bg-white h-full shadow-2xl border-l border-[#E2E8F0] flex flex-col justify-between overflow-hidden z-10"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
          <div>
            <h2 className="text-lg font-bold text-[#1E293B]">
              {editingLogId ? 'Edit Incident Log' : 'Add New Log'}
            </h2>
            <p className="text-xs text-[#757680]">
              Enter details for the environmental event
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form
          onSubmit={onSubmit}
          className="flex-1 flex flex-col justify-between overflow-hidden"
        >
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Event Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                Event Title
              </label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => onTitleChange(stripEmojis(e.target.value))}
                placeholder="e.g., Seismic Activity: Magnitude 6.2 Detected"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 px-4 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
              />
            </div>

            {/* Report Type Dropdown */}
            <div>
              <CustomDropdown
                label="Report Type"
                labelRight={
                  <button
                    type="button"
                    onClick={onOpenAddCategory}
                    className="text-xs font-semibold text-[#004AC6] hover:text-[#003594] flex items-center gap-1 transition-colors group cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform text-[#004AC6]" />
                    <span>Add Category</span>
                  </button>
                }
                options={reportTypeOptionsList}
                value={formReportType}
                onChange={onReportTypeChange}
                size="md"
                pill
              />
            </div>

            {/* Timestamp: Date & Time (Disabled) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                Timestamp
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={formDate}
                    className="w-full bg-slate-100 border border-[#E2E8F0] rounded-full py-2.5 pl-4 pr-9 text-sm text-[#505F76] opacity-75 cursor-not-allowed focus:outline-none select-none"
                  />
                  <Calendar className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={formTime}
                    className="w-full bg-slate-100 border border-[#E2E8F0] rounded-full py-2.5 pl-4 pr-9 text-sm text-[#505F76] font-mono opacity-75 cursor-not-allowed focus:outline-none select-none"
                  />
                  <Clock className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Detailed Description with Visual WYSIWYG Rich Text Editor */}
            <RichTextEditor
              label="Detailed Description"
              value={formDescription}
              onChange={onDescriptionChange}
              placeholder="Provide a detailed operational summary of the event..."
              minHeight="140px"
            />
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex gap-3">
            <SecondaryButton
              type="button"
              size="md"
              pill
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 justify-center"
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              size="md"
              pill
              disabled={isSubmitting}
              className="flex-1 justify-center"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : editingLogId ? (
                'Save Changes'
              ) : (
                'Save Log'
              )}
            </PrimaryButton>
          </div>
        </form>
      </motion.aside>
    </div>
  );
}
