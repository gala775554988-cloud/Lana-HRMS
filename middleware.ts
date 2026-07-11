import { NextResponse, type NextRequest } from "next/server";
import { getToken, type JWT } from "@auth/core/jwt";
import { authRoutes, DEFAULT_LOGIN_REDIRECT, publicRoutes, resolveRoleDashboard } from "@/config/auth";
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
  requestHeaders.set("x-lana-pathname", normalizedPath);

  // Fast path for public routes - no need to check token
  const isAuthRoute = authRoutes.some((route) => normalizedPath === route || normalizedPath.startsWith(route + "/"));
  const isPublicRoute = publicRoutes.some(
    (route) => route === normalizedPath || normalizedPath.startsWith(route + "/")
  );

  // Auth.js v5 JWT handling - try auto then secure and non-secure for compatibility
  let token: JWT | null = null;
  let isLoggedIn = false;
  
  if (AUTH_SECRET) {
    try {
      token = await getToken({ req: request, secret: AUTH_SECRET });
    } catch {}
    
    if (!token) {
      try {
        token = await getToken({
          req: request,
          secret: AUTH_SECRET,
          secureCookie: true,
          salt: "__Secure-authjs.session-token",
          cookieName: "__Secure-authjs.session-token",
        });
      } catch {}
    }

    if (!token) {
      try {
        token = await getToken({
          req: request,
          secret: AUTH_SECRET,
          secureCookie: false,
          salt: "authjs.session-token",
          cookieName: "authjs.session-token",
        });
      } catch {}
    }

    isLoggedIn = Boolean(token?.sub ?? token?.email ?? token);
  }

  // Force change password check - if mustChangePassword true, redirect to force-change-password
  const mustChangePassword = (token as any)?.mustChangePassword === true;
  const isForceChangeRoute = normalizedPath === "/force-change-password" || normalizedPath.startsWith("/force-change-password");
  const isApiForceChange = normalizedPath.startsWith("/api/auth/force-change-password") || normalizedPath.startsWith("/api/auth/change-password");
  
  if (isLoggedIn && mustChangePassword && !isForceChangeRoute && !isApiForceChange && !normalizedPath.startsWith("/api/auth/signout") && !normalizedPath.startsWith("/logout") && !isAuthRoute) {
    const forceChangePath = pathLocale ? withLocale("/force-change-password", activeLocale) : "/force-change-password";
    const response = NextResponse.redirect(new URL(forceChangePath, nextUrl));
    response.cookies.set("lana-locale", activeLocale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  // Root path: redirect to login only if NOT logged in
  if (normalizedPath === "/") {
    if (!isLoggedIn) {
      const loginPath = pathLocale ? withLocale("/login", activeLocale) : "/login";
      const response = NextResponse.redirect(new URL(loginPath, nextUrl));
      response.cookies.set("lana-locale", activeLocale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
      return response;
    }
    // If logged in but must change password, go to force change
    if (mustChangePassword) {
      const forceChangePath = pathLocale ? withLocale("/force-change-password", activeLocale) : "/force-change-password";
      const response = NextResponse.redirect(new URL(forceChangePath, nextUrl));
      response.cookies.set("lana-locale", activeLocale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
      return response;
    }
    const roles = Array.isArray(token?.roles) ? (token.roles as string[]) : [];
    const targetDashboard = roles.length > 0 ? resolveRoleDashboard(roles) : DEFAULT_LOGIN_REDIRECT;
    console.log("[ROUTE_TRACE]", { currentRoute: normalizedPath, currentRole: roles, targetDashboard, reason: "root-logged-in-redirect" });
    const response = NextResponse.redirect(new URL(pathLocale ? withLocale(targetDashboard, activeLocale) : targetDashboard, nextUrl));
    response.cookies.set("lana-locale", activeLocale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  if (isAuthRoute && isLoggedIn) {
    // If must change password, don't allow access to login page, redirect to force change
    if (mustChangePassword) {
      const forceChangePath = pathLocale ? withLocale("/force-change-password", activeLocale) : "/force-change-password";
      const response = NextResponse.redirect(new URL(forceChangePath, nextUrl));
      response.cookies.set("lana-locale", activeLocale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
      return response;
    }
    const roles = Array.isArray(token?.roles) ? (token.roles as string[]) : [];
    const targetDashboard = roles.length > 0 ? resolveRoleDashboard(roles) : "/";
    console.log("[ROUTE_TRACE]", { currentRoute: normalizedPath, currentRole: roles, targetDashboard, reason: "auth-route-logged-in-redirect" });
    const response = NextResponse.redirect(new URL(pathLocale ? withLocale(targetDashboard, activeLocale) : targetDashboard, nextUrl));
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
