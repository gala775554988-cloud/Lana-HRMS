import { NextResponse, type NextRequest } from "next/server";
import { getToken, type JWT } from "@auth/core/jwt";
import { authRoutes, DEFAULT_LOGIN_REDIRECT, publicRoutes } from "@/config/auth";
import { getLocaleFromPath, normalizeLocale, stripLocaleFromPath, withLocale } from "@/lib/i18n";

const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const pathLocale = getLocaleFromPath(nextUrl.pathname);
  const cookieLocale = request.cookies.get("lana-locale")?.value;
  const activeLocale = pathLocale ?? normalizeLocale(cookieLocale);
  const normalizedPath = stripLocaleFromPath(nextUrl.pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-lana-locale", activeLocale);

  // Auth.js v5 JWT handling - try both secure and non-secure cookie names
  let token: JWT | null = null;
  if (AUTH_SECRET) {
    try {
      // Try secure cookie first (production)
      token = await getToken({
        req: request,
        secret: AUTH_SECRET,
        secureCookie: true,
        salt: "__Secure-authjs.session-token",
        cookieName: "__Secure-authjs.session-token",
      });
    } catch {}
    if (!token) {
      try {
        // Fallback to non-secure cookie (development)
        token = await getToken({
          req: request,
          secret: AUTH_SECRET,
          secureCookie: false,
          salt: "authjs.session-token",
          cookieName: "authjs.session-token",
        });
      } catch {}
    }
  }

  const isLoggedIn = Boolean(token?.sub ?? token?.email ?? token);

  const isAuthRoute = authRoutes.some((route) => normalizedPath === route || normalizedPath.startsWith(route + "/"));
  const isPublicRoute = publicRoutes.some(
    (route) => route === normalizedPath || normalizedPath.startsWith(route + "/")
  );

  // Root path: redirect to dashboard if logged in, otherwise to login
  if (normalizedPath === "/") {
    const targetPath = isLoggedIn
      ? (pathLocale ? withLocale(DEFAULT_LOGIN_REDIRECT, activeLocale) : DEFAULT_LOGIN_REDIRECT)
      : (pathLocale ? withLocale("/login", activeLocale) : "/login");
    const response = NextResponse.redirect(new URL(targetPath, nextUrl));
    response.cookies.set("lana-locale", activeLocale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  // Prevent redirect loops on /dashboard (role-based redirect page)
  if (normalizedPath === "/dashboard") {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (isAuthRoute && isLoggedIn) {
    const response = NextResponse.redirect(new URL(pathLocale ? withLocale(DEFAULT_LOGIN_REDIRECT, activeLocale) : DEFAULT_LOGIN_REDIRECT, nextUrl));
    response.cookies.set("lana-locale", activeLocale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  if (!isLoggedIn && !isPublicRoute) {
    const loginPath = pathLocale ? withLocale("/login", activeLocale) : "/login";
    const response = NextResponse.redirect(new URL(loginPath, nextUrl));
    response.cookies.set("lana-locale", activeLocale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  if (pathLocale) {
    const rewriteUrl = nextUrl.clone();
    rewriteUrl.pathname = normalizedPath;
    const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
    response.cookies.set("lana-locale", activeLocale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
