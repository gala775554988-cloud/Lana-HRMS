export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse" dir="rtl">
      <div className="h-16 rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
}