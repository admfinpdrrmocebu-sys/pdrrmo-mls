'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Database,
  HardDrive,
  RefreshCw,
  Trash2,
  Download,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sliders,
  ArrowLeft,
  FolderUp,
  Play,
  Eye,
  Save,
  Sparkles,
} from 'lucide-react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';

const DB_FREE_TIER_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB
const STORAGE_FREE_TIER_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB
const LOCAL_RETENTION_SETTINGS_KEY = 'pdrrmo_retention_settings_v1';

interface RetentionSettingsState {
  logs_retention_days: number;
  rollcall_entries_retention_days: number;
  rollcall_sessions_retention_days: number;
  attendance_retention_days: number;
  roster_retention_days: number;
  snapshot_retention_days: number;
  storage_pdf_retention_days: number;
  audit_retention_days: number;
  auto_cleanup_enabled: boolean;
  last_cleanup_at: string | null;
}

interface TableTelemetryRow {
  table_name: string;
  label: string;
  row_count: number;
  size_bytes: number;
  oldest_date: string | null;
}

interface CleanupSummaryResult {
  dry_run: boolean;
  shift_logs_deleted: number;
  shifts_deleted: number;
  roll_call_entries_deleted: number;
  roll_call_sessions_deleted: number;
  duty_attendance_deleted: number;
  duty_roster_deleted: number;
  archive_snapshots_compacted: number;
  audit_logs_deleted: number;
  expired_otps_deleted: number;
  expired_invitations_deleted: number;
  storage_pdfs_deleted?: number;
  executed_at: string;
}

const DEFAULT_RETENTION_SETTINGS: RetentionSettingsState = {
  logs_retention_days: 60,
  rollcall_entries_retention_days: 30,
  rollcall_sessions_retention_days: 90,
  attendance_retention_days: 90,
  roster_retention_days: 90,
  snapshot_retention_days: 90,
  storage_pdf_retention_days: 30,
  audit_retention_days: 90,
  auto_cleanup_enabled: true,
  last_cleanup_at: null,
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getCutoffDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, days));
  return d.toISOString().split('T')[0];
}

function getCutoffIsoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, days));
  return d.toISOString();
}

