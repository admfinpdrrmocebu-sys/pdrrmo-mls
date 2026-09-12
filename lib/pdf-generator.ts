import { jsPDF } from 'jspdf';
import { supabase } from './supabase/client';
import { CAPITOL_LOGO_BASE64, PDRRMO_LOGO_BASE64 } from './header-logos';

export interface RollCallStationItem {
  name: string;
  code?: string;
  attendance?: string | null;
  weatherStatus?: string | null;
  portStatus?: string | null;
  hasPort?: boolean;
  portName?: string;
  timeResponded?: string | null;
  dutyOperator?: string;
}

export interface RollCallPdfData {
  filename: string;
  sessionDate: string;
  sessionTime: string;
  frequency: string;
  radioScript?: string;
  conductedBy: string;
  conductedByRole?: string;
  signatureUrl?: string | null;
  signatureBase64?: string | null;
  totalStations: number;
  present: number;
  absent: number;
  exempted: number;
  weatherSummary: string;
  entries: RollCallStationItem[];
  fileHash: string;
  snapshotPayload?: any;
}

export interface DailyLogShiftItem {
  shiftLabel: string;
  startTime: string;
  endTime: string;
  leadOfficer: string;
  leadOfficerRole?: string;
  handoverStatus: string;
  roster: Array<{ name: string; role: string; badgeNumber?: string }>;
  standbyVehicles?: Array<{ name: string; count: number }>;
  signatures?: Array<{ name: string; title?: string }>;
  logsCount: number;
}

export interface DailyLogEntryItem {
  time: string;
  status: string;
  title: string;
  description: string;
  operator: string;
}

export interface DailyLogsPdfData {
  filename: string;
  dailyReportDate: string;
  totalShiftsCount: number;
  finalOfficer: string;
  finalOfficerRole?: string;
  finalHandoverStatus: string;
  signatureUrl?: string | null;
  signatureBase64?: string | null;
  shifts: DailyLogShiftItem[];
  logs: DailyLogEntryItem[];
  fileHash: string;
  snapshotPayload?: any;
}

// Helper: Format date string as MM/DD/YYYY
function formatHeaderDate(dateStr: string): string {
  if (!dateStr) return '09/27/2026';
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }
  return dateStr;
}

/**
 * Draws the official document header with dual logos matching Template-Example-FileFormat-MLS.docx
 */
function drawDocumentHeader(doc: jsPDF, title: string, pageNumber: number, totalPages: number = 1): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Draw Left Logo (Capitol / Province of Cebu Seal)
  try {
    if (CAPITOL_LOGO_BASE64) {
      doc.addImage(CAPITOL_LOGO_BASE64, 'PNG', 12.5, 7.5, 23, 23);
    }
  } catch (err) {
    console.warn('Could not draw Capitol logo:', err);
  }

  // Draw Right Logo (PDRRMO Logo)
  try {
    if (PDRRMO_LOGO_BASE64) {
      doc.addImage(PDRRMO_LOGO_BASE64, 'PNG', pageWidth - 14 - 20, 9, 20, 20);
    }
  } catch (err) {
    console.warn('Could not draw PDRRMO logo:', err);
  }

  let y = 13.5;

  // Header Typography (matching Template-Example-FileFormat-MLS.docx)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Republic of the Philippines', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.text('Province of Cebu', pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('PROVINCIAL DISASTER RISK MANAGEMENT OFFICE', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('(032) 888-2328 LOCAL 2301 or 2302 | Email: pdrrmo.cebu@gmail.com', pageWidth / 2, y, { align: 'center' });
  y += 5.5;

  // Document Title (e.g. "Radio Net Roll Call System" or "Monitoring Logs System")
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 74, 198);
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 4;

  // Header Divider Line
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  return y;
}

/**
 * Draws the table header columns: Time | Title w/ Description | Attendance / Report Type
 */
