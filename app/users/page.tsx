'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  ShieldAlert,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, type CustomDropdownOption } from '@/components/input';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import {
  getCachedUsersScreenData,
  patchCachedUsersScreenData,
  setCachedUsersScreenData,
} from '@/lib/cache/screen-data-cache';
import {
  type AccessRoleRow,
  type PendingInvitation,
  type ToastNotificationState,
  type UserAccount,
  buildPositionBadgeMap,
  defaultPositionFilterOptions,
  defaultPositionOptions,
  defaultShiftScheduleOptions,
  formatInvitedDate,
  formatTimeAgo,
  getAvatarColor,
  getInitials,
  mapAccessRolesToOptions,
  normalizeEnumRole,
} from './_components/types';
import { UsersSummaryCards } from './_components/users-summary-cards';
import { UsersDirectoryTable } from './_components/users-directory-table';

export type { UserAccount, PendingInvitation };

const InviteUserModal = dynamic(() => import('./_components/invite-user-modal'), {
  ssr: false,
});
const EmailPreviewModal = dynamic(() => import('./_components/email-preview-modal'), {
  ssr: false,
});
const EditUserModal = dynamic(() => import('./_components/edit-user-modal'), {
  ssr: false,
});
const DeleteUserModal = dynamic(() => import('./_components/delete-user-modal'), {
  ssr: false,
});

const USERS_CACHE_STALE_MS = 30_000;
const REALTIME_DEBOUNCE_MS = 400;
const ITEMS_PER_PAGE = 6;

const PROFILE_COLUMNS =
  'id, full_name, email, role, position_title, default_shift, is_active, avatar_url, last_active_at, updated_at, created_at';
const INVITATION_COLUMNS =
  'id, email, role, position_title, default_shift, token, status, invited_by, created_at, expires_at, invited_by_profile:invited_by(full_name, email)';
const ROLE_COLUMNS = 'name, code, description, badge, badge_type';
const SCHEDULE_COLUMNS = 'name, start_time, end_time, duration, color, sort_order';

interface ProfileDbRow {
  id: string;
  full_name?: string | null;
  email: string;
  role?: string | null;
  position_title?: string | null;
  default_shift?: string | null;
  is_active?: boolean | null;
  avatar_url?: string | null;
  last_active_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

interface InvitationDbRow {
  id: string;
  email: string;
  role?: string | null;
  position_title?: string | null;
  default_shift?: string | null;
  token?: string | null;
  status?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  invited_by_profile?: { full_name?: string | null; email?: string | null } | null;
}

interface ShiftScheduleDbRow {
  name: string;
  start_time: string;
  end_time: string;
  duration?: string | null;
  color?: string | null;
}

// =============================================================================
// MAIN USER MANAGEMENT PAGE
// =============================================================================
export default function UserManagementPage() {
  const {
    profile: currentAdminProfile,
    canWrite,
    isViewOnly,
    roles: authRoles,
  } = useAuth();
  const canModifyUsers = canWrite('Users');

  // Synchronous SWR cache hydration (prevents skeleton flash when returning to /users)
  const [initialCache] = useState(() => getCachedUsersScreenData());

  const [activeTab, setActiveTab] = useState<'official' | 'pending'>(
    () => initialCache?.activeTab ?? 'official'
  );
  const [users, setUsers] = useState<UserAccount[]>(() => initialCache?.users ?? []);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>(
    () => initialCache?.pendingInvitations ?? []
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialCache);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dynamic dropdown options from access_roles and shift_schedules
  const [positionOptions, setPositionOptions] = useState<CustomDropdownOption[]>(() => {
    if (initialCache?.positionOptions?.length) return initialCache.positionOptions;
    if (authRoles.length > 0) return mapAccessRolesToOptions(authRoles);
    return defaultPositionOptions;
  });
  const [shiftScheduleOptions, setShiftScheduleOptions] = useState<CustomDropdownOption[]>(
    () => initialCache?.shiftScheduleOptions ?? defaultShiftScheduleOptions
  );
  const [positionFilterOptions, setPositionFilterOptions] = useState<CustomDropdownOption[]>(
    () => {
      if (initialCache?.positionFilterOptions?.length) {
        return initialCache.positionFilterOptions;
      }
      if (authRoles.length > 0) {
        return [{ value: 'ALL', label: 'All Positions' }, ...mapAccessRolesToOptions(authRoles)];
      }
      return defaultPositionFilterOptions;
    }
  );

  // Filters & Search (persisted across in-session navigations)
  const [searchQuery, setSearchQuery] = useState(() => initialCache?.searchQuery ?? '');
  const [selectedPositionFilter, setSelectedPositionFilter] = useState(
    () => initialCache?.selectedPositionFilter ?? 'ALL'
  );
  const [currentPage, setCurrentPage] = useState(() => initialCache?.currentPage ?? 1);

  // Modals (lazy-loaded chunks)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEmailPreviewModalOpen, setIsEmailPreviewModalOpen] = useState(false);
  const [emailPreviewMode, setEmailPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Invite Form State
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [currentEmailInput, setCurrentEmailInput] = useState('');
  const [invitePosition, setInvitePosition] = useState<string>('Monitoring');
  const [invitePositionTitle, setInvitePositionTitle] = useState('Monitoring Officer');
  const [inviteShift, setInviteShift] = useState<string>('Day Shift (Alpha)');
  const [isSendingInvitations, setIsSendingInvitations] = useState(false);

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPosition, setEditPosition] = useState<string>('Monitoring');
  const [editPositionTitle, setEditPositionTitle] = useState('Monitoring Officer');
  const [editShift, setEditShift] = useState<string>('Day Shift (Alpha)');
  const [editStatus, setEditStatus] = useState<'Active' | 'Inactive'>('Active');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Toast Notification State
  const [toastNotification, setToastNotification] = useState<ToastNotificationState | null>(null);

  // Refs for latest option snapshots & concurrency control
  const authRolesRef = useRef(authRoles);
  const uiFilterRef = useRef({
    activeTab,
    searchQuery,
    selectedPositionFilter,
    currentPage,
  });
  const optionsSnapshotRef = useRef({
    positionOptions,
    positionFilterOptions,
    shiftScheduleOptions,
  });
  const listsSnapshotRef = useRef({
    users,
    pendingInvitations,
  });

  useEffect(() => {
    authRolesRef.current = authRoles;
    uiFilterRef.current = {
      activeTab,
      searchQuery,
      selectedPositionFilter,
      currentPage,
    };
    optionsSnapshotRef.current = {
      positionOptions,
      positionFilterOptions,
      shiftScheduleOptions,
    };
    listsSnapshotRef.current = {
      users,
      pendingInvitations,
    };
  });

  const fetchInFlightRef = useRef<Promise<void> | null>(null);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep UI filter/tab/page selection synced to SWR cache
  useEffect(() => {
    patchCachedUsersScreenData({
      activeTab,
      searchQuery,
      selectedPositionFilter,
      currentPage,
    });
  }, [activeTab, searchQuery, selectedPositionFilter, currentPage]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => setToastNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  // Close context menu on outside click
  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeMenuId]);

