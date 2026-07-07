"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function SettingsLayout({ 
  sections, 
  currentTab, 
  module,
  children 
}: { 
  sections: { id: string, title: string }[], 
  currentTab: string, 
  module: string,
  children: React.ReactNode 
}) {
  return (
    <div className="flex flex-col md:flex-row gap-6 mt-6">
      <aside className="w-full md:w-64 shrink-0">
        <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/${module}/settings?tab=${section.id}`}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                currentTab === section.id 
                  ? "bg-primary text-primary-foreground shadow" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {section.title}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
