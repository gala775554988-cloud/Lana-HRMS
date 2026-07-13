"use client";

import { useEffect, useState, useTransition } from "react";
import { MapPin, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Site = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  assignmentType: "hospital" | "branch" | "department" | "sponsor" | "text";
  assignmentValue: string;
  isActive: boolean;
  requirePhoto?: boolean;
};

const blank: Omit<Site, "id"> = { name: "", latitude: 24.7136, longitude: 46.6753, radiusMeters: 250, assignmentType: "hospital", assignmentValue: "", isActive: true, requirePhoto: false };

export function AttendanceSitesClient({ initialSites }: { initialSites: Site[] }) {
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [form, setForm] = useState<any>(blank);
  const [pending, startTransition] = useTransition();

  useEffect(() => setSites(initialSites), [initialSites]);

  function edit(site: Site) { setForm(site); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function reset() { setForm(blank); }
  function save() {
    startTransition(async () => {
      const res = await fetch('/api/attendance/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.success) return alert(json.message || 'فشل الحفظ');
      setSites((prev) => [json.site, ...prev.filter((s) => s.id !== json.site.id)]);
      reset();
    });
  }
  function remove(id: string) {
    if (!confirm('تعطيل الموقع؟')) return;
    startTransition(async () => {
      const res = await fetch(`/api/attendance/sites?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) return alert(json.message || 'فشل التعطيل');
      setSites((prev) => prev.map((s) => s.id === id ? { ...s, isActive: false } : s));
    });
  }

  return (
    <main className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-black">مواقع حضور المشاريع والمستشفيات</h1>
        <p className="text-muted-foreground">اربط الموظفين بالموقع بمجرد كتابة اسم المستشفى/الفرع/الإدارة/الكفيل، بدون إضافة حقول جديدة في قاعدة البيانات.</p>
      </div>

      <Card className="rounded-3xl">
        <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-indigo-600" />إضافة / تعديل موقع</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="اسم الموقع / المستشفى" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input type="number" step="any" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} />
          <Input type="number" step="any" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} />
          <Input type="number" placeholder="النطاق بالمتر" value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: Number(e.target.value) })} />
          <select className="h-10 rounded-md border bg-background px-3" value={form.assignmentType} onChange={(e) => setForm({ ...form, assignmentType: e.target.value })}>
            <option value="hospital">حسب اسم المستشفى/الموقع</option>
            <option value="branch">حسب الفرع</option>
            <option value="department">حسب الإدارة</option>
            <option value="sponsor">حسب الكفيل</option>
            <option value="text">بحث ذكي في بيانات الموظف</option>
          </select>
          <Input placeholder="قيمة الربط: مثال مستشفى الملك فهد" value={form.assignmentValue} onChange={(e) => setForm({ ...form, assignmentValue: e.target.value })} />
          <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> نشط</label>
          <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(form.requirePhoto)} onChange={(e) => setForm({ ...form, requirePhoto: e.target.checked })} /> يتطلب صورة تحقق</label>
          <div className="flex gap-2 md:col-span-3">
            <Button disabled={pending || !form.name || !form.assignmentValue} onClick={save}><Save className="ml-2 h-4 w-4" />حفظ الموقع</Button>
            <Button variant="outline" onClick={reset}><Plus className="ml-2 h-4 w-4" />جديد</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sites.map((site) => (
          <Card key={site.id} className="rounded-3xl">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-black">{site.name}</h3><p className="text-xs text-muted-foreground">{site.latitude}, {site.longitude} · {site.radiusMeters}م</p></div>
                <span className={`rounded-full px-2 py-1 text-xs ${site.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{site.isActive ? 'نشط' : 'معطل'}</span>
              </div>
              <p className="text-sm">الربط: <strong>{site.assignmentType}</strong> = {site.assignmentValue}</p>
              <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => edit(site)}>تعديل</Button><Button size="sm" variant="destructive" onClick={() => remove(site.id)}><Trash2 className="h-4 w-4" /></Button></div>
            </CardContent>
          </Card>
        ))}
        {!sites.length && <div className="rounded-2xl border border-dashed p-8 text-muted-foreground">لا توجد مواقع حضور حتى الآن.</div>}
      </div>
    </main>
  );
}
