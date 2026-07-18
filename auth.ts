import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword, hashPassword } from "@/lib/password";
import { getCachedEffectivePermissions } from "@/lib/enterprise/permissions";
import { verifyOrBindEmployeeDevice } from "@/lib/cache/device-cache";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

async function getAuthorization(userId: string) {
  const assignments = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { name: true } } },
  });
  const roles = Array.from(new Set(assignments.map((a) => a.role.name)));
  if (roles.length === 0) roles.push("EMPLOYEE");
  return { roles };
}

async function findUserByUsernameOrEmail(value: string, lower: string) {
  // Two independent reads, run in parallel — cheap enough to always pay for,
  // unlike adding a third concurrent query on every login (see below).
  const [byUsername, byEmail] = await Promise.all([
    prisma.user.findFirst({
      where: { username: value, passwordHash: { not: null }, isActive: true },
    }),
    prisma.user.findFirst({
      where: { OR: [{ email: lower }, { email: { startsWith: `${lower}@` } }], passwordHash: { not: null }, isActive: true },
    }),
  ]);
  return byUsername ?? byEmail;
}

export async function findUser(identifier: string) {
  const value = identifier.trim();
  const lower = value.toLowerCase();
  // The login form's own placeholder tells employees to sign in with their
  // national ID (all-digit), which never matches a username or email — so a
  // purely numeric identifier goes straight to the employee lookup instead of
  // wastefully checking username/email first. This is deliberately NOT a
  // 3-way Promise.all of every lookup: with connection_limit=5 (see
  // lib/prisma.ts), having every login concurrently hold 3 connections would
  // risk exhausting the pool during a login rush. One query for the common
  // case, two only as a fallback, never three at once.
  const looksNumeric = /^\d+$/.test(value);

  if (looksNumeric) {
    const emp = await prisma.employee.findFirst({
      where: { OR: [{ nationalId: value }, { employeeNumber: value }] },
      include: { user: true },
    });
    if (emp) return finishFindUser(emp);
    return findUserByUsernameOrEmail(value, lower);
  }

  const byUsernameOrEmail = await findUserByUsernameOrEmail(value, lower);
  if (byUsernameOrEmail) return byUsernameOrEmail;

  const emp = await prisma.employee.findFirst({
    where: { OR: [{ nationalId: value }, { employeeNumber: value }] },
    include: { user: true },
  });
  return finishFindUser(emp);
}

type EmployeeWithUser = Prisma.EmployeeGetPayload<{ include: { user: true } }>;

