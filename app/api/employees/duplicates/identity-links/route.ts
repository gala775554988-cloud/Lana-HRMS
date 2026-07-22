import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Read-only cross-check for the "two profiles per person" bug: a User account
// with no linked Employee, and an Employee record with no linked User, that
// are almost certainly the same real person (matched by email, or as a
// weaker fallback, by full name). Existing duplicate tooling only compares
// Employee rows against each other -- this is the missing User<->Employee
// side. Never modifies anything; surfaces candidates for manual review/link.
type EmployeeCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  nationalId: string;
  email: string | null;
  department: string;
  position: string;
  status: string;
};

function normalizeEmail(value: string | null | undefined) {
  return value ? value.trim().toLowerCase() : null;
}

function normalizeName(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized || null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() || "";

    const [unlinkedUsers, unlinkedEmployees] = await Promise.all([
      prisma.user.findMany({
        where: { employeeProfile: null },
        select: { id: true, name: true, email: true, username: true, isActive: true, createdAt: true },
      }),
      prisma.employee.findMany({
        where: { userId: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          nationalId: true,
          email: true,
          status: true,
          department: { select: { name: true } },
          position: { select: { title: true } },
        },
      }),
    ]);

    const employeesByEmail = new Map<string, EmployeeCandidate[]>();
    const employeesByName = new Map<string, EmployeeCandidate[]>();

    for (const emp of unlinkedEmployees) {
      const candidate: EmployeeCandidate = {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        employeeNumber: emp.employeeNumber,
        nationalId: emp.nationalId,
        email: emp.email,
        department: emp.department?.name || "",
        position: emp.position?.title || "",
        status: emp.status,
      };

      const emailKey = normalizeEmail(emp.email);
      if (emailKey) {
        if (!employeesByEmail.has(emailKey)) employeesByEmail.set(emailKey, []);
        employeesByEmail.get(emailKey)!.push(candidate);
      }

      const nameKey = normalizeName(`${emp.firstName} ${emp.lastName}`);
      if (nameKey) {
        if (!employeesByName.has(nameKey)) employeesByName.set(nameKey, []);
        employeesByName.get(nameKey)!.push(candidate);
      }
    }

    type Match = {
      matchType: "email" | "name";
      matchValue: string;
      user: { id: string; name: string | null; email: string | null; username: string | null; isActive: boolean; createdAt: Date };
      employees: EmployeeCandidate[];
    };

    const matches: Match[] = [];
    for (const user of unlinkedUsers) {
      const emailKey = normalizeEmail(user.email);
      const nameKey = normalizeName(user.name);

      let matchedEmployees = emailKey ? employeesByEmail.get(emailKey) : undefined;
      let matchType: "email" | "name" = "email";
      let matchValue = emailKey || "";

      if (!matchedEmployees?.length && nameKey) {
        matchedEmployees = employeesByName.get(nameKey);
        matchType = "name";
        matchValue = nameKey;
      }

      if (matchedEmployees?.length) {
        matches.push({
          matchType,
          matchValue,
          user: { id: user.id, name: user.name, email: user.email, username: user.username, isActive: user.isActive, createdAt: user.createdAt },
          employees: matchedEmployees,
        });
      }
    }

    let filtered = matches;
    if (search) {
      filtered = matches.filter((m) => {
        if (m.matchValue.toLowerCase().includes(search)) return true;
        if (m.user.name?.toLowerCase().includes(search)) return true;
        if (m.user.email?.toLowerCase().includes(search)) return true;
        return m.employees.some(
          (e) =>
            `${e.firstName} ${e.lastName}`.toLowerCase().includes(search) ||
            e.employeeNumber.toLowerCase().includes(search) ||
            e.nationalId.toLowerCase().includes(search)
        );
      });
    }

    return NextResponse.json({
      success: true,
      matches: filtered,
      totalMatches: filtered.length,
      byMatchType: {
        email: filtered.filter((m) => m.matchType === "email").length,
        name: filtered.filter((m) => m.matchType === "name").length,
      },
      totalUnlinkedUsers: unlinkedUsers.length,
      totalUnlinkedEmployees: unlinkedEmployees.length,
    });
  } catch (error) {
    console.error("[duplicates/identity-links] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
