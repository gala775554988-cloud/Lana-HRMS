import RecordPage from "../page";

export default async function RecordEditPage({ params, searchParams }: { params: Promise<{ module: string; id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { module, id } = await params;
  const query = searchParams ? await searchParams : {};
  return RecordPage({
    params: Promise.resolve({ module, id }),
    searchParams: Promise.resolve({ ...query, tab: "personal" }),
  });
}
