import test from "node:test";
import assert from "node:assert/strict";

import { buildDingTalkMarkdown, resolveDingTalkConfig } from "../scripts/notify-dingtalk.js";

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

test("resolveDingTalkConfig uses report-specific webhook and secret when configured", () => {
  process.env.DINGTALK_WEBHOOK_DAILY = "https://daily.example";
  process.env.DINGTALK_SECRET_DAILY = "daily-secret";
  process.env.DINGTALK_WEBHOOK_WEEKLY = "https://weekly.example";
  process.env.DINGTALK_SECRET_WEEKLY = "weekly-secret";
  process.env.DINGTALK_WEBHOOK = "https://fallback.example";
  process.env.DINGTALK_SECRET = "fallback-secret";

  assert.deepEqual(resolveDingTalkConfig("daily"), {
    webhook: "https://daily.example",
    secret: "daily-secret",
  });
  assert.deepEqual(resolveDingTalkConfig("weekly"), {
    webhook: "https://weekly.example",
    secret: "weekly-secret",
  });
});

test("resolveDingTalkConfig falls back to shared webhook when report-specific config is absent", () => {
  delete process.env.DINGTALK_WEBHOOK_DAILY;
  delete process.env.DINGTALK_SECRET_DAILY;
  delete process.env.DINGTALK_WEBHOOK_WEEKLY;
  delete process.env.DINGTALK_SECRET_WEEKLY;
  process.env.DINGTALK_WEBHOOK = "https://fallback.example";
  process.env.DINGTALK_SECRET = "fallback-secret";

  assert.deepEqual(resolveDingTalkConfig("daily"), {
    webhook: "https://fallback.example",
    secret: "fallback-secret",
  });
  assert.deepEqual(resolveDingTalkConfig("weekly"), {
    webhook: "https://fallback.example",
    secret: "fallback-secret",
  });
});
