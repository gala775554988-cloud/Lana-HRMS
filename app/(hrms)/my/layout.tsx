import type { ReactNode } from "react";

// Clean layout for the beautiful mobile employee portal
// This removes the heavy sidebar and top nav so /my feels exactly like the provided mobile mockups
export default function EmployeeMyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A12] text-white">
      {children}
    </div>
  );
}
