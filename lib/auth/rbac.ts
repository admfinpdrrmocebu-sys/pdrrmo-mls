/**
 * =============================================================================
 * PDRRMO MLS — Role-Based Access Control (RBAC) Architecture
 * =============================================================================
 * Synchronized with public.access_roles database table & app/settings/access.
 * 
 * Supports dynamic roles created in settings as well as built-in system roles
 * ('admin', 'monitoring', 'staff').
 */

export type ScreenName =
  | 'Dashboard'
  | 'Logs'
  | 'Roll Call'
  | 'Users'
  | 'Archives'
  | 'Settings';

export type PermissionLevel = 'Full Access' | 'View Only' | 'None';

export interface RolePermission {
  screen: ScreenName | string;
  level: PermissionLevel;
}

export interface RoleDefinition {
  id: string;
  code: string;
  name: string;
  badge: string;
  badgeType: 'system' | 'operational' | 'standard';
  description: string;
  permissions: RolePermission[];
  isSystem?: boolean;
}

export const ALL_SCREENS: ScreenName[] = [
  'Dashboard',
  'Logs',
  'Roll Call',
  'Users',
  'Archives',
  'Settings',
];

/**
 * Route-to-Screen Mapping
 * Resolves Next.js routes to the corresponding RBAC screen entity.
 */
export const routeToScreenMap: Record<string, ScreenName> = {
  '/dashboard': 'Dashboard',
  '/logs': 'Logs',
  '/logs-config': 'Logs',
  '/roll-call': 'Roll Call',
  '/users': 'Users',
  '/archives': 'Archives',
  '/settings': 'Settings',
  '/settings/access': 'Settings',
  '/settings/areas': 'Settings',
  '/settings/logs': 'Settings',
  '/access': 'Settings',
  '/areas': 'Settings',
};

/**
 * Default Built-in Roles (Used when offline or initializing)
 */
export const defaultBuiltInRoles: RoleDefinition[] = [
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
    ],
  },
];

/**
 * Normalizes any screen name or route path into a standardized ScreenName.
 */
export function normalizeScreenName(screenOrRoute: string): ScreenName | null {
  if (!screenOrRoute) return null;
  const trimmed = screenOrRoute.trim();

  // 1. Direct screen name check
  const directMatch = ALL_SCREENS.find(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  );
  if (directMatch) return directMatch;

  // 2. Exact route match
  const cleanPath = trimmed.split('?')[0].split('#')[0];
  if (routeToScreenMap[cleanPath]) return routeToScreenMap[cleanPath];

  // 3. Prefix route match (e.g. /settings/areas/123 -> Settings)
  for (const [route, screen] of Object.entries(routeToScreenMap)) {
    if (cleanPath === route || cleanPath.startsWith(route + '/')) {
      return screen;
    }
  }

  return null;
}

/**
 * Matches a user's role string or position title with available RoleDefinitions.
 */
export function matchUserRole(
  userRoleString?: string | null,
  userPositionString?: string | null,
  availableRoles: RoleDefinition[] = defaultBuiltInRoles
): RoleDefinition {
  const queryRole = (userRoleString || '').toLowerCase().trim();
  const queryPos = (userPositionString || '').toLowerCase().trim();

  // Super Admin priority
  if (queryRole === 'admin') {
    const adminRole = availableRoles.find(
      (r) => r.code.toLowerCase() === 'admin' || r.name.toLowerCase() === 'admin'
    );
    if (adminRole) return adminRole;
    return defaultBuiltInRoles[0];
  }

  // 1. Match by code in available dynamic roles
  if (queryRole) {
    const byCode = availableRoles.find((r) => r.code.toLowerCase() === queryRole);
    if (byCode) return byCode;

    // 2. Match by name
    const byName = availableRoles.find((r) => r.name.toLowerCase() === queryRole);
    if (byName) return byName;
  }

  // 3. Match by position title
  if (queryPos) {
    const byPos = availableRoles.find(
      (r) =>
        r.name.toLowerCase() === queryPos ||
        r.code.toLowerCase() === queryPos
    );
    if (byPos) return byPos;
  }

  // 4. Default fallback: Staff or Monitoring Officer
  if (queryRole === 'staff' || queryPos.includes('staff')) {
    const staffRole = availableRoles.find(
      (r) => r.code.toLowerCase() === 'staff' || r.name.toLowerCase() === 'staff'
    );
    return staffRole || defaultBuiltInRoles[2];
  }

  const moRole = availableRoles.find(
    (r) => r.code.toLowerCase() === 'monitoring' || r.name.toLowerCase().includes('monitoring')
  );
  return moRole || defaultBuiltInRoles[1];
}

/**
 * Evaluates the permission level of a role for a specific screen.
 */
export function getPermissionForScreen(
  role: RoleDefinition | null,
  screenName: ScreenName
): PermissionLevel {
  if (!role) return 'None';

  // Admin always has Full Access across all screens
  if (role.code.toLowerCase() === 'admin' || role.name.toLowerCase() === 'admin') {
    return 'Full Access';
  }

  const perm = role.permissions?.find(
    (p) => p.screen.toLowerCase() === screenName.toLowerCase()
  );

  return (perm?.level as PermissionLevel) || 'None';
}

/**
 * Returns true if the permission level allows viewing ('Full Access' or 'View Only').
 */
export function canAccessScreen(
  role: RoleDefinition | null,
  screenName: ScreenName
): boolean {
  const level = getPermissionForScreen(role, screenName);
  return level === 'Full Access' || level === 'View Only';
}

/**
 * Returns true if the permission level allows mutations ('Full Access').
 */
export function canWriteScreen(
  role: RoleDefinition | null,
  screenName: ScreenName
): boolean {
  const level = getPermissionForScreen(role, screenName);
  return level === 'Full Access';
}
