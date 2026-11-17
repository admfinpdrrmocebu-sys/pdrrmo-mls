-- =============================================================================
-- PDRRMO MLS — AFFILIATED PDRRMO WEB APPS MIGRATION
-- =============================================================================
-- Execute this script in the Supabase SQL Editor to create:
--   1. Table 18: public.affiliated_apps (+ indexes, updated_at trigger, RLS)
--   2. Public Storage Bucket: 'affiliated-apps' (+ storage RLS policies)
--   3. Realtime Broadcasting for public.affiliated_apps
--   4. RBAC Permission Backfill ('Affiliated Apps') on public.access_roles
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLE: public.affiliated_apps
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.affiliated_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    app_url TEXT NOT NULL,
    image_url TEXT NOT NULL,
    storage_path TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    pinned_at TIMESTAMPTZ,
    pinned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliated_apps_sort_order ON public.affiliated_apps(sort_order);
CREATE INDEX IF NOT EXISTS idx_affiliated_apps_active ON public.affiliated_apps(is_active);
CREATE INDEX IF NOT EXISTS idx_affiliated_apps_directory_order
    ON public.affiliated_apps (is_pinned DESC, pinned_at DESC NULLS LAST, sort_order ASC, created_at DESC)
    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_affiliated_apps_pinned_active
    ON public.affiliated_apps (pinned_at DESC NULLS LAST, sort_order ASC)
    WHERE is_active = true AND is_pinned = true;

-- Attach Updated-At Trigger
DROP TRIGGER IF EXISTS trigger_affiliated_apps_updated_at ON public.affiliated_apps;
CREATE TRIGGER trigger_affiliated_apps_updated_at
    BEFORE UPDATE ON public.affiliated_apps
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Sync Pin Metadata & Auto-Unpin Trigger
CREATE OR REPLACE FUNCTION public.sync_affiliated_app_pin_metadata()
RETURNS TRIGGER AS $$
BEGIN
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
-- 2. ROW LEVEL SECURITY (RLS)
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

ALTER TABLE public.affiliated_apps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read affiliated_apps" ON public.affiliated_apps;
CREATE POLICY "Allow authenticated read affiliated_apps"
    ON public.affiliated_apps FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage affiliated_apps" ON public.affiliated_apps;
DROP POLICY IF EXISTS "Allow full access manage affiliated_apps" ON public.affiliated_apps;
CREATE POLICY "Allow full access manage affiliated_apps"
    ON public.affiliated_apps FOR ALL TO authenticated
    USING (public.can_write_affiliated_apps())
    WITH CHECK (public.can_write_affiliated_apps());

-- -----------------------------------------------------------------------------
-- 3. STORAGE BUCKET ('affiliated-apps') & POLICIES
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'affiliated-apps',
    'affiliated-apps',
    true,
    10485760,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Affiliated apps public read" ON storage.objects;
CREATE POLICY "Affiliated apps public read"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'affiliated-apps');

DROP POLICY IF EXISTS "Affiliated apps authenticated write" ON storage.objects;
CREATE POLICY "Affiliated apps authenticated write"
    ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'affiliated-apps')
    WITH CHECK (bucket_id = 'affiliated-apps');

-- -----------------------------------------------------------------------------
-- 4. REALTIME BROADCASTING
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliated_apps;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 5. RBAC SCREEN PERMISSION BACKFILL ON public.access_roles
-- -----------------------------------------------------------------------------
-- Appends {"screen": "Affiliated Apps", "level": ...} to existing roles that
-- do not yet have an entry for "Affiliated Apps".
UPDATE public.access_roles
SET permissions = permissions || jsonb_build_array(
    jsonb_build_object(
        'screen', 'Affiliated Apps',
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
      WHERE lower(elem->>'screen') = 'affiliated apps'
  );
