import { config } from "dotenv";
config();

import { getDailyBackfillDates } from "./report-utils.js";
import { run } from "./run.js";

function parseArgs(argv) {
  const options = {};
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--from") options.from = argv[index + 1];
    if (arg === "--to") options.to = argv[index + 1];
    if (arg === "--slot") options.slot = argv[index + 1];
  }
  return options;
}

const options = parseArgs(process.argv);
if (!options.from || !options.to) {
  console.error("用法: node scripts/backfill-daily.js --from 2026-04-01 --to 2026-04-22 [--slot morning|evening]");
  process.exit(1);
}

const slot = options.slot || "evening";
if (!["morning", "evening"].includes(slot)) {
  console.error("slot 只支持 morning 或 evening");
  process.exit(1);
}

const dates = getDailyBackfillDates(options.from, options.to);
console.log(`开始回填 ${dates.length} 天日报，时间段: ${options.from} ~ ${options.to}，slot=${slot}`);
console.log("注意：回填依赖 RSS 当前仍可获取到的历史条目，因此结果是近似历史重建，不保证与当日真实快照完全一致。\n");

for (const date of dates) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📅 回填 ${date} ${slot === "morning" ? "上午" : "晚上"} 日报`);
  console.log(`${"=".repeat(60)}`);
  await run({
    targetDate: date,
    timeSlot: slot,
    filterByDate: true,
  });
}

console.log(`\n✅ 回填完成，共生成 ${dates.length} 份日报`);
