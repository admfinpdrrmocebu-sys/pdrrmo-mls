'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import {
  RoleItem,
  ShiftScheduleItem,
  allTimeOptions,
  calculateDuration,
  formatTimeDisplay,
  getRoleDisplayNameFromList,
} from './types';

interface TimePickerDropdownProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
}

function TimePickerDropdown({ label, value, onChange }: TimePickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
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

  const currentOption = allTimeOptions.find((opt) => opt.value === value) || {
    value,
    time12: formatTimeDisplay(value).split(' (')[0],
    military: `${value.replace(':', '')}H`,
  };

  const filteredOptions = allTimeOptions.filter((opt) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      opt.value.includes(query) ||
      opt.time12.toLowerCase().includes(query) ||
      opt.military.toLowerCase().includes(query)
    );
  });

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={dropdownRef} className="space-y-1.5 relative w-full">
      <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[11px] font-mono text-[#505F76] font-semibold">
          {currentOption.military}
        </span>
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-[#F8FAFC] border rounded-full py-2.5 px-4 text-left transition-all cursor-pointer flex items-center justify-between group shadow-2xs ${
          isOpen
            ? 'border-[#004AC6] bg-white ring-2 ring-[#004AC6]/15'
            : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#1E293B] font-mono">
            {currentOption.time12}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-[#505F76] font-mono">
            {currentOption.military}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-[#757680] group-hover:text-[#1E293B] transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#004AC6]' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl overflow-hidden flex flex-col w-full ring-1 ring-black/5"
          >
            <div className="p-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search time (e.g., 08:00, 2 PM, 1400H)..."
                  className="w-full bg-white border border-[#E2E8F0] rounded-full py-1.5 pl-8 pr-3 text-xs text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#1E293B]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#757680]">
                  No matching time slots found for &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full px-3 py-2 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#004AC6]/10 text-[#004AC6] font-bold'
                          : 'hover:bg-slate-50 text-[#1E293B]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold font-mono">
                          {opt.time12}
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-[#505F76] font-medium">
                          {opt.military}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#004AC6] stroke-[2.5]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface ShiftModalProps {
  editingShift: ShiftScheduleItem | null;
  initialPresetRole: string;
  roles: RoleItem[];
  shiftSchedules: ShiftScheduleItem[];
  roleDropdownOptions: CustomDropdownOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (payload: {
    editingShiftId: string | null;
    shiftName: string;
    startShiftTime: string;
    endShiftTime: string;
    targetRole: string;
    sortOrder: number;
    isDefaultSchedule: boolean;
  }) => Promise<void>;
}

export function ShiftModal({
  editingShift,
  initialPresetRole,
  roles,
  shiftSchedules,
  roleDropdownOptions,
  isSubmitting,
  onClose,
  onSave,
}: ShiftModalProps) {
  const defaultInitialRole = editingShift
    ? editingShift.targetRole || roleDropdownOptions[0]?.value || 'monitoring'
    : initialPresetRole;

  const initialIsDefault = editingShift
    ? (editingShift.sortOrder ?? 0) === 0
    : defaultInitialRole.toLowerCase() !== 'monitoring';

  const initialSortOrder = editingShift
    ? editingShift.sortOrder ?? (initialIsDefault ? 0 : 1)
    : initialIsDefault
    ? 0
    : shiftSchedules.filter(
        (s) =>
          s.targetRole?.toLowerCase() === defaultInitialRole.toLowerCase() &&
          (s.sortOrder ?? 0) > 0
      ).length + 1;

  const [shiftName, setShiftName] = useState(editingShift?.name ?? '');
  const [startShiftTime, setStartShiftTime] = useState(
    editingShift?.startTime ?? '08:00'
  );
  const [endShiftTime, setEndShiftTime] = useState(
    editingShift?.endTime ?? '16:00'
  );
  const [targetRole, setTargetRole] = useState(defaultInitialRole);
  const [isDefaultSchedule, setIsDefaultSchedule] = useState(initialIsDefault);
  const [sortOrder, setSortOrder] = useState(initialSortOrder);

  const handleTargetRoleChange = (newRole: string) => {
    setTargetRole(newRole);
    if (!editingShift) {
      const isNonMonitoring = newRole.toLowerCase() !== 'monitoring';
      setIsDefaultSchedule(isNonMonitoring);
      if (isNonMonitoring) {
        setSortOrder(0);
      } else {
        const existingCount = shiftSchedules.filter(
          (s) =>
            s.targetRole?.toLowerCase() === newRole.toLowerCase() &&
            (s.sortOrder ?? 0) > 0
        ).length;
        setSortOrder(existingCount + 1);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      editingShiftId: editingShift?.id ?? null,
      shiftName,
      startShiftTime,
      endShiftTime,
      targetRole,
      sortOrder,
      isDefaultSchedule,
    });
  };

  const targetRoleDisplayName = getRoleDisplayNameFromList(roles, targetRole);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl w-full max-w-lg overflow-visible z-10"
      >
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between rounded-t-3xl">
          <div>
            <h2 className="text-lg font-bold text-[#1E293B]">
              {editingShift ? 'Edit Shift Schedule' : 'Add Shift Schedule'}
            </h2>
            <p className="text-xs text-[#757680]">
              Customize shift duration and timetable for {targetRoleDisplayName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="shiftName"
              className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
            >
              Shift Name
            </label>
            <input
              id="shiftName"
              type="text"
              required
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
              placeholder="e.g., Morning Shift (Alpha), Swing Shift (Bravo)"
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide flex items-center justify-between">
                <span>Target Role</span>
                <span className="text-[11px] text-[#94A3B8] font-medium lowercase">
                  What role is this for?
                </span>
              </label>
              <CustomDropdown
                options={roleDropdownOptions}
                value={targetRole}
                onChange={handleTargetRoleChange}
                placeholder="Select Target Role"
                leftIcon={<Shield className="w-4 h-4 text-[#004AC6]" />}
                size="md"
                pill
              />
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1E293B]">
                    Default / General Schedule
                  </span>
                  {isDefaultSchedule && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-[#505F76] font-mono">
                      Sort = 0
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#757680] leading-relaxed">
                  {isDefaultSchedule
                    ? 'Standard / default schedule for general rosters (Sort = 0). Excluded from 24/7 monitoring logs sequence.'
                    : 'Participates in the 24/7 rotational monitoring logs sequence (Sort ≥ 1).'}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isDefaultSchedule}
                onClick={() => {
                  const nextVal = !isDefaultSchedule;
                  setIsDefaultSchedule(nextVal);
                  if (nextVal) {
                    setSortOrder(0);
                  } else {
                    const existingCount = shiftSchedules.filter(
                      (s) =>
                        s.targetRole?.toLowerCase() === targetRole.toLowerCase() &&
                        (s.sortOrder ?? 0) > 0
                    ).length;
                    setSortOrder(existingCount > 0 ? existingCount + 1 : 1);
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#004AC6]/30 ${
                  isDefaultSchedule ? 'bg-[#004AC6]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isDefaultSchedule ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {!isDefaultSchedule && (
              <div className="flex flex-col gap-1.5 pt-1">
                <label
                  htmlFor="sortOrder"
                  className="text-xs font-semibold text-[#505F76] uppercase tracking-wide flex items-center justify-between"
                >
                  <span>Monitoring Sequence Position</span>
                  <span className="text-[11px] text-[#004AC6] font-bold font-mono">
                    Position #{sortOrder}
                  </span>
                </label>
                <div className="relative">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="sortOrder"
                    type="number"
                    min={1}
                    max={99}
                    required
                    value={sortOrder || 1}
                    onChange={(e) =>
                      setSortOrder(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full pl-9 pr-3 py-2.5 text-sm text-[#1E293B] font-mono font-bold focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  />
                </div>
                <p className="text-[11px] text-[#757680] px-1">
                  Position 1 = &quot;Start of monitoring Duty&quot;. Last position = Triggers 24-Hour Consolidated Archive on End Shift.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TimePickerDropdown
                label="Start Shift"
                value={startShiftTime}
                onChange={setStartShiftTime}
              />
              <TimePickerDropdown
                label="End Shift"
                value={endShiftTime}
                onChange={setEndShiftTime}
              />
            </div>
          </div>

          <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-[#E2E8F0] flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-[#505F76] block">
                Calculated Shift Duration:
              </span>
              <span className="text-[11px] text-[#94A3B8]">
                From {formatTimeDisplay(startShiftTime)} to{' '}
                {formatTimeDisplay(endShiftTime)}
              </span>
            </div>
            <span className="text-sm font-bold text-[#004AC6] bg-white border border-[#E2E8F0] px-3 py-1 rounded-full shadow-2xs font-mono">
              {calculateDuration(startShiftTime, endShiftTime) || '8 Hours'}
            </span>
          </div>

          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
            <SecondaryButton
              type="button"
              size="md"
              pill
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </SecondaryButton>

            <PrimaryButton
              type="submit"
              size="md"
              pill
              disabled={isSubmitting}
              leftIcon={
                isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )
              }
            >
              {isSubmitting
                ? 'Saving...'
                : editingShift
                ? 'Save Changes'
                : 'Add Shift Schedule'}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default ShiftModal;
