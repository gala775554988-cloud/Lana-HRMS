export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" dir="rtl">
      <div className="h-[280px] rounded-[2rem] bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-3xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="h-64 rounded-3xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-64 rounded-3xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}