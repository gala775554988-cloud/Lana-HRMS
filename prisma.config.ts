import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  }
  // Note: datasource block removed to prevent PrismaConfigEnvError on Vercel during `prisma generate`
  // DATABASE_URL is only needed for migrate/db commands. Schema.prisma declares it for runtime.
});
