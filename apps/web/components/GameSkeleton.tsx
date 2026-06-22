export function GameSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="aspect-[4/3] rounded-2xl bg-fundle-card" />
      <div className="surface p-4">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-16 rounded-xl bg-fundle-bg-elevated" />
          ))}
        </div>
      </div>
      <div className="surface p-3.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="mb-1 px-3 py-2.5">
            <div className="h-4 rounded bg-fundle-bg-elevated" />
          </div>
        ))}
      </div>
    </div>
  );
}
