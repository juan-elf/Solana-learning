export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-800/60 ${className}`} />;
}

export function VaultCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 min-h-[140px]">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div>
        <Skeleton className="mb-2 h-3 w-12" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-1.5 h-2.5 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PairsTableSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
      <div className="px-6 py-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
