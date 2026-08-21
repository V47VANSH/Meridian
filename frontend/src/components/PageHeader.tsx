import type { ReactNode } from "react";

export default function PageHeader({
  code,
  title,
  description,
  action,
}: {
  code?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const cleanCode = code ? code.replace(/^[A-Z]+-\d{2}\s*\/\s*/, "") : "";

  return (
    <div className="mb-6 flex items-start justify-between gap-6">
      <div>
        {cleanCode && <p className="bp-eyebrow mb-1.5">{cleanCode}</p>}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-300 max-w-xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}

