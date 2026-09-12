-- =============================================================================
-- TRUNCATE / RESET SHIFT SCHEDULES & DUTY ROSTER ASSIGNMENTS
-- =============================================================================
-- This script safely truncates only shift timetables and operational duty rosters
-- while keeping user profiles, access roles, operational logs, and audit trails intact.

TRUNCATE TABLE 
    public.duty_roster_assignments,
    public.shift_schedules
CASCADE;

-- Optional: Verify truncation status
SELECT count(*) AS remaining_shift_schedules FROM public.shift_schedules;
SELECT count(*) AS remaining_duty_roster_assignments FROM public.duty_roster_assignments;
