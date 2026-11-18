'use client';

import React, { memo, useState, useMemo, useDeferredValue } from 'react';
import {
  FileText,
  Radio,
  Search,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldCheck,
  CloudUpload,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/skeleton';
import { formatBytes } from '@/app/archives/_components/types';
import type { B2VaultFileItem, BucketMigrationFile } from './types';

interface B2VaultRowProps {
  file: B2VaultFileItem;
  bucketName: string;
}

const B2VaultFileRow = memo(function B2VaultFileRowInner({
  file,
  bucketName,
}: B2VaultRowProps) {
  const isRollCall = file.fileName.toLowerCase().startsWith('rc/');
  const baseName = file.fileName.split('/').pop() || file.fileName;
  const uploadedDate = new Date(file.uploadTimestamp || Date.now());
  const dateStr = !isNaN(uploadedDate.getTime())
    ? format(uploadedDate, 'MMM dd, yyyy · hh:mm a')
    : 'Backed up in B2';

  return (
    <tr className="hover:bg-[#F8FAFC]/80 transition-colors group">
      {/* File Name & B2 Path */}
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 bg-emerald-50 text-emerald-600 border-emerald-200/80">
            {isRollCall ? (
              <Radio className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-[#1E293B] group-hover:text-emerald-700 transition-colors font-mono text-xs sm:text-sm truncate">
              {baseName}
            </span>
            <span className="text-[11px] text-[#757680] font-mono truncate">
              {bucketName || 'pdrrmo-cebu-archives'}/{file.fileName}
            </span>
          </div>
        </div>
      </td>

      {/* Category Badge */}
      <td className="py-4 px-6">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
            isRollCall
              ? 'bg-sky-50 text-sky-700 border-sky-200'
              : 'bg-blue-50 text-[#004AC6] border-blue-200'
          }`}
        >
          {isRollCall ? 'Roll Call' : 'Shift Log'}
        </span>
      </td>

      {/* Integrity Digest / Vault */}
      <td className="py-4 px-6">
        <div className="flex flex-col">
          <span className="font-medium text-[#1E293B] text-xs">Backblaze B2 Private Vault</span>
          <span className="text-[11px] text-[#505F76] font-mono">
            sha1 · {file.contentSha1 ? file.contentSha1.slice(0, 12) : 'verified'}
          </span>
        </div>
      </td>

      {/* Upload Timestamp */}
      <td className="py-4 px-6 text-xs text-[#505F76]">
        <div className="flex items-center gap-1.5 font-medium">
          <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span>{dateStr}</span>
        </div>
      </td>

      {/* File Size & Download Action */}
      <td className="py-4 px-6 text-right">
        <div className="inline-flex items-center justify-end gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-[#1E293B] text-xs font-mono font-bold border border-slate-200">
            {formatBytes(file.contentLength)}
          </span>
          <a
            href={`/api/archives/transfer?action=download&fileName=${encodeURIComponent(
              file.fileName
            )}`}
            className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors inline-flex items-center gap-1"
            title={`Download ${baseName} from Backblaze B2`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </a>
        </div>
      </td>
    </tr>
  );
});

interface TransferFileRowProps {
  file: BucketMigrationFile;
  isSyncedInB2: boolean;
}

const TransferFileRow = memo(function TransferFileRowInner({
  file,
  isSyncedInB2,
}: TransferFileRowProps) {
  return (
    <tr className="hover:bg-[#F8FAFC]/80 transition-colors group">
      {/* File Name & Path */}
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
              file.category === 'log'
                ? 'bg-blue-50 text-[#004AC6] border-blue-200/70'
                : 'bg-sky-50 text-sky-700 border-sky-200/70'
            }`}
          >
            {file.category === 'log' ? (
              <FileText className="w-5 h-5" />
            ) : (
              <Radio className="w-5 h-5" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-[#1E293B] group-hover:text-[#004AC6] transition-colors font-mono text-xs sm:text-sm truncate">
              {file.filename}
            </span>
            <span className="text-[11px] text-[#757680] font-mono">
              archive-documents/{file.storagePath}
              {isSyncedInB2 && (
                <span className="text-emerald-600 font-semibold"> · In B2 Vault</span>
              )}
            </span>
          </div>
        </div>
      </td>

      {/* Category Badge */}
      <td className="py-4 px-6">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
            file.category === 'log'
              ? 'bg-blue-50 text-[#004AC6] border-blue-200'
              : 'bg-sky-50 text-sky-700 border-sky-200'
          }`}
        >
          {file.category === 'log' ? 'Shift Log' : 'Roll Call'}
        </span>
      </td>

      {/* Lead Officer & Shift */}
      <td className="py-4 px-6">
        <div className="flex flex-col">
          <span className="font-medium text-[#1E293B] text-xs">{file.leadOfficer}</span>
          <span className="text-[11px] text-[#505F76]">{file.shift}</span>
        </div>
      </td>

      {/* Timestamp */}
      <td className="py-4 px-6 text-xs text-[#505F76]">
        <div className="flex items-center gap-1.5 font-medium">
          <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span>{file.createdAt}</span>
        </div>
      </td>

      {/* File Size */}
      <td className="py-4 px-6 text-right">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-[#1E293B] text-xs font-mono font-bold border border-slate-200">
          {file.formattedSize}
        </span>
      </td>
    </tr>
  );
});

interface TransferFilesTableProps {
  filesList: BucketMigrationFile[];
  b2Files: B2VaultFileItem[];
  b2BucketName: string;
  logCount: number;
  rcCount: number;
  isLoading: boolean;
  b2ExistingPathSet: Set<string>;
}

const ITEMS_PER_PAGE = 8;

function TransferFilesTableInner({
  filesList,
  b2Files,
  b2BucketName,
  logCount,
  rcCount,
  isLoading,
  b2ExistingPathSet,
}: TransferFilesTableProps) {
  // Localize filter/search/pagination state inside the table card so typing or paging
  // never triggers re-renders of storage gauges, action toolbars, or modals.
  const [activeTab, setActiveTab] = useState<'all' | 'log' | 'roll-call' | 'b2'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [currentPage, setCurrentPage] = useState(1);

  const searchableFiles = useMemo(() => {
    return filesList.map((f) => ({
      file: f,
      haystack: `${f.filename} ${f.leadOfficer} ${f.shift} ${f.hash}`.toLowerCase(),
      b2Path: f.storagePath.trim().toLowerCase(),
      b2AltPath: `${f.category === 'roll-call' ? 'rc' : 'mls'}/${f.filename.trim().toLowerCase()}`,
    }));
  }, [filesList]);

  const searchableB2Files = useMemo(() => {
    return b2Files.map((bf) => ({
      file: bf,
      haystack: `${bf.fileName} ${bf.contentSha1} ${b2BucketName}`.toLowerCase(),
    }));
  }, [b2Files, b2BucketName]);

  const filteredSupabaseItems = useMemo(() => {
    if (activeTab === 'b2') return [];
    const q = deferredSearch.toLowerCase().trim();
    return searchableFiles.filter(({ file, haystack }) => {
      if (activeTab !== 'all' && file.category !== activeTab) return false;
      if (q && !haystack.includes(q)) return false;
      return true;
    });
  }, [searchableFiles, activeTab, deferredSearch]);

  const filteredB2Items = useMemo(() => {
    if (activeTab !== 'b2') return [];
    const q = deferredSearch.toLowerCase().trim();
    if (!q) return searchableB2Files;
    return searchableB2Files.filter(({ haystack }) => haystack.includes(q));
  }, [searchableB2Files, activeTab, deferredSearch]);

  const totalMatchingCount =
    activeTab === 'b2' ? filteredB2Items.length : filteredSupabaseItems.length;
  const totalPages = Math.max(1, Math.ceil(totalMatchingCount / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedSupabaseItems = useMemo(() => {
    if (activeTab === 'b2') return [];
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredSupabaseItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSupabaseItems, activeTab, safePage]);

  const paginatedB2Items = useMemo(() => {
    if (activeTab !== 'b2') return [];
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredB2Items.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredB2Items, activeTab, safePage]);

  return (
    <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
      {/* Controls Bar */}
      <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white">
        {/* Segmented Filter Tabs */}
        <div className="flex flex-wrap bg-[#F1F5F9] p-1.5 rounded-3xl sm:rounded-full self-start border border-[#E2E8F0]/70 gap-1 sm:gap-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-white text-[#004AC6] shadow-xs'
                : 'text-[#505F76] hover:text-[#1E293B]'
            }`}
          >
            <span>All Files</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'all'
                  ? 'bg-[#004AC6]/10 text-[#004AC6]'
                  : 'bg-slate-200 text-[#505F76]'
              }`}
            >
              {filesList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('log');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'log'
                ? 'bg-white text-[#004AC6] shadow-xs'
                : 'text-[#505F76] hover:text-[#1E293B]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Shift Logs</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'log'
                  ? 'bg-[#004AC6]/10 text-[#004AC6]'
                  : 'bg-slate-200 text-[#505F76]'
              }`}
            >
              {logCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('roll-call');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'roll-call'
                ? 'bg-white text-[#004AC6] shadow-xs'
                : 'text-[#505F76] hover:text-[#1E293B]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Roll Calls</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'roll-call'
                  ? 'bg-[#004AC6]/10 text-[#004AC6]'
                  : 'bg-slate-200 text-[#505F76]'
              }`}
            >
              {rcCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('b2');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'b2'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-[#505F76] hover:text-[#1E293B]'
            }`}
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Backblaze B2</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'b2'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-[#505F76]'
              }`}
            >
              {b2Files.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 lg:max-w-md">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={
              activeTab === 'b2'
                ? 'Search Backblaze B2 files or SHA-1 hash...'
                : 'Search files by name, officer, shift...'
            }
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 pl-10 pr-9 text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E293B] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider">
              <th className="py-4 px-6">File Name & Route</th>
              <th className="py-4 px-6">Category</th>
              <th className="py-4 px-6">
                {activeTab === 'b2' ? 'Cloud Vault & Integrity' : 'Lead Officer & Shift'}
              </th>
              <th className="py-4 px-6">
                {activeTab === 'b2' ? 'B2 Upload Timestamp' : 'Recorded Timestamp'}
              </th>
              <th className="py-4 px-6 text-right">
                {activeTab === 'b2' ? 'Size & Download' : 'File Size'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] text-sm">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-2xl" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-48 rounded" />
                        <Skeleton className="h-3 w-28 rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-4 w-32 rounded" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-4 w-28 rounded" />
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Skeleton className="h-4 w-16 rounded ml-auto" />
                  </td>
                </tr>
              ))
            ) : activeTab === 'b2' && paginatedB2Items.length > 0 ? (
              paginatedB2Items.map(({ file }) => (
                <B2VaultFileRow
                  key={file.fileId}
                  file={file}
                  bucketName={b2BucketName}
                />
              ))
            ) : activeTab !== 'b2' && paginatedSupabaseItems.length > 0 ? (
              paginatedSupabaseItems.map(({ file, b2Path, b2AltPath }) => (
                <TransferFileRow
                  key={file.id}
                  file={file}
                  isSyncedInB2={
                    b2ExistingPathSet.has(b2Path) || b2ExistingPathSet.has(b2AltPath)
                  }
                />
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-[#1E293B]">
                      {searchQuery
                        ? 'No Matching Files Found'
                        : activeTab === 'b2'
                        ? 'No Files in Backblaze B2 Yet'
                        : 'Storage Bucket is 100% Free!'}
                    </h3>
                    <p className="text-xs text-[#757680] leading-relaxed">
                      {searchQuery
                        ? `No files match "${searchQuery}". Try clearing your search query.`
                        : activeTab === 'b2'
                        ? 'Click "Transfer to Backblaze B2" above to back up your official PDFs into your private cloud vault.'
                        : 'All certified documents have been migrated or cleared. The 1.0 GB storage bucket has maximum free capacity.'}
                    </p>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-xs font-bold text-[#004AC6] hover:underline cursor-pointer"
                      >
                        Clear Search Query
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 sm:p-5 border-t border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <span className="text-xs text-[#505F76]">
            Showing page <strong className="text-[#1E293B]">{safePage}</strong> of{' '}
            <strong className="text-[#1E293B]">{totalPages}</strong> ({totalMatchingCount} files)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-xl border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#004AC6] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-[#1E293B] px-2">{safePage}</span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 rounded-xl border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#004AC6] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const TransferFilesTable = memo(TransferFilesTableInner);
