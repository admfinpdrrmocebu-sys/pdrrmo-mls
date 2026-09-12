-- =============================================================================
-- Table: DUTY ROSTER ASSIGNMENTS (Shift Schedule Calendar Roster)
-- =============================================================================

-- 1. Create Table
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

-- 2. Indexes for High-Speed Calendar Interval Queries & Filter Lookups
CREATE INDEX IF NOT EXISTS idx_duty_roster_date ON public.duty_roster_assignments(duty_date);
CREATE INDEX IF NOT EXISTS idx_duty_roster_profile ON public.duty_roster_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_duty_roster_shift ON public.duty_roster_assignments(shift_schedule_id);
CREATE INDEX IF NOT EXISTS idx_duty_roster_type ON public.duty_roster_assignments(assignment_type);

-- 3. Automatic Updated-At Trigger
DROP TRIGGER IF EXISTS trigger_duty_roster_assignments_updated_at ON public.duty_roster_assignments;
CREATE TRIGGER trigger_duty_roster_assignments_updated_at 
    BEFORE UPDATE ON public.duty_roster_assignments 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Row Level Security (RLS)
ALTER TABLE public.duty_roster_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read duty_roster_assignments" ON public.duty_roster_assignments;
CREATE POLICY "Allow authenticated read duty_roster_assignments" 
    ON public.duty_roster_assignments 
    FOR SELECT 
    TO authenticated 
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage duty_roster_assignments" ON public.duty_roster_assignments;
CREATE POLICY "Allow authenticated manage duty_roster_assignments" 
    ON public.duty_roster_assignments 
    FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- 5. Realtime Broadcasting
ALTER PUBLICATION supabase_realtime ADD TABLE public.duty_roster_assignments;
