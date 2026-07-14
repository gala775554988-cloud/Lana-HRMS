"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Users, Calendar, Clock, DollarSign, Building2,
  Sparkles, GitPullRequest, FileText, Settings, Shield,
  ArrowUpRight, CornerDownLeft, X, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  title: string;
  description: string;
  category: "الموظفون" | "الوحدات والنظم" | "إجراءات سريعة" | "الذكاء الاصطناعي والتقارير";
  href: string;
  icon: any;
  badge?: string;
}

type EmployeeSearchResult = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  department?: { name: string } | null;
  position?: { title: string } | null;
};

export function QuickSearchModal({ isOpen, onClose }: QuickSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [employeeResults, setEmployeeResults] = useState<EmployeeSearchResult[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setEmployeeResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/employees/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data) => setEmployeeResults(data.success ? data.employees ?? [] : []))
        .catch(() => {});
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const employeeItems: SearchItem[] = useMemo(() => employeeResults.map((employee) => ({
    id: `employee-${employee.id}`,
    title: `${employee.firstName} ${employee.lastName}`,
    description: [employee.employeeNumber, employee.department?.name, employee.position?.title].filter(Boolean).join(" · "),
    category: "الموظفون" as const,
    href: `/employees/${employee.id}`,
    icon: Users
  })), [employeeResults]);

  const allItems: SearchItem[] = useMemo(() => [
    {
      id: "employees",
      title: "إدارة الموظفين والوثائق",
      description: "عرض وتعديل ملفات الموظفين، الهيكل التنظيمي والوثائق الرسمية",
      category: "الوحدات والنظم",
      href: "/employees",
      icon: Users,
    },
    {
      id: "leave-requests",
      title: "نظام الإجازات والمغادرات",
      description: "تقديم وطلب الإجازات ومراجعة أرصدة الإجازات السنوية والمرضية",
      category: "الوحدات والنظم",
      href: "/leaves?tab=leave-requests",
      icon: Calendar,
    },
    {
      id: "attendance",
      title: "سجلات الحضور والانصراف",
      description: "متابعة البصمة، التأخيرات، وساعات العمل اليومية والشهرية",
      category: "الوحدات والنظم",
      href: "/attendance",
      icon: Clock,
    },
    {
      id: "payroll",
      title: "مسيرات الرواتب والمستحقات",
      description: "إصدار مسيرات الرواتب، البدلات، والاستقطاعات الشهرية",
      category: "الوحدات والنظم",
      href: "/payroll?tab=payroll-runs",
      icon: DollarSign,
    },
    {
      id: "hospitals",
      title: "إدارة المستشفيات والمراكز",
      description: "توزيع الموظفين والممارسين الصحيين على مواقع الرعاية والمستشفيات",
      category: "الوحدات والنظم",
      href: "/hospitals",
      icon: Building2,
    },
    {
      id: "overtime",
      title: "إدارة الأوفر تايم والعمل الإضافي",
      description: "اعتماد ومتابعة ساعات العمل الإضافي وتكاليف التشغيل",
      category: "الوحدات والنظم",
      href: "/overtime",
      icon: Clock,
    },
    {
      id: "req-leave",
      title: "تقديم طلب إجازة جديد",
      description: "إنشاء طلب إجازة فوري وإرساله للاعتماد عبر دورة سير العمل",
      category: "إجراءات سريعة",
      href: "/employee/leave/new",
      icon: Zap,
      badge: "إجراء سريع"
    },
    {
      id: "req-expense",
      title: "تقديم عهدة أو طلب استعاضة مصاريف",
      description: "رفع فواتير ومستندات المصروفات لصرف الفواتير المالية",
      category: "إجراءات سريعة",
      href: "/employee/expenses/new",
      icon: Zap,
      badge: "إجراء سريع"
    },
    {
      id: "req-inbox",
      title: "صندوق الاعتمادات والموافقات",
      description: "مراجعة الطلبات المعلقة واتخاذ قرار الموافقة أو الرفض",
      category: "إجراءات سريعة",
      href: "/approvals",
      icon: GitPullRequest,
    },
    {
      id: "lana-ai",
      title: "المساعد الذكي Lana AI Assistant",
      description: "تحليل كفاءة الموظفين والتنبؤ بمعدلات الدوران الوظيفي بالذكاء الاصطناعي",
      category: "الذكاء الاصطناعي والتقارير",
      href: "/lana-ai",
      icon: Sparkles,
      badge: "AI Powered"
    },
    {
      id: "reports",
      title: "التقارير والإحصائيات الشاملة",
      description: "تصدير تقارير الموارد البشرية، مؤشرات الأداء، وكشوفات الرواتب",
      category: "الذكاء الاصطناعي والتقارير",
      href: "/reports",
      icon: FileText,
    },
    {
      id: "audit-logs",
      title: "سجل التدقيق والرقابة الأمنية",
      description: "تتبع نشاط المستخدمين وحركات الدخول وتعديل الصلاحيات",
      category: "الذكاء الاصطناعي والتقارير",
      href: "/audit-logs",
      icon: Shield,
    },
    {
      id: "settings",
      title: "إعدادات النظام والشعار",
      description: "تخصيص الهوية البصرية، الصلاحيات، وإعدادات اللغة والوضع الليلي",
      category: "الذكاء الاصطناعي والتقارير",
      href: "/settings",
      icon: Settings,
    }
  ], []);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    const staticMatches = allItems.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
    return [...employeeItems, ...staticMatches];
  }, [query, allItems, employeeItems]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (filteredItems.length || 1)) % (filteredItems.length || 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          router.push(filteredItems[selectedIndex].href);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, router, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-16 sm:pt-24 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-2xl shadow-indigo-950/30 dark:border-slate-800 dark:bg-slate-900 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Header */}
        <div className="flex items-center gap-3 border-b border-[#E5E7EB] bg-[#F9FAFB]/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
          <Search className="h-5 w-5 text-primary shrink-0" />
          <input
            type="text"
            placeholder="ابحث عن وحدة، موظف، تقرير، أو إجراء سريع..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center">
              <Sparkles className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-base font-bold text-slate-700 dark:text-slate-300">لم يتم العثور على نتائج</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">جرب البحث بكلمات مفتاحية أخرى مثل: الموظفون، الرواتب، أو لانا</p>
            </div>
          ) : (
            ["الموظفون", "الوحدات والنظم", "إجراءات سريعة", "الذكاء الاصطناعي والتقارير"].map((cat) => {
              const itemsInCat = filteredItems.filter(i => i.category === cat);
              if (itemsInCat.length === 0) return null;

              return (
                <div key={cat} className="pt-2 first:pt-0">
                  <div className="px-3 pb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {cat}
                  </div>
                  <div className="space-y-1">
                    {itemsInCat.map((item) => {
                      const idx = filteredItems.findIndex(x => x.id === item.id);
                      const isSelected = idx === selectedIndex;
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            router.push(item.href);
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "group flex items-center justify-between gap-4 rounded-2xl px-4 py-3 cursor-pointer transition-all duration-150",
                            isSelected
                              ? "bg-primary/10 text-primary border border-primary/30 shadow-sm"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            )}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 truncate dark:text-slate-400 mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            <span className="hidden sm:inline">انتقال</span>
                            <CornerDownLeft className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-[#E5E7EB] bg-slate-50 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-white px-1.5 py-0.5 font-mono shadow-xs dark:bg-slate-800 dark:border-slate-700">↑↓</kbd> للتنقل
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-white px-1.5 py-0.5 font-mono shadow-xs dark:bg-slate-800 dark:border-slate-700">Enter</kbd> للفتح
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-600 font-bold dark:text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Lana Search Engine v2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
