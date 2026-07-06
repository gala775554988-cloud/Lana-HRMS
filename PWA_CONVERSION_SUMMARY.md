# Lana HRMS PWA Conversion Summary

تم تحويل مشروع Lana HRMS إلى تطبيق ويب قابل للتثبيت PWA يعمل على الجوال والكمبيوتر من المتصفح.

## ما تم إضافته

- `app/manifest.ts` لتعريف التطبيق، الاسم، الأيقونات، وضع التشغيل standalone، والاختصارات.
- `components/pwa/pwa-register.tsx` لتسجيل Service Worker في وضع الإنتاج.
- `components/pwa/pwa-install-prompt.tsx` لإظهار زر تثبيت على Android/Chrome/Edge وتعليمات iOS.
- `public/sw.js` لتخزين ملفات التطبيق الثابتة فقط وإظهار صفحة offline آمنة عند انقطاع الإنترنت.
- `public/offline.html` صفحة انقطاع اتصال عربية.
- `public/icons/*` أيقونات PWA بأحجام 192 و512 وmaskable وأيقونة Apple.
- `public/favicon.svg` أيقونة المتصفح.
- تحديث `app/layout.tsx` ببيانات PWA وربط مكونات التثبيت.
- تحديث `README.md` بتعليمات PWA والنشر.
- تحديث `.env.example` بملاحظة روابط HTTPS للإنتاج.
- إضافة `dynamic = "force-dynamic"` في صفحات النظام المحمية لتجنب جلب بيانات HR أثناء build.

## التحقق الذي تم

تم تشغيل الأوامر التالية بنجاح:

```bash
npm ci
npx prisma generate
npm run typecheck
npm run build
```

نتيجة build ناجحة، وتم إنشاء مسار manifest:

```text
/manifest.webmanifest
```

## التشغيل مع Supabase

1. أنشئ مشروع Supabase.
2. انسخ روابط PostgreSQL إلى `.env`:
   - `DATABASE_URL`
   - `DIRECT_URL`
3. أنشئ أسرار Auth:

```bash
openssl rand -base64 32
```

4. اضبط هذه المتغيرات في `.env` محليًا أو في منصة النشر:

```env
AUTH_SECRET="..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://your-domain.com"
APP_URL="https://your-domain.com"
DATABASE_URL="..."
DIRECT_URL="..."
SUPABASE_URL="..."
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

5. طبّق قاعدة البيانات:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

6. ابنِ وشغّل:

```bash
npm run build
npm run start
```

## طريقة تثبيت التطبيق

- Android/Chrome/Edge: افتح الموقع ثم اضغط زر **تثبيت التطبيق** أو Install.
- iPhone/iPad: افتح الموقع في Safari، اضغط زر المشاركة، ثم **إضافة إلى الشاشة الرئيسية**.
- Windows/macOS/Linux: افتح الموقع في Chrome أو Edge ثم اختر install من شريط العنوان.

## ملاحظات مهمة

- لازم يكون الموقع على HTTPS حتى يظهر خيار التثبيت، باستثناء `localhost` أثناء التطوير.
- Service Worker لا يخزن صفحات المستخدمين أو API responses حتى لا تُحفظ بيانات الموارد البشرية الحساسة على الجهاز.
- هذا PWA وليس تطبيق App Store/Google Play Native. إذا رغبت برفعه للمتاجر، الخطوة التالية تكون تغليفه باستخدام Capacitor.

## تحديث الشعار والخلفية

تمت إضافة الصورة المرفقة كشعار رسمي للنظام في:

- `public/brand/lana-logo.png`
- الهيدر الرئيسي للموظف والمسؤول.
- صفحات الدخول والتحقق واستعادة كلمة المرور.
- صفحة البداية.
- نافذة تثبيت تطبيق PWA.
- صفحة عدم الاتصال بالإنترنت.
- أيقونات تثبيت التطبيق و favicon.

كما تمت إضافة خلفية/علامة مائية ثابتة وخفيفة للشعار عبر مكون:

- `components/brand/brand-background.tsx`

تم كذلك تكبير الخلفية وزيادة وضوح الشعار كعلامة مائية في كامل النظام.

وتمت إضافة أدلة التشغيل والنشر:

- `MOBILE_INSTALL_GUIDE.md`
- `VERCEL_SUPABASE_DEPLOY_AR.md`
- `.env.production.example`

كما تم تجهيز `vercel.json` و `package.json` بأوامر مناسبة للنشر على Vercel وتشغيل Prisma مع Supabase.

ومكون موحّد لاستخدام الشعار في كل النظام:

- `components/brand/brand-logo.tsx`
