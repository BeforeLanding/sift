/**
 * Deterministic offline Jev client.
 *
 * Used whenever TYPESAFE_API_KEY is unset, so the pipeline (and its tests) run
 * end to end with no key and no network.
 *
 * Deliberately *lenient*: with no real model behind it, a heuristic that drops
 * items is a heuristic that silently deletes news. It only pushes a score far
 * enough to matter when the profile actually says something, and the gate
 * never skips a source that has any items at all.
 */

import type { JevClient, JevGateVerdict, JevItem, JevScore, JevSourceDigest, JevState } from "./types.ts";

/** Weight per matched keyword, by category. Tracked projects dominate. */
const WEIGHT_TRACKED = 0.3;
const WEIGHT_TOPIC = 0.2;
const WEIGHT_POSITIVE = 0.15;
const WEIGHT_NEGATIVE = -0.25;

/** Score before any evidence — the neutral midpoint, so nothing drops by default. */
const BASELINE = 0.5;

/** What the mock reports as its certainty. High, because it is deterministic. */
const MOCK_CONFIDENCE = 0.8;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Count how many of `keywords` appear in `haystack` (case-insensitive). */
function countHits(haystack: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    const needle = keyword.trim().toLowerCase();
    if (needle && haystack.includes(needle)) hits += 1;
  }
  return hits;
}

/**
 * Tracked projects are matched on the full path ("openclaw/openclaw") or on the
 * bare repo name ("openclaw"), since most labels only carry the latter.
 */
function countProjectHits(haystack: string, projects: string[]): number {
  const needles = projects
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .flatMap((p) => {
      const bare = p.split("/").pop() ?? p;
      return bare.length >= 4 && bare !== p ? [p, bare] : [p];
    });

  let hits = 0;
  for (const needle of needles) {
    if (haystack.includes(needle)) hits += 1;
  }
  return hits;
}

function scoreLabel(label: string, state: JevState): number {
  const haystack = label.toLowerCase();

  const raw =
    BASELINE +
    WEIGHT_TRACKED * countProjectHits(haystack, state.trackedProjects) +
    WEIGHT_TOPIC * countHits(haystack, state.topics) +
    WEIGHT_POSITIVE * countHits(haystack, state.positiveKeywords) +
    WEIGHT_NEGATIVE * countHits(haystack, state.negativeKeywords);

  return clamp01(raw);
}

export function createMockJev(): JevClient {
  return {
    name: "mock",

    async scoreItems(items: JevItem[], state: JevState): Promise<JevScore[]> {
      return items.map((item) => ({
        id: item.id,
        score: scoreLabel(item.label, state),
        confidence: MOCK_CONFIDENCE,
      }));
    },

    async gateSources(sources: JevSourceDigest[], _state: JevState): Promise<JevGateVerdict[]> {
      // Lenient: a source with any items at all is worth reporting. Empty
      // sources never even reach the gate — `collectCandidates` filters them
      // out first, since `summarizeRepo` already handles them without an LLM
      // call — so in practice the mock never gates a report away.
      return sources.map((source) => ({
        id: source.id,
        worth: source.itemCount === 0 ? 0 : 0.8,
        confidence: MOCK_CONFIDENCE,
      }));
    },

    usage() {
      return { inputTokens: 0, outputTokens: 0 };
    },
  };
}
