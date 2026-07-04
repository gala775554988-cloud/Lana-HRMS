import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface RecentRequest {
  id: string;
  title?: string;
  kind?: string;
  status: string;
  createdAt: Date;
}

interface Props {
  requests?: RecentRequest[];
  employeeId?: string;
}

export async function RecentRequests({ requests, employeeId }: Props) {
  // If data is passed, use it. Otherwise fetch (fallback)
  let displayRequests: RecentRequest[] = requests || [];

  if (!requests && employeeId) {
    const { prisma } = await import("@/lib/prisma");
    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    displayRequests = leaves.map(l => ({
      id: l.id,
      kind: "إجازة",
      status: l.status,
      createdAt: l.createdAt,
    }));
  }

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
            {displayRequests.map((req, i) => (
              <div key={i} className="py-3 flex justify-between items-center text-sm">
                <div>
                  {req.kind || "طلب"} 
                  <span className="text-slate-500 ml-2 text-xs">{new Date(req.createdAt).toLocaleDateString('ar-SA')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    className={
                      req.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : 
                      req.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                    }
                  >
                    {req.status}
                  </Badge>
                  <Link href={`/employee/requests`} className="text-xs text-indigo-600">عرض</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

