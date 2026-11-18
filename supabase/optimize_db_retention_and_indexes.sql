-- =============================================================================
-- PDRRMO MLS — SUPABASE FREE TIER DATABASE, EGRESS & RETENTION OPTIMIZATION
-- =============================================================================
-- Purpose:
--   1. Composite & partial indexes for high-frequency queries (/logs, /roll-call, /shifts, /archives)
--   2. Configurable per-module retention policy table (`public.app_retention_settings`)
--   3. Live 500 MB DB & 1 GB Storage telemetry RPC (`public.get_database_storage_telemetry`)
--   4. Safe dry-run & execution cleanup RPC (`public.run_data_retention_cleanup`)
--   5. Automated nightly `pg_cron` job (3:00 AM PHT / 19:00 UTC)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TARGETED COMPOSITE & PARTIAL INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_shift_logs_log_date_created_at
    ON public.shift_logs (log_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shifts_status_started_at
    ON public.shifts (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_roll_call_sessions_date_created
    ON public.roll_call_sessions (session_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_duty_attendance_active_checkin
    ON public.duty_attendance_records (duty_date DESC)
    WHERE status = 'checked_in';

CREATE INDEX IF NOT EXISTS idx_duty_attendance_date_status
    ON public.duty_attendance_records (duty_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_archives_category_generated_at
    ON public.archives (category, generated_at DESC);

-- -----------------------------------------------------------------------------
-- 2. RETENTION CONFIGURATION TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_retention_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    logs_retention_days INTEGER NOT NULL DEFAULT 60,
    rollcall_entries_retention_days INTEGER NOT NULL DEFAULT 30,
    rollcall_sessions_retention_days INTEGER NOT NULL DEFAULT 90,
    attendance_retention_days INTEGER NOT NULL DEFAULT 90,
    roster_retention_days INTEGER NOT NULL DEFAULT 90,
    snapshot_retention_days INTEGER NOT NULL DEFAULT 90,
    storage_pdf_retention_days INTEGER NOT NULL DEFAULT 30,
    audit_retention_days INTEGER NOT NULL DEFAULT 90,
    auto_cleanup_enabled BOOLEAN NOT NULL DEFAULT true,
    last_cleanup_at TIMESTAMPTZ,
    last_cleanup_summary JSONB DEFAULT '{}'::jsonb,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.app_retention_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_retention_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read retention settings" ON public.app_retention_settings;
CREATE POLICY "Allow authenticated read retention settings"
    ON public.app_retention_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update retention settings" ON public.app_retention_settings;
CREATE POLICY "Allow authenticated update retention settings"
    ON public.app_retention_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 3. TELEMETRY RPC: LIVE 500 MB DB & 1 GB STORAGE USAGE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_database_storage_telemetry()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_db_bytes BIGINT := 0;
    v_storage_bytes BIGINT := 0;
    v_archive_bucket_bytes BIGINT := 0;
    v_archive_bucket_files BIGINT := 0;
    v_old_archive_bucket_files BIGINT := 0;
    v_old_archive_bucket_bytes BIGINT := 0;
    v_settings RECORD;
    v_tables JSONB;
BEGIN
    SELECT pg_database_size(current_database()) INTO v_db_bytes;

    SELECT * INTO v_settings FROM public.app_retention_settings WHERE id = 1;

    BEGIN
        SELECT
            COALESCE(SUM(COALESCE((metadata->>'size')::BIGINT, 0)), 0),
            COALESCE(SUM(CASE WHEN bucket_id = 'archive-documents' THEN COALESCE((metadata->>'size')::BIGINT, 0) ELSE 0 END), 0),
            COALESCE(COUNT(*) FILTER (WHERE bucket_id = 'archive-documents' AND name NOT LIKE '%.emptyFolderPlaceholder'), 0),
            COALESCE(COUNT(*) FILTER (
                WHERE bucket_id = 'archive-documents'
                  AND name NOT LIKE '%.emptyFolderPlaceholder'
                  AND created_at < now() - make_interval(days => COALESCE(v_settings.storage_pdf_retention_days, 30))
            ), 0),
            COALESCE(SUM(
                CASE
                    WHEN bucket_id = 'archive-documents'
                     AND name NOT LIKE '%.emptyFolderPlaceholder'
                     AND created_at < now() - make_interval(days => COALESCE(v_settings.storage_pdf_retention_days, 30))
                    THEN COALESCE((metadata->>'size')::BIGINT, 0)
                    ELSE 0
                END
            ), 0)
        INTO
            v_storage_bytes,
            v_archive_bucket_bytes,
            v_archive_bucket_files,
            v_old_archive_bucket_files,
            v_old_archive_bucket_bytes
        FROM storage.objects;
    EXCEPTION WHEN OTHERS THEN
        v_storage_bytes := 0;
    END;

    SELECT jsonb_build_array(
        jsonb_build_object(
            'table_name', 'shift_logs',
            'label', 'Shift Operations Logs (/logs)',
            'row_count', (SELECT count(*) FROM public.shift_logs),
            'size_bytes', pg_total_relation_size('public.shift_logs'),
            'oldest_date', (SELECT min(log_date)::text FROM public.shift_logs)
        ),
        jsonb_build_object(
            'table_name', 'shifts',
            'label', 'Operational Shifts & Duty Personnel (/logs & /shifts)',
            'row_count', (SELECT count(*) FROM public.shifts) + (SELECT count(*) FROM public.shift_duty_personnel),
            'size_bytes', pg_total_relation_size('public.shifts') + pg_total_relation_size('public.shift_duty_personnel'),
            'oldest_date', (SELECT min(shift_date)::text FROM public.shifts)
        ),
        jsonb_build_object(
            'table_name', 'roll_call_entries',
            'label', 'Roll Call LGU Station Entries (/roll-call)',
            'row_count', (SELECT count(*) FROM public.roll_call_entries),
            'size_bytes', pg_total_relation_size('public.roll_call_entries'),
            'oldest_date', (SELECT min(created_at)::date::text FROM public.roll_call_entries)
        ),
        jsonb_build_object(
            'table_name', 'roll_call_sessions',
            'label', 'Roll Call Session Summaries (/roll-call)',
            'row_count', (SELECT count(*) FROM public.roll_call_sessions),
            'size_bytes', pg_total_relation_size('public.roll_call_sessions'),
            'oldest_date', (SELECT min(session_date)::text FROM public.roll_call_sessions)
        ),
        jsonb_build_object(
            'table_name', 'duty_attendance_records',
            'label', 'Officer Check-In / Attendance (/shifts)',
            'row_count', (SELECT count(*) FROM public.duty_attendance_records),
            'size_bytes', pg_total_relation_size('public.duty_attendance_records'),
            'oldest_date', (SELECT min(duty_date)::text FROM public.duty_attendance_records)
        ),
        jsonb_build_object(
            'table_name', 'duty_roster_assignments',
            'label', 'Shift Schedule Calendar Roster (/settings/shifts)',
            'row_count', (SELECT count(*) FROM public.duty_roster_assignments),
            'size_bytes', pg_total_relation_size('public.duty_roster_assignments'),
            'oldest_date', (SELECT min(duty_date)::text FROM public.duty_roster_assignments)
        ),
        jsonb_build_object(
            'table_name', 'archives',
            'label', 'Archives Metadata & JSONB Snapshots (/archives)',
            'row_count', (SELECT count(*) FROM public.archives),
            'size_bytes', pg_total_relation_size('public.archives'),
            'oldest_date', (SELECT min(generated_at)::date::text FROM public.archives)
        ),
        jsonb_build_object(
            'table_name', 'audit_logs',
            'label', 'System Audit Trail & OTP Hygiene',
            'row_count', (SELECT count(*) FROM public.audit_logs) + (SELECT count(*) FROM public.password_reset_otps),
            'size_bytes', pg_total_relation_size('public.audit_logs') + pg_total_relation_size('public.password_reset_otps'),
            'oldest_date', (SELECT min(created_at)::date::text FROM public.audit_logs)
        )
    ) INTO v_tables;

    RETURN jsonb_build_object(
        'db_size_bytes', v_db_bytes,
        'db_limit_bytes', 524288000,
        'storage_size_bytes', v_storage_bytes,
        'storage_limit_bytes', 1073741824,
        'archive_bucket_bytes', v_archive_bucket_bytes,
        'archive_bucket_files', v_archive_bucket_files,
        'old_archive_bucket_files', v_old_archive_bucket_files,
        'old_archive_bucket_bytes', v_old_archive_bucket_bytes,
        'settings', to_jsonb(v_settings),
        'tables', v_tables,
        'measured_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_database_storage_telemetry() TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. SAFE RETENTION CLEANUP RPC (DRY-RUN & EXECUTION)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_data_retention_cleanup(
    p_dry_run BOOLEAN DEFAULT true,
    p_logs_days INTEGER DEFAULT NULL,
    p_rollcall_entries_days INTEGER DEFAULT NULL,
    p_rollcall_sessions_days INTEGER DEFAULT NULL,
    p_attendance_days INTEGER DEFAULT NULL,
    p_roster_days INTEGER DEFAULT NULL,
    p_snapshot_days INTEGER DEFAULT NULL,
    p_audit_days INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cfg public.app_retention_settings%ROWTYPE;
    v_logs_days INTEGER;
    v_rc_entries_days INTEGER;
    v_rc_sessions_days INTEGER;
    v_att_days INTEGER;
    v_roster_days INTEGER;
    v_snap_days INTEGER;
    v_aud_days INTEGER;

    v_logs_count BIGINT := 0;
    v_shifts_count BIGINT := 0;
    v_rc_entries_count BIGINT := 0;
    v_rc_sessions_count BIGINT := 0;
    v_att_count BIGINT := 0;
    v_roster_count BIGINT := 0;
    v_snap_count BIGINT := 0;
    v_audit_count BIGINT := 0;
    v_otp_count BIGINT := 0;
    v_invite_count BIGINT := 0;
    v_result JSONB;
BEGIN
    SELECT * INTO v_cfg FROM public.app_retention_settings WHERE id = 1;

    v_logs_days := GREATEST(7, COALESCE(p_logs_days, v_cfg.logs_retention_days, 60));
    v_rc_entries_days := GREATEST(7, COALESCE(p_rollcall_entries_days, v_cfg.rollcall_entries_retention_days, 30));
    v_rc_sessions_days := GREATEST(14, COALESCE(p_rollcall_sessions_days, v_cfg.rollcall_sessions_retention_days, 90));
    v_att_days := GREATEST(14, COALESCE(p_attendance_days, v_cfg.attendance_retention_days, 90));
    v_roster_days := GREATEST(14, COALESCE(p_roster_days, v_cfg.roster_retention_days, 90));
    v_snap_days := GREATEST(14, COALESCE(p_snapshot_days, v_cfg.snapshot_retention_days, 90));
    v_aud_days := GREATEST(14, COALESCE(p_audit_days, v_cfg.audit_retention_days, 90));

    -- 1. Count eligible Shift Logs (exclude any log belonging to an active shift)
    SELECT count(*) INTO v_logs_count
    FROM public.shift_logs sl
    LEFT JOIN public.shifts s ON s.id = sl.shift_id
    WHERE sl.log_date < (CURRENT_DATE - v_logs_days)
      AND (s.id IS NULL OR s.status != 'active');

    -- 2. Count eligible Completed/Cancelled Shifts (never delete status = 'active')
    SELECT count(*) INTO v_shifts_count
    FROM public.shifts s
    WHERE s.status != 'active'
      AND s.shift_date < (CURRENT_DATE - v_logs_days);

    -- 3. Count eligible Roll Call Station Entries (exclude in_progress sessions)
    SELECT count(*) INTO v_rc_entries_count
    FROM public.roll_call_entries rce
    JOIN public.roll_call_sessions rcs ON rcs.id = rce.session_id
    WHERE rcs.status != 'in_progress'
      AND rcs.session_date < (CURRENT_DATE - v_rc_entries_days);

    -- 4. Count eligible Completed Roll Call Sessions (exclude in_progress)
    SELECT count(*) INTO v_rc_sessions_count
    FROM public.roll_call_sessions rcs
    WHERE rcs.status != 'in_progress'
      AND rcs.session_date < (CURRENT_DATE - v_rc_sessions_days);

    -- 5. Count eligible Duty Attendance Records (exclude unclosed status = 'checked_in')
    SELECT count(*) INTO v_att_count
    FROM public.duty_attendance_records dar
    WHERE dar.status != 'checked_in'
      AND dar.duty_date < (CURRENT_DATE - v_att_days);

    -- 6. Count eligible Past Duty Roster Assignments (strictly past dates only)
    SELECT count(*) INTO v_roster_count
    FROM public.duty_roster_assignments dra
    WHERE dra.duty_date < (CURRENT_DATE - v_roster_days);

    -- 7. Count Archives with heavy snapshot_data older than threshold
    SELECT count(*) INTO v_snap_count
    FROM public.archives a
    WHERE a.generated_at < (now() - make_interval(days => v_snap_days))
      AND (a.snapshot_data ? 'logs' OR a.snapshot_data ? 'entries' OR a.snapshot_data ? 'records');

    -- 8. Count System Hygiene rows (Audit Logs, Expired OTPs, Expired/Revoked Invites)
    SELECT count(*) INTO v_audit_count
    FROM public.audit_logs
    WHERE created_at < (now() - make_interval(days => v_aud_days));

    SELECT count(*) INTO v_otp_count
    FROM public.password_reset_otps
    WHERE expires_at < (now() - interval '1 day');

    SELECT count(*) INTO v_invite_count
    FROM public.invitations
    WHERE status IN ('expired', 'revoked')
      AND created_at < (now() - interval '30 days');

    IF NOT p_dry_run THEN
        -- Execute deletions in dependency-safe order
        DELETE FROM public.shift_logs sl
        USING (
            SELECT sl2.id
            FROM public.shift_logs sl2
            LEFT JOIN public.shifts s ON s.id = sl2.shift_id
            WHERE sl2.log_date < (CURRENT_DATE - v_logs_days)
              AND (s.id IS NULL OR s.status != 'active')
        ) target
        WHERE sl.id = target.id;

        DELETE FROM public.shifts s
        WHERE s.status != 'active'
          AND s.shift_date < (CURRENT_DATE - v_logs_days);

        DELETE FROM public.roll_call_entries rce
        USING public.roll_call_sessions rcs
        WHERE rce.session_id = rcs.id
          AND rcs.status != 'in_progress'
          AND rcs.session_date < (CURRENT_DATE - v_rc_entries_days);

        DELETE FROM public.roll_call_sessions rcs
        WHERE rcs.status != 'in_progress'
          AND rcs.session_date < (CURRENT_DATE - v_rc_sessions_days);

        DELETE FROM public.duty_attendance_records dar
        WHERE dar.status != 'checked_in'
          AND dar.duty_date < (CURRENT_DATE - v_att_days);

        DELETE FROM public.duty_roster_assignments dra
        WHERE dra.duty_date < (CURRENT_DATE - v_roster_days);

        -- Compact heavy snapshot_data JSONB while preserving date & summary metadata
        UPDATE public.archives a
        SET snapshot_data = jsonb_strip_nulls(
            jsonb_build_object(
                'dailyReportDate', a.snapshot_data->>'dailyReportDate',
                'sessionDate', a.snapshot_data->>'sessionDate',
                'prunedAt', now()
            )
        )
        WHERE a.generated_at < (now() - make_interval(days => v_snap_days))
          AND (a.snapshot_data ? 'logs' OR a.snapshot_data ? 'entries' OR a.snapshot_data ? 'records');

        DELETE FROM public.audit_logs
        WHERE created_at < (now() - make_interval(days => v_aud_days));

        DELETE FROM public.password_reset_otps
        WHERE expires_at < (now() - interval '1 day');

        DELETE FROM public.invitations
        WHERE status IN ('expired', 'revoked')
          AND created_at < (now() - interval '30 days');
    END IF;

    v_result := jsonb_build_object(
        'dry_run', p_dry_run,
        'shift_logs_deleted', v_logs_count,
        'shifts_deleted', v_shifts_count,
        'roll_call_entries_deleted', v_rc_entries_count,
        'roll_call_sessions_deleted', v_rc_sessions_count,
        'duty_attendance_deleted', v_att_count,
        'duty_roster_deleted', v_roster_count,
        'archive_snapshots_compacted', v_snap_count,
        'audit_logs_deleted', v_audit_count,
        'expired_otps_deleted', v_otp_count,
        'expired_invitations_deleted', v_invite_count,
        'executed_at', now()
    );

    IF NOT p_dry_run THEN
        UPDATE public.app_retention_settings
        SET
            last_cleanup_at = now(),
            last_cleanup_summary = v_result,
            updated_at = now()
        WHERE id = 1;
    END IF;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_data_retention_cleanup(BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. OPTIONAL NIGHTLY PG_CRON SCHEDULE (3:00 AM PHT / 19:00 UTC)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    PERFORM cron.unschedule('pdrrmo-nightly-db-retention')
    WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'pdrrmo-nightly-db-retention'
    );

    PERFORM cron.schedule(
        'pdrrmo-nightly-db-retention',
        '0 19 * * *',
        $cron$
        SELECT public.run_data_retention_cleanup(false)
        WHERE EXISTS (
            SELECT 1 FROM public.app_retention_settings
            WHERE id = 1 AND auto_cleanup_enabled = true
        );
        $cron$
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not active yet; enable pg_cron in Supabase Dashboard -> Database -> Extensions to activate automatic nightly cleanup.';
END $$;

NOTIFY pgrst, 'reload schema';
