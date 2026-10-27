import { jsPDF } from 'jspdf';
import { supabase } from './supabase/client';
import { CAPITOL_LOGO_BASE64, PDRRMO_LOGO_BASE64, BAGONG_PILIPINAS_LOGO_BASE64 } from './header-logos';

export type PaperSize = 'a4' | 'short' | 'legal' | 'folio';
export type RollCallTemplateType = 'official_table' | 'net_calling';

export const PAPER_DIMENSIONS: Record<PaperSize, { width: number; height: number; label: string; shortLabel: string }> = {
  a4: { width: 210, height: 297, label: 'A4 (210 × 297 mm)', shortLabel: 'A4' },
  short: { width: 215.9, height: 279.4, label: 'Short / Letter (8.5 × 11 in)', shortLabel: 'SHORT' },
  folio: { width: 215.9, height: 330.2, label: 'Folio / Long (8.5 × 13 in)', shortLabel: 'FOLIO' },
  legal: { width: 215.9, height: 355.6, label: 'Legal (8.5 × 14 in)', shortLabel: 'LEGAL' },
};

export const CANONICAL_CEBU_LGUS: Array<{ name: string; hasPort: boolean; portName?: string }> = [
  { name: 'ALCANTARA', hasPort: false },
  { name: 'ALCOY', hasPort: false },
  { name: 'ALEGRIA', hasPort: false },
  { name: 'ALOGUINSAN', hasPort: false },
  { name: 'ARGAO', hasPort: true, portName: 'Taloot port' },
  { name: 'ASTURIAS', hasPort: false },
  { name: 'BADIAN', hasPort: false },
  { name: 'BALAMBAN', hasPort: false },
  { name: 'BANTAYAN', hasPort: true, portName: 'Bantayan port' },
  { name: 'BARILI', hasPort: false },
  { name: 'BOGO', hasPort: true, portName: 'Polambato port' },
  { name: 'BOLJOON', hasPort: false },
  { name: 'BORBON', hasPort: false },
  { name: 'CARCAR CITY', hasPort: false },
  { name: 'CARMEN', hasPort: true, portName: 'Isabel leyte port' },
  { name: 'CATMON', hasPort: false },
  { name: 'CEBU CITY', hasPort: false },
  { name: 'COMPOSTELA', hasPort: false },
  { name: 'CONSOLACION', hasPort: false },
  { name: 'CORDOVA', hasPort: true, portName: 'Cordova port' },
  { name: 'DAANBANTAYAN', hasPort: true, portName: 'Malapascua port' },
  { name: 'DALAGUETE', hasPort: false },
  { name: 'DANAO', hasPort: true, portName: 'Danao port' },
  { name: 'DUMANJUG', hasPort: true, portName: 'Tangil port' },
  { name: 'GINATILAN', hasPort: false },
  { name: 'LAPU LAPU CITY', hasPort: true, portName: 'Lapu_Lapu Port' },
  { name: 'LILOAN', hasPort: true, portName: 'pier 88' },
  { name: 'MADRIDEJOS', hasPort: false },
  { name: 'MALABUYOC', hasPort: false },
  { name: 'MANDAUE CITY', hasPort: false },
  { name: 'MEDELLIN', hasPort: true, portName: 'Medellin port' },
  { name: 'MINGLANILLA', hasPort: false },
  { name: 'MOALBOAL', hasPort: false },
  { name: 'NAGA CITY', hasPort: false },
  { name: 'OSLOB', hasPort: true, portName: 'Oslob port' },
  { name: 'PILAR', hasPort: true, portName: 'Pilar port' },
  { name: 'PINAMUNGAJAN', hasPort: false },
  { name: 'PORO', hasPort: true, portName: 'Poro port' },
  { name: 'RONDA', hasPort: false },
  { name: 'SAMBOAN', hasPort: true, portName: 'Bato port' },
  { name: 'SAN FERNANDO', hasPort: false },
  { name: 'SAN FRANCISCO', hasPort: true, portName: 'Consuelo port' },
  { name: 'SAN REMIGIO', hasPort: true, portName: 'Hagnaya port' },
  { name: 'SANTA FE', hasPort: true, portName: 'Santa Fe port' },
  { name: 'SANTANDER', hasPort: true, portName: 'liloan port' },
  { name: 'SIBONGA', hasPort: false },
  { name: 'SOGOD', hasPort: false },
  { name: 'TABOGON', hasPort: false },
  { name: 'TABUELAN', hasPort: true, portName: 'Tabuelan port' },
  { name: 'TALISAY', hasPort: false },
  { name: 'TOLEDO CITY', hasPort: true, portName: 'Toledo city port' },
  { name: 'TUBURAN', hasPort: true, portName: 'Tuburan Port' },
  { name: 'TUDELA', hasPort: true, portName: 'Jagutapay Port' },
];

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
  paperSize?: PaperSize;
  templateType?: RollCallTemplateType;
}

export interface DailyLogShiftItem {
  shiftLabel: string;
  startTime: string;
  endTime: string;
  leadOfficer: string;
  leadOfficerRole?: string;
  handoverStatus: string;
  incidentDetails?: string | null;
  monitoringBriefing?: string | null;
  roster: Array<{ name: string; role: string; badgeNumber?: string }>;
  standbyVehicles?: Array<{ name: string; count: number }>;
  signatures?: Array<{ name: string; title?: string; signatureUrl?: string }>;
  signatureUrl?: string | null;
  signatureBase64?: string | null;
  logsCount: number;
}

