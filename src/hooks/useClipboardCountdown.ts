import { useEffect, useState } from "react";

export function useClipboardCountdown(active: boolean, durationMs: number): number {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setRemainingMs(0);
      return;
    }
    setRemainingMs(durationMs);
    const start = Date.now();
    const id = setInterval(() => {
      const left = Math.max(0, durationMs - (Date.now() - start));
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(id);
      }
    }, 250);
    return () => clearInterval(id);
  }, [active, durationMs]);

  return Math.ceil(remainingMs / 1000);
}
