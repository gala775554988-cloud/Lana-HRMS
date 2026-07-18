"use client";

import { useMemo, useState, useTransition } from 'react';
import { Camera, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = { employee: any; settings: Record<string, any> };
const tabs = [
  ['personal','المعلومات الشخصية'], ['job','الوظيفة'], ['bank','الحساب البنكي'], ['family','العائلة'], ['qualifications','المؤهلات'], ['experiences','الخبرات'], ['skills','المهارات'], ['languages','اللغات']
] as const;

function Field({ label, value }: { label: string; value: any }) { return <div className="rounded-2xl border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value || '—'}</p></div>; }

export function EmployeeProfilePortal({ employee, settings }: Props) {
  const [tab, setTab] = useState('personal');
  const [data, setData] = useState<Record<string, any>>(settings);
  const [pending, startTransition] = useTransition();
  const fullName = `${employee.firstName} ${employee.lastName}`.trim();
  const [personal, setPersonal] = useState({ phone: employee.phone || '', email: employee.email || '', address: employee.address || '', gender: employee.gender || '', dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().slice(0,10) : '' });
  function savePersonal() {
    startTransition(async () => {
      const res = await fetch('/api/employee/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(personal) });
      const json = await res.json();
      if (!json.success) alert(json.error || 'تعذر حفظ البيانات الشخصية');
    });
  }

  function save(section: string, value: any) {
    setData((d) => ({ ...d, [section]: value }));
    startTransition(async () => { await fetch('/api/employee/portal-sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section, data: value }) }); });
  }
  function addRow(section: string) { const rows = Array.isArray(data[section]) ? data[section] : []; save(section, [...rows, { id: crypto.randomUUID(), title: '', org: '', from: '', to: '', notes: '' }]); }
  function updateRow(section: string, id: string, key: string, value: string) { save(section, (data[section] || []).map((r: any) => r.id === id ? { ...r, [key]: value } : r)); }
  function deleteRow(section: string, id: string) { save(section, (data[section] || []).filter((r: any) => r.id !== id)); }

  async function uploadPhoto(file?: File) {
    if (!file) return;
    const form = new FormData(); form.set('file', file);
    const res = await fetch('/api/uploads', { method: 'POST', body: form });
    const json = await res.json();
    if (json.success) location.reload();
  }

  const rows = useMemo(() => Array.isArray(data[tab]) ? data[tab] : [], [data, tab]);

  return <main className="space-y-6" dir="rtl">
    <Card className="rounded-3xl overflow-hidden"><div className="h-28 bg-gradient-to-l from-primary to-violet-600" /><CardContent className="p-6"><div className="flex flex-col gap-4 md:flex-row md:items-end -mt-20"><div className="relative h-32 w-32 overflow-hidden rounded-3xl bg-muted ring-4 ring-white">{employee.profilePhotoUrl ? <img src={employee.profilePhotoUrl} className="h-full w-full object-cover" alt={fullName} /> : <div className="grid h-full w-full place-items-center text-3xl font-black">{employee.firstName?.[0]}{employee.lastName?.[0]}</div>}</div><div className="flex-1"><h1 className="text-3xl font-black">{fullName}</h1><p className="text-muted-foreground">{employee.position?.title || '—'} · {employee.department?.name || '—'}</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2 font-bold"><Camera className="h-4 w-4" /> تغيير الصورة<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} /></label></div></CardContent></Card>
    <div className="overflow-x-auto rounded-2xl border bg-card p-2"><div className="flex min-w-max gap-2">{tabs.map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab===id?'bg-primary text-white':'hover:bg-muted'}`}>{label}</button>)}</div></div>
    {tab === 'personal' && <Card className="rounded-3xl"><CardHeader><CardTitle>المعلومات الشخصية</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><Field label="الاسم" value={fullName}/><Field label="الهوية" value={employee.nationalId}/><label className="space-y-1"><span className="text-sm text-muted-foreground">الجوال</span><Input value={personal.phone} onChange={e=>setPersonal({...personal, phone:e.target.value})}/></label><label className="space-y-1"><span className="text-sm text-muted-foreground">البريد</span><Input value={personal.email} onChange={e=>setPersonal({...personal, email:e.target.value})}/></label><Field label="الجنسية" value={employee.nationality?.name}/><label className="space-y-1"><span className="text-sm text-muted-foreground">الجنس</span><Input value={personal.gender} onChange={e=>setPersonal({...personal, gender:e.target.value})}/></label><label className="space-y-1"><span className="text-sm text-muted-foreground">تاريخ الميلاد</span><Input type="date" value={personal.dateOfBirth} onChange={e=>setPersonal({...personal, dateOfBirth:e.target.value})}/></label><label className="space-y-1 md:col-span-2"><span className="text-sm text-muted-foreground">العنوان</span><Input value={personal.address} onChange={e=>setPersonal({...personal, address:e.target.value})}/></label><Field label="الحالة الاجتماعية" value={data.family?.maritalStatus}/><div className="md:col-span-3"><Button disabled={pending} onClick={savePersonal}><Save className="ml-2 h-4 w-4"/>حفظ البيانات الشخصية</Button></div></CardContent></Card>}
    {tab === 'job' && <Card className="rounded-3xl"><CardHeader><CardTitle>الوظيفة</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><Field label="الرقم الوظيفي" value={employee.employeeNumber}/><Field label="القسم" value={employee.department?.name}/><Field label="الفرع" value={employee.branch?.name}/><Field label="المدير" value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : ''}/><Field label="المسمى" value={employee.position?.title}/><Field label="نوع العقد" value={employee.employmentType?.name}/><Field label="تاريخ التعيين" value={employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('ar-SA') : null}/></CardContent></Card>}
    {tab === 'bank' && <EditableObject title="الحساب البنكي" value={data.bank || {}} onSave={(v) => save('bank', v)} pending={pending} />}
    {tab === 'family' && <EditableObject title="العائلة وجهات الطوارئ" value={data.family || {}} onSave={(v) => save('family', v)} pending={pending} />}
    {['qualifications','experiences','skills','languages'].includes(tab) && <Card className="rounded-3xl"><CardHeader><div className="flex items-center justify-between"><CardTitle>{tabs.find(([id])=>id===tab)?.[1]}</CardTitle><Button onClick={()=>addRow(tab)}><Plus className="ml-2 h-4 w-4" />إضافة</Button></div></CardHeader><CardContent className="space-y-3">{rows.map((row:any)=><div key={row.id} className="grid gap-2 rounded-2xl border p-3 md:grid-cols-5"><Input placeholder="العنوان" value={row.title||''} onChange={e=>updateRow(tab,row.id,'title',e.target.value)}/><Input placeholder="الجهة" value={row.org||''} onChange={e=>updateRow(tab,row.id,'org',e.target.value)}/><Input placeholder="من" value={row.from||''} onChange={e=>updateRow(tab,row.id,'from',e.target.value)}/><Input placeholder="إلى" value={row.to||''} onChange={e=>updateRow(tab,row.id,'to',e.target.value)}/><Button variant="destructive" onClick={()=>deleteRow(tab,row.id)}><Trash2 className="h-4 w-4" /></Button></div>)}{!rows.length && <div className="rounded-2xl border border-dashed p-6 text-muted-foreground">لا توجد بيانات مسجلة في هذا القسم.</div>}</CardContent></Card>}
  </main>;
}

function EditableObject({ title, value, onSave, pending }: { title: string; value: any; onSave: (v:any)=>void; pending: boolean }) {
  const [local, setLocal] = useState(value || {});
  const fields = title.includes('بنكي') ? [['bank','البنك'],['iban','IBAN'],['account','الحساب']] : [['maritalStatus','الحالة الاجتماعية'],['spouse','الزوجة'],['children','الأبناء'],['emergency','جهات الاتصال للطوارئ']];
  return <Card className="rounded-3xl"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{fields.map(([k,l])=><label key={k} className="space-y-1"><span className="text-sm text-muted-foreground">{l}</span><Input value={local[k]||''} onChange={e=>setLocal({...local,[k]:e.target.value})}/></label>)}<div className="md:col-span-2"><Button disabled={pending} onClick={()=>onSave(local)}><Save className="ml-2 h-4 w-4" />حفظ</Button></div></CardContent></Card>;
}
