-- =============================================================================
-- FIX SIGNATURES STORAGE BUCKET (MAKE PUBLIC READABLE)
-- =============================================================================
-- This enables browser <img> tags to fetch digital signatures without 
-- 403 Forbidden / Broken Image errors.
-- =============================================================================

-- 1. Ensure 'signatures' bucket is marked as public
UPDATE storage.buckets 
SET public = true, file_size_limit = 5242880
WHERE id = 'signatures';

-- In case the bucket didn't exist yet, insert with public = true
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('signatures', 'signatures', true, 5242880, ARRAY['image/png', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow public read access on signatures bucket
DROP POLICY IF EXISTS "Signatures public read" ON storage.objects;
CREATE POLICY "Signatures public read" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id = 'signatures');

-- 3. Allow authenticated users to upload and update signatures
DROP POLICY IF EXISTS "Signatures authenticated write" ON storage.objects;
CREATE POLICY "Signatures authenticated write" ON storage.objects 
FOR ALL TO authenticated 
USING (bucket_id = 'signatures') 
WITH CHECK (bucket_id = 'signatures');
