'use client';

import React, { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { PrimaryButton, SecondaryButton, ToggleButton } from '@/components/button';
import { AreaItem } from './types';

export interface AreaFormModalProps {
  editingArea: AreaItem | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (payload: {
    editingAreaId: string | null;
    areaName: string;
    weatherMonitoring: boolean;
    portAvailability: boolean;
    portName: string;
  }) => Promise<void>;
}

export function AreaFormModal({
  editingArea,
  isSubmitting,
  onClose,
  onSave,
}: AreaFormModalProps) {
  const [areaName, setAreaName] = useState(editingArea?.name ?? '');
  const [weatherMonitoring, setWeatherMonitoring] = useState(
    editingArea?.weatherMonitoring ?? true
  );
  const [portAvailability, setPortAvailability] = useState(
    editingArea?.hasPort ?? false
  );
  const [portName, setPortName] = useState(
    editingArea && editingArea.hasPort && editingArea.portName !== 'None'
      ? editingArea.portName
      : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      editingAreaId: editingArea?.id ?? null,
      areaName,
      weatherMonitoring,
      portAvailability,
      portName,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !isSubmitting && onClose()}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden z-10"
      >
        <div className="px-6 py-4.5 border-b border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1E293B]">
              {editingArea ? 'Edit Monitoring Area' : 'Add New Monitoring Area'}
            </h2>
            <p className="text-xs text-[#757680]">
              {editingArea
                ? 'Update geographic zone and maritime port configurations'
                : 'Register new geographic zone and port details'}
            </p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-6 space-y-5">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="area-name"
                className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
              >
                Area Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="area-name"
                type="text"
                required
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="e.g., Cebu City, Mandaue, Talisay"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#1E293B]">
                  Weather Monitoring
                </span>
                <span className="text-xs text-[#757680]">
                  Include in meteorological telemetry updates
                </span>
              </div>
              <ToggleButton
                checked={weatherMonitoring}
                onChange={(val) => setWeatherMonitoring(val)}
              />
            </div>

            <hr className="border-t border-[#E2E8F0]" />

            <div className="flex items-center justify-between py-1">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#1E293B]">
                  Port/Pier Availability
                </span>
                <span className="text-xs text-[#757680]">
                  Enable maritime hub monitoring
                </span>
              </div>
              <ToggleButton
                checked={portAvailability}
                onChange={(val) => {
                  setPortAvailability(val);
                  if (!val) setPortName('');
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="port-name"
                className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
              >
                Port/Pier Name{' '}
                {portAvailability && <span className="text-rose-500">*</span>}
              </label>
              <input
                id="port-name"
                type="text"
                disabled={!portAvailability}
                required={portAvailability}
                value={portName}
                onChange={(e) => setPortName(e.target.value)}
                placeholder={
                  portAvailability
                    ? 'e.g., Pier 1, Cebu International Port'
                    : 'Disabled (No port available)'
                }
                className={`w-full border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm transition-all ${
                  portAvailability
                    ? 'bg-[#F8FAFC] text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15'
                    : 'bg-slate-100 text-slate-400 placeholder:text-slate-400 cursor-not-allowed opacity-60'
                }`}
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
            <SecondaryButton
              type="button"
              size="md"
              pill
              disabled={isSubmitting}
              onClick={onClose}
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
                : editingArea
                ? 'Save Changes'
                : 'Add Area'}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default AreaFormModal;
