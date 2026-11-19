"use client";

import { useEffect, useState } from "react";
import type { Locale } from "../lib/i18n";

/**
 * The "destruction ticker" from the landing page (surpluspurpose.com): a live
 * count that starts at €0 when the page opens and rises at the pace usable goods
 * are destroyed worldwide — €400bn/year ≈ €12,684/second. It reframes the login
 * with the problem sur.plus exists to solve. Honest by construction: it counts
 * elapsed time on THIS page, it is not a claimed platform figure.
 */
const RATE_PER_SECOND = 400e9 / (365 * 24 * 3600);

export function DestructionTicker({
  locale,
  eyebrow,
  caption
}: {
  locale: Locale;
  eyebrow: string;
  caption: string;
}) {
  // Starts at 0 on both server and client render → no hydration mismatch.
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => setValue(((Date.now() - start) / 1000) * RATE_PER_SECOND);
    tick();
    const id = window.setInterval(tick, reduce ? 1000 : 100);
    return () => window.clearInterval(id);
  }, []);

  const formatted = `€${Math.floor(value).toLocaleString(locale === "de" ? "de-DE" : "en-GB")}`;

  return (
    <div>
      <p className="text-sm text-white/75">{eyebrow}</p>
      <p aria-live="off" className="mt-2 text-6xl font-semibold tabular-nums tracking-tight xl:text-7xl">
        {formatted}
      </p>
      <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-white/75">{caption}</p>
    </div>
  );
}