export default function DatabaseOptimizationPage() {
  const { canWrite } = useAuth();
  const canManageSettings = canWrite('Settings');

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isRunningDryRun, setIsRunningDryRun] = useState(false);
  const [isExecutingCleanup, setIsExecutingCleanup] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [includeStoragePdfPurge, setIncludeStoragePdfPurge] = useState(false);
  const [rpcInstalled, setRpcInstalled] = useState(true);

  const [dbSizeBytes, setDbSizeBytes] = useState(0);
  const [storageSizeBytes, setStorageSizeBytes] = useState(0);
  const [archiveBucketFiles, setArchiveBucketFiles] = useState(0);
  const [oldArchiveBucketFiles, setOldArchiveBucketFiles] = useState(0);
  const [oldArchiveBucketBytes, setOldArchiveBucketBytes] = useState(0);
  const [tables, setTables] = useState<TableTelemetryRow[]>([]);

  const [settings, setSettings] = useState<RetentionSettingsState>(
    DEFAULT_RETENTION_SETTINGS
  );
  const [dryRunResult, setDryRunResult] = useState<CleanupSummaryResult | null>(
    null
  );
  const [toast, setToast] = useState<{
    type: 'success' | 'info' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const showToastMessage = useCallback(
    (type: 'success' | 'info' | 'error', title: string, message: string) => {
      setToast({ type, title, message });
      setTimeout(() => {
        setToast((prev) => (prev?.title === title ? null : prev));
      }, 5000);
    },
    []
  );

  const fetchTelemetry = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Try native Postgres telemetry RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_database_storage_telemetry'
      );

      if (!rpcError && rpcData) {
        setRpcInstalled(true);
        const payload = rpcData as Record<string, any>;
        setDbSizeBytes(Number(payload.db_size_bytes || 0));
        setStorageSizeBytes(Number(payload.storage_size_bytes || 0));
        setArchiveBucketFiles(Number(payload.archive_bucket_files || 0));
        setOldArchiveBucketFiles(Number(payload.old_archive_bucket_files || 0));
        setOldArchiveBucketBytes(Number(payload.old_archive_bucket_bytes || 0));

        if (Array.isArray(payload.tables)) {
          setTables(
            payload.tables.map((t: any) => ({
              table_name: String(t.table_name),
              label: String(t.label),
              row_count: Number(t.row_count || 0),
              size_bytes: Number(t.size_bytes || 0),
              oldest_date: t.oldest_date ? String(t.oldest_date) : null,
            }))
          );
        }

        if (payload.settings && typeof payload.settings === 'object') {
          const s = payload.settings;
          setSettings({
            logs_retention_days: Number(s.logs_retention_days ?? 60),
            rollcall_entries_retention_days: Number(
              s.rollcall_entries_retention_days ?? 30
            ),
            rollcall_sessions_retention_days: Number(
              s.rollcall_sessions_retention_days ?? 90
            ),
            attendance_retention_days: Number(s.attendance_retention_days ?? 90),
            roster_retention_days: Number(s.roster_retention_days ?? 90),
            snapshot_retention_days: Number(s.snapshot_retention_days ?? 90),
            storage_pdf_retention_days: Number(
              s.storage_pdf_retention_days ?? 30
            ),
            audit_retention_days: Number(s.audit_retention_days ?? 90),
            auto_cleanup_enabled: Boolean(s.auto_cleanup_enabled ?? true),
            last_cleanup_at: s.last_cleanup_at || null,
          });
        }
        return;
      }

      // 2. Fallback client-side telemetry if SQL migration hasn't been executed yet
      setRpcInstalled(false);
      try {
        const rawLocal = localStorage.getItem(LOCAL_RETENTION_SETTINGS_KEY);
        if (rawLocal) {
          setSettings((prev) => ({ ...prev, ...JSON.parse(rawLocal) }));
        }
      } catch {}

      const [
        logsCountRes,
        shiftsCountRes,
        rcEntriesCountRes,
        rcSessionsCountRes,
        attCountRes,
        rosterCountRes,
        archivesRes,
        auditCountRes,
        mlsStorageRes,
        rcStorageRes,
      ] = await Promise.all([
        supabase.from('shift_logs').select('id', { count: 'exact', head: true }),
        supabase.from('shifts').select('id', { count: 'exact', head: true }),
        supabase
          .from('roll_call_entries')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('roll_call_sessions')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('duty_attendance_records')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('duty_roster_assignments')
          .select('id', { count: 'exact', head: true }),
        supabase.from('archives').select('id, file_size_bytes, generated_at'),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
        supabase.storage.from('archive-documents').list('MLS', { limit: 500 }),
        supabase.storage.from('archive-documents').list('RC', { limit: 500 }),
      ]);

      const logsCount = logsCountRes.count ?? 0;
      const shiftsCount = shiftsCountRes.count ?? 0;
      const rcEntriesCount = rcEntriesCountRes.count ?? 0;
      const rcSessionsCount = rcSessionsCountRes.count ?? 0;
      const attCount = attCountRes.count ?? 0;
      const rosterCount = rosterCountRes.count ?? 0;
      const archivesRows = archivesRes.data || [];
      const auditCount = auditCountRes.count ?? 0;

      const estLogsBytes = logsCount * 1450;
      const estShiftsBytes = shiftsCount * 950;
      const estRcEntriesBytes = rcEntriesCount * 420;
      const estRcSessionsBytes = rcSessionsCount * 1100;
      const estAttBytes = attCount * 480;
      const estRosterBytes = rosterCount * 380;
      const estArchivesDbBytes = archivesRows.length * 18500;
      const estAuditBytes = auditCount * 650;
      const estTotalDb =
        estLogsBytes +
        estShiftsBytes +
        estRcEntriesBytes +
        estRcSessionsBytes +
        estAttBytes +
        estRosterBytes +
        estArchivesDbBytes +
        estAuditBytes +
        8 * 1024 * 1024; // ~8 MB base catalog/indexes

      const bucketItems = [
        ...(mlsStorageRes.data || []).filter(
          (f) => f.name && f.name !== '.emptyFolderPlaceholder'
        ),
        ...(rcStorageRes.data || []).filter(
          (f) => f.name && f.name !== '.emptyFolderPlaceholder'
        ),
      ];

      let bucketBytes = 0;
      let oldFiles = 0;
      let oldBytes = 0;
      const cutoffStorageMs =
        Date.now() - settings.storage_pdf_retention_days * 86400 * 1000;

      for (const f of bucketItems) {
        const sz = Number(f.metadata?.size || 450 * 1024);
        bucketBytes += sz;
        const createdMs = f.created_at ? new Date(f.created_at).getTime() : Date.now();
        if (createdMs < cutoffStorageMs) {
          oldFiles += 1;
          oldBytes += sz;
        }
      }

      setDbSizeBytes(estTotalDb);
      setStorageSizeBytes(bucketBytes);
      setArchiveBucketFiles(bucketItems.length);
      setOldArchiveBucketFiles(oldFiles);
      setOldArchiveBucketBytes(oldBytes);

      setTables([
        {
          table_name: 'shift_logs',
          label: 'Shift Operations Logs (/logs)',
          row_count: logsCount,
          size_bytes: estLogsBytes,
          oldest_date: null,
        },
        {
          table_name: 'shifts',
          label: 'Operational Shifts & Duty Personnel (/logs & /shifts)',
          row_count: shiftsCount,
          size_bytes: estShiftsBytes,
          oldest_date: null,
        },
        {
          table_name: 'roll_call_entries',
          label: 'Roll Call LGU Station Entries (/roll-call)',
          row_count: rcEntriesCount,
          size_bytes: estRcEntriesBytes,
          oldest_date: null,
        },
        {
          table_name: 'roll_call_sessions',
          label: 'Roll Call Session Summaries (/roll-call)',
          row_count: rcSessionsCount,
          size_bytes: estRcSessionsBytes,
          oldest_date: null,
        },
        {
          table_name: 'duty_attendance_records',
          label: 'Officer Check-In / Attendance (/shifts)',
          row_count: attCount,
          size_bytes: estAttBytes,
          oldest_date: null,
        },
        {
          table_name: 'duty_roster_assignments',
          label: 'Shift Schedule Calendar Roster (/settings/shifts)',
          row_count: rosterCount,
          size_bytes: estRosterBytes,
          oldest_date: null,
        },
        {
          table_name: 'archives',
          label: 'Archives Metadata & JSONB Snapshots (/archives)',
          row_count: archivesRows.length,
          size_bytes: estArchivesDbBytes,
          oldest_date: null,
        },
        {
          table_name: 'audit_logs',
          label: 'System Audit Trail & OTP Hygiene',
          row_count: auditCount,
          size_bytes: estAuditBytes,
          oldest_date: null,
        },
      ]);
    } catch (err) {
      console.error('Error loading database telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  }, [settings.storage_pdf_retention_days]);

  useEffect(() => {
    void fetchTelemetry();
  }, [fetchTelemetry]);

  const handleSaveRetentionSettings = async () => {
    if (!canManageSettings) return;
    setIsSavingSettings(true);
    try {
      try {
        localStorage.setItem(
          LOCAL_RETENTION_SETTINGS_KEY,
          JSON.stringify(settings)
        );
      } catch {}

      const { error } = await supabase.from('app_retention_settings').upsert({
        id: 1,
        logs_retention_days: settings.logs_retention_days,
        rollcall_entries_retention_days: settings.rollcall_entries_retention_days,
        rollcall_sessions_retention_days:
          settings.rollcall_sessions_retention_days,
        attendance_retention_days: settings.attendance_retention_days,
        roster_retention_days: settings.roster_retention_days,
        snapshot_retention_days: settings.snapshot_retention_days,
        storage_pdf_retention_days: settings.storage_pdf_retention_days,
        audit_retention_days: settings.audit_retention_days,
        auto_cleanup_enabled: settings.auto_cleanup_enabled,
        updated_at: new Date().toISOString(),
      });

      if (error && rpcInstalled) {
        console.warn('Retention settings DB upsert notice:', error.message);
      }

      showToastMessage(
        'success',
        'Retention Policy Saved',
        'Per-module cleanup durations and automated schedule settings have been updated.'
      );
      await fetchTelemetry();
    } catch (err: any) {
      showToastMessage(
        'error',
        'Could Not Save Policy',
        err?.message || 'Failed to save retention settings.'
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const runRetentionPass = useCallback(
    async (dryRun: boolean): Promise<CleanupSummaryResult | null> => {
      // 1. Try native RPC first
      const { data: rpcRes, error: rpcErr } = await supabase.rpc(
        'run_data_retention_cleanup',
        {
          p_dry_run: dryRun,
          p_logs_days: settings.logs_retention_days,
          p_rollcall_entries_days: settings.rollcall_entries_retention_days,
          p_rollcall_sessions_days: settings.rollcall_sessions_retention_days,
          p_attendance_days: settings.attendance_retention_days,
          p_roster_days: settings.roster_retention_days,
          p_snapshot_days: settings.snapshot_retention_days,
          p_audit_days: settings.audit_retention_days,
        }
      );

      let baseSummary: CleanupSummaryResult;

      if (!rpcErr && rpcRes) {
        const r = rpcRes as Record<string, any>;
        baseSummary = {
          dry_run: Boolean(r.dry_run),
          shift_logs_deleted: Number(r.shift_logs_deleted || 0),
          shifts_deleted: Number(r.shifts_deleted || 0),
          roll_call_entries_deleted: Number(r.roll_call_entries_deleted || 0),
          roll_call_sessions_deleted: Number(r.roll_call_sessions_deleted || 0),
          duty_attendance_deleted: Number(r.duty_attendance_deleted || 0),
          duty_roster_deleted: Number(r.duty_roster_deleted || 0),
          archive_snapshots_compacted: Number(
            r.archive_snapshots_compacted || 0
          ),
          audit_logs_deleted: Number(r.audit_logs_deleted || 0),
          expired_otps_deleted: Number(r.expired_otps_deleted || 0),
          expired_invitations_deleted: Number(
            r.expired_invitations_deleted || 0
          ),
          executed_at: String(r.executed_at || new Date().toISOString()),
        };
      } else {
        // 2. Client-side fallback execution / dry-run
        const logsCutoff = getCutoffDateStr(settings.logs_retention_days);
        const rcSessionsCutoff = getCutoffDateStr(
          settings.rollcall_sessions_retention_days
        );
        const attCutoff = getCutoffDateStr(settings.attendance_retention_days);
        const rosterCutoff = getCutoffDateStr(settings.roster_retention_days);
        const auditCutoffIso = getCutoffIsoStr(settings.audit_retention_days);

        const [logsC, shiftsC, rcSessC, attC, rosterC, auditC] =
          await Promise.all([
            supabase
              .from('shift_logs')
              .select('id', { count: 'exact', head: true })
              .lt('log_date', logsCutoff),
            supabase
              .from('shifts')
              .select('id', { count: 'exact', head: true })
              .neq('status', 'active')
              .lt('shift_date', logsCutoff),
            supabase
              .from('roll_call_sessions')
              .select('id', { count: 'exact', head: true })
              .neq('status', 'in_progress')
              .lt('session_date', rcSessionsCutoff),
            supabase
              .from('duty_attendance_records')
              .select('id', { count: 'exact', head: true })
              .neq('status', 'checked_in')
              .lt('duty_date', attCutoff),
            supabase
              .from('duty_roster_assignments')
              .select('id', { count: 'exact', head: true })
              .lt('duty_date', rosterCutoff),
            supabase
              .from('audit_logs')
              .select('id', { count: 'exact', head: true })
              .lt('created_at', auditCutoffIso),
          ]);

        if (!dryRun) {
          await supabase.from('shift_logs').delete().lt('log_date', logsCutoff);
          await supabase
            .from('shifts')
            .delete()
            .neq('status', 'active')
            .lt('shift_date', logsCutoff);
          await supabase
            .from('roll_call_sessions')
            .delete()
            .neq('status', 'in_progress')
            .lt('session_date', rcSessionsCutoff);
          await supabase
            .from('duty_attendance_records')
            .delete()
            .neq('status', 'checked_in')
            .lt('duty_date', attCutoff);
          await supabase
            .from('duty_roster_assignments')
            .delete()
            .lt('duty_date', rosterCutoff);
          await supabase
            .from('audit_logs')
            .delete()
            .lt('created_at', auditCutoffIso);
        }

        baseSummary = {
          dry_run: dryRun,
          shift_logs_deleted: logsC.count ?? 0,
          shifts_deleted: shiftsC.count ?? 0,
          roll_call_entries_deleted: 0,
          roll_call_sessions_deleted: rcSessC.count ?? 0,
          duty_attendance_deleted: attC.count ?? 0,
          duty_roster_deleted: rosterC.count ?? 0,
          archive_snapshots_compacted: 0,
          audit_logs_deleted: auditC.count ?? 0,
          expired_otps_deleted: 0,
          expired_invitations_deleted: 0,
          executed_at: new Date().toISOString(),
        };
      }

      // Optional Storage bucket PDF purge for files older than storage_pdf_retention_days
      if (!dryRun && includeStoragePdfPurge) {
        const cutoffMs =
          Date.now() - settings.storage_pdf_retention_days * 86400 * 1000;
        const [mlsList, rcList] = await Promise.all([
          supabase.storage.from('archive-documents').list('MLS', { limit: 500 }),
          supabase.storage.from('archive-documents').list('RC', { limit: 500 }),
        ]);

        const pathsToRemove: string[] = [];
        for (const f of mlsList.data || []) {
          if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
          const t = f.created_at ? new Date(f.created_at).getTime() : Date.now();
          if (t < cutoffMs) pathsToRemove.push(`MLS/${f.name}`);
        }
        for (const f of rcList.data || []) {
          if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
          const t = f.created_at ? new Date(f.created_at).getTime() : Date.now();
          if (t < cutoffMs) pathsToRemove.push(`RC/${f.name}`);
        }

        if (pathsToRemove.length > 0) {
          await supabase.storage
            .from('archive-documents')
            .remove(pathsToRemove);
          baseSummary.storage_pdfs_deleted = pathsToRemove.length;
        }
      }

      return baseSummary;
    },
    [settings, includeStoragePdfPurge]
  );

  const handlePreviewDryRun = async () => {
    setIsRunningDryRun(true);
    try {
      const res = await runRetentionPass(true);
      if (res) {
        setDryRunResult(res);
        showToastMessage(
          'info',
          'Dry-Run Preview Ready',
          'Calculated eligible historical rows without deleting any data.'
        );
      }
    } catch (err: any) {
      showToastMessage(
        'error',
        'Dry-Run Failed',
        err?.message || 'Could not compute retention preview.'
      );
    } finally {
      setIsRunningDryRun(false);
    }
  };

  const handleExecuteCleanup = async () => {
    if (!canManageSettings) return;
    setIsExecutingCleanup(true);
    try {
      const res = await runRetentionPass(false);
      setShowConfirmModal(false);
      if (res) {
        setDryRunResult(res);
        const totalCleaned =
          res.shift_logs_deleted +
          res.shifts_deleted +
          res.roll_call_entries_deleted +
          res.roll_call_sessions_deleted +
          res.duty_attendance_deleted +
          res.duty_roster_deleted +
          res.archive_snapshots_compacted +
          res.audit_logs_deleted +
          (res.storage_pdfs_deleted || 0);

        showToastMessage(
          'success',
          'Database Cleanup Completed',
          `Reclaimed space across ${totalCleaned.toLocaleString()} historical records while keeping all active operations intact.`
        );
      }
      await fetchTelemetry();
    } catch (err: any) {
      showToastMessage(
        'error',
        'Cleanup Error',
        err?.message || 'An error occurred during cleanup execution.'
      );
    } finally {
      setIsExecutingCleanup(false);
    }
  };

  const handleExportEligibleBackup = async () => {
    setIsExportingBackup(true);
    try {
      const logsCutoff = getCutoffDateStr(settings.logs_retention_days);
      const rcCutoff = getCutoffDateStr(settings.rollcall_sessions_retention_days);
      const attCutoff = getCutoffDateStr(settings.attendance_retention_days);
      const rosterCutoff = getCutoffDateStr(settings.roster_retention_days);

      const [logsRes, rcRes, attRes, rosterRes] = await Promise.all([
        supabase
          .from('shift_logs')
          .select('*')
          .lt('log_date', logsCutoff)
          .limit(2000),
        supabase
          .from('roll_call_sessions')
          .select('*, roll_call_entries(*)')
          .neq('status', 'in_progress')
          .lt('session_date', rcCutoff)
          .limit(500),
        supabase
          .from('duty_attendance_records')
          .select('*')
          .neq('status', 'checked_in')
          .lt('duty_date', attCutoff)
          .limit(2000),
        supabase
          .from('duty_roster_assignments')
          .select('*')
          .lt('duty_date', rosterCutoff)
          .limit(2000),
      ]);

      const backupPayload = {
        exportedAt: new Date().toISOString(),
        retentionThresholds: settings,
        shiftLogs: logsRes.data || [],
        rollCallSessions: rcRes.data || [],
        dutyAttendanceRecords: attRes.data || [],
        dutyRosterAssignments: rosterRes.data || [],
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PDRRMO-MLS-RETENTION-BACKUP-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToastMessage(
        'success',
        'Backup Exported',
        'Downloaded JSON snapshot of historical records eligible for cleanup.'
      );
    } catch (err: any) {
      showToastMessage(
        'error',
        'Export Failed',
        err?.message || 'Could not export backup JSON.'
      );
    } finally {
      setIsExportingBackup(false);
    }
  };

  const dbPercent = Math.min(
    100,
    (dbSizeBytes / DB_FREE_TIER_LIMIT_BYTES) * 100
  );
  const storagePercent = Math.min(
    100,
    (storageSizeBytes / STORAGE_FREE_TIER_LIMIT_BYTES) * 100
  );

  return (
    <AppLayoutShell
      title="Database Optimization & Retention"
      subtitle="Supabase Free Tier Quota Telemetry, Scheduled Auto-Cleanup & Module Retention Policy"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <ViewOnlyNotice
          screen="Settings"
          message="Database retention policies and purge actions are restricted to administrators."
        />

        {toast && (
          <div
            className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-md ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : toast.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : toast.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="w-5 h-5 text-[#004AC6] shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-bold">{toast.title}</p>
                <p className="text-xs opacity-90 mt-0.5">{toast.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="w-10 h-10 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#004AC6]/40 flex items-center justify-center text-[#505F76] hover:text-[#004AC6] transition-all shadow-2xs shrink-0"
              title="Back to Settings"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E293B]">
                Database Optimization &amp; Retention
              </h1>
              <p className="text-xs sm:text-sm text-[#505F76] mt-0.5 font-medium">
                Keep daily logs, roll calls, shift attendance, rosters, and PDF archives within Supabase Free Tier limits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <SecondaryButton
              size="md"
              pill
              onClick={() => void fetchTelemetry()}
              disabled={isLoading}
              leftIcon={
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                />
              }
            >
              Refresh Telemetry
            </SecondaryButton>

            <SecondaryButton
              size="md"
              pill
              onClick={() => void handleExportEligibleBackup()}
              disabled={isExportingBackup}
              leftIcon={<Download className="w-4 h-4 text-[#004AC6]" />}
            >
              {isExportingBackup ? 'Exporting...' : 'Export Old Data JSON'}
            </SecondaryButton>

            <Link href="/archives/transfer">
              <SecondaryButton
                size="md"
                pill
                leftIcon={<FolderUp className="w-4 h-4 text-[#004AC6]" />}
              >
                Drive Transfer Hub
              </SecondaryButton>
            </Link>
          </div>
        </div>

        {!rpcInstalled && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">
                Optional SQL Migration Available (`supabase/optimize_db_retention_and_indexes.sql`)
              </p>
              <p>
                Run <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">supabase/optimize_db_retention_and_indexes.sql</code> in the Supabase SQL Editor to enable exact <code className="font-mono">pg_database_size()</code> byte metrics, composite indexes, and automated nightly <code className="font-mono">pg_cron</code> execution. Client-side telemetry and manual cleanup are active right now.
              </p>
            </div>
          </div>
        )}

        {/* 1. SUPABASE FREE TIER CAPACITY GAUGES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Postgres 500 MB Gauge */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/20 flex items-center justify-center shrink-0">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-[#1E293B]">
                      PostgreSQL Database Quota
                    </h2>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        dbPercent >= 85
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : dbPercent >= 65
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {dbPercent.toFixed(1)}% of 500 MB
                    </span>
                  </div>
                  <p className="text-xs text-[#505F76]">
                    Supabase Free Tier relational &amp; JSONB TOAST storage
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold text-[#1E293B]">
                  {formatBytes(dbSizeBytes)}
                </p>
                <p className="text-[11px] text-[#757680] font-semibold">
                  of 500.00 MB limit
                </p>
              </div>
            </div>

            <div className="w-full h-3 rounded-full bg-slate-100 border border-[#E2E8F0] overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  dbPercent >= 85
                    ? 'bg-rose-600'
                    : dbPercent >= 65
                      ? 'bg-amber-500'
                      : 'bg-[#004AC6]'
                }`}
                style={{ width: `${Math.max(2, dbPercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#505F76] pt-1">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Active shifts, in-progress roll calls &amp; future rosters protected
              </span>
              <span className="font-bold text-[#1E293B]">
                {formatBytes(Math.max(0, DB_FREE_TIER_LIMIT_BYTES - dbSizeBytes))}{' '}
                free
              </span>
            </div>
          </div>

          {/* Storage 1 GB Gauge */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-[#1E293B]">
                      Supabase File Storage Quota
                    </h2>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        storagePercent >= 85
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : storagePercent >= 65
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {storagePercent.toFixed(1)}% of 1 GB
                    </span>
                  </div>
                  <p className="text-xs text-[#505F76]">
                    {archiveBucketFiles.toLocaleString()} archived PDFs •{' '}
                    {oldArchiveBucketFiles.toLocaleString()} older than{' '}
                    {settings.storage_pdf_retention_days}d (
                    {formatBytes(oldArchiveBucketBytes)})
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold text-[#1E293B]">
                  {formatBytes(storageSizeBytes)}
                </p>
                <p className="text-[11px] text-[#757680] font-semibold">
                  of 1,024.00 MB limit
                </p>
              </div>
            </div>

            <div className="w-full h-3 rounded-full bg-slate-100 border border-[#E2E8F0] overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  storagePercent >= 85
                    ? 'bg-rose-600'
                    : storagePercent >= 65
                      ? 'bg-amber-500'
                      : 'bg-indigo-600'
                }`}
                style={{ width: `${Math.max(2, storagePercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#505F76] pt-1">
              <span>
                Transfer PDFs to Google Drive before purging bucket files
              </span>
              <span className="font-bold text-[#1E293B]">
                {formatBytes(
                  Math.max(0, STORAGE_FREE_TIER_LIMIT_BYTES - storageSizeBytes)
                )}{' '}
                free
              </span>
            </div>
          </div>
        </div>

        {/* 2. PER-MODULE RETENTION DURATION & SCHEDULE CONFIGURATION */}
        <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#1E293B]">
                  Per-Screen Retention Windows &amp; Auto-Reset Schedule
                </h2>
                <p className="text-xs text-[#505F76]">
                  Configure how long completed operational records stay in live PostgreSQL tables before cleanup.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-[#1E293B] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.auto_cleanup_enabled}
                  disabled={!canManageSettings}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      auto_cleanup_enabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded accent-[#004AC6] cursor-pointer"
                />
                <span>Nightly Auto-Cleanup (3:00 AM PHT)</span>
              </label>

              {canManageSettings && (
                <PrimaryButton
                  size="sm"
                  pill
                  onClick={() => void handleSaveRetentionSettings()}
                  disabled={isSavingSettings}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                >
                  {isSavingSettings ? 'Saving...' : 'Save Policy'}
                </PrimaryButton>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(
              [
                {
                  key: 'logs_retention_days',
                  title: 'Shift Operations Logs (/logs)',
                  subtitle: 'Completed shift_logs & shifts (active shift excluded)',
                  options: [30, 60, 90, 180],
                },
                {
                  key: 'rollcall_entries_retention_days',
                  title: 'Roll Call LGU Entries (/roll-call)',
                  subtitle: '~53 station rows per call (in_progress excluded)',
                  options: [14, 30, 60, 90],
                },
                {
                  key: 'rollcall_sessions_retention_days',
                  title: 'Roll Call Session Headers (/roll-call)',
                  subtitle: 'Session summary counts & weather notes',
                  options: [30, 60, 90, 180],
                },
                {
                  key: 'attendance_retention_days',
                  title: 'Duty Attendance (/shifts)',
                  subtitle: 'Checked-out daily attendance (checked_in excluded)',
                  options: [30, 60, 90, 180],
                },
                {
                  key: 'roster_retention_days',
                  title: 'Past Shift Rosters (/settings/shifts)',
                  subtitle: 'Past duty_date rows only (future months untouched)',
                  options: [30, 60, 90, 180],
                },
                {
                  key: 'snapshot_retention_days',
                  title: 'Archive JSONB Snapshots (/archives)',
                  subtitle: 'Compacts heavy snapshot_data while keeping metadata',
                  options: [30, 60, 90, 180],
                },
              ] as const
            ).map((item) => (
              <div
                key={item.key}
                className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-extrabold text-[#1E293B]">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-[#505F76] mt-0.5">
                    {item.subtitle}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-bold text-[#757680] inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#004AC6]" />
                    Keep Live:
                  </span>
                  <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E2E8F0]">
                    {item.options.map((days) => {
                      const active = settings[item.key] === days;
                      return (
                        <button
                          key={days}
                          type="button"
                          disabled={!canManageSettings}
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              [item.key]: days,
                            }))
                          }
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            active
                              ? 'bg-[#004AC6] text-white shadow-2xs'
                              : 'text-[#505F76] hover:text-[#1E293B]'
                          }`}
                        >
                          {days}d
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Bar: Dry-Run Preview & Execute Cleanup */}
          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-[#1E293B]">
                  Safe On-Demand Retention Cleanup
                </span>
                {settings.last_cleanup_at && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#004AC6] border border-blue-200">
                    Last run:{' '}
                    {new Date(settings.last_cleanup_at).toLocaleString()}
                  </span>
                )}
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-[#505F76] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeStoragePdfPurge}
                  disabled={!canManageSettings}
                  onChange={(e) => setIncludeStoragePdfPurge(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#004AC6] cursor-pointer"
                />
                <span>
                  Also delete Storage bucket PDFs older than{' '}
                  <strong>{settings.storage_pdf_retention_days} days</strong> (
                  {oldArchiveBucketFiles} files /{' '}
                  {formatBytes(oldArchiveBucketBytes)})
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <SecondaryButton
                size="md"
                pill
                onClick={() => void handlePreviewDryRun()}
                disabled={isRunningDryRun || isExecutingCleanup}
                leftIcon={<Eye className="w-4 h-4 text-[#004AC6]" />}
              >
                {isRunningDryRun ? 'Calculating...' : 'Dry-Run Preview'}
              </SecondaryButton>

              {canManageSettings && (
                <PrimaryButton
                  size="md"
                  pill
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isExecutingCleanup}
                  leftIcon={<Play className="w-4 h-4" />}
                >
                  Run Cleanup Now
                </PrimaryButton>
              )}
            </div>
          </div>

          {/* Dry Run / Execution Summary Banner */}
          {dryRunResult && (
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
                  {dryRunResult.dry_run
                    ? 'Dry-Run Impact Preview (No Data Deleted Yet)'
                    : 'Last Cleanup Execution Summary'}
                </span>
                <span className="text-[11px] font-mono text-[#757680]">
                  {new Date(dryRunResult.executed_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-center">
                {[
                  {
                    label: 'Shift Logs',
                    val: dryRunResult.shift_logs_deleted,
                  },
                  {
                    label: 'Closed Shifts',
                    val: dryRunResult.shifts_deleted,
                  },
                  {
                    label: 'RC Entries',
                    val: dryRunResult.roll_call_entries_deleted,
                  },
                  {
                    label: 'RC Sessions',
                    val: dryRunResult.roll_call_sessions_deleted,
                  },
                  {
                    label: 'Attendance',
                    val: dryRunResult.duty_attendance_deleted,
                  },
                  {
                    label: 'Past Rosters',
                    val: dryRunResult.duty_roster_deleted,
                  },
                  {
                    label: 'JSONB Compacted',
                    val: dryRunResult.archive_snapshots_compacted,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-2.5 rounded-xl bg-white border border-[#E2E8F0]"
                  >
                    <p className="text-base font-extrabold text-[#004AC6]">
                      {stat.val.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-[#505F76]">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. TABLE FOOTPRINT BREAKDOWN */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-[#1E293B]">
                Live Table Footprint Breakdown
              </h2>
              <p className="text-xs text-[#505F76]">
                Row counts and relation sizes across daily operational tables
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#505F76] uppercase tracking-wider">
                  <th className="py-3.5 px-6">Module / Table</th>
                  <th className="py-3.5 px-4">Postgres Relation</th>
                  <th className="py-3.5 px-4 text-right">Live Rows</th>
                  <th className="py-3.5 px-4 text-right">Storage Size</th>
                  <th className="py-3.5 px-6 text-right">Oldest Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs">
                {tables.map((t) => (
                  <tr
                    key={t.table_name}
                    className="hover:bg-[#F8FAFC]/80 transition-colors"
                  >
                    <td className="py-3.5 px-6 font-bold text-[#1E293B]">
                      {t.label}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#004AC6]">
                      public.{t.table_name}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-[#1E293B]">
                      {t.row_count.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#505F76]">
                      {formatBytes(t.size_bytes)}
                    </td>
                    <td className="py-3.5 px-6 text-right text-[#757680]">
                      {t.oldest_date || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1E293B]">
                    Confirm Retention Cleanup
                  </h3>
                  <p className="text-xs text-[#505F76]">
                    Active shifts, in-progress roll calls, checked-in officers, and future rosters are never deleted.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#505F76] space-y-1.5">
                <p>
                  • <strong>Shift Logs &amp; Closed Shifts:</strong> older than{' '}
                  {settings.logs_retention_days} days
                </p>
                <p>
                  • <strong>Roll Call Entries / Sessions:</strong> older than{' '}
                  {settings.rollcall_entries_retention_days}d /{' '}
                  {settings.rollcall_sessions_retention_days}d
                </p>
                <p>
                  • <strong>Attendance &amp; Past Rosters:</strong> older than{' '}
                  {settings.attendance_retention_days}d /{' '}
                  {settings.roster_retention_days}d
                </p>
                <p>
                  • <strong>Archive JSONB Compaction:</strong> older than{' '}
                  {settings.snapshot_retention_days} days
                </p>
                {includeStoragePdfPurge && (
                  <p className="text-rose-700 font-bold">
                    • Storage Bucket PDFs older than{' '}
                    {settings.storage_pdf_retention_days} days will also be
                    removed.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <SecondaryButton
                  size="sm"
                  pill
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isExecutingCleanup}
                >
                  Cancel
                </SecondaryButton>
                <PrimaryButton
                  size="sm"
                  pill
                  onClick={() => void handleExecuteCleanup()}
                  disabled={isExecutingCleanup}
                >
                  {isExecutingCleanup ? 'Cleaning Up...' : 'Confirm & Clean Now'}
                </PrimaryButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayoutShell>
  );
}
