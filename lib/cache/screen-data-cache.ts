/**
 * =============================================================================
 * PDRRMO MLS — Operational Screens In-Memory SWR Data Cache
 * =============================================================================
 * Stores fetched database records for Drone Streams, Screen Projector, and
 * Affiliated Apps in browser memory so pages hydrate synchronously in 0ms with
 * zero loading skeleton or spinner flash upon navigation.
 */

import type { DroneStreamItem } from '@/app/drone-stream/page';
import type { CustomDropdownOption } from '@/components/input';
import type { PendingInvitation, UserAccount } from '@/app/users/_components/types';
import type {
  ActiveShiftInfo,
  DashboardTimeRange,
  ReportTypeRow,
  RollCallSessionRow,
  ShiftLogRow,
} from '@/app/dashboard/_components/types';
import type {
  ActiveShiftRecord,
  DutyPersonnel,
  LogEntry,
  ShiftScheduleItem,
} from '@/app/logs/_components/types';
import type {
  MunicipalityRow,
  RollCallHistorySession,
  RollCallSessionRecord,
} from '@/app/roll-call/_components/types';
import type {
  ArchivedFile,
  ArchiveProfileRow,
  ArchiveSnapshotData,
} from '@/app/archives/_components/types';
import type { PaperSize, RollCallTemplateType } from '@/lib/pdf-generator';
import type { Announcement } from '@/app/announcements/_components/types';
import type {
  RoleItem,
  ShiftScheduleItem as AccessShiftScheduleItem,
} from '@/app/settings/access/_components/types';
import type { AreaItem } from '@/app/settings/areas/_components/types';
import type { ReportTypeItem } from '@/app/settings/logs/_components/types';
import type {
  DutyRosterAssignmentRecord,
  OfficerAssignment as ShiftSettingsOfficerAssignment,
  ShiftScheduleItem as ShiftSettingsScheduleItem,
} from '@/app/settings/shifts/_components/types';
import type { AffiliatedAppRecord } from '@/app/settings/affiliated-apps/_components/types';

// Re-use or define minimal types matching the respective pages
export interface CachedLogsScreenData {
  logs: LogEntry[];
  activeShift: ActiveShiftRecord | null;
  availableOfficers: DutyPersonnel[];
  shiftSchedules: ShiftScheduleItem[];
  reportTypeOptionsList: CustomDropdownOption[];
  filterDropdownOptions: CustomDropdownOption[];
  searchQuery: string;
  reportTypeFilter: string;
  currentPage: number;
  signature: string;
  fetchedAt: number;
}

export interface CachedDashboardData {
  todayLogsCount: number;
  yesterdayLogsCount: number;
  logsChangeStr: string;
  logsChangeType: 'positive' | 'negative' | 'neutral';
  totalFilesCount: number;
  totalStorageStr: string;
  totalUsersCount: number;
  activeShift: ActiveShiftInfo | null;
  allLogs: ShiftLogRow[];
  reportTypes: ReportTypeRow[];
  rollCallSessions: RollCallSessionRow[];
  timeRange: DashboardTimeRange;
  signature: string;
  fetchedAt: number;
}

export interface CachedUsersScreenData {
  users: UserAccount[];
  pendingInvitations: PendingInvitation[];
  positionOptions: CustomDropdownOption[];
  positionFilterOptions: CustomDropdownOption[];
  shiftScheduleOptions: CustomDropdownOption[];
  activeTab: 'official' | 'pending';
  searchQuery: string;
  selectedPositionFilter: string;
  currentPage: number;
  fetchedAt: number;
}
export interface CachedProjectorScreen {
  id: string;
  name: string;
  webLink: string;
  sortOrder: number;
  deviceOrders: Record<string, number>;
  isActive: boolean;
  createdBy: string | null;
  createdByName: string | null;
}

export interface CachedAffiliatedApp {
  id: string;
  name: string;
  appUrl: string;
  imageUrl: string;
  sortOrder: number;
  isPinned: boolean;
  pinnedAt: string | null;
  updatedAt: string;
}

