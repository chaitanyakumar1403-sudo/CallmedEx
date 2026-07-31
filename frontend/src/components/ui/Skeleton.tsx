import { memo } from "react";

export const Skeleton = memo(function Skeleton({ variant = "line" }: { variant?: "line" | "title" | "card" }) {
  return <div className={`cm-skeleton cm-skeleton--${variant}`} />;
});

export const SkeletonRows = memo(function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="cm-skeleton-rows">
      <span className="cm-sr">Loading</span>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} variant="card" />)}
    </div>
  );
});
