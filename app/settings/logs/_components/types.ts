export interface ReportTypeItem {
  id: string;
  code: string;
  name: string;
  color: string;
  version: string;
  createdAt: string;
  createdBy: string;
  createdById?: string | null;
  createdByRole: string;
  updatedAt: string;
  updatedBy: string;
  updatedById?: string | null;
  updatedByRole: string;
}

export interface ProfileAttributionRef {
  id?: string | null;
  full_name?: string | null;
  email?: string | null;
  position_title?: string | null;
  role?: string | null;
}

export interface RawDbReportTypeRow {
  id: string;
  code?: string | null;
  name: string;
  color?: string | null;
  version?: string | null;
  is_default?: boolean | null;
  is_active?: boolean | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  creator?: ProfileAttributionRef | ProfileAttributionRef[] | null;
  updater?: ProfileAttributionRef | ProfileAttributionRef[] | null;
}

export const COLOR_OPTIONS = [
  { color: '#004AC6', name: 'Primary Blue' },
  { color: '#BA1A1A', name: 'Critical Red' },
  { color: '#F59E0B', name: 'Warning Amber' },
  { color: '#10B981', name: 'Active Green' },
  { color: '#8B5CF6', name: 'Purple' },
  { color: '#505F76', name: 'Slate Gray' },
] as const;

export function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function formatProfileRole(role?: string | null): string {
  if (!role) return '';
  const normalized = role.trim().toLowerCase();
  if (normalized === 'admin') return 'System Admin';
  if (normalized === 'monitoring') return 'Monitoring Officer';
  if (normalized === 'staff') return 'Operations Staff';
  return role
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveProfileAttribution(
  rel: ProfileAttributionRef | ProfileAttributionRef[] | null | undefined,
  fallbackName: string,
  fallbackRole: string
): { name: string; role: string } {
  const profile = Array.isArray(rel) ? rel[0] : rel;
  const emailName = profile?.email ? profile.email.split('@')[0] : null;
  const name = profile?.full_name?.trim() || emailName || fallbackName;
  const role =
    profile?.position_title?.trim() ||
    formatProfileRole(profile?.role) ||
    fallbackRole;
  return { name, role };
}

export function mapDbReportTypeRow(item: RawDbReportTypeRow): ReportTypeItem {
  const defaultName = item.is_default ? 'System Default' : 'Monitoring Officer';
  const defaultRole = item.is_default
    ? 'Built-in Classification'
    : 'Authorized Personnel';

  const creator = resolveProfileAttribution(item.creator, defaultName, defaultRole);
  const updater = resolveProfileAttribution(item.updater, creator.name, creator.role);

  return {
    id: item.id,
    code: item.code || `RPT-${item.id.slice(0, 6).toUpperCase()}`,
    name: item.name,
    color: item.color || '#004AC6',
    version: item.version || 'v1.0',
    createdAt: formatDateDisplay(item.created_at),
    createdBy: creator.name,
    createdById: item.created_by ?? null,
    createdByRole: creator.role,
    updatedAt: formatDateDisplay(item.updated_at),
    updatedBy: updater.name,
    updatedById: item.updated_by ?? item.created_by ?? null,
    updatedByRole: updater.role,
  };
}

export function computeReportTypesSignature(items: ReportTypeItem[]): string {
  return items
    .map(
      (item) =>
        `${item.id}:${item.code}:${item.name}:${item.color}:${item.version}:${item.updatedAt}:${item.updatedBy}`
    )
    .join('|');
}
