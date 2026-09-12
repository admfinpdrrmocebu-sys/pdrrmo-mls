-- =============================================================================
-- Migration: Drop 'remarks' and 'signal_strength' from public.roll_call_entries
-- =============================================================================

ALTER TABLE IF EXISTS public.roll_call_entries
    DROP COLUMN IF EXISTS signal_strength,
    DROP COLUMN IF EXISTS remarks;
