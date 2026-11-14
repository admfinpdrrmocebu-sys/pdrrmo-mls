'use client';

import React from 'react';
import { X, Save, Loader2, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import type { EditLguFormState, LGUAnalyticsSummary } from './types';

export interface EditLguModalProps {
  isOpen: boolean;
  editingLgu: LGUAnalyticsSummary | null;
  editLguForm: EditLguFormState;
  isSavingLgu: boolean;
  onChangeForm: React.Dispatch<React.SetStateAction<EditLguFormState>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function EditLguModal({
  isOpen,
  editingLgu,
  editLguForm,
  isSavingLgu,
  onChangeForm,
  onSubmit,
  onClose,
}: EditLguModalProps) {
  return (
    <AnimatePresence>
      {isOpen && editingLgu && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full sm:max-w-lg bg-white rounded-t-[1.75rem] sm:rounded-[1.75rem] border border-[#E2E8F0] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center font-bold shrink-0">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
                    Edit LGU Station Details
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#505F76]">
                    Update municipality name and coastal seaport metadata
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={onSubmit} className="flex-1 overflow-y-auto">
              <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                    Municipality / City Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editLguForm.name}
                    onChange={(e) =>
                      onChangeForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="e.g. Alcantara"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#004AC6]"
                  />
                </div>

                {/* Coastal / Port Presence Toggle */}
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#1E293B] block">
                        Coastal Seaport Presence
                      </span>
                      <span className="text-[11px] text-[#505F76]">
                        Enable if this LGU has an operational seaport or pier
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editLguForm.hasPort}
                      onChange={(e) =>
                        onChangeForm((prev) => ({
                          ...prev,
                          hasPort: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded text-[#004AC6] focus:ring-[#004AC6] cursor-pointer"
                    />
                  </div>

                  {editLguForm.hasPort && (
                    <div>
                      <label className="block text-xs font-bold text-[#1E293B] mb-1">
                        Port / Pier Name
                      </label>
                      <input
                        type="text"
                        value={editLguForm.portName}
                        onChange={(e) =>
                          onChangeForm((prev) => ({
                            ...prev,
                            portName: e.target.value,
                          }))
                        }
                        placeholder="e.g. Bayut Port"
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#004AC6]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end gap-3">
                <SecondaryButton
                  size="sm"
                  pill
                  type="button"
                  onClick={onClose}
                >
                  Cancel
                </SecondaryButton>

                <PrimaryButton
                  size="sm"
                  pill
                  type="submit"
                  disabled={isSavingLgu}
                  leftIcon={
                    isSavingLgu ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {isSavingLgu ? 'Saving...' : 'Save LGU Details'}
                </PrimaryButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
