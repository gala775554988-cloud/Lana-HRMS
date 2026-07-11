export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse" dir="rtl">
      <div className="h-16 rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 rounded-3xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
}