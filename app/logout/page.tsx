'use client';

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";

export default function LogoutPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ 
      redirect: true,
      callbackUrl: "/login" 
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <AuthCard 
          title="تسجيل الخروج" 
          description="هل أنت متأكد من تسجيل الخروج من الحساب؟"
        >
          <div className="space-y-4">
            <Button 
              onClick={handleLogout} 
              className="w-full"
            >
              نعم، سجل خروجي
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.back()}
            >
              إلغاء
            </Button>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
