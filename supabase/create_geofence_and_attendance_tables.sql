-- =============================================================================
-- PDRRMO MLS — GEOFENCING CONFIGURATION TABLE MIGRATION
-- =============================================================================
-- Execute this script in the Supabase SQL Editor to create the table for
-- Station GeoFencing perimeter configuration.
--
-- NOTE: Duty check-in / check-out timestamps are currently visual only on the
-- Schedule Dashboard; no attendance timestamp data or records are inserted yet.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table 16: GEOFENCE SETTINGS (Operational Perimeter Configuration)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geofence_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'PDRRMO Command Center',
    description TEXT DEFAULT 'Primary operational headquarters geofence perimeter',
    latitude DOUBLE PRECISION NOT NULL DEFAULT 10.3157,
    longitude DOUBLE PRECISION NOT NULL DEFAULT 123.8854,
    radius_meters DOUBLE PRECISION NOT NULL DEFAULT 200,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofence_settings_active ON public.geofence_settings(is_active);

-- Attach Updated-At Trigger
DROP TRIGGER IF EXISTS trigger_geofence_settings_updated_at ON public.geofence_settings;
CREATE TRIGGER trigger_geofence_settings_updated_at
    BEFORE UPDATE ON public.geofence_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security (RLS)
ALTER TABLE public.geofence_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read geofence_settings" ON public.geofence_settings;
CREATE POLICY "Allow authenticated read geofence_settings"
    ON public.geofence_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon read geofence_settings" ON public.geofence_settings;
CREATE POLICY "Allow anon read geofence_settings"
    ON public.geofence_settings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage geofence_settings" ON public.geofence_settings;
CREATE POLICY "Allow authenticated manage geofence_settings"
    ON public.geofence_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed initial default geofence if none exists
INSERT INTO public.geofence_settings (name, description, latitude, longitude, radius_meters, is_active)
SELECT
    'PDRRMO Command Center',
    'Primary operational headquarters geofence perimeter',
    10.3157,
    123.8854,
    200,
    true
WHERE NOT EXISTS (SELECT 1 FROM public.geofence_settings);

-- -----------------------------------------------------------------------------
-- Table 17: DUTY ATTENDANCE RECORDS (Daily Officer Check-In & Check-Out)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duty_attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    duty_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift_schedule_id UUID REFERENCES public.shift_schedules(id) ON DELETE SET NULL,
    geofence_id UUID REFERENCES public.geofence_settings(id) ON DELETE SET NULL,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    check_out_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'checked_in', -- 'checked_in' | 'checked_out'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(profile_id, duty_date)
);

CREATE INDEX IF NOT EXISTS idx_duty_attendance_date ON public.duty_attendance_records(duty_date);
CREATE INDEX IF NOT EXISTS idx_duty_attendance_profile ON public.duty_attendance_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_duty_attendance_status ON public.duty_attendance_records(status);

-- Attach Updated-At Trigger
DROP TRIGGER IF EXISTS trigger_duty_attendance_updated_at ON public.duty_attendance_records;
CREATE TRIGGER trigger_duty_attendance_updated_at
    BEFORE UPDATE ON public.duty_attendance_records
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security (RLS)
ALTER TABLE public.duty_attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read duty_attendance_records" ON public.duty_attendance_records;
CREATE POLICY "Allow authenticated read duty_attendance_records"
    ON public.duty_attendance_records FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon read duty_attendance_records" ON public.duty_attendance_records;
CREATE POLICY "Allow anon read duty_attendance_records"
    ON public.duty_attendance_records FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage duty_attendance_records" ON public.duty_attendance_records;
CREATE POLICY "Allow authenticated manage duty_attendance_records"
    ON public.duty_attendance_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Enable Realtime Broadcasting
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.geofence_settings;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.duty_attendance_records;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
