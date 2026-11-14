import type { CustomDropdownOption } from '@/components/input';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  position: string;
  positionTitle?: string;
  shift?: string;
  status: 'Active' | 'Inactive';
  initials: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  lastActive?: string;
  createdAt?: string;
}

export interface PendingInvitation {
  id: string;
  email: string;
  position: string;
  positionTitle?: string;
  shift?: string;
  token?: string;
  status?: string;
  invitedAt: string;
  invitedBy: string;
  expiresAt?: string;
}

export interface ToastNotificationState {
  message: string;
  submessage?: string;
  type: 'success' | 'info' | 'warning';
}

export const defaultPositionOptions: CustomDropdownOption[] = [
  {
    value: 'Admin',
    label: 'Admin',
    description: 'Full System Access & Configuration',
    badge: 'System',
    badgeColor: 'bg-blue-50 text-[#004AC6]',
    dotColor: '#004AC6',
  },
  {
    value: 'Monitoring',
    label: 'Monitoring',
    description: 'Dashboard, Logs, and Roll Call Operations',
    badge: 'Operational',
    badgeColor: 'bg-sky-50 text-sky-700',
    dotColor: '#0284C7',
  },
  {
    value: 'Staff',
    label: 'Staff',
    description: 'Default View Access and Monitoring Telemetry',
    badge: 'Standard',
    badgeColor: 'bg-slate-100 text-[#505F76]',
    dotColor: '#505F76',
  },
];

export const defaultShiftScheduleOptions: CustomDropdownOption[] = [
  {
    value: 'Day Shift (Alpha)',
    label: 'Day Shift (Alpha)',
    description: '06:00 AM – 02:00 PM (0600H – 1400H) · 8 Hours',
    badge: '06:00 - 14:00',
    badgeColor: 'bg-blue-50 text-[#004AC6]',
    dotColor: '#004AC6',
  },
  {
    value: 'Swing Shift (Bravo)',
    label: 'Swing Shift (Bravo)',
    description: '02:00 PM – 10:00 PM (1400H – 2200H) · 8 Hours',
    badge: '14:00 - 22:00',
    badgeColor: 'bg-sky-50 text-sky-700',
    dotColor: '#0284C7',
  },
  {
    value: 'Graveyard Shift (Charlie)',
    label: 'Graveyard Shift (Charlie)',
    description: '10:00 PM – 06:00 AM (2200H – 0600H) · 8 Hours',
    badge: '22:00 - 06:00',
    badgeColor: 'bg-indigo-50 text-indigo-700',
    dotColor: '#4F46E5',
  },
];

export const defaultPositionFilterOptions: CustomDropdownOption[] = [
  { value: 'ALL', label: 'All Positions' },
  { value: 'Admin', label: 'Admin', dotColor: '#004AC6', badge: 'System', badgeColor: 'bg-blue-50 text-[#004AC6]' },
  { value: 'Monitoring', label: 'Monitoring', dotColor: '#0284C7', badge: 'Operational', badgeColor: 'bg-sky-50 text-sky-700' },
  { value: 'Staff', label: 'Staff', dotColor: '#505F76', badge: 'Standard', badgeColor: 'bg-slate-100 text-[#505F76]' },
];

export function getInitials(name: string): string {
  if (!name) return 'MO';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#004AC6', '#0284C7', '#BA1A1A', '#10B981', '#8B5CF6', '#F59E0B'];

export function getAvatarColor(idOrEmail: string): string {
  let hash = 0;
  for (let i = 0; i < idOrEmail.length; i++) {
    hash = idOrEmail.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function formatTimeAgo(isoString?: string | null): string {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Recently';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatInvitedDate(isoString?: string | null): string {
  if (!isoString) return 'Just now';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Recently';

  return (
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' · ' +
    date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  );
}

export interface AccessRoleRow {
  name: string;
  code: string;
  description?: string | null;
  badge?: string | null;
  badge_type?: string | null;
}

export function mapAccessRolesToOptions(rolesData: AccessRoleRow[]): CustomDropdownOption[] {
  if (!rolesData || rolesData.length === 0) return defaultPositionOptions;
  return rolesData.map((role) => ({
    value: role.name,
    label: role.name,
    description: role.description || `${role.name} Role`,
    badge: role.badge || role.name,
    badgeColor:
      role.badge_type === 'system'
        ? 'bg-blue-50 text-[#004AC6]'
        : role.badge_type === 'operational'
        ? 'bg-sky-50 text-sky-700'
        : 'bg-slate-100 text-[#505F76]',
    dotColor:
      role.badge_type === 'system'
        ? '#004AC6'
        : role.badge_type === 'operational'
        ? '#0284C7'
        : '#505F76',
  }));
}

export function normalizeEnumRole(positionValue: string): 'admin' | 'monitoring' | 'staff' {
  const lowerPos = (positionValue || '').toLowerCase();
  if (lowerPos.includes('admin')) return 'admin';
  if (lowerPos.includes('staff')) return 'staff';
  return 'monitoring';
}

export function buildPositionBadgeMap(
  positionOptions: CustomDropdownOption[]
): Map<string, CustomDropdownOption> {
  const map = new Map<string, CustomDropdownOption>();
  for (const opt of positionOptions) {
    map.set(opt.value.toLowerCase(), opt);
    map.set(opt.label.toLowerCase(), opt);
  }
  return map;
}

export function getPositionBadgeMeta(
  position: string,
  badgeMap: Map<string, CustomDropdownOption>
): { badgeColor: string; dotColor: string; label: string } {
  const found = badgeMap.get((position || '').toLowerCase());
  const lower = (position || '').toLowerCase();

  return {
    badgeColor:
      found?.badgeColor ||
      (lower.includes('admin')
        ? 'bg-blue-50 text-[#004AC6]'
        : lower.includes('monitoring')
        ? 'bg-sky-50 text-sky-700'
        : 'bg-slate-100 text-[#505F76]'),
    dotColor:
      found?.dotColor ||
      (lower.includes('admin')
        ? '#004AC6'
        : lower.includes('monitoring')
        ? '#0284C7'
        : '#505F76'),
    label: found?.label || position || found?.badge || 'Staff',
  };
}
