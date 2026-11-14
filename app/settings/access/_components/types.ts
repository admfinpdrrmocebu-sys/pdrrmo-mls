export interface RolePermission {
  screen: string;
  level: 'Full Access' | 'View Only' | 'None';
}

export interface RoleItem {
  id: string;
  code?: string;
  name: string;
  badge: string;
  badgeType: 'system' | 'operational' | 'standard';
  description: string;
  permissions: RolePermission[];
  isSystem?: boolean;
}

export interface ShiftScheduleItem {
  id: string;
  name: string;
  startTime: string; // "HH:MM" in 24-hr format
  endTime: string; // "HH:MM" in 24-hr format
  duration: string;
  description?: string;
  targetRole: string; // 'monitoring' | 'admin' | 'staff' | string
  sortOrder?: number;
  color?: string;
  isActive?: boolean;
}

export interface TimeSlotOption {
  value: string; // "HH:MM"
  time12: string; // "08:00 AM"
  military: string; // "0800H"
}

export interface RawDbAccessRoleRow {
  id: string;
  code?: string | null;
  name: string;
  badge?: string | null;
  badge_type?: string | null;
  description?: string | null;
  is_system?: boolean | null;
  permissions?: RolePermission[] | null;
}

export interface RawDbShiftScheduleRow {
  id: string;
  name: string;
  start_time?: string | null;
  end_time?: string | null;
  duration?: string | null;
  description?: string | null;
  target_role?: string | null;
  sort_order?: number | null;
  color?: string | null;
  is_active?: boolean | null;
}

export const defaultRoles: RoleItem[] = [
  {
    id: 'admin',
    code: 'admin',
    name: 'Admin',
    badge: 'System',
    badgeType: 'system',
    description: 'Full System Access & Configuration',
    isSystem: true,
    permissions: [
      { screen: 'Dashboard', level: 'Full Access' },
      { screen: 'Logs', level: 'Full Access' },
      { screen: 'Roll Call', level: 'Full Access' },
      { screen: 'Users', level: 'Full Access' },
      { screen: 'Archives', level: 'Full Access' },
      { screen: 'Settings', level: 'Full Access' },
      { screen: 'Announcements', level: 'Full Access' },
      { screen: 'Shifts', level: 'Full Access' },
      { screen: 'Affiliated Apps', level: 'Full Access' },
      { screen: 'Screen Projector', level: 'Full Access' },
      { screen: 'Drone Stream', level: 'Full Access' },
    ],
  },
  {
    id: 'monitoring',
    code: 'monitoring',
    name: 'Monitoring Officer',
    badge: 'Operational',
    badgeType: 'operational',
    description: 'Dashboard, Logs, and Roll Call Operations',
    isSystem: true,
    permissions: [
      { screen: 'Dashboard', level: 'Full Access' },
      { screen: 'Logs', level: 'Full Access' },
      { screen: 'Roll Call', level: 'Full Access' },
      { screen: 'Users', level: 'None' },
      { screen: 'Archives', level: 'View Only' },
      { screen: 'Settings', level: 'None' },
      { screen: 'Announcements', level: 'Full Access' },
      { screen: 'Shifts', level: 'Full Access' },
      { screen: 'Affiliated Apps', level: 'View Only' },
      { screen: 'Screen Projector', level: 'View Only' },
      { screen: 'Drone Stream', level: 'Full Access' },
    ],
  },
  {
    id: 'staff',
    code: 'staff',
    name: 'Staff',
    badge: 'Standard',
    badgeType: 'standard',
    description: 'Default View Access and Monitoring Telemetry',
    isSystem: true,
    permissions: [
      { screen: 'Dashboard', level: 'View Only' },
      { screen: 'Logs', level: 'None' },
      { screen: 'Roll Call', level: 'None' },
      { screen: 'Users', level: 'None' },
      { screen: 'Archives', level: 'View Only' },
      { screen: 'Settings', level: 'None' },
      { screen: 'Announcements', level: 'View Only' },
      { screen: 'Shifts', level: 'View Only' },
      { screen: 'Affiliated Apps', level: 'View Only' },
      { screen: 'Screen Projector', level: 'View Only' },
      { screen: 'Drone Stream', level: 'View Only' },
    ],
  },
];

const generateTimeOptions = (): TimeSlotOption[] => {
  const options: TimeSlotOption[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (const min of [0, 30]) {
      const hStr = String(hour).padStart(2, '0');
      const mStr = String(min).padStart(2, '0');
      const value = `${hStr}:${mStr}`;
      const military = `${hStr}${mStr}H`;

      const ampm = hour >= 12 ? 'PM' : 'AM';
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      const time12 = `${String(h12).padStart(2, '0')}:${mStr} ${ampm}`;

      options.push({
        value,
        time12,
        military,
      });
    }
  }
  return options;
};

