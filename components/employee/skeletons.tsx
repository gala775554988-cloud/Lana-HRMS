'use client';

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl w-2/3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    </div>
  );
}

export function DashboardContentSkeleton() {
  return <DashboardSkeleton />;
}
