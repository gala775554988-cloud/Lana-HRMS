import {
  Home, Clock, Calendar, DollarSign, Bell, User,
  FolderOpen, Settings, ShieldCheck, CheckSquare, Package,
  Award, GraduationCap, MessageCircle, HandCoins, MessageSquareWarning,
  type LucideIcon,
} from "lucide-react";

export type EmployeeNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

export type EmployeeNavGroupKey = "operations" | "requests" | "myData" | "communication";

export type EmployeeNavGroup = {
  key: EmployeeNavGroupKey;
  label: string;
  items: EmployeeNavItem[];
};

// "الرئيسية" is pinned above every group instead of living inside one — it's
// the portal's home, not a category of tasks.
export const EMPLOYEE_HOME_ITEM: EmployeeNavItem = { href: "/employee/dashboard", label: "الرئيسية", icon: Home };

// Grouped so the sidebar reads as an organized workspace (عملياتي / الطلبات /
// بياناتي / التواصل والإعدادات) instead of one long unsorted list -- every
// destination that existed in the old flat EMPLOYEE_NAV_ITEMS list is still
// here, just sorted into the section an employee would actually look for it in.
export const EMPLOYEE_NAV_GROUPS: EmployeeNavGroup[] = [
  {
    key: "operations",
    label: "عملياتي",
    items: [
      { href: "/employee/attendance", label: "الحضور والانصراف", icon: Clock },
      { href: "/employee/tasks", label: "المهام", icon: CheckSquare },
      { href: "/employee/performance", label: "التقييم", icon: Award },
      { href: "/employee/training", label: "التدريب", icon: GraduationCap },
    ],
  },
  {
    key: "requests",
    label: "الطلبات",
    items: [
      { href: "/employee/leave", label: "الإجازات", icon: Calendar },
      { href: "/employee/permissions", label: "الاستئذانات", icon: ShieldCheck },
      { href: "/employee/advances", label: "طلبات السلف", icon: HandCoins },
      { href: "/employee/complaints", label: "الشكاوى والاقتراحات", icon: MessageSquareWarning },
    ],
  },
  {
    key: "myData",
    label: "بياناتي",
    items: [
      { href: "/employee/salary", label: "الرواتب", icon: DollarSign },
      { href: "/employee/assets", label: "العهد", icon: Package },
      { href: "/employee/documents", label: "المستندات", icon: FolderOpen },
      { href: "/employee/profile", label: "ملفي الشخصي (إعدادات الحساب)", icon: User },
    ],
  },
  {
    key: "communication",
    label: "التواصل والإعدادات",
    items: [
      { href: "/employee/notifications", label: "الإشعارات", icon: Bell },
      { href: "/employee/chat", label: "المحادثات", icon: MessageCircle },
      { href: "/employee/settings", label: "الإعدادات", icon: Settings },
    ],
  },
];

// Flat view kept for anything that just wants "every item" (e.g. search
// indexing) without caring about grouping.
export const EMPLOYEE_NAV_ITEMS: EmployeeNavItem[] = [
  EMPLOYEE_HOME_ITEM,
  ...EMPLOYEE_NAV_GROUPS.flatMap((group) => group.items),
];
