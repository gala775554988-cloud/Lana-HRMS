import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../workflows/helpers.mjs';
const catalog=await load('lib/employee/hr-approval-services.ts');
async function setup({existing=false,allowed=true,unsupported=false,duplicate=false}={}){
 let saved=existing?{enabled:false,models:[],mappings:[]}:null;const audits=[],writes=[];
 const prisma={appSetting:{findUnique:async()=>saved?{id:'config'}:null,createMany:async({data})=>{writes.push(data);if(duplicate){saved={enabled:false,models:['custom'],mappings:[]};return {count:0};}saved=data[0].value;return {count:1};}},auditLog:{create:async data=>audits.push(data)}};prisma.$transaction=async fn=>fn(prisma);
 const module=await load('lib/integrations/odoo/requests/automatic-setup.ts',{
 '@/lib/prisma':{prisma},'@/lib/employee/hr-approval-services':catalog,
 './store':{configuration:async()=>saved??{enabled:false,models:[],mappings:[]}},
 './types':{CONFIG_KEY:'config'},
 './service':{requestConnection:async()=>({source:'verified-source',client:{execute_kw:async()=>allowed}}),describeModel:async()=>({canCreate:true,missing:[],fields:{},formFields:['amount']})},
 './categories':{categoryCatalog:async()=>[{id:7,label:'الموارد البشرية - صرف سلفة'}],categoryDetails:async()=>({unsupported:unsupported?['products']:[],requiredFields:['amount']})},
 });return {run:()=>module.automaticallySetupRequests('actor'),audits,writes};
}
test('first visit enables verified source and unique matching services with an audit',async()=>{const s=await setup();const result=await s.run();assert.equal(result.config.enabled,true);assert.equal(result.config.source,'verified-source');assert.equal(result.config.mappings.length,1);assert.equal(result.config.mappings[0].categoryId,7);assert.equal(result.issues.length,8);assert.equal(s.audits.length,1);});
test('existing disabled or customized settings are preserved',async()=>{const s=await setup({existing:true});assert.equal((await s.run()).config.enabled,false);assert.equal(s.writes.length,0);});
test('missing create access cannot activate the connection',async()=>{const s=await setup({allowed:false});await assert.rejects(s.run());assert.equal(s.writes.length,0);});
test('unsupported category requirements cannot be silently enabled',async()=>{const s=await setup({unsupported:true});assert.equal((await s.run()).config.enabled,false);assert.equal(s.writes.length,0);});
test('concurrent administrator configuration wins without being overwritten',async()=>{const s=await setup({duplicate:true});const result=await s.run();assert.equal(result.configured,false);assert.deepEqual(result.config.models,['custom']);assert.equal(s.audits.length,0);});
