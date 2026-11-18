'use client';

import React, { memo, useState, useEffect } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  X,
  Info,
  Download,
  FolderOpen,
  Trash2,
  ShieldAlert,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBytes } from '@/app/archives/_components/types';
import type { TransferProgressState, ToastNotificationState } from './types';

interface TransferProgressModalProps {
  isOpen: boolean;
  isTransferring: boolean;
  canModifyArchives: boolean;
  bucketName: string;
  progress: TransferProgressState;
  onCancel: () => void;
  onClose: () => void;
  onFallbackLocalDownload: () => void;
  onViewB2Files: () => void;
  onOpenPurgeFromModal: () => void;
}

export const TransferProgressModal = memo(function TransferProgressModalInner({
  isOpen,
  isTransferring,
  canModifyArchives,
  bucketName,
  progress,
  onCancel,
  onClose,
  onFallbackLocalDownload,
  onViewB2Files,
  onOpenPurgeFromModal,
}: TransferProgressModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-[#E2E8F0] shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    progress.isFinished
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-blue-50 text-[#004AC6] border border-blue-200'
                  }`}
                >
                  {progress.isFinished ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <CloudUpload className="w-5 h-5 animate-pulse" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">
                    {progress.isFinished
                      ? 'Backblaze B2 Vault Transfer Complete'
                      : 'Direct Server Transfer to Backblaze B2'}
                  </h3>
                  <p className="text-xs text-[#757680]">
                    {progress.isFinished
                      ? `${progress.successCount} files verified in Backblaze B2 Vault`
                      : `Processing ${progress.current} of ${progress.total} documents`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isTransferring) onCancel();
                  onClose();
                }}
                className="text-[#94A3B8] hover:text-[#1E293B] p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                title="Close / Cancel Transfer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Bar & Status */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-[#505F76]">
                <span className="truncate max-w-[280px]">
                  {progress.statusMessage || progress.currentFilename}
                </span>
                <span className="font-mono">
                  {progress.total > 0
                    ? Math.round((progress.current / progress.total) * 100)
                    : 0}
                  %
                </span>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    progress.isFinished ? 'bg-emerald-600' : 'bg-[#004AC6]'
                  }`}
                  style={{
                    width: `${
                      progress.total > 0 ? (progress.current / progress.total) * 100 : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Destination & Details Box */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-2.5">
              <p className="font-bold text-[#1E293B] flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#004AC6]" />
                Backblaze B2 Target Bucket:
              </p>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] font-mono text-[#004AC6] truncate">
                {bucketName || 'pdrrmo-cebu-archives'} (Private Bucket • SHA-1 Verified • MLS/ & RC/)
              </div>
              <p className="text-[#505F76] leading-relaxed">
                Files are streamed server-to-server from Supabase Storage into your Backblaze B2 Private Bucket with SHA-1 integrity verification. No Google OAuth consent screen or credit card required.
              </p>
            </div>

            {/* Action Buttons in Modal */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              {!progress.isFinished && !isTransferring && (
                <button
                  type="button"
                  onClick={onFallbackLocalDownload}
                  className="text-[11px] font-bold text-[#505F76] hover:text-[#004AC6] flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .ZIP Bundle instead</span>
                </button>
              )}

              <div className="flex items-center justify-end gap-2.5 ml-auto w-full sm:w-auto">
                {isTransferring ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold cursor-pointer transition-colors"
                  >
                    Cancel Transfer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#505F76] hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    Close
                  </button>
                )}

                <button
                  type="button"
                  onClick={onViewB2Files}
                  className="px-4 py-2.5 rounded-xl bg-blue-50 text-[#004AC6] border border-blue-200 hover:bg-blue-100 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <span>View B2 Vault Files</span>
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>

                {progress.isFinished && canModifyArchives && (
                  <button
                    type="button"
                    onClick={onOpenPurgeFromModal}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purge Storage Bucket Now</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

interface PurgeConfirmModalProps {
  isOpen: boolean;
  isDeleting: boolean;
  filesCount: number;
  totalBytes: number;
  onClose: () => void;
  onConfirmPurge: () => void;
}

export const PurgeConfirmModal = memo(function PurgeConfirmModalInner({
  isOpen,
  isDeleting,
  filesCount,
  totalBytes,
  onClose,
  onConfirmPurge,
}: PurgeConfirmModalProps) {
  const [confirmationText, setConfirmationText] = useState('');

  useEffect(() => {
    if (!isOpen) setConfirmationText('');
  }, [isOpen]);

  const isConfirmed = confirmationText.trim().toUpperCase() === 'DELETE';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-rose-200 shadow-2xl space-y-5"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1E293B]">
                  Confirm Storage Bucket Purge
                </h3>
                <p className="text-xs text-rose-600 font-semibold">
                  Warning: Irreversible Data Removal
                </p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 space-y-2 leading-relaxed">
              <p>
                You are about to permanently delete <strong>{filesCount} files</strong> (
                <strong>{formatBytes(totalBytes)}</strong>) from the Supabase storage bucket (`archive-documents`).
              </p>
              <p className="text-[11px] text-rose-700">
                Ensure all files have been safely migrated to Backblaze B2 or exported as a .ZIP bundle before continuing.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#1E293B] block">
                Type <span className="font-mono text-rose-600 font-black">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-2.5 px-3.5 text-xs text-[#1E293B] font-mono focus:outline-none focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-500/15 transition-all"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#505F76] hover:bg-slate-50 cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!isConfirmed || isDeleting}
                onClick={onConfirmPurge}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                  isConfirmed && !isDeleting
                    ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                    : 'bg-rose-200 text-rose-400 cursor-not-allowed'
                }`}
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Permanently Purge All Files</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

interface FloatingToastProps {
  toast: ToastNotificationState | null;
  onDismiss: () => void;
}

export const FloatingToast = memo(function FloatingToastInner({
  toast,
  onDismiss,
}: FloatingToastProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className={`fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-2xl shadow-xl border flex items-start gap-3 select-none ${
            toast.type === 'success'
              ? 'bg-emerald-900/95 text-white border-emerald-700'
              : toast.type === 'error'
              ? 'bg-rose-900/95 text-white border-rose-700'
              : 'bg-slate-900/95 text-white border-slate-700'
          }`}
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
          )}
          {toast.type === 'error' && (
            <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
          )}
          {toast.type === 'info' && (
            <Info className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold leading-snug">{toast.message}</p>
            {toast.submessage && (
              <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
                {toast.submessage}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="opacity-70 hover:opacity-100 text-white p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
