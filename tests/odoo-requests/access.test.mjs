import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as zod from 'zod';
import { load } from '../workflows/helpers.mjs';
const types = await load('lib/integrations/odoo/requests/types.ts');
const profiles = await load('lib/integrations/odoo/requests/profiles.ts');
const configModule = await load('config/request-routing.ts', {'@/lib/employee/hr-approval-services': { EXTRA_PAYMENT_TYPES: [] }});
const NextResponse = { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) };
async function setup({ admin = false, anonymous = false, linkedEmployee = 'outsider' } = {}) {
  const calls = [], filters = [];
  const link = { id: 'link',employeeId: linkedEmployee,createdBy:'other',syncState:'ERROR',source:'private-source',values:{private:'data'},reference:'LRQ-1' };
  const prisma = {
    employee:{findFirst:async()=>({id:'own'}),findMany:async()=>[{id:'own'}]},
    appSetting:{ findMany:async query=>{filters.push(query);return [{value:link}];}, count:async query=>{filters.push(query);return 1;},findUnique:async()=>null },
  };
  const service={
    discoverModels:async()=>{calls.push('discover');return {models:[]};},
    configureRequests:async()=>{calls.push('configure');return {};},
    createRemoteRequest:async input=>{calls.push(input);return {...link,employeeId:input.employeeId,syncState:'SYNCED'};},
    describeModel:async()=>({fields:{},formFields:[]}),requestConnection:async()=>({}),
    dispatchRequest:async()=>calls.push('retry'),dispatchWorkflowRequest:async()=>calls.push('workflow'),retryPendingRequests:async()=>{},syncOdooRequests:async()=>calls.push('sync'),
  };
  const route=await load('app/api/enterprise/odoo-requests/route.ts',{
    'next/server':{NextRequest:class {},NextResponse},zod,'node:crypto':{createHash,randomBytes},'@/auth':{auth:async()=>anonymous?null:{user:{id:'actor',roles:admin?['HR_MANAGER']:[],permissions:[]}}},
    '@/lib/prisma':{prisma},'@/config/request-routing':configModule,
    '@/lib/enterprise/hierarchy':{getAccessProfile:async()=>({}),applyScopedWhere:async()=>({id:'own'}),canAccessEmployeeId:async id=>id==='own'},
    '@/lib/self-service/request-submitter':{canSubmitForEmployee:async(_actor,id)=>admin&&id==='team'},
    '@/lib/integrations/odoo/requests/store':{configuration:async()=>({enabled:true,models:['approval.request'],mappings:[]}),getLink:async()=>({link})},
    '@/lib/integrations/odoo/requests/relations':{permittedPartnerIds:async()=>[]},'@/lib/integrations/odoo/requests/categories':{categoryDetails:async()=>({})},'@/lib/integrations/odoo/requests/service':service,'@/lib/integrations/odoo/requests/profiles':profiles,'@/lib/integrations/odoo/requests/types':types,
  });
  const post=body=>route.POST({headers:new Headers(),json:async()=>body,url:'https://lana.test/api/enterprise/odoo-requests'});
  const get=query=>route.GET({nextUrl:{searchParams:new URLSearchParams(query)}});
  return {post,get,calls,filters};
}
test('anonymous calls and non-administrator configuration/discovery are rejected before remote access',async()=>{
  const anon=await setup({anonymous:true});assert.equal((await anon.get({})).status,401);assert.equal((await anon.post({action:'sync'})).status,401);
  const employee=await setup();for(const action of ['discover','configure','sync','webhook','category-options','leave-options'])assert.equal((await employee.post({action})).status,403);assert.deepEqual(employee.calls,[]);
});
test('new requests use session ownership; on-behalf submissions require scoped permission',async()=>{
  const s=await setup();const body={action:'submit',model:'approval.request',values:{name:'Test'},idempotencyKey:'11111111-1111-4111-8111-111111111111'};
  assert.equal((await s.post(body)).status,201);assert.equal(s.calls[0].employeeId,'own');
  assert.equal((await s.post({...body,employeeId:'outsider'})).status,403);
  const admin=await setup({admin:true});assert.equal((await admin.post({...body,employeeId:'team'})).status,201);assert.equal((await admin.post({...body,employeeId:'outsider'})).status,403);
});
test('list queries are intersected with employee scope and never serialize submission payloads',async()=>{
  const s=await setup();const response=await s.get({});assert.equal(response.status,200);
  assert.deepEqual(s.filters[0].where.AND[1].OR.map(item=>item.value.equals),['own']);
  assert.equal(response.data.rows[0].values,undefined);assert.equal(response.data.rows[0].source,undefined);
});
test('retry/refresh cannot read or dispatch another employee request',async()=>{
  const s=await setup();assert.equal((await s.post({action:'retry',id:'link'})).status,404);assert.equal((await s.post({action:'refresh',id:'link'})).status,404);assert.deepEqual(s.calls,[]);
});
test('authenticated readers still cannot dispatch another requester’s failed write',async()=>{
  const s=await setup({linkedEmployee:'own'});assert.equal((await s.post({action:'retry',id:'link'})).status,403);
});
test('unconfigured model names cannot be used as an arbitrary Odoo read proxy',async()=>{
  const s=await setup();assert.equal((await s.get({action:'describe',model:'res.users'})).status,400);assert.deepEqual(s.calls,[]);
});
async function webhook() {
  const secret='a'.repeat(64), expected=createHash('sha256').update(secret).digest('hex'), calls=[];
  const prisma={appSetting:{findUnique:async()=>({value:{hash:expected}}),upsert:async()=>{}}};
  const route=await load('app/api/integrations/webhooks/odoo-requests/route.ts',{
    'node:crypto':{createHash,timingSafeEqual},'node:buffer':{Buffer},'next/server':{NextResponse},'@/lib/prisma':{prisma},
    '@/lib/integrations/odoo/requests/types':types,'@/lib/integrations/odoo/requests/service':{approvalRequestForApprover:async id=>({model:'approval.request',id:id+1000}),syncOdooRequests:async target=>{calls.push(target);return {enabled:true,imported:1,errors:[]};}},
  });
  return {calls,post:(body,token=secret)=>route.POST({headers:new Headers({authorization:`Bearer ${token}`}),text:async()=>JSON.stringify(body)})};
}
test('webhooks require their own secret and re-read Odoo instead of trusting posted decisions',async()=>{
  const s=await webhook();assert.equal((await s.post({model:'approval.request',id:123},'bad')).status,401);assert.equal(s.calls.length,0);
  assert.equal((await s.post({_model:'approval.request',_id:123,status:'approved',employeeId:'outsider',amount:100000})).status,200);
  assert.equal(s.calls[0].model,'approval.request');assert.equal(s.calls[0].id,123);assert.equal(s.calls[0].status,undefined);
  assert.equal((await s.post({model:'approval.request',id:'123'})).status,400);
  assert.equal((await s.post({_model:'approval.approver',_id:77,request_id:99999})).status,200);assert.equal(s.calls.at(-1).model,'approval.request');assert.equal(s.calls.at(-1).id,1077);
});
