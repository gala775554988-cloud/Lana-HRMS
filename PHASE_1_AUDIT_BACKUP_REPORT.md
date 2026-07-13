# Lana HRMS — Phase 1 Audit & Backup Report

تاريخ التنفيذ: 2026-07-13  
النطاق: المرحلة الأولى فقط — Backup + Audit + خطة آمنة للمرحلة الثانية  
الحالة: مكتملة بدون تعديل تسجيل الدخول، وبدون حذف بيانات، وبدون تغيير قاعدة البيانات.

---

## 1) نقطة الرجوع الحالية

تم تثبيت نقطة الرجوع البرمجية الحالية:

```text
Git HEAD: 270fd992b04fd65b41eb0fe71f33192911347fd2
```

آخر إصدارات مهمة قريبة:

```text
270fd99 Add lightweight cache and load test tooling
b1d590d Optimize employee portal navigation and dashboard load
5128284 Default BioTime sync URL and defer AI widget
6e8ade1 Improve session hydration and shell responsiveness
5584ed9 Add manual BioTime attendance sync button
```

---

## 2) النسخة الاحتياطية

تم إنشاء نسخة احتياطية من:

- `prisma/schema.prisma`
- مجلد `prisma/migrations`
- Manifest كامل
- Logical data dump لكل جداول Prisma الموجودة

المسار المحلي للنسخة:

```text
/home/user/Lana-HRMS/backups/phase1-20260713T162345Z
```

حجم النسخة:

```text
57 MB
```

نتيجة النسخ:

```text
Models scanned: 164
Backup errors: 0
Total exported rows: 4149
```

أمثلة عدادات الجداول:

```text
Employee: 1605
AttendanceRecord: 57
Notification: 18
LeaveRequest: 5
AuditLog: 174
EmployeeSalaryAdvance: 0
EmployeeComplaint: 0
```

> ملاحظة: هذه نسخة Logical Backup داخل Workspace وليست بديلًا عن Snapshot رسمي من Supabase. قبل أي Migration في مراحل لاحقة يجب أخذ Snapshot/Backup رسمي من Supabase Dashboard أيضاً.

---

## 3) ما لم يتم لمسه في المرحلة الأولى

تم الالتزام بالتالي:

- لم يتم حذف أي بيانات.
- لم يتم حذف أي جدول.
- لم يتم تغيير Schema قاعدة البيانات.
- لم يتم إنشاء Migration.
- لم يتم تعديل تسجيل الدخول أو الخروج.
- لم يتم تغيير Middleware أو Auth في هذه المرحلة.
- لم يتم نشر أي تعديل جديد ضمن هذه المرحلة.

---

## 4) تقييم سريع لحالة النظام الحالية

### 4.1 نقاط القوة الحالية

- النظام يعمل على Next.js 15.
- Prisma مستخدم بشكل مركزي.
- يوجد فصل واضح بين Employee Portal و HRMS Portal.
- تم تحسين أجزاء من الأداء سابقاً:
  - تقليل Prefetch العشوائي.
  - تحسين Employees page.
  - إضافة كاش خفيف.
  - تحسين session hydration.
  - تحسين Employee Dashboard.
- تكامل BioTime أصبح له زر يدوي.
- تكامل Odoo موجود وموسع.

### 4.2 أخطر مناطق النظام

هذه الملفات لا يجب تعديلها إلا بمرحلة مستقلة واختبارات خاصة:

```text
auth.ts
middleware.ts
config/auth.ts
app/login/login-form.tsx
app/api/auth/force-change-password/route.ts
app/api/auth/change-password/route.ts
```

السبب: أي خطأ فيها قد يكسر تسجيل الدخول أو جلسات الموظفين.

### 4.3 مناطق الأداء الثقيلة

```text
app/(hrms)/dashboard/page.tsx
app/(hrms)/[module]/page.tsx
app/(hrms)/employees/[id]/page.tsx
lib/hrms/actions.ts
lib/employee/portal.ts
components/enterprise/notification-bell.tsx
app/api/integrations/odoo/sync/*
app/api/integrations/biotime/sync-attendance/route.ts
```

