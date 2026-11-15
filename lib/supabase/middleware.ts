import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PERSISTENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 days

/**
 * Public authentication routes where unauthenticated users can access,
 * and authenticated users should be redirected away to /dashboard.
 */
const AUTH_ROUTES = ['/login', '/register', '/forgot-password'];

/**
 * Public standalone routes accessible to both unauthenticated and authenticated visitors
 * (e.g. Google OAuth Consent Screen Privacy Policy & Terms of Service verification pages,
 * service worker background registration, and public push API endpoints).
 */
const PUBLIC_ROUTES = [
  '/terms',
  '/terms-and-conditions',
  '/privacy',
  '/privacy-policy',
  '/googlec855f23319c579a6.html',
  '/sw.js',
  '/manifest.json',
  '/manifest.webmanifest',
  '/api/push/vapid-public-key',
  '/api/push/subscribe',
  '/api/auth/forgot-password',
  '/api/auth',
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
 * Detects transient network/fetch failures during server-side auth verification
 * so temporary connectivity blips never kick a remembered terminal out to /login.
 */
function isTransientAuthError(error: { name?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || (error.status && error.status >= 500)) {
    return true;
  }
  const msg = error.message || '';
  return /fetch|network|timeout|abort|econn|enotfound|socket/i.test(msg);
}

/**
 * Refreshes auth tokens and enforces server-side route protection.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Fast-path: Public standalone routes (e.g. /terms-and-conditions, /privacy, /sw.js, push endpoints)
  // Return immediately without round-trip auth checks so clients get instant responses.
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

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes('-auth-token') && Boolean(cookie.value));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      maxAge: PERSISTENT_COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          const isDeleting = !value || options?.maxAge === 0;
          supabaseResponse.cookies.set(name, value, {
            ...options,
            path: options?.path ?? '/',
            sameSite: options?.sameSite ?? 'lax',
            ...(isDeleting ? {} : { maxAge: options?.maxAge ?? PERSISTENT_COOKIE_MAX_AGE }),
          });
        });
      },
    },
  });

  // Fetch current authenticated user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // If the terminal already has auth cookies and getUser() failed due to a transient
  // network/fetch blip, keep the route open so client-side AuthContext stays active.
  if (!user && hasAuthCookie && isTransientAuthError(error)) {
    return supabaseResponse;
  }

  // 1. Unauthenticated user trying to access protected routes or root /
  if (!user && !isAuthRoute(pathname)) {
    // API routes should never be redirected to HTML login page
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
