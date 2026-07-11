import { requireEmployee, getEmployeeSetting } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import { EmployeeTasksPortal } from '@/components/employee/EmployeeTasksPortal';


export default async function Tasks() {
  const { employee } = await requireEmployee();
  const [saved, leaves, overtime] = await Promise.all([
    getEmployeeSetting<any[]>(employee.id, 'tasks', []),
    prisma.leaveRequest.findMany({ where: { employeeId: employee.id, status: 'PENDING' }, take: 10, orderBy: { createdAt: 'desc' } }),
    prisma.overtimeRequest.findMany({ where: { employeeId: employee.id, status: 'PENDING' }, take: 10, orderBy: { createdAt: 'desc' } }),
  ]);
  const generated = [
    ...leaves.map(l => ({ id: `leave-${l.id}`, title: `متابعة طلب إجازة ${l.reason || ''}`.trim(), status: l.status, progress: 35, comments: [], attachments: [], dueDate: l.startDate.toISOString(), source: 'leave-workflow' })),
    ...overtime.map(o => ({ id: `overtime-${o.id}`, title: `متابعة طلب أوفر تايم ${Number(o.hours)} ساعة`, status: o.status, progress: 35, comments: [], attachments: [], dueDate: o.workDate.toISOString(), source: 'overtime-workflow' })),
  ];
  const merged = [...saved, ...generated.filter(g => !saved.some((s:any)=>s.id===g.id))];
  return <EmployeeTasksPortal initialTasks={merged} />;
}
