const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const HOSPITAL_PATH_STEPS = [
  {
    stepOrder: 1,
    approverId: "",
    departmentId: "",
    roleContext: "HOSPITAL_INITIATOR",
    approverLabel: "",
    approverPosition: "المستشفى / مقدم الطلب (Hospital Initiator)",
    orgUnitLabel: "المستشفيات / القطاع الطبي",
    capabilities: ["CREATE", "INITIATE", "VIEW"],
    slaHours: 12
  },
  {
    stepOrder: 2,
    approverId: "",
    departmentId: "",
    roleContext: "HOSPITAL_SUPERVISOR",
    approverLabel: "",
    approverPosition: "مشرف المستشفى / معتمِد (Hospital Supervisor)",
    orgUnitLabel: "المستشفيات / القطاع الطبي",
    capabilities: ["APPROVE", "REJECT", "CONFIGURE_FIELDS", "VIEW_ALL_EMPLOYEES"],
    slaHours: 24
  }
];

const GENERAL_ADMIN_PATH_STEPS = [
  {
    stepOrder: 1,
    approverId: "",
    departmentId: "",
    roleContext: "BRANCH_INITIATOR",
    approverLabel: "",
    approverPosition: "الإدارة أو الفرع (Branch/Admin Initiator)",
    orgUnitLabel: "الإدارة العامة / الفروع التشغيلية",
    capabilities: ["CREATE", "INITIATE", "VIEW"],
    slaHours: 12
  },
  {
    stepOrder: 2,
    approverId: "",
    departmentId: "",
    roleContext: "BRANCH_MANAGER",
    approverLabel: "",
    approverPosition: "المدير / المشرف المعتمِد (Manager/Supervisor)",
    orgUnitLabel: "الإدارة / الفرع التشغيلي",
    capabilities: ["APPROVE", "REJECT", "REVIEW", "RETURN"],
    slaHours: 24
  }
];

async function seedCleanWorkflows() {
  console.log("[SeedWorkflows] Deleting legacy Haneen Fahd override and cleaning HrApprovalChain...");
  await prisma.hrApprovalChain.deleteMany();

  console.log("[SeedWorkflows] Setting HOSPITAL_PATH to compact neat table (Hospital -> Supervisor)...");
  await prisma.workflowPathTemplate.upsert({
    where: { workflowType: "HOSPITAL_PATH" },
    update: {
      workflowName: "مسار طلبات المستشفيات والقطاع الطبي (Hospital Workflow)",
      steps: HOSPITAL_PATH_STEPS,
      updatedAt: new Date()
    },
    create: {
      workflowType: "HOSPITAL_PATH",
      workflowName: "مسار طلبات المستشفيات والقطاع الطبي (Hospital Workflow)",
      steps: HOSPITAL_PATH_STEPS,
      updatedById: "SYSTEM_ARCHITECT",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log("[SeedWorkflows] Setting GENERAL_ADMIN_PATH to compact neat table (Branch/Admin -> Manager)...");
  await prisma.workflowPathTemplate.upsert({
    where: { workflowType: "GENERAL_ADMIN_PATH" },
    update: {
      workflowName: "مسار طلبات الإدارة العامة والفروع التشغيلية (Administration/Branch Workflow)",
      steps: GENERAL_ADMIN_PATH_STEPS,
      updatedAt: new Date()
    },
    create: {
      workflowType: "GENERAL_ADMIN_PATH",
      workflowName: "مسار طلبات الإدارة العامة والفروع التشغيلية (Administration/Branch Workflow)",
      steps: GENERAL_ADMIN_PATH_STEPS,
      updatedById: "SYSTEM_ARCHITECT",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log("[SeedWorkflows] Both workflow sequences successfully configured in Neon PostgreSQL!");
  const all = await prisma.workflowPathTemplate.findMany({ orderBy: { workflowType: "asc" } });
  for (const item of all) {
    console.log(`\n=== ${item.workflowType} (${item.workflowName}) [${Array.isArray(item.steps) ? item.steps.length : 0} steps] ===`);
    console.table(item.steps);
  }
}

seedCleanWorkflows().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
