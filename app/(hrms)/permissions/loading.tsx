export default function PermissionsLoading() {
  return (
    <div className="space-y-6 animate-pulse" dir="rtl">
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {[1, 2].map((i) => <div key={i} className="h-9 w-32 rounded-lg bg-slate-200 dark:bg-slate-800" />)}
      </div>
      <div className="h-[500px] rounded-3xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}
