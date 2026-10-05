/**
 * TypeSafe "Jev" client — the real System One backend.
 *
 * Two different primitives, chosen per task:
 *
 *   - `score` for items. Rating an item against a rubric is exactly what the
 *     primitive is for, and — unlike `noul` — `ScoreResponse` carries a
 *     `confidence`, which is what lets the pipeline refuse to drop an item on
 *     a shaky answer (see the drop rule in filter.ts).
 *   - `noul` for the source gate. "Is today's data worth a report?" is a plain
 *     yes/no, and the returned probability in [0,1] is directly thresholdable.
 *     `NoulResponse` has *no* confidence field, so the gate must not depend on
 *     one — the threshold is the whole guard.
 *
 * The SDK is imported lazily so the mock path never loads it, and `state` is
 * rendered by `renderState` alone — the one place to touch if TypeSafe ever
 * pins down a stricter shape for that field.
 */

import type { NoulQuestion, Questions, ScoreQuestion } from "@typesafe-ai/sdk";
import type { JevClient, JevGateVerdict, JevItem, JevScore, JevSourceDigest, JevState } from "./types.ts";

/** A batch of questions, keyed by item or source id. */
type QuestionBatch = Record<string, ScoreQuestion | NoulQuestion>;

/** `jev-latest` rather than a pinned version, matching the docs' examples. */
const MODEL = "jev-latest";

/**
 * Per-attempt HTTP timeout. The SDK retries internally, so the outer
 * `Promise.race` in filter.ts is the real bound on total wall-clock.
 */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Relevance rubric for item scoring. Five levels, normalized to [0,1] by
 * dividing by the top index. Kept short and evenly spaced: the expected score
 * is only as meaningful as the gaps between the descriptions.
 */
const ITEM_RUBRIC = [
  "irrelevant to the user's stated interests",
  "marginally related, unlikely to interest them",
  "somewhat relevant, might be worth a glance",
  "clearly relevant to their stated interests",
  "directly about something they follow closely",
] as const;

const ITEM_RUBRIC_TOP = ITEM_RUBRIC.length - 1;

/**
 * Serialize the profile into the request `state`.
 *
 * Exported so a test can pin the wire format without reaching into the SDK.
 */
export function renderState(state: JevState): string {
  const lines: string[] = [];
  if (state.topics.length) lines.push(`Topics of interest: ${state.topics.join(", ")}`);
  if (state.trackedProjects.length) {
    lines.push(`Projects followed closely: ${state.trackedProjects.join(", ")}`);
  }
  if (state.positiveKeywords.length) {
    lines.push(`Signals that increase relevance: ${state.positiveKeywords.join(", ")}`);
  }
  if (state.negativeKeywords.length) {
    lines.push(`Signals that decrease relevance: ${state.negativeKeywords.join(", ")}`);
  }
  return lines.join("\n");
}

type Sdk = typeof import("@typesafe-ai/sdk");

let sdkPromise: Promise<Sdk> | undefined;

/** Load the SDK once per process. */
function loadSdk(): Promise<Sdk> {
  sdkPromise ??= import("@typesafe-ai/sdk");
  return sdkPromise;
}

/** Build the client once; the SDK reads TYPESAFE_API_KEY from the environment. */
function createClient(Sdk: Sdk): InstanceType<Sdk["TypeSafeClient"]> {
  return new Sdk.TypeSafeClient({ timeout: REQUEST_TIMEOUT_MS });
}

export function createRealJev(): JevClient {
  const usage = { inputTokens: 0, outputTokens: 0 };

  /**
   * One `systemOne` call for a whole batch of questions. The docs are explicit
   * that questions in a call are evaluated in parallel and in isolation, so
   * bundling costs far less than one call per question.
   */
  async function call(questions: QuestionBatch, state: JevState) {
    const Sdk = await loadSdk();
    const result = await createClient(Sdk).systemOne({
      state: renderState(state),
      model: MODEL,
      // Ours is a plain string-keyed map built from item ids; the SDK's
      // `Questions` is the same shape, but its per-key answer types are
      // inferred from the question literal, which a runtime-built map cannot
      // provide. The answers are read back by key below either way.
      questions: questions as Questions,
    });
    usage.inputTokens += result.usage.input_tokens;
    usage.outputTokens += result.usage.output_tokens;
    return result.answers as Record<string, { score?: number; noul?: number }>;
  }

  return {
    name: "typesafe",

    async scoreItems(items: JevItem[], state: JevState): Promise<JevScore[]> {
      if (items.length === 0) return [];
      const { score: scoreQuestion } = await loadSdk();

      const questions: QuestionBatch = {};
      for (const item of items) {
        // Each question is a single well-scoped gut-check, so the item text
        // rides in the question and the profile in the shared state.
        questions[item.id] = scoreQuestion(item.label, ITEM_RUBRIC);
      }

      const answers = await call(questions, state);
      const scores: JevScore[] = [];
      for (const item of items) {
        const answer = answers[item.id];
        if (answer?.score === undefined) continue;
        scores.push({
          id: item.id,
          score: Math.min(1, Math.max(0, answer.score / ITEM_RUBRIC_TOP)),
          confidence: (answer as { confidence?: number }).confidence,
        });
      }
      return scores;
    },

    async gateSources(sources: JevSourceDigest[], state: JevState): Promise<JevGateVerdict[]> {
      if (sources.length === 0) return [];
      const { noul } = await loadSdk();

      const questions: QuestionBatch = {};
      for (const source of sources) {
        questions[source.id] = noul(
          `Given the user's interest profile, is today's data for ${source.name} ` +
            `(${source.id}) worth generating a full daily report?\n\n` +
            `Today's data:\n${source.digest}`,
          {
            true: "worth generating a report",
            false: "not worth generating a report",
          },
        );
      }

      const answers = await call(questions, state);
      const verdicts: JevGateVerdict[] = [];
      for (const source of sources) {
        const answer = answers[source.id];
        if (answer?.noul === undefined) continue;
        verdicts.push({ id: source.id, worth: Math.min(1, Math.max(0, answer.noul)) });
      }
      return verdicts;
    },

    usage() {
      return { ...usage };
    },
  };
}
