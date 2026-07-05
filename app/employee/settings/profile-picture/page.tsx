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
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة يجب أن يكون أقل من 2 ميجابايت');
      return;
    }

    setUploading(true);

    try {
      // Convert image to base64 (works on Vercel)
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;

        try {
          // Update employee profile with base64 image
          const res = await fetch('/api/employee/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profilePhotoUrl: base64 }),
          });

          if (!res.ok) {
            throw new Error('فشل في حفظ الصورة');
          }

          // Update session immediately
          await update({ image: base64 });

          // Update UI
          setPhotoUrl(base64);

          alert('تم تحديث الصورة الشخصية بنجاح');
        } catch (err: any) {
          console.error(err);
          alert('فشل في حفظ الصورة. حاول مرة أخرى.');
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        alert('فشل في قراءة الصورة');
        setUploading(false);
      };

      reader.readAsDataURL(file);

    } catch (err: any) {
      console.error('Upload error:', err);
      alert('حدث خطأ أثناء رفع الصورة');
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
