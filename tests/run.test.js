import test from "node:test";
import assert from "node:assert/strict";

test("daily backfill should not include hallucinated summary when no news items are matched", async () => {
  const { generateSummary } = await import("../scripts/generate-summary.js");

  const summary = await generateSummary([
    { category: "AI / LLM", items: [] },
    { category: "知乎日报", items: [] },
  ], "2026-04-22T09:00:00.000Z", 1, {
    reportDate: "2026-04-11",
    isHistorical: true,
  });

  assert.equal(summary, null);
});
