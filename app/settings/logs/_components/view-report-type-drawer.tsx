'use client';

import React from 'react';
import { Tag, X, Calendar, Clock, Edit2, Trash2, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import type { ReportTypeItem } from './types';

interface ViewReportTypeDrawerProps {
  item: ReportTypeItem;
  canModify: boolean;
  onClose: () => void;
  onEdit: (item: ReportTypeItem) => void;
  onRequestDelete: (item: ReportTypeItem) => void;
}

export default function ViewReportTypeDrawer({
  item,
  canModify,
  onClose,
  onEdit,
  onRequestDelete,
}: ViewReportTypeDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm"
      />

      {/* Slide-over Drawer Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full sm:w-[480px] bg-white h-full shadow-2xl border-l border-[#E2E8F0] flex flex-col justify-between overflow-hidden z-10"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0"
              style={{
                backgroundColor: `${item.color || '#004AC6'}15`,
                color: item.color || '#004AC6',
                borderColor: `${item.color || '#004AC6'}30`,
              }}
            >
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1E293B]">Report Type Details</h2>
              <p className="text-xs text-[#757680] font-mono">{item.code}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Meta Overview Card */}
          <div className="bg-[#F8FAFC] rounded-2xl p-5 border border-[#E2E8F0] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#004AC6] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                Standard Classification
              </span>
              <span className="text-xs text-[#757680] font-medium">
                Version {item.version}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-full shadow-2xs"
                  style={{ backgroundColor: item.color || '#004AC6' }}
                />
                <span className="text-xl font-bold text-[#1E293B]">{item.name}</span>
              </div>
              <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-white border border-[#E2E8F0] text-[#505F76] font-semibold">
                {item.code}
              </span>
            </div>
          </div>

          {/* Audit & Governance Trail */}
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#757680] px-1">
              Audit & Governance Trail
            </div>

            <div className="space-y-3">
              {/* Created At */}
              <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-[#757680] font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#505F76]" /> Created at
                  </div>
                  <div className="text-sm font-semibold text-[#1E293B] pl-5">
                    {item.createdAt}
                  </div>
                  <div className="text-xs text-[#757680] pl-5 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#94A3B8]" />
                    <span className="font-medium text-[#505F76]">{item.createdBy}</span>
                    {item.createdByRole && (
                      <span className="text-[11px] text-[#94A3B8]">
                        · {item.createdByRole}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Updated At */}
              <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-[#757680] font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#505F76]" /> Updated at
                  </div>
                  <div className="text-sm font-semibold text-[#1E293B] pl-5">
                    {item.updatedAt}
                  </div>
                  <div className="text-xs text-[#757680] pl-5 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#94A3B8]" />
                    <span className="font-medium text-[#505F76]">{item.updatedBy}</span>
                    {item.updatedByRole && (
                      <span className="text-[11px] text-[#94A3B8]">
                        · {item.updatedByRole}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-5 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between gap-3">
          {canModify ? (
            <>
              <button
                type="button"
                onClick={() => onRequestDelete(item)}
                className="px-4 py-2.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>

              <PrimaryButton
                size="md"
                pill
                onClick={() => onEdit(item)}
                leftIcon={<Edit2 className="w-4 h-4" />}
              >
                Edit Report Type
              </PrimaryButton>
            </>
          ) : (
            <SecondaryButton
              size="md"
              pill
              onClick={onClose}
              className="w-full"
            >
              Close Drawer
            </SecondaryButton>
          )}
        </div>
      </motion.div>
    </div>
  );
}
