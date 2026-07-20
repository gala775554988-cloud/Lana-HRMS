"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

type EmployeeSearchResult = {
  id: string;
  userId: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  profilePhotoUrl?: string | null;
  department?: { name: string } | null;
  position?: { title: string } | null;
};

export function UserSearchSelect({
  value,
  onChange,
  placeholder = "بحث بالاسم أو الرقم الوظيفي أو الهوية...",
  initialLabel = ""
}: {
  value: string;
  onChange: (userId: string, label?: string, employee?: any) => void;
  placeholder?: string;
  initialLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmployeeSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(initialLabel);
  const containerRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (value && initialLabel) {
      setSelectedLabel(initialLabel);
    } else if (initialLabel && !selectedLabel) {
      setSelectedLabel(initialLabel);
    } else if (!value && !initialLabel) {
      setSelectedLabel("");
    }
  }, [value, initialLabel]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/employees/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d) => setResults((d.employees ?? []).filter((e: EmployeeSearchResult) => e.userId)))
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(employee: EmployeeSearchResult) {
    const label = `${employee.firstName} ${employee.lastName} - ${employee.employeeNumber || employee.nationalId}`;
    setSelectedLabel(label);
    setQuery("");
    setResults([]);
    setOpen(false);
    onChange(employee.userId || employee.id, label, employee);
  }

  function clear() {
    setSelectedLabel("");
    onChange("", "", null);
  }

  if ((value || selectedLabel) && selectedLabel) {
    return (
      <div className="flex h-9 items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 text-sm shadow-2xs">
        <span className="truncate font-bold text-slate-900 dark:text-slate-100">{selectedLabel}</span>
        <button type="button" onClick={clear} className="ms-2 shrink-0 text-rose-600 hover:text-rose-700 font-bold" title="تغيير الموظف">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border bg-background px-3 ps-8 text-sm"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover shadow-md">
          {results.map((employee) => (
            <button
              key={employee.id}
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm hover:bg-accent"
              onClick={() => select(employee)}
            >
              {employee.profilePhotoUrl ? (
                <img src={employee.profilePhotoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8 text-[11px] font-bold text-primary dark:bg-primary/50 dark:text-primary/50">
                  {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                </span>
              )}
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                <span className="font-medium">{employee.firstName} {employee.lastName}</span>
                <span className="text-xs text-muted-foreground">
                  {employee.employeeNumber} · {employee.nationalId}{employee.department?.name ? ` · ${employee.department.name}` : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
