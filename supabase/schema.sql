-- =============================================================================
-- PDRRMO MLS (MONITORING & LOGGING SYSTEM) - DATABASE SCHEMA
-- =============================================================================
-- Purpose: Complete table creation, storage buckets, triggers, and simple RLS.
-- Notice: Schema creation only. No dummy/seed data inserted.
-- =============================================================================

-- Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ENUMS & TYPES
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM ('admin', 'monitoring', 'staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invitation_status_type AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE shift_status_type AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE log_severity_type AS ENUM ('Critical', 'Warning', 'Active', 'Info');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE roll_call_status_type AS ENUM ('in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status_type AS ENUM ('Present', 'Absent', 'Exempted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE archive_category_type AS ENUM ('log', 'roll-call');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE archive_status_type AS ENUM ('Verified', 'Archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 2. HELPER FUNCTIONS & TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. CORE TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table 1: PROFILES (Extends auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    position_title TEXT NOT NULL DEFAULT 'Monitoring Officer',
    role user_role_type NOT NULL DEFAULT 'monitoring',
    division TEXT NOT NULL DEFAULT 'Provincial Disaster Risk Reduction Management Office',
    avatar_url TEXT,
    signature_url TEXT,
    default_shift TEXT DEFAULT 'Day Shift (Alpha)',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_online BOOLEAN NOT NULL DEFAULT false,
    last_active_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- -----------------------------------------------------------------------------
-- Table 2: INVITATIONS (Admin invitations)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role user_role_type NOT NULL DEFAULT 'monitoring',
    position_title TEXT NOT NULL DEFAULT 'Monitoring Officer',
    default_shift TEXT DEFAULT 'Day Shift (Alpha)',
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    status invitation_status_type NOT NULL DEFAULT 'pending',
    invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);

-- -----------------------------------------------------------------------------
-- Table 3: REPORT TYPES (Incident categories)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#004AC6',
    version TEXT DEFAULT 'v1.0',
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_types_code ON public.report_types(code);

-- -----------------------------------------------------------------------------
-- Table 4: AREAS (Cebu Municipalities & Ports)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    weather_monitoring BOOLEAN NOT NULL DEFAULT true,
    has_port BOOLEAN NOT NULL DEFAULT false,
    port_name TEXT DEFAULT 'None',
    coordinates JSONB DEFAULT '{"lat": 10.3157, "lng": 123.8854}'::jsonb,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_areas_code ON public.areas(code);
CREATE INDEX IF NOT EXISTS idx_areas_sort_order ON public.areas(sort_order);

-- -----------------------------------------------------------------------------
-- Table 5: SHIFTS (Operational shifts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_label TEXT NOT NULL,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TEXT NOT NULL,
    end_time TEXT,
    status shift_status_type NOT NULL DEFAULT 'active',
    lead_officer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    start_monitoring_details TEXT,
    end_shift_handover_status TEXT DEFAULT 'Situation Remain Normal',
    incident_report_details TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON public.shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_lead_officer ON public.shifts(lead_officer_id);

-- -----------------------------------------------------------------------------
-- Table 6: SHIFT DUTY PERSONNEL (Junction Table)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_duty_personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    role_in_shift TEXT,
    is_lead BOOLEAN NOT NULL DEFAULT false,
    present_at_end BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(shift_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_duty_personnel_shift ON public.shift_duty_personnel(shift_id);

-- -----------------------------------------------------------------------------
-- Table 7: SHIFT LOGS (Operations / Incident entries)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    report_type_id UUID REFERENCES public.report_types(id) ON DELETE SET NULL,
    report_type_name TEXT NOT NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    log_time TEXT NOT NULL,
    status log_severity_type NOT NULL DEFAULT 'Active',
    description TEXT NOT NULL,
    operator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    operator_name TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_logs_shift ON public.shift_logs(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_logs_date ON public.shift_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_shift_logs_status ON public.shift_logs(status);
CREATE INDEX IF NOT EXISTS idx_shift_logs_report_type ON public.shift_logs(report_type_name);

-- -----------------------------------------------------------------------------
-- Table 8: ROLL CALL SESSIONS (Net radio roll calls)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roll_call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    session_time TEXT NOT NULL DEFAULT '1600H',
    frequency TEXT NOT NULL DEFAULT '142.500 MHz',
    radio_script TEXT NOT NULL,
    conducted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status roll_call_status_type NOT NULL DEFAULT 'in_progress',
    total_stations INTEGER NOT NULL DEFAULT 0,
    present_count INTEGER NOT NULL DEFAULT 0,
    absent_count INTEGER NOT NULL DEFAULT 0,
    exempted_count INTEGER NOT NULL DEFAULT 0,
    weather_summary TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roll_call_sessions_date ON public.roll_call_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_roll_call_sessions_status ON public.roll_call_sessions(status);

-- -----------------------------------------------------------------------------
-- Table 9: ROLL CALL ENTRIES (Station responses)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roll_call_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.roll_call_sessions(id) ON DELETE CASCADE,
    area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
    area_code TEXT NOT NULL,
    area_name TEXT NOT NULL,
    attendance attendance_status_type,
    weather_status TEXT,
    port_status TEXT,
    time_responded TEXT,
    duty_operator TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_roll_call_entries_session ON public.roll_call_entries(session_id);

-- -----------------------------------------------------------------------------
-- Table 10: ARCHIVES (Official DOCX/PDF Records)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    category archive_category_type NOT NULL,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    roll_call_session_id UUID REFERENCES public.roll_call_sessions(id) ON DELETE SET NULL,
    lead_officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    lead_officer_name TEXT NOT NULL,
    lead_officer_role TEXT NOT NULL,
    shift_label TEXT NOT NULL,
    shift_hours TEXT NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    file_size_bytes BIGINT DEFAULT 0,
    storage_path TEXT,
    file_url TEXT,
    file_hash TEXT NOT NULL,
    summary TEXT,
    status archive_status_type NOT NULL DEFAULT 'Archived',
    snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archives_category ON public.archives(category);
CREATE INDEX IF NOT EXISTS idx_archives_hash ON public.archives(file_hash);
CREATE INDEX IF NOT EXISTS idx_archives_generated_at ON public.archives(generated_at);

-- -----------------------------------------------------------------------------
-- Table 11: AUDIT LOGS (Compliance & Security Audit Trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- -----------------------------------------------------------------------------
-- Table 12: ANNOUNCEMENTS (Broadcasts & Operational Bulletins)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_by_name TEXT NOT NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);

-- -----------------------------------------------------------------------------
-- Table 13: ACCESS ROLES (Role-Based Access Control)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    badge TEXT NOT NULL DEFAULT 'Operational',
    badge_type TEXT NOT NULL DEFAULT 'operational', -- 'system' | 'operational' | 'standard'
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_roles_code ON public.access_roles(code);

-- -----------------------------------------------------------------------------
-- Table 14: SHIFT SCHEDULES (Operational Timetables)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    start_time TEXT NOT NULL DEFAULT '08:00',
    end_time TEXT NOT NULL DEFAULT '16:00',
    duration TEXT NOT NULL DEFAULT '8 Hours',
    description TEXT,
    target_role TEXT DEFAULT 'ALL',
    color TEXT DEFAULT '#004AC6',
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_schedules_target_role ON public.shift_schedules(target_role);

CREATE INDEX IF NOT EXISTS idx_shift_schedules_name ON public.shift_schedules(name);

-- -----------------------------------------------------------------------------
-- Table 15: DUTY ROSTER ASSIGNMENTS (Shift Schedule Calendar Roster)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duty_roster_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_schedule_id UUID REFERENCES public.shift_schedules(id) ON DELETE SET NULL,
    duty_date DATE NOT NULL,
    assignment_type TEXT NOT NULL DEFAULT 'duty', -- 'duty' | 'rest'
    is_lead BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(profile_id, duty_date)
);

CREATE INDEX IF NOT EXISTS idx_duty_roster_date ON public.duty_roster_assignments(duty_date);
CREATE INDEX IF NOT EXISTS idx_duty_roster_profile ON public.duty_roster_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_duty_roster_shift ON public.duty_roster_assignments(shift_schedule_id);
CREATE INDEX IF NOT EXISTS idx_duty_roster_type ON public.duty_roster_assignments(assignment_type);

-- =============================================================================
-- 4. ATTACH UPDATED_AT TRIGGERS
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_invitations_updated_at ON public.invitations;
CREATE TRIGGER trigger_invitations_updated_at BEFORE UPDATE ON public.invitations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_report_types_updated_at ON public.report_types;
CREATE TRIGGER trigger_report_types_updated_at BEFORE UPDATE ON public.report_types FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_areas_updated_at ON public.areas;
CREATE TRIGGER trigger_areas_updated_at BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_shifts_updated_at ON public.shifts;
CREATE TRIGGER trigger_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_shift_logs_updated_at ON public.shift_logs;
CREATE TRIGGER trigger_shift_logs_updated_at BEFORE UPDATE ON public.shift_logs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_roll_call_sessions_updated_at ON public.roll_call_sessions;
CREATE TRIGGER trigger_roll_call_sessions_updated_at BEFORE UPDATE ON public.roll_call_sessions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_roll_call_entries_updated_at ON public.roll_call_entries;
CREATE TRIGGER trigger_roll_call_entries_updated_at BEFORE UPDATE ON public.roll_call_entries FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_archives_updated_at ON public.archives;
CREATE TRIGGER trigger_archives_updated_at BEFORE UPDATE ON public.archives FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_announcements_updated_at ON public.announcements;
CREATE TRIGGER trigger_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_access_roles_updated_at ON public.access_roles;
CREATE TRIGGER trigger_access_roles_updated_at BEFORE UPDATE ON public.access_roles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_shift_schedules_updated_at ON public.shift_schedules;
CREATE TRIGGER trigger_shift_schedules_updated_at BEFORE UPDATE ON public.shift_schedules FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_duty_roster_assignments_updated_at ON public.duty_roster_assignments;
CREATE TRIGGER trigger_duty_roster_assignments_updated_at BEFORE UPDATE ON public.duty_roster_assignments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- 5. AUTH USER AUTO-CREATION TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    invitation_record RECORD;
BEGIN
    SELECT * INTO invitation_record 
    FROM public.invitations 
    WHERE email = NEW.email AND status = 'pending' 
    LIMIT 1;

    IF FOUND THEN
        INSERT INTO public.profiles (
            id,
            full_name,
            email,
            position_title,
            role,
            default_shift,
            is_active
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Monitoring Personnel'),
            NEW.email,
            invitation_record.position_title,
            invitation_record.role,
            invitation_record.default_shift,
            true
        );

        UPDATE public.invitations 
        SET status = 'accepted', accepted_at = now() 
        WHERE id = invitation_record.id;
    ELSE
        INSERT INTO public.profiles (
            id,
            full_name,
            email,
            position_title,
            role,
            is_active
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Monitoring Officer'),
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'position', 'Monitoring Officer'),
            'monitoring',
            true
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 6. STORAGE BUCKETS
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('avatars', 'avatars', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp']),
    ('signatures', 'signatures', true, 5242880, ARRAY['image/png', 'image/svg+xml']),
    ('archive-documents', 'archive-documents', false, 52428800, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    ('incident-attachments', 'incident-attachments', false, 20971520, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- 7. SIMPLE ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_duty_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roll_call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roll_call_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_roster_assignments ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can read/manage all, anon can read
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon read profiles" ON public.profiles;
CREATE POLICY "Allow authenticated manage profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read profiles" ON public.profiles FOR SELECT TO anon USING (true);

-- Invitations: Authenticated users can manage, anonymous can check pending by token
DROP POLICY IF EXISTS "Allow authenticated manage invitations" ON public.invitations;
DROP POLICY IF EXISTS "Allow anon read pending invitations" ON public.invitations;
CREATE POLICY "Allow authenticated manage invitations" ON public.invitations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read pending invitations" ON public.invitations FOR SELECT TO anon USING (status = 'pending');


-- Report Types: Authenticated users can read/write
CREATE POLICY "Allow authenticated manage report_types" ON public.report_types FOR ALL TO authenticated USING (true);

-- Areas: Authenticated users can read/write
CREATE POLICY "Allow authenticated manage areas" ON public.areas FOR ALL TO authenticated USING (true);

-- Shifts & Shift Duty Personnel: Authenticated users can read/write
CREATE POLICY "Allow authenticated manage shifts" ON public.shifts FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated manage shift_personnel" ON public.shift_duty_personnel FOR ALL TO authenticated USING (true);

-- Shift Logs: Authenticated users can read/write
CREATE POLICY "Allow authenticated manage shift_logs" ON public.shift_logs FOR ALL TO authenticated USING (true);

-- Roll Call Sessions & Entries: Authenticated users can read/write
CREATE POLICY "Allow authenticated manage roll_call_sessions" ON public.roll_call_sessions FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated manage roll_call_entries" ON public.roll_call_entries FOR ALL TO authenticated USING (true);

-- Archives: Authenticated users can read/write
CREATE POLICY "Allow authenticated manage archives" ON public.archives FOR ALL TO authenticated USING (true);

-- Audit Logs: Authenticated users can read/insert
CREATE POLICY "Allow authenticated insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated read audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);

-- Announcements: Accessible & visible to everyone authenticated; only creator can edit/delete
CREATE POLICY "Allow authenticated read announcements" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Allow creator update announcements" ON public.announcements FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Allow creator delete announcements" ON public.announcements FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Access Roles: Authenticated users can read/manage
CREATE POLICY "Allow authenticated read access_roles" ON public.access_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated manage access_roles" ON public.access_roles FOR ALL TO authenticated USING (true);

-- Shift Schedules: Authenticated users can read/manage
CREATE POLICY "Allow authenticated read shift_schedules" ON public.shift_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated manage shift_schedules" ON public.shift_schedules FOR ALL TO authenticated USING (true);

-- Duty Roster Assignments: Authenticated users can read/manage
CREATE POLICY "Allow authenticated read duty_roster_assignments" ON public.duty_roster_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated manage duty_roster_assignments" ON public.duty_roster_assignments FOR ALL TO authenticated USING (true);

-- =============================================================================
-- 8. STORAGE BUCKET SIMPLE RLS POLICIES
-- =============================================================================

-- Avatars: Public read, authenticated upload/update
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars authenticated write" ON storage.objects;
CREATE POLICY "Avatars authenticated write" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

-- Signatures: Public read, authenticated upload/update
DROP POLICY IF EXISTS "Signatures public read" ON storage.objects;
CREATE POLICY "Signatures public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'signatures');

DROP POLICY IF EXISTS "Signatures authenticated write" ON storage.objects;
CREATE POLICY "Signatures authenticated write" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'signatures') WITH CHECK (bucket_id = 'signatures');

-- Archive Documents: Authenticated read & write
DROP POLICY IF EXISTS "Archive documents authenticated access" ON storage.objects;
CREATE POLICY "Archive documents authenticated access" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'archive-documents') WITH CHECK (bucket_id = 'archive-documents');

-- Incident Attachments: Authenticated read & write
DROP POLICY IF EXISTS "Incident attachments authenticated access" ON storage.objects;
CREATE POLICY "Incident attachments authenticated access" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'incident-attachments') WITH CHECK (bucket_id = 'incident-attachments');

-- =============================================================================
-- 9. REALTIME BROADCASTING
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roll_call_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roll_call_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.archives;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.areas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_types;
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duty_roster_assignments;






