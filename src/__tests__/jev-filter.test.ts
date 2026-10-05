import { describe, it, expect, beforeEach, vi } from "vitest";
import { jevStats, prefilterBundle, resetJevStats, type FetchedData } from "../jev/filter.ts";
import { DEFAULT_PROFILE, type JevProfile } from "../jev/profile.ts";
import type { JevClient, JevItem, JevScore } from "../jev/types.ts";
import type { RepoFetch } from "../github.ts";
import type { HnStory } from "../hn.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A profile with content, so the pre-filter actually runs. */
const PROFILE: JevProfile = { ...DEFAULT_PROFILE, topics: ["agents"] };

function makeData(overrides: Partial<FetchedData> = {}): FetchedData {
  return {
    fetched: [],
    skillsData: { prs: [], issues: [] },
    webResults: [],
    trendingData: { trendingRepos: [], searchRepos: [], trendingFetchSuccess: true },
    hnData: { stories: [], fetchSuccess: true },
    phData: { products: [], fetchSuccess: true },
    arxivData: { papers: [], fetchSuccess: true },
    hfData: { models: [], fetchSuccess: true },
    devtoData: { articles: [], fetchSuccess: true },
    lobstersData: { stories: [], fetchSuccess: true },
    ...overrides,
  };
}

function makeRepo(id: string, titles: string[]): RepoFetch {
  return {
    cfg: { id, repo: `org/${id}`, name: id },
    issues: titles.map((title, i) => ({
      number: i + 1,
      title,
      state: "open",
      user: { login: "someone" },
      labels: [],
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      comments: titles.length - i,
      html_url: `https://github.com/org/${id}/issues/${i + 1}`,
    })),
    prs: [],
    releases: [],
    discussions: [],
  };
}

function makeStories(count: number): HnStory[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    title: `story ${i}`,
    url: `https://example.com/${i}`,
    hnUrl: `https://news.ycombinator.com/item?id=${i}`,
    points: count - i,
    comments: 0,
    author: "someone",
    createdAt: "2026-10-01T00:00:00Z",
  }));
}

/** A client whose two methods are stubs, overridable per test. */
function stubJev(overrides: Partial<JevClient> = {}): JevClient {
  return {
    name: "stub",
    scoreItems: async (items: JevItem[]): Promise<JevScore[]> =>
      items.map((i) => ({ id: i.id, score: 0.9, confidence: 0.9 })),
    gateSources: async (sources) => sources.map((s) => ({ id: s.id, worth: 0.9 })),
    usage: () => ({ inputTokens: 0, outputTokens: 0 }),
    ...overrides,
  };
}

beforeEach(() => {
  resetJevStats();
});

// ---------------------------------------------------------------------------
// Explicit pass-through
// ---------------------------------------------------------------------------

