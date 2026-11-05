import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { encode } from 'next-auth/jwt';
import { chromium } from '@playwright/test';
const databaseUrl = new URL(process.env.PAYROLL_TEST_DATABASE_URL ?? '');
if (!['localhost','127.0.0.1'].includes(databaseUrl.hostname) || !databaseUrl.pathname.endsWith('_test')) throw new Error('Disposable local *_test database required');
const prisma=new PrismaClient({datasourceUrl:databaseUrl.href});
const secret=await readFile(process.env.PAYROLL_TEST_AUTH_SECRET_FILE ?? '/tmp/lana-payroll-test-key','utf8');
const key=randomUUID();let user,other,employee,run,browser;
try {
 user=await prisma.user.create({data:{username:`browser-${key}`,name:'اختبار الرواتب'}});
 other=await prisma.user.create({data:{username:`other-${key}`}});
 employee=await prisma.employee.create({data:{employeeNumber:`B-${key}`,nationalId:`B-${key}`,firstName:'موظف',lastName:'اختبار',hireDate:new Date(),userId:user.id}});
 run=await prisma.payrollRun.create({data:{name:'راتب اختبار المتصفح',period:`B-${key}`,status:'PAID',paidAt:new Date()}});
 const item=await prisma.payrollItem.create({data:{payrollRunId:run.id,employeeId:employee.id,baseSalary:10000,allowanceTotal:2000,grossPay:12000,deductionTotal:1000,netPay:11000,currency:'SAR',payslipIssuedAt:new Date(),calculationSnapshot:{components:[{code:'BASIC',name:'الراتب الأساسي',kind:'EARNING',amount:10000},{code:'HOUSE',name:'بدل السكن',kind:'EARNING',amount:2000},{code:'LOAN',name:'قسط القرض',kind:'DEDUCTION',amount:1000}]}}});
 await prisma.letterRequest.create({data:{employeeId:employee.id,letterType:'salary',status:'APPROVED'}});
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 async function authenticate(id,roles){const token=await encode({secret,salt:'authjs.session-token',token:{sub:id,name:'Test',roles,sessionVersion:0,passwordChanged:true,mustChangePassword:false},maxAge:600});await context.addCookies([{name:'authjs.session-token',value:token,url:'http://localhost:3200',httpOnly:true,sameSite:'Lax'}]);}
 await authenticate(user.id,['EMPLOYEE']);const page=await context.newPage();
 await page.goto('http://localhost:3200/employee/salary');
 await page.getByRole('heading',{name:'رواتبي وحسابي المالي'}).waitFor();
 await page.getByText('راتب '+run.period,{exact:false}).waitFor();
 const own=await context.request.get(`http://localhost:3200/api/employee/payroll/document?id=${item.id}`);assert.equal(own.status(),200);assert.match(await own.text(),/بدل السكن/);
 await page.goto(`http://localhost:3200/api/employee/payroll/document?id=${item.id}`);
 await page.getByRole('heading',{name:'قسيمة الراتب التفصيلية'}).waitFor();
 const pdf=await page.pdf({path:'/tmp/lana-payslip-validation.pdf',format:'A4',printBackground:true});assert.equal(pdf.subarray(0,4).toString(),'%PDF');assert.ok(pdf.length>5000);
 const cert=await context.request.get(`http://localhost:3200/api/employee/payroll/document?id=${item.id}&kind=certificate&details=0&recipient=Test`);assert.equal(cert.status(),200);assert.doesNotMatch(await cert.text(),/<td>بدل السكن/);
 await authenticate(other.id,['EMPLOYEE']);
 assert.equal((await context.request.get(`http://localhost:3200/api/employee/payroll/document?id=${item.id}`)).status(),404);
 assert.equal((await context.request.get(`http://localhost:3200/api/employee/payslip?id=${item.id}`)).status(),404);
 assert.equal((await context.request.get('http://localhost:3200/api/enterprise/payroll/compensation')).status(),403);
 await authenticate(user.id,['SUPER_ADMIN']);
 await page.goto('http://localhost:3200/payroll-compensation');await page.getByRole('heading',{name:'التعويضات والتأمينات وربط الرواتب'}).waitFor();
 await page.getByRole('heading',{name:'إضافة سياسة GOSI'}).waitFor();
 console.log('PASS: employee dashboard, Arabic payslip rendered to PDF, certificate basic-only, cross-employee 404, employee finance-admin 403, manager settings screen');
} finally {
 if(browser)await browser.close();
 if(run){const ids=await prisma.payrollItem.findMany({where:{payrollRunId:run.id},select:{id:true}});await prisma.auditLog.deleteMany({where:{entity:'payrollItem',entityId:{in:ids.map(item=>item.id)}}});await prisma.payrollRun.delete({where:{id:run.id}});}
 if(employee){await prisma.letterRequest.deleteMany({where:{employeeId:employee.id}});await prisma.employee.delete({where:{id:employee.id}});}
 if(user||other)await prisma.user.deleteMany({where:{id:{in:[user?.id,other?.id].filter(Boolean)}}});
 await prisma.$disconnect();
}
