import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOdooClient, requireIntegrationAccess, testOdooConnection } from "@/lib/integrations/service";
import { decryptSecret } from "@/lib/integrations/security";

export async function POST(request: NextRequest) {
  try {
    await requireIntegrationAccess("manage");
    const { connectionId } = await request.json();
    const { connection, client } = await getOdooClient(connectionId);
    const result = await client.login(connection.database || "", connection.username || "", decryptSecret(connection.secretCipher));
    await prisma.integrationConnection.update({ where: { id: connectionId }, data: { uid: result.uid, sessionId: result.sessionId, status: "CONNECTED", lastTestAt: new Date(), lastError: null } });
    return NextResponse.json({ success: true, result });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}

export async function GET(request: NextRequest) {
  const connectionId = request.nextUrl.searchParams.get("connectionId") || "";
  const result = await testOdooConnection(connectionId);
  return NextResponse.json(result);
}
