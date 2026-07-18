export function PortalModuleSkeleton({ title }: { title: string }) {
  return (
    <main className="space-y-6" dir="rtl" aria-busy="true">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800" />
          <div className="h-4 w-72 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800" />
          <span className="sr-only">تحميل {title}</span>
        </div>
        <div className="h-11 w-36 animate-pulse rounded-2xl bg-primary/70 dark:bg-primary" />
      </div>
      <section className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-3xl border bg-white/70 p-5 shadow-sm backdrop-blur dark:bg-slate-950/60">
            <div className="h-4 w-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 h-8 w-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </section>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-3xl border bg-white/70 p-5 shadow-sm backdrop-blur dark:bg-slate-950/60">
            <div className="flex items-center justify-between gap-4">
              <div className="h-6 w-44 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="mt-4 h-4 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((__, step) => (
                <div key={step} className="h-10 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
