import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { encode } from 'next-auth/jwt';
import { chromium } from '@playwright/test';
const database=new URL(process.env.ODOO_MIGRATION_TEST_DATABASE_URL??'');if(!['localhost','127.0.0.1'].includes(database.hostname)||!database.pathname.endsWith('_test'))throw new Error('Disposable local *_test database required');
const prisma=new PrismaClient({datasourceUrl:database.href});const secret=await readFile(process.env.PAYROLL_TEST_AUTH_SECRET_FILE??'/tmp/lana-payroll-test-key','utf8');
const key=randomUUID();let actor,other,employee,otherEmployee,job,run,browser;
try{
 actor=await prisma.user.create({data:{username:`migration-ui-${key}`}});other=await prisma.user.create({data:{username:`migration-ui-other-${key}`}});
 employee=await prisma.employee.create({data:{employeeNumber:`HB-${key}`,nationalId:`HB-${key}`,firstName:'المزامنة',lastName:'اختبار',hireDate:new Date('2020-01-01'),userId:actor.id}});
 otherEmployee=await prisma.employee.create({data:{employeeNumber:`HB-other-${key}`,nationalId:`HB-other-${key}`,firstName:'آخر',lastName:'اختبار',hireDate:new Date('2020-01-01'),userId:other.id}});
 job=await prisma.odooMigrationJob.create({data:{source:key,actorUserId:actor.id,status:'PAUSED',phase:'LOANS',config:{},cursor:100,page:2,processed:100,phaseProcessed:50,phaseTotal:100,imported:90,skipped:10,failed:1}});
 await prisma.odooMigrationError.create({data:{jobId:job.id,entity:'LOANS',externalId:100,code:'LOAN_MISMATCH',message:'رصيد تجريبي يحتاج مراجعة'}});
 run=await prisma.historicalPayrollRun.create({data:{source:key,period:'2025-01',companyOdooId:1}});
 const slip=await prisma.historicalPayslip.create({data:{runId:run.id,source:key,odooPayslipId:1,employeeId:employee.id,state:'done',currency:'SAR',fromDate:new Date('2025-01-01'),toDate:new Date('2025-01-31'),basic:1000,gross:1000,deductions:100,net:900,raw:{},checksum:key,lines:{create:[{externalId:1,code:'BASIC',name:'الراتب الأساسي التاريخي',category:'BASIC',amount:1000,quantity:1,rate:100,total:1000,raw:{}},{externalId:2,code:'DED',name:'خصم تاريخي',category:'DEDUCTION',amount:-100,quantity:1,rate:100,total:-100,raw:{}}]}}});
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:1280,height:900}});
 async function authenticate(user,roles){const token=await encode({secret,salt:'authjs.session-token',token:{sub:user.id,name:'Test',roles,sessionVersion:0,passwordChanged:true,mustChangePassword:false},maxAge:600});await context.addCookies([{name:'authjs.session-token',value:token,url:'http://localhost:3200',httpOnly:true,sameSite:'Lax'}]);}
 await authenticate(actor,['SUPER_ADMIN']);const page=await context.newPage();await page.goto('http://localhost:3200/odoo-migration');await page.getByRole('heading',{name:'مزامنة الموظفين والسلف والرواتب التاريخية'}).waitFor();
 await page.getByRole('button').filter({hasText:'متوقف مؤقتاً'}).first().click();const progress=page.getByRole('progressbar',{name:'تقدم المزامنة'});await progress.waitFor();assert.equal(await progress.getAttribute('aria-valuenow'),'62');await page.getByRole('button',{name:'إعادة المحاولة',exact:true}).waitFor();
 const status=await context.request.get(`http://localhost:3200/api/enterprise/odoo-migration/${job.id}`);assert.equal(status.status(),200);assert.equal(Object.hasOwn((await status.json()).job,'leaseToken'),false);
 await authenticate(actor,['EMPLOYEE']);assert.equal((await context.request.get('http://localhost:3200/api/enterprise/odoo-migration')).status(),403);
 await page.goto('http://localhost:3200/employee/salary');await page.getByRole('heading',{name:/الكشوف التاريخية المستوردة من Odoo/}).waitFor();await page.getByRole('link',{name:'تفاصيل البنود / طباعة'}).waitFor();
 await page.goto(`http://localhost:3200/api/employee/payroll/history/document?id=${slip.id}`);await page.getByRole('heading',{name:'كشف راتب تاريخي من Odoo'}).waitFor();assert.match(await page.textContent('body'),/لا يثبت الصرف/);const pdf=await page.pdf({path:'/tmp/lana-historical-payslip-validation.pdf',format:'A4'});assert.equal(pdf.subarray(0,4).toString(),'%PDF');assert.ok(pdf.length>5000);
 await authenticate(other,['EMPLOYEE']);assert.equal((await context.request.get(`http://localhost:3200/api/employee/payroll/history/document?id=${slip.id}`)).status(),404);
 const anonymous=await browser.newContext();assert.equal((await anonymous.request.get('http://localhost:3200/api/enterprise/odoo-migration')).status(),401);await anonymous.close();
 console.log('PASS: real admin sync UI, durable progress and retry controls, no lease disclosure, 401/403 boundaries, employee historical list and Arabic PDF, cross-employee document denied, approved history not labeled paid');
}finally{
 if(browser)await browser.close();if(job)await prisma.odooMigrationJob.delete({where:{id:job.id}});if(run){await prisma.historicalPayslip.deleteMany({where:{runId:run.id}});await prisma.historicalPayrollRun.delete({where:{id:run.id}});}
 if(employee)await prisma.employee.delete({where:{id:employee.id}});if(otherEmployee)await prisma.employee.delete({where:{id:otherEmployee.id}});await prisma.user.deleteMany({where:{id:{in:[actor?.id,other?.id].filter(Boolean)}}});await prisma.$disconnect();
}
