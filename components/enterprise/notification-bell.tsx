"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetch("/api/enterprise/notifications?status=unread", { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => { if (active) setCount(data.unreadCount ?? 0); })
        .catch(() => null);
    };
    load();
    const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return (
    <Button asChild variant="ghost" size="icon" className="relative" aria-label="الإشعارات">
      <Link href="/notification-center">
        <Bell className="h-4 w-4" />
        {count > 0 ? <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{count > 99 ? "99+" : count}</span> : null}
      </Link>
    </Button>
  );
}
