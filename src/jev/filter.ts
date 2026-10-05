/**
 * The Jev pre-filter: the pipeline's front-end judgment layer.
 *
 * Runs between `fetchAllData` and every LLM call, in two stages:
 *
 *   1. **Gate** — one bundled call decides which whole sources are worth a
 *      report today. This is first because it is the biggest saving: a source
 *      that will be skipped costs zero item questions.
 *   2. **Score** — the surviving sources' shortlists are scored in batches and
 *      the low-signal items dropped.
 *
 * Every failure path here is **fail-open**. Jev is a non-essential judge, so a
 * Jev outage must degrade to a plain agents-radar run, never a thin one:
 *
 *   - a failed or timed-out batch keeps all of its items;
 *   - an item is dropped only when Jev is *confident* it is below threshold;
 *   - a source whose shortlist is dropped entirely keeps its top few items;
 *   - a broadly failing Jev is disabled for the rest of the run.
 *
 * None of this touches `llmStats` or `assertLlmHealthy` in report.ts. Those
 * gate *publishing* on the LLM provider being up, which is a different
 * question with a different consequence.
 */

import type { GitHubDiscussion, GitHubItem, RepoFetch } from "../github.ts";
import type { HnData } from "../hn.ts";
import type { PhData } from "../ph.ts";
import type { ArxivData } from "../arxiv.ts";
import type { HfData } from "../hf.ts";
import type { DevtoData } from "../devto.ts";
import type { LobstersData } from "../lobsters.ts";
import type { TrendingData } from "../trending.ts";
import type { WebFetchResult } from "../web.ts";
import { topDiscussions, topN } from "../prompts.ts";
import { createLimiter } from "../limits.ts";
import { isProfileEmpty, toJevState, type JevProfile } from "./profile.ts";
import type { JevClient, JevItem, JevScore, JevSourceDigest, JevState } from "./types.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Everything `fetchAllData` produces — the pre-filter's unit of work. */
export interface FetchedData {
  fetched: RepoFetch[];
  skillsData: { prs: GitHubItem[]; issues: GitHubItem[] };
  webResults: WebFetchResult[];
  trendingData: TrendingData;
  hnData: HnData;
  phData: PhData;
  arxivData: ArxivData;
  hfData: HfData;
  devtoData: DevtoData;
  lobstersData: LobstersData;
}

export interface PrefilterResult {
  /** The same object, with low-signal items removed and `gatedOff` set. */
  data: FetchedData;
  /** Ids of sources the gate skipped — repos, `claude-code-skills`, `trending`. */
  gated: Set<string>;
}

