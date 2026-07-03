import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/password";

async function getAuthorization(userId: string) {
  const assignments = await prisma.userRole.findMany({
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

  const roles = assignments.map((assignment) => assignment.role.name);
  const permissions = assignments.flatMap((assignment) =>
    assignment.role.permissions.map(
      ({ permission }) => `${permission.action}:${permission.resource}`
    )
  );

  return {
    roles: Array.from(new Set(roles)),
    permissions: Array.from(new Set(permissions))
  };
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email }
        });

        if (!user?.passwordHash || !user.isActive || !user.emailVerified) {
          return null;
        }

        const passwordValid = await verifyPassword(
          parsed.data.password,
          user.passwordHash
        );

        if (!passwordValid) {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      if (token.sub) {
        const authorization = await getAuthorization(token.sub);
        token.roles = authorization.roles;
        token.permissions = authorization.permissions;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.roles = token.roles ?? [];
        session.user.permissions = token.permissions ?? [];
      }

      return session;
    },
    authorized({ auth }) {
      return Boolean(auth?.user);
    }
  }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
