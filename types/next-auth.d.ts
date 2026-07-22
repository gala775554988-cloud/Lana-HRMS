import type { DefaultSession } from "next-auth";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface EmployeeProfileSummary {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    profilePhotoUrl: string | null;
    positionTitle: string | null;
    departmentName: string | null;
  }

  interface Session {
    user: {
      id: string;
      roles: string[];
      permissions: string[];
      employeeProfile: EmployeeProfileSummary | null;
    } & DefaultSession["user"];
  }

  interface User {
    roles?: string[];
    permissions?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: string[];
    permissions?: string[];
  }
}
