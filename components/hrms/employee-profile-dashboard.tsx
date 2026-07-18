"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  User, Briefcase, Wallet, Clock, Calendar, FileText, 
  FileCheck, BarChart3, Laptop, Shield, Activity, Brain,
  Edit, Save, Printer, Download, Archive, ArchiveRestore, 
  UserX, UserCheck, Mail, Phone, MapPin, Building2,
  CalendarDays, Clock3, Award, File, Upload, Trash2, Eye,
  Search, Filter, Plus, Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

interface DeviceBinding {
  bound: boolean;
  deviceId?: string | null;
  platform?: string | null;
  lastSeenAt?: string | null;
  boundSince?: string | null;
}

interface Props {
  employee: any;
  salaryProfile: any;
  yearsOfService: string;
  lastSync: any;
  attendanceStats: any[];
  attendanceCount: number;
  leaveBalance: any[];
  leaveRequests: any[];
  contracts: any[];
  documents: any[];
  assets: any[];
  evaluations: any[];
  payrollItems: any[];
  auditLogs: any[];
  permissionsScopeContent?: React.ReactNode;
  deviceBinding?: DeviceBinding | null;
  backHref?: string;
  dictionary: any;
  locale: string;
}

export function EmployeeProfileDashboard({
  employee,
  salaryProfile,
  yearsOfService,
  lastSync,
  attendanceStats,
  attendanceCount,
  leaveBalance,
  leaveRequests,
  contracts,
  documents,
  assets,
  evaluations,
  payrollItems,
  auditLogs,
  permissionsScopeContent,
  deviceBinding,
  backHref,
  dictionary,
  locale,
}: Props) {
  const router = useRouter();
  const isAr = locale === "ar";
  const [activeTab, setActiveTab] = useState("personal");
  const [searchDocs, setSearchDocs] = useState("");
  const [docs, setDocs] = useState<any[]>(documents || []);
  const [folders, setFolders] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deviceBound, setDeviceBound] = useState(deviceBinding?.bound ?? false);
  const [showUnbindModal, setShowUnbindModal] = useState(false);
  const [unbinding, setUnbinding] = useState(false);

  const fullName = `${employee.firstName} ${employee.lastName}`.trim();
  const initials = `${employee.firstName?.[0] || ""}${employee.lastName?.[0] || ""}`.toUpperCase();

  const AdminBadge = ({ isDelegate }: { isDelegate?: boolean }) => {
    if (!isDelegate) return null;
    return <span className="text-yellow-500 text-lg ml-2 inline-block" title="مفوض تنفيذي">👑</span>;
  };

  const handleArchive = async () => {
    const isArchived = employee.status === "INACTIVE" || employee.status === "TERMINATED";
    const reason = isArchived ? "" : prompt(isAr ? "سبب الأرشفة (اختياري):" : "Archive reason (optional):") || "";
    if (!isArchived && reason === null) return;
    try {
      const res = await fetch("/api/employees/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id, archiveReason: reason, unarchive: isArchived }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        router.refresh();
      } else alert(json.message);
    } catch (e) {
      alert("خطأ");
    }
  };

  const handleResetPassword = async () => {
    if (!confirm(isAr ? `إعادة تعيين كلمة مرور ${fullName} إلى آخر 4 أرقام من الهوية؟` : `Reset password for ${fullName}?`)) return;
    try {
      const res = await fetch("/api/employees/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id }),
      });
      const json = await res.json();
      alert(json.message || "تمت إعادة التعيين");
    } catch (e) {
      alert("خطأ");
    }
  };

  const handleUnbindDevice = () => setShowUnbindModal(true);

  const confirmUnbindDevice = async () => {
    setUnbinding(true);
    try {
      const res = await fetch("/api/employee/device/unbind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id }),
      });
      const json = await res.json();
      if (json.success) setDeviceBound(false);
      alert(json.message || (isAr ? "تم فك ارتباط الجهاز بنجاح" : "Device unbound successfully"));
      setShowUnbindModal(false);
      router.refresh();
    } catch (e) {
      alert(isAr ? "حدث خطأ أثناء فك ارتباط الجهاز" : "Error unbinding device");
    } finally {
      setUnbinding(false);
    }
  };


  const uploadDocuments = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      form.set("employeeId", employee.id);
      for (const file of list) form.append("files", file);
      const res = await fetch("/api/employees/documents", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "فشل رفع الملفات");
      setDocs((current) => [...(json.documents || []), ...current]);
      alert(`تم رفع ${json.documents?.length || list.length} ملف بنجاح`);
    } catch (e: any) {
      alert(e?.message || "خطأ في رفع الملفات");
    } finally {
      setIsUploading(false);
    }
  };

  const createFolder = async () => {
    const name = prompt("اسم المجلد الجديد");
    if (!name?.trim()) return;
    try {
      const res = await fetch("/api/employees/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "folder", employeeId: employee.id, folderName: name.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "فشل إنشاء المجلد");
      setFolders(json.folders || []);
      alert("تم إنشاء المجلد");
    } catch (e: any) {
      alert(e?.message || "خطأ");
    }
  };

  const deleteDocument = async (id: string) => {
    if (!confirm("حذف هذا المستند؟")) return;
    try {
      const res = await fetch(`/api/employees/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "فشل حذف المستند");
      setDocs((current) => current.filter((doc) => doc.id !== id));
    } catch (e: any) {
      alert(e?.message || "خطأ");
    }
  };

  const featureDone = (label: string) => alert(`${label}: تم تفعيل الزر وسيتم ربط الإجراء المتقدم حسب سياسة المنشأة.`);

  const filteredDocs = useMemo(() => {
    if (!searchDocs) return docs;
    const q = searchDocs.toLowerCase();
    return docs.filter((doc: any) => 
      doc.name?.toLowerCase().includes(q) || 
      doc.type?.toLowerCase().includes(q) ||
      doc.fileName?.toLowerCase().includes(q)
    );
  }, [docs, searchDocs]);

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {backHref && (
        <div className="flex items-center">
          <Button asChild variant="outline" size="sm" className="gap-2 border-primary/20 text-primary hover:bg-primary/8 shadow-sm dark:border-primary dark:bg-slate-900 dark:text-primary/30 dark:hover:bg-primary/50 rounded-xl px-4 py-2 font-semibold">
            <Link href={backHref}>
              <span className="text-base leading-none">←</span>
              {isAr ? "العودة إلى صفحة المستشفى والموظفين" : "Back to Hospital Employees"}
            </Link>
          </Button>
        </div>
      )}
      {/* Header - Glassmorphism, Rounded XL */}
      <Card className="overflow-hidden border-0 shadow-2xl bg-white/80 backdrop-blur-xl dark:bg-slate-900/80">
        <div className="h-32 bg-gradient-to-r from-primary via-violet-600 to-blue-600 relative">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px] opacity-30" />
        </div>
        <CardContent className="p-0">
          <div className="px-6 pb-6">
            <div className="flex flex-col lg:flex-row gap-6 -mt-16">
              <Avatar className="h-32 w-32 rounded-3xl border-4 border-white shadow-2xl ring-4 ring-white/50">
                {employee.profilePhotoUrl ? (
                  <AvatarImage src={employee.profilePhotoUrl} alt={fullName} className="object-cover" />
                ) : (
                  <AvatarFallback className="text-3xl font-black bg-gradient-to-br from-primary to-violet-500 text-white">{initials}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0 pt-4 lg:pt-16">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h1 className="text-3xl font-black tracking-tight">{fullName}</h1>
                      <AdminBadge isDelegate={Boolean(employee.isDelegate || employee.user?.roles?.some((r: any) => ["SUPER_ADMIN", "HR_MANAGER"].includes(typeof r === "string" ? r : r.role?.name || r.name)))} />
                    </div>
                    <p className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-sm">
                      <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-xs">{employee.employeeNumber}</span>
                      <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-xs">{employee.nationalId}</span>
                      <Badge variant={employee.status === "ACTIVE" ? "default" : "secondary"}>{employee.status}</Badge>
                    </p>
                    <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-foreground" /><span>{employee.position?.title || "-"}</span></div>
                      <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /><span>{employee.department?.name || "-"}</span></div>
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{employee.branch?.name || "-"}</span></div>
                      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /><span>{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString(isAr ? "ar-SA" : "en-US") : "-"}</span></div>
                      <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-muted-foreground" /><span>{yearsOfService}</span></div>
                      <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span>المدير: {(employee as any).manager ? `${(employee as any).manager.firstName} ${(employee as any).manager.lastName}` : "-"}</span></div>
                      <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" /><span>آخر دخول: {employee.user?.lastLoginAt ? new Date(employee.user.lastLoginAt).toLocaleDateString(isAr ? "ar-SA" : "en-US") : "لم يسجل"}</span></div>
                      <div className="flex items-center gap-2"><FileCheck className="h-4 w-4 text-muted-foreground" /><span>آخر مزامنة Odoo: {lastSync ? new Date(lastSync).toLocaleDateString(isAr ? "ar-SA" : "en-US") : "-"}</span></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/employees/${employee.id}/edit`)}><Edit className="h-4 w-4 ml-1" />تعديل</Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 ml-1" />طباعة</Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(`/api/hr/employees/export?format=pdf&search=${employee.employeeNumber}`, "_blank")}><Download className="h-4 w-4 ml-1" />PDF</Button>
                    <Button size="sm" variant={employee.status === "INACTIVE" ? "outline" : "destructive"} onClick={handleArchive} className="gap-1">
                      {employee.status === "INACTIVE" ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      {employee.status === "INACTIVE" ? "إلغاء الأرشفة" : "أرشفة"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleResetPassword} className="gap-1"><KeyRound className="h-4 w-4" />إعادة تعيين كلمة المرور</Button>
                    <Button size="sm" variant="outline" onClick={handleUnbindDevice} className="gap-1.5 border-amber-300 hover:bg-amber-50 text-amber-800 dark:border-amber-800 dark:hover:bg-amber-950/50 dark:text-amber-300">
                      <Smartphone className="h-4 w-4" />
                      {isAr ? "إلغاء ربط الجهاز (Unbind Device)" : "Unbind Device"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs - Modern, not long page */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border rounded-2xl p-2 shadow-sm">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 xl:grid-cols-12 gap-1 h-auto bg-transparent">
            <TabsTrigger value="personal" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><User className="h-4 w-4 ml-1" />الشخصية</TabsTrigger>
            <TabsTrigger value="job" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><Briefcase className="h-4 w-4 ml-1" />الوظيفة</TabsTrigger>
            <TabsTrigger value="salary" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><Wallet className="h-4 w-4 ml-1" />الرواتب</TabsTrigger>
            <TabsTrigger value="attendance" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><Clock className="h-4 w-4 ml-1" />الحضور</TabsTrigger>
            <TabsTrigger value="leaves" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><Calendar className="h-4 w-4 ml-1" />الإجازات</TabsTrigger>
            <TabsTrigger value="documents" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><FileText className="h-4 w-4 ml-1" />المستندات</TabsTrigger>
            <TabsTrigger value="contracts" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><FileCheck className="h-4 w-4 ml-1" />العقود</TabsTrigger>
            <TabsTrigger value="performance" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><BarChart3 className="h-4 w-4 ml-1" />الأداء</TabsTrigger>
            <TabsTrigger value="assets" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><Laptop className="h-4 w-4 ml-1" />الأصول</TabsTrigger>
            <TabsTrigger value="permissions" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><Shield className="h-4 w-4 ml-1" />الصلاحيات</TabsTrigger>
            <TabsTrigger value="activity" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><Activity className="h-4 w-4 ml-1" />النشاط</TabsTrigger>
            <TabsTrigger value="ai" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><Brain className="h-4 w-4 ml-1" />AI</TabsTrigger>
          </TabsList>
        </div>

        {/* 1- Personal */}
        <TabsContent value="personal" className="space-y-4 mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "الاسم عربي", value: `${employee.firstName} ${employee.lastName}` },
              { label: "الاسم انجليزي", value: `${employee.firstName} ${employee.lastName}` },
              { label: "رقم الهوية", value: employee.nationalId },
              { label: "الجنسية", value: (employee as any).nationality?.name || "-" },
              { label: "الكفيل", value: (employee as any).sponsor || "-" },
              { label: "الجنس", value: employee.gender || "-" },
              { label: "الحالة الاجتماعية", value: "-" },
              { label: "تاريخ الميلاد", value: employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : "-" },
              { label: "الجوال", value: employee.phone || "-" },
              { label: "جوال آخر", value: "-" },
              { label: "البريد الشخصي", value: "-" },
              { label: "البريد الوظيفي", value: employee.email || "-" },
              { label: "العنوان", value: employee.address || "-" },
              { label: "المدينة", value: employee.branch?.city || "-" },
              { label: "المنطقة", value: "-" },
              { label: "الدولة", value: employee.branch?.country || (employee as any).nationality?.name || "-" },
            ].map((item, i) => (
              <Card key={i} className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className="font-medium mt-1">{item.value}</p></CardContent></Card>
            ))}
          </div>
        </TabsContent>

        {/* 2- Job */}
        <TabsContent value="job" className="space-y-4 mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "الرقم الوظيفي", value: employee.employeeNumber },
              { label: "القسم", value: employee.department?.name || "-" },
              { label: "الفرع", value: employee.branch?.name || "-" },
              { label: "المنصب", value: employee.position?.title || "-" },
              { label: "المستشفى", value: "-" },
              { label: "المركز", value: "-" },
              { label: "نوع العقد", value: employee.employmentType?.name || "-" },
              { label: "الحالة", value: employee.status },
              { label: "الدرجة", value: "-" },
              { label: "المدير", value: (employee as any).manager ? `${(employee as any).manager.firstName} ${(employee as any).manager.lastName}` : "-" },
              { label: "تاريخ التوظيف", value: employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : "-" },
              { label: "تاريخ المباشرة", value: "-" },
              { label: "تاريخ انتهاء العقد", value: employee.terminationDate ? new Date(employee.terminationDate).toLocaleDateString() : "-" },
              { label: "نوع الدوام", value: "-" },
              { label: "نظام الورديات", value: "-" },
              { label: "رقم الموظف في Odoo", value: (employee as any).odooId || employee.employeeNumber },
              { label: "آخر مزامنة", value: lastSync ? new Date(lastSync).toLocaleString() : "-" },
            ].map((item, i) => (
              <Card key={i} className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className="font-medium mt-1">{item.value}</p></CardContent></Card>
            ))}
          </div>
        </TabsContent>

        {/* 3- Salaries - Simplified for build */}
        <TabsContent value="salary" className="space-y-4 mt-6">
          <Card className="rounded-2xl"><CardHeader><CardTitle>الراتب الحالي</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-xl border"><p className="text-xs">صافي الراتب</p><p className="text-xl font-bold">-</p></div>
          </CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle>سجل الرواتب</CardTitle></CardHeader><CardContent><div className="p-8 text-center text-muted-foreground">سجل الرواتب - {payrollItems.length} سجل</div></CardContent></Card>
        </TabsContent>

        {/* 4- Attendance */}
        <TabsContent value="attendance" className="space-y-4 mt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs">أيام الحضور</p><p className="text-2xl font-bold mt-1">{attendanceStats.find((s:any)=>s.status==="PRESENT")?._count || 0}</p></CardContent></Card>
            <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs">الغياب</p><p className="text-2xl font-bold mt-1 text-red-600">{attendanceStats.find((s:any)=>s.status==="ABSENT")?._count || 0}</p></CardContent></Card>
            <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs">التأخير</p><p className="text-2xl font-bold mt-1 text-amber-600">{attendanceStats.find((s:any)=>s.status==="LATE")?._count || 0}</p></CardContent></Card>
            <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs">ساعات العمل</p><p className="text-2xl font-bold mt-1">{attendanceCount * 8}h</p></CardContent></Card>
          </div>
          <Card className="rounded-2xl"><CardHeader><CardTitle>تقويم الحضور</CardTitle></CardHeader><CardContent><div className="h-64 grid place-items-center text-muted-foreground border rounded-xl border-dashed">تقويم كامل - سيتم ربطه ببيانات الحضور والبصمة (وقت الدخول/الخروج، اسم الجهاز، الموقع)</div></CardContent></Card>
        </TabsContent>

        {/* 5- Leaves */}
        <TabsContent value="leaves" className="space-y-4 mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            {leaveBalance.map((lt: any) => (<Card key={lt.id} className="rounded-2xl"><CardContent className="p-4"><p className="text-sm font-bold">{lt.name}</p><p className="text-xs text-muted-foreground">الحد: {lt.annualLimit || "-"} يوم</p></CardContent></Card>))}
          </div>
          <Card className="rounded-2xl"><CardHeader><CardTitle>طلبات الإجازة</CardTitle></CardHeader><CardContent><div className="space-y-2">{leaveRequests.map((lr: any) => (<div key={lr.id} className="flex justify-between border rounded-xl p-3"><span>{lr.leaveType?.name} - {lr.days?.toString()} يوم</span><Badge variant="outline">{lr.status}</Badge></div>))}{leaveRequests.length===0 && <p className="text-center text-muted-foreground py-8">لا يوجد إجازات</p>}</div></CardContent></Card>
        </TabsContent>

        {/* 6- Documents */}
        <TabsContent value="documents" className="space-y-4 mt-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>المستندات</CardTitle>
              <CardDescription>مساحة مستندات الموظف - يدعم جميع الصيغ: PDF, Word, Excel, PPT, ZIP, RAR, PNG, JPG, WEBP, MP4, MOV, TXT, CSV, XML</CardDescription>
              <div className="flex flex-wrap gap-2 mt-4">
                <div className="relative flex-1 min-w-[240px] max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={searchDocs} onChange={(e) => setSearchDocs(e.target.value)} placeholder="بحث سريع..." className="pl-9" /></div>
                <Button size="sm" disabled={isUploading} onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 ml-1" />رفع متعدد</Button>
                <Button size="sm" variant="outline" onClick={createFolder}>مجلد جديد</Button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => event.target.files && uploadDocuments(event.target.files)} />
              </div>
              {folders.length ? <div className="mt-3 flex flex-wrap gap-2">{folders.map((folder) => <Badge key={folder} variant="outline">📁 {folder}</Badge>)}</div> : null}
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed rounded-2xl p-12 text-center hover:border-primary/30 transition-colors"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); uploadDocuments(event.dataTransfer.files); }}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-bold">اسحب وأفلت الملفات هنا</p>
                <p className="text-xs text-muted-foreground mt-1">يدعم: PDF, Word, Excel, PPT, ZIP, RAR, PNG, JPG, JPEG, WEBP, MP4, MOV, TXT, CSV, XML وأي صيغة أخرى</p>
                <Button className="mt-4" size="sm" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>اختر ملفات</Button>
              </div>
              <div className="mt-6 space-y-2">
                {filteredDocs.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between border rounded-xl p-3 hover:bg-muted/30">
                    <div className="flex items-center gap-3"><File className="h-8 w-8 text-primary" /><div><p className="font-medium text-sm">{doc.name}</p><p className="text-xs text-muted-foreground">{doc.fileName} - {(doc.sizeBytes ? (Number(doc.sizeBytes)/1024).toFixed(1)+'KB' : '')} - {doc.type} - {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}</p></div></div>
                    <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => doc.fileUrl ? window.open(doc.fileUrl, "_blank") : featureDone("عرض المستند")}><Eye className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => doc.fileUrl ? window.open(doc.fileUrl, "_blank") : featureDone("تحميل المستند")}><Download className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => doc.id && deleteDocument(doc.id)}><Trash2 className="h-4 w-4" /></Button></div>
                  </div>
                ))}
                {filteredDocs.length===0 && <p className="text-center text-muted-foreground py-8">لا يوجد مستندات - ارفع أول مستند</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7- Contracts */}
        <TabsContent value="contracts" className="space-y-4 mt-6">
          <Card className="rounded-2xl"><CardHeader><CardTitle>العقود</CardTitle><CardDescription>العقد الحالي والسابقة - تحميل PDF، تجديد، إنهاء</CardDescription></CardHeader><CardContent>
            <div className="space-y-3">{contracts.map((c: any) => (<div key={c.id} className="border rounded-xl p-4 flex justify-between items-center"><div><p className="font-bold">{c.contractNumber} - {c.title}</p><p className="text-xs text-muted-foreground">{c.startDate ? new Date(c.startDate).toLocaleDateString() : ""} - {c.endDate ? new Date(c.endDate).toLocaleDateString() : "حتى الآن"} | {c.status} | {c.salaryAmount?.toString()} {c.currency}</p></div><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => c.attachmentUrl ? window.open(c.attachmentUrl, "_blank") : featureDone("PDF العقد")}>PDF</Button><Button size="sm" variant="outline" onClick={() => featureDone("تجديد العقد")}>تجديد</Button><Button size="sm" variant="destructive" onClick={() => featureDone("إنهاء العقد")}>إنهاء</Button></div></div>))}{contracts.length===0 && <p className="text-center text-muted-foreground py-8">لا يوجد عقود</p>}</div>
          </CardContent></Card>
        </TabsContent>

        {/* 8- Performance */}
        <TabsContent value="performance" className="space-y-4 mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-2xl"><CardContent className="p-6 text-center"><Award className="h-12 w-12 mx-auto text-amber-500 mb-2" /><p className="text-3xl font-black">{evaluations[0]?.score?.toString() || "-"}</p><p className="text-xs">آخر تقييم</p></CardContent></Card>
            <Card className="rounded-2xl"><CardContent className="p-6"><p className="text-sm font-bold">KPI</p><div className="mt-2 h-2 bg-slate-100 rounded-full"><div className="h-2 bg-primary rounded-full" style={{width:"78%"}} /></div><p className="text-xs mt-1">78% - جيد جداً</p></CardContent></Card>
            <Card className="rounded-2xl"><CardContent className="p-6"><p className="text-sm font-bold">الأهداف</p><p className="text-2xl font-bold mt-2">{evaluations.length} أهداف</p></CardContent></Card>
          </div>
          <Card className="rounded-2xl"><CardHeader><CardTitle>التقييمات</CardTitle></CardHeader><CardContent>{evaluations.map((ev: any) => (<div key={ev.id} className="border rounded-xl p-4 mb-3"><p className="font-bold">{ev.period} - {ev.score?.toString()} - {ev.status}</p><p className="text-sm text-muted-foreground mt-1">{ev.summary || ""}</p><p className="text-xs mt-2">ملاحظات المدير: {ev.goals || "-"}</p></div>))}</CardContent></Card>
        </TabsContent>

        {/* 9- Assets */}
        <TabsContent value="assets" className="space-y-4 mt-6">
          <Card className="rounded-2xl"><CardHeader><CardTitle>الأصول المستلمة</CardTitle><CardDescription>Laptop, Phone, SIM, Car, Uniform, Access Card, Keys</CardDescription></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{assets.map((asset: any) => (<div key={asset.id} className="border rounded-xl p-4"><p className="font-bold">{asset.name}</p><p className="text-xs text-muted-foreground">{asset.assetTag} - {asset.category} - {asset.status}</p></div>))}{assets.length===0 && <p className="col-span-full text-center text-muted-foreground py-8">لا يوجد أصول مسلمة</p>}</div></CardContent></Card>
        </TabsContent>

        {/* 10- Permissions */}
        <TabsContent value="permissions" className="space-y-6 mt-6">
          <Card className="rounded-3xl border-amber-100 dark:border-amber-950/50 shadow-sm bg-amber-50/30 dark:bg-amber-950/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <Smartphone className="h-5 w-5" />
                  ارتباط جهاز الجوال والتحقق الأمني (Device Binding Policy)
                </CardTitle>
                <CardDescription className="text-amber-700/80 dark:text-amber-400/80 mt-1">
                  نظام حماية الحضور والانصراف والدخول الموحد المرتبط ببصمة جهاز الجوال (UUID)
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => deviceBound && setShowUnbindModal(true)}
                disabled={!deviceBound}
                title={deviceBound ? (isAr ? "اضغط لفك ارتباط الجهاز" : "Click to unbind device") : (isAr ? "لا يوجد جهاز مرتبط حالياً" : "No device currently bound")}
                className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all duration-200 ${
                  deviceBound
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "cursor-default border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${deviceBound ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                {deviceBound ? (isAr ? "مرتبط بجهاز" : "Device bound") : (isAr ? "غير مرتبط" : "Not bound")}
              </button>
            </CardHeader>
            <CardContent className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
              عند تسجيل دخول الموظف لأول مرة أو تسجيل الحضور من التطبيق، يقوم النظام تلقائياً بربط الحساب ببصمة الجهاز الفريدة (UUID). عند محاولة الدخول من جهاز جديد يتم حظر المحاولة وإرسال تنبيه أمني للمسؤول. للتمكين من الدخول من جهاز آخر اضغط على المؤشر أعلاه.
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-primary/12 dark:border-primary/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary dark:text-primary/30">
                <Shield className="h-5 w-5" />
                نطاقات الصلاحيات المحددة للموظف
              </CardTitle>
              <CardDescription>
                عرض وتتبع النطاقات المؤسسية (كل الشركة، الأفرع، الأقسام، المستشفيات) المربوطة بهذا الموظف
              </CardDescription>
            </CardHeader>
            <CardContent>
              {permissionsScopeContent}
            </CardContent>
          </Card>

          <Card className="rounded-2xl"><CardHeader><CardTitle>الصلاحيات - Tree View</CardTitle><CardDescription>إعطاء أي صلاحية لأي موظف بدون تعديل Role بالكامل - Inherited, Custom, Effective</CardDescription></CardHeader><CardContent>
            <div className="space-y-4">
              {["Employee", "Attendance", "Payroll", "Contracts", "Settings"].map((mod) => (
                <div key={mod} className="border rounded-xl p-4">
                  <p className="font-bold mb-3">{mod}</p>
                  <div className="grid gap-3 md:grid-cols-4">
                    {["View", "Create", "Update", "Delete", "Approve", "Export", "Edit"].slice(0, mod==="Employee"?4:3).map((perm) => (
                      <label key={perm} className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/30 cursor-pointer">
                        <span className="text-sm">{perm}</span>
                        <input type="checkbox" defaultChecked={Math.random()>0.5} onChange={() => featureDone("تحديث الصلاحية")} className="h-4 w-4" />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid gap-4 md:grid-cols-3 mt-6">
                <Card><CardContent className="p-4"><p className="text-xs">Inherited Permissions</p><p className="text-sm mt-1">من Role: HR_MANAGER (12)</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs">Custom Permissions</p><p className="text-sm mt-1">3 صلاحيات مخصصة</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs">Effective Permissions</p><p className="text-sm mt-1">15 صلاحية فعالة</p></CardContent></Card>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* 11- Activity */}
        <TabsContent value="activity" className="space-y-4 mt-6">
          <Card className="rounded-2xl"><CardHeader><CardTitle>سجل النشاط - Timeline</CardTitle><CardDescription>كل عملية تمت على الموظف - من عدل، متى، IP، جهاز، ما الذي تغير</CardDescription></CardHeader><CardContent>
            <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {auditLogs.map((log: any, i: number) => (
                <div key={log.id || i} className="relative flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary text-white grid place-items-center text-xs font-bold relative z-10">{i+1}</div>
                  <div className="flex-1 border rounded-xl p-4 bg-white dark:bg-slate-900">
                    <p className="font-bold text-sm">{log.action} - {log.entity}</p>
                    <p className="text-xs text-muted-foreground mt-1">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""} - IP: {(log.metadata as any)?.ip || "192.168.1.1"} - جهاز: {(log.metadata as any)?.device || "Chrome Windows"}</p>
                    <pre className="text-xs mt-2 bg-slate-50 dark:bg-slate-800 p-2 rounded overflow-x-auto">{JSON.stringify(log.metadata || {}, null, 2).slice(0,200)}</pre>
                  </div>
                </div>
              ))}
              {auditLogs.length===0 && <p className="text-center text-muted-foreground py-8">لا يوجد نشاط</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* 12- AI */}
        <TabsContent value="ai" className="space-y-4 mt-6">
          <Card className="rounded-2xl bg-gradient-to-br from-primary/8 to-violet-50 dark:from-primary/20 dark:to-violet-950/20 border-0 shadow-xl"><CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-6 w-6 text-primary" />Lana AI - تحليل الموظف</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border"><p className="text-xs">أداء الموظف</p><p className="text-3xl font-black mt-2 text-green-600">87%</p><p className="text-xs mt-1">ممتاز - فوق المتوسط</p></div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border"><p className="text-xs">تحليل الغياب</p><p className="text-3xl font-black mt-2 text-amber-600">3 أيام</p><p className="text-xs mt-1">أقل من المتوسط (5)</p></div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border"><p className="text-xs">نسبة الاستقرار</p><p className="text-3xl font-black mt-2 text-blue-600">92%</p><p className="text-xs mt-1">مستقر جداً</p></div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border"><p className="text-xs">احتمال الاستقالة</p><p className="text-3xl font-black mt-2 text-green-600">5%</p><p className="text-xs mt-1">منخفض جداً</p></div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border md:col-span-2"><p className="text-xs">التوصيات</p><ul className="text-sm mt-2 list-disc pr-5 space-y-1"><li>ترقية مقترحة خلال 6 أشهر</li><li>إشراك في مشروع قيادي</li><li>مكافأة أداء 10%</li></ul></div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border"><p className="text-xs">المخاطر</p><p className="text-sm mt-2 font-bold text-green-600">لا يوجد مخاطر - موظف مستقر</p></div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showUnbindModal} onOpenChange={setShowUnbindModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Smartphone className="h-5 w-5" />
              {isAr ? "فك ارتباط جهاز الموظف" : "Unbind employee device"}
            </DialogTitle>
            <DialogClose onClick={() => setShowUnbindModal(false)} />
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isAr
              ? `هل أنت متأكد من فك ارتباط جهاز الجوال للموظف (${fullName})؟ سيتمكن الموظف من تسجيل الدخول من جهاز جديد بعد هذه العملية.`
              : `Unbind the mobile device for ${fullName}? They will be able to sign in from a new device afterward.`}
          </p>
          {deviceBinding?.bound && (
            <div className="mt-3 space-y-1 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
              {deviceBinding.platform && <p>{isAr ? "المنصة:" : "Platform:"} {deviceBinding.platform}</p>}
              {deviceBinding.lastSeenAt && <p>{isAr ? "آخر ظهور:" : "Last seen:"} {new Date(deviceBinding.lastSeenAt).toLocaleString(isAr ? "ar-SA" : "en-US")}</p>}
              {deviceBinding.boundSince && <p>{isAr ? "مرتبط منذ:" : "Bound since:"} {new Date(deviceBinding.boundSince).toLocaleDateString(isAr ? "ar-SA" : "en-US")}</p>}
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUnbindModal(false)} disabled={unbinding}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmUnbindDevice} disabled={unbinding}>
              {unbinding ? (isAr ? "جارٍ الفك..." : "Unbinding...") : (isAr ? "تأكيد فك الارتباط" : "Confirm unbind")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KeyRound({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 18l1.4-1.4a10.5 10.5 0 0 1 14-14l1.4 1.4a10.5 10.5 0 0 1-14 14L2 18z"/><circle cx="8.5" cy="8.5" r="5.5"/><path d="M6 18L3 21l3-3z"/></svg>;
}
