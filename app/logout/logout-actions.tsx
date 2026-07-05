'use client';

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutActions() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({
      redirect: true,
      callbackUrl: "/login",
    });
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleLogout} className="w-full">
        نعم، سجل خروجي
      </Button>
      <Button variant="outline" className="w-full" onClick={() => router.back()}>
        إلغاء
      </Button>
    </div>
  );
}
