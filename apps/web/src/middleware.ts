import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for auth cookie (refresh token) or other auth indicators
  // Note: actual JWT validation happens on the API side
  // Here we just do a lightweight check for the presence of auth data
  const hasRefreshCookie = request.cookies.has('refresh_token');

  // If no auth indicator, redirect to login
  // Note: This is a lightweight client-side guard; real auth validation is in the API
  if (!hasRefreshCookie && pathname !== '/login') {
    // Allow the client-side store to handle auth via localStorage
    // Don't redirect server-side to avoid SSR conflicts with client store
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
