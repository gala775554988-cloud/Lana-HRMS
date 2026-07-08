import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSaasSuite } from "@/lib/saas/catalog";
import { listSaasRecords } from "@/lib/saas/actions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ suite:string; feature:string }> }) {
  const { suite, feature } = await params; const meta=getSaasSuite(suite); if(!meta||!meta.features.includes(feature as never)) return NextResponse.json({error:"Unknown feature"},{status:404}); const rows=await listSaasRecords(suite,feature,request.nextUrl.searchParams.get("search")||""); return NextResponse.json({success:true,rows});
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ suite:string; feature:string }> }) {
  const { suite, feature } = await params; const meta=getSaasSuite(suite); if(!meta||!meta.features.includes(feature as never)) return NextResponse.json({error:"Unknown feature"},{status:404}); const body=await request.json(); const code=String(body.code||Date.now()); const existing=await prisma.saasPlatformRecord.findFirst({where:{tenantId:null,suite,feature,code}}); const data={suite,feature,code,name:String(body.name||code),status:String(body.status||"ACTIVE"),payload:body.payload||{},metrics:body.metrics||null} as any; const record=existing?await prisma.saasPlatformRecord.update({where:{id:existing.id},data}):await prisma.saasPlatformRecord.create({data}); return NextResponse.json({success:true,record});
}
