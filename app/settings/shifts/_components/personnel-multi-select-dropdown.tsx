'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserPlus, ChevronDown, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getRoleBadge,
  type OfficerAssignment,
  type EditDayAssignment,
  type ShiftScheduleItem,
} from './types';

interface PersonnelMultiSelectDropdownProps {
  label: string;
  themeColor: string;
  profiles: OfficerAssignment[];
  currentAssignedIds: string[];
  allDayAssignments: EditDayAssignment[];
  shiftSchedules: ShiftScheduleItem[];
  onAddOfficers: (profileIds: string[]) => void;
  disabled?: boolean;
}

export default function PersonnelMultiSelectDropdown({
  label,
  themeColor,
  profiles,
  currentAssignedIds,
  allDayAssignments,
  shiftSchedules,
  onAddOfficers,
  disabled = false,
}: PersonnelMultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search query by 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Filter profiles based on debounced search query
  const filteredProfiles = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        (p.userRole && p.userRole.toLowerCase().includes(q)) ||
        (p.badgeNumber && p.badgeNumber.toLowerCase().includes(q)) ||
        (p.defaultShift && p.defaultShift.toLowerCase().includes(q))
      );
    });
  }, [profiles, debouncedSearchQuery]);

  // Available to select (not currently assigned in this specific shift/category)
  const availableFiltered = useMemo(
    () => filteredProfiles.filter((p) => !currentAssignedIds.includes(p.id)),
    [filteredProfiles, currentAssignedIds]
  );

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const idsToAdd = availableFiltered.map((p) => p.id);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleCommitAdd = () => {
    if (selectedIds.length === 0) return;
    onAddOfficers(selectedIds);
    setSelectedIds([]);
    setIsOpen(false);
    setSearchQuery('');
    setDebouncedSearchQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          borderColor: isOpen ? themeColor : `${themeColor}40`,
          color: themeColor,
          backgroundColor: isOpen ? `${themeColor}0A` : '#ffffff',
        }}
        className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs border hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <UserPlus className="w-3.5 h-3.5" />
        <span>{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Floating Popover Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 sm:right-auto sm:w-[480px] top-full mt-2 z-50 bg-white border border-[#CBD5E1] rounded-2xl shadow-2xl overflow-hidden flex flex-col ring-1 ring-black/10 max-h-[420px]"
          >
            {/* Popover Header: Debounced Search Input */}
            <div className="p-3 border-b border-[#E2E8F0] bg-[#F8FAFC] space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, role, badge, shift..."
                  className="w-full bg-white border border-[#E2E8F0] rounded-xl py-1.5 pl-8 pr-8 text-xs text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setDebouncedSearchQuery('');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#1E293B] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Selection Summary & Quick Action Pills */}
              <div className="flex items-center justify-between text-xs px-0.5">
                <span className="font-semibold text-slate-600">
                  <span className="font-bold text-[#1E293B]">{selectedIds.length}</span>{' '}
                  personnel selected
                </span>
                <div className="flex items-center gap-2">
                  {availableFiltered.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="text-[11px] font-bold text-[#004AC6] hover:underline cursor-pointer"
                    >
                      Select All ({availableFiltered.length})
                    </button>
                  )}
                  {selectedIds.length > 0 && (
                    <>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Checkbox List */}
            <div className="overflow-y-auto p-2 space-y-1.5 flex-1 max-h-64">
              {filteredProfiles.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No personnel matching &quot;{debouncedSearchQuery}&quot;.
                </div>
              ) : (
                filteredProfiles.map((p) => {
                  const isChecked = selectedIds.includes(p.id);
                  const isAlreadyHere = currentAssignedIds.includes(p.id);
                  const badge = getRoleBadge(p.userRole);

                  // Current assignment status on this date
                  let statusBadge = null;
                  if (isAlreadyHere) {
                    statusBadge = (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Assigned Here
                      </span>
                    );
                  } else {
                    const currentAssign = allDayAssignments.find(
                      (a) => a.profileId === p.id
                    );
                    if (currentAssign) {
                      if (currentAssign.assignmentType === 'duty') {
                        const s = shiftSchedules.find(
                          (sched) => sched.id === currentAssign.shiftScheduleId
                        );
                        statusBadge = (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200">
                            In {s?.name || 'Shift'}
                          </span>
                        );
                      } else if (currentAssign.assignmentType === 'rest') {
                        statusBadge = (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            On Rest Day
                          </span>
                        );
                      } else if (currentAssign.assignmentType === 'travel') {
                        statusBadge = (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            On Travel Order
                          </span>
                        );
                      }
                    }
                  }

                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all select-none ${
                        isAlreadyHere
                          ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                          : isChecked
                          ? 'bg-blue-50/50 border-[#004AC6]/40 shadow-2xs cursor-pointer ring-1 ring-[#004AC6]/20'
                          : 'bg-white border-slate-200/70 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          disabled={isAlreadyHere}
                          checked={isChecked || isAlreadyHere}
                          onChange={() => !isAlreadyHere && handleToggleSelect(p.id)}
                          className="w-4 h-4 rounded text-[#004AC6] focus:ring-[#004AC6] shrink-0"
                        />
                        <div className="w-7 h-7 rounded-full bg-[#004AC6] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {p.avatarInitials || 'OP'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-[#1E293B] truncate">
                              {p.name}
                            </span>
                            <span
                              className={`text-[8px] font-semibold px-1 py-0.2 rounded border ${badge.badgeClass}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#757680] truncate">
                            {p.role} · <span className="font-mono">{p.badgeNumber}</span>
                            {p.defaultShift ? ` · Shift: ${p.defaultShift}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        {statusBadge}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Popover Footer: Commit Action Button */}
            <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSelectedIds([]);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={handleCommitAdd}
                style={{ backgroundColor: themeColor }}
                className="px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-2xs hover:brightness-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>
                  Add {selectedIds.length > 0 ? `(${selectedIds.length}) ` : ''}Officers
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
