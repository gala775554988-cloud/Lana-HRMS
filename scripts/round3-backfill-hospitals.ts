import { prisma } from "../lib/prisma";

function slugCode(name: string, index: number) {
  return `HOSP-${String(index + 1).padStart(3, "0")}`;
}

async function main() {
  const extras = await prisma.appSetting.findMany({
    where: { key: { startsWith: "employee.extra." } },
    select: { key: true, value: true },
  });

  const hospitalNameToEmployeeIds = new Map<string, string[]>();
  const costCenterByEmployeeId = new Map<string, string>();

  for (const row of extras) {
    const employeeId = row.key.replace("employee.extra.", "");
    const value = (row.value ?? {}) as Record<string, unknown>;
    const hospital = typeof value.hospital === "string" ? value.hospital.trim() : "";
    const costCenter = typeof value.costCenter === "string" ? value.costCenter.trim() : "";
    if (hospital) {
      const list = hospitalNameToEmployeeIds.get(hospital) ?? [];
      list.push(employeeId);
      hospitalNameToEmployeeIds.set(hospital, list);
    }
    if (costCenter) costCenterByEmployeeId.set(employeeId, costCenter);
  }

  console.log(`Found ${hospitalNameToEmployeeIds.size} distinct hospital names across ${extras.length} employee.extra rows.`);
  console.log(`Found ${costCenterByEmployeeId.size} employees with a costCenter value.`);

  let hospitalIndex = 0;
  let hospitalsCreated = 0;
  let employeesLinked = 0;

  for (const [name, employeeIds] of hospitalNameToEmployeeIds) {
    let hospital = await prisma.hospital.findFirst({ where: { name } });
    if (!hospital) {
      hospital = await prisma.hospital.create({
        data: { name, code: slugCode(name, hospitalIndex) },
      });
      hospitalsCreated++;
    }
    hospitalIndex++;

    for (const employeeId of employeeIds) {
      const exists = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
      if (!exists) continue;
      await prisma.employee.update({ where: { id: employeeId }, data: { hospitalId: hospital.id } });
      employeesLinked++;
    }
  }

  for (const [employeeId, costCenter] of costCenterByEmployeeId) {
    const exists = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!exists) continue;
    await prisma.employee.update({ where: { id: employeeId }, data: { costCenter } });
  }

  console.log(`Created ${hospitalsCreated} new Hospital rows.`);
  console.log(`Linked ${employeesLinked} employees to a hospitalId.`);
  console.log(`Backfilled costCenter for ${costCenterByEmployeeId.size} employees.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
