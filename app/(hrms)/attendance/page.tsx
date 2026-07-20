import { ModulePageBody } from "@/components/hrms/module-page-body";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <ModulePageBody resourceKey="attendance" query={query} />;
}
