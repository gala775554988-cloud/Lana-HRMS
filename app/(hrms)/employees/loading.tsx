export default function EmployeesLoading() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {[1,2,3].map(i => <div key={i} className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />)}
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );
}
