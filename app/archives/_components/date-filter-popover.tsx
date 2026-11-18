'use client';

import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';

export interface DateFilterPopoverProps {
  selectedDate: Date | null;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onSelectDate: (date: Date | null) => void;
  onClose: () => void;
}

interface PopoverCoords {
  top: number;
  right: number;
}

export function DateFilterPopover({
  selectedDate,
  anchorRef,
  onSelectDate,
  onClose,
}: DateFilterPopoverProps) {
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const estimatedHeight = 360;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow >= estimatedHeight || spaceBelow >= rect.top
          ? rect.bottom + 8
          : Math.max(12, rect.top - estimatedHeight - 8);
      const right = Math.max(12, window.innerWidth - rect.right);
      setCoords({ top, right });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  if (typeof document === 'undefined' || !coords) return null;

  return createPortal(
    <motion.div
      data-date-filter-popover="true"
      initial={{ opacity: 0, scale: 0.95, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 6 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed',
        top: coords.top,
        right: coords.right,
        maxWidth: 'calc(100vw - 24px)',
      }}
      className="z-[9999] bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl p-3.5 min-w-[300px]"
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
    </motion.div>,
    document.body
  );
}
