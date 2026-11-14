'use client';

import React from 'react';
import {
  Users,
  Mail,
  MoreVertical,
  Edit2,
  Trash2,
  Clock,
  Copy,
  RotateCw,
  UserCheck,
  UserX,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CustomDropdownOption } from '@/components/input';
import { UserAvatar } from './user-avatar';
import {
  getPositionBadgeMeta,
  type PendingInvitation,
  type UserAccount,
} from './types';

export function UsersTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full divide-y divide-[#E2E8F0] animate-pulse">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="py-4 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-[200px]">
            <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-32 bg-slate-200 rounded-md" />
              <div className="h-3 w-20 bg-slate-200 rounded-md" />
            </div>
          </div>
          <div className="h-6 w-24 bg-slate-200 rounded-full hidden sm:block" />
          <div className="h-4 w-36 bg-slate-200 rounded-md hidden md:block" />
          <div className="h-6 w-20 bg-slate-200 rounded-full" />
          <div className="w-8 h-8 bg-slate-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

const PositionBadge = React.memo(function PositionBadge({
  position,
  positionBadgeMap,
}: {
  position: string;
  positionBadgeMap: Map<string, CustomDropdownOption>;
}) {
  const { badgeColor, dotColor, label } = getPositionBadgeMeta(position, positionBadgeMap);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-slate-200/60 shadow-2xs ${badgeColor}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
      {label}
    </span>
  );
});

export interface UsersDirectoryTableProps {
  isLoading: boolean;
  activeTab: 'official' | 'pending';
  paginatedUsers: UserAccount[];
  paginatedInvitations: PendingInvitation[];
  searchQuery: string;
  selectedPositionFilter: string;
  canModifyUsers: boolean;
  activeMenuId: string | null;
  positionBadgeMap: Map<string, CustomDropdownOption>;
  onToggleMenu: (id: string) => void;
  onEditUser: (user: UserAccount) => void;
  onToggleStatus: (user: UserAccount) => void;
  onDeleteUser: (user: UserAccount) => void;
  onResendInvitation: (inv: PendingInvitation) => void;
  onCopyInviteLink: (inv: PendingInvitation) => void;
  onRevokeInvitation: (invitationId: string) => void;
}

