import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),artifacts='/tmp/odoo-requests-preview';
await mkdir(artifacts,{recursive:true});
const bundle=await build({absWorkingDir:root,entryPoints:['tests/odoo-requests/browser-fixture.tsx'],bundle:true,write:false,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture-links',setup(builder){builder.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"import React from 'react';export default function Link(props){return React.createElement('a',props);}",resolveDir:root}));}}]});
const css=(await postcss([tailwindcss(path.join(root,'tailwind.config.ts'))]).process(await readFile(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')})).css;
const server=createServer((request,response)=>{const url=new URL(request.url,'http://localhost');if(url.pathname==='/bundle.js'){response.setHeader('Content-Type','text/javascript');response.end(bundle.outputFiles[0].text);}else if(url.pathname==='/styles.css'){response.setHeader('Content-Type','text/css');response.end(css);}else{response.setHeader('Content-Type','text/html; charset=utf-8');response.end('<!doctype html><html lang="ar" dir="rtl"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
const serviceCodes=['PROJECT_PAYMENT','LEAVE_SETTLEMENT','EOS_SETTLEMENT','CUSTODY_PAYMENT','BSF_PAYMENT','OVERTIME','PAYROLL_PAYMENT','LOAN','PETTY_CASH'];
const serviceLabels=['صرف المشاريع','تصفية الإجازة','تصفية نهاية الخدمة','صرف عهدة','طلب صرف BSF','صرف الأوفر تايم','صرف الرواتب','صرف سلفة','صرف نثريات'];
const options=serviceLabels.map((label,index)=>({id:10+index,label}));
const descriptor={profile:{model:'approval.request',label:'الموافقات والطلبات العامة',owner:'request_owner_id',state:'request_status',reference:'name',writable:true},canCreate:true,missing:[],defaults:{},formFields:['name','category_id','reason','amount'],fields:{name:{type:'char',string:'عنوان الطلب',required:true},category_id:{type:'many2one',relation:'approval.category',string:'تصنيف الطلب',required:true},reason:{type:'text',string:'تفاصيل الطلب'},amount:{type:'monetary',string:'المبلغ'}}};
const now='2026-11-15T10:00:00.000Z';
const baseRow={id:'pending',reference:'LRQ-11111111-1111-4111-8111-111111111111',source:'redacted',model:'approval.request',employeeId:'employee',employeeName:'موظف تجريبي لاختبار المركز',employeeNumber:'TEST-001',title:'طلب خطاب تعريف موجّه للجهة المستفيدة',origin:'LANA',remoteId:1,remoteReference:'APP/2026/001',remoteState:'pending',bucket:'PENDING',syncState:'SYNCED',attempts:1,createdAt:now,updatedAt:now,lastSyncedAt:now,remoteUrl:'https://odoo.example.test/web#id=1',fields:[{label:'التفاصيل',value:'إصدار خطاب تعريف بالراتب والبدلات'}],approvers:[{name:'المدير المباشر',state:'approved'},{name:'الموارد البشرية',state:'pending'}],events:[{at:now,label:'حُفظ الطلب في لانا'},{at:now,label:'وصل الطلب إلى أودو'},{at:now,label:'وافق المدير، وبانتظار الموارد البشرية'}]};
let rows=[baseRow,{...baseRow,id:'rejected',title:'طلب إجازة تمت مراجعته',origin:'ODOO',bucket:'REJECTED',remoteState:'refused',remoteReference:'APP/2026/002'}, {...baseRow,id:'done',title:'طلب مكتمل ومحفوظ في الأرشيف',origin:'ODOO',bucket:'COMPLETED',remoteState:'done',remoteReference:'APP/2026/003'}, {...baseRow,id:'uncertain',title:'طلب سلفة بانتظار تأكيد الوصول',bucket:'DRAFT',syncState:'UNCERTAIN',remoteId:undefined,remoteReference:undefined,error:'انقطع الرد؛ يُفحص المرجع قبل إعادة الإرسال.'}];
let config={enabled:true,models:['approval.request'],mappings:[{type:'LETTER',model:'approval.request',categoryId:10,defaults:{}},...serviceCodes.map((type,index)=>({type,model:'approval.request',categoryId:10+index,defaults:{}}))]},submitted;
let automaticReady=false,automaticCalls=0;
try{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),body=route.request().method()==='POST'?route.request().postDataJSON():null;
  let data;
  if(body?.action==='auto-setup'){automaticReady=true;automaticCalls++;data={success:true,enabled:true,configured:true,issues:[]};}
  else if(body?.action==='discover')data={success:true,models:[descriptor],unavailable:[]};
  else if(body?.action==='category-options')data={success:true,options};
  else if(body?.action==='leave-options')data={success:true,local:[],options:[]};
  else if(body?.action==='configure'){config=body.config;data={success:true,config};}
  else if(body?.action==='submit'){submitted=body;const row={...baseRow,id:'new',title:body.values.name,remoteReference:'APP/2026/004'};rows=[row,...rows];data={success:true,row};}
  else if(body?.action==='sync')data={success:true,result:{imported:2,errors:[]}};
  else if(body?.action==='refresh'||body?.action==='retry')data={success:true,row:rows.find(row=>row.id===body.id)};
  else if(url.searchParams.get('action')==='category')data={success:true,category:{id:10,label:'خدمات الموارد البشرية',sequenced:true,minimum:2,requiredFields:[],optionalFields:[],requiresDocuments:false,unsupported:[],approvers:[{name:'المدير المباشر',sequence:1,required:true},{name:'الموارد البشرية',sequence:2,required:true}]}};
  else if(url.searchParams.get('action')==='describe')data={success:true,descriptor};
  else if(url.searchParams.get('action')==='options')data={success:true,options};
  else{const bucket=url.searchParams.get('bucket'),attention=url.searchParams.get('sync')==='attention';const sourceRows=rows.filter(row=>row.origin===url.searchParams.get('origin'));const filtered=sourceRows.filter(row=>(!bucket||row.bucket===bucket)&&(!attention||row.syncState==='UNCERTAIN'));data={success:true,rows:filtered,total:filtered.length,page:1,counts:Object.fromEntries(['PENDING','APPROVED','COMPLETED','REJECTED','CANCELLED','DRAFT','UNKNOWN'].map(state=>[state,sourceRows.filter(row=>row.bucket===state).length])),canConfigure:!page.url().includes('employee=1'),config:page.url().includes('automatic=1')&&!automaticReady?{enabled:false,models:[],mappings:[]}:config,realtimeEnabled:false,latestSync:{at:now,imported:3,errors:[]},requestTypes:[{code:'LETTER',label:'خطابات'},{code:'LOAN',label:'السلف'},{code:'LEAVE',label:'الإجازات'}]};}
  await route.fulfill({json:data});
 });
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:920});await page.goto(base);await page.getByRole('heading',{name:'الطلبات المرسلة لأودو'}).waitFor();await page.getByText(baseRow.title,{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`main overflow ${width}`);
  if(width<640)assert.ok((await page.getByPlaceholder('مرجع لانا، رقم أودو، الاسم…').boundingBox()).width>width-100,'mobile search remains usable');
  await page.screenshot({path:`${artifacts}/center-${width}.png`,fullPage:true});
  assert.equal(await page.getByText('طلب إجازة تمت مراجعته',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'ضبط الربط',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'مزامنة الآن',exact:true}).count(),0);
  await page.goto(`${base}/?view=sync`);await page.getByText('طلب إجازة تمت مراجعته',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'رفع طلب لأودو',exact:true}).count(),0);
  assert.equal(await page.getByRole('region',{name:'خدمات موافقات الموارد البشرية'}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`sync overflow ${width}`);
  await page.getByRole('button',{name:/المرفوضة|مرفوض/}).first().click();await page.getByText('طلب إجازة تمت مراجعته',{exact:true}).waitFor();
  await page.getByText(baseRow.title,{exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.getByText(baseRow.title,{exact:true}).count(),0);
  await page.goto(base);await page.getByText(baseRow.title,{exact:true}).waitFor();
  await page.getByRole('button',{name:'تفاصيل ومسار الطلب',exact:true}).first().click();await page.getByRole('dialog').getByText('المدير المباشر',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`detail overflow ${width}`);
  await page.screenshot({path:`${artifacts}/detail-${width}.png`,fullPage:true});
  await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();
  await page.getByRole('button',{name:'رفع طلب لأودو',exact:true}).click();await page.getByLabel('عنوان الطلب *',{exact:true}).fill('طلب جديد لاختبار الإرسال');await page.getByLabel('تصنيف الطلب *',{exact:true}).selectOption('10');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`form overflow ${width}`);
  await page.screenshot({path:`${artifacts}/form-${width}.png`,fullPage:true});await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();
 }
 await page.getByRole('button',{name:/صرف الرواتب/}).first().click();await page.getByLabel('عنوان الطلب *',{exact:true}).waitFor();assert.equal(await page.getByLabel('عنوان الطلب *',{exact:true}).inputValue(),'صرف الرواتب');assert.equal(await page.getByLabel('تصنيف الطلب *',{exact:true}).inputValue(),'16');await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();
 await page.getByRole('button',{name:'رفع طلب لأودو',exact:true}).click();await page.getByLabel('عنوان الطلب *',{exact:true}).fill('طلب اختبار الإرسال الفوري');await page.getByLabel('تصنيف الطلب *',{exact:true}).selectOption('10');await page.locator('input[type=file]').setInputFiles({name:'receipt.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 synthetic browser test')});await page.getByRole('button',{name:'حفظ وإرسال إلى أودو',exact:true}).click();await page.getByRole('dialog').getByText('APP/2026/004',{exact:true}).waitFor();
 assert.match(submitted.idempotencyKey,/^[0-9a-f-]{36}$/);assert.equal(submitted.values.request_owner_id,undefined);assert.equal(submitted.attachments[0].name,'receipt.pdf');
 await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();
 await page.goto(`${base}/?view=sync`);await page.getByRole('button',{name:'ضبط الربط',exact:true}).click();await page.getByRole('button',{name:'استكشاف التطبيقات والحقول الفعلية',exact:true}).click();await page.getByRole('heading',{name:'٣. ربط خدمات لانا بتصنيفات الموافقات في أودو'}).waitFor();await page.getByLabel('السلف',{exact:true}).selectOption('10');await page.getByRole('button',{name:'حفظ الربط الموثّق'}).click();assert.ok(config.mappings.some(item=>item.type==='LOAN'&&item.categoryId===10));
 await page.goto(`${base}/?employee=1`);await page.getByRole('heading',{name:'الطلبات المرسلة لأودو'}).waitFor();await page.getByText(baseRow.title,{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'ضبط الربط',exact:true}).count(),0);
 await page.getByRole('button',{name:'رفع طلب لأودو',exact:true}).click();await page.getByLabel('عنوان الطلب *',{exact:true}).waitFor();assert.equal(await page.getByText(/الموظف المستفيد/).count(),0);
 await page.goto(`${base}/?automatic=1&employee=1`);await page.getByRole('button',{name:'رفع طلب لأودو',exact:true}).waitFor();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('رفع طلب لأودو'))?.disabled);assert.equal(automaticCalls,1);await page.getByRole('button',{name:'رفع طلب لأودو',exact:true}).click();await page.getByLabel('عنوان الطلب *',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log(`PASS: five viewport sizes, cards and filters, detail/approver timeline, forms, immediate submission reference, configuration and employee view. Screenshots: ${artifacts}`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
