import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword, hashPassword } from "@/lib/password";

async function getAuthorization(userId: string) {
  const assignments = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { name: true } } },
  });
  const roles = Array.from(new Set(assignments.map((a) => a.role.name)));
  if (roles.length === 0) roles.push("EMPLOYEE");
  return { roles };
}

async function findUser(identifier: string) {
  const value = identifier.trim();
  const lower = value.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: value }, { username: lower }, { email: lower }, { email: { startsWith: `${lower}@` } }] },
  });
  if (user) return { user, employee: null };
  const emp = await prisma.employee.findFirst({
    where: { OR: [{ nationalId: value }, { employeeNumber: value }] },
  });
  if (!emp) return { user: null, employee: null };
  if (emp.userId) {
    const linkedUser = await prisma.user.findUnique({ where: { id: emp.userId } });
    return { user: linkedUser, employee: emp };
  }
  return { user: null, employee: emp };
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
        try {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const { user, employee } = await findUser(parsed.data.identifier);

          // Existing user with password → normal login
          if (user?.passwordHash && user.isActive) {
            const ok = await verifyPassword(parsed.data.password, user.passwordHash);
            if (!ok) return null;
            await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
            const { roles } = await getAuthorization(user.id);
            return { id: user.id, name: user.name, email: user.email, image: user.image, roles, mustChangePassword: user.mustChangePassword ?? false, passwordChanged: user.passwordChanged ?? false };
          }

          // Employee found but no user → auto-create account
          if (employee && !user?.passwordHash) {
            const nationalId = employee.nationalId || `EMP-${employee.employeeNumber}`;
            const expectedPassword = nationalId.slice(-4).padStart(4, "0");
            if (parsed.data.password !== expectedPassword) return null;

            const pwHash = await hashPassword(expectedPassword);
            const fullName = `${employee.firstName} ${employee.lastName}`.trim();
            const email = employee.email || `emp.${employee.employeeNumber}@lana.local`;

            let newUser;
            if (employee.userId) {
              newUser = await prisma.user.upsert({
                where: { id: employee.userId },
                update: { name: fullName, email, passwordHash: pwHash, isActive: true, emailVerified: new Date(), mustChangePassword: true, passwordChanged: false },
                create: { name: fullName, email, passwordHash: pwHash, isActive: true, emailVerified: new Date(), mustChangePassword: true, passwordChanged: false },
              });
            } else {
              try {
                newUser = await prisma.user.create({
                  data: { name: fullName, email, passwordHash: pwHash, isActive: true, emailVerified: new Date(), mustChangePassword: true, passwordChanged: false },
                });
                await prisma.employee.update({ where: { id: employee.id }, data: { userId: newUser.id } }).catch(() => {});
              } catch (createErr: any) {
                if (createErr?.code === 'P2002') {
                  newUser = await prisma.user.findUnique({ where: { email } });
                  if (newUser) {
                    await prisma.user.update({ where: { id: newUser.id }, data: { passwordHash: pwHash, isActive: true } });
                    await prisma.employee.update({ where: { id: employee.id }, data: { userId: newUser.id } }).catch(() => {});
                  }
                } else throw createErr;
              }
            }

            if (!newUser) return null;
            const employeeRole = await prisma.role.upsert({ where: { name: "EMPLOYEE" }, update: {}, create: { name: "EMPLOYEE", description: "Employee", isSystem: true } });
            await prisma.userRole.upsert({ where: { userId_roleId: { userId: newUser.id, roleId: employeeRole.id } }, update: {}, create: { userId: newUser.id, roleId: employeeRole.id } }).catch(() => {});

            const { roles } = await getAuthorization(newUser.id);
            return { id: newUser.id, name: newUser.name, email: newUser.email, image: newUser.image, roles, mustChangePassword: true, passwordChanged: false };
          }

          return null;
        } catch (e: any) {
          console.error("[AUTH_ERROR]", e?.message || e, e?.code);
          return null;
        }
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
        (session.user as any).permissions = roles.includes("SUPER_ADMIN") ? ["*:*"] : [];
      }
      return session;
    },
  },
});
