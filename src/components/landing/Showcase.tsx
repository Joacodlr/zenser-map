// Showcase row: four real MiniStores (created with Zenser Map) embedded as cards,
// so visitors see exactly what the app generates per building. Uses Deanna's
// iframe-optimized /embed/ view of each store.
const EXAMPLES: Array<{ slug: string; label: string }> = [
  { slug: "calle-doctor-castelo-10-28009-asn9", label: "Calle Doctor Castelo, 10" },
  { slug: "calle-narvaez-37-28009-hsli", label: "Calle Narváez, 37" },
  { slug: "calle-ibiza-11-28009-vrzg", label: "Calle Ibiza, 11" },
  { slug: "calle-lope-de-rueda-53-28009-vibo", label: "Calle Lope de Rueda, 53" },
];

export function Showcase() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Cada edificio, una MiniStore
        </h2>
        <p className="mt-2 text-slate-500">
          Ejemplos reales creados con Zenser Map — esto es lo que genera cada edificio.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {EXAMPLES.map((ex) => (
          // Fixed window that crops the embed's dark margins: the iframe is taller
          // than the window and vertically centred, so only the white MiniStore
          // card shows and the black bands are clipped away.
          <div
            key={ex.slug}
            className="relative h-[290px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            <iframe
              src={`https://deanna.pro/embed/${ex.slug}`}
              title={`MiniStore — ${ex.label}`}
              loading="lazy"
              className="absolute inset-x-0 top-1/2 h-[440px] w-full -translate-y-1/2 border-0"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
