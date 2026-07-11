import RecordPage from "../../page";

export default async function RecordTabActionPage({ params, searchParams }: { params: Promise<{ module: string; id: string; tab: string; action: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { module, id, tab } = await params;
  const query = searchParams ? await searchParams : {};
  return RecordPage({
    params: Promise.resolve({ module, id }),
    searchParams: Promise.resolve({ ...query, tab }),
  });
}
