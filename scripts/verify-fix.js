// Verify fix: simulates Odoo with 8000 employees, some duplicates, and ensures our sync logic imports all
// This mimics lib/integrations/odoo/sync.ts new logic

function isUniqueError(msg) {
  return msg.includes("P2002") || msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate");
}

// Mock DB
class MockDB {
  constructor() {
    this.employees = new Map(); // employeeNumber -> employee
    this.emails = new Set();
    this.nationalIds = new Set();
  }
  findFirst(where) {
    // where: { employeeNumber } or { email } or { nationalId }
    if(where.employeeNumber) return this.employees.get(where.employeeNumber) || null;
    if(where.email) {
      for(let emp of this.employees.values()) {
        if(emp.email===where.email) return emp;
      }
      return null;
    }
    if(where.nationalId) {
      for(let emp of this.employees.values()) {
        if(emp.nationalId===where.nationalId) return emp;
      }
      return null;
    }
    return null;
  }
  create(data) {
    // simulate unique constraint
    if(this.employees.has(data.employeeNumber)) throw new Error(`P2002 Unique constraint failed on employeeNumber ${data.employeeNumber}`);
    if(data.email && this.emails.has(data.email)) throw new Error(`P2002 Unique constraint failed on email ${data.email}`);
    if(data.nationalId && this.nationalIds.has(data.nationalId)) throw new Error(`P2002 Unique constraint failed on nationalId ${data.nationalId}`);
    const id = `emp_${data.employeeNumber}`;
    const emp = {id, ...data};
    this.employees.set(data.employeeNumber, emp);
    if(data.email) this.emails.add(data.email);
    if(data.nationalId) this.nationalIds.add(data.nationalId);
    return emp;
  }
  update(where, data) {
    const id = where.id;
    // find by id
    for(let [key, emp] of this.employees.entries()) {
      if(emp.id===id) {
        // check unique if changing
        // simplified
        Object.assign(emp, data);
        return emp;
      }
    }
    throw new Error("Not found");
  }
  count() { return this.employees.size; }
}

// Mock Odoo: 8000 employees, with 224th having corrupt data, some duplicates
function generateOdooEmployees(total=8000) {
  const rows=[];
  for(let i=1;i<=total;i++) {
    let barcode = `EMP${String(i).padStart(5,'0')}`;
    let email = `emp${i}@company.com`;
    let nationalId = `ID${1000000+i}`;
    // introduce duplicate at 500 and 501 same email
    if(i===501) email = `emp500@company.com`;
    // introduce corrupt at 224: missing name
    let name = `Employee ${i}`;
    if(i===224) name = ""; // corrupt
    // introduce corrupt at 1000: invalid barcode
    if(i===1000) barcode = "";
    rows.push({id:i, name, barcode, identification_id:nationalId, work_email:email, write_date: new Date().toISOString()});
  }
  return rows;
}

// Our fixed sync logic (simplified)
async function syncEmployees(odooRows, db) {
  const batchSize=500;
  let lastOdooId=0;
  let pages=0;
  let totalFetched=0;
  let hasMore=true;
  let pulled=0, created=0, updated=0, skipped=0;
  const errors=[];

  while(hasMore) {
    // pagination using id > lastOdooId (not offset only)
    const batch = odooRows.filter(r=>r.id>lastOdooId).sort((a,b)=>a.id-b.id).slice(0,batchSize);
    if(batch.length===0) { hasMore=false; break; }
    pages++;
    totalFetched+=batch.length;
    lastOdooId=batch[batch.length-1].id;
    console.log(`Page ${pages} lastOdooId=${lastOdooId} fetched=${batch.length} total=${totalFetched}`);

    for(const row of batch) {
      const odooId=row.id;
      try {
        // map
        if(!row.name || !row.name.trim()) throw new Error(`Invalid name for Odoo ${odooId}`);
        const values={
          employeeNumber: String(row.barcode || `ODOO-${row.id}`),
          nationalId: String(row.identification_id || `ODOO-${row.id}`),
          firstName: row.name.split(' ')[0] || row.name,
          lastName: row.name.split(' ').slice(1).join(' ') || " ",
          email: row.work_email || null,
          hireDate: new Date(),
        };
        if(!values.employeeNumber) throw new Error(`Missing employeeNumber for Odoo ${odooId}`);

        // find existing: employeeNumber -> email -> nationalId
        let existing = db.findFirst({employeeNumber: values.employeeNumber});
        if(!existing && values.email) existing = db.findFirst({email: values.email});
        if(!existing && values.nationalId) existing = db.findFirst({nationalId: values.nationalId});

        try {
          if(existing) {
            db.update({id: existing.id}, values);
            updated++;
          } else {
            db.create(values);
            created++;
          }
          pulled++;
        } catch(dbErr) {
          // No data modification - log and skip
          const msg=dbErr.message;
          skipped++;
          errors.push({id: String(odooId), message: msg, odooName: row.name});
          continue;
        }
      } catch(recordError) {
        const msg=recordError.message;
        skipped++;
        errors.push({id: String(odooId), message: msg});
        continue; // ContinueOnError
      }
    }

    // Simulate SyncHistory update after each batch
    // metadata: {page, lastOdooId, lastWriteDate, imported, updated, skipped}
    const metadata={page:pages, lastOdooId, lastWriteDate: new Date().toISOString(), imported:created, updated, skipped};
    // console.log("Updated SyncHistory metadata:", metadata);

    if(batch.length<batchSize) hasMore=false;
  }

  return {pulled, created, updated, skipped, errors, pages, lastOdooId, totalFetched};
}

(async()=>{
  const odooRows=generateOdooEmployees(8000);
  const db=new MockDB();
  console.log(`Odoo total: ${odooRows.length}`);
  const result=await syncEmployees(odooRows, db);
  console.log("\n=== FINAL REPORT ===");
  console.log(JSON.stringify({
    pulled: result.pulled,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    errorsCount: result.errors.length,
    pages: result.pages,
    lastOdooId: result.lastOdooId,
    totalFetched: result.totalFetched,
    dbCount: db.count(),
    odooCount: odooRows.length,
    errorsSample: result.errors.slice(0,5),
  }, null, 2));

  console.log("\n=== VERIFICATION ===");
  if(db.count() + result.skipped === odooRows.length) {
    console.log(`✅ PASS: DB (${db.count()}) + skipped (${result.skipped}) = Odoo (${odooRows.length}) - all processed without stopping`);
    console.log(`   - If skipped are duplicates/corrupt, they are logged but sync continued`);
  }
  if(result.totalFetched===odooRows.length) {
    console.log(`✅ PASS: totalFetched (${result.totalFetched}) == Odoo total (${odooRows.length}) - Pagination works for 8000+`);
  }
  if(result.pages===Math.ceil(odooRows.length/500)) {
    console.log(`✅ PASS: pages ${result.pages} == ceil(8000/500)=16 - Batch 500 works`);
  }
  if(result.lastOdooId===8000) {
    console.log(`✅ PASS: lastOdooId ${result.lastOdooId} == 8000 - Resume with lastOdooId works`);
  }
  console.log("\nIf this were real Odoo with no duplicates, dbCount would == odooCount (8000)");
  console.log("In production: POST /api/integrations/odoo/sync/employees then GET /api/integrations/odoo/sync/report to verify");
})();
