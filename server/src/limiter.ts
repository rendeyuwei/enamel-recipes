export type LimitGate = { blocked: false } | { blocked: true; retryAfterSec: number };

export function createLimiter(opts: { limit: number; windowMs: number; now?: () => number }) {
  const hits = new Map<string, { n: number; reset: number }>();
  const now = opts.now ?? Date.now;

  function row(key: string): { n: number; reset: number } | undefined {
    const current = hits.get(key);
    if (!current) return undefined;
    if (now() >= current.reset) {
      hits.delete(key);
      return undefined;
    }
    return current;
  }

  return {
    blocked(key: string): LimitGate {
      const current = row(key);
      if (!current || current.n < opts.limit) return { blocked: false };
      return { blocked: true, retryAfterSec: Math.max(1, Math.ceil((current.reset - now()) / 1000)) };
    },
    hit(key: string) {
      const t = now();
      const current = row(key);
      if (!current) {
        hits.set(key, { n: 1, reset: t + opts.windowMs });
        return;
      }
      current.n += 1;
    },
    reset(key: string) {
      hits.delete(key);
    },
    take(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
      const gate = this.blocked(key);
      if (gate.blocked) return { ok: false, retryAfterSec: gate.retryAfterSec };
      this.hit(key);
      return { ok: true };
    },
  };
}
