import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Public authentication routes where unauthenticated users can access,
 * and authenticated users should be redirected away to /dashboard.
 */
const AUTH_ROUTES = ['/login', '/register', '/forgot-password'];

/**
 * Public standalone routes accessible to both unauthenticated and authenticated visitors
 * (e.g. Google OAuth Consent Screen Privacy Policy & Terms of Service verification pages,
 * service worker background registration, and public push/auth recovery API endpoints).
 */
const PUBLIC_ROUTES = [
  '/terms',
  '/terms-and-conditions',
  '/privacy',
  '/privacy-policy',
  '/googlec855f23319c579a6.html',
  '/sw.js',
  '/maplibre-gl-worker.js',
  '/manifest.json',
  '/manifest.webmanifest',
  '/api/push/vapid-public-key',
  '/api/push/subscribe',
  '/api/auth/forgot-password',
  '/api/auth',
  '/geo/cebu_noah.pmtiles',
];

/**
 * Checks whether a given path is an auth route.
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
 * Checks quickly whether any Supabase SSR auth token cookie is attached to the request.
 */
function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));
}

/**
 * Refreshes auth tokens and enforces server-side route protection with low-latency validation.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Fast-path 1: Public standalone routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next({
      request,
    });
  }

  // Fast-path 2: Zero Supabase auth cookies present -> skip client creation & auth round-trip
  if (!hasSupabaseAuthCookie(request)) {
    if (isAuthRoute(pathname)) {
      return NextResponse.next({ request });
    }
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

  // Fast-path 3: Next.js hover prefetches use local cookie session validation without blocking on Auth API
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch';

  let isAuthenticated = false;

  if (isPrefetch) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    isAuthenticated = Boolean(session?.user?.id);
  } else {
    // getClaims() validates token expiry, refreshes expired sessions via getSession(),
    // and verifies asymmetric JWTs locally via cached JWKS without remote Auth round-trips.
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    isAuthenticated = Boolean(!claimsError && claimsData?.claims?.sub);
  }

  // 1. Unauthenticated user trying to access protected routes or root /
  if (!isAuthenticated && !isAuthRoute(pathname)) {
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
  if (isAuthenticated && (isAuthRoute(pathname) || pathname === '/')) {
    const redirectedFrom = request.nextUrl.searchParams.get('redirectedFrom');
    const url = request.nextUrl.clone();
    url.pathname = redirectedFrom && !isAuthRoute(redirectedFrom) ? redirectedFrom : '/dashboard';
    url.searchParams.delete('redirectedFrom');
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
