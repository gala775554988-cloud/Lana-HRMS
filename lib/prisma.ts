import { PrismaClient } from "@prisma/client";

function withServerlessConnectionLimits(url: string | undefined) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connection_limit")) parsed.searchParams.set("connection_limit", "1");
    if (!parsed.searchParams.has("pool_timeout")) parsed.searchParams.set("pool_timeout", "20");
    // Supabase pooler/pgbouncer connections require Prisma's pgbouncer compatibility flag.
    if (/supabase\.com$/i.test(parsed.hostname) || /pooler\.supabase\.com$/i.test(parsed.hostname)) {
      if (!parsed.searchParams.has("pgbouncer")) parsed.searchParams.set("pgbouncer", "true");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const prismaClientSingleton = () => {
  const url = withServerlessConnectionLimits(process.env.DATABASE_URL);
  return new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined;
} & typeof global;

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

globalThis.prismaGlobal = prisma;
