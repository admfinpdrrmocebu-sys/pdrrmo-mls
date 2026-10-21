import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (public assets)
     * - terms / terms-and-conditions / privacy / privacy-policy (public OAuth compliance pages)
     * - Any image extension (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|assets|terms|terms-and-conditions|privacy|privacy-policy|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|txt|xml)$).*)',
  ],
};