### 4.4 أسباب البطء المتبقية المحتملة

- بعض صفحات HR لا تزال تعتمد على استعلامات Server مباشرة متعددة.
- بعض المزامنات تعمل داخل Request مباشر وليس Queue.
- الكاش الحالي Memory فقط، أي أنه غير مشترك بين كل Serverless Instances.
- بعض الصفحات الثقيلة مثل Dashboard HR تحمل JS كبير.
- بعض الجداول تحتاج Indexes إضافية لاحقاً بعد تحليل Query Plan.

---

## 5) تقييم قاعدة البيانات

المرحلة الأولى لم تغيّر قاعدة البيانات.

### الوضع الحالي

- قاعدة البيانات Supabase Postgres.
- تم استخدام Pooler سابقاً وتحسين connection limits.
- الجداول الأساسية موجودة.
- عدد الموظفين الحالي في النسخة: 1605.
- سجلات الحضور الحالية في النسخة: 57.

### ملاحظات مهمة

تغيير قاعدة البيانات إلى Neon ليس أول خطوة موصى بها الآن. الأفضل:

1. تحسين Query patterns.
2. إضافة Indexes آمنة إذا ثبتت الحاجة.
3. استخدام Queue للعمليات الثقيلة.
4. إضافة Redis/Vercel KV إذا وافقت لاحقاً.
5. بعدها فقط نقرر نقل DB إن بقي البطء.

---

## 6) خطة المرحلة الثانية المقترحة

المرحلة الثانية يجب أن تكون **Performance Stabilization بدون تغيير قاعدة البيانات**.

### أهداف المرحلة الثانية

- لا تغيير في تسجيل الدخول.
- لا Migration.
- لا حذف بيانات.
- لا حذف ميزات.
- تحسين سرعة Employee Portal وHRMS Portal.
- تقليل ضغط قاعدة البيانات.
- فصل العمليات الثقيلة عن الواجهات قدر الإمكان.

### أعمال المرحلة الثانية المقترحة

#### A) تحسين Employee Portal

- إضافة cache قصير للصفحات التي تتكرر.
- تحويل الصفحات الثقيلة إلى Server + Client split أو dynamic components.
- تقليل استعلامات `requireEmployee` إذا أمكن بدون كسر العلاقات.
- تحسين صفحات:
  - `/employee/dashboard`
  - `/employee/attendance`
  - `/employee/profile`
  - `/employee/documents`
  - `/employee/settings`

#### B) تحسين HRMS Portal

- تحسين `/employees` أكثر.
- منع أي Prefetch ثقيل.
- جعل الجداول الثقيلة تستخدم pagination صارمة.
- تأجيل مكونات غير ضرورية.

#### C) تحسين APIs

- تقليل استعلامات notification bell.
- إضافة cache headers للطلبات الآمنة.
- فصل sync endpoints الثقيلة في مرحلة لاحقة.

#### D) Load Test

تشغيل:

```bash
CONCURRENCY=25 DURATION=30 node scripts/load-test.mjs
CONCURRENCY=50 DURATION=30 node scripts/load-test.mjs
CONCURRENCY=100 DURATION=30 node scripts/load-test.mjs
```

وتوثيق:

- p50
- p95
- p99
- failed requests
- أبطأ Routes

---

## 7) الأشياء التي لا أنصح بها في المرحلة الثانية

لا أنصح حالياً بـ:

- إعادة تنظيم المشروع بالكامل مرة واحدة.
- نقل قاعدة البيانات.
- تعديل `auth.ts`.
- تعديل `middleware.ts`.
- حذف ملفات قديمة قبل تحديد اعتمادها.
- Migration قبل Snapshot رسمي من Supabase.

---

## 8) قرار الانتقال للمرحلة الثانية

المرحلة الأولى اكتملت بنجاح.

يمكن بدء المرحلة الثانية بأمان إذا كان نطاقها:

```text
Performance Stabilization بدون Migration وبدون تعديل Auth
```

إذا وافقت، يكون الأمر المناسب:

```text
ابدأ المرحلة الثانية
```
