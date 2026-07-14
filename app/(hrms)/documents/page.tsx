import { redirect } from "next/navigation";

export default async function DocumentsRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  params.set("tab", "documents");
  const employeeId = query.employeeId;
  if (typeof employeeId === "string") params.set("documents__employeeId", employeeId);
  redirect(`/contracts?${params.toString()}`);
}
