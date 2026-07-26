import type { DataSourceType } from "@/types";

const STYLES: Record<DataSourceType, { label: string; className: string }> = {
  OFFICIAL: { label: "OFFICIAL", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  ESTIMATED: { label: "ESTIMATED", className: "bg-amber-100 text-amber-800 border-amber-200" },
  SIMULATED: { label: "SIMULATED", className: "bg-sky-100 text-sky-800 border-sky-200" },
  EXTERNAL_API: { label: "EXTERNAL API", className: "bg-violet-100 text-violet-800 border-violet-200" },
  DEMO: { label: "DEMO", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function DataSourceBadge({
  sourceType,
  source,
}: {
  sourceType: DataSourceType;
  source?: string;
}) {
  const s = STYLES[sourceType];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {source && (
        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {source}
        </span>
      )}
      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${s.className}`}>
        {s.label}
      </span>
    </span>
  );
}

// Small helper to render a labelled value with its provenance, or "No disponible".
export function SourcedRow({
  label,
  value,
  source,
  sourceType,
  suffix = "",
}: {
  label: string;
  value: string | number | null;
  source: string;
  sourceType: DataSourceType;
  suffix?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold text-ink">
          {value === null ? (
            <span className="font-normal italic text-slate-400">No disponible</span>
          ) : (
            <>
              {value}
              {suffix}
            </>
          )}
        </span>
        <DataSourceBadge source={source} sourceType={sourceType} />
      </div>
    </div>
  );
}
