'use client';

import React, { useState } from 'react';
import {
  Archive,
  Calendar,
  Drone,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  Megaphone,
  Plus,
  Projector,
  Radio,
  Settings as SettingsIcon,
  Users,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { RoleItem } from './types';

const screenList = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Logs', icon: FileText },
  { name: 'Roll Call', icon: Radio },
  { name: 'Users', icon: Users },
  { name: 'Archives', icon: Archive },
  { name: 'Settings', icon: SettingsIcon },
  { name: 'Announcements', icon: Megaphone },
  { name: 'Shifts', icon: Calendar },
  { name: 'Affiliated Apps', icon: LayoutGrid },
  { name: 'Screen Projector', icon: Projector },
  { name: 'Drone Stream', icon: Drone },
];

type PermissionLevel = 'View Only' | 'Full Access' | 'None';

function buildInitialPermissions(
  editingRole: RoleItem | null
): Record<string, PermissionLevel> {
  if (!editingRole) {
    return {
      Dashboard: 'View Only',
      Logs: 'Full Access',
      'Roll Call': 'View Only',
      Users: 'None',
      Archives: 'View Only',
      Settings: 'None',
      Announcements: 'Full Access',
      Shifts: 'Full Access',
      'Affiliated Apps': 'View Only',
      'Screen Projector': 'View Only',
      'Drone Stream': 'View Only',
    };
  }

  const isRoleAdmin =
    (editingRole.code || '').toLowerCase() === 'admin' ||
    (editingRole.name || '').toLowerCase() === 'admin';

  const permMap: Record<string, PermissionLevel> = {
    Dashboard: 'None',
    Logs: 'None',
    'Roll Call': 'None',
    Users: 'None',
    Archives: 'None',
    Settings: 'None',
    Announcements: 'None',
    Shifts: 'None',
    'Affiliated Apps': isRoleAdmin ? 'Full Access' : 'View Only',
    'Screen Projector': isRoleAdmin ? 'Full Access' : 'View Only',
    'Drone Stream': isRoleAdmin ? 'Full Access' : 'View Only',
  };

  if (Array.isArray(editingRole.permissions)) {
    editingRole.permissions.forEach((p) => {
      permMap[p.screen] = p.level;
    });
  }
  return permMap;
}

export interface RoleModalProps {
  editingRole: RoleItem | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (payload: {
    editingRoleId: string | null;
    name: string;
    description: string;
    permissions: Record<string, PermissionLevel>;
  }) => Promise<void>;
}

export function RoleModal({
  editingRole,
  isSubmitting,
  onClose,
  onSave,
}: RoleModalProps) {
  const [roleName, setRoleName] = useState(editingRole?.name ?? '');
  const [roleDescription, setRoleDescription] = useState(
    editingRole?.description ?? ''
  );
  const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>(
    () => buildInitialPermissions(editingRole)
  );

  const handlePermissionChange = (screen: string, level: PermissionLevel) => {
    setPermissions((prev) => ({ ...prev, [screen]: level }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      editingRoleId: editingRole?.id ?? null,
      name: roleName,
      description: roleDescription,
      permissions,
    });
  };

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
        className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden z-10"
      >
        <div className="px-6 py-4.5 border-b border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1E293B]">
              {editingRole ? 'Edit User Role' : 'Add New User Role'}
            </h2>
            <p className="text-xs text-[#757680]">
              Define access levels across core system screens
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

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="roleName"
                className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
              >
                Role Name
              </label>
              <input
                id="roleName"
                type="text"
                required
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g., Tactical Officer, Logistics Lead"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="roleDescription"
                className="text-xs font-semibold text-[#505F76] uppercase tracking-wide"
              >
                Description
              </label>
              <input
                id="roleDescription"
                type="text"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="e.g., Communications and field emergency dispatcher"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
              />
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#1E293B] border-b border-[#E2E8F0] pb-2 mb-3">
                Screen Access Permissions
              </h3>

              <div className="space-y-2">
                {screenList.map((screenItem, index) => {
                  const Icon = screenItem.icon;
                  const currentLevel = permissions[screenItem.name] || 'None';

                  return (
                    <div
                      key={screenItem.name}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl transition-colors gap-2 ${
                        index % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'
                      } border border-transparent hover:border-[#E2E8F0]`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-[#004AC6]" />
                        <span className="text-sm font-semibold text-[#1E293B]">
                          {screenItem.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        {(['View Only', 'Full Access', 'None'] as const).map(
                          (level) => (
                            <label
                              key={level}
                              className="flex items-center gap-1.5 cursor-pointer text-[#505F76] hover:text-[#1E293B]"
                            >
                              <input
                                type="radio"
                                name={`perm_${screenItem.name}`}
                                checked={currentLevel === level}
                                onChange={() =>
                                  handlePermissionChange(screenItem.name, level)
                                }
                                className="text-[#004AC6] focus:ring-[#004AC6] h-3.5 w-3.5 cursor-pointer accent-[#004AC6]"
                              />
                              <span>{level}</span>
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between">
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
                : editingRole
                ? 'Save Changes'
                : 'Create Role'}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default RoleModal;
