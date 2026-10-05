/**
 * Jev (TypeSafe "System One") front-end judgment layer — transport-neutral types.
 *
 * Jev is deliberately *not* an `LlmProvider`. That interface is text-in /
 * text-out (`call(prompt, maxTokens): Promise<string>`); Jev generates no text.
 * It answers structured questions against a `state` and returns typed verdicts
 * with a confidence, which is what lets the pipeline branch on the answer
 * instead of parsing prose back out of it.
 *
 * Everything here is wire-agnostic so the mock and the real SDK client are
 * interchangeable, and so the filtering logic is testable with no network.
 */

/** What the user cares about, as handed to Jev as the `state`. */
export interface JevState {
  topics: string[];
  positiveKeywords: string[];
  negativeKeywords: string[];
  trackedProjects: string[];
}

/** One item put up for scoring. `label` is the text Jev judges. */
export interface JevItem {
  /** Globally unique key, e.g. `github:claude-code:issue:1234`. */
  id: string;
  label: string;
}

/** A verdict on one item. `score` is in [0,1] — higher means more relevant. */
export interface JevScore {
  id: string;
  score: number;
  /** Omitted when the client could not estimate one. */
  confidence?: number;
}

/** A compact description of a source, for the report-level gate. */
export interface JevSourceDigest {
  /** Source id, e.g. `claude-code`, `trending`, `hn`. */
  id: string;
  /** Human-readable name, used in the question text. */
  name: string;
  /** Compact digest of what arrived today. */
  digest: string;
  itemCount: number;
}

/** Report-worthiness of one source. `worth` is in [0,1]. */
export interface JevGateVerdict {
  id: string;
  worth: number;
  confidence?: number;
}

/**
 * The Jev surface the pipeline depends on.
 *
 * Both methods must be *safe*: a failure rejects, and the caller fails open
 * (keeps the items / generates the report). Implementations must not throw on
 * a malformed answer — return a low-confidence verdict instead.
 */
export interface JevClient {
  /** Human-readable identifier, e.g. "mock", "typesafe". */
  readonly name: string;
  /** Score a batch of items against the profile. */
  scoreItems(items: JevItem[], state: JevState): Promise<JevScore[]>;
  /** Decide which sources are worth a full report today. */
  gateSources(sources: JevSourceDigest[], state: JevState): Promise<JevGateVerdict[]>;
  /** Cumulative token usage, when the implementation can report it. */
  usage(): { inputTokens: number; outputTokens: number };
}

/** Run-wide counters, the Jev analogue of `llmStats` in report.ts. */
export interface JevStats {
  calls: number;
  failed: number;
  itemsScored: number;
  itemsDropped: number;
  sourcesGated: number;
  sourcesSkipped: number;
  usage: { inputTokens: number; outputTokens: number };
}
