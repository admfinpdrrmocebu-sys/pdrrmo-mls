'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Check, Loader2, Plus, Tag, X } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { stripEmojis } from '@/components/input';

const COLOR_OPTIONS = [
  { color: '#004AC6', name: 'Primary Blue' },
  { color: '#BA1A1A', name: 'Critical Red' },
  { color: '#F59E0B', name: 'Warning Amber' },
  { color: '#10B981', name: 'Active Green' },
  { color: '#8B5CF6', name: 'Purple' },
  { color: '#505F76', name: 'Slate Gray' },
];

interface AddCategoryModalProps {
  isSubmitting: boolean;
  newCategoryName: string;
  newCategoryColor: string;
  onClose: () => void;
  onNameChange: (val: string) => void;
  onColorChange: (color: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AddCategoryModal({
  isSubmitting,
  newCategoryName,
  newCategoryColor,
  onClose,
  onNameChange,
  onColorChange,
  onSubmit,
}: AddCategoryModalProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !isSubmitting && onClose()}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden z-10"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                Add Report Type
              </h2>
              <p className="text-xs text-[#757680]">
                Create a custom event classification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {/* Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
              Report Type Name
            </label>
            <input
              type="text"
              required
              value={newCategoryName}
              onChange={(e) => onNameChange(stripEmojis(e.target.value))}
              placeholder="e.g., Hazardous Chemical Spill"
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 px-4 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
            />
          </div>

          {/* Color Dot Swatches */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
              Indicator Color
            </label>
            <div className="flex items-center gap-3 pt-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => onColorChange(c.color)}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                    newCategoryColor === c.color
                      ? 'ring-2 ring-offset-2 ring-[#004AC6] scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                >
                  {newCategoryColor === c.color && (
                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
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
                ) : (
                  <Plus className="w-4 h-4" />
                )
              }
            >
              {isSubmitting ? 'Saving...' : 'Save Category'}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