describe("prefilterBundle pass-through", () => {
  it("makes no calls when the interest profile is empty", async () => {
    const scoreItems = vi.fn(async () => []);
    const data = makeData({ hnData: { stories: makeStories(3), fetchSuccess: true } });

    const result = await prefilterBundle(data, DEFAULT_PROFILE, stubJev({ scoreItems }));

    expect(scoreItems).not.toHaveBeenCalled();
    expect(jevStats.calls).toBe(0);
    expect(result.gated.size).toBe(0);
    expect(data.hnData.stories).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Item scoring
// ---------------------------------------------------------------------------

describe("item filtering", () => {
  it("drops only the low-scoring items and preserves order", async () => {
    const data = makeData({ hnData: { stories: makeStories(3), fetchSuccess: true } });
    const jev = stubJev({
      scoreItems: async (items) =>
        items.map((i) => ({
          id: i.id,
          score: i.id === "hn:1" ? 0.1 : 0.9,
          confidence: 0.9,
        })),
    });

    await prefilterBundle(data, PROFILE, jev);

    expect(data.hnData.stories.map((s) => s.id)).toEqual(["0", "2"]);
    expect(jevStats.itemsDropped).toBe(1);
  });

  it("keeps items unscored because the batch failed", async () => {
    const data = makeData({ hnData: { stories: makeStories(4), fetchSuccess: true } });
    const jev = stubJev({
      scoreItems: async () => {
        throw new Error("network down");
      },
    });

    await prefilterBundle(data, PROFILE, jev);

    expect(data.hnData.stories).toHaveLength(4);
    expect(jevStats.failed).toBe(1);
  });

  it("keeps a low score Jev was not confident about", async () => {
    const data = makeData({ hnData: { stories: makeStories(2), fetchSuccess: true } });
    const jev = stubJev({
      scoreItems: async (items) => items.map((i) => ({ id: i.id, score: 0.01, confidence: 0.05 })),
    });

    await prefilterBundle(data, PROFILE, jev);

    // minConfidence is 0.25, so a 0.05-confidence answer is ignored entirely.
    expect(data.hnData.stories).toHaveLength(2);
    expect(jevStats.itemsDropped).toBe(0);
  });

  it("restores the top few when every item scores below threshold", async () => {
    const data = makeData({ hnData: { stories: makeStories(8), fetchSuccess: true } });
    const jev = stubJev({
      scoreItems: async (items) => items.map((i) => ({ id: i.id, score: 0, confidence: 0.9 })),
    });

    await prefilterBundle(data, PROFILE, jev);

    // The shortlist is in the builder's own order, so its head is the best
    // available — the report must never be empty.
    expect(data.hnData.stories).toHaveLength(5);
    expect(data.hnData.stories.map((s) => s.id)).toEqual(["0", "1", "2", "3", "4"]);
  });

  it("never scores a gated source's items", async () => {
    const data = makeData({ hnData: { stories: makeStories(3), fetchSuccess: true } });
    const scored: string[] = [];
    const jev = stubJev({
      gateSources: async (sources) => sources.map((s) => ({ id: s.id, worth: 0.01 })),
      scoreItems: async (items) => {
        for (const i of items) scored.push(i.id);
        return items.map((i) => ({ id: i.id, score: 0.9 }));
      },
    });

    await prefilterBundle(data, PROFILE, jev);

    expect(scored).toEqual([]);
    expect(data.hnData.gatedOff).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Source gate
// ---------------------------------------------------------------------------

describe("source gate", () => {
  it("skips sources below the gate threshold and marks their containers", async () => {
    const data = makeData({ hnData: { stories: makeStories(3), fetchSuccess: true } });
    const jev = stubJev({
      gateSources: async (sources) => sources.map((s) => ({ id: s.id, worth: 0.2 })),
    });

    const { gated } = await prefilterBundle(data, PROFILE, jev);

    expect(gated.has("hn")).toBe(true);
    expect(data.hnData.gatedOff).toBe(true);
    expect(jevStats.sourcesSkipped).toBe(1);
  });

  it("keeps sources at or above the threshold", async () => {
    const data = makeData({ hnData: { stories: makeStories(3), fetchSuccess: true } });
    const jev = stubJev({
      gateSources: async (sources) => sources.map((s) => ({ id: s.id, worth: 0.9 })),
    });

    const { gated } = await prefilterBundle(data, PROFILE, jev);

    expect(gated.has("hn")).toBe(false);
    expect(data.hnData.gatedOff).toBeUndefined();
  });

  it("skips nothing when the gate call fails", async () => {
    const data = makeData({ hnData: { stories: makeStories(3), fetchSuccess: true } });
    const jev = stubJev({
      gateSources: async () => {
        throw new Error("boom");
      },
    });

    const { gated } = await prefilterBundle(data, PROFILE, jev);

    expect(gated.size).toBe(0);
    // And the items still got scored and kept.
    expect(data.hnData.stories).toHaveLength(3);
  });

  it("does not even ask about a source with no items", async () => {
    // An empty source already short-circuits to "no activity" without an LLM
    // call, so gating it saves nothing and would only swap that accurate
    // message for a vaguer one. This also covers a failed fetch.
    const data = makeData({
      fetched: [makeRepo("quiet", [])],
      hnData: { stories: makeStories(2), fetchSuccess: true },
    });
    const asked: string[] = [];
    const jev = stubJev({
      gateSources: async (sources) => {
        for (const s of sources) asked.push(s.id);
        return sources.map((s) => ({ id: s.id, worth: 0.9 }));
      },
    });

    const { gated } = await prefilterBundle(data, PROFILE, jev);

    expect(asked).toEqual(["hn"]);
    expect(gated.has("quiet")).toBe(false);
  });

  it("never gates an exempt source", async () => {
    const data = makeData({ fetched: [makeRepo("openclaw", ["a big release"])] });
    const asked: string[] = [];
    const jev = stubJev({
      gateSources: async (sources) => {
        for (const s of sources) asked.push(s.id);
        return sources.map((s) => ({ id: s.id, worth: 0.01 }));
      },
    });

    const { gated } = await prefilterBundle(data, PROFILE, jev, new Set(["openclaw"]));

    expect(asked).not.toContain("openclaw");
    expect(gated.has("openclaw")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------

describe("batching", () => {
  it("bundles items into calls of at most 60 questions", async () => {
    const data = makeData({ hnData: { stories: makeStories(130), fetchSuccess: true } });
    const sizes: number[] = [];
    const jev = stubJev({
      scoreItems: async (items) => {
        sizes.push(items.length);
        return items.map((i) => ({ id: i.id, score: 0.9 }));
      },
    });

    await prefilterBundle(data, PROFILE, jev);

    expect(sizes).toEqual([60, 60, 10]);
    // 3 scoring calls, plus the single bundled gate call.
    expect(jevStats.calls).toBe(4);
  });

  it("keeps question ids unique across sources", async () => {
    const data = makeData({
      fetched: [makeRepo("alpha", ["one", "two"])],
      hnData: { stories: makeStories(2), fetchSuccess: true },
    });
    const seen: string[] = [];
    const jev = stubJev({
      scoreItems: async (items) => {
        for (const i of items) seen.push(i.id);
        return items.map((i) => ({ id: i.id, score: 0.9 }));
      },
    });

    await prefilterBundle(data, PROFILE, jev);

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toContain("github:alpha:issue:1");
    expect(seen).toContain("hn:0");
  });
});

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

describe("circuit breaker", () => {
  it("disables Jev for the rest of the run after broad failure", async () => {
    const jev = stubJev({
      scoreItems: async () => {
        throw new Error("provider down");
      },
    });

    // Three failing batches trip the breaker (JEV_MIN_SAMPLES = 3).
    const first = makeData({ hnData: { stories: makeStories(130), fetchSuccess: true } });
    await prefilterBundle(first, PROFILE, jev);
    expect(jevStats.failed).toBe(3);

    const callsBefore = jevStats.calls;
    const second = makeData({ hnData: { stories: makeStories(5), fetchSuccess: true } });
    await prefilterBundle(second, PROFILE, jev);

    // No further calls, and the data is untouched.
    expect(jevStats.calls).toBe(callsBefore);
    expect(second.hnData.stories).toHaveLength(5);
  });
});
