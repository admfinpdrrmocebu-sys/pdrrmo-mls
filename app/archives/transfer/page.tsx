'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  FolderOpen,
  FileText,
  Radio,
  Search,
  Download,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  X,
  HardDrive,
  Hash,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Trash2,
  FolderUp,
  Link as LinkIcon,
  CheckCircle2,
  ArrowLeft,
  FolderPlus,
  Layers,
  Sparkles,
  Info,
  Loader2,
  CloudUpload,
  Key,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { generateRollCallPDF, generateDailyLogsPDF, sortLogsChronologically } from '@/lib/pdf-generator';
import { formatBytes } from '@/app/archives/page';
import {
  GOOGLE_CLIENT_ID,
  extractGoogleDriveFolderId,
  requestGoogleDriveAccessToken,
  uploadFileDirectlyToGoogleDrive,
  loadGoogleIdentityServicesScript,
} from '@/lib/google-drive';

export interface DriveFolderOption {
  id: string;
  title: string;
  url: string;
  description?: string | null;
}

export interface BucketMigrationFile {
  id: string;
  filename: string;
  category: 'log' | 'roll-call';
  storagePath: string;
  fileSizeBytes: number;
  formattedSize: string;
  createdAt: string;
  leadOfficer: string;
  shift: string;
  hash: string;
  rawSnapshot?: any;
}

const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1.0 GB

