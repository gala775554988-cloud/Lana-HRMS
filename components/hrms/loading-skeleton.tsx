export function LoadingSkeleton() {
  return (
    <section className="space-y-6" aria-label="Loading content">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-8 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border bg-muted/50" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg border bg-muted/50" />
    </section>
  );
}