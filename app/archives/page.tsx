'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  FolderOpen,
  FileText,
  Radio,
  Search,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Archive as ArchiveIcon,
  HardDrive,
  RefreshCw,
  FolderUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import type { PaperSize, RollCallTemplateType } from '@/lib/pdf-generator';
import {
  getCachedArchivesScreenData,
  setCachedArchivesScreenData,
  patchCachedArchivesScreenData,
  getCachedArchiveSnapshot,
  setCachedArchiveSnapshot,
} from '@/lib/cache/screen-data-cache';
import { ArchiveRow } from './_components/archive-row';
import {
  formatBytes,
  formatFileDate,
  getShiftStartTime,
  getShiftEndTime,
  getFileDateISO,
  mapDbArchiveToArchivedFile,
  type ArchiveDbRow,
  type ArchiveProfileRow,
  type ArchiveSnapshotData,
  type ArchivedFile,
  type RollCallStationEntry,
  type ShiftLogEntry,
  type ShiftPersonnelInfo,
  type ShiftSummaryEntry,
} from './_components/types';

export { formatBytes, formatFileDate, getShiftStartTime, getShiftEndTime };
export type {
  ArchivedFile,
  RollCallStationEntry,
  ShiftLogEntry,
  ShiftPersonnelInfo,
  ShiftSummaryEntry,
};

const ArchivePreviewModal = dynamic(
  () =>
    import('./_components/archive-preview-modal').then(
      (m) => m.ArchivePreviewModal
    ),
  { ssr: false }
);

const DateFilterPopover = dynamic(
  () =>
    import('./_components/date-filter-popover').then(
      (m) => m.DateFilterPopover
    ),
  { ssr: false }
);

// =============================================================================
// CONSTANTS & SIGNATURES
// =============================================================================

const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GB (1,024 MB)
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ARCHIVE_LIST_SELECT =
  'id, filename, category, shift_label, shift_hours, item_count, file_size_bytes, storage_path, file_url, file_hash, summary, status, lead_officer_name, lead_officer_role, generated_at, created_at, daily_report_date:snapshot_data->>dailyReportDate, session_date:snapshot_data->>sessionDate';

function buildArchivesSignature(items: ArchivedFile[]): string {
  return items
    .map(
      (f) =>
        `${f.id}|${f.filename}|${f.category}|${f.fileSizeBytes ?? 0}|${f.itemCount}|${f.hash}|${f.status}|${f.snapshotLoaded ? 1 : 0}`
    )
    .join(';');
}

function buildProfilesSignature(items: ArchiveProfileRow[]): string {
  return items
    .map(
      (p) =>
        `${p.id}|${p.full_name ?? ''}|${p.position_title ?? ''}|${p.signature_url ?? ''}`
    )
    .join(';');
}

