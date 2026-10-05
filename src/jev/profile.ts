/**
 * The interest profile — what the user cares about, and the tuning knobs that
 * decide how aggressively Jev is allowed to drop things.
 *
 * Loaded from the `profile:` section of config.yml (see src/config.ts). An
 * empty profile disables the whole Jev layer rather than filtering everything
 * away: with no stated interests there is no basis to drop anything.
 */

import type { JevState } from "./types.ts";

export interface JevProfile {
  topics: string[];
  positiveKeywords: string[];
  negativeKeywords: string[];
  trackedProjects: string[];
  /** Drop an item when its score is below this. */
  itemThreshold: number;
  /** Skip a source when its report-worthiness is below this. */
  gateThreshold: number;
  /** Below this confidence, Jev's answer is ignored (fail-open). */
  minConfidence: number;
  /** Cap on items sent to Jev per source, applied after the existing ranking. */
  maxItemsPerSource: number;
}

export const DEFAULT_PROFILE: JevProfile = {
  topics: [],
  positiveKeywords: [],
  negativeKeywords: [],
  trackedProjects: [],
  itemThreshold: 0.5,
  gateThreshold: 0.5,
  minConfidence: 0.25,
  maxItemsPerSource: 40,
};

/** A profile with nothing to match on — the layer short-circuits to pass-through. */
export function isProfileEmpty(p: JevProfile): boolean {
  return (
    p.topics.length === 0 &&
    p.positiveKeywords.length === 0 &&
    p.negativeKeywords.length === 0 &&
    p.trackedProjects.length === 0
  );
}

/** Normalize a profile into the shape Jev receives as its `state`. */
export function toJevState(p: JevProfile): JevState {
  return {
    topics: [...p.topics],
    positiveKeywords: [...p.positiveKeywords],
    negativeKeywords: [...p.negativeKeywords],
    trackedProjects: [...p.trackedProjects],
  };
}
