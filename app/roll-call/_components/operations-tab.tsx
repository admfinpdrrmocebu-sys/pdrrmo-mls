'use client';

import React from 'react';
import {
  Radio as RadioIcon,
  Mic,
  X,
  ShieldCheck,
  Check,
  AlertTriangle,
  Loader2,
  MapPin,
  Lock,
  Clock,
  Anchor,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PrimaryButton } from '@/components/button';
import { CustomDropdown } from '@/components/input';
import { OfficerAvatar } from './officer-avatar';
import {
  weatherDropdownOptions,
  portDropdownOptions,
  getInitials,
  formatRollCallStartTime,
  type MunicipalityRow,
  type RollCallSessionRecord,
  type RollCallAlertBanner,
} from './types';

export interface OperationsTabProps {
  isRollCallActive: boolean;
  activeSession: RollCallSessionRecord | null;
  totalCount: number;
  presentCount: number;
  absentCount: number;
  recordedCount: number;
  alertBanner: RollCallAlertBanner | null;
  onDismissAlert: () => void;
  canModerateRollCall: boolean;
  radioScript: string;
  isSubmitting: boolean;
  canModifyRollCall: boolean;
  isRollCallViewOnly: boolean;
  onStartRollCall: () => void;
  onOpenFinalizeModal: () => void;
  stationsPage: number;
  totalStationPages: number;
  stationsPerPage: number;
  paginatedMunicipalities: MunicipalityRow[];
  onPageChange: React.Dispatch<React.SetStateAction<number>>;
  onToggleAttendance: (munId: string) => void;
  onWeatherChange: (munId: string, weatherVal: string) => void;
  onPortChange: (munId: string, portVal: string) => void;
}