// Module-level in-memory stores (survive client-side route transitions)
let _droneStreamsCache: DroneStreamItem[] | null = null;
let _projectorScreensCache: CachedProjectorScreen[] | null = null;
let _affiliatedAppsCache: CachedAffiliatedApp[] | null = null;
export interface CachedRollCallScreenData {
  activeTab: 'operations' | 'analytics';
  areasList: MunicipalityRow[];
  municipalities: MunicipalityRow[];
  activeSession: RollCallSessionRecord | null;
  analyticsSessions: RollCallHistorySession[];
  analyticsLoaded: boolean;
  stationsPage: number;
  selectedMonthFilter: string;
  analyticsSearchQuery: string;
  cachedAt: number;
}

export interface CachedArchivesScreenData {
  archivesList: ArchivedFile[];
  profilesList: ArchiveProfileRow[];
  snapshotById: Record<string, ArchiveSnapshotData>;
  activeTab: 'log' | 'roll-call';
  searchQuery: string;
  selectedDateISO: string | null;
  currentPage: number;
  rcTemplateType?: RollCallTemplateType;
  rcPaperSize?: PaperSize;
  cachedAt: number;
}

export interface CachedAnnouncementsScreenData {
  announcements: Announcement[];
  searchQuery: string;
  signature: string;
  fetchedAt: number;
}

export interface CachedAccessScreenData {
  roles: RoleItem[];
  shiftSchedules: AccessShiftScheduleItem[];
  activeTab: 'roles' | 'shifts';
  selectedShiftRoleFilter: string;
  signature: string;
  fetchedAt: number;
}

export interface CachedAreasScreenData {
  areas: AreaItem[];
  searchQuery: string;
  portFilter: string;
  currentPage: number;
  signature: string;
  fetchedAt: number;
}

export interface CachedLogSettingsScreenData {
  reportTypes: ReportTypeItem[];
  searchQuery: string;
  signature: string;
  fetchedAt: number;
}

export interface CachedShiftSettingsScreenData {
  profiles: ShiftSettingsOfficerAssignment[];
  shiftSchedules: ShiftSettingsScheduleItem[];
  assignmentsByMonth: Record<string, DutyRosterAssignmentRecord[]>;
  currentMonthIso: string;
  selectedShiftFilter: string;
  selectedRoleFilter: string;
  profilesSignature: string;
  schedulesSignature: string;
  monthSignatures: Record<string, string>;
  fetchedAt: number;
}

export interface CachedAffiliatedAppsSettingsData {
  apps: AffiliatedAppRecord[];
  tableMissingNotice: boolean;
  searchQuery: string;
  currentPage: number;
  signature: string;
  fetchedAt: number;
}

let _usersScreenCache: CachedUsersScreenData | null = null;
let _dashboardCache: CachedDashboardData | null = null;
let _logsScreenCache: CachedLogsScreenData | null = null;
let _rollCallScreenCache: CachedRollCallScreenData | null = null;
let _announcementsScreenCache: CachedAnnouncementsScreenData | null = null;
let _archivesScreenCache: CachedArchivesScreenData | null = null;
let _accessScreenCache: CachedAccessScreenData | null = null;
let _areasScreenCache: CachedAreasScreenData | null = null;
let _logSettingsScreenCache: CachedLogSettingsScreenData | null = null;
let _shiftSettingsScreenCache: CachedShiftSettingsScreenData | null = null;
let _affiliatedAppsSettingsCache: CachedAffiliatedAppsSettingsData | null = null;

// =============================================================================
// SESSION STORAGE SWR PERSISTENCE (Survives F5 Hard Refresh — Zero Cookie Bloat)
// =============================================================================
const SWR_PERSIST_TTL_MS = 15 * 60 * 1000; // 15 minutes

const SWR_STORAGE_KEYS = {
  droneStreams: 'pdrrmo_swr_drone_streams_v1',
  projectorScreens: 'pdrrmo_swr_projector_screens_v1',
  affiliatedApps: 'pdrrmo_swr_affiliated_apps_v1',
  affiliatedAppsSettings: 'pdrrmo_swr_affiliated_apps_settings_v1',
  areas: 'pdrrmo_swr_areas_v1',
  logSettings: 'pdrrmo_swr_log_settings_v1',
  access: 'pdrrmo_swr_access_v1',
} as const;

interface SwrEnvelope<T> {
  savedAt: number;
  data: T;
}

function readSwrStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SwrEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== 'number' || parsed.data === undefined) {
      return null;
    }
    if (Date.now() - parsed.savedAt > SWR_PERSIST_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSwrStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope: SwrEnvelope<T> = {
      savedAt: Date.now(),
      data,
    };
    window.sessionStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

let _hasHydratedFromStorage = false;

/**
 * Hydrates non-sensitive operational/directory caches from sessionStorage once after mount
 * (called inside AuthProvider after hydration so SSR & first client paint never mismatch).
 */
export function hydrateOperationalCachesFromStorage(): void {
  if (typeof window === 'undefined' || _hasHydratedFromStorage) return;
  _hasHydratedFromStorage = true;

  if (!_droneStreamsCache) {
    _droneStreamsCache = readSwrStorage<DroneStreamItem[]>(SWR_STORAGE_KEYS.droneStreams);
  }
  if (!_projectorScreensCache) {
    _projectorScreensCache = readSwrStorage<CachedProjectorScreen[]>(
      SWR_STORAGE_KEYS.projectorScreens
    );
  }
  if (!_affiliatedAppsCache) {
    _affiliatedAppsCache = readSwrStorage<CachedAffiliatedApp[]>(
      SWR_STORAGE_KEYS.affiliatedApps
    );
  }
  if (!_affiliatedAppsSettingsCache) {
    _affiliatedAppsSettingsCache = readSwrStorage<CachedAffiliatedAppsSettingsData>(
      SWR_STORAGE_KEYS.affiliatedAppsSettings
    );
  }
  if (!_areasScreenCache) {
    _areasScreenCache = readSwrStorage<CachedAreasScreenData>(SWR_STORAGE_KEYS.areas);
  }
  if (!_logSettingsScreenCache) {
    _logSettingsScreenCache = readSwrStorage<CachedLogSettingsScreenData>(
      SWR_STORAGE_KEYS.logSettings
    );
  }
  if (!_accessScreenCache) {
    _accessScreenCache = readSwrStorage<CachedAccessScreenData>(SWR_STORAGE_KEYS.access);
  }
}

// =============================================================================
// DRONE STREAMS CACHE
// =============================================================================

export function getCachedDroneStreams(): DroneStreamItem[] | null {
  return _droneStreamsCache;
}

export function setCachedDroneStreams(items: DroneStreamItem[]): void {
  _droneStreamsCache = items;
  writeSwrStorage(SWR_STORAGE_KEYS.droneStreams, items);
}

export function updateCachedDroneStream(item: DroneStreamItem): void {
  if (!_droneStreamsCache) {
    _droneStreamsCache = [item];
    writeSwrStorage(SWR_STORAGE_KEYS.droneStreams, _droneStreamsCache);
    return;
  }
  const idx = _droneStreamsCache.findIndex((s) => s.id === item.id);
  if (idx !== -1) {
    _droneStreamsCache[idx] = item;
  } else {
    _droneStreamsCache.push(item);
  }
  writeSwrStorage(SWR_STORAGE_KEYS.droneStreams, _droneStreamsCache);
}

export function removeCachedDroneStream(id: string): void {
  if (!_droneStreamsCache) return;
  _droneStreamsCache = _droneStreamsCache.filter((s) => s.id !== id);
  writeSwrStorage(SWR_STORAGE_KEYS.droneStreams, _droneStreamsCache);
}

// =============================================================================
// SCREEN PROJECTOR CACHE
// =============================================================================

export function getCachedProjectorScreens(): CachedProjectorScreen[] | null {
  return _projectorScreensCache;
}

export function setCachedProjectorScreens(items: CachedProjectorScreen[]): void {
  _projectorScreensCache = items;
  writeSwrStorage(SWR_STORAGE_KEYS.projectorScreens, items);
}

// =============================================================================
// AFFILIATED APPS CACHE
// =============================================================================

export const AFFILIATED_APPS_UPDATED_EVENT = 'pdrrmo:affiliated-apps-updated';

export function getCachedAffiliatedApps(): CachedAffiliatedApp[] | null {
  return _affiliatedAppsCache;
}

export function setCachedAffiliatedApps(items: CachedAffiliatedApp[]): void {
  _affiliatedAppsCache = items;
  writeSwrStorage(SWR_STORAGE_KEYS.affiliatedApps, items);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AFFILIATED_APPS_UPDATED_EVENT));
  }
}

// =============================================================================
// USER MANAGEMENT CACHE
// =============================================================================

