#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lana HRMS - Official Python Trigger Client for Odoo Full Sync Engine
---------------------------------------------------------------------
هذا السكربت هو الأداة المعتمدة لتشغيل مزامنة Odoo الشاملة عبر استدعاء محرك النظام الداخلي
(OdooSyncService.ts) في Vercel + Neon بدلاً من الاتصال المباشر بقاعدة البيانات.

المميزات الأمنيّة والهندسية المدمجة في الخادم عند استدعاء هذا الرابط:
1. التنسيق الموحد (formatEmployeeCode): إضافة البادئة 00 تلقائياً لأكواد الموظفين (00XXXXX).
2. معالجة مصفوفات Many2one: تفكيك قوائم Odoo [id, "Name"] للأقسام والشركات والمديرين.
3. ربط كيان المستشفيات والمدارس: تحويل حقل x_studio_school_name إلى Hospital و Branch.
4. حماية السرية البنكية: استبعاد كافة الحقول البنكية وأرقام الـ IBAN تلقائياً.
5. المزامنة الذكية (Smart Upsert): الحفاظ على سجلات الحضور والطلبات التاريخية للموظفين.
"""

import os
import sys
import json
import requests

# إعدادات الاتصال بمحرك Lana HRMS على Vercel
LANA_BASE_URL = os.getenv("LANA_BASE_URL", "https://lana-hrms-lanahr.vercel.app")
INTERNAL_SYNC_TOKEN = os.getenv("INTERNAL_SYNC_TOKEN", "ce1bf82bdaf46ba65a577cd0cb892e675c87d1a1f2c0ad470a0a4d02dcb9a9a0")

def trigger_full_resync(wipe_and_sync: bool = False):
    url = f"{LANA_BASE_URL.rstrip('/')}/api/integrations/odoo/sync/full-resync"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {INTERNAL_SYNC_TOKEN}",
        "x-internal-sync-token": INTERNAL_SYNC_TOKEN
    }
    payload = {
        "wipeAndSync": wipe_and_sync
    }

    print(f"🚀 [Lana HRMS] إرسال نبضة مزامنة إلى: {url}")
    print(f"📦 [Lana HRMS] وضع المزامنة: {'المسح وإعادة البناء (Full Wipe & Resync)' if wipe_and_sync else 'المزامنة الذكية الشاملة (Smart Upsert)'}")

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=300)
        result = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"raw": response.text}

        if response.status_code in (200, 201) and result.get("success", False):
            print("\n✅ [نجاح المزامنة] استجاب محرك Lana HRMS وأتم المزامنة بكفاءة:")
            print(f"   - الرسالة: {result.get('message', 'تمت العمليات بنجاح')}")
            print(f"   - عدد الموظفين المحدثين: {result.get('count', 0)}")
            return True
        else:
            print(f"\n❌ [فشل أو رفض الصلاحية] رمز الاستجابة: {response.status_code}")
            print(f"   - التفاصيل: {json.dumps(result, ensure_ascii=False, indent=2)}")
            return False

    except requests.exceptions.RequestException as err:
        print(f"\n⚠️ [خطأ في الاتصال بالسيرفر]: {err}")
        return False

if __name__ == "__main__":
    # تشغيل المزامنة الذكية الافتراضية عند تنفيذ السكربت من موجّه الأوامر
    wipe_mode = "--wipe" in sys.argv
    success = trigger_full_resync(wipe_and_sync=wipe_mode)
    sys.exit(0 if success else 1)
