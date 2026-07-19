const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function formatEmployeeCode(code) {
  if (code === undefined || code === null || code === "") return null;
  return String(code).trim();
}

function parseNumber(val) {
  if (val === undefined || val === null || val === "") return 0;
  const str = String(val).replace(/[^0-9.-]/g, "").trim();
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  // Check Arabic/slashed format DD/MM/YYYY
  if (/^[٠-٩0-9]{1,2}\/[٠-٩0-9]{1,2}\/[٠-٩0-9]{4}$/.test(str)) {
    const parts = str.split("/");
    const toEn = s => s.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    const day = parseInt(toEn(parts[0]), 10);
    const month = parseInt(toEn(parts[1]), 10) - 1;
    const year = parseInt(toEn(parts[2]), 10);
    const dt = new Date(year, month, day);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(str);
  return isNaN(dt.getTime()) ? null : dt;
}

async function main() {
  console.log("[ImportCsvLeaves] Reading CSV file...");
  const csvText = fs.readFileSync("/home/user/uploads/الاجازات المستحقه .csv", "utf8");
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  console.log(`Total rows in CSV: ${lines.length - 1}`);

  console.log("[ImportCsvLeaves] Fetching employees, departments, positions, branches...");
  const employees = await prisma.employee.findMany({
    select: { id: true, employeeNumber: true, firstName: true, lastName: true, odooId: true, odooRawData: true, departmentId: true, positionId: true, branchId: true, managerId: true }
  });

  const empByNum = new Map();
  const empByName = new Map();
  for (const e of employees) {
    if (e.employeeNumber) {
      empByNum.set(String(e.employeeNumber).trim().toLowerCase(), e);
      // Also register variants without leading zeros or with 00 prefix
      empByNum.set("00" + String(e.employeeNumber).trim().toLowerCase(), e);
      empByNum.set(String(e.employeeNumber).trim().toLowerCase().replace(/^0+/, ""), e);
    }
    const fullName = `${e.firstName} ${e.lastName}`.trim().toLowerCase();
    empByName.set(fullName, e);
  }

  // Pre-load lookup maps for foreign keys
  const depts = await prisma.department.findMany();
  const deptMap = new Map(depts.map(d => [d.name.trim().toLowerCase(), d.id]));

  const positions = await prisma.position.findMany();
  const posMap = new Map(positions.map(p => [p.title.trim().toLowerCase(), p.id]));

  const branches = await prisma.branch.findMany();
  const branchMap = new Map(branches.map(b => [b.name.trim().toLowerCase(), b.id]));

  let updated = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const rawId = (parts[0] || "").trim();
    const rawName = (parts[1] || "").trim();
    const rawCountry = (parts[2] || "").trim();
    const rawJoinDate = (parts[3] || "").trim();
    const rawCompany = (parts[4] || "").trim();
    const rawDept = (parts[5] || "").trim();
    const rawParent = (parts[6] || "").trim();
    const rawJob = (parts[7] || "").trim();
    const rawMobile = (parts[8] || "").trim();
    const rawWorkPhone = (parts[9] || "").trim();
    const rawMonths = parts[10];
    const rawAccruedDays = parts[11];
    const rawUsedDays = parts[12];
    const rawRemainingDays = parts[13];

    if (!rawId && !rawName) continue;

    const idKey = rawId.toLowerCase();
    let emp = empByNum.get(idKey) || empByNum.get("00" + idKey) || empByNum.get(idKey.replace(/^0+/, ""));
    if (!emp && rawName) {
      emp = empByName.get(rawName.toLowerCase());
    }

    if (!emp) {
      skipped++;
      continue;
    }

    // Resolve FK IDs or create if needed
    let departmentId = emp.departmentId;
    if (rawDept && rawDept !== "NA" && rawDept !== "غير محدد") {
      const dKey = rawDept.toLowerCase();
      if (deptMap.has(dKey)) {
        departmentId = deptMap.get(dKey);
      } else {
        try {
          const newD = await prisma.department.create({ data: { name: rawDept, code: `CSV-DEPT-${Date.now()}-${i}` } });
          deptMap.set(dKey, newD.id);
          departmentId = newD.id;
        } catch (e) {}
      }
    }

    let positionId = emp.positionId;
    if (rawJob && rawJob !== "NA" && rawJob !== "غير محدد") {
      const pKey = rawJob.toLowerCase();
      if (posMap.has(pKey)) {
        positionId = posMap.get(pKey);
      } else {
        try {
          const newP = await prisma.position.create({ data: { title: rawJob, code: `CSV-JOB-${Date.now()}-${i}` } });
          posMap.set(pKey, newP.id);
          positionId = newP.id;
        } catch (e) {}
      }
    }

    let branchId = emp.branchId;
    if (rawCompany && rawCompany !== "NA" && rawCompany !== "غير محدد") {
      const bKey = rawCompany.toLowerCase();
      if (branchMap.has(bKey)) {
        branchId = branchMap.get(bKey);
      } else {
        try {
          const newB = await prisma.branch.create({ data: { name: rawCompany, code: `CSV-BR-${Date.now()}-${i}`, city: "Riyadh", isActive: true } });
          branchMap.set(bKey, newB.id);
          branchId = newB.id;
        } catch (e) {}
      }
    }

    let managerId = emp.managerId;
    if (rawParent && rawParent !== "NA" && rawParent !== "غير محدد") {
      const parentEmp = empByName.get(rawParent.toLowerCase());
      if (parentEmp && parentEmp.id !== emp.id) {
        managerId = parentEmp.id;
      }
    }

    const monthsAccrued = parseNumber(rawMonths);
    const daysAccrued = parseNumber(rawAccruedDays);
    const daysUsed = parseNumber(rawUsedDays);
    const daysRemaining = parseNumber(rawRemainingDays);
    const hireDate = parseDate(rawJoinDate);

    const currentRaw = emp.odooRawData || {};
    const newRawData = {
      ...currentRaw,
      leaveBalance: daysAccrued,
      leaveUsed: daysUsed,
      leaveRemaining: daysRemaining,
      leaveMonthsAccrued: monthsAccrued,
      _csvLeaveData: {
        monthsAccrued,
        daysAccrued,
        daysUsed,
        daysRemaining,
        importedAt: new Date().toISOString(),
        sourceCsv: "الاجازات المستحقه .csv"
      }
    };

    const updatePayload = {
      odooRawData: newRawData,
      phone: rawMobile && rawMobile !== "NA" ? rawMobile : (rawWorkPhone && rawWorkPhone !== "NA" ? rawWorkPhone : emp.phone),
      sponsor: rawCompany && rawCompany !== "NA" ? rawCompany : emp.sponsor,
      ...(hireDate ? { hireDate } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(positionId ? { positionId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(managerId ? { managerId } : {})
    };

    await prisma.employee.update({
      where: { id: emp.id },
      data: updatePayload
    });

    updated++;
    if (updated <= 10 || updated % 200 === 0) {
      console.log(`Updated [${updated}]: Emp #${emp.employeeNumber || emp.odooId} (${emp.firstName} ${emp.lastName}) -> Entitlement: ${daysAccrued} | Used: ${daysUsed} | Remaining: ${daysRemaining} days`);
    }
  }

  console.log(`[ImportCsvLeaves] DONE! Successfully updated ${updated} employees with exact leave balances from CSV. Skipped unmatched: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
