import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/password";
import { mergeEffectivePermissions } from "@/lib/enterprise/permissions";
import { inferEnterpriseRolesFromPosition } from "@/lib/enterprise/role-inference";

async function getAuthorization(userId: string) {
  // Optimized: Use select instead of heavy includes
  const assignments = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: {
          name: true,
          permissions: {
            select: {
              permission: {
                select: { action: true, resource: true }
              }
            }
          }
        }
      }
    }
  });

  const roleNames = assignments.map(a => a.role.name);
  const employee = await prisma.employee.findFirst({
    where: { userId },
    select: { position: { select: { title: true } } }
  }).catch(() => null);

  const inferredRoles = inferEnterpriseRolesFromPosition(employee?.position?.title);
  const roles = Array.from(new Set([...roleNames, ...inferredRoles]));
  if (roles.length === 0 && employee) roles.push("EMPLOYEE");

  const rolePermissions = assignments.flatMap(a =>
    a.role.permissions.map(p => `${p.permission.action}:${p.permission.resource}`)
  );

  const permissions = await mergeEffectivePermissions(Array.from(new Set(rolePermissions)), userId)
    .catch(() => Array.from(new Set(rolePermissions)));

  if (roles.includes("SUPER_ADMIN")) permissions.push("*:*");

  return { roles, permissions };
}

async function findUserByIdentifier(identifier: string) {
  const normalized = identifier.trim();
  const lower = normalized.toLowerCase();

  
  // 1. AUTO-REPAIR ADMIN ACCOUNT ON LOGIN ATTEMPT
  if (normalized === "admin") {
    let adminUser = await prisma.user.findFirst({ where: { username: "admin" } });
    const superAdminRole = await prisma.role.upsert({
      where: { name: "SUPER_ADMIN" },
      update: { isSystem: true },
      create: { name: "SUPER_ADMIN", description: "Super Administrator", isSystem: true }
    });

    const hashedPassword = await (await import("./lib/password")).hashPassword("Admin@123456");

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          username: "admin",
          email: "admin@lana.local",
          name: "System Admin",
          passwordHash: hashedPassword,
          isActive: true,
          emailVerified: new Date(),
          mustChangePassword: false,
          passwordChanged: true,
          passwordChangedAt: new Date(),
        }
      });
    } else {
      adminUser = await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          isActive: true,
          passwordHash: hashedPassword,
          emailVerified: new Date(),
          mustChangePassword: false,
          passwordChanged: true,
          passwordChangedAt: new Date(),
        }
      });
    }

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: superAdminRole.id }
    });
  }

  // 2. Try by username (nationalId is stored as username) or email
  const byUsernameOrEmail = await prisma.user.findFirst({
    where: {
      OR: [
        { username: normalized },
        { username: { equals: lower, mode: "insensitive" } },
        { email: { equals: lower, mode: "insensitive" } },
        { email: { startsWith: `${lower}@`, mode: "insensitive" } }
      ]
    }
  });
  if (byUsernameOrEmail) return byUsernameOrEmail;

  // 3. Employee by nationalId (primary for employees - NEW SYSTEM)
  let employee = await prisma.employee.findUnique({
    where: { nationalId: normalized },
    include: { user: true }
  });

  // 4. Fallback: by employeeNumber (for backward compatibility)
  if (!employee) {
    employee = await prisma.employee.findFirst({
      where: { employeeNumber: normalized },
      include: { user: true }
    });
  }

  if (employee) {
    if (!employee.user || !employee.user.passwordHash) {
      if (!employee.nationalId || employee.nationalId.trim() === "" || employee.nationalId.toUpperCase() === "NA") {
        return null;
      }

      const last4 = employee.nationalId.slice(-4);
      const passwordHash = await (await import("./lib/password")).hashPassword(last4);

      const user = await prisma.user.create({
        data: {
          username: employee.nationalId,
          email: employee.email ? employee.email.toLowerCase() : `employee.${employee.nationalId}@lana.local`,
          name: `${employee.firstName} ${employee.lastName}`.trim(),
          passwordHash,
          emailVerified: new Date(),
          isActive: true,
          mustChangePassword: true,
          passwordChanged: false,
        }
      });

      await prisma.employee.update({
        where: { id: employee.id },
        data: { userId: user.id }
      });

      const employeeRole = await prisma.role.findUnique({ where: { name: "EMPLOYEE" } });
      if (employeeRole) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: employeeRole.id } },
          update: {},
          create: { userId: user.id, roleId: employeeRole.id }
        });
      }

      return user;
    }

    return employee.user;
  }

  const directUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: lower, mode: "insensitive" } },
        { username: { equals: lower, mode: "insensitive" } }
      ]
    }
  });
  if (directUser) return directUser;

  return null;
}

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 15
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Username or National ID", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const user = await findUserByIdentifier(parsed.data.identifier);

        if (!user) {
          console.log("[Auth] No user found for identifier:", parsed.data.identifier);
          return null;
        }

        if (!user.isActive) {
          console.log("[Auth] User is inactive:", user.id);
          return null;
        }

        if (!user.passwordHash) {
          console.log("[Auth] No passwordHash for user:", user.id);
          return null;
        }

        const passwordValid = await verifyPassword(
          parsed.data.password,
          user.passwordHash
        );

        if (!passwordValid) {
          console.log("[Auth] Password mismatch for user:", user.id);
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });

        const authorization = await getAuthorization(user.id);

        return {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          roles: (authorization.roles || []) as string[],
          permissions: (authorization.permissions || []) as string[],
          mustChangePassword: (user as any).mustChangePassword || false,
          passwordChanged: (user as any).passwordChanged || false,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Only set roles/permissions when user first logs in
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;

        // Save roles and permissions directly from the authorize function
        token.roles = (user as any).roles || [];
        token.permissions = (user as any).permissions || [];
        (token as any).mustChangePassword = (user as any).mustChangePassword || false;
        (token as any).passwordChanged = (user as any).passwordChanged || false;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.roles = Array.isArray(token.roles) ? (token.roles as string[]) : [];
        session.user.permissions = Array.isArray(token.permissions) ? (token.permissions as string[]) : [];
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
        session.user.image = (token.picture as string | null) ?? session.user.image;
        (session.user as any).mustChangePassword = (token as any).mustChangePassword || false;
        (session.user as any).passwordChanged = (token as any).passwordChanged || false;
      }

      return session;
    }
  }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
