export interface AnnouncementAcknowledgment {
  id: string;
  announcementId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string | null;
  userRole?: string | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  description: string;
  /** Precomputed sanitized HTML to avoid re-running regex sanitization on every render */
  sanitizedDescription: string;
  /** Precomputed plain text for instant search filtering */
  plainText: string;
  /** Precomputed truncation flag (> WORD_LIMIT words) */
  isTruncated: boolean;
  createdAt: string;
  rawCreatedAt?: string;
  createdBy: string;
  createdById: string;
  updatedBy?: string | null;
  updatedById?: string | null;
  updatedAt?: string | null;
  rawUpdatedAt?: string | null;
  acknowledgments: AnnouncementAcknowledgment[];
}

export interface RawDbProfileRef {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  position_title?: string | null;
  avatar_url?: string | null;
}

export interface RawDbAcknowledgmentRow {
  id?: string;
  announcement_id?: string;
  user_id: string;
  user_name?: string | null;
  created_at?: string | null;
  user?: RawDbProfileRef | RawDbProfileRef[] | null;
}

export interface RawDbAnnouncementRow {
  id: string;
  title?: string | null;
  description?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
  creator?: RawDbProfileRef | RawDbProfileRef[] | null;
  updater?: RawDbProfileRef | RawDbProfileRef[] | null;
  acknowledgments?: RawDbAcknowledgmentRow[] | null;
}

// Truncation limit in words for card previews
export const WORD_LIMIT = 24;

// Maximum allowed active announcements
export const MAX_ANNOUNCEMENTS = 20;

const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-sky-600',
  'bg-purple-600',
  'bg-teal-600',
];

export function getInitials(name: string): string {
  if (!name) return 'OP';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function getAvatarColorClass(idOrName: string): string {
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) {
    hash = (hash << 5) - hash + idOrName.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function checkIsTruncated(htmlOrPlain: string, limit = WORD_LIMIT, isAlreadyPlain = false): boolean {
  const plain = isAlreadyPlain ? htmlOrPlain : getPlainText(htmlOrPlain);
  if (!plain) return false;
  const words = plain.split(/\s+/).filter(Boolean);
  return words.length > limit;
}

export function formatAnnouncementDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month} ${day}, ${year} · ${hours}:${minutes}H`;
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  let formatted = html;

  if (!/<[a-z][\s\S]*>/i.test(html)) {
    formatted = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return `<li>${trimmed.slice(2)}</li>`;
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          return `<li>${trimmed.replace(/^\d+\.\s+/, '')}</li>`;
        }
        return trimmed ? `<p>${trimmed}</p>` : '';
      })
      .join('');
    formatted = formatted.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
  }

  return formatted
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:[^"']*/gi, '');
}

export function mapAnnouncementRow(
  row: RawDbAnnouncementRow,
  fallbackName?: string
): Announcement {
  const creatorProfile = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  const updaterProfile = Array.isArray(row.updater) ? row.updater[0] : row.updater;

  const createdByName =
    creatorProfile?.full_name ||
    (creatorProfile?.email ? creatorProfile.email.split('@')[0] : null) ||
    row.created_by_name ||
    fallbackName ||
    'Monitoring Officer';

  const updatedByName =
    updaterProfile?.full_name ||
    (updaterProfile?.email ? updaterProfile.email.split('@')[0] : null) ||
    row.updated_by_name ||
    null;

  const rawAcks = Array.isArray(row.acknowledgments) ? row.acknowledgments : [];
  const mappedAcks: AnnouncementAcknowledgment[] = rawAcks
    .filter(Boolean)
    .map((ack) => {
      const userProf = Array.isArray(ack.user) ? ack.user[0] : ack.user;
      return {
        id: ack.id || `ack-${ack.user_id}-${row.id}`,
        announcementId: ack.announcement_id || row.id,
        userId: ack.user_id,
        userName: userProf?.full_name || ack.user_name || 'Monitoring Officer',
        userAvatarUrl: userProf?.avatar_url || null,
        userRole: userProf?.role || userProf?.position_title || 'Officer',
        createdAt: formatAnnouncementDate(ack.created_at),
      };
    });

  const description = row.description || '';
  const plainText = getPlainText(description);

  return {
    id: row.id,
    title: row.title || '',
    description,
    sanitizedDescription: sanitizeHtml(description),
    plainText,
    isTruncated: checkIsTruncated(plainText, WORD_LIMIT, true),
    createdAt: formatAnnouncementDate(row.created_at),
    rawCreatedAt: row.created_at ?? undefined,
    createdBy: createdByName,
    createdById: row.created_by || '',
    updatedBy: updatedByName,
    updatedById: row.updated_by || null,
    updatedAt:
      row.updated_at && row.updated_at !== row.created_at
        ? formatAnnouncementDate(row.updated_at)
        : null,
    rawUpdatedAt: row.updated_at || null,
    acknowledgments: mappedAcks,
  };
}

export function computeAnnouncementsSignature(items: Announcement[]): string {
  return items
    .map(
      (a) =>
        `${a.id}:${a.rawUpdatedAt || a.rawCreatedAt || ''}:${a.title.length}:${a.description.length}:${a.acknowledgments.map((k) => k.userId).join(',')}`
    )
    .join('|');
}
