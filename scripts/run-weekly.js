import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import { generateMarkdown } from "./generate-md.js";
import { generateWeeklySummary } from "./generate-weekly-summary.js";
import { buildWeeklyDataset } from "./weekly-dataset.js";
import { buildWeeklyFilename, getWeeklyDigestRange, REPORT_TYPES } from "./report-utils.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export async function runWeeklyReport(options = {}) {
  const now = dayjs().tz("Asia/Shanghai");
  const range = options.weekStart && options.weekEnd
    ? { weekStart: options.weekStart, weekEnd: options.weekEnd }
    : getWeeklyDigestRange(now);
  const timestamp = new Date().toISOString();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🗞️  科研 & 技术热点周报 - ${range.weekStart} ~ ${range.weekEnd}`);
  console.log(`⏰ 开始时间: ${now.format("YYYY-MM-DD HH:mm:ss")} (UTC+8)`);
  console.log(`${"=".repeat(60)}\n`);

  const dataset = await buildWeeklyDataset(range);
  const summary = await generateWeeklySummary(dataset, timestamp, 5);

  const md = generateMarkdown(REPORT_TYPES.WEEKLY, {
    ...dataset.meta,
    generatedAt: timestamp,
  }, dataset, summary);

  const weeklyDir = path.join(process.cwd(), "weekly");
  if (!fs.existsSync(weeklyDir)) fs.mkdirSync(weeklyDir, { recursive: true });

  const filename = buildWeeklyFilename(range.weekStart, range.weekEnd);
  const filePath = path.join(weeklyDir, filename);
  fs.writeFileSync(filePath, md, "utf8");

  console.log(`✅ 周报生成完成: ${filePath}`);

  return {
    reportType: REPORT_TYPES.WEEKLY,
    filePath,
    filename,
    weekStart: range.weekStart,
    weekEnd: range.weekEnd,
    label: `${range.weekStart} ~ ${range.weekEnd}`,
    dataset,
  };
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isDirectRun) {
  runWeeklyReport().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
