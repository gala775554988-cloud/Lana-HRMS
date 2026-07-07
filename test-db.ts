import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.employee.count();
  console.log("Total Employees:", count);
  const userCount = await prisma.user.count();
  console.log("Total Users:", userCount);
}
main().finally(() => prisma.$disconnect());
