import { CountUp } from "./CountUp";

// Animated stats band (à la Zenser's "+1.422 Hogares" panel) — but with OUR real
// numbers from the bundled Catastro snapshot, so nothing is invented.
const STATS: Array<{ value: number; decimals?: number; suffix?: string; label: string }> = [
  { value: 2467, label: "Edificios mapeados" },
  { value: 43055, label: "Viviendas" },
  { value: 8.8, decimals: 1, suffix: " M m²", label: "Superficie construida" },
  { value: 100, suffix: " %", label: "Con datos oficiales del Catastro" },
];

export function StatsBand() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-8 px-6 py-12 sm:grid-cols-4 sm:py-14">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            className="animate-fade-up text-center motion-reduce:animate-none"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <div className="text-3xl font-extrabold tracking-tight text-zen-green-deep sm:text-4xl">
              <CountUp value={s.value} decimals={s.decimals} suffix={s.suffix} />
            </div>
            <div className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
