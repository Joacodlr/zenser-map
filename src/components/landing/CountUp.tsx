import { useEffect, useRef, useState } from "react";

// Animated count-up that starts when it scrolls into view (like the Zenser stats
// panel). Honest: the numbers come from our real Catastro snapshot. Respects
// prefers-reduced-motion by jumping straight to the final value.
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  duration = 1500,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(value);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
            setN(value * eased);
            if (t < 1) requestAnimationFrame(tick);
            else setN(value);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref}>
      {n.toLocaleString("es-ES", { maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
