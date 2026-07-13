export default function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bp-card px-5 py-4">
      <p className="bp-eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-display font-semibold text-ink-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
