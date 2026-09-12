-- =============================================================================
-- SCRIPT: CLEAN RESET & CREATE ADMIN USER
-- =============================================================================
-- Email:    clarion.ivan.dale@gmail.com
-- Role:     admin
-- Password: admin143
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    user_email TEXT := 'clarion.ivan.dale@gmail.com';
    user_password TEXT := 'admin143';
    encrypted_pw TEXT := crypt(user_password, gen_salt('bf'));
BEGIN
    -- 1. CLEANUP / DELETE PREVIOUS RECORDS
    DELETE FROM auth.identities 
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = user_email);

    DELETE FROM public.profiles WHERE email = user_email;

    DELETE FROM auth.users WHERE email = user_email;

    -- 2. INSERT FRESH AUTH.USERS RECORD
    -- (This triggers public.handle_new_user automatically)
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
        '{"full_name":"Ivan Dale Clarion","role":"admin","position":"System Administrator"}'::jsonb,
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

    -- 4. UPSERT PUBLIC.PROFILES (Handles trigger insertion conflict cleanly)
    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        position_title,
        role,
        division,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        'Ivan Dale Clarion',
        user_email,
        'System Administrator',
        'admin',
        'Provincial Disaster Risk Reduction Management Office',
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = 'Ivan Dale Clarion',
        position_title = 'System Administrator',
        role = 'admin',
        division = 'Provincial Disaster Risk Reduction Management Office',
        is_active = true,
        updated_at = now();

    RAISE NOTICE 'Admin user % created cleanly with ID %', user_email, new_user_id;
END $$;