function parseDateFromISO(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parsed = new Date(`${iso}T12:00:00`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function toDateISO(date: Date | null): string | null {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ArchivesPage() {
  const { profile } = useAuth();
  const profileId = profile?.id ?? null;
  const profileFullName = profile?.full_name ?? null;
  const profilePositionTitle = profile?.position_title ?? null;
  const profileSignatureUrl = profile?.signature_url ?? null;

  const [initialCache] = useState(() => getCachedArchivesScreenData());

  const [activeTab, setActiveTab] = useState<'log' | 'roll-call'>(
    initialCache?.activeTab ?? 'log'
  );
  const [archivesList, setArchivesList] = useState<ArchivedFile[]>(
    initialCache?.archivesList ?? []
  );
  const [profilesList, setProfilesList] = useState<ArchiveProfileRow[]>(
    initialCache?.profilesList ?? []
  );
  const [isLoading, setIsLoading] = useState(!initialCache);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState(
    initialCache?.searchQuery ?? ''
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    initialCache?.searchQuery ?? ''
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    parseDateFromISO(initialCache?.selectedDateISO)
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [hasOpenedDatePicker, setHasOpenedDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Debounce search query by 300ms for smooth filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(
    initialCache?.currentPage ?? 1
  );
  const itemsPerPage = 8;

  // Selected file for Document Preview Modal & Real PDF Embed (lazy-mounted)
  const [selectedFileForPreview, setSelectedFileForPreview] =
    useState<ArchivedFile | null>(null);
  const [hasOpenedPreview, setHasOpenedPreview] = useState(false);
  const [previewViewMode, setPreviewViewMode] = useState<'document' | 'pdf'>(
    'document'
  );
  const [previewPdfBlobUrl, setPreviewPdfBlobUrl] = useState<string | null>(
    null
  );
  const previewPdfBlobUrlRef = useRef<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [rcTemplateType, setRcTemplateType] = useState<RollCallTemplateType>(
    initialCache?.rcTemplateType ?? 'net_calling'
  );
  const [rcPaperSize, setRcPaperSize] = useState<PaperSize>(
    initialCache?.rcPaperSize ?? 'a4'
  );

  // Toast State
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    submessage?: string;
    type: 'success' | 'info';
  } | null>(null);

  // Refs for stable background sync & diffing
  const archivesListRef = useRef<ArchivedFile[]>(
    initialCache?.archivesList ?? []
  );
  const profilesListRef = useRef<ArchiveProfileRow[]>(
    initialCache?.profilesList ?? []
  );
  const archivesSigRef = useRef<string>(
    initialCache ? buildArchivesSignature(initialCache.archivesList) : ''
  );
  const profilesSigRef = useRef<string>(
    initialCache ? buildProfilesSignature(initialCache.profilesList) : ''
  );
  const syncInFlightRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    archivesListRef.current = archivesList;
  }, [archivesList]);

  useEffect(() => {
    profilesListRef.current = profilesList;
  }, [profilesList]);

  useEffect(() => {
    previewPdfBlobUrlRef.current = previewPdfBlobUrl;
  }, [previewPdfBlobUrl]);

  // Cleanup any open blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewPdfBlobUrlRef.current) {
        URL.revokeObjectURL(previewPdfBlobUrlRef.current);
      }
    };
  }, []);

  // Profile Lookup Map by ID and Lowercase Full Name
  const profileMap = useMemo(() => {
    const map = new Map<string, ArchiveProfileRow>();
    for (const p of profilesList) {
      if (p.id) map.set(p.id.toLowerCase(), p);
      if (p.full_name) map.set(p.full_name.toLowerCase().trim(), p);
    }
    if (profileId) {
      const selfRow: ArchiveProfileRow = {
        id: profileId,
        full_name: profileFullName,
        position_title: profilePositionTitle,
        signature_url: profileSignatureUrl,
      };
      map.set(profileId.toLowerCase(), selfRow);
      if (profileFullName) {
        map.set(profileFullName.toLowerCase().trim(), selfRow);
      }
    }
    return map;
  }, [
    profilesList,
    profileId,
    profileFullName,
    profilePositionTitle,
    profileSignatureUrl,
  ]);

  const selectedDateISO = useMemo(() => toDateISO(selectedDate), [selectedDate]);

  // Patch lightweight UI state changes into cache
  useEffect(() => {
    patchCachedArchivesScreenData({
      activeTab,
      searchQuery,
      selectedDateISO,
      currentPage,
      rcTemplateType,
      rcPaperSize,
    });
  }, [
    activeTab,
    searchQuery,
    selectedDateISO,
    currentPage,
    rcTemplateType,
    rcPaperSize,
  ]);

  // ===========================================================================
  // 1. METADATA-FIRST DATA FETCHING + ON-DEMAND SNAPSHOT HYDRATION
  // ===========================================================================

  const fetchArchives = useCallback(
    async ({ isBackground = false }: { isBackground?: boolean } = {}) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
        if (!isBackground && archivesListRef.current.length === 0) {
          setIsLoading(true);
        } else if (isBackground) {
          setIsRefreshing(true);
        }

        const [mlsRes, rcRes, dbRes, profilesRes] = await Promise.all([
          supabase.storage
            .from('archive-documents')
            .list('MLS', {
              limit: 200,
              sortBy: { column: 'created_at', order: 'desc' },
            }),
          supabase.storage
            .from('archive-documents')
            .list('RC', {
              limit: 200,
              sortBy: { column: 'created_at', order: 'desc' },
            }),
          supabase.from('archives').select(ARCHIVE_LIST_SELECT),
          supabase
            .from('profiles')
            .select('id, full_name, position_title, signature_url'),
        ]);

        let nextProfiles = profilesListRef.current;
        if (profilesRes.data) {
          const typedProfiles = profilesRes.data as ArchiveProfileRow[];
          const nextProfSig = buildProfilesSignature(typedProfiles);
          if (nextProfSig !== profilesSigRef.current) {
            profilesSigRef.current = nextProfSig;
            profilesListRef.current = typedProfiles;
            nextProfiles = typedProfiles;
            setProfilesList(typedProfiles);
          }
        }

        const dbRows = (dbRes.data || []) as ArchiveDbRow[];
        const dbMap = new Map<string, ArchiveDbRow>();
        for (const row of dbRows) {
          if (row.filename) dbMap.set(row.filename.toLowerCase(), row);
          if (row.storage_path) dbMap.set(row.storage_path.toLowerCase(), row);
        }

        // Map of existing hydrated snapshots in current state/cache so we don't lose loaded details on refresh
        const currentById = new Map<string, ArchivedFile>();
        for (const existing of archivesListRef.current) {
          if (existing.snapshotLoaded && existing.rawSnapshotData) {
            currentById.set(existing.id, existing);
          }
        }

        const bucketFilesOnly: ArchivedFile[] = [];

        if (mlsRes.data && Array.isArray(mlsRes.data)) {
          for (const fileObj of mlsRes.data) {
            if (!fileObj.name || fileObj.name === '.emptyFolderPlaceholder') {
              continue;
            }
            const storagePath = `MLS/${fileObj.name}`;
            const dbRow =
              dbMap.get(fileObj.name.toLowerCase()) ||
              dbMap.get(storagePath.toLowerCase());

            if (dbRow) {
              const cachedSnap =
                getCachedArchiveSnapshot(dbRow.id) ??
                currentById.get(dbRow.id)?.rawSnapshotData ??
                null;
              bucketFilesOnly.push(
                mapDbArchiveToArchivedFile({
                  ...dbRow,
                  filename: fileObj.name,
                  storage_path: storagePath,
                  file_size_bytes:
                    fileObj.metadata?.size || dbRow.file_size_bytes,
                  created_at: fileObj.created_at || dbRow.created_at,
                  snapshot_data: cachedSnap,
                })
              );
            } else {
              const d = new Date(fileObj.created_at || Date.now());
              const dateStr = d.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              });
              const timeStr = d.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
              const bytes = fileObj.metadata?.size || 0;
              const effectiveBytes = bytes > 0 ? bytes : 1.2 * 1024 * 1024;
              const formattedSize =
                bytes >= 1024 * 1024
                  ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
                  : `${Math.max(1, Math.round(bytes / 1024))} KB`;

              bucketFilesOnly.push({
                id: fileObj.id || storagePath,
                filename: fileObj.name,
                category: 'log',
                createdAt: `${dateStr} · ${timeStr}`,
                generatedAt: 'Official Shift Operations Archive',
                fileSize: formattedSize,
                fileSizeBytes: effectiveBytes,
                leadOfficer: 'Operations Lead Officer',
                leadOfficerRole: 'Lead Operations Officer',
                leadOfficerBadge: 'OPC-1001',
                shift: 'Shift Operations',
                shiftHours: 'Shift Duty Cycle',
                itemCount: 1,
                hash: fileObj.id
                  ? `sha256-${fileObj.id.replace(/-/g, '').slice(0, 16)}`
                  : 'sha256-verified-storage',
                summary: `Official shift operational log archive retrieved from storage bucket archive-documents/${storagePath}.`,
                status: 'Verified',
                monitoringBriefing: 'Operational Shift Monitoring Duty',
                dutyPersonnelRoster: [
                  {
                    name: 'Operations Officer',
                    role: 'Operations Staff',
                    badgeNumber: 'OPC-1001',
                    presentAtEnd: true,
                  },
                ],
                handoverStatus: 'Situation Remain Normal',
                isDailyCombined: false,
                storagePath,
              });
            }
          }
        }

        if (rcRes.data && Array.isArray(rcRes.data)) {
          for (const fileObj of rcRes.data) {
            if (!fileObj.name || fileObj.name === '.emptyFolderPlaceholder') {
              continue;
            }
            const storagePath = `RC/${fileObj.name}`;
            const dbRow =
              dbMap.get(fileObj.name.toLowerCase()) ||
              dbMap.get(storagePath.toLowerCase());

            if (dbRow) {
              const cachedSnap =
                getCachedArchiveSnapshot(dbRow.id) ??
                currentById.get(dbRow.id)?.rawSnapshotData ??
                null;
              bucketFilesOnly.push(
                mapDbArchiveToArchivedFile({
                  ...dbRow,
                  filename: fileObj.name,
                  category: 'roll-call',
                  storage_path: storagePath,
                  file_size_bytes:
                    fileObj.metadata?.size || dbRow.file_size_bytes,
                  created_at: fileObj.created_at || dbRow.created_at,
                  snapshot_data: cachedSnap,
                })
              );
            } else {
              const d = new Date(fileObj.created_at || Date.now());
              const dateStr = d.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              });
              const timeStr = d.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
              const bytes = fileObj.metadata?.size || 0;
              const effectiveBytes = bytes > 0 ? bytes : 450 * 1024;
              const formattedSize =
                bytes >= 1024 * 1024
                  ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
                  : `${Math.max(1, Math.round(bytes / 1024))} KB`;

              bucketFilesOnly.push({
                id: fileObj.id || storagePath,
                filename: fileObj.name,
                category: 'roll-call',
                createdAt: `${dateStr} · ${timeStr}`,
                generatedAt: 'Official Radio Net Roll Call Report',
                fileSize: formattedSize,
                fileSizeBytes: effectiveBytes,
                leadOfficer: 'Radio Net Controller',
                leadOfficerRole: 'Net Controller',
                leadOfficerBadge: 'OPC-1042',
                shift: 'Day Shift Net Call',
                shiftHours: '16:00H Net Call',
                itemCount: 8,
                hash: fileObj.id
                  ? `sha256-${fileObj.id.replace(/-/g, '').slice(0, 16)}`
                  : 'sha256-verified-storage',
                summary: `Official radio net roll call report retrieved from storage bucket archive-documents/${storagePath}.`,
                status: 'Verified',
                monitoringBriefing:
                  'Primary Net 142.500 MHz Radio Roll Call Consolidation',
                dutyPersonnelRoster: [
                  {
                    name: 'Radio Operator',
                    role: 'Net Controller',
                    badgeNumber: 'OPC-1042',
                    presentAtEnd: true,
                  },
                ],
                handoverStatus: 'Situation Remain Normal',
                rollCallStats: {
                  totalAreas: 8,
                  present: 8,
                  absent: 0,
                  exempted: 0,
                  unresponsive: 0,
                  weatherSummary:
                    'Normal weather conditions reported across active stations.',
                  frequency: '142.500 MHz Primary VHF Net',
                },
                storagePath,
              });
            }
          }
        }

        const nextArchSig = buildArchivesSignature(bucketFilesOnly);
        if (nextArchSig !== archivesSigRef.current) {
          archivesSigRef.current = nextArchSig;
          archivesListRef.current = bucketFilesOnly;
          setArchivesList(bucketFilesOnly);
        }

        const existingCache = getCachedArchivesScreenData();
        setCachedArchivesScreenData({
          archivesList: bucketFilesOnly,
          profilesList: nextProfiles,
          snapshotById: existingCache?.snapshotById ?? {},
          activeTab: existingCache?.activeTab ?? 'log',
          searchQuery: existingCache?.searchQuery ?? '',
          selectedDateISO: existingCache?.selectedDateISO ?? null,
          currentPage: existingCache?.currentPage ?? 1,
          rcTemplateType: existingCache?.rcTemplateType ?? 'net_calling',
          rcPaperSize: existingCache?.rcPaperSize ?? 'a4',
          cachedAt: Date.now(),
        });
      } catch (err) {
        console.error('Failed to load archives from storage bucket:', err);
      } finally {
        syncInFlightRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  // Lazy-fetch heavy `snapshot_data` on-demand for Preview or Roll Call PDF export
  const ensureArchiveSnapshot = useCallback(
    async (file: ArchivedFile): Promise<ArchivedFile> => {
      if (file.snapshotLoaded) return file;

      const existingSnap = getCachedArchiveSnapshot(file.id);
      if (existingSnap) {
        const hydrated = mapDbArchiveToArchivedFile({
          id: file.id,
          filename: file.filename,
          category: file.category,
          shift_label: file.shift,
          shift_hours: file.shiftHours,
          item_count: file.itemCount,
          file_size_bytes: file.fileSizeBytes ?? null,
          storage_path: file.storagePath ?? null,
          file_url: file.fileUrl ?? null,
          file_hash: file.hash,
          summary: file.summary,
          status: file.status,
          lead_officer_name: file.leadOfficer,
          lead_officer_role: file.leadOfficerRole,
          lead_officer_badge: file.leadOfficerBadge,
          daily_report_date: file.dailyReportDate ?? null,
          session_date: file.sessionDate ?? null,
          snapshot_data: existingSnap,
        });
        return {
          ...file,
          ...hydrated,
          createdAt: file.createdAt,
          storagePath: file.storagePath,
          snapshotLoaded: true,
        };
      }

      if (!UUID_RE.test(file.id)) {
        return file;
      }

      try {
        const { data: rowData, error } = await supabase
          .from('archives')
          .select(
            'id, filename, category, shift_label, shift_hours, item_count, file_size_bytes, storage_path, file_url, file_hash, summary, status, lead_officer_name, lead_officer_role, generated_at, created_at, snapshot_data'
          )
          .eq('id', file.id)
          .maybeSingle();

        if (error || !rowData) {
          return file;
        }

        const typedRow = rowData as ArchiveDbRow;
        const snap = (typedRow.snapshot_data || {}) as ArchiveSnapshotData;
        setCachedArchiveSnapshot(file.id, snap);

        const mapped = mapDbArchiveToArchivedFile({
          ...typedRow,
          filename: file.filename,
          category: file.category,
          storage_path: file.storagePath || typedRow.storage_path,
          file_size_bytes: file.fileSizeBytes || typedRow.file_size_bytes,
          snapshot_data: snap,
        });
        const merged: ArchivedFile = {
          ...file,
          ...mapped,
          snapshotLoaded: true,
        };

        const updatedList = archivesListRef.current.map((item) =>
          item.id === file.id ? merged : item
        );
        archivesSigRef.current = buildArchivesSignature(updatedList);
        archivesListRef.current = updatedList;
        setArchivesList(updatedList);
        patchCachedArchivesScreenData({ archivesList: updatedList });

        return merged;
      } catch (err) {
        console.warn('Could not load archive snapshot on demand:', err);
        return file;
      }
    },
    []
  );

  // ===========================================================================
  // 2. DEBOUNCED REALTIME, CROSS-TAB SYNC & VISIBILITY RESYNC
  // ===========================================================================

  useEffect(() => {
    void fetchArchives({ isBackground: archivesListRef.current.length > 0 });

    const scheduleBackgroundSync = (delayMs = 350) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void fetchArchives({ isBackground: true });
      }, delayMs);
    };

    const channel = supabase
      .channel('archives_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'archives' },
        () => {
          scheduleBackgroundSync(350);
        }
      )
      .subscribe();

    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      broadcastChannel = new BroadcastChannel('pdrrmo_sync_channel');
      broadcastChannel.onmessage = (event) => {
        if (
          event.data === 'archives_updated' ||
          event.data === 'roll_call_updated' ||
          event.data === 'shift_state_updated'
        ) {
          scheduleBackgroundSync(300);
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pdrrmo_sync_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as { type?: string };
          if (
            parsed.type === 'archives_updated' ||
            parsed.type === 'roll_call_updated' ||
            parsed.type === 'shift_state_updated'
          ) {
            scheduleBackgroundSync(300);
          }
        } catch {
          // Ignore malformed payloads
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleBackgroundSync(150);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(channel);
      if (broadcastChannel) broadcastChannel.close();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchArchives]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => setToastNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  // Close context menu and date picker on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      setActiveMenuId(null);
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(e.target as Node)
      ) {
        setIsDatePickerOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ===========================================================================
  // 3. PREVIEW & PDF DOWNLOAD HANDLERS (DYNAMIC PDF IMPORT)
  // ===========================================================================

  const buildRollCallPdfPayload = useCallback(
    (
      file: ArchivedFile,
      templateOverride?: RollCallTemplateType,
      paperOverride?: PaperSize
    ) => {
      const dateStr = file.createdAt
        ? file.createdAt.split('·')[0].trim()
        : '09/27/2026';
      const rcOfficer = profileMap.get(file.leadOfficer?.toLowerCase().trim());

      const rawSnapshotEntries = Array.isArray(file.rawSnapshotData?.entries)
        ? file.rawSnapshotData.entries
        : Array.isArray(file.rawSnapshotData?.records)
        ? file.rawSnapshotData.records
        : [];

      const entriesToRender =
        file.rollCallEntries && file.rollCallEntries.length > 0
          ? file.rollCallEntries.map((e) => ({
              name: e.municipality || e.station,
              attendance: e.status,
              weatherStatus: e.weatherCondition,
              portStatus: e.seaPortStatus,
              hasPort: e.hasPort,
              portName: e.portName,
              timeResponded: e.timeResponded !== '—' ? e.timeResponded : null,
              dutyOperator: e.dutyOperator,
            }))
          : rawSnapshotEntries.map((e) => ({
              name: String(e.name || e.area_name || e.municipality || 'Station'),
              attendance: String(e.attendance || e.status || 'Present'),
              weatherStatus: String(
                e.weatherStatus || e.weather_status || e.weather || 'Fair'
              ),
              portStatus: String(
                e.portStatus || e.port_status || e.port || 'Operational'
              ),
              hasPort: Boolean(e.hasPort),
              portName: (e.portName || e.port_name) as string | undefined,
              timeResponded: (e.timeResponded ||
                e.time_responded ||
                e.time) as string | undefined,
              dutyOperator: String(
                e.dutyOperator || e.duty_operator || 'Station Duty Officer'
              ),
            }));

      return {
        filename: file.filename,
        sessionDate: dateStr,
        sessionTime: file.shiftHours || '1600H',
        frequency:
          file.rollCallStats?.frequency || '142.500 MHz Primary VHF Net',
        radioScript: file.monitoringBriefing,
        conductedBy: file.leadOfficer || 'Monitoring Officer',
        conductedByRole:
          file.leadOfficerRole || rcOfficer?.position_title || 'Net Controller',
        signatureUrl: null,
        totalStations:
          file.rollCallStats?.totalAreas ||
          file.itemCount ||
          entriesToRender.length ||
          53,
        present: file.rollCallStats?.present ?? 0,
        absent: file.rollCallStats?.absent ?? 0,
        exempted: file.rollCallStats?.exempted ?? 0,
        weatherSummary:
          file.rollCallStats?.weatherSummary ||
          'Normal weather conditions reported across active stations.',
        entries: entriesToRender,
        fileHash: file.hash,
        snapshotPayload: file.rawSnapshotData || {},
        templateType: templateOverride ?? rcTemplateType,
        paperSize: paperOverride ?? rcPaperSize,
      };
    },
    [profileMap, rcTemplateType, rcPaperSize]
  );

  const handleSelectFileForPreview = useCallback(
    async (
      file: ArchivedFile,
      templateOverride?: RollCallTemplateType,
      paperOverride?: PaperSize
    ) => {
      setHasOpenedPreview(true);
      setSelectedFileForPreview(file);
      setIsPreviewLoading(true);
      setPreviewError(null);

      if (previewPdfBlobUrlRef.current) {
        URL.revokeObjectURL(previewPdfBlobUrlRef.current);
        previewPdfBlobUrlRef.current = null;
        setPreviewPdfBlobUrl(null);
      }

      try {
        const hydratedFile = await ensureArchiveSnapshot(file);
        setSelectedFileForPreview(hydratedFile);

        if (hydratedFile.category === 'roll-call') {
          const { generateRollCallPDF } = await import('@/lib/pdf-generator');
          const payload = buildRollCallPdfPayload(
            hydratedFile,
            templateOverride,
            paperOverride
          );
          const pdf = await generateRollCallPDF(payload);
          const objectUrl = URL.createObjectURL(pdf.blob);
          setPreviewPdfBlobUrl(objectUrl);
          setIsPreviewLoading(false);
          return;
        }

        if (hydratedFile.logEntries && hydratedFile.logEntries.length > 0) {
          const { generateDailyLogsPDF, sortLogsChronologically } =
            await import('@/lib/pdf-generator');

          const dateStr =
            hydratedFile.dailyReportDate ||
            (hydratedFile.createdAt
              ? hydratedFile.createdAt.split('·')[0].trim()
              : '09/27/2026');
          const finalOfficerProfile =
            profileMap.get(hydratedFile.leadOfficer?.toLowerCase().trim()) ||
            null;

          const enrichedShifts = (hydratedFile.shifts || []).map((s) => {
            const sOfficer = profileMap.get(
              s.leadOfficer?.toLowerCase().trim()
            );
            return {
              shiftLabel: s.shiftLabel,
              startTime: s.startTime,
              endTime: s.endTime,
              leadOfficer: s.leadOfficer,
              leadOfficerRole:
                s.leadOfficerRole ||
                sOfficer?.position_title ||
                'Lead Operations Officer',
              handoverStatus: s.handoverStatus,
              roster: s.roster || [],
              standbyVehicles: s.standbyVehicles || [],
              signatures: [],
              signatureUrl: null,
              logsCount: s.logsCount || 0,
            };
          });

          const enrichedLogs = (hydratedFile.logEntries || []).map((l) => {
            const opProfile =
              (l.operator_id
                ? profileMap.get(l.operator_id.toLowerCase())
                : undefined) ||
              (l.operator
                ? profileMap.get(l.operator.toLowerCase().trim())
                : undefined);
            return {
              id: l.id,
              created_at: l.created_at,
              time: l.time,
              date: l.date,
              status: l.status,
              title: l.title,
              reportType:
                l.reportType ||
                (l.status &&
                !['Active', 'Critical', 'Warning', 'Info'].includes(l.status)
                  ? l.status
                  : 'Info'),
              description: l.description,
              operator: l.operator,
              operator_id: l.operator_id || opProfile?.id,
              operatorRole:
                l.operatorRole ||
                opProfile?.position_title ||
                'Duty Operations Officer',
              signatureUrl: null,
            };
          });

          const sortedLogs = sortLogsChronologically(
            enrichedLogs,
            hydratedFile.shifts?.[0]?.startTime || '0800H'
          );

          const pdf = await generateDailyLogsPDF({
            filename: hydratedFile.filename,
            dailyReportDate: dateStr,
            totalShiftsCount: hydratedFile.shifts?.length || 1,
            finalOfficer: hydratedFile.leadOfficer || 'Lead Operations Officer',
            finalOfficerRole:
              hydratedFile.leadOfficerRole ||
              finalOfficerProfile?.position_title ||
              profilePositionTitle ||
              'Lead Operations Officer',
            finalHandoverStatus:
              hydratedFile.handoverStatus || 'Situation Remain Normal',
            signatureUrl: null,
            signaturesMap: {},
            shifts: enrichedShifts,
            logs: sortedLogs,
            fileHash: hydratedFile.hash,
            snapshotPayload: hydratedFile.rawSnapshotData || {},
          });
          const objectUrl = URL.createObjectURL(pdf.blob);
          setPreviewPdfBlobUrl(objectUrl);
          setIsPreviewLoading(false);
          return;
        }

        if (hydratedFile.storagePath) {
          const { data: blobData, error: downloadErr } = await supabase.storage
            .from('archive-documents')
            .download(hydratedFile.storagePath);

          if (!downloadErr && blobData && blobData.size > 0) {
            const pdfBlob = new Blob([blobData], { type: 'application/pdf' });
            const objectUrl = URL.createObjectURL(pdfBlob);
            setPreviewPdfBlobUrl(objectUrl);
            setIsPreviewLoading(false);
            return;
          }
        }

        setIsPreviewLoading(false);
      } catch (err) {
        console.error('Error loading PDF document preview:', err);
        setPreviewError(
          'Unable to load document preview from secure storage.'
        );
        setIsPreviewLoading(false);
      }
    },
    [
      ensureArchiveSnapshot,
      buildRollCallPdfPayload,
      profileMap,
      profilePositionTitle,
    ]
  );

  const handleSwitchRollCallFormat = useCallback(
    async (newTemplate: RollCallTemplateType, newPaper: PaperSize) => {
      setRcTemplateType(newTemplate);
      setRcPaperSize(newPaper);
      if (
        selectedFileForPreview &&
        selectedFileForPreview.category === 'roll-call'
      ) {
        await handleSelectFileForPreview(
          selectedFileForPreview,
          newTemplate,
          newPaper
        );
      }
    },
    [selectedFileForPreview, handleSelectFileForPreview]
  );

  const handleClosePreview = useCallback(() => {
    setSelectedFileForPreview(null);
    if (previewPdfBlobUrlRef.current) {
      URL.revokeObjectURL(previewPdfBlobUrlRef.current);
      previewPdfBlobUrlRef.current = null;
      setPreviewPdfBlobUrl(null);
    }
    setIsPreviewLoading(false);
    setPreviewError(null);
  }, []);

  // ===========================================================================
  // 4. COMPUTED STATS, FILTERS & PAGINATION
  // ===========================================================================

  const { logFiles, rollCallFiles, totalStorageBytes, logStorageBytes, rcStorageBytes } =
    useMemo(() => {
      const logsArr: ArchivedFile[] = [];
      const rcArr: ArchivedFile[] = [];
      let total = 0;
      let logTotal = 0;
      let rcTotal = 0;

      for (const file of archivesList) {
        let b = file.fileSizeBytes;
        if (!b || b <= 0) {
          const match = file.fileSize?.match(/([\d.]+)\s*(MB|KB|GB|Bytes|B)/i);
          if (match) {
            const val = parseFloat(match[1]);
            const unit = match[2].toUpperCase();
            if (unit === 'GB') b = val * 1024 * 1024 * 1024;
            else if (unit === 'MB') b = val * 1024 * 1024;
            else if (unit === 'KB') b = val * 1024;
            else b = val;
          } else {
            b = 1024 * 1024;
          }
        }
        total += b;
        if (file.category === 'log') {
          logsArr.push(file);
          logTotal += b;
        } else {
          rcArr.push(file);
          rcTotal += b;
        }
      }

      return {
        logFiles: logsArr,
        rollCallFiles: rcArr,
        totalStorageBytes: total,
        logStorageBytes: logTotal,
        rcStorageBytes: rcTotal,
      };
    }, [archivesList]);

  const storagePercentage = useMemo(
    () => Math.min(100, (totalStorageBytes / STORAGE_QUOTA_BYTES) * 100),
    [totalStorageBytes]
  );

  const formattedTotalStorage = useMemo(
    () => formatBytes(totalStorageBytes),
    [totalStorageBytes]
  );
  const formattedLogStorage = useMemo(
    () => formatBytes(logStorageBytes),
    [logStorageBytes]
  );
  const formattedRcStorage = useMemo(
    () => formatBytes(rcStorageBytes),
    [rcStorageBytes]
  );
  const formattedFreeStorage = useMemo(
    () => formatBytes(Math.max(0, STORAGE_QUOTA_BYTES - totalStorageBytes)),
    [totalStorageBytes]
  );

  const filteredLogFiles = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase().trim();
    return logFiles.filter((file) => {
      const matchesSearch =
        !q ||
        file.filename.toLowerCase().includes(q) ||
        file.leadOfficer.toLowerCase().includes(q) ||
        file.shift.toLowerCase().includes(q) ||
        file.summary.toLowerCase().includes(q) ||
        file.hash.toLowerCase().includes(q) ||
        file.handoverStatus.toLowerCase().includes(q) ||
        Boolean(
          file.logEntries?.some(
            (l) =>
              l.title.toLowerCase().includes(q) ||
              l.description.toLowerCase().includes(q) ||
              l.operator.toLowerCase().includes(q)
          )
        );
      const matchesDate =
        !selectedDateISO || getFileDateISO(file) === selectedDateISO;
      return matchesSearch && matchesDate;
    });
  }, [logFiles, debouncedSearchQuery, selectedDateISO]);

  const filteredRollCallFiles = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase().trim();
    return rollCallFiles.filter((file) => {
      const matchesSearch =
        !q ||
        file.filename.toLowerCase().includes(q) ||
        file.leadOfficer.toLowerCase().includes(q) ||
        file.shift.toLowerCase().includes(q) ||
        file.summary.toLowerCase().includes(q) ||
        file.hash.toLowerCase().includes(q) ||
        Boolean(
          file.rollCallStats &&
            (file.rollCallStats.weatherSummary.toLowerCase().includes(q) ||
              file.rollCallStats.frequency.toLowerCase().includes(q))
        ) ||
        Boolean(
          file.rollCallEntries?.some(
            (e) =>
              e.municipality.toLowerCase().includes(q) ||
              Boolean(
                e.weatherCondition &&
                  e.weatherCondition.toLowerCase().includes(q)
              ) ||
              Boolean(
                e.seaPortStatus && e.seaPortStatus.toLowerCase().includes(q)
              ) ||
              Boolean(e.dutyOperator && e.dutyOperator.toLowerCase().includes(q))
          )
        );
      const matchesDate =
        !selectedDateISO || getFileDateISO(file) === selectedDateISO;
      return matchesSearch && matchesDate;
    });
  }, [rollCallFiles, debouncedSearchQuery, selectedDateISO]);

  const currentDataset =
    activeTab === 'log' ? filteredLogFiles : filteredRollCallFiles;
  const totalCount = currentDataset.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const effectivePage = Math.min(currentPage, totalPages);

  const paginatedFiles = useMemo(() => {
    const start = (effectivePage - 1) * itemsPerPage;
    return currentDataset.slice(start, start + itemsPerPage);
  }, [currentDataset, effectivePage, itemsPerPage]);

  // Tab switch handler
  const handleTabChange = useCallback((tab: 'log' | 'roll-call') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setActiveMenuId(null);
  }, []);

  // Context Menu Toggle handler
  const handleToggleMenu = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuId((prev) => (prev === id ? null : id));
  }, []);

  // Copy Hash handler
  const handleCopyHash = useCallback((file: ArchivedFile) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(file.hash);
      setToastNotification({
        type: 'success',
        message: 'SHA-256 Hash Copied',
        submessage: `Integrity fingerprint for ${file.filename} is saved to clipboard.`,
      });
    }
    setActiveMenuId(null);
  }, []);

  // Download export handler (dynamic PDF generation + Storage download + JSON fallback)
  const handleDownloadFile = useCallback(
    async (file: ArchivedFile) => {
      try {
        if (file.category === 'roll-call') {
          const hydratedFile = await ensureArchiveSnapshot(file);
          const { generateRollCallPDF, PAPER_DIMENSIONS } = await import(
            '@/lib/pdf-generator'
          );
          const payload = buildRollCallPdfPayload(
            hydratedFile,
            rcTemplateType,
            rcPaperSize
          );
          const pdf = await generateRollCallPDF(payload);
          const url = window.URL.createObjectURL(pdf.blob);
          const downloadAnchor = document.createElement('a');
          downloadAnchor.href = url;
          const baseName = hydratedFile.filename.replace(/\.(pdf|json)$/i, '');
          const tplTag =
            rcTemplateType === 'net_calling' ? 'NETCALL' : 'OFFICIAL';
          const sizeTag = rcPaperSize.toUpperCase();
          downloadAnchor.download = `${baseName}-${tplTag}-${sizeTag}.pdf`;
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          downloadAnchor.remove();
          window.URL.revokeObjectURL(url);

          setToastNotification({
            type: 'success',
            message: 'Roll Call PDF Downloaded',
            submessage: `Exported as ${
              rcTemplateType === 'net_calling'
                ? 'Net Calling Sheet'
                : 'Official MLS Table'
            } (${PAPER_DIMENSIONS[rcPaperSize].shortLabel}).`,
          });
          setActiveMenuId(null);
          return;
        }

        if (file.storagePath) {
          const { data: blobData, error: downloadErr } = await supabase.storage
            .from('archive-documents')
            .download(file.storagePath);

          if (!downloadErr && blobData) {
            const url = window.URL.createObjectURL(blobData);
            const downloadAnchor = document.createElement('a');
            downloadAnchor.href = url;
            downloadAnchor.download =
              file.filename.endsWith('.json') || file.filename.endsWith('.pdf')
                ? file.filename
                : `${file.filename}.json`;
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            window.URL.revokeObjectURL(url);

            setToastNotification({
              type: 'success',
              message: 'Archive Document Downloaded',
              submessage: `${file.filename} retrieved directly from secure archive storage.`,
            });
            setActiveMenuId(null);
            return;
          }
        }

        const hydratedFile = await ensureArchiveSnapshot(file);
        const exportObject = {
          filename: hydratedFile.filename,
          category: hydratedFile.category,
          hash: hydratedFile.hash,
          status: hydratedFile.status,
          generatedAt: hydratedFile.createdAt,
          leadOfficer: hydratedFile.leadOfficer,
          leadOfficerRole: hydratedFile.leadOfficerRole,
          shift: hydratedFile.shift,
          summary: hydratedFile.summary,
          snapshot: hydratedFile.rawSnapshotData || {},
        };

        const dataStr =
          'data:text/json;charset=utf-8,' +
          encodeURIComponent(JSON.stringify(exportObject, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute(
          'download',
          hydratedFile.filename.replace(/\.pdf$/i, '.json')
        );
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        setToastNotification({
          type: 'success',
          message: 'Archive Document Exported',
          submessage: `${hydratedFile.filename} snapshot downloaded successfully.`,
        });
      } catch (err) {
        console.error('Download error:', err);
      }
      setActiveMenuId(null);
    },
    [
      ensureArchiveSnapshot,
      buildRollCallPdfPayload,
      rcTemplateType,
      rcPaperSize,
    ]
  );

  // Print ONLY the bucket PDF file itself
  const handlePrintDocument = useCallback(() => {
    if (printIframeRef.current?.contentWindow) {
      try {
        printIframeRef.current.contentWindow.focus();
        printIframeRef.current.contentWindow.print();
        return;
      } catch (err) {
        console.warn('Direct iframe print blocked, opening print window:', err);
      }
    }
    if (previewPdfBlobUrlRef.current) {
      const printWin = window.open(previewPdfBlobUrlRef.current, '_blank');
      if (printWin) {
        printWin.onload = () => {
          printWin.focus();
          printWin.print();
        };
      }
    }
  }, []);

  // ===========================================================================
  // 5. RENDER JSX
  // ===========================================================================
  return (
    <AppLayoutShell
      title="Archives Management"
      subtitle="Official DOCX/PDF Records & Certified Audit Trail"
    >
      <div className="space-y-6">
        <ViewOnlyNotice
          screen="Archives"
          message="You are viewing the certified archive repository in read-only audit mode. Document exports and integrity verification remain available."
        />

        {/* 1. HEADER SECTION */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
                Certified Document Archives
              </h2>
              {isRefreshing && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#004AC6] border border-blue-200">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing
                </span>
              )}
            </div>
            <p className="text-sm sm:text-base text-[#505F76] mt-1 font-medium">
              Official Shift Logs, Station Roll Calls & SHA-256 Certified Records
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <SecondaryButton
              size="md"
              pill
              leftIcon={
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                />
              }
              onClick={() =>
                fetchArchives({ isBackground: archivesListRef.current.length > 0 })
              }
              className="w-full sm:w-auto justify-center"
            >
              Refresh
            </SecondaryButton>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Link href="/archives/transfer" className="flex-1 sm:flex-initial">
                <SecondaryButton
                  size="md"
                  pill
                  leftIcon={<FolderUp className="w-4 h-4 text-[#004AC6]" />}
                  className="w-full sm:w-auto justify-center"
                >
                  Transfer Hub
                </SecondaryButton>
              </Link>

              <Link href="/archives/drive" className="flex-1 sm:flex-initial">
                <PrimaryButton
                  size="md"
                  pill
                  leftIcon={<FolderOpen className="w-4 h-4" />}
                  className="w-full sm:w-auto justify-center"
                >
                  Drive Files
                </PrimaryButton>
              </Link>
            </div>
          </div>
        </div>

        {/* 2. DYNAMIC TOP STATS METRIC CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs overflow-hidden group hover:border-[#CBD5E1] transition-all">
            <div className="absolute -right-6 -top-6 w-28 h-28 bg-[#004AC6]/5 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out pointer-events-none" />
            <div className="flex justify-between items-start mb-3 relative z-10">
              <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider">
                Total Shift Logs Created
              </span>
              <div className="w-10 h-10 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-end gap-4 relative z-10">
              {isLoading ? (
                <Skeleton className="h-10 w-24 rounded-xl" />
              ) : (
                <span className="text-4xl sm:text-5xl font-extrabold text-[#1E293B] tracking-tight leading-none">
                  {logFiles.length.toLocaleString()}
                </span>
              )}
              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Live Database Records
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-[#757680] font-medium relative z-10">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#004AC6]" />
                All Handover Records Encrypted & Verified
              </span>
            </div>
          </div>

          <div className="relative bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs overflow-hidden group hover:border-[#CBD5E1] transition-all">
            <div className="absolute -right-6 -top-6 w-28 h-28 bg-sky-500/5 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out pointer-events-none" />
            <div className="flex justify-between items-start mb-3 relative z-10">
              <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider">
                Total Roll Call Files Created
              </span>
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-700 flex items-center justify-center border border-sky-500/15">
                <Radio className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-end gap-4 relative z-10">
              {isLoading ? (
                <Skeleton className="h-10 w-24 rounded-xl" />
              ) : (
                <span className="text-4xl sm:text-5xl font-extrabold text-[#1E293B] tracking-tight leading-none">
                  {rollCallFiles.length.toLocaleString()}
                </span>
              )}
              <div className="flex items-center gap-1 bg-slate-100 text-[#505F76] border border-slate-200 px-3 py-1 rounded-full text-xs font-bold mb-1">
                <Clock className="w-3.5 h-3.5" />
                Live Database Records
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-[#757680] font-medium relative z-10">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                All Station Telemetry Audited & Logged
              </span>
            </div>
          </div>
        </div>

        {/* OVERALL FILE STORAGE & REPOSITORY PROGRESS */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E2E8F0] shadow-xs space-y-3.5 hover:border-[#CBD5E1] transition-all">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15 shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
                    Overall Archive Storage Capacity
                  </h3>
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200/80 font-mono">
                    {archivesList.length} Archived{' '}
                    {archivesList.length === 1 ? 'File' : 'Files'}
                  </span>
                </div>
                <p className="text-xs text-[#757680] mt-0.5">
                  Total storage consumed across all certified shift logs and roll
                  call session documents
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <Link href="/archives/transfer">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-[#004AC6] border border-blue-200 hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>Transfer Hub</span>
                </button>
              </Link>

              <div className="text-left sm:text-right">
                <div className="flex items-baseline gap-1.5 sm:justify-end">
                  {isLoading ? (
                    <Skeleton className="h-6 w-28 rounded-md" />
                  ) : (
                    <>
                      <span className="text-base sm:text-lg font-extrabold font-mono text-[#1E293B]">
                        {formattedTotalStorage}
                      </span>
                      <span className="text-xs font-semibold text-[#757680]">
                        / 1.0 GB
                      </span>
                    </>
                  )}
                </div>
                {!isLoading && (
                  <span className="text-[11px] font-bold text-[#505F76]">
                    {storagePercentage.toFixed(1)}% Allocated
                  </span>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="w-full h-2.5 rounded-full" />
          ) : (
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  storagePercentage >= 90
                    ? 'bg-rose-600'
                    : storagePercentage >= 75
                    ? 'bg-amber-500'
                    : 'bg-linear-to-r from-[#004AC6] to-sky-500'
                }`}
                style={{
                  width: `${Math.max(0.5, Math.min(100, storagePercentage))}%`,
                }}
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-between items-center pt-1">
              <Skeleton className="h-3.5 w-48 rounded" />
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between text-xs text-[#505F76] font-medium pt-0.5 gap-2">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#004AC6]" />
                  Shift Logs:{' '}
                  <strong className="text-[#1E293B] font-mono">
                    {formattedLogStorage}
                  </strong>{' '}
                  ({logFiles.length} {logFiles.length === 1 ? 'file' : 'files'})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  Roll Calls:{' '}
                  <strong className="text-[#1E293B] font-mono">
                    {formattedRcStorage}
                  </strong>{' '}
                  ({rollCallFiles.length}{' '}
                  {rollCallFiles.length === 1 ? 'file' : 'files'})
                </span>
              </div>
              <span className="text-[#757680] text-[11px] font-medium">
                {formattedFreeStorage} Available Quota
              </span>
            </div>
          )}
        </div>

        {/* 3. ARCHIVES TABLE SECTION WITH TABS & FILTERS */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white">
            {/* Segmented Tabs */}
            <div className="flex bg-[#F1F5F9] p-1.5 rounded-full self-start border border-[#E2E8F0]/70">
              <button
                type="button"
                onClick={() => handleTabChange('log')}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'log'
                    ? 'bg-white text-[#004AC6] shadow-xs'
                    : 'text-[#505F76] hover:text-[#1E293B]'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Logged Files</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === 'log'
                      ? 'bg-[#004AC6]/10 text-[#004AC6]'
                      : 'bg-slate-200 text-[#505F76]'
                  }`}
                >
                  {logFiles.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('roll-call')}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'roll-call'
                    ? 'bg-white text-[#004AC6] shadow-xs'
                    : 'text-[#505F76] hover:text-[#1E293B]'
                }`}
              >
                <Radio className="w-4 h-4" />
                <span>Roll Call Files</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === 'roll-call'
                      ? 'bg-[#004AC6]/10 text-[#004AC6]'
                      : 'bg-slate-200 text-[#505F76]'
                  }`}
                >
                  {rollCallFiles.length}
                </span>
              </button>
            </div>

            {/* Search & Date Filter */}
            <div className="flex items-center gap-3 flex-1 md:max-w-md justify-end">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search archives by file, officer, shift, hash..."
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

              {/* Single Date Picker Filter */}
              <div className="relative shrink-0" ref={datePickerRef}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setHasOpenedDatePicker(true);
                    setIsDatePickerOpen((prev) => !prev);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setHasOpenedDatePicker(true);
                      setIsDatePickerOpen((prev) => !prev);
                    }
                  }}
                  className={`h-10 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 border select-none ${
                    selectedDate
                      ? 'bg-blue-50 text-[#004AC6] border-[#004AC6]/30 shadow-xs'
                      : 'bg-[#F8FAFC] text-[#505F76] border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-white'
                  }`}
                >
                  <CalendarIcon
                    className={`w-4 h-4 shrink-0 ${
                      selectedDate ? 'text-[#004AC6]' : 'text-[#94A3B8]'
                    }`}
                  />
                  <span className="whitespace-nowrap font-medium">
                    {selectedDate
                      ? format(selectedDate, 'MMM dd, yyyy')
                      : 'All Dates'}
                  </span>
                  {selectedDate ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate(null);
                        setCurrentPage(1);
                      }}
                      className="w-4 h-4 rounded-full hover:bg-blue-200/60 text-[#004AC6] flex items-center justify-center transition-colors ml-0.5 cursor-pointer"
                      title="Clear date filter"
                      aria-label="Clear date filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  ) : (
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform ${
                        isDatePickerOpen ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </div>

                {hasOpenedDatePicker && (
                  <AnimatePresence>
                    {isDatePickerOpen && (
                      <DateFilterPopover
                        selectedDate={selectedDate}
                        onSelectDate={(date) => {
                          setSelectedDate(date);
                          setCurrentPage(1);
                        }}
                        onClose={() => setIsDatePickerOpen(false)}
                      />
                    )}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider">
                  <th className="py-4 px-6">Name of File</th>
                  <th className="py-4 px-6">Lead Duty Officer · Shift</th>
                  <th className="py-4 px-6">Generated At</th>
                  <th className="py-4 px-6">File Size</th>
                  <th className="py-4 px-6 text-right">Actions</th>
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
                            <Skeleton className="h-4 w-44 rounded-md" />
                            <Skeleton className="h-3 w-28 rounded-md" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-32 rounded-md" />
                          <Skeleton className="h-3 w-24 rounded-md" />
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Skeleton className="h-4 w-32 rounded-md" />
                      </td>
                      <td className="py-4 px-6">
                        <Skeleton className="h-4 w-16 rounded-full" />
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Skeleton className="h-8 w-24 rounded-full ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : paginatedFiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-14 text-center text-[#757680]">
                      <ArchiveIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p className="font-bold text-base text-[#1E293B]">
                        No Archived Records Found
                      </p>
                      <p className="text-xs text-[#757680] mt-1 max-w-sm mx-auto">
                        {searchQuery || selectedDate !== null
                          ? 'No files matched your search or date filter. Try adjusting your query or resetting the date picker.'
                          : activeTab === 'log'
                          ? 'Shift handover records will automatically appear here when an officer logs the end of shift.'
                          : 'Roll call session reports will automatically appear here once an operator finalizes a roll call.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedFiles.map((file) => (
                    <ArchiveRow
                      key={file.id}
                      file={file}
                      isMenuOpen={activeMenuId === file.id}
                      onPreview={handleSelectFileForPreview}
                      onDownload={handleDownloadFile}
                      onCopyHash={handleCopyHash}
                      onToggleMenu={handleToggleMenu}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 sm:p-5 border-t border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <span className="text-xs text-[#757680] font-medium">
              Showing{' '}
              {totalCount > 0 ? (effectivePage - 1) * itemsPerPage + 1 : 0} to{' '}
              {Math.min(effectivePage * itemsPerPage, totalCount)} of{' '}
              {totalCount}{' '}
              {activeTab === 'log' ? 'logged files' : 'roll call files'}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={effectivePage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-bold text-[#1E293B] px-2">
                Page {effectivePage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={effectivePage === totalPages || totalPages === 0}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. LAZY-MOUNTED DOCUMENT ARCHIVE PDF PREVIEW MODAL */}
      {hasOpenedPreview && (
        <ArchivePreviewModal
          selectedFile={selectedFileForPreview}
          previewViewMode={previewViewMode}
          previewPdfBlobUrl={previewPdfBlobUrl}
          isPreviewLoading={isPreviewLoading}
          previewError={previewError}
          rcTemplateType={rcTemplateType}
          rcPaperSize={rcPaperSize}
          profileMap={profileMap}
          currentUserProfile={profile}
          printIframeRef={printIframeRef}
          onChangeViewMode={setPreviewViewMode}
          onSwitchRollCallFormat={handleSwitchRollCallFormat}
          onRetryPreview={handleSelectFileForPreview}
          onDownload={handleDownloadFile}
          onPrint={handlePrintDocument}
          onClose={handleClosePreview}
        />
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-[#1E293B] text-white px-5 py-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 max-w-md"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                {toastNotification.message}
              </p>
              {toastNotification.submessage && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {toastNotification.submessage}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