export const UsersDirectoryTable = React.memo(function UsersDirectoryTable({
  isLoading,
  activeTab,
  paginatedUsers,
  paginatedInvitations,
  searchQuery,
  selectedPositionFilter,
  canModifyUsers,
  activeMenuId,
  positionBadgeMap,
  onToggleMenu,
  onEditUser,
  onToggleStatus,
  onDeleteUser,
  onResendInvitation,
  onCopyInviteLink,
  onRevokeInvitation,
}: UsersDirectoryTableProps) {
  if (isLoading) {
    return <UsersTableSkeleton rows={5} />;
  }

  if (activeTab === 'official') {
    return (
      <table className="w-full text-left border-collapse min-w-[760px]">
        <thead>
          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider">
            <th className="py-4 px-6">Full Name</th>
            <th className="py-4 px-6">Position</th>
            <th className="py-4 px-6">Email Address</th>
            <th className="py-4 px-6">Status</th>
            <th className="py-4 px-6 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0] text-sm">
          {paginatedUsers.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-12 text-center text-[#757680]">
                <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-sm">No official users found</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  {searchQuery || selectedPositionFilter !== 'ALL'
                    ? 'Try adjusting your search query or position filters.'
                    : 'Click "Invite User" to onboard team members.'}
                </p>
              </td>
            </tr>
          ) : (
            paginatedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-[#F8FAFC]/80 transition-colors group">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={user} size="md" showStatus />
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#1E293B] group-hover:text-[#004AC6] transition-colors">
                        {user.name}
                      </span>
                      <span className="text-xs text-[#757680] font-mono">
                        {user.id.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                </td>

                <td className="py-4 px-6">
                  <div className="flex flex-col gap-1 items-start">
                    <PositionBadge
                      position={user.position}
                      positionBadgeMap={positionBadgeMap}
                    />
                    {user.shift && (
                      <span className="text-[11px] text-[#505F76] font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#94A3B8]" />
                        {user.shift}
                      </span>
                    )}
                  </div>
                </td>

                <td className="py-4 px-6 text-[#505F76] font-mono text-xs">{user.email}</td>

                <td className="py-4 px-6">
                  {user.status === 'Active' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[#505F76] text-xs font-semibold border border-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Inactive
                    </span>
                  )}
                </td>

                <td className="py-4 px-6 text-right relative">
                  {canModifyUsers ? (
                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMenu(user.id);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                        aria-label="User actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      <AnimatePresence>
                        {activeMenuId === user.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            transition={{ duration: 0.12 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 mt-2 w-48 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5"
                          >
                            <button
                              type="button"
                              onClick={() => onEditUser(user)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#505F76]" />
                              Edit Account
                            </button>

                            <button
                              type="button"
                              onClick={() => onToggleStatus(user)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                            >
                              {user.status === 'Active' ? (
                                <>
                                  <UserX className="w-3.5 h-3.5 text-amber-600" />
                                  Deactivate User
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  Activate User
                                </>
                              )}
                            </button>

                            <div className="h-px bg-[#E2E8F0] my-1" />

                            <button
                              type="button"
                              onClick={() => onDeleteUser(user)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove User
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs italic">View Only</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full text-left border-collapse min-w-[700px]">
      <thead>
        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider">
          <th className="py-4 px-6">Email Address</th>
          <th className="py-4 px-6">Assigned Position</th>
          <th className="py-4 px-6">Dispatched At</th>
          <th className="py-4 px-6 text-right">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#E2E8F0] text-sm">
        {paginatedInvitations.length === 0 ? (
          <tr>
            <td colSpan={4} className="py-12 text-center text-[#757680]">
              <Mail className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-sm">No pending invitations</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Click &quot;Invite User&quot; above to dispatch new SMTP onboarding emails.
              </p>
            </td>
          </tr>
        ) : (
          paginatedInvitations.map((inv) => (
            <tr key={inv.id} className="hover:bg-[#F8FAFC]/80 transition-colors group">
              <td className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#1E293B] group-hover:text-[#004AC6] transition-colors">
                      {inv.email}
                    </span>
                    <span className="text-[11px] text-[#757680]">
                      Invited by {inv.invitedBy}
                    </span>
                  </div>
                </div>
              </td>

              <td className="py-4 px-6">
                <div className="flex flex-col gap-1 items-start">
                  <PositionBadge
                    position={inv.position}
                    positionBadgeMap={positionBadgeMap}
                  />
                  {inv.shift && (
                    <span className="text-[11px] text-[#505F76] font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#94A3B8]" />
                      {inv.shift}
                    </span>
                  )}
                </div>
              </td>

              <td className="py-4 px-6">
                <div className="flex items-center gap-1.5 text-xs text-[#505F76] font-medium">
                  <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span>{inv.invitedAt}</span>
                </div>
              </td>

              <td className="py-4 px-6 text-right relative">
                {canModifyUsers ? (
                  <div className="relative inline-block text-left">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMenu(inv.id);
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                      aria-label="Invitation actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {activeMenuId === inv.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                          transition={{ duration: 0.12 }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 mt-2 w-48 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5"
                        >
                          <button
                            type="button"
                            onClick={() => onResendInvitation(inv)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-[#505F76]" />
                            Resend via SMTP
                          </button>

                          <button
                            type="button"
                            onClick={() => onCopyInviteLink(inv)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-[#505F76]" />
                            Copy Invite Link
                          </button>

                          <div className="h-px bg-[#E2E8F0] my-1" />

                          <button
                            type="button"
                            onClick={() => onRevokeInvitation(inv.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Revoke Invitation
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs italic">View Only</span>
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
});