/** One list Jev judges, plus how to write the survivors back. */
interface ItemTarget {
  sourceId: string;
  /** The shortlist, as Jev sees it. */
  entries: JevItem[];
  /** Write back the survivors, preserving the shortlist's order. */
  keep: (keepIds: ReadonlySet<string>) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Jev's own concurrency budget, deliberately separate from the LLM limiter:
 * Jev has its own rate limits, and sharing would let a slow Jev call stall the
 * LLM phase behind the same pool.
 */
const JEV_CONCURRENCY = 3;

/**
 * Questions per `systemOne` call. The docs are explicit that questions in one
 * call are evaluated in parallel and in isolation and that adding more barely
 * moves the response time, so bundling is nearly free.
 */
const JEV_QUESTIONS_PER_CALL = 60;

/** Outer bound on one Jev call, on top of the SDK's own per-attempt timeout. */
const JEV_TIMEOUT_MS = 20_000;

/** Failure ratio (after this many calls) that disables Jev for the run. */
const JEV_MIN_SAMPLES = 3;
const JEV_FAILURE_RATIO = 0.5;

/**
 * How many items to restore when a source's shortlist is dropped entirely.
 * A filtered-but-active source must not render as "no activity".
 */
const DROP_FLOOR = 5;

/** Item labels are truncated to bound input tokens. */
const LABEL_MAX = 300;

// ---------------------------------------------------------------------------
// Health accounting — the Jev analogue of llmStats, kept strictly separate
// ---------------------------------------------------------------------------

export const jevStats = {
  calls: 0,
  failed: 0,
  itemsScored: 0,
  itemsDropped: 0,
  sourcesGated: 0,
  sourcesSkipped: 0,
};

/** Set once Jev has failed broadly; every later prefilter becomes a no-op. */
let jevDown = false;

/** Test seam — the counters and the breaker are module state for the run. */
export function resetJevStats(): void {
  jevStats.calls = 0;
  jevStats.failed = 0;
  jevStats.itemsScored = 0;
  jevStats.itemsDropped = 0;
  jevStats.sourcesGated = 0;
  jevStats.sourcesSkipped = 0;
  jevDown = false;
}

/** One-line tally for the run's closing log. */
export function jevHealthLine(): string {
  if (jevStats.calls === 0) return "Jev: not used";
  const state = jevDown ? "DISABLED mid-run" : "ok";
  return (
    `Jev: ${state} | calls ${jevStats.calls} (${jevStats.failed} failed) | ` +
    `scored ${jevStats.itemsScored}, dropped ${jevStats.itemsDropped} | ` +
    `gated ${jevStats.sourcesGated}, skipped ${jevStats.sourcesSkipped}`
  );
}

// ---------------------------------------------------------------------------
// Call plumbing
// ---------------------------------------------------------------------------

/** Reject if `promise` has not settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  // The race abandons the loser; without this, a late rejection from `promise`
  // would surface as an unhandled rejection.
  promise.catch(() => {});
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

const jevLimiter = createLimiter(JEV_CONCURRENCY);

/**
 * Run one Jev call, accounting for it and tripping the breaker on broad
 * failure. Returns `undefined` on any failure — callers fail open.
 */
async function invoke<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  jevStats.calls += 1;
  await jevLimiter.acquire();
  try {
    return await withTimeout(fn(), JEV_TIMEOUT_MS);
  } catch (err) {
    jevStats.failed += 1;
    console.error(`  [jev] ${label} failed: ${err}`);
    if (jevStats.calls >= JEV_MIN_SAMPLES && jevStats.failed / jevStats.calls >= JEV_FAILURE_RATIO) {
      jevDown = true;
      console.error(
        `  [jev] ${jevStats.failed}/${jevStats.calls} calls failed — ` +
          `disabling Jev for the rest of this run (items are kept unfiltered).`,
      );
    }
    return undefined;
  } finally {
    jevLimiter.release();
  }
}

// ---------------------------------------------------------------------------
// Gate candidates
// ---------------------------------------------------------------------------

function truncate(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > LABEL_MAX ? `${flat.slice(0, LABEL_MAX)}…` : flat;
}

/** Clip a digest to its most recent few titles, so a gate question stays small. */
function titlesOf(titles: string[], n = 3): string {
  return titles
    .filter(Boolean)
    .slice(0, n)
    .map((t) => truncate(t))
    .join(" | ");
}

function repoCandidate(repo: RepoFetch): JevSourceDigest {
  const counts = [
    `${repo.issues.length} issues`,
    `${repo.prs.length} PRs`,
    `${repo.releases.length} releases`,
  ];
  if (repo.discussions.length) counts.push(`${repo.discussions.length} discussions`);

  const titles = titlesOf([
    ...topN(repo.issues, 3).map((i) => i.title),
    ...topN(repo.prs, 3).map((p) => p.title),
    ...repo.releases.slice(0, 3).map((r) => r.name || r.tag_name),
  ]);

  return {
    id: repo.cfg.id,
    name: repo.cfg.name,
    digest: `${counts.join(", ")}.${titles ? ` Recent: ${titles}` : ""}`,
    itemCount: repo.issues.length + repo.prs.length + repo.releases.length + repo.discussions.length,
  };
}