export const allTimeOptions = generateTimeOptions();

export const formatTimeDisplay = (time24: string): string => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${mStr} ${ampm} (${hStr}${mStr}H)`;
};

export const calculateDuration = (start: string, end: string): string => {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return '';

  let totalMinutes = eh * 60 + em - (sh * 60 + sm);
  if (totalMinutes <= 0) {
    totalMinutes += 24 * 60; // Crosses midnight
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} Hours`;
};

export const getRoleDisplayNameFromList = (
  rolesList: RoleItem[],
  roleCode?: string
): string => {
  if (!roleCode) return 'Unassigned';
  const lower = roleCode.toLowerCase();
  const found = rolesList.find(
    (r) =>
      r.code?.toLowerCase() === lower ||
      r.id?.toLowerCase() === lower ||
      r.name.toLowerCase() === lower
  );
  if (found) return found.name;
  if (lower === 'admin') return 'Admin';
  if (lower === 'monitoring') return 'Monitoring Officer';
  if (lower === 'staff') return 'Staff';
  return roleCode;
};

export const mapDbRoleRow = (r: RawDbAccessRoleRow): RoleItem => {
  const rawPerms: RolePermission[] = Array.isArray(r.permissions)
    ? [...r.permissions]
    : [];
  const isRoleAdmin =
    (r.code || '').toLowerCase() === 'admin' ||
    (r.name || '').toLowerCase() === 'admin';

  if (
    !rawPerms.some((p) => (p.screen || '').toLowerCase() === 'screen projector')
  ) {
    rawPerms.push({
      screen: 'Screen Projector',
      level: isRoleAdmin ? 'Full Access' : 'View Only',
    });
  }
  if (
    !rawPerms.some((p) => (p.screen || '').toLowerCase() === 'affiliated apps')
  ) {
    rawPerms.push({
      screen: 'Affiliated Apps',
      level: isRoleAdmin ? 'Full Access' : 'View Only',
    });
  }

  const badgeType =
    r.badge_type === 'system' ||
    r.badge_type === 'operational' ||
    r.badge_type === 'standard'
      ? r.badge_type
      : 'operational';

  return {
    id: r.id,
    code: r.code ?? undefined,
    name: r.name,
    badge: r.badge || 'Operational',
    badgeType,
    description: r.description || '',
    isSystem: r.is_system ?? false,
    permissions: rawPerms,
  };
};

export const mapDbShiftRow = (s: RawDbShiftScheduleRow): ShiftScheduleItem => {
  const startTime = s.start_time || '08:00';
  const endTime = s.end_time || '16:00';
  return {
    id: s.id,
    name: s.name,
    startTime,
    endTime,
    duration: s.duration || calculateDuration(startTime, endTime) || '8 Hours',
    description: s.description || '',
    targetRole: s.target_role || 'monitoring',
    sortOrder: s.sort_order ?? 1,
    color: s.color || '#004AC6',
    isActive: s.is_active ?? true,
  };
};

export const computeAccessSignature = (
  rolesList: RoleItem[],
  shiftsList: ShiftScheduleItem[]
): string => {
  const roleSig = rolesList
    .map(
      (r) =>
        `${r.id}:${r.code || ''}:${r.name}:${r.description}:${r.badge}:${r.permissions
          .map((p) => `${p.screen}=${p.level}`)
          .join(',')}`
    )
    .join('|');
  const shiftSig = shiftsList
    .map(
      (s) =>
        `${s.id}:${s.name}:${s.startTime}-${s.endTime}:${s.targetRole}:${s.sortOrder ?? 1}`
    )
    .join('|');
  return `${roleSig}##${shiftSig}`;
};

export const broadcastRolesUpdate = (updatedRolesList: RoleItem[]): void => {
  try {
    localStorage.setItem(
      'pdrrmo_custom_roles',
      JSON.stringify(updatedRolesList)
    );
  } catch {
    // Ignore storage quota errors
  }

  if (typeof window !== 'undefined') {
    try {
      const bc = new BroadcastChannel('pdrrmo_roles_sync');
      bc.postMessage({
        type: 'ROLES_UPDATED',
        roles: updatedRolesList,
        timestamp: Date.now(),
      });
      bc.close();
    } catch {
      // Ignore BroadcastChannel errors in unsupported contexts
    }
    try {
      localStorage.setItem('pdrrmo_roles_sync', Date.now().toString());
    } catch {
      // Ignore storage errors
    }
  }
};