async function finishFindUser(emp: EmployeeWithUser | null) {
  if (emp) {
    // Employee already has a linked account -- use it. Without this check,
    // every login for an already-linked employee hit prisma.user.create()
    // unconditionally below and failed with a unique constraint violation on
    // email (the employee's own email/user already existed). This never
    // showed up under the old sequential findUser(), which checked username
    // (== nationalId) first and returned early before ever reaching here;
    // the numeric-identifier fast path above skips straight past that.
    if (emp.user) return emp.user;

    // Employee found but no user account — auto-create one
    const last4 = emp.nationalId.slice(-4);
    const pwHash = await hashPassword(last4);
    const name = `${emp.firstName} ${emp.lastName}`.trim();
    const email = emp.email ? emp.email.toLowerCase() : `emp.${emp.employeeNumber}@lana.local`;

    const newUser = await prisma.user.create({
      data: {
        username: emp.nationalId,
        email,
        name,
        passwordHash: pwHash,
        emailVerified: new Date(),
        isActive: true,
        mustChangePassword: true,
        passwordChanged: false,
      },
    });

    await prisma.employee.update({ where: { id: emp.id }, data: { userId: newUser.id } });

    const employeeRole = await prisma.role.upsert({
      where: { name: "EMPLOYEE" },
      update: {},
      create: { name: "EMPLOYEE", description: "Employee", isSystem: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: newUser.id, roleId: employeeRole.id } },
      update: {},
      create: { userId: newUser.id, roleId: employeeRole.id },
    });

    return newUser;
  }

  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login", error: "/login" },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        deviceId: { label: "Device ID", type: "text" },
        turnstileToken: { label: "Turnstile Token", type: "text" },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) return null;

          // The real enforcement boundary: NextAuth calls authorize() no
          // matter which code path triggered signIn(), so a Turnstile check
          // living only in loginAction's pre-checks could be bypassed by
          // any other caller of signIn("credentials", ...). No session is
          // ever issued without an actively-verified token.
          const turnstileOk = await verifyTurnstileToken(parsed.data.turnstileToken);
          if (!turnstileOk) return null;

          const user = await findUser(parsed.data.identifier);
          if (!user?.passwordHash || !user.isActive) return null;
          const ok = await verifyPassword(parsed.data.password, user.passwordHash);
          if (!ok) return null;

          const deviceId = parsed.data.deviceId;
          if (deviceId && deviceId !== "unknown" && deviceId !== "server-side" && deviceId !== "mobile-session-fallback") {
            try {
              const employee = await prisma.employee.findFirst({
                where: {
                  OR: [
                    { userId: user.id },
                    { nationalId: user.username || "" },
                    { employeeNumber: user.username || "" }
                  ]
                },
                select: { id: true }
              });
              if (employee) {
                const deviceCheck = await verifyOrBindEmployeeDevice(employee.id, deviceId, "mobile");
                if (!deviceCheck.allowed) {
                  return null;
                }
              }
            } catch (deviceErr: any) {
              console.error("[Auth][DEVICE_BINDING_ERROR] Stack trace:", deviceErr?.stack || deviceErr);
            }
          }

          await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
          const { roles } = await getAuthorization(user.id);
          // Only store roles in JWT, not permissions (too large → cookie chunking → middleware break)
          return {
            id: user.id, name: user.name, email: user.email, image: user.image,
            roles,
            mustChangePassword: user.mustChangePassword ?? false,
            passwordChanged: user.passwordChanged ?? false,
          };
        } catch (authorizeErr: any) {
          console.error("[Auth][AUTHORIZE_FATAL_ERROR] Stack trace:", authorizeErr?.stack || authorizeErr);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      try {
        if (user) {
          token.sub = user.id!;
          token.name = user.name ?? undefined;
          token.email = user.email ?? undefined;
          token.picture = user.image ?? undefined;
          token.roles = (user as any).roles ?? [];
          (token as any).mustChangePassword = (user as any).mustChangePassword ?? false;
          (token as any).passwordChanged = (user as any).passwordChanged ?? false;
        }
        if (trigger === "update" && token.sub) {
          try { const authz = await getAuthorization(token.sub); token.roles = authz.roles; } catch (e: any) { console.error("[Auth][JWT_UPDATE_ERROR]", e?.stack || e); }
        }
      } catch (jwtErr: any) {
        console.error("[Auth][JWT_FATAL_ERROR] Stack trace:", jwtErr?.stack || jwtErr);
      }
      return token;
    },

    async session({ session, token }) {
      try {
        if (token.sub) {
          session.user.id = token.sub;
          session.user.name = token.name ?? session.user.name;
          session.user.email = token.email ?? session.user.email;
          session.user.image = token.picture ?? session.user.image;
          (session.user as any).roles = token.roles ?? [];
          (session.user as any).mustChangePassword = (token as any).mustChangePassword ?? false;
          (session.user as any).passwordChanged = (token as any).passwordChanged ?? false;
          const roles: string[] = token.roles ?? [];
          try {
            (session.user as any).permissions = await getCachedEffectivePermissions(token.sub, roles);
          } catch (permErr: any) {
            console.error("[Auth][SESSION_PERMISSIONS_ERROR] Stack trace:", permErr?.stack || permErr);
            (session.user as any).permissions = [];
          }
        }
      } catch (sessionErr: any) {
        console.error("[Auth][SESSION_FATAL_ERROR] Stack trace:", sessionErr?.stack || sessionErr);
      }
      return session;
    },
  },
});
