import { getCurrentEmployee } from "@/lib/employee/data";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DocumentsPage() {
  const employee = await getCurrentEmployee();
  const documents = employee
    ? await prisma.employeeDocument.findMany({
        where: { employeeId: employee.id },
        orderBy: [{ expiresAt: "asc" }, { uploadedAt: "desc" }],
        take: 100,
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">المستندات</h1>
        <p className="text-muted-foreground mt-2">المستندات المرتبطة بملفك الوظيفي وحالة اعتمادها.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مستنداتي</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              لا توجد مستندات مرتبطة بملفك حالياً. عند إضافة مستند من الموارد البشرية سيظهر هنا مباشرة.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">الاسم</th>
                    <th className="px-4 py-3 text-right font-medium">النوع</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة</th>
                    <th className="px-4 py-3 text-right font-medium">تاريخ الانتهاء</th>
                    <th className="px-4 py-3 text-right font-medium">الملف</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td className="px-4 py-3 font-medium">{document.name}</td>
                      <td className="px-4 py-3">{document.type}</td>
                      <td className="px-4 py-3">{document.status}</td>
                      <td className="px-4 py-3">{document.expiresAt ? document.expiresAt.toLocaleDateString("ar-SA") : "—"}</td>
                      <td className="px-4 py-3">
                        <Button asChild variant="outline" size="sm">
                          <Link href={document.fileUrl} target="_blank" rel="noreferrer">فتح الملف</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
