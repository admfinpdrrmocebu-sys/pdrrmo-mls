import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Public authentication routes where unauthenticated users can access,
 * and authenticated users should be redirected away to /dashboard.
 */
const AUTH_ROUTES = ['/login', '/register', '/forgot-password'];

/**
 * Public standalone routes accessible to both unauthenticated and authenticated visitors
 * (e.g. Google OAuth Consent Screen Privacy Policy & Terms of Service verification pages).
 */
const PUBLIC_ROUTES = [
  '/terms',
  '/terms-and-conditions',
  '/privacy',
  '/privacy-policy',
  '/googlec855f23319c579a6.html',
];

/**
 * Checks whether a given path is an auth route or root landing.
 */
function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Checks whether a given path is a public route accessible without authentication.
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Refreshes auth tokens and enforces server-side route protection.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Fast-path: Public standalone routes (e.g. /terms-and-conditions, /privacy for Google OAuth verification)
  // Return immediately without round-trip auth checks so crawlers get instant HTTP 200 responses.
  if (isPublicRoute(pathname)) {
    return NextResponse.next({
      request,
    });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Fetch current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Unauthenticated user trying to access protected routes or root / -> redirect to /login
  if (!user && !isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/') {
      url.searchParams.set('redirectedFrom', pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(url);
  }

  // 2. Authenticated user trying to access auth pages or root / -> redirect to /dashboard
  if (user && (isAuthRoute(pathname) || pathname === '/')) {
    const redirectedFrom = request.nextUrl.searchParams.get('redirectedFrom');
    const url = request.nextUrl.clone();
    url.pathname = redirectedFrom && !isAuthRoute(redirectedFrom) ? redirectedFrom : '/dashboard';
    url.searchParams.delete('redirectedFrom');
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
