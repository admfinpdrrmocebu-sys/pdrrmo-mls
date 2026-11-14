'use client';

import React from 'react';
import {
  FileText,
  Radio,
  Download,
  AlertTriangle,
  ShieldCheck,
  Printer,
  X,
  Building2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SecondaryButton } from '@/components/button';
import {
  buildNetCallingStationList,
  formatNetCallHourLabel,
  PAPER_DIMENSIONS,
  type PaperSize,
  type RollCallTemplateType,
} from '@/lib/pdf-generator';
import {
  CAPITOL_LOGO_BASE64,
  PDRRMO_LOGO_BASE64,
  BAGONG_PILIPINAS_LOGO_BASE64,
} from '@/lib/header-logos';
import {
  formatFileDate,
  getShiftStartTime,
  getShiftEndTime,
  type ArchivedFile,
  type ArchiveProfileRow,
} from './types';

function renderFormattedDescription(content: string | undefined | null) {
  if (!content) {
    return (
      <span className="text-slate-400 italic">
        No operational remarks recorded.
      </span>
    );
  }

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
          <p
            key={lineIdx}
            className={`leading-relaxed ${isBullet ? 'pl-3' : ''}`}
          >
            {isBullet && (
              <span className="font-bold text-[#004AC6] mr-1.5">•</span>
            )}
            {cleanLine}
          </p>
        );
      })}
    </div>
  );
}

export interface ArchivePreviewModalProps {
  selectedFile: ArchivedFile | null;
  previewViewMode: 'document' | 'pdf';
  previewPdfBlobUrl: string | null;
  isPreviewLoading: boolean;
  previewError: string | null;
  rcTemplateType: RollCallTemplateType;
  rcPaperSize: PaperSize;
  profileMap: Map<string, ArchiveProfileRow>;
  currentUserProfile: {
    id?: string;
    full_name?: string | null;
    position_title?: string | null;
    signature_url?: string | null;
  } | null;
  printIframeRef: React.RefObject<HTMLIFrameElement | null>;
  onChangeViewMode: (mode: 'document' | 'pdf') => void;
  onSwitchRollCallFormat: (
    template: RollCallTemplateType,
    paper: PaperSize
  ) => void;
  onRetryPreview: (file: ArchivedFile) => void;
  onDownload: (file: ArchivedFile) => void;
  onPrint: () => void;
  onClose: () => void;
}

