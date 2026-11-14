'use client';

import React from 'react';
import { Ban, CheckCircle2, Edit2, Trash2 } from 'lucide-react';
import { RoleItem } from './types';

export interface RoleCardProps {
  role: RoleItem;
  isAccessViewOnly: boolean;
  onEdit: (role: RoleItem) => void;
  onDelete: (role: RoleItem) => void;
}

export const RoleCard = React.memo(function RoleCard({
  role,
  isAccessViewOnly,
  onEdit,
  onDelete,
}: RoleCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 relative overflow-hidden group">
      {/* Role Header */}
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base font-bold text-[#1E293B]">{role.name}</h3>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                role.badgeType === 'system'
                  ? 'bg-blue-50 text-[#004AC6] border-blue-200'
                  : role.badgeType === 'operational'
                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {role.badge}
            </span>
            {role.isSystem && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                Protected
              </span>
            )}
          </div>
          <p className="text-xs text-[#757680] mt-1 font-medium leading-relaxed">
            {role.description || 'System access role definition'}
          </p>
        </div>

        {/* Edit & Delete Actions */}
        {!isAccessViewOnly && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(role)}
              title="Edit Role"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#004AC6]/10 transition-colors cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {!role.isSystem && (
              <button
                type="button"
                onClick={() => onDelete(role)}
                title="Delete Role"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Screen Access Badges */}
      <div>
        <p className="text-[11px] font-semibold text-[#757680] uppercase tracking-wider mb-2.5">
          Screen Access Permissions
        </p>
        <div className="flex flex-wrap gap-2">
          {role.permissions.map((p) => {
            const isGranted = p.level !== 'None';

            return (
              <span
                key={p.screen}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border transition-all ${
                  isGranted
                    ? 'bg-[#F8FAFC] text-[#1E293B] border-[#E2E8F0]'
                    : 'bg-[#F8FAFC]/50 text-[#94A3B8] border-dashed border-[#CBD5E1] opacity-60'
                }`}
              >
                {isGranted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#004AC6]" />
                ) : (
                  <Ban className="w-3.5 h-3.5 text-[#94A3B8]" />
                )}
                <span>
                  {p.screen}
                  {p.level === 'View Only' && ' (View Only)'}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
});
