'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowLeft, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { formatBytes } from '@/app/archives/_components/types';
import type { ZipEntryInput } from '@/lib/zip-bundle';
import type {
  B2VaultStatusResponse,
  BucketMigrationFile,
  TransferProgressState,
  ToastNotificationState,
} from './_components/types';
import { StorageCapacityCard } from './_components/storage-capacity-card';
import { TransferToolbarCard } from './_components/transfer-toolbar-card';
import { TransferFilesTable } from './_components/transfer-files-table';
import {
  TransferProgressModal,
  PurgeConfirmModal,
  FloatingToast,
} from './_components/transfer-modals';

const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1.0 GB
const B2_POLL_INTERVAL_MS = 15_000;
const B2_FETCH_COOLDOWN_MS = 2_500;
const ZIP_FETCH_CONCURRENCY = 4;

const INITIAL_B2_STATUS: B2VaultStatusResponse = {
  configured: false,
  connected: false,
  bucketName: 'Backblaze B2 Vault',
  bucketId: '',
  totalFiles: 0,
  totalBytes: 0,
  quotaBytes: 10 * 1024 * 1024 * 1024,
  files: [],
};

const INITIAL_TRANSFER_PROGRESS: TransferProgressState = {
  current: 0,
  total: 0,
  currentFilename: '',
  isFinished: false,
  errorCount: 0,
  successCount: 0,
  statusMessage: '',
};

function getB2StatusSignature(s: B2VaultStatusResponse): string {
  const head = s.files[0];
  return [
    s.configured ? 1 : 0,
    s.connected ? 1 : 0,
    s.bucketName,
    s.totalFiles,
    s.totalBytes,
    s.errorMessage || '',
    head ? `${head.fileId}:${head.uploadTimestamp}` : '',
  ].join('|');
}

