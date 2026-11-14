'use client';

import React, { useState } from 'react';
import { Tag, X, Check, Edit2, Plus, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { COLOR_OPTIONS, type ReportTypeItem } from './types';

interface ReportTypeFormModalProps {
  editingItem: ReportTypeItem | null;
  onClose: () => void;
  onSubmit: (values: { name: string; color: string }) => Promise<boolean>;
}

export default function ReportTypeFormModal({
  editingItem,
  onClose,
  onSubmit,
}: ReportTypeFormModalProps) {
  const [itemTitle, setItemTitle] = useState(() => editingItem?.name ?? '');
  const [selectedColor, setSelectedColor] = useState(
    () => editingItem?.color || '#004AC6'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!editingItem;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const ok = await onSubmit({
        name: itemTitle.trim(),
        color: selectedColor,
      });
      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop Blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !isSubmitting && onClose()}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden z-10"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center border shrink-0 transition-colors"
              style={{
                backgroundColor: `${selectedColor}15`,
                color: selectedColor,
                borderColor: `${selectedColor}30`,
              }}
            >
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1E293B]">
                {isEditing ? 'Edit Report Type' : 'Add Report Type'}
              </h2>
              <p className="text-xs text-[#757680]">
                Configure report category title and indicator color
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="flex flex-col">
          <div className="p-6 space-y-5">
            {/* Name / Title Input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="item-title"
                className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
              >
                Report Type Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="item-title"
                type="text"
                required
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                placeholder="e.g., Hazardous Chemical Spill, Flood Advisory"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
              />
            </div>

            {/* Color Indicator Swatches Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                Indicator Color
              </label>
              <div className="flex items-center gap-3 pt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => setSelectedColor(c.color)}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                      selectedColor === c.color
                        ? 'ring-2 ring-offset-2 ring-[#004AC6] scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  >
                    {selectedColor === c.color && (
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4.5 border-t border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
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
              disabled={isSubmitting}
              leftIcon={
                isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isEditing ? (
                  <Edit2 className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )
              }
            >
              {isSubmitting
                ? 'Saving...'
                : isEditing
                ? 'Save Changes'
                : 'Add Report Type'}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
