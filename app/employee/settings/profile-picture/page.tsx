'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, User } from 'lucide-react';

export default function ProfilePicturePage() {
  const { data: session, update } = useSession();
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState((session?.user as any)?.image || null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      alert('الرجاء اختيار صورة فقط');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await fetch('/api/uploads', { 
        method: 'POST', 
        body: formData 
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في رفع الملف');
      }

      const uploadData = await uploadRes.json();

      if (uploadData.url) {
        // Update employee record
        const profileRes = await fetch('/api/employee/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profilePhotoUrl: uploadData.url }),
        });

        if (!profileRes.ok) {
          throw new Error('فشل في تحديث بيانات الموظف');
        }

        // Update session
        await update({ image: uploadData.url });

        // Update local state
        setPhotoUrl(uploadData.url);

        alert('تم تحديث الصورة الشخصية بنجاح');
      } else {
        throw new Error('لم يتم إرجاع رابط الصورة');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      alert(err.message || 'فشل في رفع الصورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>الصورة الشخصية</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-center">
        <div className="flex justify-center">
          {photoUrl ? (
            <img src={photoUrl} alt="صورة شخصية" className="h-28 w-28 rounded-full object-cover border-4 border-white shadow" />
          ) : (
            <div className="h-28 w-28 rounded-full bg-slate-200 flex items-center justify-center">
              <User className="h-10 w-10 text-slate-400" />
            </div>
          )}
        </div>

        <label className="inline-block">
          <div className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl cursor-pointer transition">
            <Upload className="h-4 w-4" />
            {uploading ? 'جاري الرفع...' : 'اختر صورة جديدة'}
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>

        <p className="text-xs text-slate-500">
          الصورة تُحدث فوراً في الشريط العلوي بدون إعادة تحميل.
        </p>
      </CardContent>
    </Card>
  );
}