function drawTableHeader(doc: jsPDF, y: number, lastColTitle: string = 'Report Type'): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = pageWidth - 28;

  const colTimeW = 24;
  const colTypeW = 28;
  const colDescW = tableWidth - colTimeW - colTypeW;

  const col1X = 14;
  const col2X = col1X + colTimeW;
  const col3X = col2X + colDescW;

  doc.setFillColor(241, 245, 249);
  doc.rect(col1X, y, tableWidth, 7, 'F');
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.3);
  doc.rect(col1X, y, tableWidth, 7, 'S');
  doc.line(col2X, y, col2X, y + 7);
  doc.line(col3X, y, col3X, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Time', col1X + colTimeW / 2, y + 4.8, { align: 'center' });
  doc.text('Title w/ Description', col2X + 4, y + 4.8);
  doc.text(lastColTitle, col3X + colTypeW / 2, y + 4.8, { align: 'center' });

  return y + 7;
}

// Helper: Resolve any signature URL or path to base64 for embedding in PDF
export async function resolveSignatureBase64(urlOrPath: string | null | undefined): Promise<string | null> {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith('data:image/')) return urlOrPath;

  try {
    let resolvedUrl = urlOrPath;
    if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
      const cleanPath = urlOrPath.replace(/^signatures\//, '');
      const { data } = supabase.storage.from('signatures').getPublicUrl(cleanPath);
      resolvedUrl = data?.publicUrl || urlOrPath;
    }

    const res = await fetch(resolvedUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not resolve signature base64 for PDF:', err);
    return null;
  }
}

/**
 * Generates an official certified PDF for Roll Call following Template-Example-FileFormat-MLS.docx
 */
