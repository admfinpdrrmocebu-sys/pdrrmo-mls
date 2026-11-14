'use client';

import React from 'react';
import { Check, Edit2, MapPin, Ship, Trash2, X } from 'lucide-react';
import { AreaItem } from './types';

export interface AreaRowProps {
  area: AreaItem;
  canModifySettings: boolean;
  onEdit: (area: AreaItem) => void;
  onDelete: (area: AreaItem) => void;
}

export const AreaRow = React.memo(function AreaRow({
  area,
  canModifySettings,
  onEdit,
  onDelete,
}: AreaRowProps) {
  return (
    <tr className="hover:bg-slate-50/80 transition-colors group">
      {/* Name of the Area */}
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center shrink-0 border border-[#004AC6]/15">
            <MapPin className="w-4 h-4" />
          </div>
          <span className="font-semibold text-[#1E293B]">{area.name}</span>
        </div>
      </td>

      {/* Weather Status */}
      <td className="py-4 px-6 text-center">
        <div
          className={`inline-flex items-center justify-center w-6 h-6 rounded-md border ${
            area.weatherMonitoring
              ? 'bg-[#004AC6]/10 border-[#004AC6]/20 text-[#004AC6]'
              : 'bg-slate-50 border-slate-200 text-slate-300'
          }`}
        >
          {area.weatherMonitoring ? (
            <Check className="w-4 h-4" strokeWidth={2.5} />
          ) : (
            <X className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </td>

      {/* Port/Pier Availability */}
      <td className="py-4 px-6 text-center">
        <div
          className={`inline-flex items-center justify-center w-6 h-6 rounded-md border ${
            area.hasPort
              ? 'bg-[#004AC6]/10 border-[#004AC6]/20 text-[#004AC6]'
              : 'bg-slate-50 border-slate-200 text-slate-300'
          }`}
        >
          {area.hasPort ? (
            <Check className="w-4 h-4" strokeWidth={2.5} />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          )}
        </div>
      </td>

      {/* Port/Pier Name */}
      <td className="py-4 px-6">
        {area.hasPort && area.portName !== 'None' ? (
          <div className="flex items-center gap-2">
            <Ship className="w-3.5 h-3.5 text-[#004AC6] shrink-0" />
            <span className="text-[#505F76] font-medium">{area.portName}</span>
          </div>
        ) : (
          <span className="text-slate-400 italic">None</span>
        )}
      </td>

      {/* Actions */}
      <td className="py-4 px-6 text-right">
        {canModifySettings ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(area)}
              title="Edit Area"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#004AC6]/10 transition-colors cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(area)}
              title="Delete Area"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="text-slate-400 text-xs italic">View Only</span>
        )}
      </td>
    </tr>
  );
});