export interface DailyLogEntryItem {
  id?: string;
  time: string;
  date?: string;
  created_at?: string;
  status: string;
  title: string;
  reportType?: string;
  description: string;
  operator: string;
  operator_id?: string;
  operatorRole?: string;
  signatureUrl?: string | null;
  signatureBase64?: string | null;
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
  signaturesMap?: Record<string, string>;
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
 * Sanitizes and cleans text for standard jsPDF Helvetica font:
 * 1. Converts HTML block breaks (<p>, <li>, <br>, headings) into spaces or newlines.
 * 2. Decodes HTML entities (&nbsp;, &amp;, &lt;, &gt;, &quot;, &#39;, &bull;, etc.).
 * 3. Strips emojis, pictographs, surrogate pairs, and non-Latin-1 characters that cause mojibake.
 * 4. Normalizes multiple spaces and trims.
 */
export function sanitizePdfText(input: string | null | undefined): string {
  if (!input) return '';

  let text = String(input);

  // 1. Replace block tags and breaks with newlines or spaces
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  // 2. Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&bull;/gi, '•')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–');

  // 3. Remove Unicode emojis & non-printable symbols (which corrupt Helvetica in jsPDF)
  // jsPDF standard font supports WinAnsi / Latin-1 (0x20 - 0x7E, 0xA0 - 0xFF)
  text = text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{200D}\u{FE0E}\u{FE0F}\u{E0020}-\u{E007F}\u{E0001}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''); // Surrogate pairs

  // 4. Normalize multiple spaces and clean up lines
  const lines = text
    .split('\n')
    .map((line) => line.replace(/[^\x20-\x7E\xA0-\xFF\u2022\u2013\u2014]/g, '').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);

  return lines.join('\n');
}

/**
 * Draws the official document header with dual logos matching Template-Example-FileFormat-MLS.docx
 */
function drawDocumentHeader(doc: jsPDF, title: string, pageNumber: number, totalPages: number = 1): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Draw Left Logo (Capitol / Province of Cebu Seal) - 21x21 mm
  try {
    if (CAPITOL_LOGO_BASE64) {
      doc.addImage(CAPITOL_LOGO_BASE64, 'PNG', 14, 8, 21, 21);
    }
  } catch (err) {
    console.warn('Could not draw Capitol logo:', err);
  }

