import { prisma } from "@/lib/prisma";

export function countPendingApprovals(userId: string) {
  return prisma.workflowInstance.count({
    where: {
      status: "PENDING",
      steps: { some: { approverUserId: userId, status: "PENDING" } },
    },
  });
}
