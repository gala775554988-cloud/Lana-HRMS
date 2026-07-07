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
      { id: "nationalities", title: "الجنسيات", model: "Nationality" },
      { id: "types", title: "أنواع الموظفين", model: "EmploymentType" },
      { id: "status", title: "حالات الموظفين", model: "EmployeeStatus" },
      { id: "dynamic", title: "الحقول الإضافية", model: "DynamicField" },
      { id: "qualifications", title: "المؤهلات", model: "Qualification" },
    ],
    departments: [
      { id: "hierarchy", title: "هيكل الإدارات", model: "Department" },
      { id: "budget", title: "الميزانية", model: "DepartmentBudget" },
    ],
    branches: [
      { id: "general", title: "معلومات الفروع", model: "Branch" },
      { id: "locations", title: "الموقع الجغرافي", model: "BranchLocation" },
    ],
    hospitals: [
      { id: "general", title: "بيانات المستشفى", model: "Hospital" },
    ],
    positions: [
      { id: "general", title: "المسميات الوظيفية", model: "Position" },
    ],
    attendance: [
      { id: "policies", title: "ساعات العمل", model: "AttendancePolicy" },
    ],
    leave: [
      { id: "types", title: "أنواع الإجازات", model: "LeaveType" },
    ],
    overtime: [
      { id: "rates", title: "طريقة الاحتساب", model: "OvertimeRate" },
    ],
    payroll: [
      { id: "allowances", title: "البدلات", model: "Allowance" },
      { id: "deductions", title: "الخصومات", model: "Deduction" },
    ],
    performance: [
      { id: "kpis", title: "KPIs", model: "PerformanceKPI" },
    ],
    training: [
      { id: "courses", title: "الدورات", model: "TrainingCourse" },
    ],
    assets: [
      { id: "categories", title: "أنواع الأصول", model: "AssetCategory" },
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
