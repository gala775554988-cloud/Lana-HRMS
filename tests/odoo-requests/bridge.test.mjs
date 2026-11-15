import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { load } from '../workflows/helpers.mjs';
const types = await load('lib/integrations/odoo/requests/types.ts');
const profiles = await load('lib/integrations/odoo/requests/profiles.ts');
const categories = await load('lib/integrations/odoo/requests/categories.ts', {'./profiles':profiles});
const documents = await load('lib/integrations/odoo/requests/documents.ts', {'node:buffer':{Buffer},'node:crypto':{createHash}});
const SOURCE = createHash('sha256').update('https://odoo.test/db').digest('hex');
class OdooIntegrationError extends Error { constructor(message, details) { super(message); this.details = details; this.code = 'ODOO_RPC_REQUEST_ERROR'; } }
const metadata = {
  id: { type: 'integer', readonly: true }, name: { type: 'char', string: 'عنوان الطلب', required: true },
  request_owner_id: { type: 'many2one', relation: 'res.users', required: true },
  request_status: { type: 'selection', readonly: true, selection: [['new','جديد'],['pending','بانتظار القرار'],['approved','معتمد'],['refused','مرفوض']] },
  write_date: { type: 'datetime', readonly: true }, create_date: { type: 'datetime', readonly: true },
  category_id: { type: 'many2one', relation: 'approval.category', required: true }, reason: { type: 'html' }, amount: { type: 'monetary' },
};
async function setup({ failure, submitFailure, config = {}, fields = metadata, fixedClock = false } = {}) {
  const settings = new Map(), remote = new Map(), counters = { creates: 0, submits: 0, mirror: [], audits: [], searches: [], writes: [] };
  let clock = 0, nextRemote = 100;
  const save = (key, value) => { const row = { id: key, key, value: structuredClone(value), updatedAt: new Date(100000 + (fixedClock ? 0 : ++clock)) }; settings.set(key, row); return structuredClone(row); };
  save(types.CONFIG_KEY, { enabled: true, source: SOURCE, models: ['approval.request'], mappings: [{ type: 'LETTER', model: 'approval.request', categoryId: 10, defaults: {} }], ...config });
  save('odoo.migration.employeeSource', SOURCE);
  const jsonMatches = (row, filter) => {
    if (!filter) return true;
    if (filter.AND) return filter.AND.every(f => jsonMatches(row,f));
    if (filter.OR) return filter.OR.some(f => jsonMatches(row,f));
    if (filter.key && (typeof filter.key === 'string' ? row.key !== filter.key : filter.key.startsWith && !row.key.startsWith(filter.key.startsWith))) return false;
    if (filter.updatedAt && row.updatedAt.getTime() !== filter.updatedAt.getTime()) return false;
    if (filter.value) { const v = filter.value.path?.reduce((value,key) => value?.[key],row.value); if (filter.value.equals !== undefined && v !== filter.value.equals) return false; if (filter.value.lte !== undefined && !(v <= filter.value.lte)) return false; }
    return true;
  };
  const prisma = {
    appSetting: {
      findUnique: async ({where}) => structuredClone(settings.get(where.key) ?? null),
      findMany: async ({where,take} = {}) => [...settings.values()].filter(row => jsonMatches(row,where)).slice(0,take ?? Infinity).map(item=>structuredClone(item)),
      create: async ({data}) => { if (settings.has(data.key)) throw Object.assign(new Error('duplicate'),{code:'P2002'});return save(data.key,data.value); },
      upsert: async ({where,create,update}) => settings.has(where.key) ? update.value ? save(where.key,update.value) : structuredClone(settings.get(where.key)) : save(where.key,create.value),
      updateMany: async ({where,data}) => { const row = settings.get(where.key); if (!row || !jsonMatches(row,where)) return {count:0}; save(where.key,data.value);return {count:1}; },
    },
    employee: {
      findUnique: async () => ({odooId: 5}),
      findUniqueOrThrow: async () => ({firstName:'Test',lastName:'Employee',employeeNumber:'E-5',userId:'owner'}),
      findMany: async () => [{id:'employee',odooId:5,firstName:'Test',lastName:'Employee',employeeNumber:'E-5'}],
    },
    workflowInstance: { findUnique: async () => ({id:'wf',type:'LETTER',employeeId:'employee',entityId:'letter'}), updateMany: async input => {counters.mirror.push(input);return {count:1};} },
    workflowStep: { updateMany: async input => { counters.writes.push(input);return {count:1}; } },
    letterRequest: {findUnique: async () => ({purpose:'Salary letter'})},
    leaveRequest: {findUnique: async () => ({leaveTypeId:'local-leave'})},
    leaveType: {findMany: async () => []},
    auditLog: {create: async ({data}) => {counters.audits.push(data);return data;}},
  };
  let transactions = Promise.resolve();
  prisma.$transaction = fn => { const result = transactions.then(() => fn(prisma));transactions = result.catch(()=>{});return result; };
  class OdooClient {
    getConfig() { return {url:'https://odoo.test',database:'db',username:'service',password:'hidden'}; }
    async fieldsGet() {return fields;}
    async execute_kw(model, method, args) {
      if (method==='default_get') return {};
      if (method==='action_confirm') {counters.submits++;remote.get(args[0][0]).request_status='pending';if(submitFailure) throw new Error('response lost');return true;}
      throw new Error(`Unexpected ${model}.${method}`);
    }
    async create(model, values) {
      counters.creates++;
      assert.equal(values.request_owner_id, 50);
      if (failure==='rejected') throw new OdooIntegrationError('required field', {code:200,message:'Odoo Server Error',data:{name:'odoo.exceptions.ValidationError'}});
      const id=nextRemote++;
      if(failure!=='no-commit') remote.set(id,{id,...values,request_status:'new',write_date:'2026-11-15 12:00:00',create_date:'2026-11-15 12:00:00'});
      if(failure==='proxy') throw Object.assign(new OdooIntegrationError('upstream gateway error',{code:200,message:'gateway',data:{name:'odoo.exceptions.ValidationError'}}),{status:503});
      if(failure) throw new Error('network timeout');
      return id;
    }
    async search_read(model, domain) {
      counters.searches.push({model,domain});
      if (model==='hr.employee') return [{id:5,user_id:[50,'Owner']}];
      const marker=domain.find(x=>x[1]==='ilike')?.[2];
      const cursor=domain.find(x=>x[0]==='id'&&x[1]==='>')?.[2] ?? 0;
      return [...remote.values()].filter(row=>(!marker||row.name.includes(marker))&&row.id>cursor).map(item=>structuredClone(item));
    }
    async search() {return [];}
    async read(model, ids) {
      if(model==='hr.employee') return [{id:5,user_id:[50,'Owner']}];
      if(model==='approval.category') return ids.map(id=>({id}));
      return ids.map(id=>remote.get(id)).filter(Boolean).map(item=>structuredClone(item));
    }
  }
  const store = await load('lib/integrations/odoo/requests/store.ts', {'node:crypto':{createHash},'@/lib/prisma':{prisma},'./types':types});
  const service = await load('lib/integrations/odoo/requests/service.ts', {
    'node:crypto':{createHash,randomUUID}, '@/lib/employee/hr-approval-services':{HR_APPROVAL_SERVICES:[]}, '@/lib/employee/request-form-config':{getRequestTypeConfig:()=>null}, '@/lib/prisma':{prisma}, '@/lib/payroll/connection':{getPayrollOdooClient:async()=>({client:new OdooClient()})},
    './relations':{permittedPartnerIds:async()=>[]},'./categories':categories,'./documents':documents,'../client':{OdooClient},'../auth':{OdooIntegrationError},'./profiles':profiles,'./store':store,'./types':types,
  });
  const submit = (overrides={}) => service.createRemoteRequest({employeeId:'employee',actorId:'owner',model:'approval.request',values:{name:'طلب تجريبي',category_id:10,reason:'تفاصيل'},idempotencyKey:'same-key',...overrides});
  return {service,store,prisma,settings,remote,counters,submit,save};
}

