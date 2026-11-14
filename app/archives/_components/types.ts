'use client';

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
  signatures?: { name: string; title?: string; signatureUrl?: string }[];
  logsCount: number;
}

export interface ShiftLogEntry {
  id?: string;
  time: string;
  date: string;
  created_at?: string;
  status: 'Critical' | 'Warning' | 'Active' | 'Info';
  title: string;
  reportType: string;
  description: string;
  operator: string;
  operator_id?: string;
  operatorRole?: string;
  signatureUrl?: string | null;
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
  hasPort?: boolean;
  portName?: string;
  remarks?: string;
}

export interface ArchiveProfileRow {
  id: string;
  full_name: string | null;
  position_title: string | null;
  signature_url: string | null;
}

export interface ArchiveSnapshotData {
  totalStations?: number;
  present?: number;
  absent?: number;
  exempted?: number;
  unresponsive?: number;
  entries?: Record<string, unknown>[];
  records?: Record<string, unknown>[];
  conductedBy?: string;
  sessionTime?: string;
  sessionDate?: string;
  dailyReportDate?: string;
  radioScript?: string;
  weatherSummary?: string;
  weather_summary?: string;
  frequency?: string;
  isDailyCombined?: boolean;
  shifts?: Record<string, unknown>[];
  shift?: Record<string, unknown>;
  finalHandoverStatus?: string;
  handoverStatus?: string;
  incidentDetails?: string;
  logs?: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface ArchiveDbRow {
  id: string;
  filename: string;
  category: 'log' | 'roll-call';
  shift_label?: string | null;
  shift_hours?: string | null;
  item_count?: number | null;
  file_size_bytes?: number | null;
  storage_path?: string | null;
  file_url?: string | null;
  file_hash: string;
  summary?: string | null;
  status?: 'Verified' | 'Archived' | null;
  lead_officer_name?: string | null;
  lead_officer_role?: string | null;
  lead_officer_badge?: string | null;
  generated_at?: string | null;
  created_at?: string | null;
  daily_report_date?: string | null;
  session_date?: string | null;
  snapshot_data?: ArchiveSnapshotData | null;
}

export interface ArchivedFile {
  id: string;
  filename: string;
  category: 'log' | 'roll-call';
  createdAt: string;
  generatedAt: string;
  fileSize: string;
  fileSizeBytes?: number;
  leadOfficer: string;
  leadOfficerRole: string;
  leadOfficerBadge: string;
  shift: string;
  shiftHours: string;
  itemCount: number;
  hash: string;
  summary: string;
  status: 'Verified' | 'Archived';
  monitoringBriefing: string;
  dutyPersonnelRoster: ShiftPersonnelInfo[];
  dutySignatures?: { name: string; title?: string }[];
  standbyVehicles?: { name: string; count: number }[];
  handoverStatus: 'Situation Remain Normal' | 'Incident Report';
  incidentReportDetails?: string;
  isDailyCombined?: boolean;
  dailyReportDate?: string;
  sessionDate?: string;
  shifts?: ShiftSummaryEntry[];
  storagePath?: string;
  fileUrl?: string;
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
  snapshotLoaded?: boolean;
  rawSnapshotData?: ArchiveSnapshotData;
}

// =============================================================================
// STORAGE & TEMPLATE FORMATTING HELPERS
// =============================================================================

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const formatFileDate = (dateStr: string): string => {
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

export const getShiftStartTime = (file: ArchivedFile): string => {
  if (file.logEntries && file.logEntries.length > 0) {
    return file.logEntries[0].time;
  }
  if (file.shiftHours) {
    const match = file.shiftHours.match(/(\d{2}):(\d{2})/);
    if (match) return `${match[1]}${match[2]}H`;
  }
  return '1200H';
};

export const getShiftEndTime = (file: ArchivedFile): string => {
  if (file.generatedAt) {
    const match = file.generatedAt.match(/(\d{2}):(\d{2})H?/);
    if (match) return `${match[1]}${match[2]}H`;
  }
  if (file.logEntries && file.logEntries.length > 0) {
    return file.logEntries[file.logEntries.length - 1].time;
  }
  return '1300H';
};

export function sortArchiveLogsChronologically<
  T extends {
    time?: string;
    log_time?: string;
    date?: string;
    log_date?: string;
    created_at?: string;
  },
>(logs: T[], cycleStartTime?: string): T[] {
  if (!logs || logs.length <= 1) return logs || [];

  const parseTimeMin = (t?: string): number => {
    if (!t) return 0;
    const clean = t.replace(/[^0-9]/g, '');
    if (clean.length >= 4) {
      const h = parseInt(clean.slice(0, 2), 10);
      const m = parseInt(clean.slice(2, 4), 10);
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    }
    if (clean.length > 0) {
      const h = parseInt(clean, 10);
      return isNaN(h) ? 0 : h * 60;
    }
    return 0;
  };

  const cycleStartMin = parseTimeMin(cycleStartTime || '0800H');

  return [...logs].sort((a, b) => {
    if (a.created_at && b.created_at) {
      const dtA = new Date(a.created_at).getTime();
      const dtB = new Date(b.created_at).getTime();
      if (!isNaN(dtA) && !isNaN(dtB) && dtA !== dtB) {
        return dtA - dtB;
      }
    }

    const dateA = a.date || a.log_date;
    const dateB = b.date || b.log_date;
    if (dateA && dateB && dateA !== dateB) {
      const dtA = new Date(dateA).getTime();
      const dtB = new Date(dateB).getTime();
      if (!isNaN(dtA) && !isNaN(dtB) && dtA !== dtB) {
        return dtA - dtB;
      }
    }

    const timeA = a.time || a.log_time;
    const timeB = b.time || b.log_time;
    const minA = parseTimeMin(timeA);
    const minB = parseTimeMin(timeB);

    const normA = (minA - cycleStartMin + 1440) % 1440;
    const normB = (minB - cycleStartMin + 1440) % 1440;

    return normA - normB;
  });
}

export function getFileDateISO(file: ArchivedFile): string {
  if (file.dailyReportDate && /^\d{4}-\d{2}-\d{2}$/.test(file.dailyReportDate)) {
    return file.dailyReportDate;
  }
  if (file.sessionDate && /^\d{4}-\d{2}-\d{2}$/.test(file.sessionDate)) {
    return file.sessionDate;
  }
  if (
    file.rawSnapshotData?.sessionDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(file.rawSnapshotData.sessionDate))
  ) {
    return String(file.rawSnapshotData.sessionDate);
  }
  if (
    file.rawSnapshotData?.dailyReportDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(file.rawSnapshotData.dailyReportDate))
  ) {
    return String(file.rawSnapshotData.dailyReportDate);
  }
  const filenameMatch = file.filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (filenameMatch) {
    return `${filenameMatch[1]}-${filenameMatch[2]}-${filenameMatch[3]}`;
  }
  if (file.createdAt) {
    const cleanDate = file.createdAt.split('·')[0].trim();
    const parsed = new Date(cleanDate);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  return '';
}

function strVal(val: unknown, fallback = ''): string {
  return typeof val === 'string' && val.length > 0 ? val : fallback;
}

export function mapDbArchiveToArchivedFile(row: ArchiveDbRow): ArchivedFile {
  const hasSnapshot = Boolean(row.snapshot_data && Object.keys(row.snapshot_data).length > 0);
  const snapshot: ArchiveSnapshotData = row.snapshot_data || {};
  const isRollCall = row.category === 'roll-call';
  const genDate = row.generated_at || row.created_at || new Date().toISOString();
  const d = new Date(genDate);

  let formattedSize = '1.2 MB';
  let bytes = 1.2 * 1024 * 1024;
  if (row.file_size_bytes) {
    bytes = Number(row.file_size_bytes);
    if (bytes >= 1024 * 1024) {
      formattedSize = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      formattedSize = `${Math.round(bytes / 1024)} KB`;
    }
  }

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
  const createdAtFormatted = `${dateStr} · ${timeStr}`;

  if (isRollCall) {
    const totalStations = snapshot.totalStations || row.item_count || 8;
    const present = snapshot.present ?? 0;
    const absent = snapshot.absent ?? 0;
    const exempted = snapshot.exempted ?? 0;
    const unresponsive =
      snapshot.unresponsive !== undefined ? snapshot.unresponsive : absent;

    const rawList =
      Array.isArray(snapshot.entries) && snapshot.entries.length > 0
        ? snapshot.entries
        : Array.isArray(snapshot.records) && snapshot.records.length > 0
        ? snapshot.records
        : [];

    const entries: RollCallStationEntry[] = rawList.map((e) => {
      const munName =
        strVal(e.name) ||
        strVal(e.area_name) ||
        strVal(e.municipality) ||
        strVal(e.area_code, 'Station');
      const attStatus = (strVal(e.attendance) ||
        strVal(e.status) ||
        'Present') as RollCallStationEntry['status'];
      const isInactive = attStatus === 'Absent' || attStatus === 'Exempted';
      const weather = isInactive
        ? `N/A (${attStatus})`
        : strVal(e.weatherStatus) ||
          strVal(e.weather_status) ||
          strVal(e.weather, 'Fair');
      const hasPortVal = typeof e.hasPort === 'boolean' ? e.hasPort : undefined;
      const port = isInactive
        ? `N/A (${attStatus})`
        : hasPortVal === false
        ? 'No Port (Inland)'
        : strVal(e.portStatus) ||
          strVal(e.port_status) ||
          strVal(e.port, 'Operational');
      const pName = strVal(e.portName) || strVal(e.port_name) || undefined;
      const portLabel = pName && pName !== 'None' ? ` (${pName})` : '';

      return {
        station: `${munName} Station${portLabel}`,
        municipality: munName,
        timeResponded:
          strVal(e.timeResponded) ||
          strVal(e.time_responded) ||
          strVal(e.time, '—'),
        weatherCondition: weather,
        seaPortStatus: port,
        dutyOperator:
          strVal(e.dutyOperator) ||
          strVal(e.duty_operator, 'Station Duty Officer'),
        status: attStatus,
        hasPort: hasPortVal,
        portName: pName,
        remarks: strVal(e.remarks) || undefined,
      };
    });

    const sessionDateResolved = row.session_date || snapshot.sessionDate || undefined;

    return {
      id: row.id,
      filename: row.filename,
      category: 'roll-call',
      createdAt: createdAtFormatted,
      generatedAt: `${row.shift_hours || snapshot.sessionTime || '16:00H'} · Official Radio Net Roll Call`,
      fileSize: formattedSize,
      fileSizeBytes: bytes,
      leadOfficer:
        row.lead_officer_name || snapshot.conductedBy || 'Monitoring Officer',
      leadOfficerRole: row.lead_officer_role || 'Radio Net Controller',
      leadOfficerBadge: row.lead_officer_badge || 'OPC-1042',
      shift: row.shift_label || 'Day Shift Net Call',
      shiftHours:
        row.shift_hours || `${snapshot.sessionTime || '16:00H'} Net Call`,
      itemCount: totalStations,
      hash: row.file_hash,
      summary:
        row.summary ||
        `Roll Call Session completed on ${sessionDateResolved || dateStr}. Present: ${present}, Absent: ${absent}, Exempted: ${exempted}.`,
      status: row.status || 'Verified',
      monitoringBriefing:
        snapshot.radioScript ||
        'Primary Net 142.500 MHz Radio Roll Call Consolidation',
      dutyPersonnelRoster: [
        {
          name:
            row.lead_officer_name ||
            snapshot.conductedBy ||
            'Monitoring Officer',
          role: row.lead_officer_role || 'Net Controller',
          badgeNumber: row.lead_officer_badge || 'OPC-1042',
          presentAtEnd: true,
        },
      ],
      handoverStatus: 'Situation Remain Normal',
      sessionDate: sessionDateResolved,
      storagePath: row.storage_path || undefined,
      fileUrl: row.file_url || undefined,
      rollCallStats: {
        totalAreas: totalStations,
        present,
        absent,
        exempted,
        unresponsive,
        weatherSummary:
          snapshot.weatherSummary ||
          snapshot.weather_summary ||
          'Normal conditions across active stations',
        frequency: snapshot.frequency || '142.500 MHz Primary VHF Net',
      },
      rollCallEntries: entries,
      snapshotLoaded: hasSnapshot,
      rawSnapshotData: snapshot,
    };
  }

  const isDailyCombined = Boolean(snapshot.isDailyCombined);
  const shiftsList: ShiftSummaryEntry[] =
    isDailyCombined && Array.isArray(snapshot.shifts)
      ? snapshot.shifts.map((s) => {
          const rawRoster = Array.isArray(s.roster)
            ? s.roster
            : Array.isArray(s.duty_roster)
            ? s.duty_roster
            : [];
          return {
            id: strVal(s.id) || undefined,
            shiftLabel: strVal(s.shiftLabel) || strVal(s.shift_label, 'Shift'),
            startTime: strVal(s.startTime) || strVal(s.start_time, '00:00H'),
            endTime: strVal(s.endTime) || strVal(s.end_time, '00:00H'),
            leadOfficer:
              strVal(s.leadOfficer) ||
              strVal(s.lead_officer_name, 'Lead Officer'),
            leadOfficerRole:
              strVal(s.leadOfficerRole) ||
              strVal(s.lead_officer_role, 'Lead Operations Officer'),
            leadOfficerBadge:
              strVal(s.leadOfficerBadge) ||
              strVal(s.lead_officer_badge, 'OPC-1001'),
            handoverStatus:
              strVal(s.handoverStatus) ||
              strVal(s.handover_status, 'Situation Remain Normal'),
            incidentDetails:
              strVal(s.incidentDetails) ||
              strVal(s.incident_report_details) ||
              undefined,
            monitoringBriefing:
              strVal(s.monitoringBriefing) ||
              strVal(s.start_monitoring_details) ||
              undefined,
            roster: (rawRoster as Record<string, unknown>[]).map((p) => ({
              name: strVal(p.name) || strVal(p.full_name, 'Officer'),
              role:
                strVal(p.role) || strVal(p.position_title, 'Operations Staff'),
              badgeNumber:
                strVal(p.badge) || strVal(p.badgeNumber, 'OPC-1001'),
              presentAtEnd: p.presentAtEnd !== false,
            })),
            standbyVehicles: Array.isArray(s.standbyVehicles)
              ? (s.standbyVehicles as { name: string; count: number }[])
              : Array.isArray(s.standby_vehicles)
              ? (s.standby_vehicles as { name: string; count: number }[])
              : [],
            signatures: Array.isArray(s.signatures)
              ? (s.signatures as {
                  name: string;
                  title?: string;
                  signatureUrl?: string;
                }[])
              : [],
            logsCount: typeof s.logsCount === 'number' ? s.logsCount : 0,
          };
        })
      : [];

  const shiftData: Record<string, unknown> = snapshot.shift || {};
  const handoverStatus = (snapshot.finalHandoverStatus ||
    snapshot.handoverStatus ||
    (snapshot.incidentDetails
      ? 'Incident Report'
      : 'Situation Remain Normal')) as ArchivedFile['handoverStatus'];

  const rawLogs = Array.isArray(snapshot.logs) ? snapshot.logs : [];
  const logsList: ShiftLogEntry[] = rawLogs.map((l) => {
    const rawStatus = strVal(l.status);
    const derivedStatus = (strVal(l.severity) ||
      rawStatus ||
      'Info') as ShiftLogEntry['status'];
    const fallbackReportType =
      rawStatus && !['Active', 'Critical', 'Warning', 'Info'].includes(rawStatus)
        ? rawStatus
        : 'Log Entry';

    return {
      id: strVal(l.id) || undefined,
      time: strVal(l.time) || strVal(l.log_time, '1200H'),
      date: strVal(l.date) || strVal(l.log_date, dateStr),
      created_at: strVal(l.created_at) || undefined,
      status: derivedStatus,
      title: strVal(l.title) || strVal(l.category, 'Operational Event'),
      reportType:
        strVal(l.report_type_name) ||
        strVal(l.reportType) ||
        strVal(l.category) ||
        strVal(l.report_type, fallbackReportType),
      description: strVal(l.description),
      operator:
        strVal(l.logged_by_name) ||
        strVal(l.operator) ||
        strVal(l.operator_name) ||
        row.lead_officer_name ||
        'Monitoring Officer',
      operator_id: strVal(l.operator_id) || undefined,
      operatorRole:
        strVal(l.operatorRole) || strVal(l.operator_role) || undefined,
      signatureUrl:
        strVal(l.signatureUrl) || strVal(l.signature_url) || undefined,
    };
  });

  const cycleStartTime =
    shiftsList[0]?.startTime || (logsList[0]?.time ? logsList[0].time : '0800H');
  const sortedLogsList = sortArchiveLogsChronologically(logsList, cycleStartTime);

  let roster: ShiftPersonnelInfo[] = [];
  if (isDailyCombined && shiftsList.length > 0) {
    const seen = new Set<string>();
    for (const s of shiftsList) {
      for (const p of s.roster) {
        if (!seen.has(p.name)) {
          seen.add(p.name);
          roster.push(p);
        }
      }
    }
  } else {
    const dutyRoster = Array.isArray(shiftData.duty_roster)
      ? (shiftData.duty_roster as Record<string, unknown>[])
      : [];
    roster = dutyRoster.map((p) => ({
      name: strVal(p.name) || strVal(p.full_name, 'Officer'),
      role: strVal(p.role) || strVal(p.position_title, 'Operations Staff'),
      badgeNumber: strVal(p.badge) || strVal(p.badgeNumber, 'OPC-1001'),
      presentAtEnd: p.presentAtEnd !== false,
    }));
  }

  let signatures: { name: string; title?: string }[] = [];
  if (isDailyCombined && shiftsList.length > 0) {
    const sigSet = new Set<string>();
    for (const s of shiftsList) {
      if (s.leadOfficer && !sigSet.has(s.leadOfficer)) {
        sigSet.add(s.leadOfficer);
        signatures.push({
          name: s.leadOfficer,
          title: s.leadOfficerRole || 'Shift Lead Officer',
        });
      }
    }
  } else {
    signatures = Array.isArray(shiftData.signatures)
      ? (shiftData.signatures as { name: string; title?: string }[])
      : [
          {
            name: row.lead_officer_name || 'Lead Officer',
            title: row.lead_officer_role || 'Lead Operations Officer',
          },
        ];
  }

  const dailyDateResolved =
    row.daily_report_date || snapshot.dailyReportDate || undefined;

  return {
    id: row.id,
    filename: row.filename,
    category: 'log',
    createdAt: createdAtFormatted,
    generatedAt: isDailyCombined
      ? `24-Hour Daily Operations Report (${dailyDateResolved || dateStr})`
      : `${row.shift_hours || '16:00H'} · End of Shift Handover`,
    fileSize: formattedSize,
    fileSizeBytes: bytes,
    leadOfficer:
      row.lead_officer_name ||
      strVal(shiftData.lead_officer_name, 'Lead Officer'),
    leadOfficerRole: row.lead_officer_role || 'Lead Operations Officer',
    leadOfficerBadge: row.lead_officer_badge || 'OPC-1001',
    shift:
      row.shift_label ||
      (isDailyCombined
        ? '24-Hour Consolidated Operations'
        : strVal(shiftData.shift_label, 'Day Shift (Alpha)')),
    shiftHours:
      row.shift_hours ||
      (isDailyCombined
        ? '00:00H - 23:59H (24-Hour Cycle)'
        : `${strVal(shiftData.start_time, '08:00H')} - ${strVal(
            shiftData.end_time,
            '16:00H'
          )}`),
    itemCount: row.item_count || sortedLogsList.length,
    hash: row.file_hash,
    summary:
      row.summary ||
      (isDailyCombined
        ? `Official 24-Hour consolidated operational report combining ${shiftsList.length} shifts. Total logs: ${sortedLogsList.length}.`
        : `Official operational shift handover archive for ${row.shift_label}. Handover status: ${handoverStatus}.`),
    status: row.status || 'Verified',
    monitoringBriefing: isDailyCombined
      ? `Consolidated 24-Hour Operations across ${shiftsList.length} operational shifts`
      : strVal(shiftData.monitoring_briefing, 'Start of Monitoring Duty'),
    dutyPersonnelRoster:
      roster.length > 0
        ? roster
        : [
            {
              name: row.lead_officer_name || 'Lead Officer',
              role: row.lead_officer_role || 'Lead Operations Officer',
              badgeNumber: 'OPC-1001',
              presentAtEnd: true,
            },
          ],
    dutySignatures:
      signatures.length > 0
        ? signatures
        : [
            {
              name: row.lead_officer_name || 'Lead Officer',
              title: row.lead_officer_role || 'Lead Operations Officer',
            },
          ],
    standbyVehicles: Array.isArray(shiftData.standby_vehicles)
      ? (shiftData.standby_vehicles as { name: string; count: number }[])
      : [
          { name: 'Pick up', count: 1 },
          { name: 'Ambulance', count: 1 },
        ],
    handoverStatus,
    incidentReportDetails: snapshot.incidentDetails || undefined,
    isDailyCombined,
    dailyReportDate: dailyDateResolved,
    shifts: shiftsList,
    logEntries: sortedLogsList,
    storagePath: row.storage_path || undefined,
    fileUrl: row.file_url || undefined,
    snapshotLoaded: hasSnapshot,
    rawSnapshotData: snapshot,
  };
}