export function ArchivePreviewModal({
  selectedFile,
  previewViewMode,
  previewPdfBlobUrl,
  isPreviewLoading,
  previewError,
  rcTemplateType,
  rcPaperSize,
  profileMap,
  currentUserProfile,
  printIframeRef,
  onChangeViewMode,
  onSwitchRollCallFormat,
  onRetryPreview,
  onDownload,
  onPrint,
  onClose,
}: ArchivePreviewModalProps) {
  return (
    <AnimatePresence>
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

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
                    selectedFile.category === 'log'
                      ? 'bg-blue-50 text-[#004AC6] border-blue-200/60'
                      : 'bg-sky-50 text-sky-700 border-sky-200/60'
                  }`}
                >
                  {selectedFile.category === 'log' ? (
                    <FileText className="w-5 h-5" />
                  ) : (
                    <Radio className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm sm:text-base text-[#1E293B] font-mono leading-none truncate">
                      {selectedFile.filename}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      {selectedFile.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#757680] mt-1 truncate">
                    {selectedFile.generatedAt} · Size: {selectedFile.fileSize}
                  </p>
                </div>
              </div>

              {/* Right toolbar controls */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-slate-200/80 p-0.5 rounded-full text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => onChangeViewMode('document')}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                      previewViewMode === 'document'
                        ? 'bg-white text-[#004AC6] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Document View
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeViewMode('pdf')}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                      previewViewMode === 'pdf'
                        ? 'bg-white text-[#004AC6] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
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
                  onClick={() => onDownload(selectedFile)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E2E8F0] bg-white text-xs font-semibold text-[#505F76] hover:bg-[#F1F5F9] hover:text-[#004AC6] transition-all cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={onPrint}
                  disabled={isPreviewLoading || !previewPdfBlobUrl}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#004AC6] text-white text-xs font-bold hover:bg-[#003ea8] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors ml-1 cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Roll Call Template & Paper Size Selector Bar */}
            {selectedFile.category === 'roll-call' && (
              <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#505F76] uppercase tracking-wider text-[10px]">
                    Document Template:
                  </span>
                  <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-full border border-[#E2E8F0]">
                    <button
                      type="button"
                      onClick={() =>
                        onSwitchRollCallFormat('net_calling', rcPaperSize)
                      }
                      className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        rcTemplateType === 'net_calling'
                          ? 'bg-[#004AC6] text-white shadow-xs'
                          : 'text-[#505F76] hover:text-[#1E293B]'
                      }`}
                    >
                      <span>For Net Calling (2-Column)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSwitchRollCallFormat('official_table', rcPaperSize)
                      }
                      className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        rcTemplateType === 'official_table'
                          ? 'bg-[#004AC6] text-white shadow-xs'
                          : 'text-[#505F76] hover:text-[#1E293B]'
                      }`}
                    >
                      <span>Official MLS Table</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#505F76] uppercase tracking-wider text-[10px]">
                    Paper Size:
                  </span>
                  <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-full border border-[#E2E8F0]">
                    {(['a4', 'short', 'folio', 'legal'] as PaperSize[]).map(
                      (sizeKey) => (
                        <button
                          key={sizeKey}
                          type="button"
                          onClick={() =>
                            onSwitchRollCallFormat(rcTemplateType, sizeKey)
                          }
                          title={PAPER_DIMENSIONS[sizeKey].label}
                          className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer uppercase text-[11px] ${
                            rcPaperSize === sizeKey
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-[#505F76] hover:text-[#1E293B]'
                          }`}
                        >
                          {PAPER_DIMENSIONS[sizeKey].shortLabel}
                        </button>
                      )
                    )}
                  </div>
                  <span className="hidden md:inline-block text-[11px] text-[#757680] font-medium">
                    ({PAPER_DIMENSIONS[rcPaperSize].label})
                  </span>
                </div>
              </div>
            )}

            {/* Document PDF Viewer Container */}
            <div className="flex-1 bg-slate-100 p-2 sm:p-4 flex flex-col items-center relative overflow-y-auto custom-scrollbar">
              {isPreviewLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#505F76] my-auto">
                  <Loader2 className="w-8 h-8 animate-spin text-[#004AC6]" />
                  <p className="text-sm font-semibold text-[#1E293B]">
                    Loading official file from storage bucket...
                  </p>
                  <p className="text-xs text-[#757680]">
                    Rendering verified PDF document (
                    {PAPER_DIMENSIONS[rcPaperSize].shortLabel})
                  </p>
                </div>
              ) : previewError ? (
                <div className="my-auto flex flex-col items-center justify-center gap-3 text-rose-600 p-6 bg-white rounded-2xl border border-rose-200 shadow-sm max-w-md text-center">
                  <AlertTriangle className="w-8 h-8 text-rose-500" />
                  <p className="text-sm font-bold text-[#1E293B]">
                    {previewError}
                  </p>
                  <SecondaryButton
                    size="sm"
                    pill
                    onClick={() => onRetryPreview(selectedFile)}
                  >
                    Try Again
                  </SecondaryButton>
                </div>
              ) : previewViewMode === 'document' &&
                selectedFile.category === 'roll-call' &&
                rcTemplateType === 'net_calling' ? (
                <RollCallNetCallingDocumentView
                  file={selectedFile}
                  rcPaperSize={rcPaperSize}
                />
              ) : previewViewMode === 'document' ? (
                <OfficialDocumentView
                  file={selectedFile}
                  profileMap={profileMap}
                  currentUserProfile={currentUserProfile}
                />
              ) : previewPdfBlobUrl ? (
                <iframe
                  ref={printIframeRef}
                  src={`${previewPdfBlobUrl}#view=FitH&toolbar=0&navpanes=0`}
                  className="w-full h-full rounded-2xl border border-[#CBD5E1] shadow-lg bg-white"
                  title={selectedFile.filename}
                />
              ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function RollCallNetCallingDocumentView({
  file,
  rcPaperSize,
}: {
  file: ArchivedFile;
  rcPaperSize: PaperSize;
}) {
  const rawSnapshotEntries = Array.isArray(file.rawSnapshotData?.entries)
    ? file.rawSnapshotData.entries
    : Array.isArray(file.rawSnapshotData?.records)
    ? file.rawSnapshotData.records
    : [];

  const rawEntries =
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
          attendance: (e.attendance || e.status || null) as string | null,
          weatherStatus: (e.weatherStatus ||
            e.weather_status ||
            e.weather ||
            null) as string | null,
          portStatus: (e.portStatus ||
            e.port_status ||
            e.port ||
            null) as string | null,
          hasPort: Boolean(e.hasPort),
          portName: (e.portName || e.port_name) as string | undefined,
          timeResponded: (e.timeResponded || e.time_responded || e.time) as
            | string
            | undefined,
          dutyOperator: (e.dutyOperator || e.duty_operator) as
            | string
            | undefined,
        }));

  const all53 = buildNetCallingStationList(rawEntries);
  const left26 = all53.slice(0, 26);
  const right27 = all53.slice(26, 53);
  const hourLabel = formatNetCallHourLabel(file.shiftHours);
  const officerName =
    file.leadOfficer && file.leadOfficer.toLowerCase() !== 'monitoring officer'
      ? file.leadOfficer
      : '(STATE YOUR NAME)';

  const renderStationRow = (stn: (typeof all53)[0], num: number) => {
    const isPresent = stn.attendance === 'Present';
    const isAbsent = stn.attendance === 'Absent';
    const isExempted = stn.attendance === 'Exempted';
    const isSingleLine =
      stn.name.toUpperCase() === 'CEBU CITY' &&
      !stn.weatherStatus &&
      !stn.hasPort;
    const cleanPortLabel = stn.portName
      ? stn.portName.endsWith(':')
        ? stn.portName
        : stn.name.toUpperCase() === 'ARGAO'
        ? stn.portName
        : `${stn.portName}:`
      : null;

    return (
      <tr
        key={num}
        className="border-b border-slate-500 text-[11px] leading-tight"
      >
        <td className="w-8 border-r border-slate-500 text-center font-medium text-slate-900 py-1 px-1 align-middle">
          {num}
        </td>
        <td className="border-r border-slate-500 py-1 px-2 text-slate-900">
          <div className="font-bold uppercase tracking-tight">{stn.name}</div>
          {!isSingleLine && (
            <div>
              <span className="font-bold">Weather:</span>{' '}
              {isPresent &&
              stn.weatherStatus &&
              stn.weatherStatus !== 'N/A' &&
              stn.weatherStatus !== 'None' ? (
                <span className="font-normal text-slate-800">
                  {stn.weatherStatus}
                </span>
              ) : null}
            </div>
          )}
          {stn.hasPort && cleanPortLabel && (
            <div>
              <span className="font-bold">{cleanPortLabel}</span>{' '}
              {isPresent &&
              stn.portStatus &&
              stn.portStatus !== 'N/A' &&
              stn.portStatus !== 'None' ? (
                <span className="font-normal text-slate-800">
                  {stn.portStatus}
                </span>
              ) : null}
            </div>
          )}
        </td>
        <td className="w-9 border-r border-slate-500 text-center align-middle font-bold text-emerald-700">
          {isPresent ? (
            '✔'
          ) : isExempted ? (
            <span className="text-[9px] text-amber-700">EX</span>
          ) : (
            ''
          )}
        </td>
        <td className="w-9 text-center align-middle font-bold text-rose-700">
          {isAbsent ? '✖' : ''}
        </td>
      </tr>
    );
  };

  return (
    <div className="w-full max-w-4xl bg-white rounded-2xl shadow-md border border-[#CBD5E1] p-5 sm:p-8 space-y-4 text-slate-900 my-auto sm:my-2">
      <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-100 pb-2">
        <span className="font-semibold text-[#004AC6]">
          Template: FOR NET CALL — PDRRMO OPCEN (53 LGUs 2-Column Sheet)
        </span>
        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
          {PAPER_DIMENSIONS[rcPaperSize].label}
        </span>
      </div>

      {/* 3-Logo Header */}
      <div className="flex items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2.5 shrink-0">
          {CAPITOL_LOGO_BASE64 && (
            <img
              src={CAPITOL_LOGO_BASE64}
              alt="Province of Cebu Official Seal"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
            />
          )}
          {PDRRMO_LOGO_BASE64 && (
            <img
              src={PDRRMO_LOGO_BASE64}
              alt="PDRRMO Seal"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
            />
          )}
        </div>

        <div className="flex-1 text-center font-serif">
          <h2 className="text-base sm:text-xl font-bold text-slate-950 tracking-wide leading-tight">
            FOR NET CALL
          </h2>
          <h3 className="text-base sm:text-xl font-bold text-slate-950 tracking-wide leading-tight">
            PDRRMO OPCEN
          </h3>
        </div>

        <div className="shrink-0 pr-1 sm:pr-4">
          {BAGONG_PILIPINAS_LOGO_BASE64 && (
            <img
              src={BAGONG_PILIPINAS_LOGO_BASE64}
              alt="Bagong Pilipinas"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
            />
          )}
        </div>
      </div>

      {/* 2-Column Split Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
        <div className="space-y-2">
          <div className="text-xs leading-snug text-slate-900 font-sans">
            <p>ATTENTION ALL STATIONS, PLEASE DO STANDBY</p>
            <p>
              FOR THE <strong>{hourLabel}</strong> NET CALL. THIS IS{' '}
              <strong className="uppercase">{officerName}</strong>, YOUR OPCEN
              MONITORING PERSONNEL
            </p>
            <p>ON DUTY. LET US START WITH LGU</p>
          </div>

          <div className="border border-slate-600">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-600 bg-slate-50 text-[11px]">
                  <th className="w-8 border-r border-slate-500 py-1 px-1 text-center font-normal">
                    #
                  </th>
                  <th className="border-r border-slate-500 py-1 px-2 text-left font-bold">
                    LEAGUE OF DRRMO&apos;S
                  </th>
                  <th className="w-9 border-r border-slate-500 py-1 text-center font-bold">
                    ✔
                  </th>
                  <th className="w-9 py-1 text-center font-bold">✖</th>
                </tr>
              </thead>
              <tbody>
                {left26.map((stn, i) => renderStationRow(stn, i + 1))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-slate-600">
          <table className="w-full border-collapse">
            <tbody>
              {right27.map((stn, i) => renderStationRow(stn, i + 27))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Closing Script & Sign-off Footer */}
      <div className="pt-3 pl-2 sm:pl-6 space-y-4 text-xs text-slate-900">
        <div className="space-y-0.5">
          <p>
            FOR CLOSING: That ends our{' '}
            <strong className="underline">{hourLabel}</strong> Net Call,
          </p>
          <p>
            Once again this is your net controller{' '}
            <strong>
              {file.leadOfficer &&
              file.leadOfficer.toLowerCase() !== 'monitoring officer'
                ? file.leadOfficer
                : '(state your name)'}
            </strong>
            . Please do standby for any possible Contact. Thank You. Amping
            Tanan!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 font-bold text-xs sm:text-sm">
          <div className="flex items-baseline gap-2">
            <span>ON DUTY PERSONNEL :</span>
            <span className="inline-block min-w-48 border-b border-slate-900 text-center pb-0.5 uppercase">
              {file.leadOfficer || ''}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span>Time/Date :</span>
            <span className="inline-block min-w-52 border-b border-slate-900 text-center pb-0.5 font-normal">
              {formatFileDate(file.dailyReportDate || file.createdAt)} ·{' '}
              {file.shiftHours || '1600H'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function OfficialDocumentView({
  file,
  profileMap,
  currentUserProfile,
}: {
  file: ArchivedFile;
  profileMap: Map<string, ArchiveProfileRow>;
  currentUserProfile: ArchivePreviewModalProps['currentUserProfile'];
}) {
  const rcOfficerProfile =
    profileMap.get(file.leadOfficer?.toLowerCase().trim()) ||
    currentUserProfile;

  const previewLogs = file.logEntries || [];
  const hasStartLog = previewLogs.some(
    (l) =>
      /start\s+of\s+monitoring/i.test(l.title || '') ||
      /start\s+of\s+monitoring/i.test(l.description || '')
  );
  const hasEndLog = previewLogs.some(
    (l) =>
      /end\s+of\s+(monitoring|shift)/i.test(l.title || '') ||
      /end\s+of\s+(monitoring|shift)/i.test(l.description || '')
  );

  const firstShift = file.shifts?.[0];
  const firstOfficerName =
    firstShift?.leadOfficer || file.leadOfficer || 'Duty Officer';
  const firstOfficerProfile =
    profileMap.get(firstOfficerName.toLowerCase().trim()) || currentUserProfile;
  const firstOfficerRole =
    firstShift?.leadOfficerRole ||
    firstOfficerProfile?.position_title ||
    file.leadOfficerRole ||
    'Lead Operations Officer';

  const finalOfficerName = file.leadOfficer || 'Lead Operations Officer';
  const finalOfficerProfile =
    profileMap.get(finalOfficerName.toLowerCase().trim()) || currentUserProfile;
  const finalOfficerRole =
    file.leadOfficerRole ||
    finalOfficerProfile?.position_title ||
    'Lead Operations Officer';

  return (
    <div className="w-full max-w-4xl bg-white rounded-2xl shadow-md border border-[#CBD5E1] p-5 sm:p-8 space-y-5 text-slate-800 my-auto sm:my-2">
      {/* Document Header with Dual Logos */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 pb-3 border-b-2 border-slate-900">
        <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
          {CAPITOL_LOGO_BASE64 ? (
            <img
              src={CAPITOL_LOGO_BASE64}
              alt="Province of Cebu"
              className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
            />
          ) : (
            <Building2 className="w-10 h-10 text-slate-400" />
          )}
        </div>

        <div className="flex-1 text-center space-y-0.5">
          <p className="text-[11px] sm:text-xs text-slate-600 font-normal">
            Republic of the Philippines
          </p>
          <p className="text-[11px] sm:text-xs text-slate-600 font-normal">
            Province of Cebu
          </p>
          <h2 className="text-xs sm:text-sm font-bold text-slate-950 tracking-tight">
            PROVINCIAL DISASTER RISK MANAGEMENT OFFICE
          </h2>
          <p className="text-[10px] sm:text-[11px] text-slate-500">
            (032) 888-2328 LOCAL 2301 or 2302 | Email: pdrrmo.cebu@gmail.com
          </p>
          <h3 className="text-xs sm:text-sm font-bold text-[#004AC6] pt-1">
            {file.category === 'roll-call'
              ? 'Radio Net Roll Call System'
              : 'Monitoring Logs System'}
          </h3>
        </div>

        <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
          {PDRRMO_LOGO_BASE64 ? (
            <img
              src={PDRRMO_LOGO_BASE64}
              alt="PDRRMO"
              className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
            />
          ) : (
            <ShieldCheck className="w-10 h-10 text-[#004AC6]" />
          )}
        </div>
      </div>

      {/* Date Line */}
      <div className="text-xs font-bold text-slate-900">
        Date: {formatFileDate(file.dailyReportDate || file.createdAt)}
      </div>

      {/* Official 3-Column Table */}
      <div className="border border-slate-400 rounded-lg overflow-hidden bg-white text-xs">
        <div className="grid grid-cols-12 bg-slate-100 font-bold border-b border-slate-400 text-slate-900 text-center py-2 px-3">
          <div className="col-span-2 border-r border-slate-300">Time</div>
          <div className="col-span-8 text-left pl-3 border-r border-slate-300">
            Title w/ Description
          </div>
          <div className="col-span-2">
            {file.category === 'roll-call' ? 'Attendance' : 'Report Type'}
          </div>
        </div>

        <div className="divide-y divide-slate-300">
          {file.category === 'roll-call' ? (
            <>
              <div className="grid grid-cols-12 py-3 px-3 items-start bg-slate-50/40">
                <div className="col-span-2 text-center font-bold font-mono text-slate-900 pt-0.5">
                  {file.shiftHours || '1600H'}
                </div>
                <div className="col-span-8 px-3 space-y-1.5 border-x border-slate-200">
                  <p className="font-bold text-slate-950">
                    Start of Radio Net Roll Call, {file.leadOfficer}
                  </p>
                  <p className="text-slate-700">
                    <strong>Net Frequency:</strong>{' '}
                    {file.rollCallStats?.frequency ||
                      '142.500 MHz Primary VHF Net'}
                  </p>
                  <p className="text-slate-700">
                    <strong>Radio Script:</strong>{' '}
                    {file.monitoringBriefing || 'Radio Roll Call Net Protocol'}
                  </p>
                  <p className="text-slate-700">
                    <strong>Total Designated Stations:</strong>{' '}
                    {file.rollCallStats?.totalAreas || file.itemCount || 8}{' '}
                    Stations
                  </p>
                  <div className="pt-4 border-t border-slate-200 mt-2">
                    <div className="w-44 border-b border-slate-700 mb-1.5" />
                    <p className="font-bold text-slate-900 text-[11px]">
                      {file.leadOfficer}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {file.leadOfficerRole ||
                        rcOfficerProfile?.position_title ||
                        'Duty Operations Officer'}
                    </p>
                  </div>
                </div>
                <div className="col-span-2 text-center text-slate-400 font-semibold pt-0.5">
                  —
                </div>
              </div>

              {(file.rollCallEntries || []).map((stn, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 py-2.5 px-3 items-start hover:bg-slate-50"
                >
                  <div className="col-span-2 text-center font-mono text-slate-800 pt-0.5">
                    {stn.timeResponded || file.shiftHours || '1600H'}
                  </div>
                  <div className="col-span-8 px-3 space-y-1 border-x border-slate-200">
                    <p className="font-bold text-slate-950">
                      {stn.municipality || stn.station} Station
                    </p>
                    <p className="text-slate-600">
                      Weather Condition:{' '}
                      <strong>{stn.weatherCondition || 'Fair'}</strong> | Port
                      Status: <strong>{stn.seaPortStatus || 'Operational'}</strong>
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

              <div className="grid grid-cols-12 py-3 px-3 items-start bg-slate-50/40">
                <div className="col-span-2 text-center font-bold font-mono text-slate-900 pt-0.5">
                  1630H
                </div>
                <div className="col-span-8 px-3 space-y-1.5 border-x border-slate-200">
                  <p className="font-bold text-slate-950">
                    End of Radio Net Roll Call {file.leadOfficer}
                  </p>
                  <p className="text-slate-700">
                    Attendance Breakdown:{' '}
                    <strong>{file.rollCallStats?.present || 8} Present</strong>,{' '}
                    <strong>{file.rollCallStats?.absent || 0} Absent</strong>,{' '}
                    <strong>
                      {file.rollCallStats?.exempted || 0} Exempted
                    </strong>
                  </p>
                  <p className="text-slate-700">Situation Remain Normal</p>
                  <div className="pt-4 border-t border-slate-200 mt-2">
                    <div className="w-44 border-b border-slate-700 mb-1.5" />
                    <p className="font-bold text-slate-900 text-[11px]">
                      {file.leadOfficer}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {file.leadOfficerRole ||
                        rcOfficerProfile?.position_title ||
                        'Duty Operations Officer'}
                    </p>
                  </div>
                </div>
                <div className="col-span-2 text-center text-slate-400 font-semibold pt-0.5">
                  —
                </div>
              </div>
            </>
          ) : (
            <>
              {!hasStartLog && (
                <div className="grid grid-cols-12 py-3 px-3 items-start bg-slate-50/40">
                  <div className="col-span-2 text-center font-bold font-mono text-slate-900 pt-0.5">
                    {getShiftStartTime(file)}
                  </div>
                  <div className="col-span-8 px-3 space-y-1.5 border-x border-slate-200">
                    <p className="font-bold text-slate-950">
                      Start of Monitoring Duty, {firstOfficerName}
                    </p>
                    <p className="text-slate-700">
                      Standby Vehicles: Pick up - 1, Ambulance - 1, Demo Items -
                      5
                    </p>
                    <div className="text-slate-700 text-xs">
                      <strong>Active personnel assigned on duty:</strong>{' '}
                      {file.dutyPersonnelRoster &&
                      file.dutyPersonnelRoster.length > 0
                        ? file.dutyPersonnelRoster
                            .map((p) => `${p.name} (${p.role})`)
                            .join(', ')
                        : firstOfficerName}
                    </div>
                    {file.monitoringBriefing && (
                      <div className="pt-1">
                        <span className="font-bold text-slate-900 block mb-0.5">
                          Monitoring Details & Briefing:
                        </span>
                        {renderFormattedDescription(file.monitoringBriefing)}
                      </div>
                    )}
                    <div className="pt-4 border-t border-slate-200 mt-2">
                      <div className="w-44 border-b border-slate-700 mb-1.5" />
                      <p className="font-bold text-slate-900 text-[11px]">
                        {firstOfficerName}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {firstOfficerRole}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2 text-center text-slate-500 font-medium pt-0.5">
                    Info
                  </div>
                </div>
              )}

              {previewLogs.map((log, idx) => {
                const isStart =
                  /start\s+of\s+monitoring/i.test(log.title || '') ||
                  /start\s+of\s+monitoring/i.test(log.description || '');
                const isAssume =
                  /assume\s+monitoring/i.test(log.title || '') ||
                  /assume\s+monitoring/i.test(log.description || '');
                const isEnd =
                  /end\s+of\s+(monitoring|shift)/i.test(log.title || '') ||
                  /end\s+of\s+(monitoring|shift)/i.test(log.description || '');
                const isDutyLifecycle = isStart || isAssume || isEnd;

                const opName = log.operator || file.leadOfficer || 'Duty Officer';
                const opProf =
                  (log.operator_id
                    ? profileMap.get(log.operator_id.toLowerCase())
                    : undefined) ||
                  (log.operator
                    ? profileMap.get(log.operator.toLowerCase().trim())
                    : undefined) ||
                  profileMap.get(file.leadOfficer?.toLowerCase().trim());
                const opRole =
                  log.operatorRole ||
                  opProf?.position_title ||
                  'Duty Operations Officer';

                if (isDutyLifecycle) {
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-12 py-3 px-3 items-start bg-slate-50/40"
                    >
                      <div className="col-span-2 text-center font-bold font-mono text-slate-900 pt-0.5">
                        {log.time || '0000H'}
                      </div>
                      <div className="col-span-8 px-3 space-y-1.5 border-x border-slate-200">
                        <p className="font-bold text-slate-950">{log.title}</p>
                        <div className="text-slate-700">
                          {renderFormattedDescription(log.description)}
                        </div>
                        <div className="pt-4 border-t border-slate-200 mt-2">
                          <div className="w-44 border-b border-slate-700 mb-1.5" />
                          <p className="font-bold text-slate-900 text-[11px]">
                            {opName}
                          </p>
                          <p className="text-[10px] text-slate-500">{opRole}</p>
                        </div>
                      </div>
                      <div className="col-span-2 text-center text-slate-500 font-medium pt-0.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {log.reportType || log.status || 'Info'}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 py-2.5 px-3 items-start hover:bg-slate-50"
                  >
                    <div className="col-span-2 text-center font-mono text-slate-800 pt-0.5">
                      {log.time || '1200H'}
                    </div>
                    <div className="col-span-8 px-3 space-y-1 border-x border-slate-200">
                      <p className="font-bold text-slate-950">{log.title}</p>
                      <div className="text-slate-700">
                        {renderFormattedDescription(log.description)}
                      </div>
                      {log.operator && (
                        <p className="text-[10px] text-slate-400">
                          Operator: {log.operator}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2 text-center pt-0.5">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {log.reportType || log.status || 'Info'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {!hasEndLog && (
                <div className="grid grid-cols-12 py-3 px-3 items-start bg-slate-50/40">
                  <div className="col-span-2 text-center font-bold font-mono text-slate-900 pt-0.5">
                    {getShiftEndTime(file)}
                  </div>
                  <div className="col-span-8 px-3 space-y-1.5 border-x border-slate-200">
                    <p className="font-bold text-slate-950">
                      End of Monitoring Duty {finalOfficerName}
                    </p>
                    <p className="text-slate-700">
                      Shift:{' '}
                      <strong>{file.shift || 'Operations Shift'}</strong>
                    </p>
                    <p className="text-slate-700">
                      Handover Status:{' '}
                      <strong>
                        {file.handoverStatus || 'Situation Remain Normal'}
                      </strong>
                    </p>
                    {file.incidentReportDetails && (
                      <p className="text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200 text-xs">
                        <strong>Incident Notes:</strong>{' '}
                        {file.incidentReportDetails}
                      </p>
                    )}
                    <div className="pt-4 border-t border-slate-200 mt-2">
                      <div className="w-44 border-b border-slate-700 mb-1.5" />
                      <p className="font-bold text-slate-900 text-[11px]">
                        {finalOfficerName}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {finalOfficerRole}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2 text-center text-slate-500 font-medium pt-0.5">
                    Info
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
