'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const themes = [
  { id: 'corporate', name: 'Corporate', primary: '#4F46E5' },
  { id: 'purple', name: 'Purple', primary: '#7C3AED' },
  { id: 'blue', name: 'Blue', primary: '#2563EB' },
  { id: 'emerald', name: 'Emerald', primary: '#059669' },
  { id: 'night', name: 'Night', primary: '#1E293B' },
  { id: 'minimal', name: 'Minimal', primary: '#334155' },
];

export default function ThemeSettings() {
  const changeTheme = async (themeId: string) => {
    // Save preference
    await fetch('/api/employee/preferences', {
      method: 'POST',
      body: JSON.stringify({ theme: themeId }),
    });

    // Apply immediately
    document.documentElement.setAttribute('data-theme', themeId);
    alert('تم تغيير الثيم');
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">الثيم</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {themes.map(theme => (
          <Card 
            key={theme.id} 
            className="cursor-pointer hover:border-primary/30"
            onClick={() => changeTheme(theme.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full" style={{ backgroundColor: theme.primary }} />
                <div>
                  <div className="font-medium">{theme.name}</div>
                  <div className="text-xs text-slate-500">{theme.id}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-500">الثيم يُحفظ في تفضيلاتك ويطبق على جميع الأجهزة.</p>
    </div>
  );
}
