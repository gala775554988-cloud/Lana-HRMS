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

export const EMPLOYEE_NAV_ITEMS: EmployeeNavItem[] = [
  { href: "/employee/dashboard", label: "الرئيسية", icon: Home },
  { href: "/employee/profile", label: "ملفي الشخصي", icon: User },
  { href: "/employee/attendance", label: "الحضور والانصراف", icon: Clock },
  { href: "/employee/leave", label: "الإجازات", icon: Calendar },
  { href: "/employee/permissions", label: "الاستئذانات", icon: ShieldCheck },
  { href: "/employee/tasks", label: "المهام", icon: CheckSquare },
  { href: "/employee/salary", label: "الرواتب", icon: DollarSign },
  { href: "/employee/advances", label: "طلبات السلف", icon: HandCoins },
  { href: "/employee/complaints", label: "الشكاوى والاقتراحات", icon: MessageSquareWarning },
  { href: "/employee/assets", label: "العهد", icon: Package },
  { href: "/employee/documents", label: "المستندات", icon: FolderOpen },
  { href: "/employee/performance", label: "التقييم", icon: Award },
  { href: "/employee/training", label: "التدريب", icon: GraduationCap },
  { href: "/employee/notifications", label: "الإشعارات", icon: Bell },
  { href: "/employee/chat", label: "المحادثات", icon: MessageCircle },
  { href: "/employee/settings", label: "الإعدادات", icon: Settings },
];
