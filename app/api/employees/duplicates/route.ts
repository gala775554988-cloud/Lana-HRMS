import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type DuplicateGroup = {
  type: "nationalId" | "email" | "employeeNumber" | "barcode";
  reason: string;
  value: string;
  count: number;
  employees: any[];
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "count";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const typeFilter = searchParams.get("type"); // nationalId, email, employeeNumber, barcode

    // Get all employees with essential fields for duplicate checking
    const allEmployees = await prisma.employee.findMany({
      select: {
        id: true,
        employeeNumber: true,
        nationalId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        hireDate: true,
        department: { select: { name: true } },
        position: { select: { title: true } },
        branch: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10000, // Limit to 10000 for performance
    });

    // Group by different fields
    const groups = new Map<string, DuplicateGroup>();

    const addGroup = (type: DuplicateGroup["type"], reason: string, value: string, employee: any) => {
      if (!value || value.trim() === "" || value.toUpperCase() === "NA") return;
      const key = `${type}:${value.toLowerCase().trim()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          type,
          reason,
          value: value.trim(),
          count: 0,
          employees: [],
        });
      }
      const group = groups.get(key)!;
      // Avoid duplicate employee in same group
      if (!group.employees.some((e: any) => e.id === employee.id)) {
        group.employees.push(employee);
        group.count = group.employees.length;
      }
    };

    for (const emp of allEmployees) {
      const employeeData = {
        id: emp.id,
        employeeNumber: emp.employeeNumber,
        nationalId: emp.nationalId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName: `${emp.firstName} ${emp.lastName}`.trim(),
        email: emp.email || "",
        phone: emp.phone || "",
        status: emp.status,
        hireDate: emp.hireDate,
        department: emp.department?.name || "",
        position: emp.position?.title || "",
        branch: emp.branch?.name || "",
      };

      // Check duplicates for each field
      addGroup("nationalId", "Duplicate National ID", emp.nationalId, employeeData);
      if (emp.email) addGroup("email", "Duplicate Email", emp.email, employeeData);
      addGroup("employeeNumber", "Duplicate Employee Number", emp.employeeNumber, employeeData);
      // Barcode is same as employeeNumber in this system
      addGroup("barcode", "Duplicate Barcode", emp.employeeNumber, employeeData);
    }

    // Filter only groups with count >1
    let duplicates = Array.from(groups.values()).filter((g) => g.count > 1);

    // Filter by type if requested
    if (typeFilter) {
      duplicates = duplicates.filter((g) => g.type === typeFilter);
    }

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      duplicates = duplicates.filter((g) => {
        if (g.value.toLowerCase().includes(q)) return true;
        if (g.reason.toLowerCase().includes(q)) return true;
        return g.employees.some(
          (emp: any) =>
            emp.fullName.toLowerCase().includes(q) ||
            emp.employeeNumber.toLowerCase().includes(q) ||
            emp.nationalId.toLowerCase().includes(q) ||
            emp.email.toLowerCase().includes(q) ||
            emp.department.toLowerCase().includes(q)
        );
      });
    }

    // Sort by count desc by default
    duplicates.sort((a, b) => {
      if (sortBy === "count") {
        return sortOrder === "asc" ? a.count - b.count : b.count - a.count;
      }
      if (sortBy === "value") {
        return sortOrder === "asc" ? a.value.localeCompare(b.value) : b.value.localeCompare(a.value);
      }
      return b.count - a.count;
    });

    const totalDuplicateEmployees = duplicates.reduce((sum, g) => sum + g.count, 0);
    const totalDuplicateGroups = duplicates.length;
    const uniqueDuplicateEmployees = new Set(duplicates.flatMap((g) => g.employees.map((e: any) => e.id))).size;

    // Stats by type
    const byType = {
      nationalId: duplicates.filter((g) => g.type === "nationalId").length,
      email: duplicates.filter((g) => g.type === "email").length,
      employeeNumber: duplicates.filter((g) => g.type === "employeeNumber").length,
      barcode: duplicates.filter((g) => g.type === "barcode").length,
    };

    return NextResponse.json({
      success: true,
      duplicates,
      totalDuplicateEmployees,
      totalDuplicateGroups,
      uniqueDuplicateEmployees,
      byType,
      totalEmployees: allEmployees.length,
      filters: { search, type: typeFilter, sortBy, sortOrder },
    });
  } catch (error) {
    console.error("[duplicates] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
