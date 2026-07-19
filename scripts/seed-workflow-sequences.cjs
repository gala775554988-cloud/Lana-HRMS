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
    approverPosition: "مشرف مستشفى / معتمِد (Hospital Supervisor)",
    orgUnitLabel: "المستشفيات / القطاع الطبي",
    capabilities: ["APPROVE", "REJECT", "CONFIGURE_FIELDS", "VIEW_ALL_EMPLOYEES"],
    slaHours: 24
  },
  {
    stepOrder: 3,
    approverId: "",
    departmentId: "",
    roleContext: "DEPARTMENT_MANAGER",
    approverLabel: "",
    approverPosition: "مدير المستشفى / الإدارة (Manager Review Stage)",
    orgUnitLabel: "إدارة المستشفى / الإدارة المعنية",
    capabilities: ["APPROVE", "REJECT", "REVIEW"],
    slaHours: 24
  },
  {
    stepOrder: 4,
    approverId: "",
    departmentId: "",
    roleContext: "HR_MANAGER",
    approverLabel: "",
    approverPosition: "إدارة الموارد البشرية (HR Review Stage)",
    orgUnitLabel: "إدارة الموارد البشرية (HR Department)",
    capabilities: ["APPROVE", "REJECT", "AUDIT_VERIFY", "REVIEW"],
    slaHours: 24
  },
  {
    stepOrder: 5,
    approverId: "",
    departmentId: "",
    roleContext: "PAYROLL_OFFICER",
    approverLabel: "",
    approverPosition: "مسؤول الرواتب والمستحقات (Payroll Officer)",
    orgUnitLabel: "الإدارة المالية وشؤون الرواتب",
    capabilities: ["PROCESS_FINANCIALS", "APPROVE", "REJECT", "FINANCIAL_AUDIT"],
    slaHours: 48
  },
  {
    stepOrder: 6,
    approverId: "",
    departmentId: "",
    roleContext: "FINAL_ONBOARDING",
    approverLabel: "",
    approverPosition: "الخطوة النهائية: تسكين الموظف الجديد (New Employee Addition)",
    orgUnitLabel: "شؤون الموظفين والعمليات",
    capabilities: ["ADD_EMPLOYEE_RECORD", "CONFIGURE_FIELDS", "FINAL_APPROVAL"],
    slaHours: 48
  }
];

const GENERAL_ADMIN_PATH_STEPS = [
  {
    stepOrder: 1,
    approverId: "",
    departmentId: "",
    roleContext: "BRANCH_INITIATOR",
    approverLabel: "",
    approverPosition: "الإدارة / الفرع (Administration/Branch Initiator)",
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
    approverPosition: "مدير الفرع / الإدارة (Manager Review Stage)",
    orgUnitLabel: "إدارة الفرع / القسم",
    capabilities: ["APPROVE", "REJECT", "REVIEW", "RETURN"],
    slaHours: 24
  },
  {
    stepOrder: 3,
    approverId: "",
    departmentId: "",
    roleContext: "HR_MANAGER",
    approverLabel: "",
    approverPosition: "إدارة الموارد البشرية (HR Review Stage)",
    orgUnitLabel: "إدارة الموارد البشرية (HR Department)",
    capabilities: ["APPROVE", "REJECT", "AUDIT_VERIFY", "REVIEW"],
    slaHours: 24
  },
  {
    stepOrder: 4,
    approverId: "",
    departmentId: "",
    roleContext: "EMPLOYEE_FINAL_STEP",
    approverLabel: "",
    approverPosition: "الخطوة النهائية: الموظف المختص (Employee Final Data Entry)",
    orgUnitLabel: "شؤون الموظفين والعمليات",
    capabilities: ["ADD_SPECIFIC_DATA_FIELDS", "FINAL_APPROVAL", "COMPLETE_REQUEST"],
    slaHours: 24
  }
];

async function seedCleanWorkflows() {
  console.log("[SeedWorkflows] Deleting legacy Haneen Fahd override and cleaning HrApprovalChain...");
  const delChain = await prisma.hrApprovalChain.deleteMany();
  console.log(`[SeedWorkflows] Deleted ${delChain.count} legacy HrApprovalChain rows.`);

  console.log("[SeedWorkflows] Setting HOSPITAL_PATH to exact 6-step sequence (Workflow 1: Hospital Path)...");
  await prisma.workflowPathTemplate.upsert({
    where: { workflowType: "HOSPITAL_PATH" },
    update: {
      workflowName: "المسار الأول: المستشفيات والقطاع الطبي (Hospital Workflow Sequence - 6 Steps)",
      steps: HOSPITAL_PATH_STEPS,
      updatedAt: new Date()
    },
    create: {
      workflowType: "HOSPITAL_PATH",
      workflowName: "المسار الأول: المستشفيات والقطاع الطبي (Hospital Workflow Sequence - 6 Steps)",
      steps: HOSPITAL_PATH_STEPS,
      updatedById: "SYSTEM_ARCHITECT",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log("[SeedWorkflows] Setting GENERAL_ADMIN_PATH to exact 4-step sequence (Workflow 2: Administration/Branch Path)...");
  await prisma.workflowPathTemplate.upsert({
    where: { workflowType: "GENERAL_ADMIN_PATH" },
    update: {
      workflowName: "المسار الثاني: الإدارة العامة والفروع (Administration/Branch Sequence - 4 Steps)",
      steps: GENERAL_ADMIN_PATH_STEPS,
      updatedAt: new Date()
    },
    create: {
      workflowType: "GENERAL_ADMIN_PATH",
      workflowName: "المسار الثاني: الإدارة العامة والفروع (Administration/Branch Sequence - 4 Steps)",
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
