import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "@auth/core/jwt";

const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const token = await getToken({ req: request, secret: AUTH_SECRET });
  const isLoggedIn = !!token;

  const pathname = nextUrl.pathname;

  // Public routes (no auth required)
  const isAuthPage = pathname.startsWith("/login") || 
                     pathname.startsWith("/forgot-password") || 
                     pathname.startsWith("/reset-password");
  const isPublicApi = pathname.startsWith("/api/auth");

  // Case 1: Logged in user trying to access login page → redirect to dashboard
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/employee/dashboard", nextUrl));
  }

  // Case 2: Not logged in and trying to access protected page
  if (!isLoggedIn && !isAuthPage && !isPublicApi) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest).*)",
  ],
};