export const OperationsTab = React.memo(function OperationsTab({
  isRollCallActive,
  activeSession,
  totalCount,
  presentCount,
  absentCount,
  recordedCount,
  alertBanner,
  onDismissAlert,
  canModerateRollCall,
  radioScript,
  isSubmitting,
  canModifyRollCall,
  isRollCallViewOnly,
  onStartRollCall,
  onOpenFinalizeModal,
  stationsPage,
  totalStationPages,
  stationsPerPage,
  paginatedMunicipalities,
  onPageChange,
  onToggleAttendance,
  onWeatherChange,
  onPortChange,
}: OperationsTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. TOP STATS & CURRENT ROLL CALL MODERATOR CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
        {/* Card 1: Net Radio Moderator / Conductor Card */}
        <div className="col-span-1 md:col-span-1 lg:col-span-7 bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden group">
          <div
            className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -mr-6 -mt-6 pointer-events-none transition-transform duration-300 group-hover:scale-110 ${
              isRollCallActive ? 'bg-emerald-500/5' : 'bg-slate-500/5'
            }`}
          />

          <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
            <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
              <RadioIcon className="w-3.5 h-3.5 text-[#004AC6]" />
              Net Radio Moderator
            </span>
            {isRollCallActive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                </span>
                Roll Call Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[#505F76] border border-slate-200 text-xs font-semibold">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Standby Mode
              </span>
            )}
          </div>

          <div className="relative z-10 flex items-center gap-4">
            {isRollCallActive && activeSession ? (
              <>
                <OfficerAvatar
                  officer={{
                    name: activeSession.conducted_by_name || 'Monitoring Officer',
                    avatarUrl: activeSession.conducted_by_avatar,
                    avatarInitials: getInitials(activeSession.conducted_by_name || ''),
                  }}
                  size="lg"
                  className="ring-2 ring-emerald-500/20 shadow-xs shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-[#1E293B] truncate">
                    {activeSession.conducted_by_name || 'Monitoring Officer'}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-[#505F76] font-medium mt-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Started at <strong className="text-[#1E293B] font-semibold">{formatRollCallStartTime(activeSession)}</strong>
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200 shrink-0">
                  <Clock className="w-5 h-5 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
                    No Active Roll Call Session
                  </h3>
                  <p className="text-xs text-[#757680] mt-0.5">
                    Ready to conduct VHF station check. Click &quot;Start Roll Call&quot; below to begin.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card 2: Station Telemetry Summary Card */}
        <div className="col-span-1 md:col-span-1 lg:col-span-5 bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-[#004AC6]/5 rounded-bl-[100px] -mr-6 -mt-6 pointer-events-none transition-transform duration-300 group-hover:scale-110" />

          <div className="flex justify-between items-start mb-3 relative z-10">
            <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#004AC6]" />
              Station Telemetry
            </span>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-2 text-center pt-1">
            <div className="bg-slate-50/80 rounded-2xl py-2 px-1 border border-slate-100">
              <div className="text-xl sm:text-2xl font-bold text-[#004AC6]">
                {totalCount}
              </div>
              <div className="text-[10px] font-bold text-[#505F76] uppercase">
                LGU
              </div>
            </div>
            <div className="bg-emerald-50/80 rounded-2xl py-2 px-1 border border-emerald-100">
              <div className="text-xl sm:text-2xl font-bold text-emerald-700">
                {isRollCallActive ? presentCount : '--'}
              </div>
              <div className="text-[10px] font-bold text-emerald-700 uppercase">
                Present
              </div>
            </div>
            <div className="bg-rose-50/80 rounded-2xl py-2 px-1 border border-rose-100">
              <div className="text-xl sm:text-2xl font-bold text-rose-700">
                {isRollCallActive ? absentCount : '--'}
              </div>
              <div className="text-[10px] font-bold text-rose-700 uppercase">
                Absent
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* In-App Alert Banner */}
      <AnimatePresence>
        {alertBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`p-4 sm:p-5 rounded-2xl border shadow-sm flex items-start justify-between gap-4 ${
              alertBanner.type === 'error'
                ? 'bg-rose-50/95 border-rose-200 text-rose-950'
                : alertBanner.type === 'warning'
                ? 'bg-amber-50/95 border-amber-200 text-amber-950'
                : 'bg-blue-50/95 border-blue-200 text-blue-950'
            }`}
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  alertBanner.type === 'error'
                    ? 'bg-rose-100 text-rose-700 border-rose-200'
                    : alertBanner.type === 'warning'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-blue-100 text-[#004AC6] border-blue-200'
                }`}
              >
                {alertBanner.type === 'error' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                ) : alertBanner.type === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                ) : (
                  <RadioIcon className="w-5 h-5 text-[#004AC6]" />
                )}
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm sm:text-base">
                    {alertBanner.title}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/60 border border-slate-300/60">
                    {alertBanner.type}
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-medium leading-relaxed">
                  {alertBanner.message}
                </p>

                {alertBanner.incompleteStations && alertBanner.incompleteStations.length > 0 && (
                  <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-amber-900 mr-1">
                      Incomplete Stations ({alertBanner.incompleteStations.length}):
                    </span>
                    {alertBanner.incompleteStations.map((stationName) => (
                      <span
                        key={stationName}
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/90 text-amber-950 border border-amber-300 shadow-2xs"
                      >
                        {stationName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onDismissAlert}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single Moderator Concurrency Alert */}
      {isRollCallActive && !canModerateRollCall && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900 text-xs sm:text-sm">
          <Lock className="w-5 h-5 text-amber-700 shrink-0" />
          <p>
            <strong>Session Locked by {activeSession?.conducted_by_name || 'Moderator'}:</strong>{' '}
            Only the officer who initiated this roll call can mark entries or finalize records. You are viewing live telemetry in real-time.
          </p>
        </div>
      )}

      {/* Main Operational Split: Left Script & Controls, Right Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 Cols): Broadcast Script & Moderator Actions */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#004AC6]" />
                Net Radio Script
              </span>
              <span className="text-[11px] font-bold text-[#004AC6] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Standard Prompt
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm text-[#1E293B] italic font-medium leading-relaxed">
              {radioScript}
            </div>

            {/* Operational Action Buttons */}
            <div className="space-y-3 pt-2">
              {!isRollCallActive ? (
                <PrimaryButton
                  size="lg"
                  pill
                  disabled={isSubmitting || !canModifyRollCall || isRollCallViewOnly}
                  onClick={onStartRollCall}
                  leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RadioIcon className="w-4 h-4" />}
                  className="w-full justify-center text-sm font-bold shadow-md hover:shadow-lg"
                >
                  {isSubmitting ? 'Initializing Session...' : 'Start Live Roll Call'}
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  size="lg"
                  pill
                  disabled={isSubmitting || !canModerateRollCall || recordedCount === 0}
                  onClick={onOpenFinalizeModal}
                  leftIcon={<ShieldCheck className="w-4 h-4" />}
                  className="w-full justify-center text-sm font-bold bg-emerald-600 hover:bg-emerald-700 shadow-md"
                >
                  Review & Finalize Record ({recordedCount}/{totalCount})
                </PrimaryButton>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (8 Cols): Stations Table */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[1.75rem] border border-[#E2E8F0] shadow-sm overflow-hidden min-h-[560px] flex flex-col">
            {/* Table Header Strip */}
            <div className="p-5 sm:p-6 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center font-bold">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                    Monitoring Stations & LGUs
                  </h2>
                  <p className="text-xs text-[#505F76]">
                    {totalCount} Municipalities & Coastal Ports in Cebu Province
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#505F76]">
                  Page Progress: <strong className="text-[#1E293B]">{stationsPage} / {totalStationPages}</strong>
                </span>
                <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden" title={`Page ${stationsPage} of ${totalStationPages}`}>
                  <div
                    className="h-full bg-[#004AC6] transition-all duration-300"
                    style={{ width: `${totalStationPages > 0 ? (stationsPage / totalStationPages) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Stations Table */}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-4 sm:px-6">LGU / Station</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Attendance</th>
                    <th className="py-3 px-3 sm:px-4">Weather Telemetry</th>
                    <th className="py-3 px-4 sm:px-6">Port / Pier Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedMunicipalities.map((mun) => (
                    <tr
                      key={mun.id}
                      id={`station-row-${mun.id}`}
                      className={`transition-colors hover:bg-slate-50/70 ${
                        mun.attendance === 'Present'
                          ? 'bg-emerald-50/20'
                          : mun.attendance === 'Absent'
                          ? 'bg-rose-50/20'
                          : ''
                      }`}
                    >
                      {/* Station Name */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div>
                          <span className="font-bold text-[#1E293B] block">
                            {mun.name}
                          </span>
                          {mun.hasPort && (
                            <span className="text-[10px] text-sky-700 font-medium flex items-center gap-1">
                              <Anchor className="w-2.5 h-2.5" />
                              {mun.portName || 'Coastal Port'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Attendance Toggle Button (Default Absent -> Click for Present) */}
                      <td className="py-3.5 px-3 sm:px-4">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            disabled={!isRollCallActive || !canModerateRollCall}
                            onClick={() => onToggleAttendance(mun.id)}
                            className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                              mun.attendance === 'Present'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs hover:bg-emerald-100/80'
                                : 'bg-slate-100/90 text-[#505F76] border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={mun.attendance === 'Present' ? 'Station is Present. Click to switch to Absent' : 'Station is Absent. Click to mark Present'}
                          >
                            {/* Animated Pill Switch */}
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                                mun.attendance === 'Present'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-300 group-hover:bg-emerald-500 text-white'
                              }`}
                            >
                              {mun.attendance === 'Present' ? (
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              ) : (
                                <X className="w-2.5 h-2.5 stroke-[3]" />
                              )}
                            </span>

                            <span>{mun.attendance === 'Present' ? 'Present' : 'Absent'}</span>
                          </button>
                        </div>
                      </td>

                      {/* Weather Condition Select */}
                      <td className="py-3.5 px-3 sm:px-4">
                        {mun.attendance === 'Present' ? (
                          <div className="w-36">
                            <CustomDropdown
                              options={weatherDropdownOptions}
                              value={mun.weatherStatus || 'Fair'}
                              onChange={(val) => onWeatherChange(mun.id, val)}
                              disabled={!canModerateRollCall}
                              size="sm"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            {mun.attendance ? `N/A (${mun.attendance})` : 'Awaiting Check'}
                          </span>
                        )}
                      </td>

                      {/* Port Status Select */}
                      <td className="py-3.5 px-4 sm:px-6">
                        {mun.attendance === 'Present' ? (
                          mun.hasPort ? (
                            <div className="w-36">
                              <CustomDropdown
                                options={portDropdownOptions}
                                value={mun.portStatus || 'Operational'}
                                onChange={(val) => onPortChange(mun.id, val)}
                                disabled={!canModerateRollCall}
                                size="sm"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">
                              No Port / Inland
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            {mun.attendance ? `N/A (${mun.attendance})` : 'Awaiting Check'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer (Max 10 per page) */}
            <div className="p-4 sm:p-5 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#F8FAFC]/80">
              <span className="text-xs text-[#505F76] font-medium">
                Showing{' '}
                <strong className="text-[#1E293B]">
                  {totalCount > 0 ? (stationsPage - 1) * stationsPerPage + 1 : 0}
                </strong>{' '}
                to{' '}
                <strong className="text-[#1E293B]">
                  {Math.min(stationsPage * stationsPerPage, totalCount)}
                </strong>{' '}
                of <strong className="text-[#1E293B]">{totalCount}</strong> stations
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={stationsPage === 1}
                  onClick={() => onPageChange((p) => Math.max(1, p - 1))}
                  className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalStationPages }).map((_, i) => {
                  const pageNum = i + 1;
                  if (
                    totalStationPages <= 7 ||
                    pageNum === 1 ||
                    pageNum === totalStationPages ||
                    Math.abs(pageNum - stationsPage) <= 1
                  ) {
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => onPageChange(pageNum)}
                        className={`w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                          stationsPage === pageNum
                            ? 'bg-[#004AC6] text-white shadow-xs font-bold'
                            : 'border border-[#E2E8F0] bg-white text-[#505F76] hover:bg-slate-50 shadow-2xs'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (
                    (pageNum === 2 && stationsPage > 3) ||
                    (pageNum === totalStationPages - 1 && stationsPage < totalStationPages - 2)
                  ) {
                    return (
                      <span key={pageNum} className="px-1 text-slate-400 font-bold select-none">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}

                <button
                  type="button"
                  disabled={stationsPage === totalStationPages || totalStationPages === 0}
                  onClick={() => onPageChange((p) => Math.min(totalStationPages, p + 1))}
                  className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