export function getCachedUsersScreenData(): CachedUsersScreenData | null {
  return _usersScreenCache;
}

export function setCachedUsersScreenData(data: CachedUsersScreenData): void {
  _usersScreenCache = data;
}

export function patchCachedUsersScreenData(
  patch: Partial<CachedUsersScreenData>
): void {
  if (!_usersScreenCache) return;
  _usersScreenCache = { ..._usersScreenCache, ...patch };
}

// =============================================================================
// DASHBOARD CACHE
// =============================================================================

export function getCachedDashboardData(): CachedDashboardData | null {
  return _dashboardCache;
}

export function setCachedDashboardData(data: CachedDashboardData): void {
  _dashboardCache = data;
}

export function patchCachedDashboardData(
  patch: Partial<CachedDashboardData>
): void {
  if (!_dashboardCache) return;
  _dashboardCache = { ..._dashboardCache, ...patch };
}

// =============================================================================
// OPERATIONAL LOGS SCREEN CACHE
// =============================================================================

export function getCachedLogsScreenData(): CachedLogsScreenData | null {
  return _logsScreenCache;
}

export function setCachedLogsScreenData(data: CachedLogsScreenData): void {
  _logsScreenCache = data;
}

export function patchCachedLogsScreenData(
  patch: Partial<CachedLogsScreenData>
): void {
  if (!_logsScreenCache) return;
  _logsScreenCache = { ..._logsScreenCache, ...patch };
}

// =============================================================================
// ROLL CALL SCREEN CACHE
// =============================================================================

export function getCachedRollCallScreenData(): CachedRollCallScreenData | null {
  return _rollCallScreenCache;
}

export function setCachedRollCallScreenData(
  data: CachedRollCallScreenData
): void {
  _rollCallScreenCache = data;
}

export function patchCachedRollCallScreenData(
  patch: Partial<CachedRollCallScreenData>
): void {
  if (!_rollCallScreenCache) return;
  _rollCallScreenCache = { ..._rollCallScreenCache, ...patch };
}

// =============================================================================
// ARCHIVES SCREEN CACHE
// =============================================================================

export function getCachedArchivesScreenData(): CachedArchivesScreenData | null {
  return _archivesScreenCache;
}

export function setCachedArchivesScreenData(
  data: CachedArchivesScreenData
): void {
  _archivesScreenCache = data;
}

export function patchCachedArchivesScreenData(
  patch: Partial<CachedArchivesScreenData>
): void {
  if (!_archivesScreenCache) return;
  _archivesScreenCache = { ..._archivesScreenCache, ...patch };
}

export function getCachedArchiveSnapshot(
  archiveId: string
): ArchiveSnapshotData | null {
  if (!_archivesScreenCache) return null;
  return _archivesScreenCache.snapshotById[archiveId] ?? null;
}

export function setCachedArchiveSnapshot(
  archiveId: string,
  snapshot: ArchiveSnapshotData
): void {
  if (!_archivesScreenCache) return;
  _archivesScreenCache = {
    ..._archivesScreenCache,
    snapshotById: {
      ..._archivesScreenCache.snapshotById,
      [archiveId]: snapshot,
    },
  };
}

// =============================================================================
// ANNOUNCEMENTS SCREEN CACHE
// =============================================================================

export function getCachedAnnouncementsScreenData(): CachedAnnouncementsScreenData | null {
  return _announcementsScreenCache;
}

export function setCachedAnnouncementsScreenData(
  data: CachedAnnouncementsScreenData
): void {
  _announcementsScreenCache = data;
}

export function patchCachedAnnouncementsScreenData(
  patch: Partial<CachedAnnouncementsScreenData>
): void {
  if (!_announcementsScreenCache) return;
  _announcementsScreenCache = { ..._announcementsScreenCache, ...patch };
}

// =============================================================================
// ACCESS & SCHEDULES SCREEN CACHE
// =============================================================================

export function getCachedAccessScreenData(): CachedAccessScreenData | null {
  return _accessScreenCache;
}

export function setCachedAccessScreenData(data: CachedAccessScreenData): void {
  _accessScreenCache = data;
  writeSwrStorage(SWR_STORAGE_KEYS.access, data);
}

