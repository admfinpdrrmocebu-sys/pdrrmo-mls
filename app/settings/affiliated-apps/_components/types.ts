/**
 * Shared types, formatters, and deterministic signatures for Affiliated Apps settings.
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
  created_at: string;
  updated_at: string;
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
        `${a.id}:${a.name}:${a.appUrl}:${a.imageUrl}:${a.storagePath ?? ''}:${a.sortOrder}:${a.isActive ? 1 : 0}:${a.updatedAt ?? ''}`
    )
    .join('|');
  return `${tableMissingNotice ? '1' : '0'}::${rowsSig}`;
}
