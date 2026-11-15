'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import {
  RoleDefinition,
  RolePermission,
  PermissionLevel,
  defaultBuiltInRoles,
  matchUserRole,
  normalizeScreenName,
  getPermissionForScreen,
  canAccessScreen,
  canWriteScreen,
} from './rbac';
import { Lock, UserX, AlertTriangle, LogOut } from 'lucide-react';
import { clearOperationalScreensCache } from '@/lib/cache/screen-data-cache';

const DEVICE_SESSION_STORAGE_KEY = 'pdrrmo_device_session_v1';
const DEVICE_PROFILE_STORAGE_KEY = 'pdrrmo_device_profile_v1';
const REMEMBER_TERMINAL_STORAGE_KEY = 'pdrrmo_remember_terminal';
const CUSTOM_ROLES_STORAGE_KEY = 'pdrrmo_custom_roles';

interface StoredDeviceSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: User;
  saved_at: number;
}

interface AccessRoleDbRow {
  id: string;
  code: string;
  name: string;
  badge?: string | null;
  badge_type?: RoleDefinition['badgeType'] | null;
  description?: string | null;
  permissions?: RolePermission[] | null;
  is_system?: boolean | null;
}

interface ProfileRealtimePayload {
  eventType?: string;
  new?: { id?: string; is_active?: boolean };
  old?: { id?: string };
}

function readRememberTerminalPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(REMEMBER_TERMINAL_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

function writeRememberTerminalPreference(remember: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REMEMBER_TERMINAL_STORAGE_KEY, remember ? 'true' : 'false');
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

function readStoredDeviceSession(): StoredDeviceSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEVICE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDeviceSession;
    if (!parsed || !parsed.user || !parsed.user.id || !parsed.refresh_token) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredDeviceSession(session: Session): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredDeviceSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: session.user,
      saved_at: Date.now(),
    };
    localStorage.setItem(DEVICE_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

function readStoredDeviceProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEVICE_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredDeviceProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEVICE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

function clearStoredDeviceAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DEVICE_SESSION_STORAGE_KEY);
    localStorage.removeItem(DEVICE_PROFILE_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function readStoredRoles(): RoleDefinition[] {
  if (typeof window === 'undefined') return defaultBuiltInRoles;
  try {
    const local = localStorage.getItem(CUSTOM_ROLES_STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local) as RoleDefinition[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return defaultBuiltInRoles;
}

function buildFallbackProfile(currentUser: User): UserProfile {
  const meta = currentUser.user_metadata || {};
  return {
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
  };
}

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
  rememberTerminal: boolean;
  setRememberTerminal: (remember: boolean) => void;
  // RBAC Properties
  roles: RoleDefinition[];
  currentRole: RoleDefinition | null;
  permissions: RolePermission[];
  canAccess: (screenOrRoute: string) => boolean;
  canWrite: (screenOrRoute: string) => boolean;
  getPermissionLevel: (screenOrRoute: string) => PermissionLevel;
  isViewOnly: (screenOrRoute: string) => boolean;
  // Action Handlers
  signInWithPassword: (
    email: string,
    password: string,
    remember?: boolean
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Keep initial SSR & first client hydration pass identical (`isLoading: true`, `user: null`)
  // so Next.js SSR HTML never mismatches client localStorage; device session hydrates right
  // after mount inside `initializeAuth()`.
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<RoleDefinition[]>(defaultBuiltInRoles);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [rememberTerminal, setRememberTerminalState] = useState<boolean>(true);

  // Lockout Modal States
  const [isAccountDeactivated, setIsAccountDeactivated] = useState(false);
  const [isAccountRemoved, setIsAccountRemoved] = useState(false);

  // Explicit Sign-Out Guard: ONLY set to true when signOut() is invoked
  const isExplicitSignOutRef = useRef(false);
  const isRecoveringSessionRef = useRef(false);

  const setRememberTerminal = useCallback((remember: boolean) => {
    setRememberTerminalState(remember);
    writeRememberTerminalPreference(remember);
  }, []);

  // 1. Fetch Dynamic Access Roles from Supabase & LocalStorage cache
  const fetchRoles = useCallback(async () => {
    try {
      const cachedRoles = readStoredRoles();

      const { data, error } = await supabase
        .from('access_roles')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const mappedRoles: RoleDefinition[] = (data as AccessRoleDbRow[]).map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          badge: r.badge || 'Operational',
          badgeType: r.badge_type || 'operational',
          description: r.description || '',
          permissions: Array.isArray(r.permissions) ? r.permissions : [],
          isSystem: r.is_system ?? false,
        }));
        setRoles(mappedRoles);
        try {
          localStorage.setItem(CUSTOM_ROLES_STORAGE_KEY, JSON.stringify(mappedRoles));
        } catch {
          // Ignore storage errors
        }
      } else if (cachedRoles.length > 0) {
        setRoles(cachedRoles);
      } else {
        setRoles(defaultBuiltInRoles);
      }
    } catch (err) {
      console.warn('Could not load access_roles from Supabase, checking local cache:', err);
      setRoles(readStoredRoles());
    }
  }, []);

  // 2. Fetch full user profile from public.profiles table
  const fetchProfile = useCallback(async (currentUser: User) => {
    try {
      let deactList: string[] = [];
      let delList: string[] = [];
      try {
        deactList = JSON.parse(localStorage.getItem('pdrrmo_deactivated_users') || '[]');
        delList = JSON.parse(localStorage.getItem('pdrrmo_deleted_users') || '[]');
      } catch {
        // Ignore parse errors
      }

      if (
        delList.includes(currentUser.id) ||
        (currentUser.email && delList.includes(currentUser.email))
      ) {
        setIsAccountRemoved(true);
      } else if (
        deactList.includes(currentUser.id) ||
        (currentUser.email && deactList.includes(currentUser.email))
      ) {
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
        writeStoredDeviceProfile(fullProf);

        if (
          fullProf.is_active === false ||
          deactList.includes(currentUser.id) ||
          (currentUser.email && deactList.includes(currentUser.email))
        ) {
          setIsAccountDeactivated(true);
        } else {
          setIsAccountDeactivated(false);
        }
      } else {
        const cachedProf = readStoredDeviceProfile();
        if (cachedProf && cachedProf.id === currentUser.id) {
          setProfile(cachedProf);
        } else {
          const fallbackProf = buildFallbackProfile(currentUser);
          setProfile(fallbackProf);
          writeStoredDeviceProfile(fallbackProf);
        }
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

  // Helper to recover Supabase session from remembered device storage without signing out
  const attemptDeviceSessionRecovery = useCallback(async (): Promise<Session | null> => {
    if (isExplicitSignOutRef.current || isRecoveringSessionRef.current) {
      return null;
    }

    const stored = readStoredDeviceSession();
    if (!stored?.refresh_token || !stored?.user) {
      return null;
    }

    isRecoveringSessionRef.current = true;
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      });

      if (!error && data?.session) {
        writeStoredDeviceSession(data.session);
        return data.session;
      }
      return null;
    } catch {
      return null;
    } finally {
      isRecoveringSessionRef.current = false;
    }
  }, []);

  // 3. Initial Setup, Auth Session Listener & Wake/Online Recovery
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        // Yield one microtask so the first client render matches SSR HTML cleanly,
        // then immediately restore remembered device auth without waiting for network.
        await Promise.resolve();
        if (!isMounted) return;

        setRememberTerminalState(readRememberTerminalPreference());
        const cachedRoles = readStoredRoles();
        if (cachedRoles.length > 0) {
          setRoles(cachedRoles);
        }

        const storedAtMount = !isExplicitSignOutRef.current ? readStoredDeviceSession() : null;
        if (storedAtMount?.user) {
          setUser(storedAtMount.user);
          const storedProf = readStoredDeviceProfile();
          setProfile(
            storedProf && storedProf.id === storedAtMount.user.id
              ? storedProf
              : buildFallbackProfile(storedAtMount.user)
          );
          setIsLoading(false);
        }

        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn('Error fetching Supabase session:', error.message);
        }

        if (!isMounted) return;

        if (initialSession?.user) {
          writeStoredDeviceSession(initialSession);
          setSession(initialSession);
          setUser(initialSession.user);
          await Promise.all([fetchRoles(), fetchProfile(initialSession.user)]);
          if (isMounted) setIsLoading(false);
          return;
        }

        // If getSession() returned null but the user never explicitly signed out,
        // restore from remembered device session so the terminal does not auto-signout.
        if (!isExplicitSignOutRef.current) {
          const stored = readStoredDeviceSession();
          if (stored?.user) {
            setUser(stored.user);
            const storedProf = readStoredDeviceProfile();
            if (storedProf && storedProf.id === stored.user.id) {
              setProfile(storedProf);
            } else {
              setProfile((prev) => prev ?? buildFallbackProfile(stored.user));
            }
            setIsLoading(false);

            const recovered = await attemptDeviceSessionRecovery();
            if (!isMounted) return;
            if (recovered?.user) {
              setSession(recovered);
              setUser(recovered.user);
              await Promise.all([fetchRoles(), fetchProfile(recovered.user)]);
            } else {
              await Promise.all([fetchRoles(), fetchProfile(stored.user)]);
            }
            return;
          }
        }

        setSession(null);
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      } catch (err) {
        console.error('Auth initialization failed:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    void initializeAuth();

    // Subscribe to Auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (newSession?.user) {
        isExplicitSignOutRef.current = false;
        writeStoredDeviceSession(newSession);
        setSession(newSession);
        setUser(newSession.user);
        setIsLoading(false);
        await Promise.all([fetchRoles(), fetchProfile(newSession.user)]);
        return;
      }

      // Only clear auth state if the officer explicitly pressed Sign Out
      if (isExplicitSignOutRef.current) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      // Otherwise, a token refresh or background check returned null without explicit sign-out.
      // Keep the remembered device user active and attempt silent recovery.
      const stored = readStoredDeviceSession();
      if (stored?.user) {
        setUser((prev) => prev ?? stored.user);
        setProfile((prev) => {
          if (prev) return prev;
          const cachedProf = readStoredDeviceProfile();
          return cachedProf && cachedProf.id === stored.user.id
            ? cachedProf
            : buildFallbackProfile(stored.user);
        });
        setIsLoading(false);

        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          const recovered = await attemptDeviceSessionRecovery();
          if (isMounted && recovered?.user) {
            setSession(recovered);
            setUser(recovered.user);
          }
        }
        return;
      }

      setSession(null);
      setUser(null);
      setProfile(null);
      setIsLoading(false);
    });

    // When the device wakes from sleep or reconnects to the internet, silently sync session tokens
    const handleWakeOrOnline = async () => {
      if (!isMounted || isExplicitSignOutRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      const stored = readStoredDeviceSession();
      if (!stored?.user) return;

      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      if (activeSession?.user) {
        writeStoredDeviceSession(activeSession);
        if (isMounted) {
          setSession(activeSession);
          setUser(activeSession.user);
        }
      } else {
        const recovered = await attemptDeviceSessionRecovery();
        if (isMounted && recovered?.user) {
          setSession(recovered);
          setUser(recovered.user);
        }
      }
    };

    window.addEventListener('online', handleWakeOrOnline);
    document.addEventListener('visibilitychange', handleWakeOrOnline);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('online', handleWakeOrOnline);
      document.removeEventListener('visibilitychange', handleWakeOrOnline);
    };
  }, [attemptDeviceSessionRecovery, fetchProfile, fetchRoles]);

  // 4. Real-time Multi-Tab Broadcast & Supabase Profile/Roles Realtime Listeners (Authenticated Only)
  useEffect(() => {
    if (!user) return;

    const rolesChannel = supabase
      .channel('rbac-access-roles-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'access_roles' },
        () => {
          void fetchRoles();
        }
      )
      .subscribe();

    let rolesBroadcast: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        rolesBroadcast = new BroadcastChannel('pdrrmo_roles_sync');
        rolesBroadcast.onmessage = (event) => {
          if (event.data?.type === 'ROLES_UPDATED') {
            void fetchRoles();
          }
        };
      } catch {
        // Ignore BroadcastChannel errors
      }
    }

    const handleRoleStorageChange = (e: StorageEvent) => {
      if (e.key === CUSTOM_ROLES_STORAGE_KEY || e.key === 'pdrrmo_roles_sync') {
        void fetchRoles();
      }
      // If another tab explicitly signed out and cleared the device session key
      if (e.key === DEVICE_SESSION_STORAGE_KEY && e.newValue === null) {
        isExplicitSignOutRef.current = true;
        clearOperationalScreensCache();
        setUser(null);
        setProfile(null);
        setSession(null);
        window.location.href = '/login';
      }
    };
    window.addEventListener('storage', handleRoleStorageChange);

    let authChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      authChannel = new BroadcastChannel('pdrrmo_auth_sync');
      authChannel.onmessage = (event) => {
        const data = event.data;
        if (!data || !user) return;

        if (data.type === 'USER_SIGNED_OUT') {
          isExplicitSignOutRef.current = true;
          clearStoredDeviceAuth();
          clearOperationalScreensCache();
          setUser(null);
          setProfile(null);
          setSession(null);
          window.location.href = '/login';
          return;
        }

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
            setProfile((prev) => {
              if (!prev) return prev;
              const updated: UserProfile = {
                ...prev,
                full_name: data.user.name || prev.full_name,
                position_title: data.user.positionTitle || prev.position_title,
                role: (data.user.position || prev.role).toLowerCase(),
                default_shift: data.user.shift || prev.default_shift,
                is_active: data.user.status === 'Active',
              };
              writeStoredDeviceProfile(updated);
              return updated;
            });
            if (data.user.status === 'Inactive') {
              setIsAccountDeactivated(true);
            } else if (data.user.status === 'Active') {
              setIsAccountDeactivated(false);
            }
          }
        }
      };
    }

    const profileStatusChannel = supabase
      .channel('auth-profile-status-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload: ProfileRealtimePayload) => {
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
      } catch {
        // Ignore parse errors
      }
    };

    window.addEventListener('focus', checkStorageStatus);
    window.addEventListener('storage', checkStorageStatus);

    return () => {
      supabase.removeChannel(rolesChannel);
      rolesBroadcast?.close();
      window.removeEventListener('storage', handleRoleStorageChange);
      authChannel?.close();
      supabase.removeChannel(profileStatusChannel);
      window.removeEventListener('focus', checkStorageStatus);
      window.removeEventListener('storage', checkStorageStatus);
    };
  }, [user, fetchRoles]);

  // 5. Sign In Handler (used by LoginForm via AuthContext)
  const signInWithPassword = useCallback(
    async (
      email: string,
      password: string,
      remember = true
    ): Promise<{ error: string | null }> => {
      isExplicitSignOutRef.current = false;
      setRememberTerminal(remember);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          return {
            error: error.message || 'Invalid login credentials. Please try again.',
          };
        }

        if (!data?.session || !data?.user) {
          return {
            error: 'Authentication succeeded but no session was returned.',
          };
        }

        // Persist device session immediately so the terminal remembers this login
        writeStoredDeviceSession(data.session);
        setSession(data.session);
        setUser(data.user);

        await Promise.all([fetchRoles(), fetchProfile(data.user)]);
        setIsLoading(false);
        return { error: null };
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred during sign in.';
        return { error: message };
      }
    },
    [fetchProfile, fetchRoles, setRememberTerminal]
  );

  // 6. Explicit Sign Out Handler (ONLY triggered when Sign Out button is pressed)
  const signOut = useCallback(async () => {
    try {
      isExplicitSignOutRef.current = true;
      setIsLoading(true);
      clearStoredDeviceAuth();
      clearOperationalScreensCache();

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const ch = new BroadcastChannel('pdrrmo_auth_sync');
          ch.postMessage({ type: 'USER_SIGNED_OUT' });
          ch.close();
        } catch {
          // Ignore broadcast errors
        }
      }

      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsAccountDeactivated(false);
      setIsAccountRemoved(false);
      window.location.href = '/login';
    } catch (err) {
      console.error('Error signing out:', err);
      clearStoredDeviceAuth();
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isAuthenticated = !!user;

  // 7. Calculate Current Role & Permissions for Active Officer
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
    return currentRole?.permissions || [];
  }, [currentRole]);

  // 8. RBAC Helper Functions
  const getPermissionLevel = useCallback(
    (screenOrRoute: string): PermissionLevel => {
      const screenName = normalizeScreenName(screenOrRoute);
      if (!screenName) return 'None';
      return getPermissionForScreen(currentRole, screenName);
    },
    [currentRole]
  );

  const canAccess = useCallback(
    (screenOrRoute: string): boolean => {
      const screenName = normalizeScreenName(screenOrRoute);
      if (!screenName) return false;
      return canAccessScreen(currentRole, screenName);
    },
    [currentRole]
  );

  const canWrite = useCallback(
    (screenOrRoute: string): boolean => {
      const screenName = normalizeScreenName(screenOrRoute);
      if (!screenName) return false;
      return canWriteScreen(currentRole, screenName);
    },
    [currentRole]
  );

  const isViewOnly = useCallback(
    (screenOrRoute: string): boolean => {
      const level = getPermissionLevel(screenOrRoute);
      return level === 'View Only';
    },
    [getPermissionLevel]
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
        rememberTerminal,
        setRememberTerminal,
        roles,
        currentRole,
        permissions,
        canAccess,
        canWrite,
        getPermissionLevel,
        isViewOnly,
        signInWithPassword,
        signOut,
        refreshProfile,
        refreshRoles,
      }}
    >
      {children}

      {/* ===================================================================== */}
      {/* ACCOUNT DEACTIVATED / ACCESS REVOKED MODAL */}
      {/* ===================================================================== */}
      {(isAccountDeactivated || isAccountRemoved) && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md select-none transition-opacity duration-200" />

          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 transition-all duration-200">
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
                    } catch {
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
                  <span>Sign Out &amp; Return to Login</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
