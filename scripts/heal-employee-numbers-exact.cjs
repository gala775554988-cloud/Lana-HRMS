const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function formatEmployeeCode(code) {
  if (code === undefined || code === null || code === "") return `ODOO-${Date.now()}`;
  return String(code).trim();
}

async function main() {
  console.log("[ExactHeal] Fetching all employees with odooId from database...");
  const emps = await prisma.employee.findMany({
    where: { odooId: { not: null } },
    select: { id: true, employeeNumber: true, firstName: true, lastName: true, odooId: true, odooRawData: true }
  });

  let updated = 0;
  for (const emp of emps) {
    const raw = emp.odooRawData || {};
    const bc = raw.barcode && raw.barcode !== "false" && raw.barcode !== false ? String(raw.barcode).trim() : null;
    const ec = raw.employee_code && raw.employee_code !== "false" && raw.employee_code !== false ? String(raw.employee_code).trim() : null;
    const pn = raw.pin && raw.pin !== "false" && raw.pin !== false ? String(raw.pin).trim() : null;
    const xe = raw.x_studio_employee_number && raw.x_studio_employee_number !== "false" && raw.x_studio_employee_number !== false ? String(raw.x_studio_employee_number).trim() : null;
    const rawCode = bc || ec || pn || xe || String(raw.id || emp.odooId);
    const targetCode = formatEmployeeCode(rawCode);

    if (emp.employeeNumber !== targetCode) {
      try {
        await prisma.employee.update({
          where: { id: emp.id },
          data: { employeeNumber: targetCode }
        });
        updated++;
        if (updated <= 15) {
          console.log(`Updated [${updated}]: Emp #${emp.odooId} (${emp.firstName} ${emp.lastName}) employeeNumber: "${emp.employeeNumber}" => "${targetCode}"`);
        }
      } catch (err) {
        // If unique constraint fails because targetCode is held by someone else, resolve temporary holder
        try {
          const holder = await prisma.employee.findFirst({ where: { employeeNumber: targetCode } });
          if (holder && holder.id !== emp.id) {
            await prisma.employee.update({ where: { id: holder.id }, data: { employeeNumber: `TEMP-${holder.odooId || holder.id.slice(0,6)}` } });
            await prisma.employee.update({ where: { id: emp.id }, data: { employeeNumber: targetCode } });
            updated++;
          }
        } catch (e2) {}
      }
    }
  }
  console.log(`[ExactHeal] DONE! Successfully updated ${updated} employees to exact Odoo registered code without 00 prefix.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
