import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/password";

async function getAuthorization(userId: string) {
  const assignments = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: {
          name: true,
          permissions: {
            select: {
              permission: { select: { action: true, resource: true } },
            },
          },
        },
      },
    },
  });

  const roles = Array.from(new Set(assignments.map((a) => a.role.name)));
  const permissions = Array.from(
    new Set(
      assignments.flatMap((a) =>
        a.role.permissions.map(
          (p) => `${p.permission.action}:${p.permission.resource}`,
        ),
      ),
    ),
  );

  if (roles.includes("SUPER_ADMIN")) permissions.push("*:*");

  return { roles, permissions };
}

async function findUser(identifier: string) {
  const value = identifier.trim();
  const lower = value.toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: value },
        { username: lower },
        { email: lower },
        { email: { startsWith: `${lower}@` } },
      ],
    },
  });
  if (user) return user;

  const emp = await prisma.employee.findFirst({
    where: {
      OR: [{ nationalId: value }, { employeeNumber: value }],
    },
    include: { user: true },
  });

  return emp?.user ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
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

        const ok = await verifyPassword(
          parsed.data.password,
          user.passwordHash,
        );
        if (!ok) return null;

        await prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          .catch(() => {});

        const { roles, permissions } = await getAuthorization(user.id);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          roles,
          permissions,
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
        token.permissions = (user as any).permissions ?? [];
        (token as any).mustChangePassword =
          (user as any).mustChangePassword ?? false;
        (token as any).passwordChanged =
          (user as any).passwordChanged ?? false;
      }

      if (trigger === "update" && token.sub) {
        try {
          const authz = await getAuthorization(token.sub);
          token.roles = authz.roles;
          token.permissions = authz.permissions;
        } catch {
          /* keep stale */
        }
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
        (session.user as any).permissions = token.permissions ?? [];
        (session.user as any).mustChangePassword =
          (token as any).mustChangePassword ?? false;
        (session.user as any).passwordChanged =
          (token as any).passwordChanged ?? false;
      }
      return session;
    },
  },
});
