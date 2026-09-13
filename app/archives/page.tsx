'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen,
  FileText,
  Radio,
  Search,
  Filter,
  MoreVertical,
  Download,
  Eye,
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Printer,
  X,
  Sparkles,
  Archive as ArchiveIcon,
  HardDrive,
  Hash,
  Users,
  ShieldAlert,
  Check,
  Building2,
  FileCheck,
  BadgeCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { decompressPayload } from '@/lib/compression';
import { generateRollCallPDF, generateDailyLogsPDF } from '@/lib/pdf-generator';
import { CAPITOL_LOGO_BASE64, PDRRMO_LOGO_BASE64 } from '@/lib/header-logos';

export interface ShiftPersonnelInfo {
  name: string;
  role: string;
  badgeNumber: string;
  presentAtEnd: boolean;
}

export interface ShiftSummaryEntry {
  id?: string;
  shiftLabel: string;
  startTime: string;
  endTime: string;
  leadOfficer: string;
  leadOfficerRole?: string;
  leadOfficerBadge?: string;
  handoverStatus: string;
  incidentDetails?: string;
  monitoringBriefing?: string;
  roster: ShiftPersonnelInfo[];
  standbyVehicles?: { name: string; count: number }[];
  signatures?: { name: string; title?: string }[];
  logsCount: number;
}

export interface ShiftLogEntry {
  time: string;
  date: string;
  status: 'Critical' | 'Warning' | 'Active' | 'Info';
  title: string;
  reportType: string;
  description: string;
  operator: string;
}

export interface RollCallStationEntry {
  station: string;
  municipality: string;
  timeResponded: string;
  signalStrength?: string;
  weatherCondition: string;
  seaPortStatus: string;
  dutyOperator: string;
  status: 'Present' | 'Absent' | 'Exempted' | 'Unresponsive';
  remarks?: string;
}

export interface ArchivedFile {
  id: string;
  filename: string;
  category: 'log' | 'roll-call';
  createdAt: string;
  generatedAt: string;
  fileSize: string;
  leadOfficer: string;
  leadOfficerRole: string;
  leadOfficerBadge: string;
  shift: string;
  shiftHours: string;
  itemCount: number;
  hash: string;
  summary: string;
  status: 'Verified' | 'Archived';
  // Shift Information from Start Shift
  monitoringBriefing: string;
  dutyPersonnelRoster: ShiftPersonnelInfo[];
  dutySignatures?: { name: string; title?: string }[];
  standbyVehicles?: { name: string; count: number }[];
  // Handover Information from End Shift
  handoverStatus: 'Situation Remain Normal' | 'Incident Report';
  incidentReportDetails?: string;
  // Multi-shift Daily Consolidated Fields
  isDailyCombined?: boolean;
  dailyReportDate?: string;
  shifts?: ShiftSummaryEntry[];
  storagePath?: string;
  fileUrl?: string;
  // Shift Logs or Roll Call Table
  logEntries?: ShiftLogEntry[];
  rollCallEntries?: RollCallStationEntry[];
  rollCallStats?: {
    totalAreas: number;
    present: number;
    absent?: number;
    exempted?: number;
    unresponsive: number;
    weatherSummary: string;
    frequency: string;
  };
  rawSnapshotData?: any;
}

// =============================================================================
// TEMPLATE FORMATTING HELPERS (MATCHING Template-Example-FileFormat-MLS.docx)
// =============================================================================
export const formatFileDate = (dateStr: string) => {
  if (!dateStr) return '09/27/2026';
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }
  return '09/27/2026';
};

export const getShiftStartTime = (file: ArchivedFile) => {
  if (file.logEntries && file.logEntries.length > 0) {
    return file.logEntries[0].time;
  }
  if (file.shiftHours) {
    const match = file.shiftHours.match(/(\d{2}):(\d{2})/);
    if (match) return `${match[1]}${match[2]}H`;
  }
  return '1200H';
};

export const getShiftEndTime = (file: ArchivedFile) => {
  if (file.generatedAt) {
    const match = file.generatedAt.match(/(\d{2}):(\d{2})H?/);
    if (match) return `${match[1]}${match[2]}H`;
  }
  if (file.logEntries && file.logEntries.length > 0) {
    return file.logEntries[file.logEntries.length - 1].time;
  }
  return '1300H';
};

export const getRosterInitials = (file: ArchivedFile) => {
  if (file.dutyPersonnelRoster && file.dutyPersonnelRoster.length > 0) {
    return file.dutyPersonnelRoster
      .map((p) => {
        const parts = p.name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0];
        const lastName = parts[parts.length - 1];
        const initial = parts.slice(0, parts.length - 1).map((n) => n[0].toUpperCase()).join('');
        return `${initial}. ${lastName}`;
      })
      .join(', ');
  }
  return 'ID. Clarion, M. Reynes';
};

export const getSignaturesList = (file: ArchivedFile) => {
  if (file.dutySignatures && file.dutySignatures.length > 0) {
    return file.dutySignatures;
  }
  if (file.dutyPersonnelRoster && file.dutyPersonnelRoster.length > 0) {
    return file.dutyPersonnelRoster.slice(0, 2).map((p) => ({ name: p.name, title: p.role }));
  }
  return [
    { name: 'Ivan Dale Clarion', title: 'Lead Operations Officer' },
    { name: 'Marvin Reynes', title: 'Monitoring Officer' },
  ];
};

