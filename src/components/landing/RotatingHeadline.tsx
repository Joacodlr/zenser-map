import { useEffect, useState } from "react";

// Crossfading headline rotator — mirrors the Zenser hero slider's rotating
// messages. Items are stacked in one grid cell so the height stays stable.
export function RotatingHeadline({
  items,
  interval = 3800,
  className = "",
}: {
  items: string[];
  interval?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || items.length <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), interval);
    return () => clearInterval(t);
  }, [items.length, interval]);

  return (
    <span className={`grid ${className}`}>
      {items.map((it, idx) => (
        <span
          key={idx}
          aria-hidden={idx !== i}
          className={`col-start-1 row-start-1 transition-opacity duration-700 ${
            idx === i ? "opacity-100" : "opacity-0"
          }`}
        >
          {it}
        </span>
      ))}
    </span>
  );
}
