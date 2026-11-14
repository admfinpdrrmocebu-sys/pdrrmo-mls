'use client';

import React from 'react';
import { MoreVertical, Edit2, Trash2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ReportTypeItem } from './types';

interface ReportTypeRowProps {
  item: ReportTypeItem;
  isMenuOpen: boolean;
  canModify: boolean;
  onToggleMenu: (id: string, e: React.MouseEvent) => void;
  onView: (item: ReportTypeItem) => void;
  onEdit: (item: ReportTypeItem) => void;
  onDelete: (item: ReportTypeItem) => void;
}

const ReportTypeRow = React.memo(function ReportTypeRow({
  item,
  isMenuOpen,
  canModify,
  onToggleMenu,
  onView,
  onEdit,
  onDelete,
}: ReportTypeRowProps) {
  return (
    <tr
      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
      onClick={() => onView(item)}
    >
      {/* Name with Color Indicator */}
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
            style={{ backgroundColor: item.color || '#004AC6' }}
          />
          <span className="font-semibold text-[#1E293B] group-hover:text-[#004AC6] transition-colors">
            {item.name}
          </span>
        </div>
      </td>

      {/* Code */}
      <td className="py-4 px-6 font-mono text-xs text-[#505F76]">
        <span className="bg-[#F1F5F9] px-2.5 py-1 rounded-md border border-[#E2E8F0] font-semibold text-[11px]">
          {item.code}
        </span>
      </td>

      {/* Last Updated */}
      <td className="py-4 px-6 text-xs text-[#505F76]">
        <div className="flex flex-col">
          <span className="font-medium text-[#1E293B]">{item.updatedAt}</span>
          <span className="text-[11px] text-[#94A3B8]">{item.updatedBy}</span>
        </div>
      </td>

      {/* Three Dots Menu */}
      <td
        className="py-4 px-6 text-right relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative inline-block text-left">
          <button
            type="button"
            title="Options"
            onClick={(e) => onToggleMenu(item.id, e)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown Menu Choices Card */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                transition={{ duration: 0.12 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-9 z-40 w-36 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-1.5 space-y-1 text-left ring-1 ring-black/5"
              >
                <button
                  type="button"
                  onClick={() => onView(item)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[#004AC6]" />
                  <span>View</span>
                </button>
                {canModify && (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#505F76]" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </td>
    </tr>
  );
});

export default ReportTypeRow;
