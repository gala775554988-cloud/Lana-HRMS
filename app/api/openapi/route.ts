import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const spec = {
  openapi: "3.1.0",
  info: { title: "Lana Enterprise Public API", version: "v1" },
  paths: {
    "/api/health": { get: { summary: "Health check" } },
    "/api/global-search": { get: { summary: "Global search" }, post: { summary: "Index a search document" } }
  }
};

export async function GET() {
  const document = await prisma.openApiDocument.findFirst({ where: { version: "v1", title: "Lana Enterprise Public API" } }).catch(() => null);
  return NextResponse.json(document?.spec || spec);
}
