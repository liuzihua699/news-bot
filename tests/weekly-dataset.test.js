import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildWeeklyDataset } from "../scripts/weekly-dataset.js";

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "news-bot-weekly-"));
}

test("buildWeeklyDataset merges duplicate links across daily archives", async () => {
  const root = createTempDir();
  const dailyDataDir = path.join(root, "daily-data");
  fs.mkdirSync(dailyDataDir, { recursive: true });

  const firstDay = {
    reportType: "daily",
    date: "2026-04-14",
    timeSlot: "morning",
    summary: "day one",
    generatedAt: "2026-04-14T01:00:00.000Z",
    categories: [
      {
        category: "AI / LLM",
        items: [
          {
            title: "Shared headline",
            link: "https://example.com/shared",
            source: "OpenAI Blog",
            sourceType: "blog",
            snippet: "same news appears twice",
            fullContent: "",
            contentType: "rss-snippet",
          },
        ],
      },
    ],
  };

  const secondDay = {
    reportType: "daily",
    date: "2026-04-15",
    timeSlot: "evening",
    summary: "day two",
    generatedAt: "2026-04-15T09:00:00.000Z",
    categories: [
      {
        category: "AI / LLM",
        items: [
          {
            title: "Shared headline",
            link: "https://example.com/shared",
            source: "OpenAI Blog",
            sourceType: "blog",
            snippet: "same news appears twice again",
            fullContent: "",
            contentType: "rss-snippet",
          },
          {
            title: "Unique headline",
            link: "https://example.com/unique",
            source: "GitHub Blog",
            sourceType: "blog",
            snippet: "another item",
            fullContent: "",
            contentType: "rss-snippet",
          },
        ],
      },
    ],
  };

  fs.writeFileSync(path.join(dailyDataDir, "2026-04-14-morning.json"), JSON.stringify(firstDay), "utf8");
  fs.writeFileSync(path.join(dailyDataDir, "2026-04-15-evening.json"), JSON.stringify(secondDay), "utf8");

  const dataset = await buildWeeklyDataset({
    weekStart: "2026-04-14",
    weekEnd: "2026-04-20",
    dailyDataDir,
    dailyDir: path.join(root, "daily"),
  });

  assert.equal(dataset.meta.weekStart, "2026-04-14");
  assert.equal(dataset.meta.weekEnd, "2026-04-20");
  assert.equal(dataset.meta.sampleDays, 2);
  assert.equal(dataset.meta.totalItems, 3);
  assert.equal(dataset.duplicatesMerged, 1);
  assert.equal(dataset.highlights.length, 2);
  assert.equal(dataset.highlights[0].title, "Shared headline");
  assert.equal(dataset.highlights[0].occurrences, 2);
  assert.equal(dataset.highlights[0].dates.join(","), "2026-04-14,2026-04-15");
  assert.equal(dataset.categoryBuckets[0].category, "AI / LLM");
  assert.equal(dataset.categoryBuckets[0].items.length, 2);
  assert.equal(dataset.sourceStats[0].source, "OpenAI Blog");
  assert.equal(dataset.sourceStats[0].count, 2);
});

test("buildWeeklyDataset keeps up to eight recommendations per category", async () => {
  const root = createTempDir();
  const dailyDataDir = path.join(root, "daily-data");
  fs.mkdirSync(dailyDataDir, { recursive: true });

  const items = Array.from({ length: 10 }, (_, index) => ({
    title: `Headline ${index + 1}`,
    link: `https://example.com/${index + 1}`,
    source: `Source ${index + 1}`,
    sourceType: "blog",
    snippet: `summary ${index + 1}`,
    fullContent: "",
    contentType: "rss-snippet",
  }));

  const report = {
    reportType: "daily",
    date: "2026-04-18",
    timeSlot: "evening",
    generatedAt: "2026-04-18T09:00:00.000Z",
    categories: [
      {
        category: "AI / LLM",
        items,
      },
    ],
  };

  fs.writeFileSync(path.join(dailyDataDir, "2026-04-18-evening.json"), JSON.stringify(report), "utf8");

  const dataset = await buildWeeklyDataset({
    weekStart: "2026-04-18",
    weekEnd: "2026-04-24",
    dailyDataDir,
    dailyDir: path.join(root, "daily"),
  });

  assert.equal(dataset.categoryBuckets[0].items.length, 8);
  assert.equal(dataset.categoryBuckets[0].items.some((item) => item.title === "Headline 1"), true);
  assert.equal(dataset.categoryBuckets[0].items.some((item) => item.title === "Headline 8"), true);
  assert.equal(dataset.categoryBuckets[0].items.some((item) => item.title === "Headline 9"), false);
});
