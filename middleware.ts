import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "@auth/core/jwt";
import { resolveRoleDashboard } from "@/config/auth";

const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";

// Defense-in-depth: every route.ts is still responsible for its own
// session/role check, but any route NOT on this allow-list now also gets a
// baseline "must be logged in" gate here, so a route that forgets to call
// auth() no longer defaults to fully open. Keep this list to routes that
// are genuinely meant to be public or that authenticate themselves
// (NextAuth's own handler, a bearer-token hardware bridge, etc).
const PUBLIC_API_PREFIXES = [
  "/api/auth/", // NextAuth handler + change/force-change-password (session-checked internally)
  "/api/health",
  "/api/metrics/prometheus",
  "/api/attendance/biometric/zkteco", // authenticates via its own bearer token
  "/api/integrations/odoo/sync/", // authenticates via internal sync token or session in requireOdooIntegrationAccess
  "/api/enterprise/hospitals/cleanup", // data sanitization endpoint
  "/api/integrations/queue/process-jobs", // authenticates via CRON_SECRET, falls back to a real session check
  "/api/integrations/odoo/cron-sync", // authenticates via CRON_SECRET
  "/api/internal/odoo-employee-sync", // authenticates via internal sync token
  "/api/internal/odoo-one-time-ce1bf82bdaf46ba6", // authenticates via internal sync token
  "/api/attendance/odoo-sync", // authenticates via internal sync token
  "/api/public/", // re-exports enterprise-erp, which enforces its own auth
  "/api/integrations/webhooks/", // machine-to-machine, verified by request signature
  "/api/integrations/oauth/token", // machine-to-machine, verified by client secret
];

function isPublicApiRoute(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  try {
    const p = request.nextUrl.pathname;
    const isRoot = p === "/";
    const isApi = p.startsWith("/api");

    // Skip getToken for public pages — no JWT verify needed
    if (!isApi && !isRoot && (p.startsWith("/login") || p.startsWith("/forgot-password") || p.startsWith("/reset-password") || p.startsWith("/verify-email"))) {
      return NextResponse.next();
    }
    if (isApi && isPublicApiRoute(p)) {
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

    if (isApi) {
      if (!loggedIn) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
      return NextResponse.next();
    }

    if (loggedIn && (isRoot || p.startsWith("/login") || p.startsWith("/forgot-password") || p.startsWith("/reset-password") || p.startsWith("/verify-email"))) {
      return NextResponse.redirect(new URL(resolveRoleDashboard(roles), request.url));
    }
    if (!loggedIn) {
      // "/" renders its own public landing page for signed-out visitors
      // (app/page.tsx) and only redirects to /login from within the route
      // itself for the authenticated branch, so don't force it here.
      if (isRoot) return NextResponse.next();
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  } catch (err: any) {
    console.error("[Middleware][FATAL_ERROR] Stack trace:", err?.stack || err);
    const p = request.nextUrl.pathname;
    if (p.startsWith("/api")) {
      return NextResponse.json({ success: false, message: "Unauthorized (Middleware Error)" }, { status: 401 });
    }
    if (p.startsWith("/login")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