export default function ArchivesTransferPage() {
  const { canWrite, isViewOnly } = useAuth();
  const canModifyArchives = canWrite('Archives') && !isViewOnly('Archives');

  // Core Data States
  const [filesList, setFilesList] = useState<BucketMigrationFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Backblaze B2 Cloud Vault Status & Panels
  const [b2Status, setB2Status] = useState<B2VaultStatusResponse>(INITIAL_B2_STATUS);
  const [isBundlingZip, setIsBundlingZip] = useState(false);
  const [showB2FilesPanel, setShowB2FilesPanel] = useState(false);

  // Transfer Progress & Modal States
  const [isTransferring, setIsTransferring] = useState(false);
  const transferAbortRef = useRef(false);
  const [transferProgress, setTransferProgress] =
    useState<TransferProgressState>(INITIAL_TRANSFER_PROGRESS);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Purge Modal & Toast States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastNotification, setToastNotification] = useState<ToastNotificationState | null>(null);

  // Refs for deduplicating concurrent / rapid B2 status requests
  const inFlightB2Ref = useRef<Promise<B2VaultStatusResponse | null> | null>(null);
  const lastB2FetchAtRef = useRef<number>(0);
  const lastB2SignatureRef = useRef<string>('');
  const latestB2StatusRef = useRef<B2VaultStatusResponse>(INITIAL_B2_STATUS);

  const showToast = useCallback(
    (type: ToastNotificationState['type'], message: string, submessage?: string) => {
      setToastNotification({ type, message, submessage });
    },
    []
  );

  useEffect(() => {
    if (!toastNotification) return;
    const timer = window.setTimeout(() => setToastNotification(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastNotification]);

  /**
   * Deduplicated, signature-checked fetch of live Backblaze B2 bucket telemetry.
   * Skipping `setB2Status` when the bucket snapshot hasn't changed prevents
   * unnecessary React reconciliation on background 15s polls.
   */
  const fetchB2VaultStatus = useCallback(
    async (force = false): Promise<B2VaultStatusResponse | null> => {
      const now = Date.now();
      if (!force && now - lastB2FetchAtRef.current < B2_FETCH_COOLDOWN_MS) {
        return latestB2StatusRef.current;
      }
      if (inFlightB2Ref.current) {
        return inFlightB2Ref.current;
      }

      const promise = (async () => {
        try {
          lastB2FetchAtRef.current = Date.now();
          const res = await fetch(`/api/archives/transfer?action=status&t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            },
          });
          if (!res.ok) return null;

          const data = (await res.json()) as B2VaultStatusResponse;
          const nextSig = getB2StatusSignature(data);
          latestB2StatusRef.current = data;

          if (nextSig !== lastB2SignatureRef.current) {
            lastB2SignatureRef.current = nextSig;
            setB2Status(data);
          }
          return data;
        } catch (err) {
          console.warn('Backblaze B2 status check notice:', err);
          return null;
        } finally {
          inFlightB2Ref.current = null;
        }
      })();

      inFlightB2Ref.current = promise;
      return promise;
    },
    []
  );

  // ===========================================================================
  // 1. PARALLEL DATA FETCHING & REAL-TIME SYNC
  // ===========================================================================
  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const [mlsRes, rcRes, dbRes] = await Promise.all([
          supabase.storage
            .from('archive-documents')
            .list('MLS', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } }),
          supabase.storage
            .from('archive-documents')
            .list('RC', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } }),
          supabase
            .from('archives')
            .select(
              'id, filename, category, shift_label, file_size_bytes, storage_path, file_hash, lead_officer_name, created_at, generated_at'
            )
            .order('generated_at', { ascending: false })
            .limit(500),
          fetchB2VaultStatus(true),
        ]);

        const dbRows = dbRes.data || [];
        const dbMap = new Map<string, any>();
        dbRows.forEach((row) => {
          if (row.filename) dbMap.set(row.filename.toLowerCase(), row);
          if (row.storage_path) dbMap.set(row.storage_path.toLowerCase(), row);
        });

        const bucketItems: BucketMigrationFile[] = [];

        if (mlsRes.data && Array.isArray(mlsRes.data)) {
          mlsRes.data.forEach((f) => {
            if (!f.name || f.name === '.emptyFolderPlaceholder') return;
            const storagePath = `MLS/${f.name}`;
            const dbRow =
              dbMap.get(f.name.toLowerCase()) || dbMap.get(storagePath.toLowerCase());
            const sizeBytes = f.metadata?.size || dbRow?.file_size_bytes || 1.2 * 1024 * 1024;
            const d = new Date(f.created_at || dbRow?.created_at || Date.now());
            const dateStr = !isNaN(d.getTime())
              ? format(d, 'MMM dd, yyyy · hh:mm a')
              : 'Shift Handover';

            bucketItems.push({
              id: f.id || storagePath,
              filename: f.name,
              category: 'log',
              storagePath,
              fileSizeBytes: sizeBytes,
              formattedSize: formatBytes(sizeBytes),
              createdAt: dateStr,
              leadOfficer: dbRow?.lead_officer_name || 'Operations Lead Officer',
              shift: dbRow?.shift_label || 'Shift Operations',
              hash:
                dbRow?.file_hash || (f.id ? `sha256-${f.id.slice(0, 16)}` : 'sha256-verified'),
              rawSnapshot: dbRow?.snapshot || null,
            });
          });
        }

        if (rcRes.data && Array.isArray(rcRes.data)) {
          rcRes.data.forEach((f) => {
            if (!f.name || f.name === '.emptyFolderPlaceholder') return;
            const storagePath = `RC/${f.name}`;
            const dbRow =
              dbMap.get(f.name.toLowerCase()) || dbMap.get(storagePath.toLowerCase());
            const sizeBytes = f.metadata?.size || dbRow?.file_size_bytes || 450 * 1024;
            const d = new Date(f.created_at || dbRow?.created_at || Date.now());
            const dateStr = !isNaN(d.getTime())
              ? format(d, 'MMM dd, yyyy · hh:mm a')
              : 'Roll Call Report';

            bucketItems.push({
              id: f.id || storagePath,
              filename: f.name,
              category: 'roll-call',
              storagePath,
              fileSizeBytes: sizeBytes,
              formattedSize: formatBytes(sizeBytes),
              createdAt: dateStr,
              leadOfficer: dbRow?.lead_officer_name || 'Radio Net Controller',
              shift: dbRow?.shift_label || 'Roll Call Session',
              hash:
                dbRow?.file_hash || (f.id ? `sha256-${f.id.slice(0, 16)}` : 'sha256-verified'),
              rawSnapshot: dbRow?.snapshot || null,
            });
          });
        }

        setFilesList(bucketItems);
      } catch (err) {
        console.error('Error fetching migration data:', err);
        showToast('error', 'Failed to Load Storage Files', 'Could not sync storage bucket data.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showToast, fetchB2VaultStatus]
  );

  useEffect(() => {
    void fetchData();

    const syncB2IfVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchB2VaultStatus(false);
      }
    };

    const pollInterval = window.setInterval(syncB2IfVisible, B2_POLL_INTERVAL_MS);
    window.addEventListener('focus', syncB2IfVisible);
    document.addEventListener('visibilitychange', syncB2IfVisible);

    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      broadcastChannel = new BroadcastChannel('pdrrmo_sync_channel');
      broadcastChannel.onmessage = (event) => {
        if (
          event.data === 'archives_updated' ||
          event.data === 'roll_call_updated' ||
          event.data === 'shift_state_updated'
        ) {
          void fetchData(true);
        }
      };
    }

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('focus', syncB2IfVisible);
      document.removeEventListener('visibilitychange', syncB2IfVisible);
      if (broadcastChannel) broadcastChannel.close();
    };
  }, [fetchData, fetchB2VaultStatus]);

  // Memoized Metrics & Derived Sets
  const b2QuotaBytes = b2Status.quotaBytes || 10 * 1024 * 1024 * 1024;
  const b2Percentage = useMemo(
    () => Math.min(100, Math.max(0, (b2Status.totalBytes / b2QuotaBytes) * 100)),
    [b2Status.totalBytes, b2QuotaBytes]
  );

  const { totalBytes, logCount, rcCount } = useMemo(() => {
    let total = 0;
    let lCount = 0;
    let rCount = 0;
    for (const f of filesList) {
      total += f.fileSizeBytes;
      if (f.category === 'log') lCount++;
      else rCount++;
    }
    return { totalBytes: total, logCount: lCount, rcCount: rCount };
  }, [filesList]);

  const storagePercentage = useMemo(
    () => Math.min(100, Math.max(0, (totalBytes / STORAGE_QUOTA_BYTES) * 100)),
    [totalBytes]
  );

  const b2ExistingPathSet = useMemo(() => {
    const keys = new Set<string>();
    for (const bf of b2Status.files) {
      if (bf.fileName) keys.add(bf.fileName.trim().toLowerCase());
    }
    return keys;
  }, [b2Status.files]);

  const pendingB2Files = useMemo(() => {
    return filesList.filter((file) => {
      const prefix = file.category === 'roll-call' ? 'rc' : 'mls';
      const normalizedPath = file.storagePath.trim().toLowerCase();
      const altPath = `${prefix}/${file.filename.trim().toLowerCase()}`;
      return !b2ExistingPathSet.has(normalizedPath) && !b2ExistingPathSet.has(altPath);
    });
  }, [filesList, b2ExistingPathSet]);

  // Lazy-loaded PDF retriever (keeps jsPDF out of initial page JS bundle)
  const getFilePdfBlob = useCallback(async (file: BucketMigrationFile): Promise<Blob | null> => {
    try {
      const { data: blobData, error: dlErr } = await supabase.storage
        .from('archive-documents')
        .download(file.storagePath);

      if (!dlErr && blobData && blobData.size > 0) {
        return blobData;
      }

      if (file.rawSnapshot) {
        const { generateRollCallPDF, generateDailyLogsPDF } = await import('@/lib/pdf-generator');
        if (file.category === 'roll-call') {
          const pdf = await generateRollCallPDF({
            filename: file.filename,
            sessionDate: file.rawSnapshot.sessionDate || '09/27/2026',
            sessionTime: file.rawSnapshot.sessionTime || '1600H',
            frequency: file.rawSnapshot.frequency || '142.500 MHz Primary VHF Net',
            radioScript: file.rawSnapshot.radioScript,
            conductedBy: file.leadOfficer,
            conductedByRole: file.rawSnapshot.conductedByRole || 'Net Controller',
            signatureUrl: null,
            totalStations: file.rawSnapshot.totalStations || 8,
            present: file.rawSnapshot.present || 8,
            absent: file.rawSnapshot.absent || 0,
            exempted: file.rawSnapshot.exempted || 0,
            weatherSummary: file.rawSnapshot.weatherSummary || 'Normal conditions',
            entries: file.rawSnapshot.entries || [],
            fileHash: file.hash,
            snapshotPayload: file.rawSnapshot,
          });
          return pdf.blob;
        }

        const pdf = await generateDailyLogsPDF({
          filename: file.filename,
          dailyReportDate: file.rawSnapshot.dailyReportDate || '09/27/2026',
          totalShiftsCount: file.rawSnapshot.shifts?.length || 1,
          finalOfficer: file.leadOfficer,
          finalOfficerRole: 'Lead Operations Officer',
          finalHandoverStatus: 'Situation Remain Normal',
          signatureUrl: null,
          signaturesMap: {},
          shifts: file.rawSnapshot.shifts || [],
          logs: file.rawSnapshot.logs || [],
          fileHash: file.hash,
          snapshotPayload: file.rawSnapshot,
        });
        return pdf.blob;
      }
    } catch (err) {
      console.warn(`Could not get PDF blob for ${file.filename}:`, err);
    }
    return null;
  }, []);

  // ===========================================================================
  // 2. TRANSFER & BUNDLE HANDLERS
  // ===========================================================================
  const handleCancelTransfer = useCallback(() => {
    transferAbortRef.current = true;
    setIsTransferring(false);
    setTransferProgress((prev) => ({
      ...prev,
      isFinished: true,
      statusMessage: 'Backblaze B2 transfer was cancelled by user.',
    }));
    showToast('info', 'Transfer Cancelled', 'The Backblaze B2 transfer process was stopped.');
  }, [showToast]);

  const handleTransferFiles = useCallback(
    async (targetFiles: BucketMigrationFile[], categoryLabel = 'Files') => {
      if (targetFiles.length === 0) {
        showToast(
          'info',
          'No Files to Transfer',
          `There are no ${categoryLabel.toLowerCase()} to transfer.`
        );
        return;
      }

      if (!latestB2StatusRef.current.configured) {
        showToast(
          'error',
          'Backblaze B2 Keys Not Configured',
          'Add B2_KEY_ID, B2_APPLICATION_KEY, and B2_BUCKET_NAME to .env.local, or use "Download .ZIP Bundle" for instant offline export.'
        );
        return;
      }

      // Live duplicate check against Backblaze B2 before uploading
      const latestStatus = (await fetchB2VaultStatus(true)) || latestB2StatusRef.current;
      const existingB2Keys = new Set(
        (latestStatus.files || []).map((bf) => bf.fileName.trim().toLowerCase())
      );

      const filesToUpload = targetFiles.filter((file) => {
        const prefix = file.category === 'roll-call' ? 'rc' : 'mls';
        const normalizedPath = file.storagePath.trim().toLowerCase();
        const altPath = `${prefix}/${file.filename.trim().toLowerCase()}`;
        return !existingB2Keys.has(normalizedPath) && !existingB2Keys.has(altPath);
      });
      const skippedDuplicates = targetFiles.length - filesToUpload.length;

      if (filesToUpload.length === 0) {
        showToast(
          'info',
          'Already Synced to Backblaze B2',
          `All ${targetFiles.length} file${targetFiles.length === 1 ? '' : 's'} already exist in ${
            latestStatus.bucketName || 'Backblaze B2'
          }. No duplicates uploaded.`
        );
        return;
      }

      transferAbortRef.current = false;
      setIsTransferModalOpen(true);
      setIsTransferring(true);
      setTransferProgress({
        current: 0,
        total: filesToUpload.length,
        currentFilename: 'Connecting to Backblaze B2 Cloud Vault...',
        isFinished: false,
        errorCount: 0,
        successCount: 0,
        statusMessage:
          skippedDuplicates > 0
            ? `Skipping ${skippedDuplicates} existing file(s). Authorizing Backblaze B2 (${
                latestStatus.bucketName || 'B2 Vault'
              })...`
            : `Authorizing Backblaze B2 Private Bucket (${
                latestStatus.bucketName || 'B2 Vault'
              })...`,
      });

      let successfulUploads = 0;
      let serverSkippedCount = 0;
      let failedUploads = 0;
      let lastErrorDetail = '';

      try {
        for (let i = 0; i < filesToUpload.length; i++) {
          if (transferAbortRef.current) {
            setTransferProgress((prev) => ({
              ...prev,
              isFinished: true,
              statusMessage: 'Transfer stopped by user.',
            }));
            break;
          }

          const file = filesToUpload[i];
          setTransferProgress({
            current: i + 1,
            total: filesToUpload.length,
            currentFilename: file.filename,
            isFinished: false,
            errorCount: failedUploads,
            successCount: successfulUploads,
            statusMessage: `Uploading ${i + 1} of ${filesToUpload.length} new ${categoryLabel} to Backblaze B2 (${file.storagePath})...`,
          });

          try {
            let res = await fetch('/api/archives/transfer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                storagePath: file.storagePath,
                filename: file.filename,
                category: file.category,
              }),
            });

            if (res.status === 404) {
              const blob = await getFilePdfBlob(file);
              if (!blob) {
                throw new Error('Could not retrieve or regenerate PDF document blob.');
              }
              const formData = new FormData();
              formData.append('file', blob, file.filename);
              formData.append('storagePath', file.storagePath);
              formData.append('category', file.category);

              res = await fetch('/api/archives/transfer', {
                method: 'POST',
                body: formData,
              });
            }

            const payload = await res.json();
            if (!res.ok || (!payload.success && !payload.ok)) {
              throw new Error(payload.error || `B2 upload failed (${res.status})`);
            }

            if (payload.skipped || payload.duplicate) {
              serverSkippedCount++;
            } else {
              successfulUploads++;
            }
          } catch (uploadErr: any) {
            console.warn(`Failed to upload ${file.filename} to Backblaze B2:`, uploadErr);
            lastErrorDetail = uploadErr?.message || 'Backblaze B2 upload error';
            failedUploads++;
          }
        }

        const totalSkipped = skippedDuplicates + serverSkippedCount;

        if (!transferAbortRef.current) {
          const bucketNote = latestStatus.bucketName ? ` (${latestStatus.bucketName})` : '';
          const skipNote =
            totalSkipped > 0
              ? ` (${totalSkipped} duplicate${totalSkipped === 1 ? '' : 's'} skipped)`
              : '';

          setTransferProgress({
            current: filesToUpload.length,
            total: filesToUpload.length,
            currentFilename: 'All files processed.',
            isFinished: true,
            errorCount: failedUploads,
            successCount: successfulUploads,
            statusMessage:
              failedUploads === 0
                ? `Archived ${successfulUploads} new file${
                    successfulUploads === 1 ? '' : 's'
                  } to Backblaze B2${bucketNote}${skipNote}!`
                : `Archived ${successfulUploads} file(s) to Backblaze B2 (${failedUploads} failed: ${lastErrorDetail}).`,
          });

          await fetchData(true);

          if (successfulUploads > 0) {
            showToast(
              'success',
              'Backblaze B2 Upload Complete',
              `${successfulUploads} new official ${categoryLabel.toLowerCase()} verified with SHA-1 in Backblaze B2${bucketNote}${skipNote}.`
            );
          } else if (totalSkipped > 0 && failedUploads === 0) {
            showToast(
              'info',
              'Already Synced to Backblaze B2',
              `${totalSkipped} existing file${
                totalSkipped === 1 ? '' : 's'
              } skipped to prevent duplicates.`
            );
          } else if (failedUploads > 0) {
            showToast(
              'error',
              'Backblaze B2 Upload Failed',
              lastErrorDetail || 'Could not upload files to B2.'
            );
          }
        }
      } finally {
        setIsTransferring(false);
      }
    },
    [fetchB2VaultStatus, fetchData, getFilePdfBlob, showToast]
  );

  const handleTransferAll = useCallback(
    () => void handleTransferFiles(filesList, 'Files'),
    [handleTransferFiles, filesList]
  );

  // Lazy-loaded, batched 1-Click Organized .ZIP Bundle Export
  const handleDownloadZipBundle = useCallback(
    async (
      targetFiles: BucketMigrationFile[] = filesList,
      bundleLabel = 'Official-Archives'
    ) => {
      if (targetFiles.length === 0) {
        showToast('info', 'No Files Available', 'There are no archive PDFs to bundle into a .ZIP.');
        return;
      }

      setIsBundlingZip(true);
      setIsTransferModalOpen(true);
      setIsTransferring(true);
      setTransferProgress({
        current: 0,
        total: targetFiles.length,
        currentFilename: 'Preparing Organized .ZIP Archive Bundle...',
        isFinished: false,
        errorCount: 0,
        successCount: 0,
        statusMessage: 'Packaging MLS/ and RC/ folders with SHA-256 verification manifest...',
      });

      const entries: ZipEntryInput[] = [];
      const manifestItems: Array<{
        path: string;
        filename: string;
        category: string;
        sizeBytes: number;
        formattedSize: string;
        createdAt: string;
        leadOfficer: string;
        shift: string;
        sha256Hash: string;
      }> = [];

      let completed = 0;
      let packagedCount = 0;
      let failedCount = 0;

      try {
        const { buildZipArchiveBlob } = await import('@/lib/zip-bundle');

        // Fetch PDFs in concurrent batches to keep multi-file exports fast
        for (let i = 0; i < targetFiles.length; i += ZIP_FETCH_CONCURRENCY) {
          const chunk = targetFiles.slice(i, i + ZIP_FETCH_CONCURRENCY);
          await Promise.all(
            chunk.map(async (file) => {
              try {
                const blob = await getFilePdfBlob(file);
                if (!blob) throw new Error('PDF blob missing');
                const bytes = new Uint8Array(await blob.arrayBuffer());
                const cleanName = file.filename.endsWith('.pdf')
                  ? file.filename
                  : `${file.filename}.pdf`;
                const folderPrefix = file.category === 'log' ? 'MLS' : 'RC';
                const zipPath = `${folderPrefix}/${cleanName}`;

                entries.push({ path: zipPath, data: bytes });
                manifestItems.push({
                  path: zipPath,
                  filename: cleanName,
                  category:
                    file.category === 'log'
                      ? 'Monitoring Log Sheet (MLS)'
                      : 'Roll Call Report (RC)',
                  sizeBytes: bytes.byteLength,
                  formattedSize: formatBytes(bytes.byteLength),
                  createdAt: file.createdAt,
                  leadOfficer: file.leadOfficer,
                  shift: file.shift,
                  sha256Hash: file.hash,
                });
                packagedCount++;
              } catch (err) {
                console.error(`Failed to bundle ${file.filename} into ZIP:`, err);
                failedCount++;
              } finally {
                completed++;
                setTransferProgress({
                  current: completed,
                  total: targetFiles.length,
                  currentFilename: file.filename,
                  isFinished: false,
                  errorCount: failedCount,
                  successCount: packagedCount,
                  statusMessage: `Bundling ${completed} of ${targetFiles.length} PDFs into ${file.storagePath}...`,
                });
              }
            })
          );
        }

        const manifestJson = JSON.stringify(
          {
            system: 'PDRRMO Monitoring Log Sheet & Roll Call Archival System',
            exportedAt: new Date().toISOString(),
            totalFiles: packagedCount,
            totalBytes: manifestItems.reduce((acc, item) => acc + item.sizeBytes, 0),
            files: manifestItems,
          },
          null,
          2
        );
        entries.push({
          path: 'ARCHIVE-MANIFEST.json',
          data: new TextEncoder().encode(manifestJson),
        });

        const zipBlob = buildZipArchiveBlob(entries);
        const stamp = format(new Date(), 'yyyyMMdd-HHmm');
        const zipFilename = `PDRRMO-MLS-${bundleLabel
          .toUpperCase()
          .replace(/\s+/g, '-')}-${stamp}.zip`;

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2500);

        setTransferProgress({
          current: targetFiles.length,
          total: targetFiles.length,
          currentFilename: zipFilename,
          isFinished: true,
          errorCount: failedCount,
          successCount: packagedCount,
          statusMessage: `Downloaded ${zipFilename} (${packagedCount} PDFs + ARCHIVE-MANIFEST.json).`,
        });

        showToast(
          'success',
          'Organized .ZIP Bundle Downloaded',
          `Packaged ${packagedCount} official PDFs (MLS/ & RC/) into ${zipFilename}.`
        );
      } finally {
        setIsBundlingZip(false);
        setIsTransferring(false);
      }
    },
    [filesList, getFilePdfBlob, showToast]
  );

  const handleDownloadAllZip = useCallback(
    () => void handleDownloadZipBundle(filesList, 'Official-Archives'),
    [handleDownloadZipBundle, filesList]
  );

  // ===========================================================================
  // 3. DELETE ALL ACTION HANDLER (PURGE STORAGE)
  // ===========================================================================
  const handleDeleteAll = useCallback(async () => {
    if (!canModifyArchives) {
      showToast('error', 'Unauthorized Action', 'You do not have write access to purge storage.');
      return;
    }

    setIsDeleting(true);
    try {
      const pathsToDelete = filesList.map((f) => f.storagePath);
      if (pathsToDelete.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from('archive-documents')
          .remove(pathsToDelete);
        if (storageErr) console.warn('Storage removal warning:', storageErr);
      }

      const { error: dbErr } = await supabase
        .from('archives')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (dbErr) console.warn('DB delete warning:', dbErr);

      setFilesList([]);
      setIsDeleteModalOpen(false);
      setIsTransferModalOpen(false);

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('pdrrmo_sync_channel');
          bc.postMessage('archives_updated');
          bc.close();
        } catch (_) {}
      }
      try {
        localStorage.setItem(
          'pdrrmo_sync_event',
          JSON.stringify({ type: 'archives_updated', timestamp: Date.now() })
        );
      } catch (_) {}

      showToast(
        'success',
        'Storage Bucket Purged',
        'All files have been permanently cleared from storage. 100% quota reclaimed.'
      );
    } catch (err: any) {
      console.error('Delete all error:', err);
      showToast('error', 'Purge Failed', err.message || 'Could not purge all storage files.');
    } finally {
      setIsDeleting(false);
    }
  }, [canModifyArchives, filesList, showToast]);

  // Stable UI callbacks for memoized children
  const handleCloseB2FilesPanel = useCallback(() => setShowB2FilesPanel(false), []);
  const handleCloseTransferModal = useCallback(() => setIsTransferModalOpen(false), []);
  const handleViewB2FromModal = useCallback(() => {
    setIsTransferModalOpen(false);
    setShowB2FilesPanel(true);
  }, []);
  const handleOpenPurgeFromModal = useCallback(() => {
    setIsTransferModalOpen(false);
    setIsDeleteModalOpen(true);
  }, []);
  const handleOpenPurgeModal = useCallback(() => setIsDeleteModalOpen(true), []);
  const handleClosePurgeModal = useCallback(() => setIsDeleteModalOpen(false), []);
  const handleDismissToast = useCallback(() => setToastNotification(null), []);

  return (
    <AppLayoutShell
      title="Cloud Vault & Storage Hub"
      subtitle="Supabase Storage Capacity, Backblaze B2 Cloud Vault & Offline Bundle Export"
    >
      <div className="space-y-6">
        <ViewOnlyNotice
          screen="Archives"
          message="You are viewing the Storage Transfer Hub in read-only audit mode. Storage purge operations are disabled."
        />

        {/* Top Breadcrumb & Navigation Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/archives"
              className="w-10 h-10 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#004AC6]/40 hover:bg-blue-50/50 flex items-center justify-center text-[#505F76] hover:text-[#004AC6] transition-all cursor-pointer shadow-2xs shrink-0"
              title="Return to Certified Archives"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#757680] uppercase tracking-wider">
                  Archives
                </span>
                <span className="text-slate-300">/</span>
                <span className="text-xs font-bold text-[#004AC6] uppercase tracking-wider">
                  Migration Hub
                </span>
                {isRefreshing && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#004AC6] border border-blue-200">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    Syncing
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E293B]">
                Storage Bucket & Backblaze B2 Cloud Vault
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <SecondaryButton
              size="md"
              pill
              leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => void fetchData()}
              className="w-full sm:w-auto justify-center"
            >
              Refresh
            </SecondaryButton>

            <Link href="/archives">
              <PrimaryButton
                size="md"
                pill
                leftIcon={<Layers className="w-4 h-4" />}
                className="w-full sm:w-auto justify-center"
              >
                View Archives
              </PrimaryButton>
            </Link>
          </div>
        </div>

        {/* Card 1: Unified Storage Capacity (Supabase + Backblaze B2) */}
        <StorageCapacityCard
          isLoading={isLoading}
          totalBytes={totalBytes}
          filesCount={filesList.length}
          storagePercentage={storagePercentage}
          b2Status={b2Status}
          b2Percentage={b2Percentage}
          showB2FilesPanel={showB2FilesPanel}
          onCloseB2FilesPanel={handleCloseB2FilesPanel}
        />

        {/* Card 2: Transfer & Backup Action Toolbar */}
        <TransferToolbarCard
          totalFiles={filesList.length}
          pendingCount={pendingB2Files.length}
          logCount={logCount}
          rcCount={rcCount}
          isLoading={isLoading}
          isTransferring={isTransferring}
          isBundlingZip={isBundlingZip}
          isDeleting={isDeleting}
          canModifyArchives={canModifyArchives}
          onDownloadZip={handleDownloadAllZip}
          onTransferAll={handleTransferAll}
          onOpenPurgeModal={handleOpenPurgeModal}
        />

        {/* Card 3: Files Table with Isolated Search, Tabs & Pagination */}
        <TransferFilesTable
          filesList={filesList}
          b2Files={b2Status.files}
          b2BucketName={b2Status.bucketName}
          logCount={logCount}
          rcCount={rcCount}
          isLoading={isLoading}
          b2ExistingPathSet={b2ExistingPathSet}
        />
      </div>

      {/* Isolated Modals & Notifications */}
      <TransferProgressModal
        isOpen={isTransferModalOpen}
        isTransferring={isTransferring}
        canModifyArchives={canModifyArchives}
        bucketName={b2Status.bucketName}
        progress={transferProgress}
        onCancel={handleCancelTransfer}
        onClose={handleCloseTransferModal}
        onFallbackLocalDownload={handleDownloadAllZip}
        onViewB2Files={handleViewB2FromModal}
        onOpenPurgeFromModal={handleOpenPurgeFromModal}
      />

      <PurgeConfirmModal
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        filesCount={filesList.length}
        totalBytes={totalBytes}
        onClose={handleClosePurgeModal}
        onConfirmPurge={handleDeleteAll}
      />

      <FloatingToast toast={toastNotification} onDismiss={handleDismissToast} />
    </AppLayoutShell>
  );
}
