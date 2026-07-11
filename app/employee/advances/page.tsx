import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { requireEmployee } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import { PortalModuleSkeleton } from '@/components/employee/PortalModuleSkeleton';

const EmployeeAdvancesClient = dynamic(
  () => import('@/components/employee/EmployeeAdvancesClient').then((mod) => mod.EmployeeAdvancesClient),
  { loading: () => <PortalModuleSkeleton title="طلبات السلف" /> }
);

export const dynamicParams = false;
export const revalidate = 30;

type AdvanceRecord = {
  id: string;
  amount: unknown;
  reason: string;
  installments: number;
  monthlyDeduction: unknown;
  startDate: Date;
  status: string;
  managerStatus: string;
  hrStatus: string;
  financeStatus: string;
  managerComment: string | null;
  hrComment: string | null;
  financeComment: string | null;
  attachments: unknown;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeAdvance(record: AdvanceRecord) {
  return {
    ...record,
    amount: Number(record.amount ?? 0),
    monthlyDeduction: Number(record.monthlyDeduction ?? 0),
    startDate: record.startDate.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function AdvancesContent() {
  const { employee } = await requireEmployee();
  const records = await (prisma as any).employeeSalaryAdvance.findMany({
    where: { employeeId: employee.id },
    select: {
      id: true,
      amount: true,
      reason: true,
      installments: true,
      monthlyDeduction: true,
      startDate: true,
      status: true,
      managerStatus: true,
      hrStatus: true,
      financeStatus: true,
      managerComment: true,
      hrComment: true,
      financeComment: true,
      attachments: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return <EmployeeAdvancesClient initialRecords={records.map(serializeAdvance)} />;
}

export default function AdvancesPage() {
  return (
    <Suspense fallback={<PortalModuleSkeleton title="طلبات السلف" />}>
      <AdvancesContent />
    </Suspense>
  );
}