  // ---------------------------------------------------------------------------
  // FETCH DATA: Profiles, Invitations, Schedules (+ Roles fallback if AuthContext empty)
  // ---------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    if (fetchInFlightRef.current) {
      return fetchInFlightRef.current;
    }

    const runFetch = (async () => {
      try {
        const cachedRoles = authRolesRef.current;
        const shouldFetchRoles = cachedRoles.length === 0;

        const [profilesRes, invRes, schedulesRes, rolesRes] = await Promise.all([
          supabase
            .from('profiles')
            .select(PROFILE_COLUMNS)
            .order('created_at', { ascending: false }),
          supabase
            .from('invitations')
            .select(INVITATION_COLUMNS)
            .eq('status', 'pending')
            .order('created_at', { ascending: false }),
          supabase
            .from('shift_schedules')
            .select(SCHEDULE_COLUMNS)
            .order('sort_order', { ascending: true }),
          shouldFetchRoles
            ? supabase
                .from('access_roles')
                .select(ROLE_COLUMNS)
                .order('name', { ascending: true })
            : Promise.resolve({ data: null, error: null }),
        ]);

        // 1. Resolve role definitions (prefer AuthContext roles to skip redundant query)
        const rolesData: AccessRoleRow[] = shouldFetchRoles
          ? ((rolesRes.data as AccessRoleRow[] | null) ?? [])
          : cachedRoles;

        let nextPositionOptions = optionsSnapshotRef.current.positionOptions;
        let nextPositionFilterOptions = optionsSnapshotRef.current.positionFilterOptions;

        if (rolesData.length > 0) {
          nextPositionOptions = mapAccessRolesToOptions(rolesData);
          nextPositionFilterOptions = [
            { value: 'ALL', label: 'All Positions' },
            ...nextPositionOptions,
          ];
          setPositionOptions(nextPositionOptions);
          setPositionFilterOptions(nextPositionFilterOptions);
        }

        // 2. Process Official Users
        let nextUsers = listsSnapshotRef.current.users;
        if (profilesRes.error) {
          console.warn('Error fetching profiles:', profilesRes.error.message);
        } else if (profilesRes.data) {
          let deactList: string[] = [];
          let delList: string[] = [];
          try {
            deactList = JSON.parse(localStorage.getItem('pdrrmo_deactivated_users') || '[]');
            delList = JSON.parse(localStorage.getItem('pdrrmo_deleted_users') || '[]');
          } catch {
            // Ignore localStorage parse errors
          }

          nextUsers = (profilesRes.data as ProfileDbRow[])
            .filter((p) => !delList.includes(p.id) && !delList.includes(p.email))
            .map((p) => {
              const roleStr = (p.role || '').toLowerCase();
              const titleStr = (p.position_title || '').trim();

              const matchedDbRole = rolesData.find(
                (r) =>
                  (titleStr &&
                    (r.name.toLowerCase() === titleStr.toLowerCase() ||
                      r.code.toLowerCase() === titleStr.toLowerCase())) ||
                  (roleStr &&
                    (r.code.toLowerCase() === roleStr || r.name.toLowerCase() === roleStr))
              );

              const finalPosition =
                titleStr ||
                matchedDbRole?.name ||
                (roleStr === 'admin' ? 'Admin' : roleStr === 'staff' ? 'Staff' : 'Monitoring');
              const finalPositionTitle = p.position_title || matchedDbRole?.name || finalPosition;
              const isLocallyDeactivated =
                deactList.includes(p.id) || deactList.includes(p.email);
              const isRowActive = !isLocallyDeactivated && Boolean(p.is_active);
              const finalName = p.full_name || 'Personnel';

              return {
                id: p.id,
                name: finalName,
                email: p.email,
                position: finalPosition,
                positionTitle: finalPositionTitle,
                shift: p.default_shift || 'Day Shift (Alpha)',
                status: isRowActive ? 'Active' : 'Inactive',
                initials: getInitials(finalName || p.email),
                avatarColor: getAvatarColor(p.id || p.email),
                avatarUrl: p.avatar_url,
                lastActive: formatTimeAgo(p.last_active_at || p.updated_at),
                createdAt: p.created_at || undefined,
              };
            });
          setUsers(nextUsers);
        }

        // 3. Process Pending Invitations
        let nextPendingInvitations = listsSnapshotRef.current.pendingInvitations;
        if (invRes.error) {
          console.warn('Error fetching invitations:', invRes.error.message);
        } else if (invRes.data) {
          nextPendingInvitations = (invRes.data as unknown as InvitationDbRow[]).map((inv) => {
            const invRoleStr = (inv.role || '').toLowerCase();
            const invTitleStr = (inv.position_title || '').trim();

            const matchedInvRole = rolesData.find(
              (r) =>
                (invTitleStr &&
                  (r.name.toLowerCase() === invTitleStr.toLowerCase() ||
                    r.code.toLowerCase() === invTitleStr.toLowerCase())) ||
                (invRoleStr &&
                  (r.code.toLowerCase() === invRoleStr || r.name.toLowerCase() === invRoleStr))
            );

            const invPos =
              matchedInvRole?.name ||
              invTitleStr ||
              (invRoleStr === 'admin'
                ? 'Admin'
                : invRoleStr === 'staff'
                ? 'Staff'
                : 'Monitoring');
            const invTitle = inv.position_title || matchedInvRole?.name || invPos;
            const inviterName = inv.invited_by_profile?.full_name || 'Administrator';

            return {
              id: inv.id,
              email: inv.email,
              position: invPos,
              positionTitle: invTitle,
              shift: inv.default_shift || 'Day Shift (Alpha)',
              token: inv.token || undefined,
              status: inv.status || undefined,
              invitedAt: formatInvitedDate(inv.created_at),
              invitedBy: `${inviterName}`,
              expiresAt: inv.expires_at || undefined,
            };
          });
          setPendingInvitations(nextPendingInvitations);
        }

        // 4. Process Shift Schedules
        let nextShiftOptions = optionsSnapshotRef.current.shiftScheduleOptions;
        if (schedulesRes.data && schedulesRes.data.length > 0) {
          nextShiftOptions = (schedulesRes.data as ShiftScheduleDbRow[]).map((sch) => ({
            value: sch.name,
            label: sch.name,
            description: `${sch.start_time} – ${sch.end_time} · ${sch.duration || '8 Hours'}`,
            badge: `${sch.start_time} - ${sch.end_time}`,
            badgeColor: 'bg-blue-50 text-[#004AC6]',
            dotColor: sch.color || '#004AC6',
          }));
          setShiftScheduleOptions(nextShiftOptions);
        }

        // 5. Persist fresh snapshot into SWR cache
        setCachedUsersScreenData({
          users: nextUsers,
          pendingInvitations: nextPendingInvitations,
          positionOptions: nextPositionOptions,
          positionFilterOptions: nextPositionFilterOptions,
          shiftScheduleOptions: nextShiftOptions,
          activeTab: uiFilterRef.current.activeTab,
          searchQuery: uiFilterRef.current.searchQuery,
          selectedPositionFilter: uiFilterRef.current.selectedPositionFilter,
          currentPage: uiFilterRef.current.currentPage,
          fetchedAt: Date.now(),
        });
      } catch (err) {
        console.error('Error fetching user management data:', err);
      } finally {
        fetchInFlightRef.current = null;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    })();

    fetchInFlightRef.current = runFetch;
    return runFetch;
  }, []);

  // Initial mount: skip fetch if cache is still fresh (<30s), otherwise fetch/revalidate silently
  useEffect(() => {
    const cached = getCachedUsersScreenData();
    const isFresh = Boolean(cached && Date.now() - cached.fetchedAt < USERS_CACHE_STALE_MS);

    if (!isFresh) {
      void fetchData();
    }
  }, [fetchData]);

  // Real-Time Subscriptions (debounced 400ms to coalesce heartbeats & multi-row changes)
  useEffect(() => {
    const scheduleRealtimeRefresh = () => {
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
      }
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        void fetchData();
      }, REALTIME_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel('user-management-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleRealtimeRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, scheduleRealtimeRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_roles' }, scheduleRealtimeRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_schedules' }, scheduleRealtimeRefresh)
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Refresh Trigger
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setToastNotification({
      type: 'info',
      message: 'Data Synchronized',
      submessage: 'Profiles, access roles, and active invitations refreshed from database.',
    });
  };

  // ---------------------------------------------------------------------------
  // MEMOIZED DERIVED DATA, STATS & BADGE LOOKUP
  // ---------------------------------------------------------------------------
  const userStats = useMemo(() => {
    let active = 0;
    for (const u of users) {
      if (u.status === 'Active') active += 1;
    }
    return {
      total: users.length,
      active,
      inactive: users.length - active,
    };
  }, [users]);

  const positionBadgeMap = useMemo(
    () => buildPositionBadgeMap(positionOptions),
    [positionOptions]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedFilter = selectedPositionFilter.toLowerCase();

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !normalizedSearch ||
        u.name.toLowerCase().includes(normalizedSearch) ||
        u.email.toLowerCase().includes(normalizedSearch) ||
        u.position.toLowerCase().includes(normalizedSearch) ||
        Boolean(u.positionTitle && u.positionTitle.toLowerCase().includes(normalizedSearch));
      const matchesPosition =
        selectedPositionFilter === 'ALL' ||
        u.position.toLowerCase() === normalizedFilter ||
        Boolean(u.positionTitle && u.positionTitle.toLowerCase() === normalizedFilter);
      return matchesSearch && matchesPosition;
    });
  }, [users, normalizedSearch, selectedPositionFilter, normalizedFilter]);

  const filteredInvitations = useMemo(() => {
    return pendingInvitations.filter((inv) => {
      const matchesSearch =
        !normalizedSearch ||
        inv.email.toLowerCase().includes(normalizedSearch) ||
        inv.position.toLowerCase().includes(normalizedSearch) ||
        inv.invitedBy.toLowerCase().includes(normalizedSearch) ||
        Boolean(inv.positionTitle && inv.positionTitle.toLowerCase().includes(normalizedSearch));
      const matchesPosition =
        selectedPositionFilter === 'ALL' ||
        inv.position.toLowerCase() === normalizedFilter ||
        Boolean(inv.positionTitle && inv.positionTitle.toLowerCase() === normalizedFilter);
      return matchesSearch && matchesPosition;
    });
  }, [pendingInvitations, normalizedSearch, selectedPositionFilter, normalizedFilter]);

  const totalCount = activeTab === 'official' ? filteredUsers.length : filteredInvitations.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, safeCurrentPage]);

  const paginatedInvitations = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredInvitations.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInvitations, safeCurrentPage]);

  const handleTabChange = useCallback((tab: 'official' | 'pending') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setActiveMenuId(null);
  }, []);

  const handleToggleMenu = useCallback((id: string) => {
    setActiveMenuId((prev) => (prev === id ? null : id));
  }, []);

  // ---------------------------------------------------------------------------
  // INVITATION MODAL HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenInviteModal = useCallback(() => {
    if (!canModifyUsers) {
      setToastNotification({
        type: 'warning',
        message: 'Action Restricted',
        submessage: 'Inviting new users is restricted under View-Only clearance.',
      });
      return;
    }
    setInviteEmails([]);
    setCurrentEmailInput('');
    const defaultPos = positionOptions[0]?.value || 'Monitoring';
    const defaultTitle = positionOptions[0]?.label || 'Monitoring Officer';
    setInvitePosition(defaultPos);
    setInvitePositionTitle(defaultTitle);
    setInviteShift(shiftScheduleOptions[0]?.value || 'Day Shift (Alpha)');
    setIsInviteModalOpen(true);
    setActiveMenuId(null);
  }, [canModifyUsers, positionOptions, shiftScheduleOptions]);

  const handleAddEmail = useCallback(
    (rawText?: string) => {
      const textToProcess = rawText !== undefined ? rawText : currentEmailInput;
      if (!textToProcess.trim()) return;

      const emails = textToProcess
        .split(/[\s,;\n]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes('@'));

      if (emails.length > 0) {
        setInviteEmails((prev) => Array.from(new Set([...prev, ...emails])));
        setCurrentEmailInput('');
      }
    },
    [currentEmailInput]
  );

  const handleRemoveEmail = useCallback((emailToRemove: string) => {
    setInviteEmails((prev) => prev.filter((e) => e !== emailToRemove));
  }, []);

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModifyUsers) {
      setToastNotification({
        type: 'warning',
        message: 'Action Restricted',
        submessage: 'Inviting new users is restricted under View-Only clearance.',
      });
      return;
    }

    let finalEmails = [...inviteEmails];
    if (currentEmailInput.trim()) {
      const extra = currentEmailInput
        .split(/[\s,;\n]+/)
        .map((val) => val.trim().toLowerCase())
        .filter((val) => val.length > 0 && val.includes('@'));
      finalEmails = Array.from(new Set([...finalEmails, ...extra]));
    }

    if (finalEmails.length === 0) {
      setToastNotification({
        type: 'warning',
        message: 'No Valid Email Specified',
        submessage: 'Please enter at least one valid recipient email address.',
      });
      return;
    }

    setIsSendingInvitations(true);

    try {
      const inviterName = currentAdminProfile?.full_name || 'Administrator';
      const inviterId = currentAdminProfile?.id || null;
      const normalizedRole = normalizeEnumRole(invitePosition);
      const positionTitle =
        invitePositionTitle ||
        invitePosition ||
        (invitePosition.toLowerCase().includes('admin') ? 'Administrator' : 'Monitoring Officer');

      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      let wasSimulated = false;

      for (const email of finalEmails) {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const token = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
        const inviteUrl = `${origin}/register?token=${token}&email=${encodeURIComponent(email)}`;

        await supabase.from('invitations').delete().eq('email', email).eq('status', 'pending');

        const { error: insertError } = await supabase.from('invitations').insert({
          email,
          role: normalizedRole,
          position_title: positionTitle,
          default_shift: inviteShift,
          token,
          status: 'pending',
          invited_by: inviterId,
        });

        if (insertError) {
          console.error('Database insert error for invitation:', insertError);
          throw new Error(`Database Error (${insertError.code}): ${insertError.message}`);
        }

        try {
          const apiRes = await fetch('/api/invitations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              role: normalizedRole,
              positionTitle,
              shift: inviteShift,
              inviteUrl,
              token,
              invitedBy: inviterName,
            }),
          });
          const apiData = await apiRes.json();
          if (apiData?.emailResult?.simulated) {
            wasSimulated = true;
          }
        } catch (mailErr) {
          console.warn('SMTP dispatch warning:', mailErr);
        }
      }

      setIsInviteModalOpen(false);
      await fetchData();

      if (wasSimulated) {
        setToastNotification({
          type: 'info',
          message: `${finalEmails.length} ${finalEmails.length === 1 ? 'Invitation' : 'Invitations'} Saved to Database`,
          submessage:
            'Note: SMTP credentials (SMTP_USER/SMTP_PASS) are not set in .env.local, so email delivery was simulated.',
        });
      } else {
        setToastNotification({
          type: 'success',
          message: `${finalEmails.length} ${finalEmails.length === 1 ? 'Invitation' : 'Invitations'} Dispatched via SMTP`,
          submessage: `Sent to ${
            finalEmails.length === 1 ? finalEmails[0] : `${finalEmails.length} recipients`
          } · Assigned: ${invitePosition} (${inviteShift}).`,
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to dispatch invitation.';
      setToastNotification({
        type: 'warning',
        message: 'Invitation Error',
        submessage: errorMsg,
      });
    } finally {
      setIsSendingInvitations(false);
    }
  };

  const handleResendInvitation = useCallback(
    async (invitation: PendingInvitation) => {
      if (!canModifyUsers) {
        setToastNotification({
          type: 'warning',
          message: 'Action Restricted',
          submessage: 'Resending invitations is restricted under View-Only clearance.',
        });
        return;
      }
      setActiveMenuId(null);
      try {
        const inviterName = currentAdminProfile?.full_name || 'Administrator';
        const origin =
          typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const newToken = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
        const inviteUrl = `${origin}/register?token=${newToken}&email=${encodeURIComponent(
          invitation.email
        )}`;

        const { error: updateError } = await supabase
          .from('invitations')
          .update({
            token: newToken,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', invitation.id);

        if (updateError) throw new Error(updateError.message);

        const invRole = normalizeEnumRole(invitation.position);

        const apiRes = await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: invitation.email,
            role: invRole,
            positionTitle: invitation.positionTitle || invitation.position,
            shift: invitation.shift || 'Day Shift (Alpha)',
            inviteUrl,
            token: newToken,
            invitedBy: inviterName,
          }),
        });

        const apiData = await apiRes.json();
        await fetchData();

        if (apiData?.emailResult?.simulated) {
          setToastNotification({
            type: 'info',
            message: 'Token Refreshed in Database',
            submessage: 'Note: SMTP credentials not set in .env.local (email simulated).',
          });
        } else {
          setToastNotification({
            type: 'success',
            message: 'Invitation Dispatched via SMTP',
            submessage: `Fresh verification token sent to ${invitation.email}`,
          });
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Error resending invitation.';
        setToastNotification({
          type: 'warning',
          message: 'Resend Failed',
          submessage: errorMsg,
        });
      }
    },
    [canModifyUsers, currentAdminProfile, fetchData]
  );

  const handleRevokeInvitation = useCallback(
    async (invitationId: string) => {
      if (!canModifyUsers) {
        setToastNotification({
          type: 'warning',
          message: 'Action Restricted',
          submessage: 'Revoking invitations is restricted under View-Only clearance.',
        });
        return;
      }
      setActiveMenuId(null);
      try {
        const { error } = await supabase.from('invitations').delete().eq('id', invitationId);
        if (error) throw new Error(error.message);

        await fetchData();

        setToastNotification({
          type: 'warning',
          message: 'Invitation Revoked',
          submessage: 'The security onboarding token has been removed from database.',
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Error revoking invitation.';
        setToastNotification({
          type: 'warning',
          message: 'Revoke Failed',
          submessage: errorMsg,
        });
      }
    },
    [canModifyUsers, fetchData]
  );

  const handleCopyInviteLink = useCallback((invitation: PendingInvitation) => {
    setActiveMenuId(null);
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://mls.pdrrmo.gov.ph';
    const link = invitation.token
      ? `${origin}/register?token=${invitation.token}&email=${encodeURIComponent(invitation.email)}`
      : `${origin}/register?email=${encodeURIComponent(invitation.email)}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link);
    }

    setToastNotification({
      type: 'info',
      message: 'Onboarding Link Copied',
      submessage: `Link for ${invitation.email} copied to clipboard.`,
    });
  }, []);

  // ---------------------------------------------------------------------------
  // USER EDIT / STATUS / DELETE HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenEditUser = useCallback(
    (user: UserAccount) => {
      if (!canModifyUsers) {
        setToastNotification({
          type: 'warning',
          message: 'Action Restricted',
          submessage: 'Editing user accounts is restricted under View-Only clearance.',
        });
        return;
      }
      setEditingUser(user);
      setEditName(user.name);
      setEditEmail(user.email);
      const matchingOption = positionOptions.find(
        (opt) =>
          opt.value.toLowerCase() === (user.position || '').toLowerCase() ||
          opt.label.toLowerCase() === (user.position || '').toLowerCase() ||
          (user.positionTitle && opt.value.toLowerCase() === user.positionTitle.toLowerCase()) ||
          (user.positionTitle && opt.label.toLowerCase() === user.positionTitle.toLowerCase())
      );
      const selectedPos = matchingOption
        ? matchingOption.value
        : user.position || positionOptions[0]?.value || 'Monitoring';
      setEditPosition(selectedPos);
      setEditPositionTitle(user.positionTitle || matchingOption?.label || selectedPos);
      setEditShift(user.shift || shiftScheduleOptions[0]?.value || 'Day Shift (Alpha)');
      setEditStatus(user.status);
      setIsEditModalOpen(true);
      setActiveMenuId(null);
    },
    [canModifyUsers, positionOptions, shiftScheduleOptions]
  );

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModifyUsers) {
      setToastNotification({
        type: 'warning',
        message: 'Action Restricted',
        submessage: 'Editing user accounts is restricted under View-Only clearance.',
      });
      return;
    }
    if (!editingUser) return;
    setIsSavingEdit(true);

    const targetId = editingUser.id;
    const targetName = editName.trim();
    const selectedOption = positionOptions.find(
      (opt) =>
        opt.value.toLowerCase() === editPosition.toLowerCase() ||
        opt.label.toLowerCase() === editPosition.toLowerCase()
    );
    const roleName = selectedOption?.label || editPosition;
    const normalizedRole = normalizeEnumRole(editPosition);
    const finalPositionTitle = editPositionTitle.trim() || roleName;

    const updatedUser: UserAccount = {
      ...editingUser,
      name: targetName,
      position: roleName,
      positionTitle: finalPositionTitle,
      shift: editShift,
      status: editStatus,
      initials: getInitials(targetName || editingUser.email),
    };

    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetId,
          full_name: targetName,
          role: normalizedRole,
          position_title: finalPositionTitle,
          default_shift: editShift,
          is_active: editStatus === 'Active',
        }),
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (resData?.rlsBlocked) {
          throw new Error(
            'Supabase Row Level Security (RLS) blocked this update. Please run the SQL migration script in supabase/fix_profiles_rls_and_cascade.sql in your Supabase SQL Editor.'
          );
        }
        throw new Error(resData?.error || 'Failed to update user profile in database.');
      }

      await supabase
        .from('profiles')
        .update({
          full_name: targetName,
          role: normalizedRole,
          position_title: finalPositionTitle,
          default_shift: editShift,
          is_active: editStatus === 'Active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);

      try {
        const currentDeact: string[] = JSON.parse(
          localStorage.getItem('pdrrmo_deactivated_users') || '[]'
        );
        const updatedDeact =
          editStatus === 'Inactive'
            ? Array.from(new Set([...currentDeact, targetId, editingUser.email]))
            : currentDeact.filter((id) => id !== targetId && id !== editingUser.email);
        localStorage.setItem('pdrrmo_deactivated_users', JSON.stringify(updatedDeact));
      } catch {
        // Ignore storage errors
      }

      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('pdrrmo_auth_sync');
          bc.postMessage({
            type: 'USER_EDITED',
            userId: targetId,
            email: editingUser.email,
            user: updatedUser,
          });
          bc.postMessage({
            type: editStatus === 'Inactive' ? 'USER_DEACTIVATED' : 'USER_ACTIVATED',
            userId: targetId,
            email: editingUser.email,
            name: targetName,
          });
          bc.close();
        }
      } catch {
        // Ignore BroadcastChannel errors
      }

      setIsEditModalOpen(false);
      await fetchData();

      setToastNotification({
        type: 'success',
        message: 'User Profile Updated',
        submessage: `Changes successfully saved for ${targetName} (${roleName} · ${editShift}).`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error updating user profile.';
      console.error('Save user edit error:', err);
      setIsEditModalOpen(false);
      await fetchData();
      setToastNotification({
        type: 'warning',
        message: 'Database Update Notice',
        submessage: errorMsg,
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleStatus = useCallback(
    async (user: UserAccount) => {
      if (!canModifyUsers) {
        setToastNotification({
          type: 'warning',
          message: 'Action Restricted',
          submessage: 'Modifying user account status is restricted under View-Only clearance.',
        });
        return;
      }
      setActiveMenuId(null);
      const nextStatus: UserAccount['status'] =
        user.status === 'Active' ? 'Inactive' : 'Active';
      const nextIsActive = nextStatus === 'Active';

      // Optimistic React state + immediate SWR cache update
      setUsers((prev) => {
        const nextUsers = prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u));
        patchCachedUsersScreenData({ users: nextUsers });
        return nextUsers;
      });

      try {
        const currentDeact: string[] = JSON.parse(
          localStorage.getItem('pdrrmo_deactivated_users') || '[]'
        );
        const updatedDeact = !nextIsActive
          ? Array.from(new Set([...currentDeact, user.id, user.email]))
          : currentDeact.filter((id) => id !== user.id && id !== user.email);
        localStorage.setItem('pdrrmo_deactivated_users', JSON.stringify(updatedDeact));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }

      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('pdrrmo_auth_sync');
          bc.postMessage({
            type: nextIsActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
            userId: user.id,
            email: user.email,
            name: user.name,
          });
          bc.close();
        }
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }

      try {
        await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            is_active: nextIsActive,
          }),
        });

        await supabase
          .from('profiles')
          .update({
            is_active: nextIsActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        await fetchData();

        setToastNotification({
          type: nextStatus === 'Active' ? 'success' : 'warning',
          message: `Account Status: ${nextStatus}`,
          submessage: `${user.name} is now marked as ${nextStatus.toLowerCase()}. Active user session locked.`,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Error updating status.';
        console.error('Toggle status notice:', err);
        setToastNotification({
          type: 'warning',
          message: 'Status Notification',
          submessage: errorMsg,
        });
      }
    },
    [canModifyUsers, fetchData]
  );

  const handleOpenDeleteModal = useCallback(
    (user: UserAccount) => {
      if (!canModifyUsers) {
        setToastNotification({
          type: 'warning',
          message: 'Action Restricted',
          submessage: 'Removing user accounts is restricted under View-Only clearance.',
        });
        return;
      }
      setDeletingUser(user);
      setIsDeleteModalOpen(true);
      setActiveMenuId(null);
    },
    [canModifyUsers]
  );

  const handleConfirmDeleteUser = async () => {
    if (!canModifyUsers) {
      setToastNotification({
        type: 'warning',
        message: 'Action Restricted',
        submessage: 'Removing user accounts is restricted under View-Only clearance.',
      });
      return;
    }
    if (!deletingUser) return;
    const target = deletingUser;

    setUsers((prev) => {
      const nextUsers = prev.filter((u) => u.id !== target.id);
      patchCachedUsersScreenData({ users: nextUsers });
      return nextUsers;
    });
    setIsDeleteModalOpen(false);

    try {
      const currentDel: string[] = JSON.parse(
        localStorage.getItem('pdrrmo_deleted_users') || '[]'
      );
      const updatedDel = Array.from(new Set([...currentDel, target.id, target.email]));
      localStorage.setItem('pdrrmo_deleted_users', JSON.stringify(updatedDel));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('pdrrmo_auth_sync');
        bc.postMessage({
          type: 'USER_REMOVED',
          userId: target.id,
          email: target.email,
          name: target.name,
        });
        bc.close();
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    try {
      await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id }),
      });

      await supabase.from('profiles').delete().eq('id', target.id);
      await fetchData();

      setToastNotification({
        type: 'warning',
        message: 'User Account Removed',
        submessage: `${target.name} has been removed from system access. Active user session terminated.`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete user profile.';
      console.error('Delete user notice:', err);
      setToastNotification({
        type: 'warning',
        message: 'Removal Notification',
        submessage: errorMsg,
      });
    }
  };

  // Silence unused check if isViewOnly is kept for quick extensions
  void isViewOnly;

  return (
    <AppLayoutShell title="MLS User Management">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-12">
        {/* ========================================================================= */}
        {/* 1. HEADER SECTION */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1E293B] tracking-tight">
              User Management
            </h1>
            <p className="text-sm text-[#505F76] mt-1">
              Manage administrative credentials, assigned access positions, and SMTP pending invitations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <SecondaryButton
              size="md"
              pill
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoading}
              leftIcon={
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#004AC6]' : ''}`} />
              }
              className="w-full sm:w-auto justify-center"
            >
              Refresh
            </SecondaryButton>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <SecondaryButton
                size="md"
                pill
                onClick={() => setIsEmailPreviewModalOpen(true)}
                leftIcon={<Eye className="w-4 h-4" />}
                className="flex-1 sm:flex-initial justify-center"
              >
                Email UI/UX Preview
              </SecondaryButton>

              {canModifyUsers && (
                <PrimaryButton
                  size="md"
                  pill
                  onClick={handleOpenInviteModal}
                  leftIcon={<UserPlus className="w-4 h-4" />}
                  className="flex-1 sm:flex-initial justify-center shadow-md hover:shadow-lg transition-all"
                >
                  Invite User
                </PrimaryButton>
              )}
            </div>
          </div>
        </div>

        <ViewOnlyNotice
          screen="Users"
          message="Inviting new personnel and managing existing credentials are restricted under View-Only clearance."
        />

        {/* ========================================================================= */}
        {/* 2. BENTO SUMMARY METRIC CARDS (Memoized) */}
        {/* ========================================================================= */}
        <UsersSummaryCards
          isLoading={isLoading}
          totalUsers={userStats.total}
          activeUsers={userStats.active}
          inactiveUsers={userStats.inactive}
          pendingCount={pendingInvitations.length}
        />

        {/* ========================================================================= */}
        {/* 3. USER TABLE SECTION WITH TABS & FILTERS */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white">
            {/* Segmented Tabs */}
            <div className="flex bg-[#F1F5F9] p-1.5 rounded-full self-start border border-[#E2E8F0]/70">
              <button
                type="button"
                onClick={() => handleTabChange('official')}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'official'
                    ? 'bg-white text-[#004AC6] shadow-xs'
                    : 'text-[#505F76] hover:text-[#1E293B]'
                }`}
              >
                <span>Official Users</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === 'official'
                      ? 'bg-[#004AC6]/10 text-[#004AC6]'
                      : 'bg-slate-200 text-[#505F76]'
                  }`}
                >
                  {users.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('pending')}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'pending'
                    ? 'bg-white text-[#004AC6] shadow-xs'
                    : 'text-[#505F76] hover:text-[#1E293B]'
                }`}
              >
                <span>Pending Invitations</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === 'pending'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-[#505F76]'
                  }`}
                >
                  {pendingInvitations.length}
                </span>
              </button>
            </div>

            {/* Search & Position Filter */}
            <div className="flex items-center gap-3 flex-1 md:max-w-md justify-end">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by name, email, or position..."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 pl-10 pr-4 text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                />
              </div>

              <div className="w-44 shrink-0">
                <CustomDropdown
                  options={positionFilterOptions}
                  value={selectedPositionFilter}
                  onChange={(val) => {
                    setSelectedPositionFilter(val);
                    setCurrentPage(1);
                  }}
                  leftIcon={<Filter className="w-3.5 h-3.5" />}
                  size="sm"
                  pill
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <UsersDirectoryTable
              isLoading={isLoading}
              activeTab={activeTab}
              paginatedUsers={paginatedUsers}
              paginatedInvitations={paginatedInvitations}
              searchQuery={searchQuery}
              selectedPositionFilter={selectedPositionFilter}
              canModifyUsers={canModifyUsers}
              activeMenuId={activeMenuId}
              positionBadgeMap={positionBadgeMap}
              onToggleMenu={handleToggleMenu}
              onEditUser={handleOpenEditUser}
              onToggleStatus={handleToggleStatus}
              onDeleteUser={handleOpenDeleteModal}
              onResendInvitation={handleResendInvitation}
              onCopyInviteLink={handleCopyInviteLink}
              onRevokeInvitation={handleRevokeInvitation}
            />
          </div>

          <div className="p-4 sm:p-5 border-t border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <span className="text-xs text-[#757680] font-medium">
              Showing {totalCount > 0 ? (safeCurrentPage - 1) * ITEMS_PER_PAGE + 1 : 0} to{' '}
              {Math.min(safeCurrentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount}{' '}
              {activeTab === 'official' ? 'users' : 'invitations'}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-bold text-[#1E293B] px-2">
                Page {safeCurrentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4–7. LAZY-LOADED MODALS (Mounted & fetched on demand) */}
      {/* ========================================================================= */}
      {isInviteModalOpen && (
        <InviteUserModal
          isOpen={isInviteModalOpen}
          isSendingInvitations={isSendingInvitations}
          inviteEmails={inviteEmails}
          currentEmailInput={currentEmailInput}
          invitePosition={invitePosition}
          inviteShift={inviteShift}
          positionOptions={positionOptions}
          shiftScheduleOptions={shiftScheduleOptions}
          onClose={() => setIsInviteModalOpen(false)}
          onSubmit={handleSendInvitation}
          onCurrentEmailInputChange={setCurrentEmailInput}
          onAddEmail={handleAddEmail}
          onRemoveEmail={handleRemoveEmail}
          onSelectPosition={(val, label) => {
            setInvitePosition(val);
            setInvitePositionTitle(label);
          }}
          onSelectShift={setInviteShift}
          onOpenEmailPreview={() => setIsEmailPreviewModalOpen(true)}
        />
      )}

      {isEmailPreviewModalOpen && (
        <EmailPreviewModal
          isOpen={isEmailPreviewModalOpen}
          emailPreviewMode={emailPreviewMode}
          sampleEmail={inviteEmails[0] || 'personnel.ops@pdrrmo.gov.ph'}
          invitePosition={invitePosition}
          invitePositionTitle={invitePositionTitle}
          inviteShift={inviteShift}
          inviterName={currentAdminProfile?.full_name || 'PDRRMO Operations Administrator'}
          onChangeMode={setEmailPreviewMode}
          onClose={() => setIsEmailPreviewModalOpen(false)}
          onUseTemplate={() => {
            setIsEmailPreviewModalOpen(false);
            handleOpenInviteModal();
          }}
        />
      )}

      {isEditModalOpen && (
        <EditUserModal
          isOpen={isEditModalOpen}
          editingUser={editingUser}
          isSavingEdit={isSavingEdit}
          editName={editName}
          editEmail={editEmail}
          editPosition={editPosition}
          editShift={editShift}
          editStatus={editStatus}
          positionOptions={positionOptions}
          shiftScheduleOptions={shiftScheduleOptions}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleSaveUserEdit}
          onNameChange={setEditName}
          onSelectPosition={(val, label) => {
            setEditPosition(val);
            setEditPositionTitle(label);
          }}
          onSelectShift={setEditShift}
          onToggleStatus={() =>
            setEditStatus((prev) => (prev === 'Active' ? 'Inactive' : 'Active'))
          }
        />
      )}

      {isDeleteModalOpen && (
        <DeleteUserModal
          isOpen={isDeleteModalOpen}
          deletingUser={deletingUser}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirmDelete={handleConfirmDeleteUser}
        />
      )}

      {/* ========================================================================= */}
      {/* 8. TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-[#1E293B] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 max-w-md"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                toastNotification.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : toastNotification.type === 'info'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {toastNotification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : toastNotification.type === 'info' ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">{toastNotification.message}</p>
              {toastNotification.submessage && (
                <p className="text-xs text-slate-300 mt-0.5">{toastNotification.submessage}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
