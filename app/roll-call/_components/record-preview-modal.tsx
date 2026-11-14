'use client';

import React from 'react';
import { X, Save, ShieldCheck, Search, Loader2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import {
  PAPER_DIMENSIONS,
  type PaperSize,
  type RollCallTemplateType,
} from '@/lib/pdf-generator';
import type { MunicipalityRow, RollCallSessionRecord } from './types';

export type PreviewFilterType =
  | 'all'
  | 'Present'
  | 'Absent'
  | 'Exempted'
  | 'incomplete';

export interface RecordPreviewModalProps {
  isOpen: boolean;
  activeSession: RollCallSessionRecord | null;
  profileFullName: string;
  presentCount: number;
  absentCount: number;
  exemptedCount: number;
  recordedCount: number;
  selectedTemplateType: RollCallTemplateType;
  selectedPaperSize: PaperSize;
  previewFilter: PreviewFilterType;
  previewSearchQuery: string;
  filteredPreviewItems: MunicipalityRow[];
  isSubmitting: boolean;
  onChangeTemplateType: (t: RollCallTemplateType) => void;
  onChangePaperSize: (s: PaperSize) => void;
  onChangeFilter: (f: PreviewFilterType) => void;
  onChangeSearchQuery: (q: string) => void;
  onQuickExportPDF: (
    templateType: RollCallTemplateType,
    paperSize: PaperSize
  ) => void;
  onFinalizeSaveRecord: () => void;
  onClose: () => void;
}

export function RecordPreviewModal({
  isOpen,
  activeSession,
  profileFullName,
  presentCount,
  absentCount,
  exemptedCount,
  recordedCount,
  selectedTemplateType,
  selectedPaperSize,
  previewFilter,
  previewSearchQuery,
  filteredPreviewItems,
  isSubmitting,
  onChangeTemplateType,
  onChangePaperSize,
  onChangeFilter,
  onChangeSearchQuery,
  onQuickExportPDF,
  onFinalizeSaveRecord,
  onClose,
}: RecordPreviewModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="w-full sm:max-w-4xl bg-white rounded-t-[1.75rem] sm:rounded-[1.75rem] border border-[#E2E8F0] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold text-[#1E293B]">
                    Review & Finalize Operational Roll Call
                  </h2>
                  <p className="text-[11px] sm:text-xs text-[#757680]">
                    Review station telemetry records and attendance before finalizing to secure archives
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Overview Strip */}
            <div className="px-5 sm:px-8 py-3 bg-slate-50 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                <div>
                  <span className="text-[#757680]">Session Date:</span>{' '}
                  <strong className="text-[#1E293B]">
                    {activeSession?.session_date ||
                      new Date().toISOString().split('T')[0]}
                  </strong>
                </div>
                <div>
                  <span className="text-[#757680]">Conducted By:</span>{' '}
                  <strong className="text-[#1E293B]">
                    {activeSession?.conducted_by_name ||
                      profileFullName ||
                      'Monitoring Officer'}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {presentCount} Present
                </span>
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  {absentCount} Absent
                </span>
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-[#505F76] border border-slate-200">
                  {exemptedCount} Exempt
                </span>
              </div>
            </div>

            {/* Template Format & Paper Size Selector Strip */}
            <div className="px-5 sm:px-8 py-2.5 bg-white border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#505F76] uppercase tracking-wider text-[10px]">
                  PDF Template:
                </span>
                <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-full border border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => onChangeTemplateType('net_calling')}
                    className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                      selectedTemplateType === 'net_calling'
                        ? 'bg-[#004AC6] text-white shadow-xs'
                        : 'text-[#505F76] hover:text-[#1E293B]'
                    }`}
                  >
                    For Net Calling (2-Column)
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeTemplateType('official_table')}
                    className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                      selectedTemplateType === 'official_table'
                        ? 'bg-[#004AC6] text-white shadow-xs'
                        : 'text-[#505F76] hover:text-[#1E293B]'
                    }`}
                  >
                    Official MLS Table
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#505F76] uppercase tracking-wider text-[10px]">
                  Paper Size:
                </span>
                <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-full border border-[#E2E8F0]">
                  {(['a4', 'short', 'folio', 'legal'] as PaperSize[]).map(
                    (sizeKey) => (
                      <button
                        key={sizeKey}
                        type="button"
                        onClick={() => onChangePaperSize(sizeKey)}
                        title={PAPER_DIMENSIONS[sizeKey].label}
                        className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer uppercase text-[11px] ${
                          selectedPaperSize === sizeKey
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-[#505F76] hover:text-[#1E293B]'
                        }`}
                      >
                        {PAPER_DIMENSIONS[sizeKey].shortLabel}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="px-4 sm:px-8 py-3.5 border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                {(
                  ['all', 'Present', 'Absent', 'Exempted', 'incomplete'] as const
                ).map((filterVal) => (
                  <button
                    key={filterVal}
                    type="button"
                    onClick={() => onChangeFilter(filterVal)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer capitalize ${
                      previewFilter === filterVal
                        ? 'bg-[#004AC6] text-white shadow-sm'
                        : 'bg-slate-100 text-[#505F76] hover:bg-slate-200'
                    }`}
                  >
                    {filterVal === 'incomplete' ? 'Needs Review' : filterVal}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#757680]" />
                <input
                  type="text"
                  value={previewSearchQuery}
                  onChange={(e) => onChangeSearchQuery(e.target.value)}
                  placeholder="Search municipality..."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full pl-8 pr-3 py-1 text-xs text-[#1E293B] focus:outline-none focus:border-[#004AC6]"
                />
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto max-h-[45vh] p-4 sm:p-8">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider bg-slate-50/50">
                    <th className="py-2.5 px-4">LGU / Municipality</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4">Weather Condition</th>
                    <th className="py-2.5 px-4">Port / Pier Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPreviewItems.map((mun) => (
                    <tr key={mun.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-[#1E293B]">
                        <span>{mun.name}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            mun.attendance === 'Present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : mun.attendance === 'Absent'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : mun.attendance === 'Exempted'
                              ? 'bg-slate-100 text-[#505F76] border border-slate-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {mun.attendance || 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[#1E293B] font-medium">
                          {mun.attendance === 'Absent' ||
                          mun.attendance === 'Exempted' ? (
                            <span className="text-slate-400 italic">
                              N/A ({mun.attendance})
                            </span>
                          ) : mun.weatherStatus && mun.weatherStatus !== 'N/A' ? (
                            mun.weatherStatus
                          ) : (
                            <span className="text-amber-600 font-bold">
                              Required
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[#1E293B] font-medium">
                          {mun.attendance === 'Absent' ||
                          mun.attendance === 'Exempted' ? (
                            <span className="text-slate-400 italic">
                              N/A ({mun.attendance})
                            </span>
                          ) : !mun.hasPort ? (
                            'No Port (Inland)'
                          ) : mun.portStatus &&
                            mun.portStatus !== 'N/A' &&
                            mun.portStatus !== 'None' ? (
                            mun.portStatus
                          ) : (
                            <span className="text-amber-600 font-bold">
                              Required
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-8 py-4 sm:py-4.5 border-t border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-col sm:flex-row justify-between items-center gap-3">
              <SecondaryButton
                size="md"
                pill
                onClick={() =>
                  onQuickExportPDF(selectedTemplateType, selectedPaperSize)
                }
                leftIcon={<Download className="w-4 h-4" />}
                className="w-full sm:w-auto justify-center"
              >
                Export PDF ({PAPER_DIMENSIONS[selectedPaperSize].shortLabel})
              </SecondaryButton>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                <SecondaryButton
                  size="md"
                  pill
                  onClick={onClose}
                  className="w-full sm:w-auto justify-center"
                >
                  Continue Editing
                </SecondaryButton>

                <PrimaryButton
                  size="md"
                  pill
                  disabled={isSubmitting || recordedCount === 0}
                  onClick={onFinalizeSaveRecord}
                  leftIcon={
                    isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )
                  }
                  className="w-full sm:w-auto justify-center"
                >
                  {isSubmitting ? 'Archiving...' : 'Confirm & Finalize Record'}
                </PrimaryButton>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
