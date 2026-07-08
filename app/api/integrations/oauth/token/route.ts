import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/integrations/security";

export async function POST(request: NextRequest) {
  const body = await request.formData().catch(() => null);
  const json = body ? null : await request.json().catch(() => ({}));
  const clientId = String(body?.get("client_id") ?? json?.client_id ?? "");
  const clientSecret = String(body?.get("client_secret") ?? json?.client_secret ?? "");
  const client = await prisma.integrationOAuthClient.findUnique({ where: { clientId } });
  if (!client || !client.isActive || decryptSecret(client.clientSecretCipher) !== clientSecret) return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  const token = crypto.randomBytes(32).toString("base64url");
  return NextResponse.json({ access_token: token, token_type: "Bearer", expires_in: 3600, scope: Array.isArray(client.scopes) ? client.scopes.join(" ") : "" });
}
