import { describe, it, expect, afterEach } from "vitest";
import { createJev } from "../jev/client.ts";
import { createMockJev } from "../jev/mock.ts";
import { DEFAULT_PROFILE, isProfileEmpty, toJevState, type JevProfile } from "../jev/profile.ts";
import { renderState } from "../jev/real.ts";
import { toProfile } from "../config.ts";
import type { JevState } from "../jev/types.ts";

// ---------------------------------------------------------------------------
// Env handling — createJev reads TYPESAFE_API_KEY and JEV_ENABLED
// ---------------------------------------------------------------------------

const ORIGINAL_KEY = process.env["TYPESAFE_API_KEY"];
const ORIGINAL_ENABLED = process.env["JEV_ENABLED"];

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env["TYPESAFE_API_KEY"];
  else process.env["TYPESAFE_API_KEY"] = ORIGINAL_KEY;
  if (ORIGINAL_ENABLED === undefined) delete process.env["JEV_ENABLED"];
  else process.env["JEV_ENABLED"] = ORIGINAL_ENABLED;
});

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

describe("createJev", () => {
  it("falls back to the mock without an API key", async () => {
    const client = await createJev(undefined);
    expect(client.name).toBe("mock");
  });

  it("uses the real client when a key is supplied", async () => {
    const client = await createJev("ts_test_key");
    expect(client.name).toBe("typesafe");
  });

  it("JEV_ENABLED=false forces the mock even with a key", async () => {
    process.env["JEV_ENABLED"] = "false";
    const client = await createJev("ts_test_key");
    expect(client.name).toBe("mock");
  });

  it("reads the key from the environment by default", async () => {
    process.env["TYPESAFE_API_KEY"] = "ts_from_env";
    const client = await createJev();
    expect(client.name).toBe("typesafe");
  });
});

// ---------------------------------------------------------------------------
// Mock — deterministic, and lenient enough to be safe without a key
// ---------------------------------------------------------------------------

describe("mock Jev client", () => {
  const state: JevState = {
    topics: ["agents"],
    positiveKeywords: ["release"],
    negativeKeywords: ["typo"],
    trackedProjects: ["openclaw/openclaw"],
  };

  it("is deterministic for the same input", async () => {
    const jev = createMockJev();
    const items = [{ id: "a", label: "Some release notes for agents" }];
    const first = await jev.scoreItems(items, state);
    const second = await jev.scoreItems(items, state);
    expect(first).toEqual(second);
  });

  it("scores a neutral item at the baseline", async () => {
    const jev = createMockJev();
    const [score] = await jev.scoreItems([{ id: "a", label: "unrelated chatter" }], state);
    expect(score!.score).toBeCloseTo(0.5);
  });

  it("raises the score for a tracked project and lowers it for a negative keyword", async () => {
    const jev = createMockJev();
    const [tracked, negative] = await jev.scoreItems(
      [
        { id: "a", label: "openclaw/openclaw ships a new release" },
        { id: "b", label: "typo fix in the readme" },
      ],
      state,
    );
    expect(tracked!.score).toBeGreaterThan(0.5);
    expect(negative!.score).toBeLessThan(0.5);
  });

  it("scores everything at the baseline when the profile is empty", async () => {
    const jev = createMockJev();
    const empty = toJevState(DEFAULT_PROFILE);
    const scores = await jev.scoreItems([{ id: "a", label: "openclaw/openclaw release" }], empty);
    expect(scores[0]!.score).toBeCloseTo(0.5);
  });

  it("never gates away a source that has items", async () => {
    const jev = createMockJev();
    const verdicts = await jev.gateSources(
      [
        { id: "hn", name: "Hacker News", digest: "", itemCount: 12 },
        { id: "ph", name: "Product Hunt", digest: "", itemCount: 0 },
      ],
      state,
    );
    expect(verdicts.find((v) => v.id === "hn")!.worth).toBeGreaterThanOrEqual(DEFAULT_PROFILE.gateThreshold);
    expect(verdicts.find((v) => v.id === "ph")!.worth).toBeLessThan(DEFAULT_PROFILE.gateThreshold);
  });
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

describe("profile", () => {
  it("treats the default profile as empty", () => {
    expect(isProfileEmpty(DEFAULT_PROFILE)).toBe(true);
  });

  it("is non-empty once any list has content", () => {
    const profile: JevProfile = { ...DEFAULT_PROFILE, topics: ["agents"] };
    expect(isProfileEmpty(profile)).toBe(false);
  });

  it("copies lists into the Jev state", () => {
    const state = toJevState({ ...DEFAULT_PROFILE, topics: ["a"], trackedProjects: ["b"] });
    expect(state).toEqual({
      topics: ["a"],
      positiveKeywords: [],
      negativeKeywords: [],
      trackedProjects: ["b"],
    });
  });

  it("renders every populated section into the wire state", () => {
    const rendered = renderState({
      topics: ["AI agents"],
      trackedProjects: ["openclaw/openclaw"],
      positiveKeywords: ["release"],
      negativeKeywords: ["typo"],
    });
    expect(rendered).toContain("AI agents");
    expect(rendered).toContain("openclaw/openclaw");
    expect(rendered).toContain("release");
    expect(rendered).toContain("typo");
  });

  it("renders an empty profile as an empty string", () => {
    expect(renderState({ topics: [], trackedProjects: [], positiveKeywords: [], negativeKeywords: [] })).toBe(
      "",
    );
  });
});

// ---------------------------------------------------------------------------
// toProfile — YAML shape to JevProfile
// ---------------------------------------------------------------------------

describe("toProfile", () => {
  it("parses every field from the YAML shape", () => {
    const profile = toProfile({
      topics: ["agents"],
      positive_keywords: ["release"],
      negative_keywords: ["typo"],
      tracked_projects: ["openclaw/openclaw"],
      item_threshold: 0.7,
      gate_threshold: 0.3,
      min_confidence: 0.4,
      max_items_per_source: 12,
    });
    expect(profile).toEqual({
      topics: ["agents"],
      positiveKeywords: ["release"],
      negativeKeywords: ["typo"],
      trackedProjects: ["openclaw/openclaw"],
      itemThreshold: 0.7,
      gateThreshold: 0.3,
      minConfidence: 0.4,
      maxItemsPerSource: 12,
    });
  });

  it("falls back to the defaults when the section is absent", () => {
    const profile = toProfile(undefined);
    expect(profile).toEqual(DEFAULT_PROFILE);
    expect(isProfileEmpty(profile)).toBe(true);
  });

  it("ignores non-string list entries and non-numeric thresholds", () => {
    const profile = toProfile({
      topics: ["keep", 42, "", "  "] as unknown as string[],
      item_threshold: "nope" as unknown as number,
    });
    expect(profile.topics).toEqual(["keep"]);
    expect(profile.itemThreshold).toBe(DEFAULT_PROFILE.itemThreshold);
  });
});
