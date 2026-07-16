import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isLanaDelegate } from "@/lib/enterprise/lana-delegates";

/** Lightweight self-check the chat widget calls to decide whether to show
 * the delegate "crown" badge -- deliberately separate from the admin-only
 * /delegates route, since any signed-in user needs to know their OWN
 * status, not the full list. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const isDelegate = await isLanaDelegate(session.user.id, (session.user.roles as string[]) ?? []);
  return NextResponse.json({ success: true, isDelegate });
}
