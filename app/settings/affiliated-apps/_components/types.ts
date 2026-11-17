/**
 * Shared types, formatters, sorting comparators, and deterministic signatures
 * for Affiliated Apps settings & directory.
 */

export const STORAGE_BUCKET = 'affiliated-apps';
export const ITEMS_PER_PAGE = 6;

export interface AffiliatedAppRecord {
  id: string;
  name: string;
  appUrl: string;
  imageUrl: string;
  storagePath: string | null;
  sortOrder: number;
  isActive: boolean;
  isPinned: boolean;
  pinnedAt: string | null;
  pinnedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliatedAppDbRow {
  id: string;
  name: string;
  app_url: string;
  image_url: string;
  storage_path: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  is_pinned?: boolean | null;
  pinned_at?: string | null;
  pinned_by?: string | null;
  created_at: string;
  updated_at: string;
}

export function mapAffiliatedAppDbRow(row: AffiliatedAppDbRow): AffiliatedAppRecord {
  const isActive = row.is_active ?? true;
  return {
    id: row.id,
    name: row.name,
    appUrl: row.app_url,
    imageUrl: row.image_url,
    storagePath: row.storage_path || null,
    sortOrder: row.sort_order ?? 0,
    isActive,
    isPinned: isActive ? Boolean(row.is_pinned) : false,
    pinnedAt: isActive && row.is_pinned ? (row.pinned_at ?? null) : null,
    pinnedBy: isActive && row.is_pinned ? (row.pinned_by ?? null) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Deterministic comparator: pinned apps first (most recently pinned first),
 * then ascending sort_order, then newest created_at.
 */
export function sortAffiliatedApps(apps: AffiliatedAppRecord[]): AffiliatedAppRecord[] {
  return [...apps].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    if (a.isPinned && b.isPinned) {
      const aPinTime = a.pinnedAt ? Date.parse(a.pinnedAt) || 0 : 0;
      const bPinTime = b.pinnedAt ? Date.parse(b.pinnedAt) || 0 : 0;
      if (aPinTime !== bPinTime) return bPinTime - aPinTime;
    }
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    const aCreated = a.createdAt ? Date.parse(a.createdAt) || 0 : 0;
    const bCreated = b.createdAt ? Date.parse(b.createdAt) || 0 : 0;
    return bCreated - aCreated;
  });
}

export function isOptimizableSupabaseImageUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    const u = new URL(src);
    return (
      u.protocol === 'https:' &&
      u.hostname.endsWith('.supabase.co') &&
      u.pathname.startsWith('/storage/v1/object/public/')
    );
  } catch {
    return false;
  }
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string' &&
    (err as { message: string }).message
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

export function normalizeDisplayHost(urlStr: string): string {
  try {
    const withProto = /^https?:\/\//i.test(urlStr.trim())
      ? urlStr.trim()
      : `https://${urlStr.trim()}`;
    return new URL(withProto).hostname.replace(/^www\./i, '');
  } catch {
    return urlStr.trim() || 'web-app';
  }
}

export function normalizeFullUrl(urlStr: string): string {
  const trimmed = urlStr.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function isLikelySnapReadyUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 4) return false;
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return (
      (u.protocol === 'http:' || u.protocol === 'https:') &&
      u.hostname.includes('.') &&
      !u.hostname.endsWith('.')
    );
  } catch {
    return false;
  }
}

export function formatUpdatedDate(iso: string | null | undefined): string {
  if (!iso) return 'Recently';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

export function computeAffiliatedAppsSignature(
  apps: AffiliatedAppRecord[],
  tableMissingNotice: boolean
): string {
  const rowsSig = apps
    .map(
      (a) =>
        `${a.id}:${a.name}:${a.appUrl}:${a.imageUrl}:${a.storagePath ?? ''}:${a.sortOrder}:${a.isActive ? 1 : 0}:${a.isPinned ? 1 : 0}:${a.pinnedAt ?? ''}:${a.updatedAt ?? ''}`
    )
    .join('|');
  return `${tableMissingNotice ? '1' : '0'}::${rowsSig}`;
}