  // Draw Right Logo (PDRRMO Logo) - 21x21 mm
  try {
    if (PDRRMO_LOGO_BASE64) {
      doc.addImage(PDRRMO_LOGO_BASE64, 'PNG', pageWidth - 14 - 21, 8, 21, 21);
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
 * Formats a session time string (e.g., "1600H", "16:00", "4:00 PM") into a clean Net Call hour label (e.g., "4PM")
 */
export function formatNetCallHourLabel(timeStr?: string): string {
  if (!timeStr) return '4PM';
  const raw = timeStr.trim().toUpperCase();
  if (raw.includes('1600') || raw.includes('16:00') || raw === '4PM' || raw === '4:00 PM' || raw === '04:00 PM') return '4PM';
  if (raw.includes('0800') || raw.includes('08:00') || raw === '8AM' || raw === '8:00 AM' || raw === '08:00 AM') return '8AM';
  if (raw.includes('1200') || raw.includes('12:00') || raw === '12NN' || raw === '12PM') return '12NN';
  if (raw.includes('2000') || raw.includes('20:00') || raw === '8PM' || raw === '8:00 PM') return '8PM';
  return raw;
}

/**
 * Normalizes and merges provided station entries into the full 53-LGU Cebu Net Calling list
 */
export function buildNetCallingStationList(rawEntries: RollCallStationItem[]): RollCallStationItem[] {
  const norm = (s: string) =>
    (s || '')
      .toUpperCase()
      .replace(/[-_]/g, ' ')
      .replace(/\bCITY\b/g, '')
      .replace(/\bSTATION\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const entryMap = new Map<string, RollCallStationItem>();
  (rawEntries || []).forEach((item) => {
    const key = norm(item.name);
    if (key) {
      entryMap.set(key, item);
    }
  });

  return CANONICAL_CEBU_LGUS.map((canon) => {
    const key = norm(canon.name);
    const matched = entryMap.get(key);
    const hasPort = matched?.hasPort !== undefined ? Boolean(matched.hasPort || canon.hasPort) : canon.hasPort;
    const portName =
      matched?.portName && matched.portName !== 'None' && matched.portName !== 'N/A'
        ? matched.portName
        : canon.portName;

    return {
      name: canon.name,
      code: matched?.code,
      attendance: matched?.attendance ?? null,
      weatherStatus: matched?.weatherStatus ?? null,
      portStatus: matched?.portStatus ?? null,
      hasPort,
      portName,
      timeResponded: matched?.timeResponded ?? null,
      dutyOperator: matched?.dutyOperator ?? undefined,
    };
  });
}

/**
 * Generates the 2-Column Single-Page "FOR NET CALL - PDRRMO OPCEN" PDF matching For NET CALLING.pdf
 * Optimized for A4, SHORT (Letter), FOLIO (8.5x13), and LEGAL (8.5x14) paper sizes.
 */
export async function generateNetCallingPDF(
  data: RollCallPdfData,
  options?: { paperSize?: PaperSize }
): Promise<{ blob: Blob; sizeBytes: number; hash: string }> {
  const paperSize: PaperSize = options?.paperSize || data.paperSize || 'a4';
  const dim = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.a4;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [dim.width, dim.height],
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Adaptive vertical & typography metrics per paper size
  const isShort = paperSize === 'short';
  const isA4 = paperSize === 'a4';
  const isFolio = paperSize === 'folio';
  const isLegal = paperSize === 'legal';

  const marginX = isA4 ? 10 : 11;
  const marginTop = isShort ? 5.5 : isA4 ? 6.5 : isFolio ? 8.5 : 10;
  const logoSize = isShort ? 17.5 : isA4 ? 19 : isFolio ? 21 : 22;
  const headerH = logoSize + (isShort ? 2.5 : isA4 ? 3 : 4);
  const footerReserveH = isShort ? 19.5 : isA4 ? 22 : isFolio ? 27 : 31;

  // 1. HEADER: Capitol Seal + PDRRMO Seal (Left), Title (Center), Bagong Pilipinas (Right)
  const logoY = marginTop;
  try {
    if (CAPITOL_LOGO_BASE64) {
      doc.addImage(CAPITOL_LOGO_BASE64, 'PNG', marginX + 2, logoY, logoSize, logoSize);
    }
  } catch (err) {
    console.warn('Could not draw Capitol logo:', err);
  }

  try {
    if (PDRRMO_LOGO_BASE64) {
      doc.addImage(PDRRMO_LOGO_BASE64, 'PNG', marginX + 2 + logoSize + 2.5, logoY, logoSize, logoSize);
    }
  } catch (err) {
    console.warn('Could not draw PDRRMO logo:', err);
  }

  try {
    if (BAGONG_PILIPINAS_LOGO_BASE64) {
      const bpW = logoSize * 1.07;
      const bpH = logoSize;
      doc.addImage(BAGONG_PILIPINAS_LOGO_BASE64, 'PNG', pageWidth - marginX - 10 - bpW, logoY, bpW, bpH);
    }
  } catch (err) {
    console.warn('Could not draw Bagong Pilipinas logo:', err);
  }

  // Center Title ("FOR NET CALL / PDRRMO OPCEN")
  const titleFontSize = isShort ? 13.5 : isA4 ? 14.5 : 15.5;
  doc.setFont('times', 'bold');
  doc.setFontSize(titleFontSize);
  doc.setTextColor(15, 23, 42);
  const centerTitleX = pageWidth / 2 + 4;
  doc.text('FOR NET CALL', centerTitleX, logoY + logoSize * 0.42, { align: 'center' });
  doc.text('PDRRMO OPCEN', centerTitleX, logoY + logoSize * 0.78, { align: 'center' });

  // 2. PREPARE 53 STATIONS LIST (1-26 Left, 27-53 Right)
  const rawInputEntries: RollCallStationItem[] = (
    data.entries && data.entries.length > 0
      ? data.entries
      : data.snapshotPayload?.entries || data.snapshotPayload?.records || []
  ).map((stn: any) => ({
    name: stn.name || stn.area_name || stn.municipality || 'Station',
    code: stn.code || stn.area_code,
    attendance: stn.attendance || stn.status || null,
    weatherStatus: stn.weatherStatus || stn.weather_status || stn.weather || null,
    portStatus: stn.portStatus || stn.port_status || stn.port || null,
    hasPort: stn.hasPort,
    portName: stn.portName || stn.port_name,
    timeResponded: stn.timeResponded || stn.time_responded || stn.time,
    dutyOperator: stn.dutyOperator || stn.duty_operator,
  }));

  const allStations = buildNetCallingStationList(rawInputEntries);
  const leftStations = allStations.slice(0, 26); // 1 to 26 (ALCANTARA to LAPU LAPU CITY)
  const rightStations = allStations.slice(26, 53); // 27 to 53 (LILOAN to TUDELA)

  // Column horizontal geometry
  const centerGap = isA4 ? 10 : 12;
  const colTableWidth = (pageWidth - marginX * 2 - centerGap) / 2;
  const leftTableX = marginX;
  const rightTableX = marginX + colTableWidth + centerGap;

  // Sub-columns inside each table: # | LEAGUE OF DRRMO'S | ✔ | ✖
  const wNum = 7.5;
  const wCheck = 10.5;
  const wCross = 10.5;
  const wStation = colTableWidth - wNum - wCheck - wCross;

  const bodyStartY = marginTop + headerH;
  const bodyAvailableH = pageHeight - bodyStartY - footerReserveH;

  // 3. INTRO TEXT BLOCK (Top of Left Column)
  const netHourLabel = formatNetCallHourLabel(data.sessionTime);
  const rawOfficer = sanitizePdfText(data.conductedBy || '');
  const officerDisplay =
    rawOfficer && rawOfficer.toLowerCase() !== 'monitoring officer'
      ? rawOfficer.toUpperCase()
      : '(STATE YOUR NAME)';

  const introFontSize = isShort ? 7.8 : isA4 ? 8.2 : 8.8;
  const introLineH = isShort ? 3.3 : isA4 ? 3.55 : isFolio ? 3.9 : 4.1;
  const introBlockH = introLineH * 4 + (isShort ? 1.5 : 2.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(introFontSize);
  doc.setTextColor(15, 23, 42);

  let introY = bodyStartY + introLineH * 0.85;
  doc.text('ATTENTION ALL STATIONS, PLEASE DO STANDBY', leftTableX, introY);
  introY += introLineH;

  // Line 2 with bold "4PM" and bold "(STATE YOUR"
  doc.setFont('helvetica', 'normal');
  doc.text(`FOR THE ${netHourLabel} NET CALL. THIS IS `, leftTableX, introY);
  const prefixW = doc.getTextWidth(`FOR THE ${netHourLabel} NET CALL. THIS IS `);
  doc.setFont('helvetica', 'bold');
  const nameTokens = officerDisplay.split(' ');
  const firstPartName = nameTokens.length > 2 ? nameTokens.slice(0, 2).join(' ') : officerDisplay;
  const secondPartName = nameTokens.length > 2 ? nameTokens.slice(2).join(' ') : '';
  doc.text(firstPartName, leftTableX + prefixW, introY);
  introY += introLineH;

  // Line 3
  let line3Offset = 0;
  if (secondPartName) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${secondPartName}, `, leftTableX, introY);
    line3Offset = doc.getTextWidth(`${secondPartName}, `);
  }
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${secondPartName ? '' : ', '}YOUR OPCEN MONITORING PERSONNEL`.replace(/^,\s*/, secondPartName ? '' : ''),
    leftTableX + line3Offset,
    introY
  );
  introY += introLineH;

  // Line 4
  doc.text('ON DUTY. LET US START WITH LGU', leftTableX, introY);

  // Vector icon helpers for Checkmark (✔) and Cross (✖)
  const drawCheckmarkVector = (
    cx: number,
    cy: number,
    size: number,
    color: [number, number, number] = [22, 101, 52],
    lineW = 0.55
  ) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(lineW);
    doc.line(cx - size * 0.45, cy + size * 0.05, cx - size * 0.1, cy + size * 0.42);
    doc.line(cx - size * 0.1, cy + size * 0.42, cx + size * 0.48, cy - size * 0.42);
  };

  const drawCrossVector = (
    cx: number,
    cy: number,
    size: number,
    color: [number, number, number] = [185, 28, 28],
    lineW = 0.55
  ) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(lineW);
    const r = size * 0.36;
    doc.line(cx - r, cy - r, cx + r, cy + r);
    doc.line(cx + r, cy - r, cx - r, cy + r);
  };

  // 4. LEFT TABLE HEADER (# | LEAGUE OF DRRMO'S | ✔ | ✖)
  const tableHeaderH = isShort ? 4.4 : isA4 ? 4.8 : isFolio ? 5.2 : 5.5;
  const leftTableStartY = bodyStartY + introBlockH;

  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.22);
  doc.rect(leftTableX, leftTableStartY, colTableWidth, tableHeaderH, 'S');
  doc.line(leftTableX + wNum, leftTableStartY, leftTableX + wNum, leftTableStartY + tableHeaderH);
  doc.line(leftTableX + wNum + wStation, leftTableStartY, leftTableX + wNum + wStation, leftTableStartY + tableHeaderH);
  doc.line(
    leftTableX + wNum + wStation + wCheck,
    leftTableStartY,
    leftTableX + wNum + wStation + wCheck,
    leftTableStartY + tableHeaderH
  );

  const cellFontSize = isShort ? 6.0 : isA4 ? 6.35 : isFolio ? 6.8 : 7.1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(cellFontSize);
  doc.setTextColor(15, 23, 42);
  doc.text('#', leftTableX + wNum / 2, leftTableStartY + tableHeaderH * 0.72, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text("LEAGUE OF DRRMO'S", leftTableX + wNum + 1.5, leftTableStartY + tableHeaderH * 0.72);

  // Header ✔ and ✖ icons
  drawCheckmarkVector(
    leftTableX + wNum + wStation + wCheck / 2,
    leftTableStartY + tableHeaderH / 2,
    2.6,
    [30, 41, 59],
    0.45
  );
  drawCrossVector(
    leftTableX + wNum + wStation + wCheck + wCross / 2,
    leftTableStartY + tableHeaderH / 2,
    2.6,
    [15, 23, 42],
    0.55
  );

  // Helper to compute line units for a station row (3 if has port, 2 if no port, except Cebu City = 1.4)
  const getStationUnits = (stn: RollCallStationItem): number => {
    if (stn.hasPort && stn.portName) return 3.0;
    if (stn.name.toUpperCase() === 'CEBU CITY' && !stn.weatherStatus) return 1.45;
    return 2.05;
  };

  // Compute exact proportional row heights for Left Column & Right Column so both align at bodyStartY + bodyAvailableH
  const leftRowsAvailableH = bodyAvailableH - introBlockH - tableHeaderH;
  const totalLeftUnits = leftStations.reduce((acc, s) => acc + getStationUnits(s), 0);
  const leftUnitH = leftRowsAvailableH / totalLeftUnits;

  const rightRowsAvailableH = bodyAvailableH;
  const totalRightUnits = rightStations.reduce((acc, s) => acc + getStationUnits(s), 0);
  const rightUnitH = rightRowsAvailableH / totalRightUnits;

  // Row drawer function
  const drawStationColumn = (
    stations: RollCallStationItem[],
    startIndex: number,
    tableX: number,
    startY: number,
    unitH: number
  ) => {
    let curY = startY;

    stations.forEach((stn, idx) => {
      const stnNumber = startIndex + idx;
      const units = getStationUnits(stn);
      const rowH = units * unitH;

      // Cell borders
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.2);
      doc.rect(tableX, curY, colTableWidth, rowH, 'S');
      doc.line(tableX + wNum, curY, tableX + wNum, curY + rowH);
      doc.line(tableX + wNum + wStation, curY, tableX + wNum + wStation, curY + rowH);
      doc.line(tableX + wNum + wStation + wCheck, curY, tableX + wNum + wStation + wCheck, curY + rowH);

      const isSingleLine = stn.name.toUpperCase() === 'CEBU CITY' && !stn.weatherStatus && !stn.hasPort;
      const hasPortLine = Boolean(stn.hasPort && stn.portName);
      const lineCount = isSingleLine ? 1 : hasPortLine ? 3 : 2;
      const lineStep = rowH / (lineCount + 0.35);

      // Col 1: Station Number (#)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(cellFontSize);
      doc.setTextColor(15, 23, 42);
      const numY =
        lineCount === 3
          ? curY + lineStep * 2.05
          : lineCount === 2
          ? curY + lineStep * 1.1
          : curY + rowH * 0.68;
      doc.text(String(stnNumber), tableX + wNum / 2, numY, { align: 'center' });

      // Col 2: Station Name + Weather + Optional Port
      const textX = tableX + wNum + 1.5;
      let textY = curY + lineStep * 0.98;

      // Line 1: Station Name (Bold Uppercase)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(cellFontSize);
      doc.setTextColor(15, 23, 42);
      doc.text(sanitizePdfText(stn.name.toUpperCase()), textX, textY);

      const isPresent = stn.attendance === 'Present';
      const isAbsent = stn.attendance === 'Absent';
      const isExempted = stn.attendance === 'Exempted';

      // Line 2: Weather
      if (!isSingleLine) {
        textY += lineStep;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cellFontSize - 0.15);
        doc.setTextColor(15, 23, 42);
        doc.text('Weather:', textX, textY);

        if (isPresent && stn.weatherStatus && stn.weatherStatus !== 'N/A' && stn.weatherStatus !== 'None') {
          const lblW = doc.getTextWidth('Weather: ');
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
          doc.text(sanitizePdfText(stn.weatherStatus), textX + lblW, textY);
        }
      }

      // Line 3: Port (if coastal station with port)
      if (hasPortLine && stn.portName) {
        textY += lineStep;
        const cleanPortLabel = stn.portName.endsWith(':')
          ? stn.portName
          : stn.name.toUpperCase() === 'ARGAO'
          ? stn.portName
          : `${stn.portName}:`;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cellFontSize - 0.2);
        doc.setTextColor(15, 23, 42);
        doc.text(sanitizePdfText(cleanPortLabel), textX, textY);

        if (isPresent && stn.portStatus && stn.portStatus !== 'N/A' && stn.portStatus !== 'None') {
          const portLblW = doc.getTextWidth(`${sanitizePdfText(cleanPortLabel)} `);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
          doc.text(sanitizePdfText(stn.portStatus), textX + portLblW, textY);
        }
      }

      // Col 3 (✔) & Col 4 (✖)
      const checkCenterX = tableX + wNum + wStation + wCheck / 2;
      const crossCenterX = tableX + wNum + wStation + wCheck + wCross / 2;
      const iconCenterY = curY + rowH / 2;
      const iconSize = Math.min(2.8, rowH * 0.35);

      if (isPresent) {
        drawCheckmarkVector(checkCenterX, iconCenterY, iconSize, [22, 101, 52], 0.55);
      } else if (isAbsent) {
        drawCrossVector(crossCenterX, iconCenterY, iconSize, [185, 28, 28], 0.55);
      } else if (isExempted) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cellFontSize - 0.5);
        doc.setTextColor(180, 83, 9);
        doc.text('EX', checkCenterX, iconCenterY + 0.8, { align: 'center' });
      }

