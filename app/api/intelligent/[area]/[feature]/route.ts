import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getIntelligentArea } from "@/lib/intelligent/catalog";
import { listIntelligentRecords } from "@/lib/intelligent/actions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ area:string; feature:string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {area,feature}=await params; const meta=getIntelligentArea(area); if(!meta||!meta.features.includes(feature as never)) return NextResponse.json({error:"Unknown feature"},{status:404}); const rows=await listIntelligentRecords(area,feature,request.nextUrl.searchParams.get("search")||""); return NextResponse.json({success:true,rows});
}
