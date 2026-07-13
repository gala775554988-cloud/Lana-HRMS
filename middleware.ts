import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "@auth/core/jwt";
import { resolveRoleDashboard } from "@/config/auth";

const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";

export async function middleware(request: NextRequest) {
  const p = request.nextUrl.pathname;
  const isRoot = p === "/";

  // Skip getToken for public pages — no JWT verify needed
  if (!isRoot && (p.startsWith("/login") || p.startsWith("/forgot-password") || p.startsWith("/reset-password") || p.startsWith("/verify-email"))) {
    return NextResponse.next();
  }

  const secureCookie = request.nextUrl.protocol === "https:";
  const token = await getToken({
    req: request, secret: AUTH_SECRET,
    secureCookie,
    cookieName: `${secureCookie ? "__Secure-" : ""}authjs.session-token`,
  });
  const loggedIn = !!token;
  const roles: string[] = (token?.roles as string[]) ?? [];

  if (loggedIn && (isRoot || p.startsWith("/login") || p.startsWith("/forgot-password") || p.startsWith("/reset-password") || p.startsWith("/verify-email"))) {
    return NextResponse.redirect(new URL(resolveRoleDashboard(roles), request.url));
  }
  if (!loggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
