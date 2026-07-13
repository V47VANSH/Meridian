import type { ReactNode } from "react";

function formatEyebrow(code?: string) {
  if (!code) return null;

  const label = code.includes("/") ? code.split("/").slice(1).join("/").trim() : code.trim();
  return label
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

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
  const eyebrow = formatEyebrow(code);

  return (
    <div className="mb-6 flex items-start justify-between gap-6">
      <div>
        {eyebrow && <p className="bp-eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-300 max-w-xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}
