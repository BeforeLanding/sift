/**
 * Jev client factory.
 *
 * Mirrors the shape of `src/providers/index.ts`: one place decides which
 * implementation backs the interface, and it logs only *which* one — never a
 * key or a URL.
 */

import type { JevClient } from "./types.ts";
import { createMockJev } from "./mock.ts";
import { createRealJev } from "./real.ts";

/**
 * Pick a Jev client.
 *
 * With no API key the deterministic mock runs, so the pipeline works offline
 * and the filtering logic stays testable. `JEV_ENABLED=false` is the kill
 * switch: it forces pass-through-worthy behavior even when a key is present.
 */
export async function createJev(apiKey = process.env["TYPESAFE_API_KEY"]): Promise<JevClient> {
  const enabled = process.env["JEV_ENABLED"] !== "false";

  if (!enabled) {
    console.log("[jev] JEV_ENABLED=false — using mock Jev client (pass-through).");
    return createMockJev();
  }

  if (!apiKey) {
    console.log("[jev] No TYPESAFE_API_KEY — using mock Jev client (offline, lenient).");
    return createMockJev();
  }

  console.log("[jev] Using TypeSafe Jev client.");
  return createRealJev();
}
