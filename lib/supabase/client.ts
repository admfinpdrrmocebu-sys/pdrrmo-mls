import { createBrowserClient } from '@supabase/ssr';

/**
 * 400 days in seconds (maximum cookie lifetime permitted by modern browsers per RFC 6265bis)
 * so terminal sessions remain remembered until the officer explicitly presses Sign Out.
 */
export const PERSISTENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/**
 * Creates a Supabase client for Client Components with persistent session & cookie lifetime.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    cookieOptions: {
      maxAge: PERSISTENT_COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
    },
  });
}

// Export singleton instance for convenience in client components
export const supabase = createClient();
export default supabase;
