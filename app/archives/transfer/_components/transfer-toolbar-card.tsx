'use client';

import React, { memo } from 'react';
import { Download, CloudUpload, Trash2, Loader2 } from 'lucide-react';

interface TransferToolbarCardProps {
  totalFiles: number;
  pendingCount: number;
  logCount: number;
  rcCount: number;
  isLoading: boolean;
  isTransferring: boolean;
  isBundlingZip: boolean;
  isDeleting: boolean;
  canModifyArchives: boolean;
  onDownloadZip: () => void;
  onTransferAll: () => void;
  onOpenPurgeModal: () => void;
}

function TransferToolbarCardInner({
  totalFiles,
  pendingCount,
  logCount,
  rcCount,
  isLoading,
  isTransferring,
  isBundlingZip,
  isDeleting,
  canModifyArchives,
  onDownloadZip,
  onTransferAll,
  onOpenPurgeModal,
}: TransferToolbarCardProps) {
  const alreadySyncedCount = Math.max(0, totalFiles - pendingCount);

  return (
    <div className="bg-white rounded-3xl px-5 py-4 sm:px-6 sm:py-5 border border-[#E2E8F0] shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:border-[#CBD5E1] transition-all">
      <div>
        <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
          Transfer & Backup Actions
        </h3>
        <p className="text-xs text-[#757680] mt-0.5">
          {pendingCount} new to transfer to B2 · {alreadySyncedCount} already in Backblaze B2 (
          {logCount} Shift Logs · {rcCount} Roll Calls)
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2.5">
        {/* 1-Click Organized .ZIP Bundle Download */}
        <button
          type="button"
          disabled={totalFiles === 0 || isTransferring || isBundlingZip || isLoading}
          onClick={onDownloadZip}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border ${
            totalFiles === 0 || isTransferring || isBundlingZip || isLoading
              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 shadow-2xs active:scale-[0.98]'
          }`}
          title="Download a single organized .ZIP with MLS/, RC/, and ARCHIVE-MANIFEST.json"
        >
          {isBundlingZip ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
          ) : (
            <Download className="w-4 h-4 text-emerald-700" />
          )}
          <span>Download .ZIP Bundle ({totalFiles})</span>
        </button>

        {/* Transfer All Button (skips duplicates already in Backblaze B2) */}
        <button
          type="button"
          disabled={totalFiles === 0 || isTransferring || isLoading}
          onClick={onTransferAll}
          className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
            totalFiles === 0 || isTransferring || isLoading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200'
              : 'bg-[#004AC6] hover:bg-[#003da3] text-white shadow-sm active:scale-[0.98]'
          }`}
        >
          {isTransferring ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <CloudUpload className="w-4 h-4 text-white" />
          )}
          <span>
            {pendingCount > 0
              ? `Transfer to Backblaze B2 (${pendingCount})`
              : 'All Synced in Backblaze B2 (0 New)'}
          </span>
        </button>

        {/* Delete All Button (Purge) */}
        <button
          type="button"
          disabled={totalFiles === 0 || !canModifyArchives || isDeleting || isLoading}
          onClick={onOpenPurgeModal}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
            totalFiles === 0 || !canModifyArchives || isDeleting || isLoading
              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-2xs active:scale-[0.98]'
          }`}
          title={
            !canModifyArchives
              ? 'Disabled in view-only mode'
              : 'Permanently delete all files from storage'
          }
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete All Files</span>
        </button>
      </div>
    </div>
  );
}

export const TransferToolbarCard = memo(TransferToolbarCardInner);
