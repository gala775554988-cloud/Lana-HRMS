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
  
  // 1. Direct user lookup
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: value }, { username: lower }, { email: lower }, { email: { startsWith: `${lower}@` } }] },
  });
  if (user) return user;
  
  // 2. Employee lookup + auto-create user account if needed
  const emp = await prisma.employee.findFirst({
    where: { OR: [{ nationalId: value }, { employeeNumber: value }] },
  });
  if (!emp) return null;
  
  // Return linked user if exists
  if (emp.userId) {
    const linked = await prisma.user.findUnique({ where: { id: emp.userId } });
    if (linked) return linked;
  }
  
  // Auto-create user account for employee (first login)
  const last4 = emp.nationalId.slice(-4);
  const passwordHash = await hashPassword(last4);
  const name = `${emp.firstName} ${emp.lastName}`.trim();
  const email = emp.email ? emp.email.toLowerCase() : `emp.${emp.employeeNumber}@lana.local`;
  
  const newUser = await prisma.user.create({
    data: {
      username: emp.nationalId,
      email,
      name,
      passwordHash,
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
        // SUPER_ADMIN gets wildcard permission
        const roles: string[] = token.roles ?? [];
        (session.user as any).permissions = roles.includes("SUPER_ADMIN") ? ["*:*"] : [];
      }
      return session;
    },
  },
});
