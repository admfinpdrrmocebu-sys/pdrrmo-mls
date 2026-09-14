-- =============================================================================
-- ALPHA TESTING DATABASE RESET & ADMIN RE-CREATION SCRIPT
-- =============================================================================
-- Purpose:
-- 1. Truncate all operational / dynamic application data tables (CASCADE)
-- 2. Delete all existing auth users, identities, and profiles
-- 3. Create fresh admin user (admin@pdrrmo.gov.ph / admin143)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. TRUNCATE ALL OPERATIONAL TABLES (CASCADE)
-- -----------------------------------------------------------------------------
TRUNCATE TABLE 
    public.announcements,
    public.audit_logs,
    public.archives,
    public.roll_call_entries,
    public.roll_call_sessions,
    public.shift_logs,
    public.shift_duty_personnel,
    public.shifts,
    public.duty_roster_assignments,
    public.invitations
CASCADE;

-- -----------------------------------------------------------------------------
-- 2. PURGE ALL AUTH USERS, IDENTITIES & PROFILES
-- -----------------------------------------------------------------------------
DELETE FROM auth.identities;
DELETE FROM public.profiles;
DELETE FROM auth.users;

-- -----------------------------------------------------------------------------
-- 3. CREATE FRESH ADMIN ACCOUNT (admin@pdrrmo.gov.ph / admin143)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    admin_user_id UUID := gen_random_uuid();
    admin_email TEXT := 'admin@pdrrmo.gov.ph';
    admin_default_pw TEXT := 'admin143';
    encrypted_pw TEXT := crypt(admin_default_pw, gen_salt('bf'));
BEGIN
    -- Insert into auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        role,
        aud,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        is_super_admin
    ) VALUES (
        admin_user_id,
        '00000000-0000-0000-0000-000000000000',
        admin_email,
        encrypted_pw,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"System Administrator","role":"admin","position":"System Administrator"}'::jsonb,
        now(),
        now(),
        'authenticated',
        'authenticated',
        '',
        '',
        '',
        '',
        false
    );

    -- Insert into auth.identities
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        admin_user_id,
        admin_user_id,
        jsonb_build_object('sub', admin_user_id::text, 'email', admin_email),
        'email',
        admin_user_id::text,
        now(),
        now(),
        now()
    );

    -- Insert into public.profiles
    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        position_title,
        role,
        division,
        avatar_url,
        signature_url,
        default_shift,
        is_active,
        is_online,
        created_at,
        updated_at
    ) VALUES (
        admin_user_id,
        'System Administrator',
        admin_email,
        'System Administrator',
        'admin',
        'Provincial Disaster Risk Reduction Management Office',
        NULL,
        NULL,
        'Day Shift (Alpha)',
        true,
        false,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = 'System Administrator',
        position_title = 'System Administrator',
        role = 'admin',
        division = 'Provincial Disaster Risk Reduction Management Office',
        avatar_url = NULL,
        signature_url = NULL,
        is_active = true,
        is_online = false,
        updated_at = now();

    RAISE NOTICE 'Admin user % successfully created with ID % and password %', admin_email, admin_user_id, admin_default_pw;
END $$;

-- -----------------------------------------------------------------------------
-- 4. VERIFICATION COUNTS
-- -----------------------------------------------------------------------------
SELECT 'Auth Users Count:' AS label, count(*)::text AS value FROM auth.users
UNION ALL
SELECT 'Profiles Count:', count(*)::text FROM public.profiles
UNION ALL
SELECT 'Active Shifts Count:', count(*)::text FROM public.shifts
UNION ALL
SELECT 'Roll Call Sessions Count:', count(*)::text FROM public.roll_call_sessions
UNION ALL
SELECT 'Shift Logs Count:', count(*)::text FROM public.shift_logs;
