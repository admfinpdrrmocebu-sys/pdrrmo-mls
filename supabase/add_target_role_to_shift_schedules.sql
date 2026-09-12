-- =============================================================================
-- MIGRATION: ADD target_role TO shift_schedules & PER-ROLE SORT INDEX
-- =============================================================================

ALTER TABLE public.shift_schedules 
ADD COLUMN IF NOT EXISTS target_role TEXT NOT NULL DEFAULT 'monitoring';

CREATE INDEX IF NOT EXISTS idx_shift_schedules_target_role 
ON public.shift_schedules(target_role);

CREATE INDEX IF NOT EXISTS idx_shift_schedules_role_sort 
ON public.shift_schedules(target_role, sort_order);
