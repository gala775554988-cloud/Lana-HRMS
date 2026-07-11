export default function HRDashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" dir="rtl">
      <div className="h-24 rounded-3xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="h-80 rounded-3xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}