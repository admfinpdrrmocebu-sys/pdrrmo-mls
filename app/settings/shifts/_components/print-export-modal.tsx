'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, Download, Printer, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import type { CalendarCellItem, ShiftScheduleItem } from './types';

interface PrintExportModalProps {
  currentMonth: Date;
  monthActiveDays: CalendarCellItem[];
  shiftSchedules: ShiftScheduleItem[];
  onClose: () => void;
  onToast: (message: string) => void;
}

export default function PrintExportModal({
  currentMonth,
  monthActiveDays,
  shiftSchedules,
  onClose,
  onToast,
}: PrintExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadXLSX = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      const data = monthActiveDays.map((d) => {
        const s = d.schedule;
        const row: Record<string, string> = {
          Date: format(d.date, 'yyyy-MM-dd'),
          Day: format(d.date, 'EEEE'),
        };

        if (shiftSchedules.length > 0) {
          shiftSchedules.forEach((sched) => {
            const matchedShift = s.shifts.find(
              (sh) =>
                sh.scheduleId === sched.id ||
                sh.scheduleName.toLowerCase() === sched.name.toLowerCase()
            );
            if (matchedShift) {
              const officers = [
                ...(matchedShift.leadOfficer
                  ? [`${matchedShift.leadOfficer.name} (Lead)`]
                  : []),
                ...matchedShift.members.map((m) => m.name),
              ];
              row[`${sched.name} (${sched.time})`] =
                officers.length > 0 ? officers.join('\n') : '—';
            } else {
              row[`${sched.name} (${sched.time})`] = '—';
            }
          });
        } else {
          const summaries = s.shifts.map((sh) => {
            const officers = [
              ...(sh.leadOfficer ? [`${sh.leadOfficer.name} (Lead)`] : []),
              ...sh.members.map((m) => m.name),
            ];
            return `${sh.scheduleName} (${sh.timeLabel}):\n${officers.join(', ')}`;
          });
          row['Duty Assignments'] =
            summaries.length > 0 ? summaries.join('\n\n') : '—';
        }

        row['Travel Order'] =
          s.travelOrderPersonnel.length > 0
            ? s.travelOrderPersonnel.map((p) => p.name).join('\n')
            : '—';

        row['Rest Day / Off-Duty'] =
          s.restDayPersonnel.length > 0
            ? s.restDayPersonnel.map((p) => p.name).join('\n')
            : '—';

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, format(currentMonth, 'MMM yyyy'));
      const filename = `PDRRMO_Shift_Schedule_${format(
        currentMonth,
        'yyyy_MM'
      )}.xlsx`;
      XLSX.writeFile(wb, filename);
      onToast(`Exported ${filename} successfully.`);
    } catch (err) {
      console.error('Error generating XLSX:', err);
      onToast('Could not export XLSX file.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintTable = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const cebuSealUrl = `${origin}/assets/cebu-seal.png`;
    const pdrrmoLogoUrl = `${origin}/assets/pdrrmo-logo.png`;

    const dynamicTh =
      shiftSchedules.length > 0
        ? shiftSchedules
            .map((sched) => `<th>${sched.name} (${sched.time})</th>`)
            .join('')
        : '<th>Duty Assignments</th>';

    const rowsHtml = monthActiveDays
      .map((cell, idx) => {
        const s = cell.schedule;
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        let shiftTds = '';
        if (shiftSchedules.length > 0) {
          shiftTds = shiftSchedules
            .map((sched) => {
              const matchedShift = s.shifts.find(
                (sh) =>
                  sh.scheduleId === sched.id ||
                  sh.scheduleName.toLowerCase() === sched.name.toLowerCase()
              );
              if (matchedShift) {
                const officers = [
                  ...(matchedShift.leadOfficer
                    ? [
                        `<strong>${matchedShift.leadOfficer.name}</strong> <span style="font-size:7pt;color:#004AC6;">(Lead)</span>`,
                      ]
                    : []),
                  ...matchedShift.members.map((m) => m.name),
                ];
                return `<td style="padding: 6px 8px; border: 1px solid #94a3b8; vertical-align: top; line-height: 1.35; color: #1e293b;">${officers.join(
                  '<br/>'
                )}</td>`;
              }
              return `<td style="padding: 6px 8px; border: 1px solid #94a3b8; vertical-align: top; line-height: 1.35; color: #94a3b8; text-align: center;">—</td>`;
            })
            .join('');
        } else {
          const summaries = s.shifts.map((sh) => {
            const officers = [
              ...(sh.leadOfficer
                ? [`<strong>${sh.leadOfficer.name}</strong> (Lead)`]
                : []),
              ...sh.members.map((m) => m.name),
            ];
            return `<strong>${sh.scheduleName} (${sh.timeLabel}):</strong><br/>${officers.join(', ')}`;
          });
          shiftTds = `<td style="padding: 6px 8px; border: 1px solid #94a3b8; vertical-align: top; line-height: 1.35; color: #1e293b;">${
            summaries.length > 0
              ? summaries.join('<br/><br/>')
              : '<span style="color:#94a3b8;">—</span>'
          }</td>`;
        }

        const restDayNames =
          s.restDayPersonnel.length > 0
            ? s.restDayPersonnel.map((p) => p.name).join('<br/>')
            : '<span style="color: #94a3b8;">—</span>';

        return `
          <tr style="background-color: ${rowBg}; border-bottom: 1px solid #cbd5e1; page-break-inside: avoid;">
            <td style="padding: 6px 8px; border: 1px solid #94a3b8; font-family: monospace; font-weight: bold; text-align: center; vertical-align: top;">${format(
              cell.date,
              'yyyy-MM-dd'
            )}</td>
            <td style="padding: 6px 8px; border: 1px solid #94a3b8; font-weight: bold; text-align: center; vertical-align: top;">${format(
              cell.date,
              'EEEE'
            )}</td>
            ${shiftTds}
            <td style="padding: 6px 8px; border: 1px solid #94a3b8; vertical-align: top; line-height: 1.35; color: #1e293b;">${restDayNames}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>PDRRMO Shift Schedule - ${format(currentMonth, 'MMMM yyyy')}</title>
          <style>
            @page { size: landscape; margin: 8mm 10mm; }
            * { box-sizing: border-box; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 6px;
              background: #ffffff;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
            .header-table td { border: none !important; padding: 0; }
            .logo-cell { width: 75px; text-align: center; vertical-align: middle; }
            .logo-img { width: 65px; height: 65px; object-fit: contain; }
            .text-cell { text-align: center; vertical-align: middle; padding: 0 10px; }
            .gov-line-1, .gov-line-2 { font-size: 9pt; color: #1e293b; margin: 0; line-height: 1.25; }
            .gov-office { font-size: 11pt; font-weight: bold; color: #000000; text-transform: uppercase; letter-spacing: 0.3px; margin: 2px 0; }
            .gov-contact { font-size: 7.5pt; color: #475569; margin: 1px 0; }
            .gov-system { font-size: 8.5pt; font-weight: 600; color: #004AC6; margin: 1px 0 0 0; }
            .divider-line { border: none; border-top: 1.5px solid #334155; margin: 5px 0 8px 0; }
            .meta-bar { display: flex; justify-content: space-between; align-items: center; font-size: 9pt; font-weight: bold; margin-bottom: 8px; color: #0f172a; }
            .meta-bar .title { text-transform: uppercase; letter-spacing: 0.5px; }
            .meta-bar .month { color: #004AC6; }
            table.schedule-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
            table.schedule-table th {
              background-color: #004AC6 !important;
              color: #ffffff !important;
              padding: 7px 6px;
              border: 1px solid #00379b;
              text-align: left;
              font-weight: bold;
              text-transform: uppercase;
              font-size: 8pt;
              letter-spacing: 0.3px;
            }
            table.schedule-table th.center { text-align: center; }
            .footer { margin-top: 10px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #64748b; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td class="logo-cell">
                <img src="${cebuSealUrl}" class="logo-img" alt="Province of Cebu Seal" onerror="this.style.display='none'" />
              </td>
              <td class="text-cell">
                <div class="gov-line-1">Republic of the Philippines</div>
                <div class="gov-line-2">Province of Cebu</div>
                <div class="gov-office">PROVINCIAL DISASTER RISK MANAGEMENT OFFICE</div>
                <div class="gov-contact">(032) 888-2328 LOCAL 2301 or 2302 | Email: pdrrmo.cebu@gmail.com</div>
                <div class="gov-system">Monitoring Logs System</div>
              </td>
              <td class="logo-cell">
                <img src="${pdrrmoLogoUrl}" class="logo-img" alt="PDRRMO Logo" onerror="this.style.display='none'" />
              </td>
            </tr>
          </table>

          <hr class="divider-line" />

          <div class="meta-bar">
            <span class="title">Disaster Operations Center · Shift Schedule Duty Roster</span>
            <span class="month">Month of ${format(currentMonth, 'MMMM yyyy')}</span>
          </div>

          <table class="schedule-table">
            <thead>
              <tr>
                <th class="center" style="width: 88px;">Date</th>
                <th class="center" style="width: 82px;">Day</th>
                ${dynamicTh}
                <th style="width: 170px;">Rest Day / Off-Duty</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <span>Total ${monthActiveDays.length} operational schedule rows for ${format(
      currentMonth,
      'MMMM yyyy'
    )}</span>
            <span>Generated from Provincial Disaster Risk Reduction and Management Office (PDRRMO)</span>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[#1E293B]">
                  Shift Schedule Table Preview ({format(currentMonth, 'MMMM yyyy')})
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  .XLSX Format
                </span>
              </div>
              <p className="text-xs text-[#757680] mt-0.5">
                Spreadsheet tabular preview for print and workbook export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SecondaryButton
              size="sm"
              pill
              disabled={isExporting}
              onClick={handleDownloadXLSX}
              leftIcon={
                isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )
              }
            >
              {isExporting ? 'Exporting...' : 'Download .XLSX'}
            </SecondaryButton>

            <PrimaryButton
              size="sm"
              pill
              onClick={handlePrintTable}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
            >
              Print Table
            </PrimaryButton>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Excel Table Spreadsheet Preview */}
        <div className="p-6 overflow-auto flex-1 bg-[#F8FAFC]/50">
          <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-xs overflow-hidden p-6">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-300 mb-4">
              <div className="w-16 h-16 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/cebu-seal.png"
                  alt="Province of Cebu Seal"
                  className="w-14 h-14 object-contain"
                />
              </div>
              <div className="text-center flex-1">
                <p className="text-xs text-slate-700 leading-tight">
                  Republic of the Philippines
                </p>
                <p className="text-xs text-slate-700 leading-tight">
                  Province of Cebu
                </p>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide my-0.5">
                  PROVINCIAL DISASTER RISK MANAGEMENT OFFICE
                </h4>
                <p className="text-[11px] text-slate-600 leading-tight">
                  (032) 888-2328 LOCAL 2301 or 2302 | Email:
                  pdrrmo.cebu@gmail.com
                </p>
                <p className="text-xs font-semibold text-[#004AC6] mt-0.5">
                  Monitoring Logs System
                </p>
              </div>
              <div className="w-16 h-16 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/pdrrmo-logo.png"
                  alt="PDRRMO Logo"
                  className="w-14 h-14 object-contain"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 text-xs font-bold text-[#1E293B]">
              <span className="uppercase tracking-wider">
                Disaster Operations Center · Shift Schedule Duty Roster
              </span>
              <span className="text-[#004AC6]">
                Month of {format(currentMonth, 'MMMM yyyy')}
              </span>
            </div>

            <div className="border border-[#CBD5E1] rounded-lg overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-medium text-[#1E293B]">
                <thead>
                  <tr className="bg-[#004AC6] text-white text-[11px] font-bold uppercase tracking-wider divide-x divide-blue-500">
                    <th className="py-2.5 px-3 w-28 text-center">Date</th>
                    <th className="py-2.5 px-3 w-24 text-center">Day</th>
                    {shiftSchedules.length > 0 ? (
                      shiftSchedules.map((sched) => (
                        <th key={sched.id} className="py-2.5 px-3">
                          {sched.name} ({sched.time})
                        </th>
                      ))
                    ) : (
                      <th className="py-2.5 px-3">Duty Assignments</th>
                    )}
                    <th className="py-2.5 px-3 w-56">Rest Day / Off-Duty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {monthActiveDays.map((cell, rowIdx) => {
                    const s = cell.schedule;
                    const isEven = rowIdx % 2 === 0;

                    return (
                      <tr
                        key={s.dateKey}
                        className={`divide-x divide-[#E2E8F0] ${
                          cell.isCurrentDay
                            ? 'bg-blue-50/70 font-semibold'
                            : isEven
                            ? 'bg-white'
                            : 'bg-slate-50/60'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-[#505F76] whitespace-nowrap align-top">
                          {format(cell.date, 'yyyy-MM-dd')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-[#1E293B] whitespace-nowrap align-top">
                          {format(cell.date, 'EEEE')}
                        </td>
                        {shiftSchedules.length > 0 ? (
                          shiftSchedules.map((sched) => {
                            const matchedShift = s.shifts.find(
                              (sh) =>
                                sh.scheduleId === sched.id ||
                                sh.scheduleName.toLowerCase() ===
                                  sched.name.toLowerCase()
                            );
                            return (
                              <td
                                key={sched.id}
                                className="py-2.5 px-3 align-top"
                              >
                                {matchedShift ? (
                                  <div className="space-y-0.5 text-[#1E293B]">
                                    {matchedShift.leadOfficer && (
                                      <div className="font-bold text-[#004AC6]">
                                        {matchedShift.leadOfficer.name} (Lead)
                                      </div>
                                    )}
                                    {matchedShift.members.map((m) => (
                                      <div key={m.id}>{m.name}</div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-slate-400 italic text-center">
                                    —
                                  </div>
                                )}
                              </td>
                            );
                          })
                        ) : (
                          <td className="py-2.5 px-3 align-top">
                            {s.shifts.length > 0 ? (
                              <div className="space-y-2 text-[#1E293B]">
                                {s.shifts.map((sh) => (
                                  <div key={sh.scheduleId} className="text-xs">
                                    <div
                                      className="font-bold"
                                      style={{ color: sh.color }}
                                    >
                                      {sh.scheduleName} ({sh.timeLabel}):
                                    </div>
                                    <div className="text-slate-700">
                                      {[
                                        ...(sh.leadOfficer
                                          ? [`${sh.leadOfficer.name} (Lead)`]
                                          : []),
                                        ...sh.members.map((m) => m.name),
                                      ].join(', ')}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-slate-400 italic">—</div>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-3 align-top">
                          <div className="space-y-0.5 text-[#1E293B]">
                            {s.restDayPersonnel.length > 0 ? (
                              s.restDayPersonnel.map((p) => (
                                <div key={p.id}>{p.name}</div>
                              ))
                            ) : (
                              <div className="text-slate-400 italic">—</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center shrink-0">
          <span className="text-xs text-[#757680]">
            Total {monthActiveDays.length} operational schedule rows for{' '}
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <PrimaryButton size="md" pill onClick={onClose}>
            Close Preview
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
}
