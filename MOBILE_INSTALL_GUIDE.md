# طريقة تثبيت Lana HRMS على الجوال

هذا المشروع الآن يعمل كتطبيق PWA، يعني يتم فتحه من المتصفح ثم تثبيته على شاشة الجوال مثل التطبيق.

إذا لم تنشر النظام بعد، ابدأ أولًا بملف:

```txt
VERCEL_SUPABASE_DEPLOY_AR.md
```

## قبل التثبيت

لازم يكون النظام منشور على رابط HTTPS، مثل:

```text
https://your-domain.com
```

مهم: التثبيت الكامل لا يظهر من ملف ZIP مباشرة. لازم ترفع النظام على Vercel أو سيرفر أو أي استضافة تدعم HTTPS، وتربطه بقاعدة بيانات Supabase.

## 1) تجهيز الرابط للنشر

في منصة النشر، أضف متغيرات البيئة التالية:

```env
DATABASE_URL="رابط قاعدة Supabase"
DIRECT_URL="رابط Direct من Supabase"
SUPABASE_URL="رابط مشروع Supabase"
SUPABASE_ANON_KEY="مفتاح anon"
SUPABASE_SERVICE_ROLE_KEY="مفتاح service role"
AUTH_SECRET="سر عشوائي قوي"
NEXTAUTH_SECRET="نفس السر أو سر قوي آخر"
NEXTAUTH_URL="https://your-domain.com"
APP_URL="https://your-domain.com"
AUTH_TRUST_HOST="true"
```

تقدر تولد السر بهذا الأمر:

```bash
openssl rand -base64 32
```

ثم طبّق قاعدة البيانات:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

وبعدها شغل الإنتاج:

```bash
npm run build
npm run start
```

## 2) تثبيت التطبيق على Android

### Chrome

1. افتح رابط النظام من Chrome.
2. سجّل الدخول أو انتظر ظهور رسالة التثبيت.
3. اضغط **تثبيت التطبيق** إذا ظهرت.
4. إذا ما ظهرت: اضغط الثلاث نقاط ⋮ أعلى المتصفح.
5. اختر **Install app** أو **Add to Home screen**.
6. اضغط **Install / Add**.
7. سيظهر تطبيق Lana HRMS على الشاشة الرئيسية.

### Samsung Internet

1. افتح رابط النظام.
2. اضغط القائمة.
3. اختر **Add page to**.
4. اختر **Home screen**.
5. اضغط **Add**.

## 3) تثبيت التطبيق على iPhone / iPad

مهم: استخدم Safari، لأن iOS لا يثبت PWA بشكل صحيح من Chrome.

1. افتح رابط النظام في Safari.
2. اضغط زر المشاركة.
3. اختر **إضافة إلى الشاشة الرئيسية** / **Add to Home Screen**.
4. اكتب الاسم: `Lana HRMS` إذا لم يظهر تلقائيًا.
5. اضغط **إضافة** / **Add**.
6. سيظهر التطبيق على شاشة الآيفون.

## 4) إذا لم يظهر خيار التثبيت

تأكد من التالي:

- الرابط يبدأ بـ `https://`.
- التطبيق مبني بوضع production وليس dev فقط.
- متغيرات `APP_URL` و `NEXTAUTH_URL` فيها نفس رابط الموقع.
- افتح الموقع مرة واحدة وانتظر 10 إلى 30 ثانية.
- في Android جرّب Chrome أو Edge.
- في iPhone استخدم Safari فقط.
- امسح الكاش أو افتح نافذة جديدة إذا كان الموقع قديمًا.

## 5) ملاحظة مهمة عن البيانات

التطبيق يحتاج إنترنت للوصول لبيانات الموظفين والرواتب والطلبات، لأن النظام يحمي بيانات HR ولا يخزن صفحات المستخدم أو بيانات API على الجهاز.
