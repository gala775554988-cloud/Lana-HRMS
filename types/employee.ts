export interface EmployeeProfile {
  id: string;
  employeeNumber: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  profilePhotoUrl?: string | null;
  department?: { name: string; code?: string } | null;
  position?: { title: string } | null;
  branch?: { name: string } | null;
  hireDate: Date;
  status: string;
}

export interface AttendanceSummary {
  todayStatus: 'present' | 'absent' | 'late' | 'checked-out';
  checkIn?: string;
  checkOut?: string;
  hoursToday: number;
  totalThisMonth: number;
}

export interface LeaveBalance {
  annual: { used: number; remaining: number; total: number };
  sick: { used: number; remaining: number; total: number };
}

export interface PayrollSummary {
  baseSalary: number;
  currency: string;
  netPay?: number;
  lastPayDate?: string;
}

export interface RequestSummary {
  pending: number;
  approved: number;
  rejected: number;
}

export interface TaskItem {
  id: string;
  title: string;
  dueDate?: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: string;
}
