import { ModuleTabs } from "@/components/hrms/module-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getHrmsModule } from "@/config/hrms";
import { notFound } from "next/navigation";
import { SettingsCrud } from "@/components/hrms/settings-crud";
import { SettingsLayout } from "@/components/hrms/settings-layout";

export default async function ModuleSettingsPage({ params, searchParams }: { params: Promise<{ module: string }>, searchParams: Promise<{ tab?: string }> }) {
  const { module } = await params;
  const { tab } = await searchParams;
  const resource = getHrmsModule(module);
  if (!resource) notFound();

  // Define module-specific settings maps
  const settingsMap: Record<string, { id: string, title: string, model: string }[]> = {
    employees: [
      { id: "general", title: "إعدادات عامة", model: "AppSetting" },
      { id: "fields", title: "حقول الموظفين", model: "EmployeeField" },
      { id: "dynamic", title: "الحقول الإضافية Dynamic Fields", model: "DynamicField" },
      { id: "nationalities", title: "الجنسيات", model: "Nationality" },
      { id: "types", title: "أنواع الموظفين", model: "EmploymentType" },
      { id: "status", title: "حالات الموظفين", model: "EmployeeStatus" },
      { id: "qualifications", title: "المؤهلات", model: "Qualification" },
      { id: "religion", title: "الديانات", model: "Religion" },
      { id: "gender", title: "الجنس", model: "Gender" },
      { id: "marital", title: "الحالة الاجتماعية", model: "MaritalStatus" },
      { id: "identity", title: "أنواع الهويات", model: "IdentityType" },
      { id: "passport", title: "أنواع الجوازات", model: "PassportType" },
      { id: "images", title: "إعدادات الصور", model: "ImageSetting" },
      { id: "upload", title: "إعدادات رفع الملفات", model: "UploadSetting" },
      { id: "signature", title: "إعدادات التوقيع", model: "SignatureSetting" },
      { id: "autonumber", title: "ترقيم الموظفين Auto Number", model: "AutoNumber" },
      { id: "empnumber", title: "الرقم الوظيفي", model: "EmpNumberSetting" },
      { id: "permissions", title: "صلاحيات الموظفين", model: "EmployeePermission" },
      { id: "reqfiles", title: "الملفات المطلوبة", model: "RequiredFile" },
      { id: "reqdocs", title: "الوثائق المطلوبة", model: "RequiredDoc" },
      { id: "contracts", title: "إعدادات العقود الافتراضية", model: "DefaultContract" }
    ],
    departments: [
      { id: "create", title: "إنشاء الإدارات", model: "Department" },
      { id: "hierarchy", title: "هيكل الإدارات", model: "DepartmentHierarchy" },
      { id: "colors", title: "ألوان الإدارات", model: "DepartmentColor" },
      { id: "order", title: "ترتيب الإدارات", model: "DepartmentOrder" },
      { id: "manager", title: "مدير الإدارة", model: "DepartmentManager" },
      { id: "budget", title: "الميزانية", model: "DepartmentBudget" },
      { id: "status", title: "الحالة", model: "DepartmentStatus" },
      { id: "permissions", title: "الصلاحيات", model: "DepartmentPermission" },
      { id: "reports", title: "إعدادات التقارير", model: "DepartmentReport" }
    ],
    branches: [
      { id: "city", title: "المدينة", model: "City" },
      { id: "region", title: "المنطقة", model: "Region" },
      { id: "country", title: "الدولة", model: "Country" },
      { id: "location", title: "الموقع الجغرافي", model: "GeoLocation" },
      { id: "maps", title: "Google Maps", model: "GoogleMapSetting" },
      { id: "hours", title: "ساعات العمل", model: "WorkHour" },
      { id: "hospitals", title: "ربط الفروع بالمستشفيات", model: "BranchHospital" },
      { id: "manager", title: "مدير الفرع", model: "BranchManager" },
      { id: "status", title: "الحالة", model: "BranchStatus" }
    ],
    hospitals: [
      { id: "general", title: "بيانات المستشفى", model: "Hospital" },
      { id: "logo", title: "الشعار", model: "HospitalLogo" },
      { id: "departments", title: "الأقسام الطبية", model: "MedicalDepartment" },
      { id: "beds", title: "عدد الأسرة", model: "BedCount" },
      { id: "capacity", title: "الطاقة الاستيعابية", model: "Capacity" },
      { id: "phone", title: "الهاتف", model: "HospitalPhone" },
      { id: "email", title: "البريد", model: "HospitalEmail" },
      { id: "location", title: "الموقع", model: "HospitalLocation" },
      { id: "city", title: "المدينة", model: "HospitalCity" },
      { id: "admin", title: "الإدارة", model: "HospitalAdmin" },
      { id: "branch", title: "الفرع", model: "HospitalBranch" },
      { id: "manager", title: "المدير", model: "HospitalManager" },
      { id: "status", title: "الحالة", model: "HospitalStatus" }
    ],
    positions: [
      { id: "titles", title: "المسميات الوظيفية", model: "Position" },
      { id: "grades", title: "الدرجات", model: "Grade" },
      { id: "ladder", title: "السلم الوظيفي", model: "CareerLadder" },
      { id: "description", title: "الوصف الوظيفي", model: "JobDescription" },
      { id: "minsalary", title: "الحد الأدنى للراتب", model: "MinSalary" },
      { id: "maxsalary", title: "الحد الأعلى", model: "MaxSalary" },
      { id: "reqqualifications", title: "المؤهلات المطلوبة", model: "RequiredQualification" },
      { id: "promotions", title: "الترقيات", model: "PromotionRule" }
    ],
    contracts: [
      { id: "types", title: "أنواع العقود", model: "ContractType" },
      { id: "duration", title: "مدة العقد", model: "ContractDuration" },
      { id: "renewal", title: "التجديد", model: "ContractRenewal" },
      { id: "esign", title: "التوقيع الإلكتروني", model: "ESignature" },
      { id: "templates", title: "قوالب العقود", model: "ContractTemplate" },
      { id: "notifications", title: "الإشعارات", model: "ContractNotification" },
      { id: "alerts", title: "التنبيهات", model: "ContractAlert" }
    ],
    attendance: [
      { id: "hours", title: "ساعات العمل", model: "WorkHour" },
      { id: "schedules", title: "الجداول", model: "Schedule" },
      { id: "fingerprint", title: "البصمة", model: "Fingerprint" },
      { id: "face", title: "Face Recognition", model: "FaceRecognition" },
      { id: "gps", title: "GPS", model: "GPSSetting" },
      { id: "qr", title: "QR", model: "QRSetting" },
      { id: "devices", title: "الأجهزة", model: "Device" },
      { id: "delay", title: "التأخير", model: "DelayPolicy" },
      { id: "absence", title: "الغياب", model: "AbsencePolicy" },
      { id: "permission", title: "الاستئذان", model: "PermissionPolicy" },
      { id: "partial", title: "الإجازات الجزئية", model: "PartialLeave" },
      { id: "edit", title: "السماح بالتعديل", model: "EditPolicy" },
      { id: "deductions", title: "سياسة الخصومات", model: "DeductionPolicy" }
    ],
    leave: [
      { id: "types", title: "أنواع الإجازات", model: "LeaveType" },
      { id: "balance", title: "الرصيد", model: "LeaveBalance" },
      { id: "approvals", title: "الموافقات", model: "LeaveApproval" },
      { id: "hierarchy", title: "التسلسل الإداري", model: "LeaveHierarchy" },
      { id: "sick", title: "المرضية", model: "SickLeave" },
      { id: "annual", title: "السنوية", model: "AnnualLeave" },
      { id: "emergency", title: "الطارئة", model: "EmergencyLeave" },
      { id: "unpaid", title: "بدون راتب", model: "UnpaidLeave" },
      { id: "compensation", title: "التعويض", model: "CompensationLeave" },
      { id: "carryover", title: "إعدادات الترحيل", model: "CarryoverSetting" }
    ],
    overtime: [
      { id: "types", title: "أنواع الأوفر تايم", model: "OvertimeType" },
      { id: "rate", title: "سعر الساعة", model: "OvertimeRate" },
      { id: "calculation", title: "طريقة الاحتساب", model: "OvertimeCalc" },
      { id: "permissions", title: "الصلاحيات", model: "OvertimePermission" },
      { id: "approvals", title: "الموافقات", model: "OvertimeApproval" },
      { id: "export_payroll", title: "التصدير للرواتب", model: "OvertimePayrollExport" },
      { id: "export_excel", title: "Excel", model: "OvertimeExcel" },
      { id: "export_pdf", title: "PDF", model: "OvertimePDF" },
      { id: "direct_link", title: "الربط المباشر مع الرواتب", model: "OvertimeDirectLink" }
    ],
    payroll: [
      { id: "ladder", title: "السلم", model: "SalaryLadder" },
      { id: "allowances", title: "البدلات", model: "Allowance" },
      { id: "deductions", title: "الخصومات", model: "Deduction" },
      { id: "bonuses", title: "المكافآت", model: "Bonus" },
      { id: "advances", title: "السلف", model: "Advance" },
      { id: "loans", title: "القروض", model: "Loan" },
      { id: "iban", title: "IBAN", model: "IBANSetting" },
      { id: "bank", title: "البنك", model: "Bank" },
      { id: "currency", title: "العملة", model: "Currency" },
      { id: "insurance", title: "التأمينات", model: "Insurance" },
      { id: "tax", title: "الضرائب", model: "Tax" },
      { id: "run_settings", title: "إعدادات مسير الرواتب", model: "PayrollRunSetting" },
      { id: "excel_templates", title: "Excel Templates", model: "ExcelTemplate" },
      { id: "bank_file", title: "Bank File Export", model: "BankFile" }
    ],
    performance: [
      { id: "kpis", title: "KPIs", model: "PerformanceKPI" },
      { id: "annual", title: "التقييم السنوي", model: "AnnualEval" },
      { id: "monthly", title: "التقييم الشهري", model: "MonthlyEval" },
      { id: "goals", title: "الأهداف", model: "Goal" },
      { id: "bonuses", title: "المكافآت", model: "PerformanceBonus" },
      { id: "promotions", title: "الترقيات", model: "PerformancePromotion" },
      { id: "notes", title: "الملاحظات", model: "PerformanceNote" }
    ],
    training: [
      { id: "courses", title: "الدورات", model: "TrainingCourse" },
      { id: "trainers", title: "المدربين", model: "Trainer" },
      { id: "certificates", title: "الشهادات", model: "Certificate" },
      { id: "exams", title: "الاختبارات", model: "Exam" },
      { id: "hours", title: "عدد الساعات", model: "TrainingHour" },
      { id: "credits", title: "الاعتمادات", model: "TrainingCredit" }
    ],
    assets: [
      { id: "types", title: "أنواع الأصول", model: "AssetCategory" },
      { id: "inventory", title: "الجرد", model: "Inventory" },
      { id: "handover", title: "التسليم", model: "Handover" },
      { id: "receive", title: "الاستلام", model: "Receive" },
      { id: "return", title: "الإرجاع", model: "Return" },
      { id: "maintenance", title: "الصيانة", model: "Maintenance" },
      { id: "depreciation", title: "الإهلاك", model: "Depreciation" },
      { id: "barcode", title: "الباركود", model: "Barcode" },
      { id: "qr", title: "QR", model: "AssetQR" }
    ]
  };

  const sections = settingsMap[module] || [{ id: "general", title: "إعدادات عامة", model: "AppSetting" }];
  const currentTabId = tab || sections[0].id;
  const currentSection = sections.find(s => s.id === currentTabId) || sections[0];

  return (
    <div className="space-y-6">
      <ModuleTabs module={module} />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">إعدادات {resource.title}</h1>
        <p className="text-muted-foreground mt-2">إدارة القوائم والتخصيصات الخاصة بالقسم.</p>
      </div>

      <SettingsLayout sections={sections} currentTab={currentTabId} module={module}>
        <Card className="border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader>
            <CardTitle>{currentSection.title}</CardTitle>
            <CardDescription>إدارة {currentSection.title} الخاصة بـ {resource.title}</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsCrud modelName={currentSection.model} title={currentSection.title} />
          </CardContent>
        </Card>
      </SettingsLayout>
    </div>
  );
}
