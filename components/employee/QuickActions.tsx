'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Clock, FileText, DollarSign, Upload, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const actions = [
  { href: '/employee/leave', icon: Calendar, label: 'طلب إجازة', desc: 'تقديم طلب إجازة' },
  { href: '/employee/attendance', icon: Clock, label: 'تسجيل حضور', desc: 'Clock In / Out' },
  { href: '/employee/requests', icon: FileText, label: 'طلب سلفة', desc: 'طلب سلفة مالية' },
  { href: '/employee/salary', icon: DollarSign, label: 'عرض الراتب', desc: 'كشف الراتب' },
  { href: '/employee/documents', icon: Upload, label: 'رفع مستند', desc: 'تحميل وثيقة' },
  { href: '/employee/requests', icon: CreditCard, label: 'مصروفات', desc: 'طلب مصروفات' },
];

export function QuickActions() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold text-lg">إجراءات سريعة</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Link key={index} href={action.href}>
              <Card className="border-slate-200 dark:border-slate-800 hover:border-primary/20 dark:hover:border-primary transition group h-full">
                <CardContent className="p-4 flex flex-col items-start">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-primary/12 dark:group-hover:bg-primary/50 transition mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="font-medium text-sm">{action.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{action.desc}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
