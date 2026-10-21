-- =============================================================================
-- Table: ANNOUNCEMENT ACKNOWLEDGMENTS (Duty Personnel Reading Receipts)
-- =============================================================================

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.announcement_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(announcement_id, user_id)
);

-- 2. Indexes for High-Speed Lookups & Realtime Filters
CREATE INDEX IF NOT EXISTS idx_announcement_ack_announcement_id ON public.announcement_acknowledgments(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_ack_user_id ON public.announcement_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_ack_created_at ON public.announcement_acknowledgments(created_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.announcement_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read acknowledgments
DROP POLICY IF EXISTS "Allow authenticated read announcement_acknowledgments" ON public.announcement_acknowledgments;
CREATE POLICY "Allow authenticated read announcement_acknowledgments" 
    ON public.announcement_acknowledgments 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow authenticated users to insert their own acknowledgment
DROP POLICY IF EXISTS "Allow authenticated insert own announcement_acknowledgments" ON public.announcement_acknowledgments;
CREATE POLICY "Allow authenticated insert own announcement_acknowledgments" 
    ON public.announcement_acknowledgments 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete/undo their own acknowledgment
DROP POLICY IF EXISTS "Allow authenticated delete own announcement_acknowledgments" ON public.announcement_acknowledgments;
CREATE POLICY "Allow authenticated delete own announcement_acknowledgments" 
    ON public.announcement_acknowledgments 
    FOR DELETE 
    TO authenticated 
    USING (auth.uid() = user_id);

-- 4. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_acknowledgments;
