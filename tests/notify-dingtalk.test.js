import test from "node:test";
import assert from "node:assert/strict";

import { buildDingTalkMarkdown } from "../scripts/notify-dingtalk.js";

test("buildDingTalkMarkdown uses concise weekly title and separate period line", () => {
  const { title, text } = buildDingTalkMarkdown({
    reportType: "weekly",
    effectiveLabel: "2026-04-11 ~ 2026-04-17",
    previewLink: "https://example.com/weekly/2026-04-11_to_2026-04-17",
    brief: "本周总览\n重点趋势",
  });

  assert.equal(title, "📰 科研 & 技术热点周报");
  assert.match(text, /🗓️ 周期：2026-04-11 ~ 2026-04-17/);
  assert.doesNotMatch(text, /### 📰 科研 & 技术热点周报 · 2026-04-11 ~ 2026-04-17/);
  assert.match(text, /点击查看完整周报/);
});
