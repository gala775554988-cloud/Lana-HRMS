'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LanguageSettings() {
  return (
    <Card>
      <CardHeader><CardTitle>اللغة والمنطقة الزمنية</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>اللغة الحالية: العربية</div>
        <Button variant="outline">تغيير إلى الإنجليزية</Button>
        <div className="text-xs text-slate-500 mt-4">المنطقة الزمنية: Asia/Riyadh</div>
      </CardContent>
    </Card>
  );
}
