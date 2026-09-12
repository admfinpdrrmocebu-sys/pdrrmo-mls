-- =============================================================================
-- ACCESS ROLES & SHIFT SCHEDULES TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table 1: ACCESS ROLES (Role-Based Access Control)
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
-- Table 2: SHIFT SCHEDULES (Operational Timetables)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    start_time TEXT NOT NULL DEFAULT '08:00',
    end_time TEXT NOT NULL DEFAULT '16:00',
    duration TEXT NOT NULL DEFAULT '8 Hours',
    description TEXT,
    color TEXT DEFAULT '#004AC6',
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_schedules_name ON public.shift_schedules(name);

-- -----------------------------------------------------------------------------
-- Triggers for Updated At
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_access_roles_updated_at ON public.access_roles;
CREATE TRIGGER trigger_access_roles_updated_at BEFORE UPDATE ON public.access_roles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_shift_schedules_updated_at ON public.shift_schedules;
CREATE TRIGGER trigger_shift_schedules_updated_at BEFORE UPDATE ON public.shift_schedules FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- Enable RLS & Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.access_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access_roles" ON public.access_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated manage access_roles" ON public.access_roles FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated read shift_schedules" ON public.shift_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated manage shift_schedules" ON public.shift_schedules FOR ALL TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- Realtime Broadcasting
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_schedules;

