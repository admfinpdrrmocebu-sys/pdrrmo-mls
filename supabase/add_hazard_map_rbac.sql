-- =============================================================================
-- PDRRMO — HAZARD MAP RBAC BACKFILL MIGRATION (View Only / None Only)
-- =============================================================================
-- Appends {"screen": "Hazard Map", "level": "View Only"} to existing roles in
-- public.access_roles and normalizes any "Full Access" entry on "Hazard Map"
-- to "View Only".
-- =============================================================================

UPDATE public.access_roles
SET permissions = permissions || jsonb_build_array(
    jsonb_build_object(
        'screen', 'Hazard Map',
        'level', 'View Only'
    )
)
WHERE jsonb_typeof(permissions) = 'array'
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(permissions) AS elem
      WHERE lower(elem->>'screen') = 'hazard map'
  );

UPDATE public.access_roles
SET permissions = (
    SELECT jsonb_agg(
        CASE
            WHEN lower(elem->>'screen') = 'hazard map' AND elem->>'level' = 'Full Access'
            THEN jsonb_set(elem, '{level}', '"View Only"'::jsonb)
            ELSE elem
        END
    )
    FROM jsonb_array_elements(permissions) AS elem
)
WHERE jsonb_typeof(permissions) = 'array'
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(permissions) AS elem
      WHERE lower(elem->>'screen') = 'hazard map'
        AND elem->>'level' = 'Full Access'
  );
