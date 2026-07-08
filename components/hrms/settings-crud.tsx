"use client";
import { useState, useEffect, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, Search, Save, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSettingsData, saveSettingData, deleteSettingData } from "@/lib/hrms/settings-actions";

export function SettingsCrud({ modelName, title }: { modelName: string, title: string }) {
  const [search, setSearch] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "", isActive: true });
  const [errorMsg, setErrorMsg] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await getSettingsData(modelName, search);
    setData(result);
    setLoading(false);
  }, [modelName, search]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { fetchData(); }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchData]);

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setEditForm({ name: record.name, code: record.code, isActive: record.isActive });
    setErrorMsg("");
  };

  const handleNew = () => {
    setEditingId("new");
    setEditForm({ name: "", code: "", isActive: true });
    setErrorMsg("");
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveSettingData(modelName, { id: editingId, ...editForm });
      if (res.success) {
        setEditingId(null);
        fetchData();
        setErrorMsg("");
      } else {
        setErrorMsg("حدث خطأ أثناء الحفظ: " + res.error);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    startTransition(async () => {
      const res = await deleteSettingData(modelName, id);
      if (res.success) {
        fetchData();
      } else {
        setErrorMsg("حدث خطأ أثناء الحذف: " + res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {errorMsg && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{errorMsg}</div>}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground rtl:right-auto rtl:left-3" />
          <Input 
            placeholder={`بحث في ${title}...`} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9 rtl:pe-9 rtl:ps-3" 
          />
        </div>
        <Button onClick={handleNew} disabled={editingId !== null || isPending} className="w-full sm:w-auto shrink-0 gap-2">
          <Plus className="h-4 w-4" /> إضافة جديد
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left rtl:text-right text-muted-foreground">
          <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">الكود / الرمز</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium w-[120px]">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></td></tr>
            ) : data.length === 0 && editingId !== "new" ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>
            ) : null}

            {editingId === "new" && (
              <tr className="bg-muted/30">
                <td className="px-4 py-2"><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="الاسم..." autoFocus className="h-8" /></td>
                <td className="px-4 py-2"><Input value={editForm.code} onChange={e => setEditForm({...editForm, code: e.target.value})} placeholder="الكود..." className="h-8" /></td>
                <td className="px-4 py-2">
                  <Button variant={editForm.isActive ? "default" : "outline"} onClick={() => setEditForm({...editForm, isActive: !editForm.isActive})} size="sm" className={editForm.isActive ? "h-8 bg-emerald-500 hover:bg-emerald-600" : "h-8"}>
                    {editForm.isActive ? "نشط" : "غير نشط"}
                  </Button>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <Button onClick={handleSave} disabled={!editForm.name || isPending} variant="ghost" size="icon" className="h-8 w-8 text-emerald-600"><Save className="h-4 w-4" /></Button>
                    <Button onClick={() => setEditingId(null)} variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><X className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            )}

            {data.map((record) => editingId === record.id ? (
              <tr key={record.id} className="bg-muted/30">
                <td className="px-4 py-2"><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} autoFocus className="h-8" /></td>
                <td className="px-4 py-2"><Input value={editForm.code} onChange={e => setEditForm({...editForm, code: e.target.value})} className="h-8" /></td>
                <td className="px-4 py-2">
                  <Button variant={editForm.isActive ? "default" : "outline"} onClick={() => setEditForm({...editForm, isActive: !editForm.isActive})} size="sm" className={editForm.isActive ? "h-8 bg-emerald-500 hover:bg-emerald-600" : "h-8"}>
                    {editForm.isActive ? "نشط" : "غير نشط"}
                  </Button>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <Button onClick={handleSave} disabled={!editForm.name || isPending} variant="ghost" size="icon" className="h-8 w-8 text-emerald-600"><Save className="h-4 w-4" /></Button>
                    <Button onClick={() => setEditingId(null)} variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><X className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={record.id} className="hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{record.name}</td>
                <td className="px-4 py-3">{record.code}</td>
                <td className="px-4 py-3">
                  <Badge variant={record.isActive ? "default" : "outline"} className={record.isActive ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20" : "text-slate-500"}>
                    {record.isActive ? "نشط" : "غير نشط"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button onClick={() => handleEdit(record)} disabled={isPending || editingId !== null} variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50"><Edit className="h-4 w-4" /></Button>
                    <Button onClick={() => handleDelete(record.id)} disabled={isPending || editingId !== null} variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
