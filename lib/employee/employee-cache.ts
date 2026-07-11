import { cache } from 'react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// Single source of truth - cached per request
export const getCurrentEmployeeCached = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.employee.findFirst({
    where: { userId: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      nationalId: true,
      profilePhotoUrl: true,
      status: true,
      department: { select: { name: true } },
      position: { select: { title: true } },
      branch: { select: { name: true } },
    },
  });
});
