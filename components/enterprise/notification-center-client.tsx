"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, MailOpen, MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const tabs = [
  { key: "all", label: "جميع الإشعارات", icon: Bell },
  { key: "unread", label: "غير المقروءة", icon: MailWarning },
  { key: "read", label: "تم قراءتها", icon: MailOpen }
];

export function NotificationCenterClient() {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    fetch(`/api/enterprise/notifications?status=${tab}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      });
  };

  useEffect(load, [tab]);

  function markRead(id?: string) {
    startTransition(async () => {
      await fetch("/api/enterprise/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true })
      });
      load();
    });
  }

  function openNotification(notification: NotificationItem) {
    if (!notification.readAt) markRead(notification.id);
    if (notification.link) router.push(notification.link);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <Button key={key} type="button" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)} className="gap-2">
              <Icon className="h-4 w-4" />{label}
            </Button>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={() => markRead()} disabled={isPending || unreadCount === 0} className="gap-2">
          <CheckCheck className="h-4 w-4" />Mark all read ({unreadCount})
        </Button>
      </div>
      <div className="grid gap-3">
        {notifications.length === 0 ? <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">لا توجد إشعارات</div> : null}
        {notifications.map((notification) => (
          <button key={notification.id} type="button" onClick={() => openNotification(notification)} className="rounded-2xl border bg-card p-4 text-start shadow-sm transition hover:bg-muted/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{notification.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{notification.readAt ? "Read" : "Unread"}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
