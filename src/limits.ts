/**
 * Shared concurrency limiter.
 *
 * The LLM phase and the Jev pre-filter both call a rate-limited remote API and
 * both need to cap in-flight requests — but for different reasons, against
 * different providers, and with different budgets. They therefore get separate
 * limiter instances rather than sharing one pool, so a slow Jev call can never
 * occupy a slot the LLM phase is waiting on.
 */

export interface Limiter {
  /** Resolve when a slot is free; the caller must `release()` it. */
  acquire(): Promise<void>;
  /** Return a slot, handing it to the next waiter if there is one. */
  release(): void;
}

export function createLimiter(concurrency: number): Limiter {
  let slots = concurrency;
  const queue: Array<() => void> = [];

  return {
    acquire(): Promise<void> {
      if (slots > 0) {
        slots--;
        return Promise.resolve();
      }
      return new Promise((resolve) => queue.push(resolve));
    },

    release(): void {
      const next = queue.shift();
      if (next) {
        next();
      } else {
        slots++;
      }
    },
  };
}