test('unknown/custom states never masquerade as completed; fields reject ownership/state overrides',()=>{
  assert.equal(profiles.bucketFor('approval.request','approved'),'APPROVED');
  assert.equal(profiles.bucketFor('hr.loan','done'),'COMPLETED');
  assert.equal(profiles.bucketFor('custom.request','invented_done'),'UNKNOWN');
  assert.throws(()=>profiles.validateValues({request_owner_id:999},metadata,['name']),/غير مسموح/);
  assert.throws(()=>profiles.validateValues({amount:'NaN'},metadata,['amount']),/تحقق/);
  assert.equal(profiles.submissionFingerprint('e','m',{b:1,a:2}),profiles.submissionFingerprint('e','m',{a:2,b:1}));
});
test('submission stores a durable reference, injects verified identity, confirms once and is idempotent',async()=>{
  const s=await setup();const first=await s.submit();
  assert.equal(first.syncState,'SYNCED');assert.equal(first.bucket,'PENDING');assert.match(first.reference,/^LRQ-/);
  assert.equal(s.counters.creates,1);assert.equal(s.counters.submits,1);
  const second=await s.submit({values:{reason:'تفاصيل',category_id:10,name:'طلب تجريبي'}});
  assert.equal(second.id,first.id);assert.equal(s.counters.creates,1);
  await assert.rejects(s.submit({values:{name:'مختلف',category_id:10}}),/مفتاح/);
});
test('concurrent duplicate clicks never create two remote requests',async()=>{
  const s=await setup();await Promise.all([s.submit(),s.submit()]);assert.equal(s.counters.creates,1);
});
test('same-millisecond optimistic claims still permit only one sender',async()=>{
 const s=await setup({fixedClock:true});await Promise.all([s.submit(),s.submit()]);assert.equal(s.counters.creates,1);
});
test('lost create acknowledgement reconciles the marker before retrying, without a duplicate',async()=>{
  const s=await setup({failure:'committed'});const first=await s.submit();assert.equal(first.syncState,'UNCERTAIN');
  const recovered=await s.service.dispatchRequest(first.id);assert.equal(recovered.syncState,'SYNCED');assert.equal(s.counters.creates,1);
});
test('unconfirmed write with no visible record is never blindly created again',async()=>{
  const s=await setup({failure:'no-commit'});const first=await s.submit();
  assert.equal((await s.service.dispatchRequest(first.id)).syncState,'UNCERTAIN');assert.equal(s.counters.creates,1);
});
test('definitive remote validation failure is an error, not successful or ambiguously committed',async()=>{
  const s=await setup({failure:'rejected'});const row=await s.submit();assert.equal(row.syncState,'ERROR');assert.equal(row.remoteId,undefined);
});
test('lost submit response retains remote id and never repeats an already-confirmed action',async()=>{
  const s=await setup({submitFailure:true});const row=await s.submit();assert.equal(row.syncState,'ERROR');assert.ok(row.remoteId);
  const recovered=await s.service.dispatchRequest(row.id);assert.equal(recovered.syncState,'SYNCED');assert.equal(s.counters.submits,1);
});
test('source binding and category allowlist stop cross-account or unconfigured writes',async()=>{
  const s=await setup();await assert.rejects(s.submit({values:{name:'Test',category_id:999}}),/تصنيف/);assert.equal(s.counters.creates,0);
  s.save('odoo.migration.employeeSource','different');await assert.rejects(s.submit(),/مصدر/);assert.equal(s.counters.creates,0);
});
test('required relational collections disable an unsupported form instead of inventing fields',async()=>{
  const s=await setup({fields:{...metadata,lines:{type:'one2many',required:true}}});await assert.rejects(s.submit(),/للمتابعة فقط/);
});
test('workflow and outbox persist in the same transaction, delegating decisions to Odoo',async()=>{
  const s=await setup();await s.service.enqueueWorkflowRequest(s.prisma,{id:'wf',type:'LETTER',entityId:'letter',employeeId:'employee'});
  assert.ok(await s.store.getLink('wf-wf'));assert.equal(s.counters.writes[0].data.status,'EXTERNAL');
  await assert.rejects(s.service.assertLocalWorkflow('wf'),/مسار أودو/);
  const row=await s.service.dispatchWorkflowRequest('wf');assert.equal(row.syncState,'SYNCED');
});
test('unmapped types stay local and do not acquire a phantom remote approval',async()=>{
  const s=await setup();await s.service.enqueueWorkflowRequest(s.prisma,{id:'wf',type:'UNKNOWN',entityId:'letter',employeeId:'employee'});assert.equal(await s.store.getLink('wf-wf'),null);
});
test('remote approvals mirror the workflow decision with no financial entity writes, and stale events do not regress it',async()=>{
  const s=await setup();await s.service.enqueueWorkflowRequest(s.prisma,{id:'wf',type:'LETTER',entityId:'letter',employeeId:'employee'});
  const row=await s.service.dispatchWorkflowRequest('wf');const record=s.remote.get(row.remoteId);
  record.request_status='approved';record.write_date='2026-11-15 13:00:00';
  await s.service.syncOdooRequests({model:'approval.request',id:row.remoteId});
  assert.equal((await s.store.getLink('wf-wf')).link.bucket,'APPROVED');assert.equal(s.counters.mirror.at(-1).data.status,'APPROVED');
  const count=s.counters.mirror.length;record.request_status='pending';record.write_date='2026-11-15 12:00:00';
  await s.service.syncOdooRequests({model:'approval.request',id:row.remoteId});assert.equal((await s.store.getLink('wf-wf')).link.bucket,'APPROVED');assert.equal(s.counters.mirror.length,count);
});
test('employee submissions cannot set custom internal fields through the privileged service account',async()=>{
 const s=await setup({fields:{...metadata,x_internal_approval:{type:'boolean',required:true}}});
 await assert.rejects(s.submit({values:{name:'Test',category_id:10,x_internal_approval:true}}),/غير مسموح/);
 assert.equal(s.counters.creates,0);
});
test('an HTTP proxy failure is never mistaken for an atomic Odoo validation rollback',async()=>{
 const s=await setup({failure:'proxy'});const first=await s.submit();assert.equal(first.syncState,'UNCERTAIN');
 const recovered=await s.service.dispatchRequest(first.id);assert.equal(recovered.syncState,'SYNCED');assert.equal(s.counters.creates,1);
});
