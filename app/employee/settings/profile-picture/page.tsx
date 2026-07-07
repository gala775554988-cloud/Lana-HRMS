'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImagePlus, Save, Trash2, User } from 'lucide-react';

export default function ProfilePicturePage() {
  const { data: session, update } = useSession();
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState((session?.user as any)?.image || null);
  const [previewUrl, setPreviewUrl] = useState((session?.user as any)?.image || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('الرجاء اختيار صورة فقط');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة يجب أن يكون أقل من 2 ميجابايت');
      return;
    }

    setSelectedFile(file);
    setRemovePhoto(false);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRemovePhoto(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let nextPhotoUrl: string | null = photoUrl;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: formData });
        const uploadData = await uploadResponse.json();
        if (!uploadData.url) throw new Error(uploadData.message || 'فشل رفع الصورة');
        nextPhotoUrl = uploadData.url;
      }

      if (removePhoto) nextPhotoUrl = null;

      const res = await fetch('/api/employee/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePhotoUrl: nextPhotoUrl ?? '' }),
      });

      if (!res.ok) throw new Error('فشل في حفظ الصورة');

      await update({ image: nextPhotoUrl });
      setPhotoUrl(nextPhotoUrl);
      setPreviewUrl(nextPhotoUrl);
      setSelectedFile(null);
      setRemovePhoto(false);
      alert('تم حفظ التغييرات بنجاح');
    } catch (err: any) {
      console.error(err);
      alert('فشل في حفظ الصورة. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const hasPendingChange = Boolean(selectedFile || removePhoto);

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>الصورة الشخصية</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-center">
        <div className="flex justify-center">
          {previewUrl ? (
            <img src={previewUrl} alt="صورة شخصية" className="h-28 w-28 rounded-full object-cover border-4 border-white shadow" />
          ) : (
            <div className="h-28 w-28 rounded-full bg-slate-200 flex items-center justify-center">
              <User className="h-10 w-10 text-slate-400" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <label className="inline-block">
            <div className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl cursor-pointer transition">
              <ImagePlus className="h-4 w-4" />
              اختر صورة جديدة
            </div>
            <input type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.svg,.heic,.heif,.avif" className="hidden" onChange={handleSelect} disabled={saving} />
          </label>
          {previewUrl ? (
            <Button type="button" variant="destructive" onClick={handleRemove} disabled={saving} className="rounded-2xl gap-2">
              <Trash2 className="h-4 w-4" />
              حذف الصورة
            </Button>
          ) : null}
        </div>

        <Button type="button" onClick={handleSave} disabled={saving || !hasPendingChange} className="w-full rounded-2xl gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </Button>

        <p className="text-xs text-slate-500">
          يتم رفع الصورة وحفظها فقط بعد الضغط على حفظ التغييرات.
        </p>
      </CardContent>
    </Card>
  );
}
