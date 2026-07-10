import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/password";
import { mergeEffectivePermissions } from "@/lib/enterprise/permissions";
import { inferEnterpriseRolesFromPosition } from "@/lib/enterprise/role-inference";

const authUserSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  emailVerified: true,
  image: true,
  passwordHash: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  isLocked: true,
} as const;

type AuthDbUser = {
  id: string;
  name: string | null;
  username?: string | null;
  email: string | null;
  emailVerified?: Date | null;
  image: string | null;
  passwordHash: string | null;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  isLocked?: boolean | null;
};

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
  const inferredRoles = inferEnterpriseRolesFromPosition(employee?.position?.title);
  const roles = Array.from(new Set([...roleNames, ...inferredRoles]));
  if (roles.length === 0 && employee) roles.push("EMPLOYEE");
  const rolePermissions = assignments.flatMap((assignment: any) =>
    assignment.role.permissions.map(
      ({ permission }: any) => `${permission.action}:${permission.resource}`
    )
  );
  const permissions = await mergeEffectivePermissions(Array.from(new Set(rolePermissions)), userId).catch(() => Array.from(new Set(rolePermissions)));
  if (roles.includes("SUPER_ADMIN")) permissions.push("*:*");

  return {
    roles,
    permissions
  };
}

async function findUserByIdentifier(identifier: string): Promise<AuthDbUser | null> {
  const normalized = identifier.trim();
  const lower = normalized.toLowerCase();
  const debug = {
    identifier: normalized,
    searches: [] as string[],
    userFound: false,
    employeeFound: false,
    accountActive: null as boolean | null,
    passwordHashExists: null as boolean | null,
    reason: "start"
  };

  
  // 1. AUTO-REPAIR ADMIN ACCOUNT ON LOGIN ATTEMPT
  if (normalized === "admin") {
    debug.searches.push("admin auto-repair: User.username = admin");
    let adminUser = await prisma.user.findFirst({ where: { username: "admin" }, select: authUserSelect });
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
        },
        select: authUserSelect
      });
    } else {
      // Force repair the existing admin account
      adminUser = await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          isActive: true,
          passwordHash: hashedPassword, // FORCE REPAIR PASSWORD
          emailVerified: new Date()
        },
        select: authUserSelect
      });
    }

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: superAdminRole.id }
    });
    
    // Continue normal flow so they can login. If they typed a different password, it will fail verifyPassword,
    // but at least the account is fixed and ready for "Admin@123456"
  }

  // 1. Admin or User by username or email

  debug.searches.push("User.username exact", "User.username insensitive", "User.email insensitive", "User.email startsWith identifier@");
  const byUsernameOrEmail = await prisma.user.findFirst({
    where: {
      OR: [
        { username: normalized },
        { username: { equals: lower, mode: "insensitive" } },
        { email: { equals: lower, mode: "insensitive" } },
        { email: { startsWith: `${lower}@`, mode: "insensitive" } }
      ]
    },
    select: authUserSelect
  });
  if (byUsernameOrEmail) {
    debug.userFound = true;
    debug.accountActive = byUsernameOrEmail.isActive;
    debug.passwordHashExists = Boolean(byUsernameOrEmail.passwordHash);
    debug.reason = "found by username/email";
    console.log("[Auth][findUserByIdentifier]", debug);
    return byUsernameOrEmail;
  }

  // 2. Employee by nationalId (primary for employees)
  debug.searches.push("Employee.nationalId exact");
  let employee = await prisma.employee.findUnique({
    where: { nationalId: normalized },
    include: { user: { select: authUserSelect } }
  });

  // 3. Fallback: by employeeNumber
  if (!employee) {
    debug.searches.push("Employee.employeeNumber exact");
    employee = await prisma.employee.findFirst({
      where: { employeeNumber: normalized },
      include: { user: { select: authUserSelect } }
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
        },
        select: authUserSelect
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

      debug.employeeFound = true;
      debug.userFound = true;
      debug.accountActive = user.isActive;
      debug.passwordHashExists = Boolean(user.passwordHash);
      debug.reason = "employee user auto-created/repaired";
      console.log("[Auth][findUserByIdentifier]", debug);
      return user;
    }

    debug.employeeFound = true;
    debug.userFound = Boolean(employee.user);
    debug.accountActive = employee.user?.isActive ?? null;
    debug.passwordHashExists = Boolean(employee.user?.passwordHash);
    debug.reason = "found by nationalId/employeeNumber";
    console.log("[Auth][findUserByIdentifier]", debug);
    return employee.user;
  }

  // 4. Direct user lookup
  debug.searches.push("Direct User.email insensitive", "Direct User.username insensitive");
  const directUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: lower, mode: "insensitive" } },
        { username: { equals: lower, mode: "insensitive" } }
      ]
    },
    select: authUserSelect
  });
  if (directUser) {
    debug.userFound = true;
    debug.accountActive = directUser.isActive;
    debug.passwordHashExists = Boolean(directUser.passwordHash);
    debug.reason = "found by direct user fallback";
    console.log("[Auth][findUserByIdentifier]", debug);
    return directUser;
  }

  debug.reason = "no user or employee found";
  console.log("[Auth][findUserByIdentifier]", debug);
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
          console.log("[Auth][authorize] reject", {
            identifier: typeof (credentials as any)?.identifier === "string" ? (credentials as any).identifier : null,
            userFound: false,
            employeeFound: false,
            accountActive: null,
            passwordMatched: false,
            reason: "login schema validation failed"
          });
          return null;
        }

        const user = await findUserByIdentifier(parsed.data.identifier);

        if (!user) {
          console.log("[Auth][authorize] reject", {
            identifier: parsed.data.identifier,
            userFound: false,
            employeeFound: false,
            accountActive: null,
            passwordMatched: false,
            reason: "No user found by username/email/nationalId/employeeNumber"
          });
          return null;
        }

        if (!user.isActive || (user as any).isLocked) {
          console.log("[Auth][authorize] reject", {
            identifier: parsed.data.identifier,
            userFound: true,
            employeeFound: null,
            accountActive: user.isActive,
            accountLocked: Boolean((user as any).isLocked),
            passwordMatched: null,
            reason: "User is inactive or locked"
          });
          return null;
        }

        if (!user.passwordHash) {
          console.log("[Auth][authorize] reject", {
            identifier: parsed.data.identifier,
            userFound: true,
            employeeFound: null,
            accountActive: user.isActive,
            passwordMatched: false,
            reason: "No passwordHash for user"
          });
          return null;
        }

        const passwordValid = await verifyPassword(
          parsed.data.password,
          user.passwordHash
        );

        if (!passwordValid) {
          console.log("[Auth][authorize] reject", {
            identifier: parsed.data.identifier,
            userFound: true,
            employeeFound: null,
            accountActive: user.isActive,
            passwordMatched: false,
            reason: "bcrypt.compare returned false"
          });
          return null;
        }

        console.log("[Auth][authorize] accepted", {
          identifier: parsed.data.identifier,
          userFound: true,
          employeeFound: null,
          accountActive: user.isActive,
          passwordMatched: true,
          reason: "credentials accepted"
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), loginCount: { increment: 1 } as any },
          select: { id: true }
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