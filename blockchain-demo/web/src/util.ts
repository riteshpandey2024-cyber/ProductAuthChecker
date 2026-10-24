import { useEffect, useRef, useState } from "react";

/** Same hash gives the same colour, so identical blocks look identical across nodes. */
export function hashColor(hash: string | null | undefined, lightness = 42): string {
  if (!hash) return "#888";
  let h = 0;
  for (let i = 2; i < 14; i++) h = (h * 31 + hash.charCodeAt(i)) % 360;
  return `hsl(${h} 62% ${lightness}%)`;
}

export const short = (hash: string | null | undefined, n = 8) => (hash ? hash.slice(2, 2 + n) : "—");

export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[] = []): T | null {
  const [value, setValue] = useState<T | null>(null);
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const v = await saved.current();
        if (alive) setValue(v);
      } catch {
        /* the backend may be restarting; keep the last value */
      }
    };
    run();
    const t = setInterval(run, ms);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
  return value;
}

export function randomChipSerial(): string {
  return Array.from({ length: 7 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase(),
  ).join(":");
}
