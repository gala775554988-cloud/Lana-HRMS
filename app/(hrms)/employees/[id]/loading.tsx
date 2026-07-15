export default function EmployeeProfileLoading() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-4 border-b pb-6">
        <div className="h-20 w-20 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />)}
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );
}