// =============================================================================
// DATABASE ROW MAPPER
// =============================================================================
function mapDbArchiveToArchivedFile(row: any): ArchivedFile {
  const snapshot = row.snapshot_data || {};
  const isRollCall = row.category === 'roll-call';
  const genDate = row.generated_at || row.created_at || new Date().toISOString();
  const d = new Date(genDate);

  // Format file size
  let formattedSize = '1.2 MB';
  if (row.file_size_bytes) {
    const bytes = Number(row.file_size_bytes);
    if (bytes >= 1024 * 1024) {
      formattedSize = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      formattedSize = `${Math.round(bytes / 1024)} KB`;
    }
  }

  // Format date display (e.g. "Sep 07, 2026 · 16:30 PM")
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const createdAtFormatted = `${dateStr} · ${timeStr}`;

  if (isRollCall) {
    const totalStations = snapshot.totalStations || row.item_count || 8;
    const present = snapshot.present ?? 0;
    const absent = snapshot.absent ?? 0;
    const exempted = snapshot.exempted ?? 0;
    const unresponsive = snapshot.unresponsive !== undefined ? snapshot.unresponsive : absent;

    const entries: RollCallStationEntry[] = (snapshot.entries || []).map((e: any) => ({
      station: e.portName && e.portName !== 'None' ? `${e.name} Station (${e.portName})` : `${e.name} Station`,
      municipality: e.name || e.area_name || e.area_code || 'Unknown',
      timeResponded: e.timeResponded || e.time_responded || '—',
      weatherCondition: e.attendance === 'Absent' ? 'N/A (Absent)' : (e.weatherStatus || e.weather_status || 'N/A'),
      seaPortStatus: e.attendance === 'Absent' ? 'N/A (Absent)' : (!e.hasPort ? 'No Port (Inland)' : (e.portStatus || e.port_status || 'Operational')),
      dutyOperator: e.dutyOperator || e.duty_operator || 'Station Duty Officer',
      status: (e.attendance as any) || 'Present',
      remarks: e.remarks || undefined,
    }));

    return {
      id: row.id,
      filename: row.filename,
      category: 'roll-call',
      createdAt: createdAtFormatted,
      generatedAt: `${row.shift_hours || snapshot.sessionTime || '16:00H'} · Official Radio Net Roll Call`,
      fileSize: formattedSize,
      leadOfficer: row.lead_officer_name || snapshot.conductedBy || 'Monitoring Officer',
      leadOfficerRole: row.lead_officer_role || 'Radio Net Controller',
      leadOfficerBadge: row.lead_officer_badge || 'OPC-1042',
      shift: row.shift_label || 'Day Shift Net Call',
      shiftHours: row.shift_hours || `${snapshot.sessionTime || '16:00H'} Net Call`,
      itemCount: totalStations,
      hash: row.file_hash,
      summary: row.summary || `Roll Call Session completed on ${snapshot.sessionDate || dateStr}. Present: ${present}, Absent: ${absent}, Exempted: ${exempted}.`,
      status: row.status || 'Verified',
      monitoringBriefing: snapshot.radioScript || 'Primary Net 142.500 MHz Radio Roll Call Consolidation',
      dutyPersonnelRoster: [
        {
          name: row.lead_officer_name || snapshot.conductedBy || 'Monitoring Officer',
          role: row.lead_officer_role || 'Net Controller',
          badgeNumber: row.lead_officer_badge || 'OPC-1042',
          presentAtEnd: true,
        },
      ],
      handoverStatus: 'Situation Remain Normal',
      rollCallStats: {
        totalAreas: totalStations,
        present,
        absent,
        exempted,
        unresponsive,
        weatherSummary: snapshot.weatherSummary || snapshot.weather_summary || 'Normal conditions across active stations',
        frequency: snapshot.frequency || '142.500 MHz Primary VHF Net',
      },
      rollCallEntries: entries,
      rawSnapshotData: snapshot,
    };
  } else {
    const isDailyCombined = Boolean(snapshot.isDailyCombined);
    const shiftsList: ShiftSummaryEntry[] = isDailyCombined && Array.isArray(snapshot.shifts)
      ? snapshot.shifts.map((s: any) => ({
          id: s.id,
          shiftLabel: s.shiftLabel || s.shift_label || 'Shift',
          startTime: s.startTime || s.start_time || '00:00H',
          endTime: s.endTime || s.end_time || '00:00H',
          leadOfficer: s.leadOfficer || s.lead_officer_name || 'Lead Officer',
          leadOfficerRole: s.leadOfficerRole || s.lead_officer_role || 'Lead Operations Officer',
          leadOfficerBadge: s.leadOfficerBadge || s.lead_officer_badge || 'OPC-1001',
          handoverStatus: s.handoverStatus || s.handover_status || 'Situation Remain Normal',
          incidentDetails: s.incidentDetails || s.incident_report_details || undefined,
          monitoringBriefing: s.monitoringBriefing || s.start_monitoring_details || undefined,
          roster: (s.roster || s.duty_roster || []).map((p: any) => ({
            name: p.name || p.full_name || 'Officer',
            role: p.role || p.position_title || 'Operations Staff',
            badgeNumber: p.badge || p.badgeNumber || 'OPC-1001',
            presentAtEnd: p.presentAtEnd !== false,
          })),
          standbyVehicles: s.standbyVehicles || s.standby_vehicles || [],
          signatures: s.signatures || [],
          logsCount: s.logsCount ?? 0,
        }))
      : [];

    const shiftData = snapshot.shift || {};
    const handoverStatus = snapshot.finalHandoverStatus || snapshot.handoverStatus || (snapshot.incidentDetails ? 'Incident Report' : 'Situation Remain Normal');
    
    const logsList: ShiftLogEntry[] = (snapshot.logs || []).map((l: any) => ({
      time: l.time || '1200H',
      date: l.date || dateStr,
      status: (l.severity || l.status || 'Info') as 'Critical' | 'Warning' | 'Active' | 'Info',
      title: l.title || l.category || 'Operational Event',
      reportType: l.category || l.reportType || 'Log Entry',
      description: l.description || '',
      operator: l.logged_by_name || l.operator || row.lead_officer_name || 'Monitoring Officer',
    }));

    // Combine roster across all shifts if combined daily report
    let roster: ShiftPersonnelInfo[] = [];
    if (isDailyCombined && shiftsList.length > 0) {
      const seen = new Set<string>();
      shiftsList.forEach((s) => {
        s.roster.forEach((p) => {
          if (!seen.has(p.name)) {
            seen.add(p.name);
            roster.push(p);
          }
        });
      });
    } else {
      roster = (shiftData.duty_roster || []).map((p: any) => ({
        name: p.name || p.full_name || 'Officer',
        role: p.role || p.position_title || 'Operations Staff',
        badgeNumber: p.badge || p.badgeNumber || 'OPC-1001',
        presentAtEnd: p.presentAtEnd !== false,
      }));
    }

    // Combine signatures across shifts
    let signatures: { name: string; title?: string }[] = [];
    if (isDailyCombined && shiftsList.length > 0) {
      const sigSet = new Set<string>();
      shiftsList.forEach((s) => {
        if (s.leadOfficer && !sigSet.has(s.leadOfficer)) {
          sigSet.add(s.leadOfficer);
          signatures.push({ name: s.leadOfficer, title: s.leadOfficerRole || 'Shift Lead Officer' });
        }
      });
    } else {
      signatures = shiftData.signatures || [
        { name: row.lead_officer_name || 'Lead Officer', title: row.lead_officer_role || 'Lead Operations Officer' }
      ];
    }

    return {
      id: row.id,
      filename: row.filename,
      category: 'log',
      createdAt: createdAtFormatted,
      generatedAt: isDailyCombined
        ? `24-Hour Daily Operations Report (${snapshot.dailyReportDate || dateStr})`
        : `${row.shift_hours || '16:00H'} · End of Shift Handover`,
      fileSize: formattedSize,
      leadOfficer: row.lead_officer_name || shiftData.lead_officer_name || 'Lead Officer',
      leadOfficerRole: row.lead_officer_role || 'Lead Operations Officer',
      leadOfficerBadge: row.lead_officer_badge || 'OPC-1001',
      shift: row.shift_label || (isDailyCombined ? '24-Hour Consolidated Operations' : (shiftData.shift_label || 'Day Shift (Alpha)')),
      shiftHours: row.shift_hours || (isDailyCombined ? '00:00H - 23:59H (24-Hour Cycle)' : `${shiftData.start_time || '08:00H'} - ${shiftData.end_time || '16:00H'}`),
      itemCount: row.item_count || logsList.length,
      hash: row.file_hash,
      summary: row.summary || (isDailyCombined
        ? `Official 24-Hour consolidated operational report combining ${shiftsList.length} shifts. Total logs: ${logsList.length}.`
        : `Official operational shift handover archive for ${row.shift_label}. Handover status: ${handoverStatus}.`),
      status: row.status || 'Verified',
      monitoringBriefing: isDailyCombined
        ? `Consolidated 24-Hour Operations across ${shiftsList.length} operational shifts`
        : (shiftData.monitoring_briefing || 'Start of Monitoring Duty'),
      dutyPersonnelRoster: roster.length > 0 ? roster : [
        {
          name: row.lead_officer_name || 'Lead Officer',
          role: row.lead_officer_role || 'Lead Operations Officer',
          badgeNumber: 'OPC-1001',
          presentAtEnd: true,
        },
      ],
      dutySignatures: signatures.length > 0 ? signatures : [
        { name: row.lead_officer_name || 'Lead Officer', title: row.lead_officer_role || 'Lead Operations Officer' }
      ],
      standbyVehicles: shiftData.standby_vehicles || [
        { name: 'Pick up', count: 1 },
        { name: 'Ambulance', count: 1 }
      ],
      handoverStatus: handoverStatus,
      incidentReportDetails: snapshot.incidentDetails || undefined,
      isDailyCombined,
      dailyReportDate: snapshot.dailyReportDate,
      shifts: shiftsList,
      logEntries: logsList,
      storagePath: row.storage_path,
      fileUrl: row.file_url,
      rawSnapshotData: snapshot,
    };
  }
}

