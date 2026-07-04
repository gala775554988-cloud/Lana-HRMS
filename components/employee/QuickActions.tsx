'use client';

import React, { useState } from 'react';
import { 
  Calendar, Wallet, FileText, MapPin, Clock, 
  Upload, AlertTriangle, UserCheck 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RequestModal } from './RequestModal';

const actions = [
  { key: 'leave', label: 'طلب إجازة', icon: Calendar, color: 'violet' },
  { key: 'loan', label: 'طلب سلفة', icon: Wallet, color: 'emerald' },
  { key: 'definition', label: 'طلب تعريف', icon: FileText, color: 'blue' },
  { key: 'delegation', label: 'طلب انتداب', icon: MapPin, color: 'amber' },
  { key: 'overtime', label: 'ساعات إضافية', icon: Clock, color: 'rose' },
  { key: 'document', label: 'رفع مستند', icon: Upload, color: 'slate' },
  { key: 'complaint', label: 'شكوى', icon: AlertTriangle, color: 'orange' },
  { key: 'residence', label: 'تجديد إقامة', icon: UserCheck, color: 'teal' },
];

export function QuickActions() {
  const [openModal, setOpenModal] = useState<string | null>(null);

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-semibold text-lg">إجراءات سريعة</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Card 
                key={action.key} 
                onClick={() => setOpenModal(action.key)} 
                className="cursor-pointer hover:shadow-md transition border-slate-200 dark:border-slate-700 group"
              >
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center bg-${action.color}-100 dark:bg-${action.color}-950 text-${action.color}-600 group-hover:scale-105 transition`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium leading-tight">{action.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <RequestModal 
        isOpen={!!openModal} 
        type={openModal} 
        onClose={() => setOpenModal(null)} 
      />
    </>
  );
}
