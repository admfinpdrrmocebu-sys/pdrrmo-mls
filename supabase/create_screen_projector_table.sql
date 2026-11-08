-- =============================================================================
-- PDRRMO MLS — SCREEN PROJECTOR (LED WALL MULTI-SCREEN GRID) MIGRATION
-- =============================================================================
-- Execute this script in the Supabase SQL Editor to create:
--   1. Table 19: public.projector_screens (+ indexes, updated_at trigger, RLS)
--   2. Realtime Broadcasting for public.projector_screens
--   3. RBAC Permission Backfill ('Screen Projector') on public.access_roles
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLE: public.projector_screens
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projector_screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    web_link TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    device_orders JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by_name TEXT,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projector_screens_sort_order ON public.projector_screens(sort_order);
CREATE INDEX IF NOT EXISTS idx_projector_screens_active ON public.projector_screens(is_active);
CREATE INDEX IF NOT EXISTS idx_projector_screens_created_by ON public.projector_screens(created_by);

-- Attach Updated-At Trigger
DROP TRIGGER IF EXISTS trigger_projector_screens_updated_at ON public.projector_screens;
CREATE TRIGGER trigger_projector_screens_updated_at
    BEFORE UPDATE ON public.projector_screens
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.projector_screens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read projector_screens" ON public.projector_screens;
CREATE POLICY "Allow authenticated read projector_screens"
    ON public.projector_screens FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage projector_screens" ON public.projector_screens;
CREATE POLICY "Allow authenticated manage projector_screens"
    ON public.projector_screens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 3. REALTIME BROADCASTING
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projector_screens;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 4. RBAC SCREEN PERMISSION BACKFILL ON public.access_roles
-- -----------------------------------------------------------------------------
-- Appends {"screen": "Screen Projector", "level": ...} to existing roles that
-- do not yet have an entry for "Screen Projector".
UPDATE public.access_roles
SET permissions = permissions || jsonb_build_array(
    jsonb_build_object(
        'screen', 'Screen Projector',
        'level', CASE
            WHEN lower(code) = 'admin' OR lower(name) = 'admin' THEN 'Full Access'
            ELSE 'View Only'
        END
    )
)
WHERE jsonb_typeof(permissions) = 'array'
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(permissions) AS elem
      WHERE lower(elem->>'screen') = 'screen projector'
  );