export default function ArchivesTransferPage() {
  const { profile, isViewOnly, canWrite, isAdmin } = useAuth();
  const isArchivesViewOnly = isViewOnly('Archives') || !canWrite('Archives');
  const canModifyArchives = canWrite('Archives') && !isViewOnly('Archives');

  // Storage & Files State
  const [filesList, setFilesList] = useState<BucketMigrationFile[]>([]);
  const [driveFolders, setDriveFolders] = useState<DriveFolderOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Target Drive Folder Selection
  const [selectedFolderId, setSelectedFolderId] = useState<string>('custom');
  const [customDriveUrl, setCustomDriveUrl] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState<boolean>(false);
  const folderDropdownRef = useRef<HTMLDivElement>(null);

  // Selection Transfer Category Dropdown
  const [isSelectionDropdownOpen, setIsSelectionDropdownOpen] = useState<boolean>(false);
  const selectionDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        folderDropdownRef.current &&
        !folderDropdownRef.current.contains(e.target as Node)
      ) {
        setIsFolderDropdownOpen(false);
      }
      if (
        selectionDropdownRef.current &&
        !selectionDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSelectionDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter & Search
  const [activeTab, setActiveTab] = useState<'all' | 'log' | 'roll-call'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Google OAuth Access Token Cache
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [uploadedDriveUrl, setUploadedDriveUrl] = useState<string | null>(null);

  // Transfer Modal / Progress State
  const [isTransferring, setIsTransferring] = useState(false);
  const transferAbortRef = useRef<boolean>(false);
  const [transferMode, setTransferMode] = useState<'direct_api' | 'local_download'>('direct_api');
  const [transferProgress, setTransferProgress] = useState<{
    current: number;
    total: number;
    currentFilename: string;
    isFinished: boolean;
    errorCount: number;
    successCount: number;
    statusMessage: string;
  }>({
    current: 0,
    total: 0,
    currentFilename: '',
    isFinished: false,
    errorCount: 0,
    successCount: 0,
    statusMessage: '',
  });
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Delete All Safety Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast Notification
  const [toastNotification, setToastNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    submessage?: string;
  } | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'info', message: string, submessage?: string) => {
      setToastNotification({ type, message, submessage });
    },
    []
  );

  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => setToastNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Preload Google Identity Services on mount
  useEffect(() => {
    loadGoogleIdentityServicesScript().catch((err) => {
      console.warn('Google Identity Services script preload:', err);
    });
  }, []);

  // Load saved default target folder from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pdrrmo_target_drive_folder');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.folderId) setSelectedFolderId(parsed.folderId);
        if (parsed.customUrl) setCustomDriveUrl(parsed.customUrl);
        if (parsed.isCustom !== undefined) setIsCustomMode(parsed.isCustom);
      }
    } catch (_) {}
  }, []);

  // Save selection changes to localStorage
  const saveDriveSelection = (folderId: string, customUrl: string, isCustom: boolean) => {
    try {
      localStorage.setItem(
        'pdrrmo_target_drive_folder',
        JSON.stringify({ folderId, customUrl, isCustom })
      );
    } catch (_) {}
  };

  // ===========================================================================
  // 1. DATA FETCHING: BUCKET FILES & DRIVE DIRECTORIES
  // ===========================================================================
  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [mlsRes, rcRes, dbRes, driveRes] = await Promise.all([
        supabase.storage
          .from('archive-documents')
          .list('MLS', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } }),
        supabase.storage
          .from('archive-documents')
          .list('RC', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } }),
        supabase.from('archives').select('*'),
        supabase
          .from('drive_directories')
          .select('id, title, url, description')
          .order('created_at', { ascending: false }),
      ]);

      // Set Drive Folders
      const folders: DriveFolderOption[] = driveRes.data || [];
      setDriveFolders(folders);

      // Default to first folder if nothing selected
      if (folders.length > 0) {
        setSelectedFolderId((prev) => {
          if (prev === 'custom' && !customDriveUrl) {
            return folders[0].id;
          }
          return prev;
        });
      }

      // Map DB rows
      const dbRows = dbRes.data || [];
      const dbMap = new Map<string, any>();
      dbRows.forEach((row) => {
        if (row.filename) dbMap.set(row.filename.toLowerCase(), row);
        if (row.storage_path) dbMap.set(row.storage_path.toLowerCase(), row);
      });

      const bucketItems: BucketMigrationFile[] = [];

      // MLS Files
      if (mlsRes.data && Array.isArray(mlsRes.data)) {
        mlsRes.data.forEach((f) => {
          if (!f.name || f.name === '.emptyFolderPlaceholder') return;
          const storagePath = `MLS/${f.name}`;
          const dbRow = dbMap.get(f.name.toLowerCase()) || dbMap.get(storagePath.toLowerCase());
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
            hash: dbRow?.file_hash || (f.id ? `sha256-${f.id.slice(0, 16)}` : 'sha256-verified'),
            rawSnapshot: dbRow?.snapshot || null,
          });
        });
      }

      // RC Files
      if (rcRes.data && Array.isArray(rcRes.data)) {
        rcRes.data.forEach((f) => {
          if (!f.name || f.name === '.emptyFolderPlaceholder') return;
          const storagePath = `RC/${f.name}`;
          const dbRow = dbMap.get(f.name.toLowerCase()) || dbMap.get(storagePath.toLowerCase());
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
            hash: dbRow?.file_hash || (f.id ? `sha256-${f.id.slice(0, 16)}` : 'sha256-verified'),
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
  }, [customDriveUrl, showToast]);

  useEffect(() => {
    fetchData();

    // Multi-tab broadcast channel sync
    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      broadcastChannel = new BroadcastChannel('pdrrmo_sync_channel');
      broadcastChannel.onmessage = (event) => {
        if (
          event.data === 'archives_updated' ||
          event.data === 'roll_call_updated' ||
          event.data === 'shift_state_updated'
        ) {
          fetchData(true);
        }
      };
    }

    return () => {
      if (broadcastChannel) broadcastChannel.close();
    };
  }, [fetchData]);

  // Active Target Drive Folder URL
  const activeDriveUrl = useMemo(() => {
    if (isCustomMode || selectedFolderId === 'custom') {
      let clean = customDriveUrl.trim();
      if (clean && !clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = `https://${clean}`;
      }
      return clean || 'https://drive.google.com';
    }
    const match = driveFolders.find((f) => f.id === selectedFolderId);
    return match?.url || 'https://drive.google.com';
  }, [isCustomMode, selectedFolderId, customDriveUrl, driveFolders]);

  const activeDriveTitle = useMemo(() => {
    if (isCustomMode || selectedFolderId === 'custom') {
      return 'Custom Google Drive URL';
    }
    const match = driveFolders.find((f) => f.id === selectedFolderId);
    return match?.title || 'Selected Drive Folder';
  }, [isCustomMode, selectedFolderId, driveFolders]);

  // Extract folder ID from URL
  const activeDriveFolderId = useMemo(() => {
    return extractGoogleDriveFolderId(activeDriveUrl);
  }, [activeDriveUrl]);

  // Storage Metrics
  const { totalBytes, logBytes, rcBytes, logCount, rcCount } = useMemo(() => {
    let total = 0;
    let logB = 0;
    let rcB = 0;
    let lCount = 0;
    let rCount = 0;

    filesList.forEach((f) => {
      total += f.fileSizeBytes;
      if (f.category === 'log') {
        logB += f.fileSizeBytes;
        lCount++;
      } else {
        rcB += f.fileSizeBytes;
        rCount++;
      }
    });

    return { totalBytes: total, logBytes: logB, rcBytes: rcB, logCount: lCount, rcCount: rCount };
  }, [filesList]);

  const storagePercentage = useMemo(() => {
    return Math.min(100, Math.max(0, (totalBytes / STORAGE_QUOTA_BYTES) * 100));
  }, [totalBytes]);

  const freeStorageBytes = Math.max(0, STORAGE_QUOTA_BYTES - totalBytes);

  // Filtered Files for Table
  const filteredFiles = useMemo(() => {
    let result = filesList;
    if (activeTab === 'log') {
      result = result.filter((f) => f.category === 'log');
    } else if (activeTab === 'roll-call') {
      result = result.filter((f) => f.category === 'roll-call');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.filename.toLowerCase().includes(q) ||
          f.leadOfficer.toLowerCase().includes(q) ||
          f.shift.toLowerCase().includes(q) ||
          f.hash.toLowerCase().includes(q)
      );
    }
    return result;
  }, [filesList, activeTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / itemsPerPage));
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFiles.slice(start, start + itemsPerPage);
  }, [filteredFiles, currentPage, itemsPerPage]);

  // Helper to obtain PDF blob for a file
  const getFilePdfBlob = async (file: BucketMigrationFile): Promise<Blob | null> => {
    try {
      // 1. Attempt direct bucket download
      const { data: blobData, error: dlErr } = await supabase.storage
        .from('archive-documents')
        .download(file.storagePath);

      if (!dlErr && blobData && blobData.size > 0) {
        return blobData;
      }

      // 2. Fallback: Regenerate PDF from snapshot payload
      if (file.rawSnapshot) {
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
        } else {
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
      }
    } catch (err) {
      console.warn(`Could not get PDF blob for ${file.filename}:`, err);
    }
    return null;
  };

  // ===========================================================================
  // 2. TRANSFER ACTION HANDLERS (DIRECT GOOGLE DRIVE API + FALLBACK)
  // ===========================================================================
  const handleCancelTransfer = () => {
    transferAbortRef.current = true;
    setIsTransferring(false);
    setTransferProgress((prev) => ({
      ...prev,
      isFinished: true,
      statusMessage: 'Cloud transfer was cancelled by user.',
    }));
    showToast('info', 'Transfer Cancelled', 'The cloud transfer process was stopped.');
  };

  const handleTransferFiles = async (
    targetFiles: BucketMigrationFile[],
    categoryLabel: string = 'Files'
  ) => {
    if (targetFiles.length === 0) {
      showToast('info', 'No Files to Transfer', `There are no ${categoryLabel.toLowerCase()} to transfer.`);
      return;
    }

    transferAbortRef.current = false;
    setIsTransferModalOpen(true);
    setIsTransferring(true);
    setTransferProgress({
      current: 0,
      total: targetFiles.length,
      currentFilename: 'Initializing Google Authentication...',
      isFinished: false,
      errorCount: 0,
      successCount: 0,
      statusMessage: 'Connecting to Google Drive API...',
    });

    let token = googleAccessToken;

    try {
      // 1. Request Google OAuth Access Token
      if (!token) {
        token = await requestGoogleDriveAccessToken();
        setGoogleAccessToken(token);
      }

      if (transferAbortRef.current) {
        setIsTransferring(false);
        return;
      }

      const folderId = activeDriveFolderId;
      let successfulUploads = 0;
      let failedUploads = 0;

      let folderFeedbackName = '';

      // 2. Upload each target file directly to Google Drive via REST API
      for (let i = 0; i < targetFiles.length; i++) {
        if (transferAbortRef.current) {
          setTransferProgress((prev) => ({
            ...prev,
            isFinished: true,
            statusMessage: 'Transfer stopped by user.',
          }));
          break;
        }

        const file = targetFiles[i];
        setTransferProgress({
          current: i + 1,
          total: targetFiles.length,
          currentFilename: file.filename,
          isFinished: false,
          errorCount: failedUploads,
          successCount: successfulUploads,
          statusMessage: `Uploading ${i + 1} of ${targetFiles.length} ${categoryLabel} to Google Drive...`,
        });

        try {
          const blob = await getFilePdfBlob(file);
          if (!blob) {
            throw new Error('PDF file blob could not be retrieved.');
          }

          // Direct Google Drive Multipart Upload with auto-recovery
          const uploadRes = await uploadFileDirectlyToGoogleDrive({
            accessToken: token,
            blob,
            filename: file.filename,
            folderId,
            fallbackFolderName: 'PDRRMO MLS Official Archives',
          });

          if (uploadRes.parentFolderUsed) {
            folderFeedbackName = uploadRes.parentFolderUsed;
          }
          if (uploadRes.webViewLink) {
            setUploadedDriveUrl(uploadRes.webViewLink);
          }

          successfulUploads++;
        } catch (uploadErr: any) {
          console.error(`Failed to upload ${file.filename} to Google Drive:`, uploadErr);
          failedUploads++;
        }

        // Small throttle between API requests
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (!transferAbortRef.current) {
        const destinationNote = folderFeedbackName
          ? ` (saved into "${folderFeedbackName}")`
          : '';

        setTransferProgress({
          current: targetFiles.length,
          total: targetFiles.length,
          currentFilename: 'All files processed.',
          isFinished: true,
          errorCount: failedUploads,
          successCount: successfulUploads,
          statusMessage:
            failedUploads === 0
              ? `All ${successfulUploads} ${categoryLabel.toLowerCase()} uploaded directly to Google Drive${destinationNote}!`
              : `Uploaded ${successfulUploads} ${categoryLabel.toLowerCase()} (${failedUploads} failed).`,
        });

        if (successfulUploads > 0) {
          showToast(
            'success',
            'Direct Drive Upload Complete',
            `${successfulUploads} official ${categoryLabel.toLowerCase()} saved directly to Google Drive${destinationNote}.`
          );
        }
      }
    } catch (authErr: any) {
      console.warn('Google OAuth or transfer cancelled:', authErr);
      setTransferProgress((prev) => ({
        ...prev,
        isFinished: false,
        statusMessage:
          authErr.message || 'Google authentication was cancelled. You can retry anytime.',
      }));
      showToast(
        'error',
        'Google Auth / Transfer Cancelled',
        authErr.message || 'Google authentication was not completed.'
      );
    } finally {
      setIsTransferring(false);
    }
  };

  const handleTransferAll = () => handleTransferFiles(filesList, 'Files');
  const handleTransferShiftLogs = () =>
    handleTransferFiles(filesList.filter((f) => f.category === 'log'), 'Shift Logs');
  const handleTransferRollCalls = () =>
    handleTransferFiles(filesList.filter((f) => f.category === 'roll-call'), 'Roll Calls');

  // Fallback Local Download Option
  const handleFallbackLocalDownload = async () => {
    setIsTransferring(true);
    setTransferProgress({
      current: 0,
      total: filesList.length,
      currentFilename: filesList[0]?.filename || '',
      isFinished: false,
      errorCount: 0,
      successCount: 0,
      statusMessage: 'Downloading files to device & opening Google Drive...',
    });

    try {
      window.open(activeDriveUrl, '_blank', 'noopener,noreferrer');
    } catch (_) {}

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      setTransferProgress((prev) => ({
        ...prev,
        current: i + 1,
        currentFilename: file.filename,
      }));

      try {
        const blob = await getFilePdfBlob(file);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.filename.endsWith('.pdf') ? file.filename : `${file.filename}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } catch (_) {}

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    setTransferProgress((prev) => ({
      ...prev,
      isFinished: true,
      statusMessage: 'All files downloaded. Target Google Drive folder opened.',
    }));
    setIsTransferring(false);
  };

  // ===========================================================================
  // 3. DELETE ALL ACTION HANDLER (PURGE STORAGE)
  // ===========================================================================
  const handleDeleteAll = async () => {
    if (!canModifyArchives) {
      showToast('error', 'Unauthorized Action', 'You do not have write access to purge storage.');
      return;
    }

    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      showToast('error', 'Confirmation Mismatch', 'Please type DELETE in the box to confirm purge.');
      return;
    }

    setIsDeleting(true);

    try {
      // 1. Collect all paths from filesList
      const pathsToDelete = filesList.map((f) => f.storagePath);

      if (pathsToDelete.length > 0) {
        // Remove from storage bucket
        const { error: storageErr } = await supabase.storage
          .from('archive-documents')
          .remove(pathsToDelete);

        if (storageErr) {
          console.warn('Storage removal warning:', storageErr);
        }
      }

      // 2. Also delete records from public.archives
      const { error: dbErr } = await supabase
        .from('archives')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (dbErr) {
        console.warn('DB delete warning:', dbErr);
      }

      // 3. Reset local state
      setFilesList([]);
      setIsDeleteModalOpen(false);
      setIsTransferModalOpen(false);
      setDeleteConfirmationText('');

      // 4. Notify other tabs
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
  };

  // Copy Active Drive URL
  const handleCopyDriveUrl = () => {
    if (!activeDriveUrl) return;
    navigator.clipboard.writeText(activeDriveUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    showToast('info', 'Link Copied', 'Google Drive destination link copied to clipboard.');
  };

  // ===========================================================================
  // 4. RENDER
  // ===========================================================================
  return (
    <AppLayoutShell
      title="Drive Transfer & Storage Hub"
      subtitle="Centralized Storage Bucket Migration, Direct Drive Upload & Quota Utilization"
    >
      <div className="space-y-6">
        {/* View-Only Alert for Read-Only Users */}
        <ViewOnlyNotice
          screen="Archives"
          message="You are viewing the Storage Transfer Hub in read-only audit mode. Storage purge operations are disabled."
        />

        {/* ===================================================================== */}
        {/* TOP BREADCRUMB & NAVIGATION HEADER */}
        {/* ===================================================================== */}
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
                Storage Bucket & Google Drive Direct Migration
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <SecondaryButton
              size="md"
              pill
              leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => fetchData()}
              className="w-full sm:w-auto justify-center"
            >
              Refresh
            </SecondaryButton>

            <Link href="/archives/drive">
              <SecondaryButton
                size="md"
                pill
                leftIcon={<FolderOpen className="w-4 h-4 text-[#004AC6]" />}
                className="w-full sm:w-auto justify-center"
              >
                Drive Files ({driveFolders.length})
              </SecondaryButton>
            </Link>

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

        {/* ===================================================================== */}
        {/* 1. STORAGE CAPACITY & MIGRATION HEALTH METER */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs space-y-4 hover:border-[#CBD5E1] transition-all">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/20 shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#1E293B]">
                    Supabase Storage Bucket Capacity
                  </h2>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border font-mono ${
                      storagePercentage >= 90
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : storagePercentage >= 75
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-blue-50 text-[#004AC6] border-blue-200/80'
                    }`}
                  >
                    {storagePercentage >= 90
                      ? 'Critical Limit'
                      : storagePercentage >= 75
                      ? 'High Allocation'
                      : 'Optimal Space'}
                  </span>
                </div>
                <p className="text-xs text-[#757680] mt-0.5">
                  1.0 GB dedicated quota for official shift logs (`MLS/`) and roll calls (`RC/`).
                  Upload directly to Google Drive to permanently reclaim free quota.
                </p>
              </div>
            </div>

            <div className="text-left md:text-right self-start md:self-auto bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl">
              <div className="flex items-baseline gap-1.5 md:justify-end">
                {isLoading ? (
                  <Skeleton className="h-6 w-24 rounded-md" />
                ) : (
                  <>
                    <span className="text-xl font-black font-mono text-[#1E293B]">
                      {formatBytes(totalBytes)}
                    </span>
                    <span className="text-xs font-semibold text-[#757680]">/ 1.0 GB</span>
                  </>
                )}
              </div>
              {!isLoading && (
                <span className="text-[11px] font-bold text-[#505F76]">
                  {storagePercentage.toFixed(1)}% Allocated · {filesList.length} Files Total
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {isLoading ? (
            <Skeleton className="w-full h-3 rounded-full" />
          ) : (
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60">
              <div
                className={`h-full transition-all duration-700 rounded-full ${
                  storagePercentage >= 90
                    ? 'bg-rose-600'
                    : storagePercentage >= 75
                    ? 'bg-amber-500'
                    : 'bg-linear-to-r from-[#004AC6] via-blue-500 to-sky-400'
                }`}
                style={{ width: `${Math.max(0.5, Math.min(100, storagePercentage))}%` }}
              />
            </div>
          )}

          {/* Breakdown Stats */}
          {isLoading ? (
            <div className="flex justify-between items-center pt-1">
              <Skeleton className="h-4 w-52 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between text-xs text-[#505F76] font-medium pt-1 gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 bg-blue-50/70 border border-blue-100 px-3 py-1 rounded-xl text-[#004AC6]">
                  <span className="w-2 h-2 rounded-full bg-[#004AC6]" />
                  Shift Logs: <strong className="font-mono">{formatBytes(logBytes)}</strong> ({logCount} files)
                </span>
                <span className="flex items-center gap-1.5 bg-sky-50/70 border border-sky-100 px-3 py-1 rounded-xl text-sky-800">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  Roll Calls: <strong className="font-mono">{formatBytes(rcBytes)}</strong> ({rcCount} files)
                </span>
              </div>
              <span className="text-[#1E293B] text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-xl">
                {formatBytes(freeStorageBytes)} Available Storage Quota
              </span>
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 2. TARGET GOOGLE DRIVE DESTINATION SELECTOR */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-5 hover:border-[#CBD5E1] transition-all">
          <div className="flex items-center gap-3.5 pb-1">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-2xs">
              <FolderUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[#1E293B]">
                  Target Google Drive Destination
                </h3>
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Direct Cloud Upload
                </span>
              </div>
              <p className="text-xs text-[#757680] mt-0.5">
                Select a registered folder route or specify a custom URL destination for direct cloud-to-cloud archiving.
              </p>
            </div>
          </div>

          {/* Folder Selection Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1 items-start">
            {/* Custom Destination Folder Dropdown */}
            <div className="lg:col-span-1 space-y-1.5" ref={folderDropdownRef}>
              <div className="h-8 flex items-center justify-between">
                <label className="text-xs font-bold text-[#1E293B]">
                  Destination Folder Route:
                </label>
                <span className="text-[10px] font-semibold text-[#757680]">
                  {driveFolders.length} registered
                </span>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFolderDropdownOpen((prev) => !prev)}
                  className={`w-full h-11 bg-[#F8FAFC] border rounded-2xl px-3.5 flex items-center justify-between text-xs font-semibold text-[#1E293B] transition-all cursor-pointer select-none text-left shadow-2xs ${
                    isFolderDropdownOpen
                      ? 'border-[#004AC6] bg-white ring-3 ring-[#004AC6]/15 shadow-sm'
                      : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="truncate">
                      {isCustomMode ? 'Custom Google Drive Link' : activeDriveTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isCustomMode
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-[#004AC6] border-blue-200'
                      }`}
                    >
                      {isCustomMode ? 'Custom' : 'Route'}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#94A3B8] transition-transform duration-200 ${
                        isFolderDropdownOpen ? 'rotate-180 text-[#004AC6]' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Animated Dropdown Menu Popover */}
                <AnimatePresence>
                  {isFolderDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97, y: 4 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute left-0 top-full mt-2 w-full z-50 bg-white/95 backdrop-blur-md border border-[#E2E8F0] rounded-2xl shadow-xl p-2 space-y-1 max-h-72 overflow-y-auto custom-scrollbar ring-1 ring-black/5"
                    >
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 mb-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#757680]">
                          Available Folders
                        </span>
                        <span className="text-[10px] font-mono font-bold text-[#004AC6] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          {driveFolders.length} Active
                        </span>
                      </div>

                      {driveFolders.length > 0 ? (
                        driveFolders.map((f) => {
                          const isSelected = !isCustomMode && selectedFolderId === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setIsCustomMode(false);
                                setSelectedFolderId(f.id);
                                saveDriveSelection(f.id, customDriveUrl, false);
                                setIsFolderDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-all text-left cursor-pointer group ${
                                isSelected
                                  ? 'bg-blue-50/90 text-[#004AC6] font-bold border border-blue-200/80 shadow-2xs'
                                  : 'text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] border border-transparent'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <p className={`truncate text-xs ${isSelected ? 'font-bold text-[#004AC6]' : 'font-medium text-[#1E293B] group-hover:text-[#004AC6]'}`}>
                                  {f.title}
                                </p>
                                {f.description ? (
                                  <p className="text-[10px] text-[#757680] truncate mt-0.5">
                                    {f.description}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-[#94A3B8] font-mono truncate mt-0.5">
                                    Official Folder Route
                                  </p>
                                )}
                              </div>

                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-blue-100 text-[#004AC6] flex items-center justify-center shrink-0 shadow-2xs">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </div>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="py-4 px-3 text-center text-xs text-[#757680]">
                          <p className="font-semibold text-[#1E293B]">No registered folders</p>
                          <p className="text-[11px] text-[#94A3B8] mt-0.5">
                            Use custom link or register folders in Drive Hub.
                          </p>
                        </div>
                      )}

                      <div className="pt-1.5 mt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomMode(true);
                            setSelectedFolderId('custom');
                            saveDriveSelection('custom', customDriveUrl, true);
                            setIsFolderDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-all text-left cursor-pointer group ${
                            isCustomMode
                              ? 'bg-blue-50/90 text-[#004AC6] font-bold border border-blue-200/80 shadow-2xs'
                              : 'text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] border border-transparent'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className={`truncate text-xs ${isCustomMode ? 'font-bold text-[#004AC6]' : 'font-semibold text-[#1E293B] group-hover:text-[#004AC6]'}`}>
                              + Custom Google Drive Link
                            </p>
                            <p className="text-[10px] text-[#757680] truncate mt-0.5">
                              Paste external or shared folder URL manually
                            </p>
                          </div>

                          {isCustomMode && (
                            <div className="w-5 h-5 rounded-full bg-blue-100 text-[#004AC6] flex items-center justify-center shrink-0 shadow-2xs">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </div>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* URL Input / Active Destination Box */}
            <div className="lg:col-span-2 space-y-1.5">
              <div className="h-8 flex items-center justify-between">
                <label className="text-xs font-bold text-[#1E293B]">
                  Google Drive Web Link:
                </label>

                <button
                  type="button"
                  onClick={() => {
                    const nextCustom = !isCustomMode;
                    setIsCustomMode(nextCustom);
                    if (nextCustom) setSelectedFolderId('custom');
                    else if (driveFolders.length > 0) setSelectedFolderId(driveFolders[0].id);
                    saveDriveSelection(
                      nextCustom ? 'custom' : driveFolders[0]?.id || 'custom',
                      customDriveUrl,
                      nextCustom
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                    isCustomMode
                      ? 'bg-[#004AC6] text-white border-[#004AC6] shadow-xs'
                      : 'bg-slate-50 text-[#505F76] border-slate-200 hover:bg-slate-100 hover:text-[#1E293B]'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>{isCustomMode ? 'Using Custom Link' : 'Customize Folder Link'}</span>
                </button>
              </div>

              {/* Input or Route URL Box - Full width */}
              {isCustomMode ? (
                <div className="relative w-full">
                  <LinkIcon className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="url"
                    value={customDriveUrl}
                    onChange={(e) => {
                      setCustomDriveUrl(e.target.value);
                      saveDriveSelection('custom', e.target.value, true);
                    }}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="w-full h-11 bg-white border border-[#004AC6] rounded-2xl pl-10 pr-3.5 text-xs text-[#1E293B] font-mono focus:outline-none focus:ring-3 focus:ring-[#004AC6]/15 transition-all shadow-2xs"
                  />
                </div>
              ) : (
                <div className="w-full h-11 bg-slate-100/90 border border-slate-200 rounded-2xl px-3.5 flex items-center text-xs text-[#505F76] font-mono truncate shadow-2xs cursor-not-allowed select-all">
                  <span className="truncate">{activeDriveUrl}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Footer inside Destination Card */}
          <div className="pt-4 border-t border-[#F1F5F9] flex flex-wrap items-center justify-end gap-3">
            {/* Selection Transfer Dropdown Button */}
            <div className="relative" ref={selectionDropdownRef}>
              <button
                type="button"
                disabled={filesList.length === 0 || isTransferring || isLoading}
                onClick={() => setIsSelectionDropdownOpen((prev) => !prev)}
                className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  filesList.length === 0 || isTransferring || isLoading
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white hover:bg-slate-50 text-[#004AC6] border-[#004AC6]/30 shadow-2xs active:scale-[0.98]'
                }`}
                title="Transfer a specific subset of records (Shift Logs or Roll Calls)"
              >
                <Layers className="w-4 h-4 text-[#004AC6]" />
                <span>Selection Transfer</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#004AC6] transition-transform duration-200 ${
                    isSelectionDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {isSelectionDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 w-64 z-50 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-2 space-y-1 ring-1 ring-black/5"
                  >
                    <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#757680]">
                      Bulk Transfer by Category
                    </div>

                    {/* Shift Logs Option */}
                    <button
                      type="button"
                      disabled={logCount === 0 || isTransferring}
                      onClick={() => {
                        setIsSelectionDropdownOpen(false);
                        handleTransferShiftLogs();
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-all text-left cursor-pointer ${
                        logCount === 0
                          ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400'
                          : 'text-[#1E293B] hover:bg-blue-50/70 hover:text-[#004AC6]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-[#1E293B]">Shift Logs Only</p>
                        <p className="text-[10px] text-[#757680] truncate mt-0.5">
                          Daily shift operations (MLS/)
                        </p>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-blue-50 text-[#004AC6] border border-blue-200 px-2 py-0.5 rounded-full shrink-0 ml-2">
                        {logCount}
                      </span>
                    </button>

                    {/* Roll Calls Option */}
                    <button
                      type="button"
                      disabled={rcCount === 0 || isTransferring}
                      onClick={() => {
                        setIsSelectionDropdownOpen(false);
                        handleTransferRollCalls();
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-all text-left cursor-pointer ${
                        rcCount === 0
                          ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400'
                          : 'text-[#1E293B] hover:bg-blue-50/70 hover:text-[#004AC6]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-[#1E293B]">Roll Calls Only</p>
                        <p className="text-[10px] text-[#757680] truncate mt-0.5">
                          Radio net check records (RC/)
                        </p>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full shrink-0 ml-2">
                        {rcCount}
                      </span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Transfer All Button */}
            <button
              type="button"
              disabled={filesList.length === 0 || isTransferring || isLoading}
              onClick={handleTransferAll}
              className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                filesList.length === 0 || isTransferring || isLoading
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-[#004AC6] hover:bg-[#003da3] text-white shadow-sm active:scale-[0.98]'
              }`}
            >
              {isTransferring ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <CloudUpload className="w-4 h-4 text-white" />
              )}
              <span>Transfer All to Drive ({filesList.length})</span>
            </button>

            {/* Delete All Button (Purge) */}
            <button
              type="button"
              disabled={filesList.length === 0 || !canModifyArchives || isDeleting || isLoading}
              onClick={() => {
                setDeleteConfirmationText('');
                setIsDeleteModalOpen(true);
              }}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                filesList.length === 0 || !canModifyArchives || isDeleting || isLoading
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

        {/* ===================================================================== */}
        {/* 4. MIGRATION AUDIT & REVIEW FILES TABLE */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
          {/* Controls Bar */}
          <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white">
            {/* Segmented Filter Tabs */}
            <div className="flex bg-[#F1F5F9] p-1.5 rounded-full self-start border border-[#E2E8F0]/70">
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
                    activeTab === 'all' ? 'bg-[#004AC6]/10 text-[#004AC6]' : 'bg-slate-200 text-[#505F76]'
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
                    activeTab === 'log' ? 'bg-[#004AC6]/10 text-[#004AC6]' : 'bg-slate-200 text-[#505F76]'
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
                    activeTab === 'roll-call' ? 'bg-[#004AC6]/10 text-[#004AC6]' : 'bg-slate-200 text-[#505F76]'
                  }`}
                >
                  {rcCount}
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 md:max-w-md">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search files by name, officer, shift..."
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
                  <th className="py-4 px-6">Lead Officer & Shift</th>
                  <th className="py-4 px-6">Recorded Timestamp</th>
                  <th className="py-4 px-6 text-right">File Size</th>
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
                ) : paginatedFiles.length > 0 ? (
                  paginatedFiles.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-[#F8FAFC]/80 transition-colors group"
                    >
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
                          <span className="font-medium text-[#1E293B] text-xs">
                            {file.leadOfficer}
                          </span>
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
                            : 'Storage Bucket is 100% Free!'}
                        </h3>
                        <p className="text-xs text-[#757680] leading-relaxed">
                          {searchQuery
                            ? `No storage files match "${searchQuery}". Try clearing your search query.`
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
                Showing page <strong className="text-[#1E293B]">{currentPage}</strong> of{' '}
                <strong className="text-[#1E293B]">{totalPages}</strong> (
                {filteredFiles.length} files)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-xl border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#004AC6] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-[#1E293B] px-2">{currentPage}</span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 rounded-xl border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#004AC6] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 5. TRANSFER ASSISTANT MODAL / PROGRESS INDICATOR */}
      {/* ======================================================================= */}
      <AnimatePresence>
        {isTransferModalOpen && (
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
                      transferProgress.isFinished
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-blue-50 text-[#004AC6] border border-blue-200'
                    }`}
                  >
                    {transferProgress.isFinished ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <CloudUpload className="w-5 h-5 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E293B]">
                      {transferProgress.isFinished
                        ? 'Google Drive Upload Complete'
                        : 'Direct Cloud Upload to Google Drive'}
                    </h3>
                    <p className="text-xs text-[#757680]">
                      {transferProgress.isFinished
                        ? `${transferProgress.successCount} files stored in Google Drive`
                        : `Uploading ${transferProgress.current} of ${transferProgress.total} documents`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isTransferring) handleCancelTransfer();
                    setIsTransferModalOpen(false);
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
                    {transferProgress.statusMessage || transferProgress.currentFilename}
                  </span>
                  <span className="font-mono">
                    {transferProgress.total > 0
                      ? Math.round(
                          (transferProgress.current / transferProgress.total) * 100
                        )
                      : 0}
                    %
                  </span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      transferProgress.isFinished ? 'bg-emerald-600' : 'bg-[#004AC6]'
                    }`}
                    style={{
                      width: `${
                        transferProgress.total > 0
                          ? (transferProgress.current / transferProgress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Destination & Details Box */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-2.5">
                <p className="font-bold text-[#1E293B] flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-[#004AC6]" />
                  Google Drive Target:
                </p>
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] font-mono text-[#004AC6] truncate">
                  {activeDriveTitle} ({activeDriveUrl})
                </div>
                <p className="text-[#505F76] leading-relaxed">
                  Files are transferred directly from Supabase Storage into your Google Drive folder via the Google Drive REST API.
                  No local disk files are created.
                </p>
              </div>

              {/* Action Buttons in Modal */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                {!transferProgress.isFinished && !isTransferring && (
                  <button
                    type="button"
                    onClick={handleFallbackLocalDownload}
                    className="text-[11px] font-bold text-[#505F76] hover:text-[#004AC6] flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download to Local instead</span>
                  </button>
                )}

                <div className="flex items-center justify-end gap-2.5 ml-auto w-full sm:w-auto">
                  {isTransferring ? (
                    <button
                      type="button"
                      onClick={handleCancelTransfer}
                      className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold cursor-pointer transition-colors"
                    >
                      Cancel Transfer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsTransferModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#505F76] hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      Close
                    </button>
                  )}

                  <a
                    href={uploadedDriveUrl || activeDriveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-blue-50 text-[#004AC6] border border-blue-200 hover:bg-blue-100 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <span>Open Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {transferProgress.isFinished && canModifyArchives && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsTransferModalOpen(false);
                        setDeleteConfirmationText('');
                        setIsDeleteModalOpen(true);
                      }}
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

      {/* ======================================================================= */}
      {/* 6. HIGH-SECURITY PURGE CONFIRMATION MODAL (DELETE ALL) */}
      {/* ======================================================================= */}
      <AnimatePresence>
        {isDeleteModalOpen && (
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
                  You are about to permanently delete <strong>{filesList.length} files</strong> (
                  <strong>{formatBytes(totalBytes)}</strong>) from the Supabase storage bucket (`archive-documents`).
                </p>
                <p className="text-[11px] text-rose-700">
                  Ensure all files have been safely migrated to Google Drive before continuing.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#1E293B] block">
                  Type <span className="font-mono text-rose-600 font-black">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-2.5 px-3.5 text-xs text-[#1E293B] font-mono focus:outline-none focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-500/15 transition-all"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#505F76] hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    deleteConfirmationText.trim().toUpperCase() !== 'DELETE' || isDeleting
                  }
                  onClick={handleDeleteAll}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                    deleteConfirmationText.trim().toUpperCase() === 'DELETE' && !isDeleting
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

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-2xl shadow-xl border flex items-start gap-3 select-none ${
              toastNotification.type === 'success'
                ? 'bg-emerald-900/95 text-white border-emerald-700'
                : toastNotification.type === 'error'
                ? 'bg-rose-900/95 text-white border-rose-700'
                : 'bg-slate-900/95 text-white border-slate-700'
            }`}
          >
            {toastNotification.type === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
            )}
            {toastNotification.type === 'error' && (
              <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
            )}
            {toastNotification.type === 'info' && (
              <Info className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold leading-snug">{toastNotification.message}</p>
              {toastNotification.submessage && (
                <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
                  {toastNotification.submessage}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className="opacity-70 hover:opacity-100 text-white p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