function collectCandidates(data: FetchedData, exempt: ReadonlySet<string>): JevSourceDigest[] {
  const candidates: JevSourceDigest[] = [];

  for (const repo of data.fetched) {
    if (exempt.has(repo.cfg.id)) continue;
    candidates.push(repoCandidate(repo));
  }

  const { skillsData } = data;
  const skillsCount = skillsData.prs.length + skillsData.issues.length;
  if (skillsCount > 0) {
    candidates.push({
      id: "claude-code-skills",
      name: "Claude Code Skills",
      digest: `${skillsCount} items. ${titlesOf([
        ...topN(skillsData.prs, 3).map((p) => p.title),
        ...topN(skillsData.issues, 3).map((i) => i.title),
      ])}`,
      itemCount: skillsCount,
    });
  }

  const { trendingRepos, searchRepos } = data.trendingData;
  if (trendingRepos.length + searchRepos.length > 0) {
    candidates.push({
      id: "trending",
      name: "GitHub Trending",
      digest:
        `${trendingRepos.length} trending repos, ${searchRepos.length} search hits. ` +
        titlesOf([...trendingRepos.map((r) => r.fullName), ...searchRepos.map((r) => r.fullName)]),
      itemCount: trendingRepos.length + searchRepos.length,
    });
  }

  const webCount = data.webResults.reduce((sum, r) => sum + r.newItems.length, 0);
  if (webCount > 0) {
    candidates.push({
      id: "web",
      name: "Official AI company sites",
      digest: `${webCount} new pages. ${titlesOf(
        data.webResults.flatMap((r) => r.newItems.map((i) => i.title)),
      )}`,
      itemCount: webCount,
    });
  }

  const sources: Array<{ id: string; name: string; titles: string[]; count: number }> = [
    {
      id: "hn",
      name: "Hacker News",
      titles: data.hnData.stories.map((s) => s.title),
      count: data.hnData.stories.length,
    },
    {
      id: "ph",
      name: "Product Hunt",
      titles: data.phData.products.map((p) => `${p.name} — ${p.tagline}`),
      count: data.phData.products.length,
    },
    {
      id: "arxiv",
      name: "ArXiv",
      titles: data.arxivData.papers.map((p) => p.title),
      count: data.arxivData.papers.length,
    },
    {
      id: "hf",
      name: "Hugging Face",
      titles: data.hfData.models.map((m) => m.id),
      count: data.hfData.models.length,
    },
    {
      id: "community",
      name: "Dev.to and Lobste.rs",
      titles: [
        ...data.devtoData.articles.map((a) => a.title),
        ...data.lobstersData.stories.map((s) => s.title),
      ],
      count: data.devtoData.articles.length + data.lobstersData.stories.length,
    },
  ];

  for (const source of sources) {
    candidates.push({
      id: source.id,
      name: source.name,
      digest: `${source.count} items. ${titlesOf(source.titles)}`,
      itemCount: source.count,
    });
  }

  // A source with nothing in it is never worth a question. `summarizeRepo`
  // already short-circuits to "no activity" without an LLM call, so gating an
  // empty source saves nothing — and it would swap that accurate message for a
  // vaguer "skipped". A failed fetch lands here too, matching what upstream
  // would have produced for it.
  return candidates.filter((candidate) => candidate.itemCount > 0);
}

// ---------------------------------------------------------------------------
// Item targets
// ---------------------------------------------------------------------------

/**
 * Build a target from a shortlist.
 *
 * The shortlists are cut with the very `topN` / `topDiscussions` the prompt
 * builders use, with a cap (`maxItemsPerSource`) at or above every builder's
 * own limit. Sampling the same way means the builders' re-sampling of the
 * survivors picks the same items it would have picked from the full list —
 * so a run where Jev drops nothing produces byte-identical prompts.
 */
function makeTarget<T>(
  sourceId: string,
  shortlist: T[],
  idOf: (item: T) => string,
  labelOf: (item: T) => string,
  assign: (kept: T[]) => void,
): ItemTarget {
  const entries = shortlist.map((item) => ({ id: idOf(item), label: truncate(labelOf(item)) }));
  return {
    sourceId,
    entries,
    keep: (keepIds) => assign(shortlist.filter((item) => keepIds.has(idOf(item)))),
  };
}

function labelNames(labels: Array<{ name: string }>): string {
  return labels
    .map((l) => l.name)
    .filter((n) => !n.startsWith("dependencies"))
    .join(" ");
}

function issueLabel(item: GitHubItem): string {
  return `${item.title} ${labelNames(item.labels)}`;
}

function discussionId(repoId: string, d: GitHubDiscussion): string {
  return `github:${repoId}:discussion:${d.number}`;
}

