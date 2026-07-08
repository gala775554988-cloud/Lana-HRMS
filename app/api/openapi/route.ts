import { NextResponse } from "next/server";
import { ensureOpenApiDocument } from "@/lib/enterprise-erp/actions";

const spec = {
  openapi: "3.1.0",
  info: { title: "Lana Enterprise Public API", version: "v1" },
  paths: {
    "/api/public/v1/{suite}/{feature}": { get: { summary: "List enterprise records" }, post: { summary: "Create enterprise record" } },
    "/api/graphql": { get: { summary: "Describe GraphQL endpoint" }, post: { summary: "Execute GraphQL operation" } },
    "/api/health": { get: { summary: "Health check" } }
  }
};

export async function GET() {
  const document = await ensureOpenApiDocument().catch(() => null);
  return NextResponse.json(document?.spec || spec);
}
