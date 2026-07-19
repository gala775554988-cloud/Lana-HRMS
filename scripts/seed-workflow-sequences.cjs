const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const HOSPITAL_PATH_INITIAL_STEP = [
  {
    stepOrder: 1,
    approverId: "",
    departmentId: "", // Blank so when clicked, all hospitals appear in the dropdown
    roleContext: "HOSPITAL_SUPERVISOR",
    approverLabel: "",
    approverPosition: "مشرف مستشفى / معتمِد",
    orgUnitLabel: "المستشفيات / القطاع الطبي",
    capabilities: ["APPROVE", "REJECT", "CONFIGURE_FIELDS", "VIEW_ALL_EMPLOYEES"],
    slaHours: 24
  }
];

const GENERAL_ADMIN_PATH_INITIAL_STEP = [
  {
    stepOrder: 1,
    approverId: "",
    departmentId: "", // Blank so when clicked, all branches/departments appear in the dropdown
    roleContext: "BRANCH_MANAGER",
    approverLabel: "",
    approverPosition: "مدير الفرع / الإدارة",
    orgUnitLabel: "الإدارة / الفرع التشغيلي",
    capabilities: ["APPROVE", "REJECT", "RETURN"],
    slaHours: 48
  }
];

async function seedCleanWheel() {
  console.log("[SeedCleanWheel] Setting HOSPITAL_PATH to 1 clean blank step ready for hospital and employee selection...");
  await prisma.workflowPathTemplate.upsert({
    where: { workflowType: "HOSPITAL_PATH" },
    update: {
      workflowName: "المسار الأول: المستشفيات والقطاع الطبي (Hospital Workflow Sequence)",
      steps: HOSPITAL_PATH_INITIAL_STEP,
      updatedAt: new Date()
    },
    create: {
      workflowType: "HOSPITAL_PATH",
      workflowName: "المسار الأول: المستشفيات والقطاع الطبي (Hospital Workflow Sequence)",
      steps: HOSPITAL_PATH_INITIAL_STEP,
      updatedById: "SYSTEM_ARCHITECT",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log("[SeedCleanWheel] Setting GENERAL_ADMIN_PATH to 1 clean blank step ready for selection...");
  await prisma.workflowPathTemplate.upsert({
    where: { workflowType: "GENERAL_ADMIN_PATH" },
    update: {
      workflowName: "المسار الثاني: الإدارة العامة والفروع (Administration/Branch Sequence)",
      steps: GENERAL_ADMIN_PATH_INITIAL_STEP,
      updatedAt: new Date()
    },
    create: {
      workflowType: "GENERAL_ADMIN_PATH",
      workflowName: "المسار الثاني: الإدارة العامة والفروع (Administration/Branch Sequence)",
      steps: GENERAL_ADMIN_PATH_INITIAL_STEP,
      updatedById: "SYSTEM_ARCHITECT",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log("[SeedCleanWheel] Both paths successfully reset to 1 clean blank step card in Neon PostgreSQL!");
  const all = await prisma.workflowPathTemplate.findMany();
  console.log(JSON.stringify(all, null, 2));
}

seedCleanWheel().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
