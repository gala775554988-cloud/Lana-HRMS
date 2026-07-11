/**
 * REAL PERFORMANCE DEBUGGER - Employee Portal
 * Run with: npx tsx scripts/debug-employee-portal.ts
 */

import { prisma } from '../lib/prisma';

async function debugEmployeePortal() {
  console.log('\n========================================');
  console.log('   EMPLOYEE PORTAL REAL PERFORMANCE DEBUG');
  console.log('========================================\n');

  const employeeId = 'YOUR_EMPLOYEE_ID_HERE'; // ← ضع ID موظف حقيقي هنا
  const userId = 'YOUR_USER_ID_HERE';

  if (employeeId.includes('YOUR')) {
    console.log('❌ Please replace employeeId and userId with real values');
    console.log('   You can get them from your database or browser console after login\n');
    return;
  }

  // ============================================
  // 1. Test getCurrentEmployee
  // ============================================
  console.log('🔍 Testing getCurrentEmployee()...');
  const start1 = Date.now();
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId },
    select: {
      id: true, firstName: true, lastName: true, employeeNumber: true,
      nationalId: true, profilePhotoUrl: true, status: true,
      department: { select: { name: true } },
      position: { select: { title: true } },
      branch: { select: { name: true } },
    },
  });
  const time1 = Date.now() - start1;
  console.log(`   getCurrentEmployee: ${time1}ms`);

  // ============================================
  // 2. Test getPortalDashboard (Main bottleneck)
  // ============================================
  console.log('\n🔍 Testing getPortalDashboard()...');
  const start2 = Date.now();

  const [attendance, leaves, payroll, documents, assets, notifications] = await Promise.all([
    prisma.attendanceRecord.findFirst({ where: { employeeId }, select: { status: true } }),
    prisma.leaveRequest.findMany({ where: { employeeId }, take: 5, select: { status: true, days: true } }),
    prisma.payrollItem.findFirst({ where: { employeeId }, select: { netPay: true, currency: true } }),
    prisma.employeeDocument.count({ where: { employeeId } }),
    prisma.asset.count({ where: { assignedEmployeeId: employeeId } }),
    prisma.notification.findMany({ where: { userId }, take: 5, select: { title: true } }),
  ]);

  const time2 = Date.now() - start2;
  console.log(`   getPortalDashboard (parallel): ${time2}ms`);

  // ============================================
  // 3. Check for N+1 or heavy includes
  // ============================================
  console.log('\n🔍 Checking for heavy queries...');
  const start3 = Date.now();
  const heavyLeave = await prisma.leaveRequest.findMany({
    where: { employeeId },
    include: { leaveType: true }, // This is bad
    take: 10,
  });
  const time3 = Date.now() - start3;
  console.log(`   Leave with include: ${time3}ms (should be avoided)`);

  // ============================================
  // 4. Summary
  // ============================================
  console.log('\n========================================');
  console.log('              SUMMARY');
  console.log('========================================');
  console.log(`getCurrentEmployee:        ${time1}ms`);
  console.log(`getPortalDashboard:        ${time2}ms`);
  console.log(`Leave with include:        ${time3}ms`);
  console.log('========================================\n');

  if (time2 > 400) {
    console.log('⚠️  Dashboard is still slow. Needs more optimization.');
  } else {
    console.log('✅ Dashboard performance looks good.');
  }
}

debugEmployeePortal().catch(console.error);