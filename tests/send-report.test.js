import test from "node:test";
import assert from "node:assert/strict";

import { parseNotifyArgs } from "../scripts/send-report.js";

test("parseNotifyArgs supports type slug and channel options", () => {
  const options = parseNotifyArgs([
    "node",
    "scripts/send-report.js",
    "--type",
    "weekly",
    "--slug",
    "2026-04-18_to_2026-04-24",
    "--channel",
    "email",
  ]);

  assert.deepEqual(options, {
    type: "weekly",
    slug: "2026-04-18_to_2026-04-24",
    channel: "email",
  });
});

test("parseNotifyArgs supports explicit file path", () => {
  const options = parseNotifyArgs([
    "node",
    "scripts/send-report.js",
    "--file",
    "weekly/2026-04-18_to_2026-04-24.md",
  ]);

  assert.deepEqual(options, {
    file: "weekly/2026-04-18_to_2026-04-24.md",
  });
});
