'use client';

import React from 'react';

interface Step {
  step: number;
  status: string;
  approvedAt?: string | Date | null;
  comments?: string | null;
}

export function WorkflowTimeline({ steps }: { steps: Step[] }) {
  const labels = ['الموظف', 'المدير', 'الموارد البشرية', 'المالية'];

  return (
    <div className="space-y-2 mt-3">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-3 text-sm">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium 
            ${step.status === 'APPROVED' ? 'bg-emerald-500 text-white' : 
              step.status === 'REJECTED' ? 'bg-red-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
            {step.step}
          </div>
          <div className="flex-1">
            <span className="font-medium">{labels[step.step - 1] || `المرحلة ${step.step}`}</span>
            <span className="ml-2 text-xs text-slate-500">({step.status})</span>
          </div>
          {step.approvedAt && (
            <div className="text-xs text-emerald-600">
              {new Date(step.approvedAt).toLocaleDateString('ar-SA')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
