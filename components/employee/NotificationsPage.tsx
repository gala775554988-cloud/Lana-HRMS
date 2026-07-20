'use client';

import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';

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

export function NotificationsPage({ notifications }: { notifications: NotificationItem[] }) {
  const router = useRouter();

  async function open(notification: NotificationItem) {
    if (!notification.readAt) {
      await fetch('/api/enterprise/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notification.id })
      }).catch(() => null);
    }
    if (notification.link) router.push(resolveEmployeeLink(notification.link));
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">الإشعارات</h1>
      {notifications.length === 0 ? (
        <p className="text-muted-foreground">لا توجد إشعارات.</p>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => open(n)}
              className="w-full flex items-start gap-3 p-4 border rounded-2xl bg-white text-start shadow-sm transition hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold truncate">{n.title}</p>
                  {!n.readAt ? <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">جديد</span> : null}
                </div>
                {n.body ? <p className="mt-1 text-sm text-muted-foreground">{n.body}</p> : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
