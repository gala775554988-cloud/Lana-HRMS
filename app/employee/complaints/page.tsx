import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { requireEmployee } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import { PortalModuleSkeleton } from '@/components/employee/PortalModuleSkeleton';

const EmployeeComplaintsClient = dynamic(
  () => import('@/components/employee/EmployeeComplaintsClient').then((mod) => mod.EmployeeComplaintsClient),
  { loading: () => <PortalModuleSkeleton title="الشكاوى والاقتراحات" /> }
);

export const dynamicParams = false;
export const revalidate = 30;

type ComplaintRecord = {
  id: string;
  type: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  anonymous: boolean;
  assignedTo: string | null;
  resolution: string | null;
  attachments: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function serializeComplaint(record: ComplaintRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function ComplaintsContent() {
  const { employee } = await requireEmployee();
  const records = await (prisma as any).employeeComplaint.findMany({
    where: { employeeId: employee.id },
    select: {
      id: true,
      type: true,
      category: true,
      title: true,
      description: true,
      priority: true,
      status: true,
      anonymous: true,
      assignedTo: true,
      resolution: true,
      attachments: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return <EmployeeComplaintsClient initialRecords={records.map(serializeComplaint)} />;
}

export default function ComplaintsPage() {
  return (
    <Suspense fallback={<PortalModuleSkeleton title="الشكاوى والاقتراحات" />}>
      <ComplaintsContent />
    </Suspense>
  );
}