export async function generateRollCallPDF(data: RollCallPdfData): Promise<{ blob: Blob; sizeBytes: number; hash: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - 28;

  const colTimeW = 24;
  const colTypeW = 28;
  const colDescW = tableWidth - colTimeW - colTypeW;

  const col1X = 14;
  const col2X = col1X + colTimeW;
  const col3X = col2X + colDescW;

  let y = drawDocumentHeader(doc, 'Radio Net Roll Call System', 1);

  // Date line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Date: ${formatHeaderDate(data.sessionDate)}`, 14, y);
  y += 5;

  y = drawTableHeader(doc, y, 'Attendance');

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage();
      y = drawDocumentHeader(doc, 'Radio Net Roll Call System', 2);
      y = drawTableHeader(doc, y, 'Attendance');
    }
  };

  const drawRow = (timeStr: string, descLines: string[], reportType: string, customMinHeight = 0) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    const rowHeight = Math.max(customMinHeight, descLines.length * 4.2 + 6);
    checkPageBreak(rowHeight);

    // Row borders
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    doc.rect(col1X, y, tableWidth, rowHeight, 'S');
    doc.line(col2X, y, col2X, y + rowHeight);
    doc.line(col3X, y, col3X, y + rowHeight);

    // Col 1: Time
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(timeStr || data.sessionTime || '1600H', col1X + colTimeW / 2, y + 5.5, { align: 'center' });

    // Col 2: Title w/ Description
    doc.setFont('helvetica', 'normal');
    let lineY = y + 5;
    descLines.forEach((line, idx) => {
      if (idx === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
      }
      doc.text(line, col2X + 3, lineY);
      lineY += 4.2;
    });

    // Col 3: Attendance / Status
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    if (reportType === 'Present') {
      doc.setTextColor(22, 101, 52); // Dark Green
    } else if (reportType === 'Absent') {
      doc.setTextColor(185, 28, 28); // Dark Red
    } else if (reportType === 'Exempted') {
      doc.setTextColor(180, 83, 9); // Dark Amber
    } else {
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
    }
    doc.text(reportType || '—', col3X + colTypeW / 2, y + 5.5, { align: 'center' });

    y += rowHeight;
  };

  // Dedicated drawer for start/end rows with user profile signature and NO second signature
  const drawSignatureRow = (
    timeStr: string,
    descLines: string[],
    reportType: string,
    officerName: string,
    officerRole: string,
    signatureImgBase64?: string | null
  ) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    const textLinesHeight = descLines.length * 4.2 + 4;
    const sigImgHeight = signatureImgBase64 ? 12 : 6;
    const sigTextHeight = 10;
    const rowHeight = Math.max(36, textLinesHeight + sigImgHeight + sigTextHeight + 4);

    checkPageBreak(rowHeight);

    // Row borders
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    doc.rect(col1X, y, tableWidth, rowHeight, 'S');
    doc.line(col2X, y, col2X, y + rowHeight);
    doc.line(col3X, y, col3X, y + rowHeight);

    // Col 1: Time
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(timeStr || data.sessionTime || '1600H', col1X + colTimeW / 2, y + 5.5, { align: 'center' });

    // Col 2: Title w/ Description
    let lineY = y + 5;
    descLines.forEach((line, idx) => {
      if (idx === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
      }
      doc.text(line, col2X + 3, lineY);
      lineY += 4.2;
    });

    lineY += 1;

    // Attach operating user's signature if available
    if (signatureImgBase64) {
      try {
        doc.addImage(signatureImgBase64, 'PNG', col2X + 3, lineY, 28, 10);
        lineY += 11;
      } catch (imgErr) {
        console.warn('Could not render signature on PDF:', imgErr);
        lineY += 5;
      }
    } else {
      lineY += 5;
    }

    // Signature line
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.3);
    doc.line(col2X + 3, lineY, col2X + 55, lineY);
    lineY += 3.6;

    // Officer Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(officerName || 'Duty Operations Officer', col2X + 3, lineY);
    lineY += 3.2;

    // Officer Role / Title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(officerRole || 'Duty Operations Officer', col2X + 3, lineY);

    // Col 3: Attendance (Only rendered if an attendance status is specified)
    if (reportType && reportType !== '—') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      if (reportType === 'Present') {
        doc.setTextColor(22, 101, 52); // Dark Green
      } else if (reportType === 'Absent') {
        doc.setTextColor(185, 28, 28); // Dark Red
      } else if (reportType === 'Exempted') {
        doc.setTextColor(180, 83, 9); // Dark Amber
      } else {
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
      }
      doc.text(reportType, col3X + colTypeW / 2, y + 5.5, { align: 'center' });
    }

    y += rowHeight;
  };

  // Resolve operating user signature from profile
  const signatureBase64 = data.signatureBase64 || (await resolveSignatureBase64(data.signatureUrl));

  // 1. START OF ROLL CALL ENTRY (Only operating user signature, no operations head)
  const startDesc = [
    `Start of Radio Net Roll Call, ${data.conductedBy || 'Duty Officer'}`,
    `Net Frequency: ${data.frequency || '142.500 MHz Primary VHF Net'}`,
    `Radio Script: ${data.radioScript ? data.radioScript.slice(0, 90) + '...' : 'Radio Roll Call Net Protocol'}`,
    `Total Designated Stations: ${data.totalStations || data.entries.length} Stations`,
  ];
  drawSignatureRow(
    data.sessionTime || '1600H',
    startDesc,
    '',
    data.conductedBy || 'Duty Operations Officer',
    data.conductedByRole || 'Duty Operations Officer',
    signatureBase64
  );

  // 2. STATION TELEMETRY ROSTER ENTRIES
  (data.entries || []).forEach((stn) => {
    const attendanceStatus = stn.attendance || 'Present';
    const isInactive = attendanceStatus === 'Absent' || attendanceStatus === 'Exempted';
    const weather = isInactive ? 'N/A' : (stn.weatherStatus || 'Fair');
    const port = isInactive ? 'N/A' : (!stn.hasPort ? 'No Port (Inland)' : (stn.portStatus || 'Operational'));
    const portLabel = stn.portName && stn.portName !== 'None' ? ` (${stn.portName})` : '';

    const stnDesc = [
      `${stn.name || 'Station'} Station${portLabel}`,
      `Weather Condition: ${weather} | Port Status: ${port}`,
      `Operator: ${stn.dutyOperator || 'Station Duty Officer'}`,
    ];

    drawRow(stn.timeResponded || data.sessionTime || '1600H', stnDesc, attendanceStatus);
  });

  // 3. END OF ROLL CALL ENTRY (Only operating user signature, no operations head)
  const endDesc = [
    `End of Radio Net Roll Call ${data.conductedBy || 'Duty Officer'}`,
    `Attendance Breakdown: ${data.present} Present, ${data.absent} Absent, ${data.exempted} Exempted`,
    'Situation Remain Normal',
  ];
  drawSignatureRow(
    data.sessionTime || '1630H',
    endDesc,
    '',
    data.conductedBy || 'Duty Operations Officer',
    data.conductedByRole || 'Duty Operations Officer',
    signatureBase64
  );

  // Bottom SHA-256 Digest Tag
  y += 4;
  checkPageBreak(10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Official Tamper-Proof Audit Digest (SHA-256): ${data.fileHash}`, 14, y);

  // Set Document Properties
  doc.setDocumentProperties({
    title: data.filename,
    subject: `Radio Net Roll Call Report ${data.sessionDate}`,
    author: data.conductedBy,
    creator: 'PDRRMO Monitoring & Logging System',
    keywords: JSON.stringify(data.snapshotPayload || {}),
  });

  const blob = doc.output('blob');
  return {
    blob,
    sizeBytes: blob.size,
    hash: data.fileHash,
  };
}

/**
 * Generates an official certified PDF for 24-Hour Daily Operations Logs matching Template-Example-FileFormat-MLS.docx
 */
export async function generateDailyLogsPDF(data: DailyLogsPdfData): Promise<{ blob: Blob; sizeBytes: number; hash: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - 28;

  const colTimeW = 24;
  const colTypeW = 28;
  const colDescW = tableWidth - colTimeW - colTypeW;

  const col1X = 14;
  const col2X = col1X + colTimeW;
  const col3X = col2X + colDescW;

  let y = drawDocumentHeader(doc, 'Monitoring Logs System', 1);

  // Date line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Date: ${formatHeaderDate(data.dailyReportDate)}`, 14, y);
  y += 5;

  y = drawTableHeader(doc, y);

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage();
      y = drawDocumentHeader(doc, 'Monitoring Logs System', 2);
      y = drawTableHeader(doc, y);
    }
  };

  const drawRow = (timeStr: string, descLines: string[], reportType: string, customMinHeight = 0) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    const rowHeight = Math.max(customMinHeight, descLines.length * 4.2 + 6);
    checkPageBreak(rowHeight);

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    doc.rect(col1X, y, tableWidth, rowHeight, 'S');
    doc.line(col2X, y, col2X, y + rowHeight);
    doc.line(col3X, y, col3X, y + rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(timeStr || '1200H', col1X + colTimeW / 2, y + 5.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    let lineY = y + 5;
    descLines.forEach((line, idx) => {
      if (idx === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
      }
      doc.text(line, col2X + 3, lineY);
      lineY += 4.2;
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(reportType || 'Info', col3X + colTypeW / 2, y + 5.5, { align: 'center' });

    y += rowHeight;
  };

  // Dedicated drawer for start/end rows with user profile signature and NO second signature
  const drawSignatureRow = (
    timeStr: string,
    descLines: string[],
    reportType: string,
    officerName: string,
    officerRole: string,
    signatureImgBase64?: string | null
  ) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    const textLinesHeight = descLines.length * 4.2 + 4;
    const sigImgHeight = signatureImgBase64 ? 12 : 6;
    const sigTextHeight = 10;
    const rowHeight = Math.max(36, textLinesHeight + sigImgHeight + sigTextHeight + 4);

    checkPageBreak(rowHeight);

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    doc.rect(col1X, y, tableWidth, rowHeight, 'S');
    doc.line(col2X, y, col2X, y + rowHeight);
    doc.line(col3X, y, col3X, y + rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(timeStr || '1200H', col1X + colTimeW / 2, y + 5.5, { align: 'center' });

    let lineY = y + 5;
    descLines.forEach((line, idx) => {
      if (idx === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
      }
      doc.text(line, col2X + 3, lineY);
      lineY += 4.2;
    });

    lineY += 1;

    // Attach operating user's signature if available
    if (signatureImgBase64) {
      try {
        doc.addImage(signatureImgBase64, 'PNG', col2X + 3, lineY, 28, 10);
        lineY += 11;
      } catch (imgErr) {
        console.warn('Could not render signature on PDF:', imgErr);
        lineY += 5;
      }
    } else {
      lineY += 5;
    }

    // Signature line
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.3);
    doc.line(col2X + 3, lineY, col2X + 55, lineY);
    lineY += 3.6;

    // Officer Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(officerName || 'Lead Operations Officer', col2X + 3, lineY);
    lineY += 3.2;

    // Officer Title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(officerRole || 'Lead Operations Officer', col2X + 3, lineY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(reportType || 'Info', col3X + colTypeW / 2, y + 5.5, { align: 'center' });

    y += rowHeight;
  };

  // Resolve operating user signature from profile
  const signatureBase64 = data.signatureBase64 || (await resolveSignatureBase64(data.signatureUrl));

  // Start of duty row (Only operating user signature, no second signature)
  const firstShift = data.shifts && data.shifts[0];
  const startDesc = [
    `Start of Monitoring Duty, ${firstShift ? firstShift.leadOfficer : (data.finalOfficer || 'Duty Officer')}`,
    'Standby Vehicles: Pick up - 1, Ambulance - 1, Demo Items - 5',
  ];
  drawSignatureRow(
    firstShift?.startTime || '0800H',
    startDesc,
    'Info',
    firstShift?.leadOfficer || data.finalOfficer || 'Lead Operations Officer',
    firstShift?.leadOfficerRole || data.finalOfficerRole || 'Lead Operations Officer',
    signatureBase64
  );

  // Chronological Log Entries
  (data.logs || []).forEach((log) => {
    const logDesc = [
      log.title || 'Operational Event',
      (log.description || '').replace(/<[^>]+>/g, '').slice(0, 240),
    ];
    drawRow(log.time || '1200H', logDesc, log.status || 'Info');
  });

  // End of duty row (Only operating user signature, no operations head)
  const endDesc = [
    `End of Monitoring Duty ${data.finalOfficer || 'Duty Officer'}`,
    `24-Hour Operational Cycle: ${data.totalShiftsCount} Shifts Combined`,
    data.finalHandoverStatus || 'Situation Remain Normal',
  ];
  drawSignatureRow(
    '2359H',
    endDesc,
    'Info',
    data.finalOfficer || 'Lead Operations Officer',
    data.finalOfficerRole || 'Lead Operations Officer',
    signatureBase64
  );

  // Security Digest
  y += 4;
  checkPageBreak(10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Official Tamper-Proof Audit Digest (SHA-256): ${data.fileHash}`, 14, y);

  doc.setDocumentProperties({
    title: data.filename,
    subject: `Daily Operations Log ${data.dailyReportDate}`,
    author: data.finalOfficer,
    creator: 'PDRRMO Monitoring & Logging System',
    keywords: JSON.stringify(data.snapshotPayload || {}),
  });

  const blob = doc.output('blob');
  return {
    blob,
    sizeBytes: blob.size,
    hash: data.fileHash,
  };
}
