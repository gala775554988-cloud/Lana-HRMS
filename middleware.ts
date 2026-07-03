import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authRoutes, DEFAULT_LOGIN_REDIRECT, publicRoutes } from "@/config/auth";
import { getLocaleFromPath, normalizeLocale, stripLocaleFromPath, withLocale } from "@/lib/i18n";

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const pathLocale = getLocaleFromPath(nextUrl.pathname);
  const cookieLocale = request.cookies.get("lana-locale")?.value;
  const activeLocale = pathLocale ?? normalizeLocale(cookieLocale);
  const normalizedPath = stripLocaleFromPath(nextUrl.pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-lana-locale", activeLocale);
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  });
  const isLoggedIn = Boolean(token?.sub);
  const isAuthRoute = authRoutes.some((route) => normalizedPath.startsWith(route));
  const isPublicRoute = publicRoutes.some(
    (route) => route === normalizedPath || normalizedPath.startsWith(route + "/")
  );

  if (isAuthRoute && isLoggedIn) {
    const response = NextResponse.redirect(new URL(pathLocale ? withLocale(DEFAULT_LOGIN_REDIRECT, activeLocale) : DEFAULT_LOGIN_REDIRECT, nextUrl));
    response.cookies.set("lana-locale", activeLocale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  if (!isLoggedIn && !isPublicRoute) {
    const callbackPath = (pathLocale ? withLocale(normalizedPath, activeLocale) : normalizedPath) + nextUrl.search;
    const loginPath = pathLocale ? withLocale("/login", activeLocale) : "/login";
    const response = NextResponse.redirect(new URL(loginPath + "?callbackUrl=" + encodeURIComponent(callbackPath), nextUrl));
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
