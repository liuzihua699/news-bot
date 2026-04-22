import test from "node:test";
import assert from "node:assert/strict";

import { generateMarkdown } from "../scripts/generate-md.js";

test("generateMarkdown renders weekly reports with summary and selected items", () => {
  const md = generateMarkdown("weekly", {
    weekStart: "2026-04-14",
    weekEnd: "2026-04-20",
    generatedAt: "2026-04-21T01:00:00.000Z",
  }, {
    categoryBuckets: [
      {
        category: "AI / LLM",
        items: [
          {
            title: "Weekly headline",
            source: "OpenAI Blog",
            sourceType: "blog",
            link: "https://example.com/item",
            summary: "important summary",
            occurrences: 2,
          },
        ],
      },
    ],
  }, "本周技术主线集中在模型产品化与工程落地。");

  assert.match(md, /# 🧠 科研 & 技术热点周报/);
  assert.match(md, /周期：2026-04-14 ~ 2026-04-20/);
  assert.match(md, /## 📝 本周总结/);
  assert.match(md, /## 🔥 AI \/ LLM/);
  assert.match(md, /出现次数：2/);
  assert.match(md, /链接：https:\/\/example\.com\/item/);
});

test("generateMarkdown renders all weekly category recommendations provided", () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    title: `Weekly headline ${index + 1}`,
    source: "OpenAI Blog",
    sourceType: "blog",
    link: `https://example.com/item-${index + 1}`,
    summary: `important summary ${index + 1}`,
    occurrences: 1,
  }));

  const md = generateMarkdown("weekly", {
    weekStart: "2026-04-18",
    weekEnd: "2026-04-24",
    generatedAt: "2026-04-25T01:00:00.000Z",
  }, {
    categoryBuckets: [
      {
        category: "AI / LLM",
        items,
      },
    ],
  }, "summary");

  assert.match(md, /Weekly headline 8/);
  assert.equal((md.match(/\*\*Weekly headline/g) || []).length, 8);
});
