import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase client for Client Components.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Export singleton instance for convenience in client components
export const supabase = createClient();
export default supabase;
