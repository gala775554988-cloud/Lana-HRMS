import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword, hashPassword } from "@/lib/password";
import { getCachedEffectivePermissions } from "@/lib/enterprise/permissions";

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

async function findUser(identifier: string) {
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
  // Employee found but no user account — auto-create one
  if (emp) {
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
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await findUser(parsed.data.identifier);
        if (!user?.passwordHash || !user.isActive) return null;
        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
        const { roles } = await getAuthorization(user.id);
        // Only store roles in JWT, not permissions (too large → cookie chunking → middleware break)
        return {
          id: user.id, name: user.name, email: user.email, image: user.image,
          roles,
          mustChangePassword: user.mustChangePassword ?? false,
          passwordChanged: user.passwordChanged ?? false,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
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
        try { const authz = await getAuthorization(token.sub); token.roles = authz.roles; } catch {}
      }
      return token;
    },

    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
        session.user.image = token.picture ?? session.user.image;
        (session.user as any).roles = token.roles ?? [];
        (session.user as any).mustChangePassword = (token as any).mustChangePassword ?? false;
        (session.user as any).passwordChanged = (token as any).passwordChanged ?? false;
        const roles: string[] = token.roles ?? [];
        // Computed fresh (short-lived cache) rather than baked into the JWT --
        // keeps the cookie small and lets permission edits take effect quickly.
        (session.user as any).permissions = await getCachedEffectivePermissions(token.sub, roles);
      }
      return session;
    },
  },
});
