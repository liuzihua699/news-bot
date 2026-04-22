import test from "node:test";
import assert from "node:assert/strict";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import { getDailyBackfillDates, getWeeklyDigestRange, matchesTargetDate } from "../scripts/report-utils.js";

dayjs.extend(utc);
dayjs.extend(timezone);

test("getWeeklyDigestRange returns last Saturday to current-week Friday when run after Friday", () => {
  const reference = dayjs.tz("2026-04-25 10:00:00", "Asia/Shanghai");
  const range = getWeeklyDigestRange(reference);

  assert.deepEqual(range, {
    weekStart: "2026-04-18",
    weekEnd: "2026-04-24",
  });
});

test("getWeeklyDigestRange falls back to most recent Friday when run before Friday", () => {
  const reference = dayjs.tz("2026-04-23 10:00:00", "Asia/Shanghai");
  const range = getWeeklyDigestRange(reference);

  assert.deepEqual(range, {
    weekStart: "2026-04-11",
    weekEnd: "2026-04-17",
  });
});

test("matchesTargetDate matches isoDate in Asia/Shanghai calendar day", () => {
  const item = { isoDate: "2026-04-01T17:30:00.000Z" };
  assert.equal(matchesTargetDate(item, "2026-04-02"), true);
  assert.equal(matchesTargetDate(item, "2026-04-01"), false);
});

test("getDailyBackfillDates expands inclusive date ranges", () => {
  assert.deepEqual(
    getDailyBackfillDates("2026-04-01", "2026-04-03"),
    ["2026-04-01", "2026-04-02", "2026-04-03"],
  );
});
