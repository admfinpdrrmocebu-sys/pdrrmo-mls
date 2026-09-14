-- =============================================================================
-- SCRIPT: RESET / RECREATE ADMIN USER (admin@pdrrmo.gov.ph)
-- =============================================================================
-- Email:    admin@pdrrmo.gov.ph
-- Password: admin143
-- Role:     admin
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    user_email TEXT := 'admin@pdrrmo.gov.ph';
    user_password TEXT := 'admin143';
    encrypted_pw TEXT := crypt(user_password, gen_salt('bf'));
BEGIN
    -- 1. CLEANUP / DELETE PREVIOUS RECORDS FOR THIS EMAIL
    DELETE FROM auth.identities 
    WHERE user_id IN (SELECT id FROM auth.users WHERE LOWER(email) = LOWER(user_email));

    DELETE FROM public.profiles WHERE LOWER(email) = LOWER(user_email);

    DELETE FROM auth.users WHERE LOWER(email) = LOWER(user_email);

    -- 2. INSERT FRESH AUTH.USERS RECORD
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
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        user_email,
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

    -- 3. INSERT FRESH AUTH.IDENTITIES RECORD
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
        new_user_id,
        new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', user_email),
        'email',
        new_user_id::text,
        now(),
        now(),
        now()
    );

    -- 4. INSERT/UPDATE PUBLIC.PROFILES RECORD
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
        new_user_id,
        'System Administrator',
        user_email,
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

    RAISE NOTICE 'Admin user % successfully created with ID % and password %', user_email, new_user_id, user_password;
END $$;

-- 5. VERIFY ADMIN USER
SELECT 
    u.id, 
    u.email, 
    u.role AS auth_role, 
    u.email_confirmed_at, 
    p.full_name, 
    p.role AS profile_role, 
    p.position_title
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE LOWER(u.email) = 'admin@pdrrmo.gov.ph';
