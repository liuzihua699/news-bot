import test from "node:test";
import assert from "node:assert/strict";

import { buildDailySummaryPrompt } from "../scripts/generate-summary.js";

test("buildDailySummaryPrompt uses reportDate instead of current timestamp date for backfill", () => {
  const newsData = [
    {
      category: "AI / LLM",
      items: [
        {
          title: "Test headline",
          source: "OpenAI Blog",
          link: "https://example.com/test",
          snippet: "This is a sufficiently long English snippet used to verify the generated prompt content for historical backfill.",
          fullContent: "",
          contentType: "rss-snippet",
        },
      ],
    },
  ];

  const { prompt } = buildDailySummaryPrompt(newsData, "2026-04-22T10:00:00.000Z", {
    reportDate: "2026-04-01",
    isHistorical: true,
  });

  assert.match(prompt, /报告目标日期：2026-04-01/);
  assert.match(prompt, /以下是 2026-04-01 收集的科研与技术热点新闻/);
  assert.match(prompt, /历史回刷日报/);
  assert.doesNotMatch(prompt, /以下是今日（2026\/4\/22/);
});

test("buildDailySummaryPrompt forbids report-style preambles in summary output", () => {
  const newsData = [
    {
      category: "AI / LLM",
      items: [
        {
          title: "Test headline",
          source: "OpenAI Blog",
          link: "https://example.com/test",
          snippet: "This is a sufficiently long English snippet used to verify prompt constraints for summary formatting.",
          fullContent: "",
          contentType: "rss-snippet",
        },
      ],
    },
  ];

  const { prompt } = buildDailySummaryPrompt(newsData, "2026-04-23T00:30:00.000Z", {
    reportDate: "2026-04-23",
  });

  assert.match(prompt, /只输出“总结正文”/);
  assert.match(prompt, /不要输出“报告日期”“分析时间”“生成时间”“UTC”/);
  assert.match(prompt, /不要写落款、免责声明/);
});