function collectItemTargets(
  data: FetchedData,
  gated: ReadonlySet<string>,
  profile: JevProfile,
): ItemTarget[] {
  const cap = profile.maxItemsPerSource;
  const targets: ItemTarget[] = [];

  for (const repo of data.fetched) {
    const repoId = repo.cfg.id;
    if (gated.has(repoId)) continue;

    targets.push(
      makeTarget(
        repoId,
        topN(repo.issues, cap),
        (i) => `github:${repoId}:issue:${i.number}`,
        issueLabel,
        (kept) => {
          repo.issues = kept;
        },
      ),
      makeTarget(
        repoId,
        topN(repo.prs, cap),
        (p) => `github:${repoId}:pr:${p.number}`,
        issueLabel,
        (kept) => {
          repo.prs = kept;
        },
      ),
      makeTarget(
        repoId,
        topDiscussions(repo.discussions, cap),
        (d) => discussionId(repoId, d),
        (d) => `${d.title} ${d.category}`,
        (kept) => {
          repo.discussions = kept;
        },
      ),
    );
    // Releases are deliberately never filtered: a handful a day at most, and a
    // release *is* the day's event — dropping one loses the headline.
  }

  if (!gated.has("claude-code-skills")) {
    const { skillsData } = data;
    targets.push(
      makeTarget(
        "claude-code-skills",
        topN(skillsData.prs, cap),
        (p) => `github:skills:pr:${p.number}`,
        issueLabel,
        (kept) => {
          skillsData.prs = kept;
        },
      ),
      makeTarget(
        "claude-code-skills",
        topN(skillsData.issues, cap),
        (i) => `github:skills:issue:${i.number}`,
        issueLabel,
        (kept) => {
          skillsData.issues = kept;
        },
      ),
    );
  }

  if (!gated.has("trending")) {
    const { trendingData } = data;
    targets.push(
      makeTarget(
        "trending",
        [...trendingData.trendingRepos],
        (r) => `trending:${r.fullName}`,
        (r) => `${r.fullName} — ${r.description}`,
        (kept) => {
          trendingData.trendingRepos = kept;
        },
      ),
      makeTarget(
        "trending",
        [...trendingData.searchRepos],
        (r) => `trending-search:${r.fullName}`,
        (r) => `${r.fullName} — ${r.description ?? ""}`,
        (kept) => {
          trendingData.searchRepos = kept;
        },
      ),
    );
  }

  if (!gated.has("web")) {
    // Write back by index: `keep` runs later, after every target is built, so
    // the closure has to reach into the array rather than return a new one.
    data.webResults.forEach((result, index) => {
      if (result.newItems.length === 0) return;
      targets.push(
        makeTarget(
          "web",
          [...result.newItems],
          (i) => `web:${i.url}`,
          (i) => `${i.title} (${i.category})`,
          (kept) => {
            data.webResults[index] = { ...result, newItems: kept };
          },
        ),
      );
    });
  }

  if (!gated.has("hn")) {
    targets.push(
      makeTarget(
        "hn",
        [...data.hnData.stories],
        (s) => `hn:${s.id}`,
        (s) => s.title,
        (kept) => {
          data.hnData.stories = kept;
        },
      ),
    );
  }

  if (!gated.has("ph")) {
    targets.push(
      makeTarget(
        "ph",
        [...data.phData.products],
        (p) => `ph:${p.id}`,
        (p) => `${p.name} — ${p.tagline} ${p.topics.join(" ")}`,
        (kept) => {
          data.phData.products = kept;
        },
      ),
    );
  }

  if (!gated.has("arxiv")) {
    targets.push(
      makeTarget(
        "arxiv",
        [...data.arxivData.papers],
        (p) => `arxiv:${p.id}`,
        (p) => `${p.title} ${p.categories.join(" ")}`,
        (kept) => {
          data.arxivData.papers = kept;
        },
      ),
    );
  }

  if (!gated.has("hf")) {
    targets.push(
      makeTarget(
        "hf",
        [...data.hfData.models],
        (m) => `hf:${m.id}`,
        (m) => `${m.id} ${m.pipelineTag} ${m.tags.join(" ")}`,
        (kept) => {
          data.hfData.models = kept;
        },
      ),
    );
  }

  if (!gated.has("community")) {
    targets.push(
      makeTarget(
        "community",
        [...data.devtoData.articles],
        (a) => `community:devto:${a.id}`,
        (a) => `${a.title} ${a.tags.join(" ")}`,
        (kept) => {
          data.devtoData.articles = kept;
        },
      ),
      makeTarget(
        "community",
        [...data.lobstersData.stories],
        (s) => `community:lobsters:${s.url}`,
        (s) => `${s.title} ${s.tags.join(" ")}`,
        (kept) => {
          data.lobstersData.stories = kept;
        },
      ),
    );
  }

  return targets;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Score every target's entries, batched across all sources. */
async function scoreTargets(
  targets: ItemTarget[],
  state: JevState,
  jev: JevClient,
): Promise<Map<string, JevScore>> {
  const all: JevItem[] = targets.flatMap((t) => t.entries);
  const byId = new Map<string, JevScore>();
  if (all.length === 0) return byId;

  const batches: JevItem[][] = [];
  for (let i = 0; i < all.length; i += JEV_QUESTIONS_PER_CALL) {
    batches.push(all.slice(i, i + JEV_QUESTIONS_PER_CALL));
  }

  console.log(
    `  [jev] Scoring ${all.length} item(s) across ${batches.length} call(s) of up to ${JEV_QUESTIONS_PER_CALL}...`,
  );

  const results = await Promise.all(
    batches.map((batch) => invoke(`score [${batch.length} items]`, () => jev.scoreItems(batch, state))),
  );

  for (const scores of results) {
    // A failed batch yields undefined — its items stay unscored and are kept.
    if (!scores) continue;
    for (const score of scores) byId.set(score.id, score);
  }

  jevStats.itemsScored += byId.size;
  return byId;
}

/** Which of a target's entries survive, applying the drop rule and the floor. */
function survivors(target: ItemTarget, scores: Map<string, JevScore>, profile: JevProfile): Set<string> {
  const keep = new Set<string>();

  for (const entry of target.entries) {
    const score = scores.get(entry.id);
    // Unscored (a failed batch) or an answer Jev was unsure of → keep.
    if (!score) {
      keep.add(entry.id);
      continue;
    }
    if (score.confidence !== undefined && score.confidence < profile.minConfidence) {
      keep.add(entry.id);
      continue;
    }
    if (score.score >= profile.itemThreshold) keep.add(entry.id);
  }

  // Never let a source go silent. The shortlist is already in the builder's own
  // ranking order, so its head is the best available.
  if (keep.size === 0 && target.entries.length > 0) {
    const floor = Math.min(DROP_FLOOR, target.entries.length);
    for (const entry of target.entries.slice(0, floor)) keep.add(entry.id);
    console.warn(
      `  [jev] ${target.sourceId}: every item scored below ${profile.itemThreshold} — ` +
        `keeping the top ${floor} so the report is not empty.`,
    );
  }

  return keep;
}

function applyScores(targets: ItemTarget[], scores: Map<string, JevScore>, profile: JevProfile): void {
  for (const target of targets) {
    const before = target.entries.length;
    if (before === 0) continue;
    const keep = survivors(target, scores, profile);
    target.keep(keep);
    jevStats.itemsDropped += before - keep.size;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Run the Jev pre-filter over a whole fetch bundle.
 *
 * Mutates `data` in place (filtered arrays, `gatedOff` flags) and returns the
 * set of source ids the gate skipped. A no-op when the profile is empty, when
 * Jev has been disabled, or when it fails.
 *
 * `exempt` names sources that must never be gated — the digest's primary
 * subject should not be gated away by a relevance heuristic.
 */
export async function prefilterBundle(
  data: FetchedData,
  profile: JevProfile,
  jev: JevClient,
  exempt: ReadonlySet<string> = new Set(),
): Promise<PrefilterResult> {
  const gated = new Set<string>();

  if (isProfileEmpty(profile)) {
    console.log("  [jev] Interest profile is empty — skipping pre-filter.");
    return { data, gated };
  }

  if (jevDown) {
    console.log("  [jev] Disabled after earlier failures — skipping pre-filter.");
    return { data, gated };
  }

  const state = toJevState(profile);

  // 1. Gate whole sources.
  const candidates = collectCandidates(data, exempt);
  if (candidates.length > 0) {
    const verdicts = await invoke("gate", () => jev.gateSources(candidates, state));
    jevStats.sourcesGated += candidates.length;
    for (const verdict of verdicts ?? []) {
      // `noul` carries no confidence, so the threshold is the whole guard. A
      // missing verdict (failed call) skips nothing.
      if (verdict.worth < profile.gateThreshold) gated.add(verdict.id);
    }
    jevStats.sourcesSkipped += gated.size;
    if (gated.size > 0) {
      console.log(`  [jev] Gate skipped ${gated.size} source(s): ${[...gated].join(", ")}`);
    }

    // Mark the saver-owned sources so their report bodies become the skip note.
    if (gated.has("web")) {
      for (const result of data.webResults) result.gatedOff = true;
    }
    if (gated.has("hn")) data.hnData.gatedOff = true;
    if (gated.has("ph")) data.phData.gatedOff = true;
    if (gated.has("arxiv")) data.arxivData.gatedOff = true;
    if (gated.has("hf")) data.hfData.gatedOff = true;
    if (gated.has("community")) {
      data.devtoData.gatedOff = true;
      data.lobstersData.gatedOff = true;
    }
  }

  // 2. Score the survivors' shortlists.
  const targets = collectItemTargets(data, gated, profile);
  const scores = await scoreTargets(targets, state, jev);
  applyScores(targets, scores, profile);

  return { data, gated };
}
