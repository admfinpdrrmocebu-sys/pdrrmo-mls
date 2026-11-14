'use client';

import React from 'react';
import {
  FileText,
  Radio,
  MoreVertical,
  Download,
  Eye,
  Clock,
  Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ArchivedFile } from './types';

export interface ArchiveRowProps {
  file: ArchivedFile;
  isMenuOpen: boolean;
  onPreview: (file: ArchivedFile) => void;
  onDownload: (file: ArchivedFile) => void;
  onCopyHash: (file: ArchivedFile) => void;
  onToggleMenu: (id: string, e: React.MouseEvent) => void;
}

export const ArchiveRow = React.memo(function ArchiveRow({
  file,
  isMenuOpen,
  onPreview,
  onDownload,
  onCopyHash,
  onToggleMenu,
}: ArchiveRowProps) {
  return (
    <tr
      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
      onClick={() => onPreview(file)}
    >
      {/* File Name / Document Title */}
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-2xs shrink-0 ${
              file.category === 'log'
                ? 'bg-blue-50 text-[#004AC6] border-blue-200/60'
                : 'bg-sky-50 text-sky-700 border-sky-200/60'
            }`}
          >
            {file.category === 'log' ? (
              <FileText className="w-5 h-5" />
            ) : (
              <Radio className="w-5 h-5" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-[#1E293B] group-hover:text-[#004AC6] transition-colors font-mono">
              {file.filename}
            </span>
            <span className="text-xs text-[#757680]">
              {file.itemCount}{' '}
              {file.category === 'log' ? 'shift entries' : 'station checks'} ·{' '}
              <span className="text-emerald-600 font-medium">
                Verified Official Record
              </span>
            </span>
          </div>
        </div>
      </td>

      {/* Lead Officer & Shift */}
      <td className="py-4 px-6">
        <div className="flex flex-col">
          <span className="font-medium text-[#1E293B] text-xs">
            {file.leadOfficer}
          </span>
          <span className="text-[11px] text-[#505F76]">{file.shift}</span>
        </div>
      </td>

      {/* Generated At */}
      <td className="py-4 px-6 text-xs text-[#505F76]">
        <div className="flex items-center gap-1.5 font-medium">
          <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span>{file.createdAt}</span>
        </div>
      </td>

      {/* File Size */}
      <td className="py-4 px-6">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-[#505F76] text-xs font-mono font-medium border border-slate-200">
          {file.fileSize}
        </span>
      </td>

      {/* Action Buttons */}
      <td
        className="py-4 px-6 text-right relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onPreview(file)}
            title="View Certified Document"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onDownload(file)}
            title="Download Official PDF Document"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          <div className="relative inline-block text-left">
            <button
              type="button"
              onClick={(e) => onToggleMenu(file.id, e)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
              aria-label="File options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2 w-52 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5"
                >
                  <button
                    type="button"
                    onClick={() => onPreview(file)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#505F76]" />
                    View Document Archive
                  </button>

                  <button
                    type="button"
                    onClick={() => onDownload(file)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#505F76]" />
                    Download Official PDF
                  </button>

                  <button
                    type="button"
                    onClick={() => onCopyHash(file)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <Hash className="w-3.5 h-3.5 text-[#505F76]" />
                    Copy SHA-256 Hash
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </td>
    </tr>
  );
});
