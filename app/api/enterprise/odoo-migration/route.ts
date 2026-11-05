import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canApprovePayroll } from "@/lib/enterprise/payroll-permissions";
import { migrationConfigSchema, MigrationRecordError } from "@/lib/integrations/odoo/migration/mapping";
import { createMigration, migrationStatus } from "@/lib/integrations/odoo/migration/worker";
export const maxDuration=300;
export async function GET(){const session=await auth();if(!session?.user?.id)return NextResponse.json({success:false},{status:401});if(!canApprovePayroll(session))return NextResponse.json({success:false},{status:403});const jobs=await prisma.odooMigrationJob.findMany({orderBy:{createdAt:"desc"},take:20,select:{id:true,status:true,phase:true,processed:true,failed:true,createdAt:true}});return NextResponse.json({success:true,jobs});}
export async function POST(request:Request){const session=await auth();if(!session?.user?.id)return NextResponse.json({success:false},{status:401});if(!canApprovePayroll(session))return NextResponse.json({success:false},{status:403});try{const config=migrationConfigSchema.parse(await request.json());const job=await createMigration(config,session.user.id);return NextResponse.json({success:true,job:await migrationStatus(job.id)},{status:201});}catch(error){return NextResponse.json({success:false,message:error instanceof MigrationRecordError?error.message:"تعذر بدء المزامنة؛ راجع الاتصال وخريطة الحقول والفترة"},{status:409});}}
