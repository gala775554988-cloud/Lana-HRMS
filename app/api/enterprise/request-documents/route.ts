import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getAccessProfile, buildEmployeeScopeWhere } from '@/lib/enterprise/hierarchy';
import type { RequestDocument } from '@/lib/integrations/odoo/requests/documents';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const session=await auth();if(!session?.user?.id)return NextResponse.json({success:false},{status:401});
 const id=request.nextUrl.searchParams.get('workflowId')??'',hash=request.nextUrl.searchParams.get('hash')??'';
 if(!/^[a-f0-9]{64}$/.test(hash))return NextResponse.json({success:false},{status:404});
 const scope=await buildEmployeeScopeWhere(await getAccessProfile(session.user.id,session.user.roles??[]));
 const workflow=await prisma.workflowInstance.findFirst({where:{id,OR:[{employee:scope},{employee:{userId:session.user.id}},{steps:{some:{approverUserId:session.user.id}}}]},select:{entityId:true}});
 if(!workflow)return NextResponse.json({success:false},{status:404});
 const record=await prisma.appSetting.findUnique({where:{key:`request.documents.${workflow.entityId}`},select:{value:true}});
 const document=(record?.value as unknown as RequestDocument[]|undefined)?.find(file=>file.hash===hash);
 if(!document?.data||document.data.length>2000000)return NextResponse.json({success:false},{status:404});
 const name=document.name.replace(/[\\/\x00-\x1f]/g,'_').slice(0,150);
 return new NextResponse(Buffer.from(document.data,'base64'),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
}
