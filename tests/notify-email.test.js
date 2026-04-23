import test from "node:test";
import assert from "node:assert/strict";

import { resolveEmailRecipients } from "../scripts/notify-email.js";

test("resolveEmailRecipients prefers daily and weekly recipient groups when configured", () => {
  process.env.EMAIL_RECIPIENTS_DAILY = "daily@example.com";
  process.env.EMAIL_RECIPIENTS_WEEKLY = "weekly@example.com";
  process.env.EMAIL_RECIPIENTS = "fallback@example.com";

  assert.equal(resolveEmailRecipients("daily"), "daily@example.com");
  assert.equal(resolveEmailRecipients("weekly"), "weekly@example.com");
});

test("resolveEmailRecipients falls back to shared recipients", () => {
  delete process.env.EMAIL_RECIPIENTS_DAILY;
  delete process.env.EMAIL_RECIPIENTS_WEEKLY;
  process.env.EMAIL_RECIPIENTS = "fallback@example.com";

  assert.equal(resolveEmailRecipients("daily"), "fallback@example.com");
  assert.equal(resolveEmailRecipients("weekly"), "fallback@example.com");
});
