'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, ExternalLink, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  link?: string | null;
  readAt?: string | Date | null;
  createdAt?: string | Date;
};

// Approval-center links only resolve inside the admin shell (AppShell), which
// the employee portal never routes into -- remap them to the employee-portal
// equivalent (the request tracker) so the deep-link still lands somewhere
// real instead of a dead redirect loop.
function resolveEmployeeLink(link: string) {
  const match = link.match(/^\/approvals\?tab=(?:inbox|outbox|center)&highlight=([^&]+)$/);
  if (match) return `/employee/requests/tracker?highlight=${match[1]}#wf-${match[1]}`;
  return link;
}

export function NotificationsPage({ notifications: initialNotifications }: { notifications: NotificationItem[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [activeNotification, setActiveNotification] = useState<NotificationItem | null>(null);

  async function open(notification: NotificationItem) {
    // Immediately mark read in local UI state so badge updates instantly
    if (!notification.readAt) {
      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, readAt: now } : n))
      );
      await fetch('/api/enterprise/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notification.id })
      }).catch(() => null);
    }

    if (notification.link) {
      router.push(resolveEmployeeLink(notification.link));
    } else {
      setActiveNotification(notification);
    }
  }

  return (
    <div className="space-y-6 font-sans text-right" dir="rtl">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">الإشعارات والتنبيهات</h1>
        <p className="text-xs font-semibold text-muted-foreground mt-1">عند الضغط على أي إشعار يتم فتحه وقراءته وتحديد حالة القراءة تلقائياً.</p>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed p-12 text-center text-muted-foreground font-bold text-sm bg-slate-50/50 dark:bg-slate-900/40">
          لا توجد إشعارات أو تنبيهات في سجلك حالياً.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isRead = Boolean(n.readAt);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => open(n)}
                className={`w-full flex items-start gap-3.5 p-4 border rounded-2xl text-start shadow-2xs transition-all duration-200 ${
                  isRead
                    ? "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary/40"
                    : "bg-primary/5 dark:bg-primary/10 border-primary/40 text-slate-900 dark:text-slate-100 hover:bg-primary/10 font-bold"
                }`}
              >
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isRead ? "bg-slate-100 dark:bg-slate-800 text-slate-500" : "bg-primary text-white font-bold shadow-xs"}`}>
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-sm truncate">{n.title}</p>
                    {!isRead ? (
                      <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold text-white animate-pulse">
                        جديد (غير مقروء)
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                        مقروء ✓
                      </span>
                    )}
                  </div>
                  {n.body ? <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2 font-medium">{n.body}</p> : null}
                  {n.createdAt ? (
                    <p className="mt-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      {new Date(n.createdAt).toLocaleString("ar-SA")}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* In-App Notification Reader Dialog */}
      {activeNotification ? (
        <Dialog open={true} onOpenChange={() => setActiveNotification(null)}>
          <DialogContent className="max-w-lg w-full p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4" dir="rtl">
            <DialogHeader className="flex flex-row items-center justify-between border-b pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary font-bold">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-slate-900 dark:text-slate-100">{activeNotification.title}</DialogTitle>
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✓ تم تحديد هذا الإشعار كمقروء الآن</p>
                </div>
              </div>
              <button onClick={() => setActiveNotification(null)} className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4.5 w-4.5" /></button>
            </DialogHeader>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <p className="text-xs font-semibold leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{activeNotification.body}</p>
              {activeNotification.createdAt ? (
                <p className="text-[10px] font-extrabold text-muted-foreground pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  تاريخ الإشعار: {new Date(activeNotification.createdAt).toLocaleString("ar-SA")}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end pt-1">
              <Button onClick={() => setActiveNotification(null)} className="rounded-xl px-6 font-black text-xs bg-primary text-white h-9">إغلاق</Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
