-- =============================================================================
-- FIX SHIFT SCHEDULES: RLS POLICIES, TARGET ROLE & DUPLICATE PREVENTION
-- =============================================================================

-- 1. Ensure target_role column exists
ALTER TABLE public.shift_schedules 
ADD COLUMN IF NOT EXISTS target_role TEXT NOT NULL DEFAULT 'monitoring';

-- 2. Drop legacy global unique name constraint if exists (allow same shift name across different roles)
ALTER TABLE public.shift_schedules 
DROP CONSTRAINT IF EXISTS shift_schedules_name_key;

-- 3. Add composite unique constraint to prevent duplicate start/end times within the same role
ALTER TABLE public.shift_schedules 
DROP CONSTRAINT IF EXISTS shift_schedules_role_time_key;

ALTER TABLE public.shift_schedules 
ADD CONSTRAINT shift_schedules_role_time_key UNIQUE (target_role, start_time, end_time);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_shift_schedules_target_role ON public.shift_schedules(target_role);
CREATE INDEX IF NOT EXISTS idx_shift_schedules_role_sort ON public.shift_schedules(target_role, sort_order);

-- 5. Fix RLS Policies for shift_schedules (Allow authenticated + anon read & write with CHECK)
ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read shift_schedules" ON public.shift_schedules;
DROP POLICY IF EXISTS "Allow authenticated manage shift_schedules" ON public.shift_schedules;
DROP POLICY IF EXISTS "Allow anon read shift_schedules" ON public.shift_schedules;
DROP POLICY IF EXISTS "Allow anon manage shift_schedules" ON public.shift_schedules;
DROP POLICY IF EXISTS "Allow all manage shift_schedules" ON public.shift_schedules;

CREATE POLICY "Allow authenticated manage shift_schedules" 
ON public.shift_schedules 
FOR ALL TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow anon read shift_schedules" 
ON public.shift_schedules 
FOR SELECT TO anon 
USING (true);

CREATE POLICY "Allow anon manage shift_schedules" 
ON public.shift_schedules 
FOR ALL TO anon 
USING (true) 
WITH CHECK (true);

-- 6. Enable Realtime for shift_schedules
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_schedules;
