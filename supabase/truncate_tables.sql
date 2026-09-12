-- =============================================================================
-- TRUNCATE / RESET ALL APPLICATION TABLES & AUTH USERS
-- =============================================================================

-- 1. TRUNCATE ALL PUBLIC APPLICATION TABLES (WITH CASCADE)
TRUNCATE TABLE 
    public.announcements,
    public.audit_logs,
    public.archives,
    public.roll_call_entries,
    public.roll_call_sessions,
    public.shift_logs,
    public.shift_duty_personnel,
    public.shifts,
    public.areas,
    public.report_types,
    public.access_roles,
    public.shift_schedules,
    public.duty_roster_assignments,
    public.invitations,
    public.profiles
CASCADE;

-- 2. DELETE ALL AUTH USERS (Cascades to identities, sessions, tokens, MFA)
DELETE FROM auth.users;
