import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/password";
import { mergeEffectivePermissions } from "@/lib/enterprise/permissions";
import { inferEnterpriseRolesFromPosition } from "@/lib/enterprise/role-inference";

async function getAuthorization(userId: string) {
  const assignments: any = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  });

  const roleNames = assignments.map((assignment: any) => assignment.role.name);
  const employee = await prisma.employee.findFirst({ where: { userId }, include: { position: true } }).catch(() => null);
  const roles = Array.from(new Set([...roleNames, ...inferEnterpriseRolesFromPosition(employee?.position?.title)]));
  const rolePermissions = assignments.flatMap((assignment: any) =>
    assignment.role.permissions.map(
      ({ permission }: any) => `${permission.action}:${permission.resource}`
    )
  );
  const permissions = await mergeEffectivePermissions(Array.from(new Set(rolePermissions)), userId).catch(() => Array.from(new Set(rolePermissions)));

  return {
    roles,
    permissions
  };
}

async function findUserByIdentifier(identifier: string) {
  const normalized = identifier.trim();
  const lower = normalized.toLowerCase();

  // 1. Admin or User by username or email
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

  // 2. Employee by nationalId (primary for employees)
  let employee = await prisma.employee.findUnique({
    where: { nationalId: normalized },
    include: { user: true }
  });

  // 3. Fallback: by employeeNumber
  if (!employee) {
    employee = await prisma.employee.findFirst({
      where: { employeeNumber: normalized },
      include: { user: true }
    });
  }

  if (employee) {
    // If employee exists but has no linked user or the user has no password, auto-repair it
    if (!employee.user || !employee.user.passwordHash) {
      // Create or repair the user account for this employee
      const defaultPass = `Emp@${normalized.slice(-4).padStart(4, "0")}`;
      const passwordHash = await (await import("./lib/password")).hashPassword(defaultPass);

      const userEmail = employee.email || `employee.${normalized}@lana.local`;

      const user = await prisma.user.upsert({
        where: { email: userEmail.toLowerCase() },
        update: {
          passwordHash,
          isActive: true,
          name: `${employee.firstName} ${employee.lastName}`.trim()
        },
        create: {
          email: userEmail.toLowerCase(),
          name: `${employee.firstName} ${employee.lastName}`.trim(),
          passwordHash,
          emailVerified: new Date(),
          isActive: true
        }
      });

      // Link employee to user if not linked
      if (!employee.userId || employee.userId !== user.id) {
        await prisma.employee.update({
          where: { id: employee.id },
          data: { userId: user.id }
        });
      }

      // Assign EMPLOYEE role
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

  // 4. Direct user lookup
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
          permissions: (authorization.permissions || []) as string[]
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.sub = user.id;
        token.name = user.name ?? token.name;
        token.email = user.email ?? token.email;
        token.picture = user.image ?? token.picture;

        if (Array.isArray((user as any).roles)) {
          token.roles = (user as any).roles;
        }
        if (Array.isArray((user as any).permissions)) {
          token.permissions = (user as any).permissions;
        }

        if (!token.roles || (token.roles as string[]).length === 0) {
          try {
            const authorization = await getAuthorization(user.id);
            token.roles = authorization.roles as string[];
            token.permissions = authorization.permissions as string[];
          } catch {
            token.roles = (token.roles as string[]) ?? [];
            token.permissions = (token.permissions as string[]) ?? [];
          }
        }
      }

      if (!token.roles) token.roles = [];
      if (!token.permissions) token.permissions = [];

      if (trigger === "update" && token.sub) {
        try {
          const authorization = await getAuthorization(token.sub);
          token.roles = authorization.roles as string[];
          token.permissions = authorization.permissions as string[];
        } catch {
          // ignore Edge / DB errors during update
        }
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
      }

      return session;
    }
  }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);