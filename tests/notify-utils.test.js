import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { extractBrief } from "../scripts/notify-utils.js";

function createTempMarkdown(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "news-bot-notify-"));
  const filePath = path.join(dir, "sample.md");
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

test("extractBrief keeps weekly summary body instead of stopping at the first horizontal rule", () => {
  const filePath = createTempMarkdown(`# 🧠 科研 & 技术热点周报

周期：2026-04-11 ~ 2026-04-17

## 📝 本周总结

# 科研与技术热点周报（2026.04.11 - 2026.04.17）

## 本周总览

2026年4月11日-4月17日，AI 与工程实践继续升温。

---

### 重点趋势

- 多智能体工具链开始进入工程化阶段
- 中文社区内容活跃度明显上升

---

## 📌 本周重点

- 条目一

---`);

  const brief = extractBrief(filePath, "weekly", 500);

  assert.doesNotMatch(brief, /^#/m);
  assert.doesNotMatch(brief, /科研与技术热点周报（2026.04.11 - 2026.04.17）/);
  assert.match(brief, /本周总览/);
  assert.match(brief, /重点趋势/);
  assert.match(brief, /多智能体工具链开始进入工程化阶段/);
  assert.doesNotMatch(brief, /本周重点/);
});

test("extractBrief allows longer weekly snippets by default", () => {
  const longText = "A".repeat(450);
  const filePath = createTempMarkdown(`# 🧠 科研 & 技术热点周报

## 📝 本周总结

${longText}

---

## 📌 本周重点

- 条目一
`);

  const brief = extractBrief(filePath, "weekly");
  assert.equal(brief.length, 450);
});
