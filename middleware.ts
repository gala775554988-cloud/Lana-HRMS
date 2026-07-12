import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "@auth/core/jwt";
import { resolveRoleDashboard } from "@/config/auth";

const AUTH_SECRET =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip excluded paths
  if (/^\/(?:api|_next\/static|_next\/image|favicon\.ico|manifest\.webmanifest)/.test(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: AUTH_SECRET,
    salt: "authjs.session-token",
    secureCookie: process.env.NODE_ENV === "production",
  });

  const loggedIn = !!token;
  const roles: string[] = (token?.roles as string[]) ?? [];

  const isAuthPage = pathname.startsWith("/login")
    || pathname.startsWith("/forgot-password")
    || pathname.startsWith("/reset-password")
    || pathname.startsWith("/verify-email")
    || pathname === "/";

  if (loggedIn && isAuthPage) {
    return NextResponse.redirect(new URL(resolveRoleDashboard(roles), request.url));
  }

  if (!loggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest).*)",
  ],
};
