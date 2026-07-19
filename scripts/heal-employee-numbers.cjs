const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function formatEmployeeCode(code) {
  if (!code) return `00ODOO-${Date.now()}`;
  const clean = String(code).trim();
  if (clean.startsWith("ODOO-") || clean.startsWith("00ODOO-")) return clean.startsWith("00") ? clean : `00${clean}`;
  if (clean.startsWith("00")) return clean;
  if (clean.length > 6) return clean;
  const digits = clean.replace(/^[0]+/, "");
  return `00${digits || clean}`;
}

async function main() {
  console.log("[HealEmployeeNumbers] Fetching employees with odooId...");
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
        if (updated % 100 === 0 || updated <= 10) {
          console.log(`Updated [${updated}]: Emp #${emp.odooId} (${emp.firstName} ${emp.lastName}) employeeNumber: "${emp.employeeNumber}" => "${targetCode}"`);
        }
      } catch (err) {
        // Handle potential unique constraint if targetCode exists
        console.warn(`Could not update Emp #${emp.odooId} (${emp.firstName} ${emp.lastName}) to "${targetCode}":`, err.message);
      }
    }
  }
  console.log(`[HealEmployeeNumbers] DONE! Successfully updated ${updated} out of ${emps.length} employees to exact Odoo registered code.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