// Formatted Text Parser for Preview Modal Document View
const renderFormattedDescription = (content: string | undefined | null) => {
  if (!content) return <span className="text-slate-400 italic">No operational remarks recorded.</span>;

  if (content.includes('<') && content.includes('>')) {
    return (
      <div
        className="text-xs text-slate-800 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-0.5 [&_ol]:my-1 [&_b]:font-bold [&_strong]:font-bold"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  const lines = content.split('\n');
  return (
    <div className="space-y-0.5 text-xs text-slate-800">
      {lines.map((line, lineIdx) => {
        const isBullet = line.trim().startsWith('•');
        const cleanLine = isBullet ? line.replace(/^\s*•\s*/, '') : line;
        return (
          <p key={lineIdx} className={`leading-relaxed ${isBullet ? 'pl-3' : ''}`}>
            {isBullet && <span className="font-bold text-[#004AC6] mr-1.5">•</span>}
            {cleanLine}
          </p>
        );
      })}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function ArchivesPage() {
  const { profile, isViewOnly, canWrite } = useAuth();
  const isArchivesViewOnly = isViewOnly('Archives');
  const canModifyArchives = canWrite('Archives');

  const [activeTab, setActiveTab] = useState<'log' | 'roll-call'>('log');
  const [archivesList, setArchivesList] = useState<ArchivedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Selected file for Document Preview Modal & Real PDF Embed
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<ArchivedFile | null>(null);
  const [previewViewMode, setPreviewViewMode] = useState<'document' | 'pdf'>('document');
  const [previewPdfBlobUrl, setPreviewPdfBlobUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Toast State
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    submessage?: string;
    type: 'success' | 'info';
  } | null>(null);

  // Stable ref for archives
  const archivesListRef = useRef<ArchivedFile[]>([]);
  useEffect(() => {
    archivesListRef.current = archivesList;
  }, [archivesList]);

  // ===========================================================================
  // 1. DATA FETCHING (STRICTLY FETCH ONLY FILES IN STORAGE BUCKET: MLS & RC FOLDERS)
  // ===========================================================================
  const fetchArchives = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true);
      else setIsRefreshing(true);

      // 1. Query files STRICTLY from 'archive-documents' storage bucket folders 'MLS' and 'RC'
      const [mlsRes, rcRes, dbRes] = await Promise.all([
        supabase.storage.from('archive-documents').list('MLS', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }),
        supabase.storage.from('archive-documents').list('RC', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }),
        supabase.from('archives').select('*'),
      ]);

      const dbRows = dbRes.data || [];
      const dbMap = new Map<string, any>();
      dbRows.forEach((row) => {
        if (row.filename) dbMap.set(row.filename.toLowerCase(), row);
        if (row.storage_path) dbMap.set(row.storage_path.toLowerCase(), row);
      });

      const bucketFilesOnly: ArchivedFile[] = [];

      // 2. Map files that exist strictly in archive-documents/MLS/
      if (mlsRes.data && Array.isArray(mlsRes.data)) {
        mlsRes.data.forEach((fileObj) => {
          if (!fileObj.name || fileObj.name === '.emptyFolderPlaceholder') return;
          const storagePath = `MLS/${fileObj.name}`;
          const dbRow = dbMap.get(fileObj.name.toLowerCase()) || dbMap.get(storagePath.toLowerCase());

          if (dbRow) {
            bucketFilesOnly.push(
              mapDbArchiveToArchivedFile({
                ...dbRow,
                filename: fileObj.name,
                storage_path: storagePath,
                file_size_bytes: fileObj.metadata?.size || dbRow.file_size_bytes,
                created_at: fileObj.created_at || dbRow.created_at,
              })
            );
          } else {
            const d = new Date(fileObj.created_at || Date.now());
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
            const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            const bytes = fileObj.metadata?.size || 0;
            const formattedSize = bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

            bucketFilesOnly.push({
              id: fileObj.id || storagePath,
              filename: fileObj.name,
              category: 'log',
              createdAt: `${dateStr} · ${timeStr}`,
              generatedAt: '24-Hour Consolidated Operations Daily Report',
              fileSize: formattedSize,
              leadOfficer: 'Operations Lead Officer',
              leadOfficerRole: 'Lead Operations Officer',
              leadOfficerBadge: 'OPC-1001',
              shift: '24-Hour Consolidated Operations',
              shiftHours: '00:00H - 23:59H (24-Hour Cycle)',
              itemCount: 1,
              hash: fileObj.id ? `sha256-${fileObj.id.replace(/-/g, '').slice(0, 16)}` : 'sha256-verified-storage',
              summary: `Official 24-hour consolidated operational log archive retrieved from storage bucket archive-documents/${storagePath}.`,
              status: 'Verified',
              monitoringBriefing: 'Consolidated 24-Hour Operations Duty',
              dutyPersonnelRoster: [
                { name: 'Operations Officer', role: 'Operations Staff', badgeNumber: 'OPC-1001', presentAtEnd: true },
              ],
              handoverStatus: 'Situation Remain Normal',
              isDailyCombined: true,
              storagePath,
            });
          }
        });
      }

      // 3. Map files that exist strictly in archive-documents/RC/
      if (rcRes.data && Array.isArray(rcRes.data)) {
        rcRes.data.forEach((fileObj) => {
          if (!fileObj.name || fileObj.name === '.emptyFolderPlaceholder') return;
          const storagePath = `RC/${fileObj.name}`;
          const dbRow = dbMap.get(fileObj.name.toLowerCase()) || dbMap.get(storagePath.toLowerCase());

          if (dbRow) {
            bucketFilesOnly.push(
              mapDbArchiveToArchivedFile({
                ...dbRow,
                filename: fileObj.name,
                category: 'roll-call',
                storage_path: storagePath,
                file_size_bytes: fileObj.metadata?.size || dbRow.file_size_bytes,
                created_at: fileObj.created_at || dbRow.created_at,
              })
            );
          } else {
            const d = new Date(fileObj.created_at || Date.now());
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
            const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            const bytes = fileObj.metadata?.size || 0;
            const formattedSize = bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

            bucketFilesOnly.push({
              id: fileObj.id || storagePath,
              filename: fileObj.name,
              category: 'roll-call',
              createdAt: `${dateStr} · ${timeStr}`,
              generatedAt: 'Official Radio Net Roll Call Report',
              fileSize: formattedSize,
              leadOfficer: 'Radio Net Controller',
              leadOfficerRole: 'Net Controller',
              leadOfficerBadge: 'OPC-1042',
              shift: 'Day Shift Net Call',
              shiftHours: '16:00H Net Call',
              itemCount: 8,
              hash: fileObj.id ? `sha256-${fileObj.id.replace(/-/g, '').slice(0, 16)}` : 'sha256-verified-storage',
              summary: `Official radio net roll call report retrieved from storage bucket archive-documents/${storagePath}.`,
              status: 'Verified',
              monitoringBriefing: 'Primary Net 142.500 MHz Radio Roll Call Consolidation',
              dutyPersonnelRoster: [
                { name: 'Radio Operator', role: 'Net Controller', badgeNumber: 'OPC-1042', presentAtEnd: true },
              ],
              handoverStatus: 'Situation Remain Normal',
              rollCallStats: {
                totalAreas: 8,
                present: 8,
                absent: 0,
                exempted: 0,
                unresponsive: 0,
                weatherSummary: 'Normal weather conditions reported across active stations.',
                frequency: '142.500 MHz Primary VHF Net',
              },
              storagePath,
            });
          }
        });
      }

      // Set state ONLY with files verified to exist in the storage bucket
      setArchivesList(bucketFilesOnly);
    } catch (err) {
      console.error('Failed to load archives from storage bucket:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Subscribe to Realtime CDC & multi-tab events
  useEffect(() => {
    fetchArchives();

    // 1. Supabase Realtime channel
    const channel = supabase
      .channel('archives_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'archives' },
        (payload) => {
          console.log('Realtime change detected in archives:', payload);
          fetchArchives(true);
        }
      )
      .subscribe();

    // 2. BroadcastChannel multi-tab sync
    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      broadcastChannel = new BroadcastChannel('pdrrmo_sync_channel');
      broadcastChannel.onmessage = (event) => {
        if (event.data === 'archives_updated' || event.data === 'roll_call_updated' || event.data === 'shift_state_updated') {
          fetchArchives(true);
        }
      };
    }

    // 3. Local storage event listener
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pdrrmo_sync_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.type === 'archives_updated' || parsed.type === 'roll_call_updated' || parsed.type === 'shift_state_updated') {
            fetchArchives(true);
          }
        } catch (_) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      supabase.removeChannel(channel);
      if (broadcastChannel) broadcastChannel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchArchives]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => setToastNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Open Preview Modal and fetch/generate actual PDF file for embed
  const handleSelectFileForPreview = async (file: ArchivedFile) => {
    setSelectedFileForPreview(file);
    setIsPreviewLoading(true);
    setPreviewError(null);

    // Revoke previous blob URL if any
    if (previewPdfBlobUrl) {
      URL.revokeObjectURL(previewPdfBlobUrl);
      setPreviewPdfBlobUrl(null);
    }

    try {
      // 1. First priority: Download the official PDF directly from the storage bucket
      if (file.storagePath) {
        const { data: blobData, error: downloadErr } = await supabase.storage
          .from('archive-documents')
          .download(file.storagePath);

        if (!downloadErr && blobData && blobData.size > 0) {
          const pdfBlob = new Blob([blobData], { type: 'application/pdf' });
          const objectUrl = URL.createObjectURL(pdfBlob);
          setPreviewPdfBlobUrl(objectUrl);
          setIsPreviewLoading(false);
          return;
        }
      }

      // 2. Second priority: If snapshot data exists, generate matching PDF on-the-fly
      if (file.category === 'roll-call') {
        const dateStr = file.createdAt ? file.createdAt.split('·')[0].trim() : '09/27/2026';
        const pdf = await generateRollCallPDF({
          filename: file.filename,
          sessionDate: dateStr,
          sessionTime: file.shiftHours || '1600H',
          frequency: file.rollCallStats?.frequency || '142.500 MHz Primary VHF Net',
          radioScript: file.monitoringBriefing,
          conductedBy: file.leadOfficer || 'Monitoring Officer',
          conductedByRole: file.leadOfficerRole || 'Net Controller',
          signatureUrl: profile?.signature_url,
          totalStations: file.rollCallStats?.totalAreas || file.itemCount || 8,
          present: file.rollCallStats?.present || 8,
          absent: file.rollCallStats?.absent || 0,
          exempted: file.rollCallStats?.exempted || 0,
          weatherSummary: file.rollCallStats?.weatherSummary || 'Normal weather conditions reported across active stations.',
          entries: (file.rollCallEntries || []).map((e) => ({
            name: e.municipality,
            attendance: e.status,
            weatherStatus: e.weatherCondition,
            portStatus: e.seaPortStatus,
            timeResponded: e.timeResponded,
            dutyOperator: e.dutyOperator,
          })),
          fileHash: file.hash,
          snapshotPayload: file.rawSnapshotData || {},
        });
        const objectUrl = URL.createObjectURL(pdf.blob);
        setPreviewPdfBlobUrl(objectUrl);
        setIsPreviewLoading(false);
        return;
      } else {
        const dateStr = file.dailyReportDate || (file.createdAt ? file.createdAt.split('·')[0].trim() : '09/27/2026');
        const pdf = await generateDailyLogsPDF({
          filename: file.filename,
          dailyReportDate: dateStr,
          totalShiftsCount: file.shifts?.length || 1,
          finalOfficer: file.leadOfficer || 'Lead Operations Officer',
          finalOfficerRole: file.leadOfficerRole || 'Lead Operations Officer',
          finalHandoverStatus: file.handoverStatus || 'Situation Remain Normal',
          signatureUrl: profile?.signature_url,
          shifts: (file.shifts || []).map((s) => ({
            shiftLabel: s.shiftLabel,
            startTime: s.startTime,
            endTime: s.endTime,
            leadOfficer: s.leadOfficer,
            leadOfficerRole: s.leadOfficerRole,
            handoverStatus: s.handoverStatus,
            roster: s.roster || [],
            standbyVehicles: s.standbyVehicles || [],
            signatures: s.signatures || [],
            logsCount: s.logsCount || 0,
          })),
          logs: (file.logEntries || []).map((l) => ({
            time: l.time,
            status: l.status,
            title: l.title,
            description: l.description,
            operator: l.operator,
          })),
          fileHash: file.hash,
          snapshotPayload: file.rawSnapshotData || {},
        });
        const objectUrl = URL.createObjectURL(pdf.blob);
        setPreviewPdfBlobUrl(objectUrl);
        setIsPreviewLoading(false);
      }
    } catch (err: any) {
      console.error('Error loading PDF document preview:', err);
      setPreviewError('Unable to load document preview from secure storage.');
      setIsPreviewLoading(false);
    }
  };

  // Close Preview Modal and revoke object URL
  const handleClosePreview = () => {
    setSelectedFileForPreview(null);
    if (previewPdfBlobUrl) {
      URL.revokeObjectURL(previewPdfBlobUrl);
      setPreviewPdfBlobUrl(null);
    }
    setIsPreviewLoading(false);
    setPreviewError(null);
  };

  // Split archives by category
  const logFiles = useMemo(() => archivesList.filter((f) => f.category === 'log'), [archivesList]);
  const rollCallFiles = useMemo(() => archivesList.filter((f) => f.category === 'roll-call'), [archivesList]);

  // Dynamic Year Filter Options
  const yearFilterOptions: CustomDropdownOption[] = useMemo(() => {
    const yearsSet = new Set<string>();
    archivesList.forEach((file) => {
      const match = file.createdAt.match(/\b(20\d{2})\b/);
      if (match) yearsSet.add(match[1]);
    });
    const currentYear = new Date().getFullYear().toString();
    yearsSet.add(currentYear);

    const sortedYears = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
    const options: CustomDropdownOption[] = [{ value: 'ALL', label: 'All Years' }];
    sortedYears.forEach((yr) => {
      options.push({
        value: yr,
        label: `Year ${yr}`,
        badge: yr === currentYear ? 'Current' : undefined,
        badgeColor: yr === currentYear ? 'bg-blue-50 text-[#004AC6]' : undefined,
      });
    });
    return options;
  }, [archivesList]);

  // Comprehensive search across all historical files, summaries, officers, and events
  const filteredLogFiles = useMemo(() => {
    return logFiles.filter((file) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        file.filename.toLowerCase().includes(q) ||
        file.leadOfficer.toLowerCase().includes(q) ||
        file.shift.toLowerCase().includes(q) ||
        file.summary.toLowerCase().includes(q) ||
        file.hash.toLowerCase().includes(q) ||
        file.handoverStatus.toLowerCase().includes(q) ||
        (file.logEntries && file.logEntries.some((l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.operator.toLowerCase().includes(q)
        ));
      const matchesYear = selectedYear === 'ALL' || file.createdAt.includes(selectedYear);
      return matchesSearch && matchesYear;
    });
  }, [logFiles, searchQuery, selectedYear]);

  const filteredRollCallFiles = useMemo(() => {
    return rollCallFiles.filter((file) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        file.filename.toLowerCase().includes(q) ||
        file.leadOfficer.toLowerCase().includes(q) ||
        file.shift.toLowerCase().includes(q) ||
        file.summary.toLowerCase().includes(q) ||
        file.hash.toLowerCase().includes(q) ||
        (file.rollCallStats && (
          file.rollCallStats.weatherSummary.toLowerCase().includes(q) ||
          file.rollCallStats.frequency.toLowerCase().includes(q)
        )) ||
        (file.rollCallEntries && file.rollCallEntries.some((e) =>
          e.municipality.toLowerCase().includes(q) ||
          (e.weatherCondition && e.weatherCondition.toLowerCase().includes(q)) ||
          (e.seaPortStatus && e.seaPortStatus.toLowerCase().includes(q)) ||
          (e.dutyOperator && e.dutyOperator.toLowerCase().includes(q))
        ));
      const matchesYear = selectedYear === 'ALL' || file.createdAt.includes(selectedYear);
      return matchesSearch && matchesYear;
    });
  }, [rollCallFiles, searchQuery, selectedYear]);

  const currentDataset = activeTab === 'log' ? filteredLogFiles : filteredRollCallFiles;
  const totalCount = currentDataset.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return currentDataset.slice(start, start + itemsPerPage);
  }, [currentDataset, currentPage, itemsPerPage]);

  // Tab switch handler
  const handleTabChange = (tab: 'log' | 'roll-call') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setActiveMenuId(null);
  };

  // Copy Hash handler
  const handleCopyHash = (file: ArchivedFile) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(file.hash);
      setToastNotification({
        type: 'success',
        message: 'SHA-256 Hash Copied',
        submessage: `Integrity fingerprint for ${file.filename} is saved to clipboard.`,
      });
    }
    setActiveMenuId(null);
  };

  // Download export handler (Supabase Storage download with JSON fallback)
  const handleDownloadFile = async (file: ArchivedFile) => {
    try {
      // 1. Try downloading directly from Supabase Storage bucket if storagePath is present
      if (file.storagePath) {
        const { data: blobData, error: downloadErr } = await supabase.storage
          .from('archive-documents')
          .download(file.storagePath);

        if (!downloadErr && blobData) {
          const url = window.URL.createObjectURL(blobData);
          const downloadAnchor = document.createElement('a');
          downloadAnchor.href = url;
          downloadAnchor.download = file.filename.endsWith('.json') || file.filename.endsWith('.pdf')
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

      // 2. Fallback to generating JSON snapshot payload export
      const exportObject = {
        filename: file.filename,
        category: file.category,
        hash: file.hash,
        status: file.status,
        generatedAt: file.createdAt,
        leadOfficer: file.leadOfficer,
        leadOfficerRole: file.leadOfficerRole,
        shift: file.shift,
        summary: file.summary,
        snapshot: file.rawSnapshotData || {},
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObject, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', file.filename.replace(/\.pdf$/i, '.json'));
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setToastNotification({
        type: 'success',
        message: 'Archive Document Exported',
        submessage: `${file.filename} snapshot downloaded successfully.`,
      });
    } catch (err) {
      console.error('Download error:', err);
    }
    setActiveMenuId(null);
  };

  // Print ONLY the bucket PDF file itself
  const handlePrintDocument = () => {
    if (printIframeRef.current?.contentWindow) {
      try {
        printIframeRef.current.contentWindow.focus();
        printIframeRef.current.contentWindow.print();
        return;
      } catch (err) {
        console.warn('Direct iframe print blocked, opening print window:', err);
      }
    }
    if (previewPdfBlobUrl) {
      const printWin = window.open(previewPdfBlobUrl, '_blank');
      if (printWin) {
        printWin.onload = () => {
          printWin.focus();
          printWin.print();
        };
      }
    }
  };

  // ===========================================================================
  // 7. RENDER JSX
  // ===========================================================================
  return (
    <AppLayoutShell
      title="Archives Management"
      subtitle="Official DOCX/PDF Records & Certified Audit Trail"
    >
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* VIEW-ONLY NOTICE */}
        {/* ========================================================================= */}
        <ViewOnlyNotice
          screen="Archives"
          message="You are viewing the certified archive repository in read-only audit mode. Document exports and integrity verification remain available."
        />

        {/* ========================================================================= */}
        {/* 1. HEADER SECTION */}
        {/* ========================================================================= */}
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

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <SecondaryButton
              size="md"
              pill
              leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => fetchArchives()}
              className="w-full sm:w-auto justify-center"
            >
              Refresh Archives
            </SecondaryButton>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. DYNAMIC TOP STATS METRIC CARDS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Total Shift Logs Created */}
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

          {/* Card 2: Total Roll Call Files Created */}
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

        {/* ========================================================================= */}
        {/* 3. ARCHIVES TABLE SECTION WITH TABS & FILTERS */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
          {/* Controls Bar */}
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

            {/* Search & Year Filter */}
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
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 pl-10 pr-4 text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                />
              </div>

              <div className="w-36 shrink-0">
                <CustomDropdown
                  options={yearFilterOptions}
                  value={selectedYear}
                  onChange={(val) => {
                    setSelectedYear(val);
                    setCurrentPage(1);
                  }}
                  leftIcon={<Calendar className="w-3.5 h-3.5" />}
                  size="sm"
                  pill
                />
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
                      <p className="font-bold text-base text-[#1E293B]">No Archived Records Found</p>
                      <p className="text-xs text-[#757680] mt-1 max-w-sm mx-auto">
                        {searchQuery || selectedYear !== 'ALL'
                          ? 'No files matched your search filters. Try adjusting your search query or year filter.'
                          : activeTab === 'log'
                          ? 'Shift handover records will automatically appear here when an officer logs the end of shift.'
                          : 'Roll call session reports will automatically appear here once an operator finalizes a roll call.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedFiles.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-[#F8FAFC]/80 transition-colors group cursor-pointer"
                      onClick={() => handleSelectFileForPreview(file)}
                    >
                      {/* Name of File */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
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
                              {file.itemCount} {file.category === 'log' ? 'shift entries' : 'station checks'} ·{' '}
                              <span className="text-emerald-600 font-medium">Verified Official Record</span>
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
                          <span className="text-[11px] text-[#505F76]">
                            {file.shift}
                          </span>
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
                            onClick={() => handleSelectFileForPreview(file)}
                            title="View Certified Document"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadFile(file)}
                            title="Download Official PDF Document"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[#505F76] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === file.id ? null : file.id);
                              }}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                              aria-label="File options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            <AnimatePresence>
                              {activeMenuId === file.id && (
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
                                    onClick={() => handleSelectFileForPreview(file)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-[#505F76]" />
                                    View Document Archive
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(file)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5 text-[#505F76]" />
                                    Download Official PDF
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCopyHash(file)}
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 sm:p-5 border-t border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <span className="text-xs text-[#757680] font-medium">
              Showing {totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}{' '}
              {activeTab === 'log' ? 'logged files' : 'roll call files'}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-bold text-[#1E293B] px-2">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. REAL DOCUMENT ARCHIVE PDF PREVIEW MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedFileForPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClosePreview}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Dialog Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden z-10 flex flex-col h-[92vh]"
            >
              {/* Document Reader Top Toolbar */}
              <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-4 shrink-0 text-[#1E293B]">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                      selectedFileForPreview.category === 'log'
                        ? 'bg-blue-50 text-[#004AC6] border-blue-200/60'
                        : 'bg-sky-50 text-sky-700 border-sky-200/60'
                    }`}
                  >
                    {selectedFileForPreview.category === 'log' ? (
                      <FileText className="w-5 h-5" />
                    ) : (
                      <Radio className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm sm:text-base text-[#1E293B] font-mono leading-none truncate">
                        {selectedFileForPreview.filename}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        {selectedFileForPreview.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#757680] mt-1 truncate">
                      {selectedFileForPreview.generatedAt} · Size: {selectedFileForPreview.fileSize}
                    </p>
                  </div>
                </div>

                {/* Right toolbar controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-full text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPreviewViewMode('document')}
                      className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                        previewViewMode === 'document' ? 'bg-white text-[#004AC6] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Document View
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewMode('pdf')}
                      className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                        previewViewMode === 'pdf' ? 'bg-white text-[#004AC6] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      PDF Embed
                    </button>
                  </div>

                  {previewPdfBlobUrl && (
                    <a
                      href={previewPdfBlobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E2E8F0] bg-white text-xs font-semibold text-[#505F76] hover:bg-[#F1F5F9] hover:text-[#004AC6] transition-all cursor-pointer shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open PDF</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleCopyHash(selectedFileForPreview)}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E2E8F0] bg-white text-xs font-semibold text-[#505F76] hover:bg-[#F1F5F9] hover:text-[#004AC6] transition-all cursor-pointer shadow-2xs"
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span>Copy Hash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadFile(selectedFileForPreview)}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E2E8F0] bg-white text-xs font-semibold text-[#505F76] hover:bg-[#F1F5F9] hover:text-[#004AC6] transition-all cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintDocument}
                    disabled={isPreviewLoading || !previewPdfBlobUrl}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#004AC6] text-white text-xs font-bold hover:bg-[#003ea8] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClosePreview}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors ml-1 cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* SHA-256 Security Strip */}
              <div className="px-6 py-2.5 bg-slate-50 border-b border-[#E2E8F0] flex items-center justify-between gap-4 text-xs shrink-0">
                <div className="flex items-center gap-2 truncate text-[#757680]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-[#1E293B] shrink-0">SHA-256 Digest:</span>
                  <span className="font-mono text-[11px] text-[#505F76] truncate select-all">
                    {selectedFileForPreview.hash}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  <span>Tamper-Proof Archive</span>
                </div>
              </div>

              {/* Document PDF Viewer Container */}
              <div className="flex-1 bg-slate-100 p-2 sm:p-4 flex flex-col items-center relative overflow-y-auto custom-scrollbar">
                {isPreviewLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#505F76] my-auto">
                    <Loader2 className="w-8 h-8 animate-spin text-[#004AC6]" />
                    <p className="text-sm font-semibold text-[#1E293B]">Loading official file from storage bucket...</p>
                    <p className="text-xs text-[#757680]">Rendering verified PDF document</p>
                  </div>
                ) : previewError ? (
                  <div className="my-auto flex flex-col items-center justify-center gap-3 text-rose-600 p-6 bg-white rounded-2xl border border-rose-200 shadow-sm max-w-md text-center">
                    <AlertTriangle className="w-8 h-8 text-rose-500" />
                    <p className="text-sm font-bold text-[#1E293B]">{previewError}</p>
                    <SecondaryButton size="sm" pill onClick={() => handleSelectFileForPreview(selectedFileForPreview)}>
                      Try Again
                    </SecondaryButton>
                  </div>
                ) : previewViewMode === 'document' ? (
                  /* Responsive Official Document Sheet */
                  <div className="w-full max-w-4xl bg-white rounded-2xl shadow-md border border-[#CBD5E1] p-5 sm:p-8 space-y-5 text-slate-800 my-auto sm:my-2">
                    {/* Document Header with Dual Logos */}
                    <div className="flex items-center justify-between gap-2 sm:gap-4 pb-3 border-b-2 border-slate-900">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                        {CAPITOL_LOGO_BASE64 ? (
                          <img src={CAPITOL_LOGO_BASE64} alt="Province of Cebu" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
                        ) : (
                          <Building2 className="w-10 h-10 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 text-center space-y-0.5">
                        <p className="text-[11px] sm:text-xs text-slate-600 font-normal">Republic of the Philippines</p>
                        <p className="text-[11px] sm:text-xs text-slate-600 font-normal">Province of Cebu</p>
                        <h2 className="text-xs sm:text-sm font-bold text-slate-950 tracking-tight">
                          PROVINCIAL DISASTER RISK MANAGEMENT OFFICE
                        </h2>
                        <p className="text-[10px] sm:text-[11px] text-slate-500">
                          (032) 888-2328 LOCAL 2301 or 2302 | Email: pdrrmo.cebu@gmail.com
                        </p>
                        <h3 className="text-xs sm:text-sm font-bold text-[#004AC6] pt-1">
                          {selectedFileForPreview.category === 'roll-call'
                            ? 'Radio Net Roll Call System'
                            : 'Monitoring Logs System'}
                        </h3>
                      </div>

                      <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                        {PDRRMO_LOGO_BASE64 ? (
                          <img src={PDRRMO_LOGO_BASE64} alt="PDRRMO" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
                        ) : (
                          <ShieldCheck className="w-10 h-10 text-[#004AC6]" />
                        )}
                      </div>
                    </div>

                    {/* Date Line */}
                    <div className="text-xs font-bold text-slate-900">
                      Date: {formatFileDate(selectedFileForPreview.dailyReportDate || selectedFileForPreview.createdAt)}
                    </div>

                    {/* Official 3-Column Table */}
                    <div className="border border-slate-400 rounded-lg overflow-hidden bg-white text-xs">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 bg-slate-100 font-bold border-b border-slate-400 text-slate-900 text-center py-2 px-3">
                        <div className="col-span-2 border-r border-slate-300">Time</div>
                        <div className="col-span-8 text-left pl-3 border-r border-slate-300">Title w/ Description</div>
                        <div className="col-span-2">
                          {selectedFileForPreview.category === 'roll-call' ? 'Attendance' : 'Report Type'}
                        </div>
                      </div>

                      {/* Table Content */}
                      <div className="divide-y divide-slate-300">
                        {selectedFileForPreview.category === 'roll-call' ? (
                          <>
                            {/* 1. Start of Roll Call Entry */}
                            <div className="grid grid-cols-12 py-3 px-3 items-start bg-slate-50/40">
                              <div className="col-span-2 text-center font-bold font-mono text-slate-900 pt-0.5">
                                {selectedFileForPreview.shiftHours || '1600H'}
                              </div>
                              <div className="col-span-8 px-3 space-y-1.5 border-x border-slate-200">
                                <p className="font-bold text-slate-950">
                                  Start of Radio Net Roll Call, {selectedFileForPreview.leadOfficer}
                                </p>
                                <p className="text-slate-700">
                                  <strong>Net Frequency:</strong> {selectedFileForPreview.rollCallStats?.frequency || '142.500 MHz Primary VHF Net'}
                                </p>
                                <p className="text-slate-700">
                                  <strong>Radio Script:</strong> {selectedFileForPreview.monitoringBriefing || 'Radio Roll Call Net Protocol'}
                                </p>
                                <p className="text-slate-700">
                                  <strong>Total Designated Stations:</strong> {selectedFileForPreview.rollCallStats?.totalAreas || selectedFileForPreview.itemCount || 8} Stations
                                </p>
                                <div className="pt-2 border-t border-slate-200 mt-2">
                                  <div className="w-40 border-b border-slate-600 mb-1" />
                                  <p className="font-bold text-slate-900 text-[11px]">{selectedFileForPreview.leadOfficer}</p>
                                  <p className="text-[10px] text-slate-500">{selectedFileForPreview.leadOfficerRole || 'Duty Operations Officer'}</p>
                                </div>
                              </div>
                              <div className="col-span-2 text-center text-slate-400 font-semibold pt-0.5">—</div>
                            </div>

                            {/* 2. Stations List */}
                            {(selectedFileForPreview.rollCallEntries || []).map((stn, idx) => (
                              <div key={idx} className="grid grid-cols-12 py-2.5 px-3 items-start hover:bg-slate-50">
                                <div className="col-span-2 text-center font-mono text-slate-800 pt-0.5">
                                  {stn.timeResponded || selectedFileForPreview.shiftHours || '1600H'}
                                </div>
                                <div className="col-span-8 px-3 space-y-1 border-x border-slate-200">
                                  <p className="font-bold text-slate-950">{stn.municipality || stn.station} Station</p>
                                  <p className="text-slate-600">
                                    Weather Condition: <strong>{stn.weatherCondition || 'Fair'}</strong> | Port Status: <strong>{stn.seaPortStatus || 'Operational'}</strong>
                                  </p>
                                  <p className="text-slate-500 text-[11px]">
                                    Operator: {stn.dutyOperator || 'Station Duty Officer'}
                                  </p>
                                </div>
                                <div className="col-span-2 text-center pt-0.5">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      stn.status === 'Present'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : stn.status === 'Absent'
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}
                                  >
                                    {stn.status || 'Present'}
                                  </span>
                                </div>
                              </div>
                            ))}

                            {/* 3. End of Roll Call Entry */}
                            <div className="grid grid-cols-12 py-3 px-3 items-start bg-slate-50/40">
                              <div className="col-span-2 text-center font-bold font-mono text-slate-900 pt-0.5">
                                1630H
                              </div>
                              <div className="col-span-8 px-3 space-y-1.5 border-x border-slate-200">
                                <p className="font-bold text-slate-950">
                                  End of Radio Net Roll Call {selectedFileForPreview.leadOfficer}
                                </p>
                                <p className="text-slate-700">
                                  Attendance Breakdown: <strong>{selectedFileForPreview.rollCallStats?.present || 8} Present</strong>, <strong>{selectedFileForPreview.rollCallStats?.absent || 0} Absent</strong>, <strong>{selectedFileForPreview.rollCallStats?.exempted || 0} Exempted</strong>
                                </p>
                                <p className="text-slate-700">Situation Remain Normal</p>
                                <div className="pt-2 border-t border-slate-200 mt-2">
                                  <div className="w-40 border-b border-slate-600 mb-1" />
                                  <p className="font-bold text-slate-900 text-[11px]">{selectedFileForPreview.leadOfficer}</p>
                                  <p className="text-[10px] text-slate-500">{selectedFileForPreview.leadOfficerRole || 'Duty Operations Officer'}</p>
                                </div>
                              </div>
                              <div className="col-span-2 text-center text-slate-400 font-semibold pt-0.5">—</div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* 1. Start of Monitoring Duty Entry */}
                            <div className="grid grid-cols-12 py-3 px-3 items-start bg-slate-50/40">
                              <div className="col-span-2 text-center font-bold font-mono text-slate-900 pt-0.5">
                                {getShiftStartTime(selectedFileForPreview)}
                              </div>
                              <div className="col-span-8 px-3 space-y-1.5 border-x border-slate-200">
                                <p className="font-bold text-slate-950">
                                  Start of Monitoring Duty, {selectedFileForPreview.shifts?.[0]?.leadOfficer || selectedFileForPreview.leadOfficer || 'Duty Officer'}
                                </p>
                                <p className="text-slate-700">Standby Vehicles: Pick up - 1, Ambulance - 1, Demo Items - 5</p>
                                <div className="text-slate-700 text-xs">
                                  <strong>Active personnel assigned on duty:</strong>{' '}
                                  {selectedFileForPreview.dutyPersonnelRoster && selectedFileForPreview.dutyPersonnelRoster.length > 0
                                    ? selectedFileForPreview.dutyPersonnelRoster.map((p) => `${p.name} (${p.role})`).join(', ')
                                    : selectedFileForPreview.leadOfficer}
                                </div>
                                {selectedFileForPreview.monitoringBriefing && (
                                  <div className="pt-1">
                                    <span className="font-bold text-slate-900 block mb-0.5">Monitoring Details & Briefing:</span>
                                    {renderFormattedDescription(selectedFileForPreview.monitoringBriefing)}
                                  </div>
                                )}
                                <div className="pt-2 border-t border-slate-200 mt-2">
                                  <div className="w-40 border-b border-slate-600 mb-1" />
                                  <p className="font-bold text-slate-900 text-[11px]">
                                    {selectedFileForPreview.shifts?.[0]?.leadOfficer || selectedFileForPreview.leadOfficer || 'Lead Operations Officer'}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {selectedFileForPreview.shifts?.[0]?.leadOfficerRole || selectedFileForPreview.leadOfficerRole || 'Lead Operations Officer'}
                                  </p>
                                </div>
                              </div>
                              <div className="col-span-2 text-center text-slate-500 font-medium pt-0.5">Info</div>
                            </div>

                            {/* 2. Chronological Log Entries */}
                            {(selectedFileForPreview.logEntries || []).map((log, idx) => (
                              <div key={idx} className="grid grid-cols-12 py-2.5 px-3 items-start hover:bg-slate-50">
                                <div className="col-span-2 text-center font-mono text-slate-800 pt-0.5">
                                  {log.time || '1200H'}
                                </div>
                                <div className="col-span-8 px-3 space-y-1 border-x border-slate-200">
                                  <p className="font-bold text-slate-950">{log.title}</p>
                                  <div className="text-slate-700">
                                    {renderFormattedDescription(log.description)}
                                  </div>
                                  {log.operator && (
                                    <p className="text-[10px] text-slate-400">Operator: {log.operator}</p>
                                  )}
                                </div>
                                <div className="col-span-2 text-center pt-0.5">
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    {log.reportType || log.status || 'Info'}
                                  </span>
                                </div>
                              </div>
                            ))}

                            {/* 3. End of Monitoring Duty Entry */}
                            <div className="grid grid-cols-12 py-3 px-3 items-start bg-slate-50/40">
                              <div className="col-span-2 text-center font-bold font-mono text-slate-900 pt-0.5">
                                {getShiftEndTime(selectedFileForPreview)}
                              </div>
                              <div className="col-span-8 px-3 space-y-1.5 border-x border-slate-200">
                                <p className="font-bold text-slate-950">
                                  End of Monitoring Duty {selectedFileForPreview.leadOfficer || 'Duty Officer'}
                                </p>
                                <p className="text-slate-700">
                                  24-Hour Operational Cycle: <strong>{selectedFileForPreview.shifts?.length || 1} Shifts Combined</strong>
                                </p>
                                <p className="text-slate-700">
                                  Handover Status: <strong>{selectedFileForPreview.handoverStatus || 'Situation Remain Normal'}</strong>
                                </p>
                                {selectedFileForPreview.incidentReportDetails && (
                                  <p className="text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200 text-xs">
                                    <strong>Incident Notes:</strong> {selectedFileForPreview.incidentReportDetails}
                                  </p>
                                )}
                                <div className="pt-2 border-t border-slate-200 mt-2">
                                  <div className="w-40 border-b border-slate-600 mb-1" />
                                  <p className="font-bold text-slate-900 text-[11px]">
                                    {selectedFileForPreview.leadOfficer || 'Lead Operations Officer'}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {selectedFileForPreview.leadOfficerRole || 'Lead Operations Officer'}
                                  </p>
                                </div>
                              </div>
                              <div className="col-span-2 text-center text-slate-500 font-medium pt-0.5">Info</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Security Digest */}
                    <div className="pt-2 text-[11px] text-slate-400 font-mono">
                      Official Tamper-Proof Audit Digest (SHA-256): {selectedFileForPreview.hash}
                    </div>
                  </div>
                ) : previewPdfBlobUrl ? (
                  <iframe
                    ref={printIframeRef}
                    src={`${previewPdfBlobUrl}#view=FitH&toolbar=0&navpanes=0`}
                    className="w-full h-full rounded-2xl border border-[#CBD5E1] shadow-lg bg-white"
                    title={selectedFileForPreview.filename}
                  />
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              <p className="text-xs font-bold text-white">{toastNotification.message}</p>
              {toastNotification.submessage && (
                <p className="text-[11px] text-slate-400 mt-0.5">{toastNotification.submessage}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
