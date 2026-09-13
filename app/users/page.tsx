'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  RotateCw,
  UserCheck,
  UserX,
  Check,
  Send,
  Sparkles,
  Eye,
  Smartphone,
  Monitor,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { generateInvitationEmailHtml } from '@/lib/email/invitation-email';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  position: 'Admin' | 'Monitoring' | 'Staff';
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
  position: 'Admin' | 'Monitoring' | 'Staff';
  positionTitle?: string;
  shift?: string;
  token?: string;
  status?: string;
  invitedAt: string;
  invitedBy: string;
  expiresAt?: string;
}

// Fallback Positions
const defaultPositionOptions: CustomDropdownOption[] = [
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

// Fallback Shift Schedules
const defaultShiftScheduleOptions: CustomDropdownOption[] = [
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

const positionFilterOptions: CustomDropdownOption[] = [
  { value: 'ALL', label: 'All Positions' },
  { value: 'Admin', label: 'Admin', dotColor: '#004AC6', badge: 'System', badgeColor: 'bg-blue-50 text-[#004AC6]' },
  { value: 'Monitoring', label: 'Monitoring', dotColor: '#0284C7', badge: 'Operational', badgeColor: 'bg-sky-50 text-sky-700' },
  { value: 'Staff', label: 'Staff', dotColor: '#505F76', badge: 'Standard', badgeColor: 'bg-slate-100 text-[#505F76]' },
];

// Helper to calculate initials
function getInitials(name: string): string {
  if (!name) return 'MO';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Avatar Colors Generator
const AVATAR_COLORS = ['#004AC6', '#0284C7', '#BA1A1A', '#10B981', '#8B5CF6', '#F59E0B'];
function getAvatarColor(idOrEmail: string): string {
  let hash = 0;
  for (let i = 0; i < idOrEmail.length; i++) {
    hash = idOrEmail.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Format relative or ISO timestamp
function formatTimeAgo(isoString?: string | null): string {
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

function formatInvitedDate(isoString?: string | null): string {
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

// =============================================================================
// USER AVATAR COMPONENT WITH DYNAMIC PROFILE PICTURE & INITIALS FALLBACK
// =============================================================================
interface UserAvatarProps {
  user: {
    name?: string;
    email?: string;
    avatarUrl?: string | null;
    avatarColor?: string;
    initials?: string;
    id?: string;
    status?: 'Active' | 'Inactive';
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  className?: string;
}

function UserAvatar({
  user,
  size = 'md',
  showStatus = false,
  className = '',
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user.avatarUrl]);

  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-lg',
  };

  const statusDotSizes = {
    sm: 'w-2 h-2 border',
    md: 'w-2.5 h-2.5 border-[1.5px]',
    lg: 'w-3 h-3 border-2',
    xl: 'w-4 h-4 border-2',
  };

  const initials = user.initials || getInitials(user.name || user.email || 'Personnel');
  const bgColor = user.avatarColor || getAvatarColor(user.id || user.email || user.name || 'avatar');
  const hasValidImage = Boolean(user.avatarUrl && !imgError);

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {hasValidImage ? (
        <img
          src={user.avatarUrl!}
          alt={user.name || 'User Avatar'}
          onError={() => setImgError(true)}
          className={`${sizeClasses[size]} rounded-full object-cover border border-[#E2E8F0] shadow-xs`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white shadow-xs select-none`}
          style={{ backgroundColor: bgColor }}
        >
          {initials}
        </div>
      )}

      {showStatus && user.status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-white ${
            statusDotSizes[size]
          } ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}
          title={user.status}
        />
      )}
    </div>
  );
}


// =============================================================================
// LOADING SKELETON COMPONENTS
// =============================================================================
function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="relative bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs overflow-hidden animate-pulse"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="h-4 w-28 bg-slate-200 rounded-md" />
            <div className="w-9 h-9 rounded-2xl bg-slate-200" />
          </div>
          <div className="flex items-end gap-4">
            <div className="h-10 w-16 bg-slate-200 rounded-lg" />
            <div className="h-6 w-24 bg-slate-200 rounded-full mb-1" />
          </div>
          <div className="mt-4 h-3 w-48 bg-slate-200 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function UsersTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full divide-y divide-[#E2E8F0] animate-pulse">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="py-4 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-[200px]">
            <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-32 bg-slate-200 rounded-md" />
              <div className="h-3 w-20 bg-slate-200 rounded-md" />
            </div>
          </div>
          <div className="h-6 w-24 bg-slate-200 rounded-full hidden sm:block" />
          <div className="h-4 w-36 bg-slate-200 rounded-md hidden md:block" />
          <div className="h-6 w-20 bg-slate-200 rounded-full" />
          <div className="w-8 h-8 bg-slate-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// MAIN USER MANAGEMENT PAGE
// =============================================================================
export default function UserManagementPage() {
  const { profile: currentAdminProfile, canWrite, isViewOnly } = useAuth();
  const isUsersViewOnly = isViewOnly('Users');
  const canModifyUsers = canWrite('Users');

  const [activeTab, setActiveTab] = useState<'official' | 'pending'>('official');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dynamic dropdown options from access_roles and shift_schedules
  const [positionOptions, setPositionOptions] = useState<CustomDropdownOption[]>(defaultPositionOptions);
  const [shiftScheduleOptions, setShiftScheduleOptions] = useState<CustomDropdownOption[]>(defaultShiftScheduleOptions);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPositionFilter, setSelectedPositionFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modals
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEmailPreviewModalOpen, setIsEmailPreviewModalOpen] = useState(false);
  const [emailPreviewMode, setEmailPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Invite Form State (Multiple Emails & Position & Shift Schedule Dropdowns)
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [currentEmailInput, setCurrentEmailInput] = useState('');
  const [invitePosition, setInvitePosition] = useState<'Admin' | 'Monitoring' | 'Staff'>('Monitoring');
  const [invitePositionTitle, setInvitePositionTitle] = useState('Monitoring Officer');
  const [inviteShift, setInviteShift] = useState<string>('Day Shift (Alpha)');
  const [isSendingInvitations, setIsSendingInvitations] = useState(false);

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPosition, setEditPosition] = useState<'Admin' | 'Monitoring' | 'Staff'>('Monitoring');
  const [editShift, setEditShift] = useState<string>('Day Shift (Alpha)');
  const [editStatus, setEditStatus] = useState<'Active' | 'Inactive'>('Active');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Toast Notification State
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    submessage?: string;
    type: 'success' | 'info' | 'warning';
  } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => setToastNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // ---------------------------------------------------------------------------
  // FETCH DATA: Profiles, Invitations, Roles, Shift Schedules
  // ---------------------------------------------------------------------------
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      // 1. Fetch Official Users from public.profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.warn('Error fetching profiles:', profilesError.message);
      } else if (profilesData) {
        let deactList: string[] = [];
        let delList: string[] = [];
        let editedMap: Record<string, any> = {};
        try {
          deactList = JSON.parse(localStorage.getItem('pdrrmo_deactivated_users') || '[]');
          delList = JSON.parse(localStorage.getItem('pdrrmo_deleted_users') || '[]');
          editedMap = JSON.parse(localStorage.getItem('pdrrmo_edited_users') || '{}');
        } catch (e) {}

        const mappedUsers: UserAccount[] = profilesData
          .filter((p) => !delList.includes(p.id) && !delList.includes(p.email))
          .map((p) => {
            const userEdit = editedMap[p.id] || (p.email ? editedMap[p.email.toLowerCase()] : null) || {};

            let pos: 'Admin' | 'Monitoring' | 'Staff' = 'Monitoring';
            const roleStr = (userEdit.role || p.role || '').toLowerCase();
            if (roleStr === 'admin' || userEdit.position === 'Admin') pos = 'Admin';
            else if (roleStr === 'staff' || userEdit.position === 'Staff') pos = 'Staff';
            else pos = 'Monitoring';

            const isLocallyDeactivated = deactList.includes(p.id) || deactList.includes(p.email) || userEdit.status === 'Inactive';
            const isRowActive = !isLocallyDeactivated && (userEdit.status ? userEdit.status === 'Active' : Boolean(p.is_active));

            const finalName = userEdit.name || p.full_name || 'Personnel';
            const finalShift = userEdit.shift || p.default_shift || 'Day Shift (Alpha)';
            const finalPositionTitle =
              userEdit.positionTitle ||
              p.position_title ||
              (pos === 'Admin' ? 'Administrator' : 'Monitoring Officer');

            return {
              id: p.id,
              name: finalName,
              email: p.email,
              position: pos,
              positionTitle: finalPositionTitle,
              shift: finalShift,
              status: isRowActive ? 'Active' : 'Inactive',
              initials: getInitials(finalName || p.email),
              avatarColor: getAvatarColor(p.id || p.email),
              avatarUrl: userEdit.avatarUrl !== undefined ? userEdit.avatarUrl : p.avatar_url,
              lastActive: formatTimeAgo(p.last_active_at || p.updated_at),
              createdAt: p.created_at,
            };
          });
        setUsers(mappedUsers);
      }

      // 2. Fetch Pending Invitations from public.invitations
      const { data: invData, error: invError } = await supabase
        .from('invitations')
        .select('*, invited_by_profile:invited_by(full_name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (invError) {
        console.warn('Error fetching invitations:', invError.message);
      } else if (invData) {
        const mappedInvs: PendingInvitation[] = invData.map((inv) => {
          let pos: 'Admin' | 'Monitoring' | 'Staff' = 'Monitoring';
          const r = (inv.role || '').toLowerCase();
          if (r === 'admin') pos = 'Admin';
          else if (r === 'staff') pos = 'Staff';
          else pos = 'Monitoring';

          const inviterName = inv.invited_by_profile?.full_name || 'Administrator';

          return {
            id: inv.id,
            email: inv.email,
            position: pos,
            positionTitle: inv.position_title || (pos === 'Admin' ? 'Administrator' : 'Monitoring Officer'),
            shift: inv.default_shift || 'Day Shift (Alpha)',
            token: inv.token,
            status: inv.status,
            invitedAt: formatInvitedDate(inv.created_at),
            invitedBy: `${inviterName}`,
            expiresAt: inv.expires_at,
          };
        });
        setPendingInvitations(mappedInvs);
      }

      // 3. Fetch Access Roles to populate position options
      const { data: rolesData } = await supabase
        .from('access_roles')
        .select('*')
        .order('name', { ascending: true });

      if (rolesData && rolesData.length > 0) {
        const dynamicRoles: CustomDropdownOption[] = rolesData.map((role) => ({
          value: role.name,
          label: role.name,
          description: role.description || `${role.name} Role`,
          badge: role.badge || 'Operational',
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
        setPositionOptions(dynamicRoles);
      }

      // 4. Fetch Shift Schedules
      const { data: schedulesData } = await supabase
        .from('shift_schedules')
        .select('*')
        .order('sort_order', { ascending: true });

      if (schedulesData && schedulesData.length > 0) {
        const dynamicSchedules: CustomDropdownOption[] = schedulesData.map((sch) => ({
          value: sch.name,
          label: sch.name,
          description: `${sch.start_time} – ${sch.end_time} · ${sch.duration || '8 Hours'}`,
          badge: `${sch.start_time} - ${sch.end_time}`,
          badgeColor: 'bg-blue-50 text-[#004AC6]',
          dotColor: sch.color || '#004AC6',
        }));
        setShiftScheduleOptions(dynamicSchedules);
      }
    } catch (err) {
      console.error('Error fetching user management data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Real-Time Subscriptions for Profiles & Invitations
  useEffect(() => {
    const channel = supabase
      .channel('user-management-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchData(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invitations' },
        () => {
          fetchData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Refresh Trigger
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchData(false);
    setToastNotification({
      type: 'info',
      message: 'Data Synchronized',
      submessage: 'Profiles and active invitations refreshed from database.',
    });
  };

  // ---------------------------------------------------------------------------
  // FILTERING & PAGINATION
  // ---------------------------------------------------------------------------
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.positionTitle && u.positionTitle.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPosition =
        selectedPositionFilter === 'ALL' || u.position === selectedPositionFilter;
      return matchesSearch && matchesPosition;
    });
  }, [users, searchQuery, selectedPositionFilter]);

  const filteredInvitations = useMemo(() => {
    return pendingInvitations.filter((inv) => {
      const matchesSearch =
        inv.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.invitedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.positionTitle && inv.positionTitle.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPosition =
        selectedPositionFilter === 'ALL' || inv.position === selectedPositionFilter;
      return matchesSearch && matchesPosition;
    });
  }, [pendingInvitations, searchQuery, selectedPositionFilter]);

  const totalCount = activeTab === 'official' ? filteredUsers.length : filteredInvitations.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const paginatedInvitations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvitations.slice(start, start + itemsPerPage);
  }, [filteredInvitations, currentPage]);

  const handleTabChange = (tab: 'official' | 'pending') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setActiveMenuId(null);
  };

  // ---------------------------------------------------------------------------
  // INVITATION MODAL HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenInviteModal = () => {
    setInviteEmails([]);
    setCurrentEmailInput('');
    setInvitePosition('Monitoring');
    setInvitePositionTitle('Monitoring Officer');
    setInviteShift(shiftScheduleOptions[0]?.value || 'Day Shift (Alpha)');
    setIsInviteModalOpen(true);
    setActiveMenuId(null);
  };

  const handleAddEmail = (rawText?: string) => {
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
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setInviteEmails((prev) => prev.filter((e) => e !== emailToRemove));
  };

  // Dispatch Invitation via Supabase Database Insert & Nodemailer SMTP
  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalEmails = [...inviteEmails];
    if (currentEmailInput.trim()) {
      const extra = currentEmailInput
        .split(/[\s,;\n]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes('@'));
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

      const normalizedRole = (['admin', 'monitoring', 'staff'].includes(invitePosition.toLowerCase())
        ? invitePosition.toLowerCase()
        : 'monitoring') as 'admin' | 'monitoring' | 'staff';

      const positionTitle =
        invitePositionTitle || (invitePosition === 'Admin' ? 'Administrator' : invitePosition === 'Staff' ? 'Operational Staff' : 'Monitoring Officer');

      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      let wasSimulated = false;

      for (const email of finalEmails) {
        // Generate secure 64-character token
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const token = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const inviteUrl = `${origin}/register?token=${token}&email=${encodeURIComponent(email)}`;

        // 1. Delete any prior pending invitation for this email
        await supabase
          .from('invitations')
          .delete()
          .eq('email', email)
          .eq('status', 'pending');

        // 2. Insert into public.invitations
        const { error: insertError } = await supabase
          .from('invitations')
          .insert({
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

        // 3. Dispatch SMTP email via server API
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
      await fetchData(false);

      if (wasSimulated) {
        setToastNotification({
          type: 'info',
          message: `${finalEmails.length} ${finalEmails.length === 1 ? 'Invitation' : 'Invitations'} Saved to Database`,
          submessage: 'Note: SMTP credentials (SMTP_USER/SMTP_PASS) are not set in .env.local, so email delivery was simulated.',
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

  // Resend Invitation
  const handleResendInvitation = async (invitation: PendingInvitation) => {
    setActiveMenuId(null);
    try {
      const inviterName = currentAdminProfile?.full_name || 'Administrator';
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const newToken = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
      const inviteUrl = `${origin}/register?token=${newToken}&email=${encodeURIComponent(invitation.email)}`;

      // Update in public.invitations
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

      // Dispatch email
      const apiRes = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invitation.email,
          role: invitation.position.toLowerCase(),
          positionTitle: invitation.positionTitle || invitation.position,
          shift: invitation.shift || 'Day Shift (Alpha)',
          inviteUrl,
          token: newToken,
          invitedBy: inviterName,
        }),
      });

      const apiData = await apiRes.json();
      await fetchData(false);

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
  };

  // Revoke Invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    setActiveMenuId(null);
    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw new Error(error.message);

      await fetchData(false);

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
  };

  // Copy Real Invitation Link
  const handleCopyInviteLink = (invitation: PendingInvitation) => {
    setActiveMenuId(null);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mls.pdrrmo.gov.ph';
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
  };

  // ---------------------------------------------------------------------------
  // USER EDIT / STATUS / DELETE HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenEditUser = (user: UserAccount) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPosition(user.position);
    setEditShift(user.shift || shiftScheduleOptions[0]?.value || 'Day Shift (Alpha)');
    setEditStatus(user.status);
    setIsEditModalOpen(true);
    setActiveMenuId(null);
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingEdit(true);

    const targetId = editingUser.id;
    const targetName = editName.trim();
    const normalizedRole = (
      ['admin', 'monitoring', 'staff'].includes(editPosition.toLowerCase())
        ? editPosition.toLowerCase()
        : 'monitoring'
    ) as 'admin' | 'monitoring' | 'staff';
    const positionTitle =
      editPosition === 'Admin'
        ? 'System Administrator'
        : editPosition === 'Staff'
        ? 'Operational Staff'
        : 'Monitoring Officer';

    const updatedUser: UserAccount = {
      ...editingUser,
      name: targetName,
      position: editPosition,
      positionTitle: positionTitle,
      shift: editShift,
      status: editStatus,
      initials: getInitials(targetName || editingUser.email),
    };

    // 1. Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u.id === targetId ? updatedUser : u))
    );

    // 2. Persist in localStorage across reloads & sessions
    try {
      const currentEdited: Record<string, any> = JSON.parse(
        localStorage.getItem('pdrrmo_edited_users') || '{}'
      );
      currentEdited[targetId] = {
        name: targetName,
        role: normalizedRole,
        position: editPosition,
        positionTitle: positionTitle,
        shift: editShift,
        status: editStatus,
      };
      if (editingUser.email) {
        currentEdited[editingUser.email.toLowerCase()] = currentEdited[targetId];
      }
      localStorage.setItem('pdrrmo_edited_users', JSON.stringify(currentEdited));

      // Handle deactivation list sync if status was changed in Edit modal
      const currentDeact: string[] = JSON.parse(
        localStorage.getItem('pdrrmo_deactivated_users') || '[]'
      );
      let updatedDeact: string[];
      if (editStatus === 'Inactive') {
        updatedDeact = Array.from(new Set([...currentDeact, targetId, editingUser.email]));
      } else {
        updatedDeact = currentDeact.filter((id) => id !== targetId && id !== editingUser.email);
      }
      localStorage.setItem('pdrrmo_deactivated_users', JSON.stringify(updatedDeact));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // 3. Broadcast across tabs and windows
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('pdrrmo_auth_sync');
        bc.postMessage({
          type: 'USER_EDITED',
          userId: targetId,
          email: editingUser.email,
          user: updatedUser,
        });
        if (editStatus === 'Inactive') {
          bc.postMessage({
            type: 'USER_DEACTIVATED',
            userId: targetId,
            email: editingUser.email,
            name: targetName,
          });
        } else {
          bc.postMessage({
            type: 'USER_ACTIVATED',
            userId: targetId,
            email: editingUser.email,
            name: targetName,
          });
        }
        bc.close();
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    // 4. Send update to Server API & Supabase
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetId,
          full_name: targetName,
          role: normalizedRole,
          position_title: positionTitle,
          default_shift: editShift,
          is_active: editStatus === 'Active',
        }),
      });

      await supabase
        .from('profiles')
        .update({
          full_name: targetName,
          role: normalizedRole,
          position_title: positionTitle,
          default_shift: editShift,
          is_active: editStatus === 'Active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);

      setIsEditModalOpen(false);
      await fetchData(false);

      setToastNotification({
        type: 'success',
        message: 'User Profile Updated',
        submessage: `Changes saved for ${targetName} (${editPosition} · ${editShift}).`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error updating user profile.';
      console.error('Save user edit notice:', err);
      setIsEditModalOpen(false);
      await fetchData(false);
      setToastNotification({
        type: 'success',
        message: 'User Profile Updated',
        submessage: `Changes saved for ${targetName}.`,
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    setActiveMenuId(null);
    const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    const nextIsActive = nextStatus === 'Active';

    // 1. Optimistic React State update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
    );

    // 2. LocalStorage Persistence across reloads
    try {
      const currentDeact: string[] = JSON.parse(
        localStorage.getItem('pdrrmo_deactivated_users') || '[]'
      );
      let updatedDeact: string[];
      if (!nextIsActive) {
        updatedDeact = Array.from(new Set([...currentDeact, user.id, user.email]));
      } else {
        updatedDeact = currentDeact.filter((id) => id !== user.id && id !== user.email);
      }
      localStorage.setItem('pdrrmo_deactivated_users', JSON.stringify(updatedDeact));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // 3. Multi-Tab & Window Broadcast to trigger lock modal on user's screen
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

    // 4. API & Supabase Update
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

      await fetchData(false);

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
  };

  const handleOpenDeleteModal = (user: UserAccount) => {
    setDeletingUser(user);
    setIsDeleteModalOpen(true);
    setActiveMenuId(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    const target = deletingUser;

    // 1. Optimistic React State update
    setUsers((prev) => prev.filter((u) => u.id !== target.id));
    setIsDeleteModalOpen(false);

    // 2. LocalStorage Persistence across reloads
    try {
      const currentDel: string[] = JSON.parse(
        localStorage.getItem('pdrrmo_deleted_users') || '[]'
      );
      const updatedDel = Array.from(new Set([...currentDel, target.id, target.email]));
      localStorage.setItem('pdrrmo_deleted_users', JSON.stringify(updatedDel));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // 3. Multi-Tab & Window Broadcast to trigger revoked modal on user's screen
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

    // 4. API & Supabase Delete
    try {
      await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id }),
      });

      await supabase.from('profiles').delete().eq('id', target.id);

      await fetchData(false);

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

  // Helper Badge Colors for Position
  const getPositionBadge = (position: 'Admin' | 'Monitoring' | 'Staff') => {
    switch (position) {
      case 'Admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#004AC6] text-xs font-bold border border-blue-200/60 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#004AC6]" />
            Admin
          </span>
        );
      case 'Monitoring':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200/60 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
            Monitoring
          </span>
        );
      case 'Staff':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[#505F76] text-xs font-bold border border-slate-200 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Staff
          </span>
        );
    }
  };

  // Render HTML preview of email in iframe srcDoc
  const previewEmailHtml = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mls.pdrrmo.gov.ph';
    const sampleEmail = inviteEmails.length > 0 ? inviteEmails[0] : 'personnel.ops@pdrrmo.gov.ph';
    const inviter = currentAdminProfile?.full_name || 'PDRRMO Operations Administrator';

    return generateInvitationEmailHtml({
      email: sampleEmail,
      role: invitePosition.toLowerCase() as 'admin' | 'monitoring' | 'staff',
      positionTitle: invitePositionTitle || (invitePosition === 'Admin' ? 'Administrator' : 'Monitoring Officer'),
      shift: inviteShift,
      inviteUrl: `${origin}/register?token=sec-token-preview-8f92a1&email=${encodeURIComponent(sampleEmail)}`,
      invitedBy: inviter,
      expiresAt: 'Valid until registered',
      logoSrc: `${origin}/assets/logo.png`,
    });
  }, [inviteEmails, invitePosition, invitePositionTitle, inviteShift, currentAdminProfile]);

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

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoading}
              className="p-2.5 rounded-full border border-[#E2E8F0] bg-white text-[#505F76] hover:text-[#004AC6] hover:bg-slate-50 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Refresh database records"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#004AC6]' : ''}`} />
            </button>

            <SecondaryButton
              size="md"
              pill
              onClick={() => setIsEmailPreviewModalOpen(true)}
              leftIcon={<Eye className="w-4 h-4" />}
            >
              Email UI/UX Preview
            </SecondaryButton>

            {canModifyUsers && (
              <PrimaryButton
                size="md"
                pill
                onClick={handleOpenInviteModal}
                leftIcon={<UserPlus className="w-4 h-4" />}
                className="shadow-md hover:shadow-lg transition-all"
              >
                Invite User
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* View-Only Banner */}
        <ViewOnlyNotice
          screen="Users"
          message="Inviting new personnel and managing existing credentials are restricted under View-Only clearance."
        />

        {/* ========================================================================= */}
        {/* 2. BENTO SUMMARY METRIC CARDS */}
        {/* ========================================================================= */}
        {isLoading ? (
          <SummaryCardsSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1: Total Users */}
            <div className="relative bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs overflow-hidden group hover:border-[#CBD5E1] transition-all">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#004AC6]/5 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out pointer-events-none" />
              <div className="flex justify-between items-start mb-3 relative z-10">
                <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider">
                  Total Users
                </span>
                <div className="w-9 h-9 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-end gap-4 relative z-10">
                <span className="text-4xl sm:text-5xl font-extrabold text-[#1E293B] tracking-tight leading-none">
                  {users.length}
                </span>
                <div className="flex items-center gap-1 bg-[#004AC6]/10 text-[#004AC6] px-3 py-1 rounded-full text-xs font-bold mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Live Sync
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-[#757680] font-medium relative z-10">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {users.filter((u) => u.status === 'Active').length} Active
                </span>
                <span>·</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  {users.filter((u) => u.status === 'Inactive').length} Inactive
                </span>
              </div>
            </div>

            {/* Card 2: Pending Invitations */}
            <div className="relative bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs overflow-hidden group hover:border-[#CBD5E1] transition-all">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/5 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out pointer-events-none" />
              <div className="flex justify-between items-start mb-3 relative z-10">
                <span className="text-xs font-bold text-[#505F76] uppercase tracking-wider">
                  Pending Invitations (SMTP)
                </span>
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-end gap-4 relative z-10">
                <span className="text-4xl sm:text-5xl font-extrabold text-[#1E293B] tracking-tight leading-none">
                  {pendingInvitations.length}
                </span>
                <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/60 px-3 py-1 rounded-full text-xs font-bold mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Awaiting Onboarding
                </div>
              </div>
              <div className="mt-3 text-xs text-[#757680] font-medium relative z-10">
                Tokens remain active for 7 days until registered.
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. USER TABLE SECTION WITH TABS & FILTERS */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
          {/* Controls Bar */}
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

          {/* Table Container */}
          <div className="overflow-x-auto custom-scrollbar">
            {isLoading ? (
              <UsersTableSkeleton rows={5} />
            ) : activeTab === 'official' ? (
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider">
                    <th className="py-4 px-6">Full Name</th>
                    <th className="py-4 px-6">Position</th>
                    <th className="py-4 px-6">Email Address</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#757680]">
                        <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-sm">No official users found</p>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          {searchQuery || selectedPositionFilter !== 'ALL'
                            ? 'Try adjusting your search query or position filters.'
                            : 'Click "Invite User" to onboard team members.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-[#F8FAFC]/80 transition-colors group"
                      >
                        {/* Full Name & Avatar */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} size="md" showStatus />
                            <div className="flex flex-col">
                              <span className="font-semibold text-[#1E293B] group-hover:text-[#004AC6] transition-colors">
                                {user.name}
                              </span>
                              <span className="text-xs text-[#757680] font-mono">
                                {user.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Position Dropdown/Badge */}
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1 items-start">
                            {getPositionBadge(user.position)}
                            {user.shift && (
                              <span className="text-[11px] text-[#505F76] font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#94A3B8]" />
                                {user.shift}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-4 px-6 text-[#505F76] font-mono text-xs">
                          {user.email}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-6">
                          {user.status === 'Active' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[#505F76] text-xs font-semibold border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Action Menu */}
                        <td className="py-4 px-6 text-right relative">
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === user.id ? null : user.id);
                              }}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                              aria-label="User actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            <AnimatePresence>
                              {activeMenuId === user.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                  transition={{ duration: 0.12 }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 mt-2 w-48 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditUser(user)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-[#505F76]" />
                                    Edit Account
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(user)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                                  >
                                    {user.status === 'Active' ? (
                                      <>
                                        <UserX className="w-3.5 h-3.5 text-amber-600" />
                                        Deactivate User
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        Activate User
                                      </>
                                    )}
                                  </button>

                                  <div className="h-px bg-[#E2E8F0] my-1" />

                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeleteModal(user)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Remove User
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#505F76] uppercase tracking-wider">
                    <th className="py-4 px-6">Email Address</th>
                    <th className="py-4 px-6">Assigned Position</th>
                    <th className="py-4 px-6">Dispatched At</th>
                    <th className="py-4 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {paginatedInvitations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-[#757680]">
                        <Mail className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-sm">No pending invitations</p>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          Click &quot;Invite User&quot; above to dispatch new SMTP onboarding emails.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedInvitations.map((inv) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-[#F8FAFC]/80 transition-colors group"
                      >
                        {/* Email Address & Inviter */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15 flex items-center justify-center shrink-0">
                              <Mail className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-[#1E293B] group-hover:text-[#004AC6] transition-colors">
                                {inv.email}
                              </span>
                              <span className="text-[11px] text-[#757680]">
                                Invited by {inv.invitedBy}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Assigned Position */}
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1 items-start">
                            {getPositionBadge(inv.position)}
                            {inv.shift && (
                              <span className="text-[11px] text-[#505F76] font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#94A3B8]" />
                                {inv.shift}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Invited At */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1.5 text-xs text-[#505F76] font-medium">
                            <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                            <span>{inv.invitedAt}</span>
                          </div>
                        </td>

                        {/* Action Menu */}
                        <td className="py-4 px-6 text-right relative">
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === inv.id ? null : inv.id);
                              }}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                              aria-label="Invitation actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            <AnimatePresence>
                              {activeMenuId === inv.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                  transition={{ duration: 0.12 }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 mt-2 w-48 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleResendInvitation(inv)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                                  >
                                    <RotateCw className="w-3.5 h-3.5 text-[#505F76]" />
                                    Resend via SMTP
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCopyInviteLink(inv)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#004AC6] rounded-xl transition-colors text-left cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-[#505F76]" />
                                    Copy Invite Link
                                  </button>

                                  <div className="h-px bg-[#E2E8F0] my-1" />

                                  <button
                                    type="button"
                                    onClick={() => handleRevokeInvitation(inv.id)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Revoke Invitation
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="p-4 sm:p-5 border-t border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <span className="text-xs text-[#757680] font-medium">
              Showing {totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}{' '}
              {activeTab === 'official' ? 'users' : 'invitations'}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#505F76] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-bold text-[#1E293B] px-2">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
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
      {/* 4. INVITE USER MODAL (Multi-Email + SMTP Dispatch) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSendingInvitations && setIsInviteModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-visible z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center rounded-t-3xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#1E293B]">Invite Users via SMTP</h2>
                    <p className="text-xs text-[#757680]">
                      Dispatches official branded invitation emails with secure tokens
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSendingInvitations}
                  onClick={() => setIsInviteModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSendInvitation} className="p-6 space-y-4">
                {/* Email Address(es) - Multiple supported */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                      Recipient Email Address(es)
                    </label>
                    {inviteEmails.length > 0 && (
                      <span className="text-xs font-bold text-[#004AC6]">
                        {inviteEmails.length} {inviteEmails.length === 1 ? 'recipient' : 'recipients'}
                      </span>
                    )}
                  </div>

                  {/* Multi-Email Container with Chips */}
                  <div className="min-h-[96px] max-h-44 overflow-y-auto custom-scrollbar w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-2.5 focus-within:border-[#004AC6] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#004AC6]/15 transition-all flex flex-wrap gap-2 items-start content-start">
                    {inviteEmails.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E2E8F0] text-[#1E293B] rounded-full text-xs font-medium shadow-2xs group hover:border-slate-300 transition-colors"
                      >
                        <Mail className="w-3 h-3 text-[#004AC6]" />
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}

                    <input
                      type="text"
                      value={currentEmailInput}
                      onChange={(e) => setCurrentEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') {
                          e.preventDefault();
                          handleAddEmail();
                        } else if (e.key === 'Backspace' && !currentEmailInput && inviteEmails.length > 0) {
                          handleRemoveEmail(inviteEmails[inviteEmails.length - 1]);
                        }
                      }}
                      onBlur={() => handleAddEmail()}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pasteData = e.clipboardData.getData('text');
                        handleAddEmail(pasteData);
                      }}
                      placeholder={
                        inviteEmails.length === 0
                          ? 'Enter email address(es) (e.g. officer@pdrrmo.gov.ph)...'
                          : 'Add another email...'
                      }
                      className="flex-1 min-w-[200px] bg-transparent border-none py-1 px-1 text-xs sm:text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-[#757680]">
                    Separate multiple emails with commas, spaces, or press Enter.
                  </p>
                </div>

                {/* Position & Shift Schedule Dropdowns */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <CustomDropdown
                      label="Assigned Position / Access Level"
                      options={positionOptions}
                      value={invitePosition}
                      onChange={(val) => {
                        setInvitePosition(val as 'Admin' | 'Monitoring' | 'Staff');
                        setInvitePositionTitle(val === 'Admin' ? 'Administrator' : val === 'Staff' ? 'Operational Staff' : 'Monitoring Officer');
                      }}
                      size="md"
                      pill
                    />
                  </div>

                  <div className="space-y-1.5">
                    <CustomDropdown
                      label="Assigned Shift Schedule"
                      options={shiftScheduleOptions}
                      value={inviteShift}
                      onChange={(val) => setInviteShift(val)}
                      size="md"
                      pill
                    />
                  </div>
                </div>

                {/* Email Preview Snippet Card */}
                <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[#004AC6] font-medium">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>Branded HTML Email Template will be dispatched</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEmailPreviewModalOpen(true)}
                    className="font-bold text-[#004AC6] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Preview Email</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                  <SecondaryButton
                    type="button"
                    size="md"
                    pill
                    disabled={isSendingInvitations}
                    onClick={() => setIsInviteModalOpen(false)}
                  >
                    Cancel
                  </SecondaryButton>

                  <PrimaryButton
                    type="submit"
                    size="md"
                    pill
                    isLoading={isSendingInvitations}
                    leftIcon={<Send className="w-4 h-4" />}
                  >
                    Send Invitation
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. EMAIL UI/UX PREVIEW MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEmailPreviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEmailPreviewModalOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] flex flex-col overflow-hidden z-10"
            >
              {/* Modal Top Bar */}
              <div className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                      Invitation Email UI/UX Preview
                    </h2>
                    <p className="text-xs text-[#757680]">
                      Responsive HTML template delivered to invited personnel via SMTP
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {/* Viewport switcher */}
                  <div className="flex bg-[#E2E8F0]/70 p-1 rounded-full text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setEmailPreviewMode('desktop')}
                      className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                        emailPreviewMode === 'desktop'
                          ? 'bg-white text-[#004AC6] shadow-2xs font-bold'
                          : 'text-[#505F76] hover:text-[#1E293B]'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Desktop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailPreviewMode('mobile')}
                      className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                        emailPreviewMode === 'mobile'
                          ? 'bg-white text-[#004AC6] shadow-2xs font-bold'
                          : 'text-[#505F76] hover:text-[#1E293B]'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Mobile</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEmailPreviewModalOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* IFrame Preview Container */}
              <div className="flex-1 bg-[#EAEEF4] p-4 sm:p-8 overflow-y-auto custom-scrollbar flex items-start justify-center">
                <div
                  className={`bg-white shadow-xl transition-all duration-300 overflow-hidden ${
                    emailPreviewMode === 'mobile'
                      ? 'w-[390px] rounded-[32px] border-[6px] border-slate-800'
                      : 'w-full max-w-[640px] rounded-2xl border border-slate-300'
                  }`}
                >
                  <iframe
                    title="Email Template Live Preview"
                    srcDoc={previewEmailHtml}
                    className={`w-full border-none ${
                      emailPreviewMode === 'mobile' ? 'h-[620px]' : 'h-[680px]'
                    }`}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#E2E8F0] bg-white flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#505F76]">
                  <ShieldCheck className="w-4 h-4 text-[#004AC6]" />
                  <span>Cross-client compatible (Gmail, Apple Mail, Outlook, Android)</span>
                </div>

                <PrimaryButton
                  size="sm"
                  pill
                  onClick={() => {
                    setIsEmailPreviewModalOpen(false);
                    handleOpenInviteModal();
                  }}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                >
                  Use This Template
                </PrimaryButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6. EDIT USER MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEditModalOpen && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSavingEdit && setIsEditModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-visible z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center rounded-t-3xl">
                <div className="flex items-center gap-3.5">
                  <UserAvatar user={editingUser} size="lg" showStatus />
                  <div>
                    <h2 className="text-lg font-bold text-[#1E293B]">Edit User Account</h2>
                    <p className="text-xs text-[#757680] font-mono">{editingUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveUserEdit} className="p-6 space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 px-4 text-sm text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  />
                </div>

                {/* Email Address (Read-only) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                    Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={editEmail}
                    className="w-full bg-slate-100 border border-[#E2E8F0] rounded-full py-2.5 px-4 text-sm text-[#757680] cursor-not-allowed select-none"
                  />
                </div>

                {/* Position Dropdown */}
                <div className="space-y-1.5">
                  <CustomDropdown
                    label="Position / Role"
                    options={positionOptions}
                    value={editPosition}
                    onChange={(val) =>
                      setEditPosition(val as 'Admin' | 'Monitoring' | 'Staff')
                    }
                    size="md"
                    pill
                  />
                </div>

                {/* Shift Schedule Dropdown */}
                <div className="space-y-1.5">
                  <CustomDropdown
                    label="Shift Schedule"
                    options={shiftScheduleOptions}
                    value={editShift}
                    onChange={(val) => setEditShift(val)}
                    size="md"
                    pill
                  />
                </div>

                {/* Account Status Switch */}
                <div className="flex items-center justify-between p-3.5 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]">
                  <div>
                    <span className="text-xs font-bold text-[#1E293B]">Account Status</span>
                    <p className="text-[11px] text-[#757680]">
                      {editStatus === 'Active' ? 'User has active terminal access' : 'User access is suspended'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditStatus(editStatus === 'Active' ? 'Inactive' : 'Active')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      editStatus === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-200 text-[#505F76]'
                    }`}
                  >
                    {editStatus}
                  </button>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                  <SecondaryButton
                    type="button"
                    size="md"
                    pill
                    disabled={isSavingEdit}
                    onClick={() => setIsEditModalOpen(false)}
                  >
                    Cancel
                  </SecondaryButton>

                  <PrimaryButton
                    type="submit"
                    size="md"
                    pill
                    isLoading={isSavingEdit}
                    leftIcon={<Check className="w-4 h-4" />}
                  >
                    Save Changes
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isDeleteModalOpen && deletingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden z-10"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                  <AlertTriangle className="w-7 h-7" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-[#1E293B]">Remove User Account?</h3>
                  <p className="text-xs text-[#505F76] mt-1.5 leading-relaxed">
                    Are you sure you want to remove <strong className="text-[#1E293B] font-semibold">{deletingUser.name}</strong> ({deletingUser.email})? This will revoke terminal credentials immediately.
                  </p>
                </div>

                {/* User Summary Card in Delete Modal */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-left">
                  <UserAvatar user={deletingUser} size="md" showStatus />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1E293B] truncate">{deletingUser.name}</p>
                    <p className="text-[11px] text-[#757680] font-mono truncate">{deletingUser.email}</p>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-[#505F76]">
                    {deletingUser.position}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <SecondaryButton
                    size="md"
                    pill
                    onClick={() => setIsDeleteModalOpen(false)}
                  >
                    Cancel
                  </SecondaryButton>

                  <button
                    type="button"
                    onClick={handleConfirmDeleteUser}
                    className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Removal</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
