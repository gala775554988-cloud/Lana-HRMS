import {test,expect,devices} from "@playwright/test";
import {login} from "./helpers";
test.describe("MADAR isolated browser acceptance",()=>{
 test.setTimeout(180000);
 test.beforeEach(()=>{if(process.env.CI!=="true"||!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.SMOKE_BASE_URL??""))throw Error("This test must run only in disposable local CI");});
 const account=(name:string)=>({identifier:name,password:process.env.MADAR_SMOKE_PASSWORD??""});
 test("admin desktop assignment, mobile employee checklist, reviewer approval and isolation",async({browser,baseURL})=>{
  const adminContext=await browser.newContext({baseURL,viewport:{width:1440,height:900}});
  const workerContext=await browser.newContext({...devices["iPhone 13"],baseURL});
  const otherContext=await browser.newContext({baseURL});
  try{
   const admin=await adminContext.newPage(),worker=await workerContext.newPage(),other=await otherContext.newPage();
   await worker.addInitScript(()=>{localStorage.setItem("lana_mobile_secure_device_uuid","mobile-session-fallback");});
   await login(admin,account("madar-ci-admin"));
   await expect(admin).toHaveURL(/\/dashboard(?:\?|$)/,{timeout:20000});
   await admin.goto("/work-tasks");
   await expect(admin.getByRole("heading",{name:"إدارة المهام والتكليفات",exact:true})).toBeVisible({timeout:30000});
   const options=await (await admin.request.get("/api/enterprise/work-tasks?options=true")).json();
   const assigned=options.employees.find((e:{employeeNumber:string})=>e.employeeNumber==="madar-ci-worker");expect(assigned).toBeTruthy();
   const title="CI browser task "+Date.now();
   const form=admin.locator("form").filter({has:admin.locator('input[name="title"]')});
   await form.locator('input[name="title"]').fill(title);
   await form.locator('textarea[name="description"]').fill("Test only");
   await form.locator('select[name="employeeIds"]').selectOption(assigned.id);
   await form.locator('input[name="dueAt"]').fill(new Date(Date.now()+3*86400000).toISOString().slice(0,16));
   await form.locator('textarea[name="checklist"]').fill("CI checklist");
   await form.getByRole("button",{name:"إنشاء التكليف"}).click();
   await expect(admin.getByText(title,{exact:true})).toBeVisible({timeout:30000});
   const api=await (await admin.request.get("/api/enterprise/work-tasks")).json();
   const task=api.tasks.find((x:{title:string})=>x.title===title);expect(task).toBeTruthy();
   await login(other,account("madar-ci-other"));
   const isolated=await (await other.request.get("/api/enterprise/work-tasks")).json();expect(isolated.tasks.some((x:{id:string})=>x.id===task.id)).toBe(false);
   const denied=await other.request.patch("/api/enterprise/work-tasks?id="+task.id,{data:{action:"move",status:"IN_PROGRESS",version:task.updatedAt}});expect(denied.status()).toBe(409);
   await login(worker,account("madar-ci-worker"));
   await worker.goto("/employee/tasks");
   await expect(worker.getByRole("heading",{name:"مهامي المركزية"})).toBeVisible({timeout:30000});
   const card=worker.locator("article").filter({has:worker.getByRole("heading",{name:title,exact:true})});
   await card.getByRole("button",{name:"بدء",exact:true}).click();
   await expect(card.getByRole("checkbox",{name:"CI checklist"})).toBeEnabled();
   await card.getByRole("checkbox",{name:"CI checklist"}).check();
   await expect(card.getByRole("button",{name:"إرسال للمراجعة"})).toBeEnabled();
   await card.getByRole("button",{name:"إرسال للمراجعة"}).click();
   await expect.poll(async()=>{const d=await (await worker.request.get("/api/enterprise/work-tasks?mine=true")).json();return d.tasks.find((t:{id:string})=>t.id===task.id)?.status;}).toBe("REVIEW");
   const reviewing=await (await worker.request.get("/api/enterprise/work-tasks?mine=true")).json();
   const version=reviewing.tasks.find((t:{id:string})=>t.id===task.id).updatedAt;
   expect((await worker.request.patch("/api/enterprise/work-tasks?id="+task.id,{data:{action:"move",status:"COMPLETED",version}})).status()).toBe(409);
   await worker.getByRole("button",{name:"التقويم",exact:true}).click();
   await expect(worker.getByLabel("عرض التقويم")).toBeVisible();
   await worker.getByLabel("عرض التقويم").selectOption("week");
   expect(await worker.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2)).toBe(true);
   await admin.reload();const reviewCard=admin.locator("article").filter({has:admin.getByRole("heading",{name:title,exact:true})});
   await reviewCard.getByRole("button",{name:"اعتماد",exact:true}).click();
   await expect.poll(async()=>{const d=await (await admin.request.get("/api/enterprise/work-tasks")).json();return d.tasks.find((t:{id:string})=>t.id===task.id)?.status;}).toBe("COMPLETED");
  }finally{await Promise.all([adminContext.close(),workerContext.close(),otherContext.close()]);}
 });
 test("machine auth reaches exact scheduled routes and recurrence is not duplicated",async({request})=>{
  for(const path of ["/api/integrations/odoo/cron-repair","/api/integrations/odoo/cron-reconcile","/api/integrations/automation/cron-alerts"]){expect((await request.get(path)).status()).toBe(401);}
  const secret=process.env.CRON_SECRET;if(!secret)throw Error("Missing CI-only cron secret");
  const options={headers:{Authorization:"Bearer "+secret}};
  const first=await request.get("/api/integrations/automation/cron-alerts",options);expect(first.status()).toBe(200);const firstData=await first.json();expect(firstData.tasks.created).toBe(1);
  const second=await request.get("/api/integrations/automation/cron-alerts",options);expect(second.status()).toBe(200);expect((await second.json()).tasks.created).toBe(0);
 });
});