      curY += rowH;
    });

    return curY;
  };

  // Draw Left Column (1 to 26) and Right Column (27 to 53)
  const leftEndY = drawStationColumn(leftStations, 1, leftTableX, leftTableStartY + tableHeaderH, leftUnitH);
  const rightEndY = drawStationColumn(rightStations, 27, rightTableX, bodyStartY, rightUnitH);

  // 5. FOOTER: Closing Script & Sign-off Block
  const footerStartY = Math.max(leftEndY, rightEndY) + (isShort ? 3.2 : isA4 ? 4.0 : isFolio ? 5.5 : 6.5);
  const footerX = leftTableX + 12;
  const footerFontSize = isShort ? 6.5 : isA4 ? 7.0 : 7.5;
  const footerLineH = isShort ? 3.1 : isA4 ? 3.5 : 4.0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(footerFontSize);
  doc.setTextColor(15, 23, 42);

  // Line 1: FOR CLOSING: That ends our 4PM Net Call,
  const closePrefix = 'FOR CLOSING: That ends our ';
  doc.text(closePrefix, footerX, footerStartY);
  const closePrefixW = doc.getTextWidth(closePrefix);
  doc.setFont('helvetica', 'bold');
  doc.text(netHourLabel, footerX + closePrefixW, footerStartY);
  const hourW = doc.getTextWidth(netHourLabel);
  doc.line(footerX + closePrefixW, footerStartY + 0.5, footerX + closePrefixW + hourW, footerStartY + 0.5);
  doc.setFont('helvetica', 'normal');
  doc.text(' Net Call,', footerX + closePrefixW + hourW, footerStartY);

  // Line 2: Once again this is your net controller (state your name). Please do standby for any possible Contact. Thank You. Amping Tanan!
  const closeLine2Y = footerStartY + footerLineH;
  const controllerLabel =
    rawOfficer && rawOfficer.toLowerCase() !== 'monitoring officer' ? rawOfficer : '(state your name)';
  doc.text(
    `Once again this is your net controller ${controllerLabel}. Please do standby for any possible Contact. Thank You. Amping Tanan!`,
    footerX,
    closeLine2Y
  );

  // Sign-off row: ON DUTY PERSONNEL : _______________________   Time/Date : _______________________________
  const signRowY = closeLine2Y + (isShort ? 5.2 : isA4 ? 6.2 : isFolio ? 8.0 : 9.0);
  const signFontSize = isShort ? 7.5 : isA4 ? 8.0 : 8.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(signFontSize);
  doc.setTextColor(15, 23, 42);

  const dutyLabel = 'ON DUTY PERSONNEL : ';
  doc.text(dutyLabel, footerX, signRowY);
  const dutyLabelW = doc.getTextWidth(dutyLabel);
  const dutyLineStartX = footerX + dutyLabelW + 1;
  const dutyLineEndX = dutyLineStartX + 46;

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(dutyLineStartX, signRowY + 0.6, dutyLineEndX, signRowY + 0.6);

  // Render Officer Name on the line if provided
  if (rawOfficer) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(signFontSize - 0.5);
    doc.text(rawOfficer.toUpperCase(), (dutyLineStartX + dutyLineEndX) / 2, signRowY - 0.4, { align: 'center' });
  }

  // Render Time/Date field
  const timeDateX = rightTableX + 6;
  const timeDateLabel = 'Time/Date : ';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(signFontSize);
  doc.text(timeDateLabel, timeDateX, signRowY);
  const timeDateLabelW = doc.getTextWidth(timeDateLabel);
  const tdLineStartX = timeDateX + timeDateLabelW + 1;
  const tdLineEndX = pageWidth - marginX - 4;

  doc.line(tdLineStartX, signRowY + 0.6, tdLineEndX, signRowY + 0.6);

  const formattedDateTime = `${formatHeaderDate(data.sessionDate)} · ${data.sessionTime || '1600H'}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(signFontSize - 0.5);
  doc.text(sanitizePdfText(formattedDateTime), (tdLineStartX + tdLineEndX) / 2, signRowY - 0.4, { align: 'center' });

  // Subtle SHA-256 Digest watermark at bottom edge
  if (data.fileHash) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Certified Net Call Sheet (${dim.shortLabel}) · SHA-256: ${data.fileHash}`,
      pageWidth / 2,
      pageHeight - 2.2,
      { align: 'center' }
    );
  }

  doc.setDocumentProperties({
    title: data.filename,
    subject: `PDRRMO OPCEN Net Call Sheet (${dim.shortLabel}) - ${data.sessionDate}`,
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
 * Generates an official certified PDF for Roll Call following either:
 * - 'official_table' (Template-Example-FileFormat-MLS.docx)
 * - 'net_calling' (For NET CALLING.pdf 2-Column Single-Page Sheet)
 * Supports A4, SHORT, FOLIO, and LEGAL paper sizes.
 */
export async function generateRollCallPDF(data: RollCallPdfData): Promise<{ blob: Blob; sizeBytes: number; hash: string }> {
  if (data.templateType === 'net_calling') {
    return generateNetCallingPDF(data, { paperSize: data.paperSize });
  }

  const paperSize: PaperSize = data.paperSize || 'a4';
  const dim = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.a4;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [dim.width, dim.height],
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
    // Process and wrap description lines
    const processedLines: { text: string; isBold: boolean; color: [number, number, number] }[] = [];

    descLines.forEach((rawLine, idx) => {
      const sanitized = sanitizePdfText(rawLine);
      if (!sanitized) return;

      const subLines = sanitized.split('\n');
      subLines.forEach((sub, subIdx) => {
        doc.setFont('helvetica', idx === 0 && subIdx === 0 ? 'bold' : 'normal');
        doc.setFontSize(7.5);
        const wrapped = doc.splitTextToSize(sub, colDescW - 6);
        const lineArray = Array.isArray(wrapped) ? wrapped : [wrapped];
        lineArray.forEach((wLine: string) => {
          processedLines.push({
            text: wLine,
            isBold: idx === 0 && subIdx === 0,
            color: idx === 0 && subIdx === 0 ? [15, 23, 42] : [51, 65, 85],
          });
        });
      });
    });

    const lineHeight = 4.0;
    const computedHeight = Math.max(1, processedLines.length) * lineHeight + 6;
    const rowHeight = Math.max(customMinHeight, Math.max(12, computedHeight));
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
    doc.text(sanitizePdfText(timeStr || data.sessionTime || '1600H'), col1X + colTimeW / 2, y + 5.5, { align: 'center' });

    // Col 2: Title w/ Description
    let lineY = y + 5;
    processedLines.forEach((lineObj) => {
      doc.setFont('helvetica', lineObj.isBold ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(lineObj.color[0], lineObj.color[1], lineObj.color[2]);
      doc.text(lineObj.text, col2X + 3, lineY);
      lineY += lineHeight;
    });

    // Col 3: Attendance / Status
    const cleanReportType = sanitizePdfText(reportType);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    if (cleanReportType === 'Present') {
      doc.setTextColor(22, 101, 52); // Dark Green
    } else if (cleanReportType === 'Absent') {
      doc.setTextColor(185, 28, 28); // Dark Red
    } else if (cleanReportType === 'Exempted') {
      doc.setTextColor(180, 83, 9); // Dark Amber
    } else {
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
    }
    doc.text(cleanReportType || '—', col3X + colTypeW / 2, y + 5.5, { align: 'center' });

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
    const processedLines: { text: string; isBold: boolean; color: [number, number, number] }[] = [];

    descLines.forEach((rawLine, idx) => {
      const sanitized = sanitizePdfText(rawLine);
      if (!sanitized) return;

      const subLines = sanitized.split('\n');
      subLines.forEach((sub, subIdx) => {
        doc.setFont('helvetica', idx === 0 && subIdx === 0 ? 'bold' : 'normal');
        doc.setFontSize(7.5);
        const wrapped = doc.splitTextToSize(sub, colDescW - 6);
        const lineArray = Array.isArray(wrapped) ? wrapped : [wrapped];
        lineArray.forEach((wLine: string) => {
          processedLines.push({
            text: wLine,
            isBold: idx === 0 && subIdx === 0,
            color: idx === 0 && subIdx === 0 ? [15, 23, 42] : [51, 65, 85],
          });
        });
      });
    });

    const lineHeight = 4.0;
    const textLinesHeight = Math.max(1, processedLines.length) * lineHeight + 4;
    const sigSpaceHeight = 10;
    const sigTextHeight = 10;
    const rowHeight = Math.max(34, textLinesHeight + sigSpaceHeight + sigTextHeight + 4);

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
    doc.text(sanitizePdfText(timeStr || data.sessionTime || '1600H'), col1X + colTimeW / 2, y + 5.5, { align: 'center' });

    // Col 2: Title w/ Description
    let lineY = y + 5;
    processedLines.forEach((lineObj) => {
      doc.setFont('helvetica', lineObj.isBold ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(lineObj.color[0], lineObj.color[1], lineObj.color[2]);
      doc.text(lineObj.text, col2X + 3, lineY);
      lineY += lineHeight;
    });

    lineY += 9; // Space for physical in-person signing

    // Signature line
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.3);
    doc.line(col2X + 3, lineY, col2X + 55, lineY);
    lineY += 3.6;

    // Officer Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(officerName || 'Duty Operations Officer'), col2X + 3, lineY);
    lineY += 3.2;

    // Officer Role / Title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(officerRole || 'Duty Operations Officer'), col2X + 3, lineY);

    // Col 3: Attendance (Only rendered if an attendance status is specified)
    const cleanReportType = sanitizePdfText(reportType);
    if (cleanReportType && cleanReportType !== '—') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      if (cleanReportType === 'Present') {
        doc.setTextColor(22, 101, 52); // Dark Green
      } else if (cleanReportType === 'Absent') {
        doc.setTextColor(185, 28, 28); // Dark Red
      } else if (cleanReportType === 'Exempted') {
        doc.setTextColor(180, 83, 9); // Dark Amber
      } else {
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
      }
      doc.text(cleanReportType, col3X + colTypeW / 2, y + 5.5, { align: 'center' });
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
  const stationEntries: RollCallStationItem[] = (
    data.entries && data.entries.length > 0
      ? data.entries
      : data.snapshotPayload?.entries || data.snapshotPayload?.records || []
  ).map((stn: any) => ({
    name: stn.name || stn.area_name || stn.municipality || 'Station',
    code: stn.code || stn.area_code,
    attendance: stn.attendance || stn.status || 'Present',
    weatherStatus: stn.weatherStatus || stn.weather_status || stn.weather || 'Fair',
    portStatus: stn.portStatus || stn.port_status || stn.port || 'Operational',
    hasPort: stn.hasPort,
    portName: stn.portName || stn.port_name,
    timeResponded: stn.timeResponded || stn.time_responded || stn.time,
    dutyOperator: stn.dutyOperator || stn.duty_operator || 'Station Duty Officer',
  }));

  stationEntries.forEach((stn) => {
    const attendanceStatus = stn.attendance || 'Present';
    const isInactive = attendanceStatus === 'Absent' || attendanceStatus === 'Exempted';
    const weather = isInactive ? `N/A (${attendanceStatus})` : (stn.weatherStatus || 'Fair');
    const port = isInactive ? `N/A (${attendanceStatus})` : (!stn.hasPort ? 'No Port (Inland)' : (stn.portStatus || 'Operational'));
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

// Helper: Sort logs chronologically across operational shifts and 24-hour cycles
export function sortLogsChronologically<T extends { time?: string; log_time?: string; date?: string; log_date?: string; created_at?: string }>(
  logs: T[],
  cycleStartTime?: string
): T[] {
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
    // 1. If created_at ISO timestamp is available on both, it is the absolute true timeline
    if (a.created_at && b.created_at) {
      const dtA = new Date(a.created_at).getTime();
      const dtB = new Date(b.created_at).getTime();
      if (!isNaN(dtA) && !isNaN(dtB) && dtA !== dtB) {
        return dtA - dtB;
      }
    }

    // 2. If dates differ
    const dateA = a.date || a.log_date;
    const dateB = b.date || b.log_date;
    if (dateA && dateB && dateA !== dateB) {
      const dtA = new Date(dateA).getTime();
      const dtB = new Date(dateB).getTime();
      if (!isNaN(dtA) && !isNaN(dtB) && dtA !== dtB) {
        return dtA - dtB;
      }
    }

    // 3. Compare military time within operational cycle (e.g. 18:00 start cycle)
    const timeA = a.time || a.log_time;
    const timeB = b.time || b.log_time;
    const minA = parseTimeMin(timeA);
    const minB = parseTimeMin(timeB);

    const normA = (minA - cycleStartMin + 1440) % 1440;
    const normB = (minB - cycleStartMin + 1440) % 1440;

    return normA - normB;
  });
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

  // Date & Shift Info line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const shiftHeaderInfo = data.shifts?.[0]?.shiftLabel ? ` | Shift: ${data.shifts[0].shiftLabel}` : '';
  const shiftHoursInfo = data.shifts?.[0]?.startTime ? ` (${data.shifts[0].startTime} - ${data.shifts[0].endTime || ''})` : '';
  doc.text(`Date: ${formatHeaderDate(data.dailyReportDate)}${shiftHeaderInfo}${shiftHoursInfo}`, 14, y);
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
    const processedLines: { text: string; isBold: boolean; color: [number, number, number] }[] = [];

    descLines.forEach((rawLine, idx) => {
      const sanitized = sanitizePdfText(rawLine);
      if (!sanitized) return;

      const subLines = sanitized.split('\n');
      subLines.forEach((sub, subIdx) => {
        doc.setFont('helvetica', idx === 0 && subIdx === 0 ? 'bold' : 'normal');
        doc.setFontSize(7.5);
        const wrapped = doc.splitTextToSize(sub, colDescW - 6);
        const lineArray = Array.isArray(wrapped) ? wrapped : [wrapped];
        lineArray.forEach((wLine: string) => {
          processedLines.push({
            text: wLine,
            isBold: idx === 0 && subIdx === 0,
            color: idx === 0 && subIdx === 0 ? [15, 23, 42] : [51, 65, 85],
          });
        });
      });
    });

    const lineHeight = 4.0;
    const computedHeight = Math.max(1, processedLines.length) * lineHeight + 6;
    const rowHeight = Math.max(customMinHeight, Math.max(12, computedHeight));
    checkPageBreak(rowHeight);

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    doc.rect(col1X, y, tableWidth, rowHeight, 'S');
    doc.line(col2X, y, col2X, y + rowHeight);
    doc.line(col3X, y, col3X, y + rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(timeStr || '1200H'), col1X + colTimeW / 2, y + 5.5, { align: 'center' });

    let lineY = y + 5;
    processedLines.forEach((lineObj) => {
      doc.setFont('helvetica', lineObj.isBold ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(lineObj.color[0], lineObj.color[1], lineObj.color[2]);
      doc.text(lineObj.text, col2X + 3, lineY);
      lineY += lineHeight;
    });

    const cleanReportType = sanitizePdfText(reportType);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(cleanReportType || 'Info', col3X + colTypeW / 2, y + 5.5, { align: 'center' });

    y += rowHeight;
  };

  // Dedicated drawer for start/end rows with blank signature line for physical in-person signing
  const drawSignatureRow = (
    timeStr: string,
    descLines: string[],
    reportType: string,
    officerName: string,
    officerRole: string,
    _signatureImgBase64?: string | null
  ) => {
    const processedLines: { text: string; isBold: boolean; color: [number, number, number] }[] = [];

    descLines.forEach((rawLine, idx) => {
      const sanitized = sanitizePdfText(rawLine);
      if (!sanitized) return;

      const subLines = sanitized.split('\n');
      subLines.forEach((sub, subIdx) => {
        doc.setFont('helvetica', idx === 0 && subIdx === 0 ? 'bold' : 'normal');
        doc.setFontSize(7.5);
        const wrapped = doc.splitTextToSize(sub, colDescW - 6);
        const lineArray = Array.isArray(wrapped) ? wrapped : [wrapped];
        lineArray.forEach((wLine: string) => {
          processedLines.push({
            text: wLine,
            isBold: idx === 0 && subIdx === 0,
            color: idx === 0 && subIdx === 0 ? [15, 23, 42] : [51, 65, 85],
          });
        });
      });
    });

    const lineHeight = 4.0;
    const textLinesHeight = Math.max(1, processedLines.length) * lineHeight + 4;
    const sigSpaceHeight = 10;
    const sigTextHeight = 10;
    const rowHeight = Math.max(34, textLinesHeight + sigSpaceHeight + sigTextHeight + 4);

    checkPageBreak(rowHeight);

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    doc.rect(col1X, y, tableWidth, rowHeight, 'S');
    doc.line(col2X, y, col2X, y + rowHeight);
    doc.line(col3X, y, col3X, y + rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(timeStr || '1200H'), col1X + colTimeW / 2, y + 5.5, { align: 'center' });

    let lineY = y + 5;
    processedLines.forEach((lineObj) => {
      doc.setFont('helvetica', lineObj.isBold ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(lineObj.color[0], lineObj.color[1], lineObj.color[2]);
      doc.text(lineObj.text, col2X + 3, lineY);
      lineY += lineHeight;
    });

    lineY += 9; // Space for physical in-person signing

    // Signature line
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.3);
    doc.line(col2X + 3, lineY, col2X + 55, lineY);
    lineY += 3.6;

    // Officer Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(officerName || 'Lead Operations Officer'), col2X + 3, lineY);
    lineY += 3.2;

    // Officer Title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(officerRole || 'Lead Operations Officer'), col2X + 3, lineY);

    const cleanReportType = sanitizePdfText(reportType);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(cleanReportType || 'Info', col3X + colTypeW / 2, y + 5.5, { align: 'center' });

    y += rowHeight;
  };

  // Pre-resolve all signatures from profile, shifts, logs, and signaturesMap
  const signatureUrlSet = new Set<string>();
  if (data.signatureUrl) signatureUrlSet.add(data.signatureUrl);
  if (data.signaturesMap) {
    Object.values(data.signaturesMap).forEach((url) => {
      if (url && typeof url === 'string') signatureUrlSet.add(url);
    });
  }
  data.shifts?.forEach((s) => {
    if (s.signatureUrl) signatureUrlSet.add(s.signatureUrl);
  });
  data.logs?.forEach((l) => {
    if (l.signatureUrl) signatureUrlSet.add(l.signatureUrl);
  });

  const signatureCache = new Map<string, string>();
  await Promise.all(
    Array.from(signatureUrlSet).map(async (url) => {
      const base64 = await resolveSignatureBase64(url);
      if (base64) signatureCache.set(url, base64);
    })
  );

  const getOfficerSignature = (log: DailyLogEntryItem, officerName?: string): string | null => {
    if (log.signatureBase64) return log.signatureBase64;
    if (log.signatureUrl) {
      if (log.signatureUrl.startsWith('data:image/')) return log.signatureUrl;
      if (signatureCache.has(log.signatureUrl)) return signatureCache.get(log.signatureUrl)!;
    }
    if (officerName) {
      if (data.signaturesMap) {
        const mapped = data.signaturesMap[officerName] || data.signaturesMap[officerName.toLowerCase()];
        if (mapped) {
          if (mapped.startsWith('data:image/')) return mapped;
          if (signatureCache.has(mapped)) return signatureCache.get(mapped)!;
        }
      }
      const shiftMatch = data.shifts?.find(
        (s) => s.leadOfficer && s.leadOfficer.toLowerCase() === officerName.toLowerCase()
      );
      if (shiftMatch?.signatureBase64) return shiftMatch.signatureBase64;
      if (shiftMatch?.signatureUrl && signatureCache.has(shiftMatch.signatureUrl)) {
        return signatureCache.get(shiftMatch.signatureUrl)!;
      }
    }
    if (data.signatureBase64 && (!officerName || officerName.toLowerCase() === data.finalOfficer?.toLowerCase())) {
      return data.signatureBase64;
    }
    if (data.signatureUrl && signatureCache.has(data.signatureUrl)) {
      return signatureCache.get(data.signatureUrl)!;
    }
    return null;
  };

  const isDutyLifecycleLog = (log: DailyLogEntryItem) => {
    const title = (log.title || '').toLowerCase();
    return (
      title.includes('start of monitoring') ||
      title.includes('assume monitoring') ||
      title.includes('end of monitoring') ||
      title.includes('start of duty') ||
      title.includes('assume duty') ||
      title.includes('end of duty')
    );
  };

  const cycleStart = data.shifts?.[0]?.startTime || (data.logs?.[0]?.time ? data.logs[0].time : '0800H');
  const sortedLogs = sortLogsChronologically(data.logs || [], cycleStart);

  const hasStartDutyLog = sortedLogs.some((l) => {
    const t = (l.title || '').toLowerCase();
    return t.includes('start of monitoring') || t.includes('assume monitoring') || t.includes('start of duty');
  });

  const hasEndDutyLog = sortedLogs.some((l) => {
    const t = (l.title || '').toLowerCase();
    return t.includes('end of monitoring') || t.includes('end of duty');
  });

  // Fallback: If no start log exists in logs data, draw initial start duty row
  if (!hasStartDutyLog) {
    const firstShift = data.shifts && data.shifts[0];
    const startDesc: string[] = [
      `Start of Monitoring Duty, ${firstShift ? firstShift.leadOfficer : (data.finalOfficer || 'Duty Officer')}`,
      'Standby Vehicles: Pick up - 1, Ambulance - 1, Demo Items - 5',
    ];
    if (firstShift?.monitoringBriefing) {
      startDesc.push(`Monitoring Details & Briefing: ${firstShift.monitoringBriefing}`);
    }
    const officerName = firstShift?.leadOfficer || data.finalOfficer || 'Lead Operations Officer';
    const officerRole = firstShift?.leadOfficerRole || data.finalOfficerRole || 'Lead Operations Officer';
    const sigBase64 = getOfficerSignature({ time: '0800H', status: 'Info', title: '', description: '', operator: officerName }, officerName);
    drawSignatureRow(
      firstShift?.startTime || '0800H',
      startDesc,
      'Info',
      officerName,
      officerRole,
      sigBase64
    );
  }

  // Draw all log entries in exact chronological order
  sortedLogs.forEach((log) => {
    const isDuty = isDutyLifecycleLog(log);
    const logDesc = [
      log.title || 'Operational Event',
      log.description || '',
    ];

    if (isDuty) {
      let officerName = log.operator || data.finalOfficer || 'Monitoring Officer';
      // If title includes "Start of Monitoring Duty, Name" or "End of Monitoring Duty Name"
      const nameMatch = log.title?.match(/(?:Start of Monitoring Duty,\s*|End of Monitoring Duty\s+)([^(\n]+)/i);
      if (nameMatch && nameMatch[1]?.trim()) {
        officerName = nameMatch[1].trim();
      }

      let officerRole = log.operatorRole || 'Monitoring';
      if (!log.operatorRole && data.shifts) {
        const shiftMatch = data.shifts.find(
          (s) => s.leadOfficer && s.leadOfficer.toLowerCase() === officerName.toLowerCase()
        );
        if (shiftMatch?.leadOfficerRole) {
          officerRole = shiftMatch.leadOfficerRole;
        }
      }

      const sigBase64 = getOfficerSignature(log, officerName);
      drawSignatureRow(
        log.time || '1200H',
        logDesc,
        log.reportType || log.status || 'Info',
        officerName,
        officerRole,
        sigBase64
      );
    } else {
      drawRow(log.time || '1200H', logDesc, log.reportType || log.status || 'Info');
    }
  });

  // Fallback: If no end log exists in logs data, draw final end duty row
  if (!hasEndDutyLog) {
    const endDesc = [
      `End of Monitoring Duty ${data.finalOfficer || 'Duty Officer'}`,
      `24-Hour Operational Cycle: ${data.totalShiftsCount} Shifts Combined`,
      data.finalHandoverStatus || 'Situation Remain Normal',
    ];
    const officerName = data.finalOfficer || 'Lead Operations Officer';
    const officerRole = data.finalOfficerRole || 'Lead Operations Officer';
    const sigBase64 = getOfficerSignature({ time: '2359H', status: 'Info', title: '', description: '', operator: officerName }, officerName);
    drawSignatureRow(
      '2359H',
      endDesc,
      'Info',
      officerName,
      officerRole,
      sigBase64
    );
  }

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
