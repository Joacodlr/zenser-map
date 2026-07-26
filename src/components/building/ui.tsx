import type { ReactNode } from "react";

export function Panel({ children }: { children: ReactNode }) {
  return <div className="px-4">{children}</div>;
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="px-4 py-6 text-sm text-rose-600">{message}</div>;
}

export function EmptyNote({ message }: { message: string }) {
  return <div className="px-4 py-6 text-sm italic text-slate-400">{message}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h4 className="mt-4 mb-1 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </h4>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-base font-semibold text-ink">{value}</div>
    </div>
  );
}
