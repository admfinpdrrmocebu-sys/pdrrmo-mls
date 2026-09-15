'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import {
  RoleDefinition,
  RolePermission,
  ScreenName,
  PermissionLevel,
  defaultBuiltInRoles,
  matchUserRole,
  normalizeScreenName,
  getPermissionForScreen,
  canAccessScreen,
  canWriteScreen,
} from './rbac';
import { ShieldAlert, LogOut, Lock, UserX, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  position_title: string;
  role: 'admin' | 'monitoring' | 'staff' | string;
  division: string;
  avatar_url?: string | null;
  signature_url?: string | null;
  default_shift?: string | null;
  is_active: boolean;
  is_online?: boolean;
  last_active_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAccountDeactivated: boolean;
  isAccountRemoved: boolean;
  // RBAC Properties
  roles: RoleDefinition[];
  currentRole: RoleDefinition | null;
  permissions: RolePermission[];
  canAccess: (screenOrRoute: string) => boolean;
  canWrite: (screenOrRoute: string) => boolean;
  getPermissionLevel: (screenOrRoute: string) => PermissionLevel;
  isViewOnly: (screenOrRoute: string) => boolean;
  // Action Handlers
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<RoleDefinition[]>(defaultBuiltInRoles);
  const [isLoading, setIsLoading] = useState(true);

  // Lockout Modal States
  const [isAccountDeactivated, setIsAccountDeactivated] = useState(false);
  const [isAccountRemoved, setIsAccountRemoved] = useState(false);

  // 1. Fetch Dynamic Access Roles from Supabase
  const fetchRoles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('access_roles')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const mappedRoles: RoleDefinition[] = data.map((r: any) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          badge: r.badge || 'Operational',
          badgeType: (r.badge_type as any) || 'operational',
          description: r.description || '',
          permissions: Array.isArray(r.permissions) ? r.permissions : [],
          isSystem: r.is_system ?? false,
        }));
        setRoles(mappedRoles);
      } else {
        setRoles(defaultBuiltInRoles);
      }
    } catch (err) {
      console.warn('Could not load access_roles from Supabase, using defaults:', err);
      setRoles(defaultBuiltInRoles);
    }
  }, []);

  // 2. Fetch full user profile from public.profiles table
  const fetchProfile = useCallback(async (currentUser: User) => {
    try {
      // Check local deactivation / deletion storage
      let deactList: string[] = [];
      let delList: string[] = [];
      try {
        deactList = JSON.parse(localStorage.getItem('pdrrmo_deactivated_users') || '[]');
        delList = JSON.parse(localStorage.getItem('pdrrmo_deleted_users') || '[]');
      } catch (e) {}

      if (delList.includes(currentUser.id) || (currentUser.email && delList.includes(currentUser.email))) {
        setIsAccountRemoved(true);
      } else if (deactList.includes(currentUser.id) || (currentUser.email && deactList.includes(currentUser.email))) {
        setIsAccountDeactivated(true);
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch user profile from profiles table:', error.message);
      }

      if (data) {
        const fullProf: UserProfile = {
          ...data,
          full_name: data.full_name,
          position_title: data.position_title,
          role: data.role,
          default_shift: data.default_shift,
          is_active: data.is_active,
        };

        setProfile(fullProf);
        if (fullProf.is_active === false || deactList.includes(currentUser.id) || (currentUser.email && deactList.includes(currentUser.email))) {
          setIsAccountDeactivated(true);
        } else {
          setIsAccountDeactivated(false);
        }
      } else {
        // Fallback to metadata if profile row is pending creation
        const meta = currentUser.user_metadata || {};
        setProfile({
          id: currentUser.id,
          full_name: meta.full_name || currentUser.email?.split('@')[0] || 'Monitoring Officer',
          email: currentUser.email || '',
          position_title: meta.position || 'Monitoring Officer',
          role: meta.role || 'monitoring',
          division: meta.division || 'Provincial Disaster Risk Reduction Management Office',
          avatar_url: meta.avatar_url || null,
          signature_url: meta.signature_url || null,
          is_active: true,
          is_online: true,
        });
      }
    } catch (err) {
      console.error('Error during profile retrieval:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  const refreshRoles = useCallback(async () => {
    await fetchRoles();
  }, [fetchRoles]);

  // 3. Initial Setup & Real-time Subscriptions
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        await fetchRoles();

        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn('Error fetching Supabase session:', error.message);
        }

        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user) {
            await fetchProfile(initialSession.user);
          } else {
            setProfile(null);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    initializeAuth();

    // Subscribe to Auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    // Subscribe to real-time changes on access_roles so permission updates reflect instantly
    const rolesChannel = supabase
      .channel('rbac-access-roles-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'access_roles' },
        () => {
          fetchRoles();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      supabase.removeChannel(rolesChannel);
    };
  }, [fetchProfile, fetchRoles]);

  // 4. Real-time Multi-Tab Broadcast & Supabase Profile Realtime Listener
  useEffect(() => {
    let authChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      authChannel = new BroadcastChannel('pdrrmo_auth_sync');
      authChannel.onmessage = (event) => {
        const data = event.data;
        if (!data || !user) return;
        const isTargetUser =
          data.userId === user.id ||
          (user.email && data.email && data.email.toLowerCase() === user.email.toLowerCase());

        if (isTargetUser) {
          if (data.type === 'USER_DEACTIVATED') {
            setIsAccountDeactivated(true);
          } else if (data.type === 'USER_ACTIVATED') {
            setIsAccountDeactivated(false);
          } else if (data.type === 'USER_REMOVED') {
            setIsAccountRemoved(true);
          } else if (data.type === 'USER_EDITED' && data.user) {
            setProfile((prev) =>
              prev
                ? {
                    ...prev,
                    full_name: data.user.name || prev.full_name,
                    position_title: data.user.positionTitle || prev.position_title,
                    role: (data.user.position || prev.role).toLowerCase(),
                    default_shift: data.user.shift || prev.default_shift,
                    is_active: data.user.status === 'Active',
                  }
                : prev
            );
            if (data.user.status === 'Inactive') {
              setIsAccountDeactivated(true);
            } else if (data.user.status === 'Active') {
              setIsAccountDeactivated(false);
            }
          }
        }
      };
    }

    // Realtime Postgres changes on profiles for this specific user
    const profileStatusChannel = supabase
      .channel('auth-profile-status-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload: any) => {
          if (!user) return;
          if (payload.eventType === 'UPDATE' && payload.new && payload.new.id === user.id) {
            if (payload.new.is_active === false) {
              setIsAccountDeactivated(true);
            } else if (payload.new.is_active === true) {
              setIsAccountDeactivated(false);
            }
          } else if (payload.eventType === 'DELETE' && payload.old && payload.old.id === user.id) {
            setIsAccountRemoved(true);
          }
        }
      )
      .subscribe();

    // Check storage on focus & visibility
    const checkStorageStatus = () => {
      if (!user) return;
      try {
        const deactList = JSON.parse(localStorage.getItem('pdrrmo_deactivated_users') || '[]');
        const delList = JSON.parse(localStorage.getItem('pdrrmo_deleted_users') || '[]');
        if (delList.includes(user.id) || (user.email && delList.includes(user.email))) {
          setIsAccountRemoved(true);
        } else if (deactList.includes(user.id) || (user.email && deactList.includes(user.email))) {
          setIsAccountDeactivated(true);
        }
      } catch (e) {}
    };

    window.addEventListener('focus', checkStorageStatus);
    window.addEventListener('storage', checkStorageStatus);

    return () => {
      authChannel?.close();
      supabase.removeChannel(profileStatusChannel);
      window.removeEventListener('focus', checkStorageStatus);
      window.removeEventListener('storage', checkStorageStatus);
    };
  }, [user]);

  const signOut = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsAccountDeactivated(false);
      setIsAccountRemoved(false);
      window.location.href = '/login';
    } catch (err) {
      console.error('Error signing out:', err);
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthenticated = !!user;

  // 5. Calculate Current Role & Permissions for Active Officer
  const currentRole = useMemo(() => {
    if (!profile && !user) return null;
    return matchUserRole(profile?.role, profile?.position_title, roles);
  }, [profile, user, roles]);

  const isAdmin = useMemo(() => {
    if (!currentRole) return false;
    return (
      profile?.role === 'admin' ||
      currentRole.code.toLowerCase() === 'admin' ||
      currentRole.name.toLowerCase() === 'admin'
    );
  }, [profile, currentRole]);

  const permissions = useMemo(() => {
    if (isAdmin) {
      return defaultBuiltInRoles[0].permissions;
    }
    return currentRole?.permissions || [];
  }, [isAdmin, currentRole]);

  // 6. RBAC Helper Functions
  const getPermissionLevel = useCallback(
    (screenOrRoute: string): PermissionLevel => {
      if (isAdmin) return 'Full Access';
      const screenName = normalizeScreenName(screenOrRoute);
      if (!screenName) return 'None';
      return getPermissionForScreen(currentRole, screenName);
    },
    [isAdmin, currentRole]
  );

  const canAccess = useCallback(
    (screenOrRoute: string): boolean => {
      if (isAdmin) return true;
      const screenName = normalizeScreenName(screenOrRoute);
      if (!screenName) return false;
      return canAccessScreen(currentRole, screenName);
    },
    [isAdmin, currentRole]
  );

  const canWrite = useCallback(
    (screenOrRoute: string): boolean => {
      if (isAdmin) return true;
      const screenName = normalizeScreenName(screenOrRoute);
      if (!screenName) return false;
      return canWriteScreen(currentRole, screenName);
    },
    [isAdmin, currentRole]
  );

  const isViewOnly = useCallback(
    (screenOrRoute: string): boolean => {
      if (isAdmin) return false;
      const level = getPermissionLevel(screenOrRoute);
      return level === 'View Only';
    },
    [isAdmin, getPermissionLevel]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        isAuthenticated,
        isAdmin,
        isAccountDeactivated,
        isAccountRemoved,
        roles,
        currentRole,
        permissions,
        canAccess,
        canWrite,
        getPermissionLevel,
        isViewOnly,
        signOut,
        refreshProfile,
        refreshRoles,
      }}
    >
      {children}

      {/* ===================================================================== */}
      {/* ACCOUNT DEACTIVATED / ACCESS REVOKED MODAL */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {(isAccountDeactivated || isAccountRemoved) && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/85 backdrop-blur-md select-none"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10"
            >
              {/* Top Accent Strip */}
              <div
                className={`h-2.5 w-full ${
                  isAccountRemoved
                    ? 'bg-gradient-to-r from-rose-600 via-red-500 to-rose-700'
                    : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600'
                }`}
              />

              <div className="p-7 text-center space-y-5">
                {/* Pulsing Icon */}
                <div className="relative mx-auto w-16 h-16">
                  <div
                    className={`absolute inset-0 rounded-full animate-ping opacity-25 ${
                      isAccountRemoved ? 'bg-rose-500' : 'bg-amber-500'
                    }`}
                  />
                  <div
                    className={`relative w-16 h-16 rounded-full flex items-center justify-center border-2 ${
                      isAccountRemoved
                        ? 'bg-rose-50 text-rose-600 border-rose-200'
                        : 'bg-amber-50 text-amber-600 border-amber-200'
                    }`}
                  >
                    {isAccountRemoved ? (
                      <UserX className="w-8 h-8" />
                    ) : (
                      <Lock className="w-8 h-8" />
                    )}
                  </div>
                </div>

                {/* Title & Subtitle */}
                <div>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 border ${
                      isAccountRemoved
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {isAccountRemoved ? 'Access Revoked' : 'Account Deactivated'}
                  </div>
                  <h2 className="text-xl font-extrabold text-[#1E293B]">
                    {isAccountRemoved ? 'System Clearance Revoked' : 'Terminal Access Suspended'}
                  </h2>
                  <p className="text-xs text-[#505F76] mt-2 leading-relaxed">
                    {isAccountRemoved
                      ? 'Your user profile has been removed from active system personnel. Real-time logging and operations access have been terminated.'
                      : 'Your officer account has been marked as inactive by the System Administrator. Terminal operations and sync telemetry are currently locked.'}
                  </p>
                </div>

                {/* Officer Summary Card */}
                {profile && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-full bg-[#004AC6] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {profile.full_name?.slice(0, 2).toUpperCase() || 'MO'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#1E293B] truncate">{profile.full_name}</p>
                      <p className="text-[11px] text-[#757680] font-mono truncate">{profile.email}</p>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-[#505F76]">
                      {profile.position_title || profile.role}
                    </span>
                  </div>
                )}

                {/* Footer Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await signOut();
                      } catch (e) {
                        window.location.href = '/login';
                      }
                    }}
                    className={`w-full py-3 px-5 rounded-full text-sm font-bold text-white shadow-lg transition-all cursor-pointer inline-flex items-center justify-center gap-2 ${
                      isAccountRemoved
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                        : 'bg-[#004AC6] hover:bg-[#003da6] shadow-blue-600/25'
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out & Return to Login</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRBAC() {
  const auth = useAuth();
  return {
    roles: auth.roles,
    currentRole: auth.currentRole,
    permissions: auth.permissions,
    canAccess: auth.canAccess,
    canWrite: auth.canWrite,
    getPermissionLevel: auth.getPermissionLevel,
    isViewOnly: auth.isViewOnly,
    isAdmin: auth.isAdmin,
    refreshRoles: auth.refreshRoles,
    isLoading: auth.isLoading,
  };
}
