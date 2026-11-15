import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {load} from '../workflows/helpers.mjs';
const documents=await load('lib/integrations/odoo/requests/documents.ts',{'node:buffer':{Buffer},'node:crypto':{createHash}});
const data=Buffer.from('%PDF-1.7\nsynthetic test document').toString('base64');
test('uploads validate signatures and size, sanitize filenames and never accept disguised HTML or SVG',()=>{
 const [file]=documents.validateDocuments([{name:'../receipt.pdf',data}]);assert.equal(file.mime,'application/pdf');assert.ok(!file.name.includes('/'));assert.equal(file.hash,createHash('sha256').update(Buffer.from(data,'base64')).digest('hex'));
 assert.throws(()=>documents.validateDocuments([{name:'image.png',data:Buffer.from('<svg onload="bad()"></svg>').toString('base64')}]));
 assert.throws(()=>documents.validateDocuments(Array.from({length:6},()=>({name:'test.pdf',data}))));
 assert.throws(()=>documents.validateDocuments([{name:'large.pdf',data:Buffer.alloc(1600000).toString('base64')}]));
});
async function uploadSetup(commit=true){
 let persisted=documents.validateDocuments([{name:'receipt.pdf',data}]),created=0;const remote=[];const writes=[];
 const client={search_read:async()=>remote,create:async()=>{created++;if(commit)remote.push({id:99,checksum:createHash('sha1').update(Buffer.from(data,'base64')).digest('hex')});throw new Error('lost upload acknowledgement');},write:async(_model,_ids,values)=>writes.push(values)};
 const run=()=>documents.attachDocuments(client,'approval.request',10,'LRQ-TEST',persisted,{document_ids:{type:'many2many',relation:'ir.attachment'}},async value=>{persisted=structuredClone(value);});
 return {run,created:()=>created,writes};
}
test('lost file acknowledgement reconciles the attachment marker and links it without uploading a duplicate',async()=>{
 const s=await uploadSetup();await assert.rejects(s.run());const result=await s.run();assert.equal(s.created(),1);assert.equal(result[0].remoteId,99);assert.equal(s.writes[0].document_ids[0][0],4);
});
test('an unconfirmed attachment with no matching remote file is never blindly uploaded again',async()=>{
 const s=await uploadSetup(false);await assert.rejects(s.run());await assert.rejects(s.run(),/غير محسوم/);assert.equal(s.created(),1);
});
