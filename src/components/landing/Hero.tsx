import { RotatingHeadline } from "./RotatingHeadline";
import heroAerial from "@/assets/hero-aerial.jpg";

// Branded Zenser landing hero shown above the map. Navy backdrop with the green
// accent + logo, a rotating value line (à la Zenser's slider), floating brand
// shapes, and a CTA that smooth-scrolls down to the map.
const HEADLINES = [
  "Cada edificio, con su energía y su potencial solar.",
  "Datos oficiales del Catastro, edificio a edificio.",
  "El mapa energético del Barrio de Ibiza.",
];

export function Hero({ onExplore }: { onExplore: () => void }) {
  return (
    <section className="relative isolate overflow-hidden bg-zen-navy">
      {/* Real IGN aerial of Barrio de Ibiza, slowly zooming, darkened for legibility. */}
      <img
        src={heroAerial}
        alt=""
        aria-hidden
        className="animate-slow-zoom absolute inset-0 -z-10 h-full w-full object-cover motion-reduce:animate-none"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-zen-navy/92 via-zen-navy/80 to-zen-navy/95"
      />

      {/* Decorative, gently floating brand shapes. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-float-slow absolute -right-32 -top-32 h-96 w-96 rounded-full border-2 border-zen-green/20" />
        <div className="animate-float absolute right-[22%] top-16 h-2.5 w-2.5 rounded-full bg-zen-green" />
        <div className="animate-float-slow absolute left-[18%] bottom-24 h-1.5 w-1.5 rounded-full bg-white/40" />
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center sm:py-32">
        {/* Logo mark (inverted for the dark backdrop). */}
        <div className="animate-fade-up flex h-16 w-16 flex-col items-center justify-center rounded-2xl bg-zen-green font-extrabold leading-[0.82] text-zen-navy shadow-lg motion-reduce:animate-none">
          <span className="text-xl">zen</span>
          <span className="text-xl">ser.</span>
        </div>

        <h1
          className="animate-fade-up mt-8 text-5xl font-extrabold tracking-tight text-white motion-reduce:animate-none sm:text-7xl"
          style={{ animationDelay: "80ms" }}
        >
          Zenser <span className="text-zen-green">Map</span>
        </h1>

        {/* Rotating value line. */}
        <RotatingHeadline
          items={HEADLINES}
          className="animate-fade-up mt-5 max-w-2xl text-lg font-medium text-slate-300 motion-reduce:animate-none sm:text-xl"
        />

        <button
          onClick={onExplore}
          className="group animate-fade-up mt-10 inline-flex items-center gap-2 rounded-full bg-zen-green px-7 py-3 text-sm font-bold text-zen-navy shadow-lg transition-transform hover:-translate-y-0.5 motion-reduce:animate-none"
          style={{ animationDelay: "160ms" }}
        >
          Explorar el mapa
          <span aria-hidden className="animate-bounce">↓</span>
        </button>
      </div>
    </section>
  );
}