export function patchCachedAccessScreenData(
  patch: Partial<CachedAccessScreenData>
): void {
  if (!_accessScreenCache) return;
  _accessScreenCache = { ..._accessScreenCache, ...patch };
  writeSwrStorage(SWR_STORAGE_KEYS.access, _accessScreenCache);
}

// =============================================================================
// AREAS SCREEN CACHE
// =============================================================================

export function getCachedAreasScreenData(): CachedAreasScreenData | null {
  return _areasScreenCache;
}

export function setCachedAreasScreenData(data: CachedAreasScreenData): void {
  _areasScreenCache = data;
  writeSwrStorage(SWR_STORAGE_KEYS.areas, data);
}

export function patchCachedAreasScreenData(
  patch: Partial<CachedAreasScreenData>
): void {
  if (!_areasScreenCache) return;
  _areasScreenCache = { ..._areasScreenCache, ...patch };
  writeSwrStorage(SWR_STORAGE_KEYS.areas, _areasScreenCache);
}

// =============================================================================
// LOG SETTINGS (REPORT TYPES) SCREEN CACHE
// =============================================================================

export function getCachedLogSettingsScreenData(): CachedLogSettingsScreenData | null {
  return _logSettingsScreenCache;
}

export function setCachedLogSettingsScreenData(
  data: CachedLogSettingsScreenData
): void {
  _logSettingsScreenCache = data;
  writeSwrStorage(SWR_STORAGE_KEYS.logSettings, data);
}

export function patchCachedLogSettingsScreenData(
  patch: Partial<CachedLogSettingsScreenData>
): void {
  if (!_logSettingsScreenCache) return;
  _logSettingsScreenCache = { ..._logSettingsScreenCache, ...patch };
  writeSwrStorage(SWR_STORAGE_KEYS.logSettings, _logSettingsScreenCache);
}

// =============================================================================
// SHIFT SETTINGS CALENDAR SCREEN CACHE
// =============================================================================

export function getCachedShiftSettingsScreenData(): CachedShiftSettingsScreenData | null {
  return _shiftSettingsScreenCache;
}

export function setCachedShiftSettingsScreenData(
  data: CachedShiftSettingsScreenData
): void {
  _shiftSettingsScreenCache = data;
}

export function patchCachedShiftSettingsScreenData(
  patch: Partial<CachedShiftSettingsScreenData>
): void {
  if (!_shiftSettingsScreenCache) return;
  _shiftSettingsScreenCache = { ..._shiftSettingsScreenCache, ...patch };
}

// =============================================================================
// AFFILIATED APPS SETTINGS SCREEN CACHE
// =============================================================================

export function getCachedAffiliatedAppsSettingsData(): CachedAffiliatedAppsSettingsData | null {
  return _affiliatedAppsSettingsCache;
}

export function setCachedAffiliatedAppsSettingsData(
  data: CachedAffiliatedAppsSettingsData
): void {
  _affiliatedAppsSettingsCache = data;
  writeSwrStorage(SWR_STORAGE_KEYS.affiliatedAppsSettings, data);
}

export function patchCachedAffiliatedAppsSettingsData(
  patch: Partial<CachedAffiliatedAppsSettingsData>
): void {
  if (!_affiliatedAppsSettingsCache) return;
  _affiliatedAppsSettingsCache = { ..._affiliatedAppsSettingsCache, ...patch };
  writeSwrStorage(SWR_STORAGE_KEYS.affiliatedAppsSettings, _affiliatedAppsSettingsCache);
}

// =============================================================================
// CACHE RESET (e.g. on user sign out)
// =============================================================================

export function clearOperationalScreensCache(): void {
  _droneStreamsCache = null;
  _projectorScreensCache = null;
  _affiliatedAppsCache = null;
  _usersScreenCache = null;
  _dashboardCache = null;
  _logsScreenCache = null;
  _rollCallScreenCache = null;
  _archivesScreenCache = null;
  _announcementsScreenCache = null;
  _accessScreenCache = null;
  _areasScreenCache = null;
  _logSettingsScreenCache = null;
  _shiftSettingsScreenCache = null;
  _affiliatedAppsSettingsCache = null;
  _hasHydratedFromStorage = false;

  if (typeof window !== 'undefined') {
    try {
      Object.values(SWR_STORAGE_KEYS).forEach((key) => {
        window.sessionStorage.removeItem(key);
      });
    } catch {
      // Ignore storage errors
    }
  }
}
