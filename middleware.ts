import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authRoutes, DEFAULT_LOGIN_REDIRECT, publicRoutes } from "@/config/auth";

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  });
  const isLoggedIn = Boolean(token?.sub);
  const isAuthRoute = authRoutes.some((route) => nextUrl.pathname.startsWith(route));
  const isPublicRoute = publicRoutes.some(
    (route) => route === nextUrl.pathname || nextUrl.pathname.startsWith(route + "/")
  );

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
  }

  if (!isLoggedIn && !isPublicRoute) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(new URL("/login?callbackUrl=" + callbackUrl, nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
