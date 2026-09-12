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
        // Fallback to default built-in roles
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch user profile from profiles table:', error.message);
      }

      if (data) {
        setProfile(data as UserProfile);
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

  const signOut = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      window.location.href = '/login';
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthenticated = !!user;

  // 4. Calculate Current Role & Permissions for Active Officer
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

  // 5. RBAC Helper Functions
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
