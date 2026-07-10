import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted/60",
        "after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent after:animate-[shimmer_1.6s_infinite]",
        className,
      )}
    />
  );
}

export function StatSkeleton() {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-2">
        <Skeleton className="w-8 h-8 rounded-xl" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="mt-2 h-5 w-24" />
    </div>
  );
}
