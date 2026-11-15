import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getAccessProfile, canAccessEmployeeId } from '@/lib/enterprise/hierarchy';
import { configuration, getLink } from '@/lib/integrations/odoo/requests/store';
import { describeModel, requestConnection } from '@/lib/integrations/odoo/requests/service';
import { documentField } from '@/lib/integrations/odoo/requests/documents';
import { positiveId } from '@/lib/integrations/odoo/requests/profiles';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
 const session=await auth();if(!session?.user?.id)return NextResponse.json({success:false},{status:401});
 try {
  const id=request.nextUrl.searchParams.get('id')??'',documentId=positiveId(request.nextUrl.searchParams.get('documentId'));
  const item=await getLink(id),profile=await getAccessProfile(session.user.id,session.user.roles??[]);
  if(!item?.link.employeeId||!item.link.remoteId||!documentId||!await canAccessEmployeeId(item.link.employeeId,profile))return NextResponse.json({success:false},{status:404});
  const config=await configuration();if(config.source!==item.link.source||!config.models.includes(item.link.model))return NextResponse.json({success:false},{status:404});
  const {client}=await requestConnection(config),descriptor=await describeModel(client,item.link.model);
  const employee=await prisma.employee.findUnique({where:{id:item.link.employeeId},select:{odooId:true}});if(!employee?.odooId)return NextResponse.json({success:false},{status:404});
  const [remoteEmployee]=await client.read('hr.employee',[employee.odooId],['id','user_id']);
  const field=documentField(descriptor.fields,false),[remote]=await client.read(item.link.model,[item.link.remoteId],[descriptor.profile.owner,...(field?[field]:[])]);
  const expected=descriptor.profile.ownerKind==='employee'?employee.odooId:positiveId(remoteEmployee?.user_id);
  if(descriptor.profile.ownerKind==='user'&&expected){const matches=await client.search_read('hr.employee',[['user_id','=',expected]],['id'],{limit:2,context:{active_test:false}});if(matches.length!==1||Number(matches[0].id)!==employee.odooId)return NextResponse.json({success:false},{status:404});}
  if(!remote||positiveId(remote[descriptor.profile.owner])!==expected)return NextResponse.json({success:false},{status:404});
  const [meta]=await client.read('ir.attachment',[documentId],['name','res_model','res_id','mimetype','file_size']);
  const attached=meta?.res_model===item.link.model&&Number(meta.res_id)===item.link.remoteId;
  const linked=field&&Array.isArray(remote[field])&&(remote[field] as number[]).includes(documentId);
  if(!meta||(!attached&&!linked)||Number(meta.file_size)>5000000)return NextResponse.json({success:false},{status:404});
  const [file]=await client.read('ir.attachment',[documentId],['datas']);if(typeof file?.datas!=='string'||file.datas.length>7000000)return NextResponse.json({success:false},{status:404});
  const bytes=Buffer.from(file.datas,'base64'),name=String(meta.name??'document').replace(/[\\/\x00-\x1f]/g,'_').slice(0,150);
  return new NextResponse(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
 }catch{return NextResponse.json({success:false,message:'تعذر تنزيل المستند أو التحقق من ارتباطه بالطلب'},{status:400});}
}
