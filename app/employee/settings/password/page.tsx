import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PasswordPage() {
  return (
    <Card>
      <CardHeader><CardTitle>تغيير كلمة المرور</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500 mb-4">يمكنك تغيير كلمة المرور من خلال صفحة "نسيت كلمة المرور" أو طلب من الموارد البشرية.</p>
        <Button variant="outline">طلب تغيير كلمة المرور</Button>
      </CardContent>
    </Card>
  );
}
