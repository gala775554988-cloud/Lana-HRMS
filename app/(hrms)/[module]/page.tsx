import { ModulePageBody } from "@/components/hrms/module-page-body";

export default async function ResourcePage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { module: resourceKey } = await params;
  const query = await searchParams;
  return <ModulePageBody resourceKey={resourceKey} query={query} />;
}
