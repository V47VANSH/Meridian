export default function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="bp-card border-dashed px-6 py-10 text-center">
      <p className="text-sm text-ink-300">{title}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
