import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as zod from 'zod';
import {load} from '../workflows/helpers.mjs';
const catalog=await load('lib/employee/hr-approval-services.ts');
const routing=await load('config/request-routing.ts',{'@/lib/employee/hr-approval-services':catalog});
const forms=await load('lib/employee/request-form-config.ts',{'./hr-approval-services':catalog});
const lifecycle=await load('lib/self-service/lifecycle.ts',{zod,'@/lib/employee/hr-approval-services':catalog});
const profiles=await load('lib/integrations/odoo/requests/profiles.ts');
const categories=await load('lib/integrations/odoo/requests/categories.ts',{'./profiles':profiles});
test('all nine supplied HR approval services have explicit routing and form definitions without duplicate codes',()=>{
 assert.equal(catalog.HR_APPROVAL_SERVICES.length,9);
 assert.equal(new Set(routing.REQUEST_CATEGORIES.map(item=>item.code)).size,routing.REQUEST_CATEGORIES.length);
 for(const service of catalog.HR_APPROVAL_SERVICES){assert.ok(routing.REQUEST_CATEGORIES.some(item=>item.code===service.code));assert.ok(forms.getRequestTypeConfig(service.code));}
});
test('payment fields survive edits and reject bad dates, fractions of a cent and mass assignment',()=>{
 const input={purpose:'صرف مستحقات المشاريع',amount:'1500.25',requestDate:'2026-11-15',reference:'INV-TEST',project:'مشروع تجريبي'};
 for(const type of catalog.EXTRA_PAYMENT_TYPES){const parsed=lifecycle.parseRequestEdit(type.code,input);assert.equal(parsed.amount,1500.25);assert.equal(parsed.reference,'INV-TEST');assert.equal(parsed.project,'مشروع تجريبي');}
 assert.throws(()=>lifecycle.parseRequestEdit('PROJECT_PAYMENT',{...input,requestDate:'2026-02-30'}));
 assert.throws(()=>lifecycle.parseRequestEdit('PROJECT_PAYMENT',{...input,amount:'0.001'}));
 assert.throws(()=>lifecycle.parseRequestEdit('PROJECT_PAYMENT',{...input,status:'APPROVED'}));
});
test('category requirements and ordering are read from verified metadata, never inferred from the category name',async()=>{
 const requestFields={amount:{type:'monetary'},date:{type:'datetime'}};
 const client={fieldsGet:async model=>model==='approval.category'?{name:{},has_amount:{string:'المبلغ'},has_date:{},has_document:{},approver_sequence:{},approval_minimum:{},approver_ids:{relation:'approval.category.approver'}}:{user_id:{relation:'res.users'},sequence:{},required:{}},read:async model=>model==='approval.category'?[{id:10,name:'صرف الرواتب',has_amount:'required',has_date:'optional',has_document:'required',approver_sequence:true,approval_minimum:2,approver_ids:[1,2]}]:[{id:1,user_id:[20,'المالية'],sequence:20,required:true},{id:2,user_id:[10,'الموارد البشرية'],sequence:10,required:true}]};
 const result=await categories.categoryDetails(client,10,requestFields);
 assert.equal(result.requiredFields[0],'amount');assert.equal(result.optionalFields[0],'date');assert.equal(result.requiresDocuments,true);assert.equal(result.approvers[0].name,'الموارد البشرية');assert.equal(result.minimum,2);
});
test('parallel approvals remain parallel instead of fabricating a manager-to-HR sequence',async()=>{
 const client={fieldsGet:async()=>({name:{},approver_sequence:{},approval_minimum:{}}),read:async()=>[{name:'صرف نثريات',approver_sequence:false,approval_minimum:1}]};
 const result=await categories.categoryDetails(client,10,{});assert.equal(result.sequenced,false);assert.equal(result.approvers.length,0);
});
test('category suggestions use full known category names and leave ambiguity for explicit HR review',()=>{
 const proposed=catalog.suggestHRCategoryMappings([{id:7,label:'الموارد البشرية - صرف سلفة'},{id:9,label:'طلب صرف الموارد البشرية - الرواتب'}]);
 assert.equal(proposed.length,2);assert.equal(proposed.find(item=>item.type==='LOAN').categoryId,7);
 const ambiguous=catalog.suggestHRCategoryMappings([{id:7,label:'الموارد البشرية - صرف سلفة'},{id:8,label:'الموارد البشرية صرف سلفه'}]);
 assert.equal(ambiguous.length,0);
});
