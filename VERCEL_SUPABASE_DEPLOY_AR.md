# نشر Lana HRMS على Vercel + Supabase وتثبيته كتطبيق جوال

هذا الدليل يوصلك من ملف المشروع إلى رابط HTTPS يمكن تثبيته على الجوال كتطبيق PWA.

---

## النتيجة النهائية

بعد تنفيذ الخطوات سيكون عندك:

- قاعدة بيانات Supabase.
- نظام Lana HRMS منشور على Vercel برابط HTTPS.
- تطبيق قابل للتثبيت على Android و iPhone من المتصفح.
- شعار Lana ظاهر في كل النظام وخلفية النظام.

---

## مهم قبل البداية

إذا كان عندك GitHub token سابقًا ظهر في محادثة أو رسالة، احذفه فورًا من GitHub ثم أنشئ واحد جديد عند الحاجة.

لا ترفع ملف `.env` إلى GitHub.

---

## المتطلبات

- حساب GitHub.
- حساب Vercel.
- حساب Supabase.
- Node.js مثبت على جهازك إذا بتشغل أوامر محلية.

---

## 1) رفع المشروع إلى GitHub

إذا المشروع عندك كملف ZIP:

1. فك الضغط.
2. ادخل مجلد المشروع.
3. ارفع الملفات إلى GitHub repository.

أوامر اختيارية من جهازك:

```bash
git init
git add .
git commit -m "Prepare Lana HRMS PWA production deployment"
git branch -M main
git remote add origin https://github.com/USERNAME/Lana-HRMS.git
git push -u origin main
```

استبدل `USERNAME` باسم حسابك.

---

## 2) إنشاء قاعدة Supabase

1. ادخل Supabase.
2. اضغط **New project**.
3. اختر اسم المشروع مثل: `lana-hrms`.
4. احفظ كلمة مرور قاعدة البيانات في مكان آمن.
5. بعد إنشاء المشروع افتح:

```text
Project Settings > Database
```

خذ رابطين:

### DATABASE_URL

استخدم رابط Pooler/Transaction pooler إن توفر، ويكون غالبًا بهذا الشكل:

```env
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[POOLER_HOST]:6543/postgres?pgbouncer=true&connection_limit=1"
```

### DIRECT_URL

استخدم رابط Direct connection، ويكون غالبًا بهذا الشكل:

```env
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
```

إذا Supabase أعطاك صيغة مختلفة، استخدم نفس الصيغة التي يعرضها لك Supabase.

---

## 3) أخذ مفاتيح Supabase API

من Supabase افتح:

```text
Project Settings > API
```

انسخ:

```env
SUPABASE_URL="https://[PROJECT_REF].supabase.co"
SUPABASE_ANON_KEY="anon public key"
SUPABASE_SERVICE_ROLE_KEY="service_role key"
```

مهم: لا تنشر `SERVICE_ROLE_KEY` للناس، فقط ضعه في Vercel Environment Variables.

---

## 4) توليد أسرار تسجيل الدخول

على macOS/Linux:

```bash
openssl rand -base64 32
```

على Windows PowerShell أو أي جهاز فيه Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

استخدم الناتج في:

```env
AUTH_SECRET="..."
NEXTAUTH_SECRET="..."
```

---

## 5) نشر المشروع على Vercel

1. افتح Vercel.
2. اضغط **Add New Project**.
3. اختر GitHub repository الخاص بالمشروع.
4. Vercel سيكتشف أنه Next.js.
5. تأكد من الإعدادات:

```text
Install Command: npm ci
Build Command: npm run vercel-build
Framework: Next.js
```

هذه الإعدادات موجودة مسبقًا في `vercel.json`.

---

## 6) إضافة Environment Variables في Vercel

من Vercel افتح:

```text
Project Settings > Environment Variables
```

أضف القيم التالية:

```env
DATABASE_URL="..."
DIRECT_URL="..."
SUPABASE_URL="..."
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
AUTH_SECRET="..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://your-vercel-domain.vercel.app"
APP_URL="https://your-vercel-domain.vercel.app"
AUTH_TRUST_HOST="true"
SEED_ADMIN_EMAIL="admin@lana.local"
```

بعد أول Deploy سيعطيك Vercel رابط مثل:

```text
https://lana-hrms-xxxx.vercel.app
```

ارجع وعدل:

```env
NEXTAUTH_URL
APP_URL
```

وخليهم نفس رابط Vercel النهائي، ثم اضغط **Redeploy**.

---

## 7) تشغيل المايجريشن والبيانات الأولية

بعد إضافة متغيرات البيئة، تحتاج إنشاء الجداول وإضافة الحسابات التجريبية.

### الطريقة الأسهل من جهازك

داخل مجلد المشروع:

```bash
npm ci
cp .env.production.example .env
```

عدّل ملف `.env` وضع نفس قيم Vercel/Supabase.

ثم شغل:

```bash
npm run prisma:deploy
npm run prisma:seed
```

### طريقة بديلة باستخدام Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env
npm ci
npm run prisma:deploy
npm run prisma:seed
```

---

## 8) بيانات الدخول الافتراضية

بعد تشغيل seed:

### المسؤول

```text
username: admin
password: Admin@123456
```

أو حسب شاشة الدخول:

```text
البريد/المستخدم: admin
كلمة المرور: Admin@123456
```

### موظف تجريبي

```text
رقم الهوية: 1000000001
كلمة المرور: Employee@123456
```

يفضل تغيير كلمات المرور بعد أول دخول.

---

## 9) تثبيت التطبيق على Android

استخدم Chrome أو Edge:

1. افتح رابط النظام، مثال:

```text
https://lana-hrms-xxxx.vercel.app
```

2. انتظر ثواني حتى تظهر رسالة التثبيت.
3. اضغط **تثبيت التطبيق**.
4. إذا لم تظهر الرسالة:
   - اضغط الثلاث نقاط ⋮.
   - اختر **Install app** أو **Add to Home screen**.
   - اضغط **Install** أو **Add**.
5. سيظهر تطبيق **Lana HRMS** على الشاشة الرئيسية.

---

## 10) تثبيت التطبيق على iPhone / iPad

استخدم Safari فقط:

1. افتح رابط النظام في Safari.
2. اضغط زر المشاركة.
3. اختر:

```text
Add to Home Screen
```

أو بالعربي:

```text
إضافة إلى الشاشة الرئيسية
```

4. اضغط **Add / إضافة**.
5. سيظهر التطبيق على شاشة الآيفون.

---

## 11) إذا لم يظهر خيار التثبيت

تأكد من التالي:

- الرابط يبدأ بـ `https://`.
- فتحت الرابط في Chrome/Edge على Android أو Safari على iPhone.
- `APP_URL` و `NEXTAUTH_URL` في Vercel نفس رابط الموقع.
- أعد نشر المشروع بعد تعديل المتغيرات.
- افتح الموقع وانتظر 10 إلى 30 ثانية.
- جرّب حذف الكاش أو فتح نافذة جديدة.
- إذا كان التطبيق مثبتًا قديمًا، احذفه وثبته من جديد حتى يظهر الشعار والتحديث الجديد.

---

## 12) ملاحظات أمان

- لا تحفظ مفاتيح Supabase في GitHub.
- لا تضع `SERVICE_ROLE_KEY` في الواجهة الأمامية.
- لا ترسل GitHub Token أو مفاتيح Vercel لأي أحد.
- غيّر كلمات المرور الافتراضية بعد أول تشغيل.
- التطبيق لا يخزن بيانات HR الحساسة Offline، فقط ملفات ثابتة وأيقونات وصفحة Offline.
