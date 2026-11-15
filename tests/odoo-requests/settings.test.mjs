import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as zod from 'zod';
import {load} from '../workflows/helpers.mjs';
async function setup(){
 let writes=0,query;
 const resource=await load('config/hrms.ts');
 const validation=await load('lib/validations/hrms.ts',{zod});
 const record={id:'private',key:'odoo.requests.record.private',value:{employeeId:'outside',attachments:[{data:'private-bytes'}]},isSecret:true};
 const prisma={user:{findUnique:async()=>({username:'admin'})},appSetting:{findUnique:async()=>record,findMany:async args=>{query=args;return [];},count:async()=>0,update:async()=>{writes++;},delete:async()=>{writes++;},create:async()=>{writes++;}}};
 const actions=await load('lib/hrms/actions.ts',{
  'next/cache':{revalidatePath:()=>{}},'@/lib/cache/memory-cache':{clearMemoryCache:()=>{}},'@/auth':{auth:async()=>({user:{id:'admin',roles:['SUPER_ADMIN'],permissions:['*:*']}})},'@/config/hrms':resource,'@/lib/prisma':{prisma},'@/lib/rbac':{hasPermission:()=>true},
  '@/lib/enterprise/hierarchy':{applyScopedWhere:async(_key,where)=>where,canAccessEmployeeId:async()=>true,getAccessProfile:async()=>({isSuperAdmin:true,roles:['SUPER_ADMIN']}),getHierarchyStore:async()=>({})},
  '@/lib/audit':{writeAuditLog:async()=>{}},'@/lib/validations/hrms':validation,'@/lib/password':{generateTemporaryPassword:()=>'',hashPassword:async()=>''},'@/lib/enterprise/notifications':{notifyRole:async()=>{}},
  '@/lib/employee/salary-profile':{extractSalaryProfile:()=>({})},'@/lib/employee/salary-profile-store':{saveEmployeeSalaryProfile:async()=>{}},'@/lib/enterprise/social-insurance':{syncSocialInsuranceFromPayroll:async()=>{}},'@/lib/auth/password-change-policy':{requirePasswordChange:()=>{}},'@/lib/enterprise/resource-access':{isEnterpriseResourceAllowed:()=>true},'@/lib/enterprise/hospitals':{getEmployeeIdsByHospital:async()=>[]},'@/lib/perf/query-timer':{withQueryTiming:(_name,fn)=>fn()},'@/lib/enterprise/employee-field-access':{getEmployeeFieldAccess:async()=>({}),filterEditableFields:(_access,values)=>values},
 });return {actions,writes:()=>writes,query:()=>query};
}
test('private request snapshots and payloads cannot be read, edited, created or deleted through generic settings CRUD',async()=>{
 const s=await setup();assert.equal(await s.actions.getModuleRecord('settings','private'),null);
 assert.equal((await s.actions.updateModuleRecord({resourceKey:'settings',id:'private',values:{value:'overwrite'}})).success,false);
 assert.equal((await s.actions.deleteModuleRecord('settings','private')).success,false);
 assert.equal((await s.actions.createModuleRecord({resourceKey:'settings',values:{key:'odoo.requests.configuration.v1',value:'malicious'}})).success,false);
 assert.equal(s.writes(),0);
});
test('generic settings queries exclude request snapshots, files and request field sidecars',async()=>{
 const s=await setup();await s.actions.listModuleRecords({resourceKey:'settings'});assert.equal(JSON.stringify(s.query().where.AND[1].NOT.map(item=>item.key.startsWith)),JSON.stringify(['odoo.requests.','request.documents.','request.fields.']));
});
