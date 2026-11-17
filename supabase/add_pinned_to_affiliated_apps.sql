-- =============================================================================
-- PDRRMO — AFFILIATED APPS: PINNED APPS & PERFORMANCE INDEXES MIGRATION
-- =============================================================================
-- Execute this script in the Supabase SQL Editor to:
--   1. Add is_pinned, pinned_at, and pinned_by columns to public.affiliated_apps
--   2. Automatically sync pinned_at / pinned_by and clear pins when hidden
--   3. Create partial covering indexes for zero-sort directory & pinned queries
--   4. Enforce Full Access RBAC on Affiliated Apps mutations via RLS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADD PINNING COLUMNS TO public.affiliated_apps
-- -----------------------------------------------------------------------------
ALTER TABLE public.affiliated_apps
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 2. TRIGGER: SYNC PIN METADATA & AUTO-UNPIN WHEN HIDDEN
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_affiliated_app_pin_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Automatically unpin if the app is hidden from the directory
    IF NEW.is_active = false THEN
        NEW.is_pinned := false;
    END IF;

    IF NEW.is_pinned = true AND (OLD IS NULL OR OLD.is_pinned = false) THEN
        NEW.pinned_at := COALESCE(NEW.pinned_at, now());
        NEW.pinned_by := COALESCE(NEW.pinned_by, auth.uid());
    ELSIF NEW.is_pinned = false THEN
        NEW.pinned_at := NULL;
        NEW.pinned_by := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_affiliated_apps_pin_sync ON public.affiliated_apps;
CREATE TRIGGER trigger_affiliated_apps_pin_sync
    BEFORE INSERT OR UPDATE OF is_pinned, is_active ON public.affiliated_apps
    FOR EACH ROW EXECUTE FUNCTION public.sync_affiliated_app_pin_metadata();

-- -----------------------------------------------------------------------------
-- 3. OPTIMIZED PARTIAL COVERING INDEXES
-- -----------------------------------------------------------------------------
-- Directory query: active apps sorted with pinned apps first (most recently pinned first), then sort_order
CREATE INDEX IF NOT EXISTS idx_affiliated_apps_directory_order
    ON public.affiliated_apps (is_pinned DESC, pinned_at DESC NULLS LAST, sort_order ASC, created_at DESC)
    WHERE is_active = true;

-- Fast lookup specifically for global pinned quick-launch widgets
CREATE INDEX IF NOT EXISTS idx_affiliated_apps_pinned_active
    ON public.affiliated_apps (pinned_at DESC NULLS LAST, sort_order ASC)
    WHERE is_active = true AND is_pinned = true;

-- -----------------------------------------------------------------------------
-- 4. RBAC-ENFORCED ROW LEVEL SECURITY (Full Access Required to Mutate/Pin)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_write_affiliated_apps()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        LEFT JOIN public.access_roles ar
          ON lower(ar.code) = lower(p.role::text)
          OR lower(ar.name) = lower(COALESCE(p.position_title, ''))
        WHERE p.id = auth.uid()
          AND (
            p.role = 'admin'::public.user_role_type
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(ar.permissions, '[]'::jsonb)) elem
              WHERE lower(elem->>'screen') = 'affiliated apps'
                AND elem->>'level' = 'Full Access'
            )
          )
    );
$$;

DROP POLICY IF EXISTS "Allow authenticated read affiliated_apps" ON public.affiliated_apps;
CREATE POLICY "Allow authenticated read affiliated_apps"
    ON public.affiliated_apps FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage affiliated_apps" ON public.affiliated_apps;
DROP POLICY IF EXISTS "Allow full access manage affiliated_apps" ON public.affiliated_apps;
CREATE POLICY "Allow full access manage affiliated_apps"
    ON public.affiliated_apps FOR ALL TO authenticated
    USING (public.can_write_affiliated_apps())
    WITH CHECK (public.can_write_affiliated_apps());
