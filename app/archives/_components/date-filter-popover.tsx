'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';

export interface DateFilterPopoverProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  onClose: () => void;
}

export function DateFilterPopover({
  selectedDate,
  onSelectDate,
  onClose,
}: DateFilterPopoverProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 6 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 mt-2 z-50 bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl p-3.5 min-w-[300px]"
    >
      <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 px-2">
        <span className="text-xs font-bold text-[#1E293B]">
          Filter Archives by Date
        </span>
        {selectedDate && (
          <button
            type="button"
            onClick={() => {
              onSelectDate(null);
              onClose();
            }}
            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      <CalendarPicker
        mode="single"
        selected={selectedDate || undefined}
        onSelect={(date) => {
          onSelectDate(date || null);
          onClose();
        }}
        autoFocus
      />

      <div className="pt-2 mt-1 border-t border-slate-100 flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => {
            onSelectDate(new Date());
            onClose();
          }}
          className="text-xs font-bold text-[#004AC6] hover:bg-blue-50 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => {
            onSelectDate(null);
            onClose();
          }}
          className="text-xs font-medium text-[#505F76] hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
        >
          All Dates
        </button>
      </div>
    </motion.div>
  );
}
