import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "@auth/core/jwt";

const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const token = await getToken({ req: request, secret: AUTH_SECRET });
  const isLoggedIn = !!token;

  const pathname = nextUrl.pathname;

  // Public routes that don't require authentication
  const isAuthPage = pathname.startsWith("/login") || 
                     pathname.startsWith("/forgot-password") || 
                     pathname.startsWith("/reset-password");

  const isPublicApi = pathname.startsWith("/api/auth");

  // If user is logged in and trying to access auth pages → redirect to dashboard
  if (isLoggedIn && isAuthPage) {
    const roles = (token.roles as string[]) || [];
    const target = roles.includes("SUPER_ADMIN") ? "/admin/dashboard" : "/employee/dashboard";
    return NextResponse.redirect(new URL(target, nextUrl));
  }

  // If user is NOT logged in and trying to access protected routes
  if (!isLoggedIn && !isAuthPage && !isPublicApi) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Role-based protection
  if (isLoggedIn) {
    const roles = (token.roles as string[]) || [];

    // Employee trying to access admin routes
    if (roles.includes("EMPLOYEE") && !roles.includes("SUPER_ADMIN")) {
      if (!pathname.startsWith("/employee") && !pathname.startsWith("/api")) {
        return NextResponse.redirect(new URL("/employee/dashboard", nextUrl));
      }
    }

    // Super Admin trying to access employee routes (optional redirect)
    if (roles.includes("SUPER_ADMIN") && pathname.startsWith("/employee")) {
      return NextResponse.redirect(new URL("/admin/dashboard", nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)",
  ],
};