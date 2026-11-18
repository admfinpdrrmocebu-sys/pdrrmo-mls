'use client';

import React, { memo } from 'react';
import { HardDrive, CloudUpload, CheckCircle2, Download } from 'lucide-react';
import { Skeleton } from '@/components/skeleton';
import { formatBytes } from '@/app/archives/_components/types';
import type { B2VaultStatusResponse } from './types';

interface StorageCapacityCardProps {
  isLoading: boolean;
  totalBytes: number;
  filesCount: number;
  storagePercentage: number;
  b2Status: B2VaultStatusResponse;
  b2Percentage: number;
  showB2FilesPanel: boolean;
  onCloseB2FilesPanel: () => void;
}

function StorageCapacityCardInner({
  isLoading,
  totalBytes,
  filesCount,
  storagePercentage,
  b2Status,
  b2Percentage,
  showB2FilesPanel,
  onCloseB2FilesPanel,
}: StorageCapacityCardProps) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs space-y-5 hover:border-[#CBD5E1] transition-all">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Gauge: Supabase Storage Bucket Capacity */}
        <div className="flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/20 shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                  Supabase Storage Bucket Capacity
                </h2>
                <p className="text-xs text-[#757680] mt-0.5 leading-relaxed">
                  1.0 GB active staging quota for shift logs (MLS/) and roll calls (RC/).
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="flex items-baseline gap-1 justify-end">
                {isLoading ? (
                  <Skeleton className="h-6 w-24 rounded-md" />
                ) : (
                  <>
                    <span className="text-lg font-black font-mono text-[#1E293B]">
                      {formatBytes(totalBytes)}
                    </span>
                    <span className="text-xs font-semibold text-[#757680]">/ 1.0 GB</span>
                  </>
                )}
              </div>
              {!isLoading && (
                <span className="text-[11px] font-semibold text-[#505F76]">
                  {storagePercentage.toFixed(1)}% Allocated · {filesCount} Files
                </span>
              )}
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="w-full h-2.5 rounded-full" />
          ) : (
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/60">
              <div
                className={`h-full transition-all duration-700 rounded-full ${
                  storagePercentage >= 90
                    ? 'bg-rose-600'
                    : storagePercentage >= 75
                    ? 'bg-amber-500'
                    : 'bg-linear-to-r from-[#004AC6] via-blue-500 to-sky-400'
                }`}
                style={{
                  width: `${
                    totalBytes > 0 ? Math.max(0.8, Math.min(100, storagePercentage)) : 0
                  }%`,
                }}
              />
            </div>
          )}
        </div>

        {/* Right Gauge: Backblaze B2 Cloud Vault Capacity */}
        <div className="flex flex-col justify-between space-y-4 pt-5 border-t border-[#E2E8F0] lg:pt-0 lg:border-t-0 lg:border-l lg:pl-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0">
                <CloudUpload className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                  Backblaze B2 Cloud Vault
                </h2>
                <p className="text-xs text-[#757680] mt-0.5 leading-relaxed">
                  Bucket:{' '}
                  <span className="font-mono font-semibold text-[#505F76]">
                    {b2Status.bucketName || 'pdrrmo-cebu-archives'}
                  </span>{' '}
                  · SHA-1 verified backup.
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="flex items-baseline gap-1 justify-end">
                {isLoading ? (
                  <Skeleton className="h-6 w-24 rounded-md" />
                ) : (
                  <>
                    <span className="text-lg font-black font-mono text-[#1E293B]">
                      {formatBytes(b2Status.totalBytes)}
                    </span>
                    <span className="text-xs font-semibold text-[#757680]">/ 10.0 GB</span>
                  </>
                )}
              </div>
              {!isLoading && (
                <span className="text-[11px] font-semibold text-[#505F76]">
                  {b2Percentage.toFixed(2)}% Allocated · {b2Status.totalFiles} Vault Files
                </span>
              )}
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="w-full h-2.5 rounded-full" />
          ) : (
            <div className="space-y-1.5">
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/60">
                <div
                  className="h-full bg-linear-to-r from-emerald-500 to-[#004AC6] rounded-full transition-all duration-500"
                  style={{
                    width: `${b2Status.totalBytes > 0 ? Math.max(b2Percentage, 0.8) : 0}%`,
                  }}
                />
              </div>
              {!b2Status.connected && (
                <p className="text-[11px] text-amber-700 font-medium">
                  {b2Status.errorMessage
                    ? `B2 Notice: ${b2Status.errorMessage}`
                    : 'Set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_BUCKET_NAME in .env.local'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Optional B2 Stored Files Browser (only expands if opened from transfer modal) */}
      {showB2FilesPanel && b2Status.files.length > 0 && (
        <div className="pt-4 border-t border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#505F76]">
            <span>
              Stored Files in Backblaze B2 ({Math.min(b2Status.files.length, 25)} of{' '}
              {b2Status.totalFiles})
            </span>
            <button
              type="button"
              onClick={onCloseB2FilesPanel}
              className="text-xs font-semibold text-[#004AC6] hover:underline cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {b2Status.files.slice(0, 25).map((bf) => (
              <div
                key={bf.fileId}
                className="flex items-center justify-between gap-2 bg-[#F8FAFC] border border-slate-200/80 rounded-xl px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-mono font-semibold text-[#1E293B] truncate">
                    {bf.fileName}
                  </span>
                  <span className="text-[10px] font-mono text-[#757680] shrink-0">
                    ({formatBytes(bf.contentLength)})
                  </span>
                </div>
                <a
                  href={`/api/archives/transfer?action=download&fileName=${encodeURIComponent(
                    bf.fileName
                  )}`}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#004AC6] hover:bg-blue-100 font-bold text-[11px] shrink-0 flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const StorageCapacityCard = memo(StorageCapacityCardInner);
