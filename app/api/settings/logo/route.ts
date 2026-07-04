import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setCompanyLogo } from "@/lib/settings";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    await setCompanyLogo(url);
    
    return NextResponse.json({ success: true, url });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save logo" }, { status: 500 });
  }
}
