import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface RecentRequest {
  id: string;
  kind?: string;
  status: string;
  createdAt: Date | string;
}

interface Props {
  requests?: RecentRequest[];
}

export function RecentRequests({ requests = [] }: Props) {
  const displayRequests: RecentRequest[] = Array.isArray(requests) ? requests : [];

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader>
        <CardTitle className="text-base">الطلبات الأخيرة</CardTitle>
      </CardHeader>
      <CardContent>
        {displayRequests.length === 0 ? (
          <div className="text-sm text-slate-500">لا توجد طلبات حديثة</div>
        ) : (
          <div className="divide-y">
            {displayRequests.map((req, i) => {
              const date = req.createdAt 
                ? (typeof req.createdAt === 'string' ? new Date(req.createdAt) : req.createdAt)
                : new Date();
              
              return (
                <div key={req.id || i} className="py-3 flex justify-between items-center text-sm">
                  <div>
                    {req.kind || "طلب"} 
                    <span className="text-slate-500 ml-2 text-xs">
                      {date.toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={
                      req.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : 
                      req.status === "PENDING" ? "bg-amber-100 text-amber-700" : 
                      "bg-rose-100 text-rose-700"
                    }>
                      {req.status || "غير معروف"}
                    </Badge>
                    <Link href="/employee/requests/tracker" className="text-xs text-indigo-600 hover:underline">عرض</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 pt-3 border-t">
          <Link href="/employee/requests/tracker" className="text-xs text-indigo-600 hover:underline">
            تتبع كل الطلبات →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
