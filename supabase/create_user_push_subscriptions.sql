-- =============================================================================
-- Table: USER PUSH SUBSCRIPTIONS (Mobile & Desktop Web Push Subscriptions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_sub_user_id ON public.user_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_endpoint ON public.user_push_subscriptions(endpoint);

-- Automatic Updated-At Trigger
DROP TRIGGER IF EXISTS trigger_push_subs_updated_at ON public.user_push_subscriptions;
CREATE TRIGGER trigger_push_subs_updated_at 
    BEFORE UPDATE ON public.user_push_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security (RLS)
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users manage own push subscriptions" ON public.user_push_subscriptions;
CREATE POLICY "Allow authenticated users manage own push subscriptions" 
    ON public.user_push_subscriptions 
    FOR ALL 
    TO authenticated 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow anon read/insert push subscriptions" ON public.user_push_subscriptions;
CREATE POLICY "Allow anon read/insert push subscriptions" 
    ON public.user_push_subscriptions 
    FOR ALL 
    TO anon 
    USING (true)
    WITH CHECK (true);
