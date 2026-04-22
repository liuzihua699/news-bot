import { config } from "dotenv";
config();

import fs from "fs";
import path from "path";

import { sendEmail } from "./notify-email.js";
import { sendDingTalk } from "./notify-dingtalk.js";
import { REPORT_TYPES, getReportDirectory, parseReportFile } from "./report-utils.js";

export function parseNotifyArgs(argv) {
  const options = {};

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--type") options.type = argv[index + 1];
    if (arg === "--slug") options.slug = argv[index + 1];
    if (arg === "--file") options.file = argv[index + 1];
    if (arg === "--channel") options.channel = argv[index + 1];
  }

  return options;
}

function getLatestFile(reportType) {
  const dir = path.join(process.cwd(), getReportDirectory(reportType));
  if (!fs.existsSync(dir)) {
    throw new Error(`Report directory not found: ${dir}`);
  }

  const files = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".md") && !name.startsWith("."))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error(`No ${reportType} report files found in ${dir}`);
  }

  return path.join(dir, files[0]);
}

function resolveReportFromOptions(options) {
  const reportType = options.type || REPORT_TYPES.DAILY;

  let filePath;
  if (options.file) {
    filePath = path.isAbsolute(options.file)
      ? options.file
      : path.join(process.cwd(), options.file);
  } else if (options.slug) {
    filePath = path.join(process.cwd(), getReportDirectory(reportType), `${options.slug}.md`);
  } else {
    filePath = getLatestFile(reportType);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Report file not found: ${filePath}`);
  }

  const filename = path.basename(filePath);
  const parsed = parseReportFile(reportType, filename);
  const label = parsed?.label || filename.replace(/\.md$/, "");

  return {
    reportType,
    filePath,
    filename,
    label,
  };
}

async function notifyReport(options) {
  const report = resolveReportFromOptions(options);
  const channel = options.channel || "all";
  const status = { email: false, dingtalk: false };

  if (!["all", "email", "dingtalk"].includes(channel)) {
    throw new Error("channel 只支持 all、email、dingtalk");
  }

  console.log(`\n${"#".repeat(60)}`);
  console.log(`#  单独发送报告通知`);
  console.log(`${"#".repeat(60)}`);
  console.log(`   类型: ${report.reportType}`);
  console.log(`   文件: ${report.filePath}`);
  console.log(`   标签: ${report.label}\n`);

  if (channel === "all" || channel === "email") {
    status.email = await sendEmail({
      filePath: report.filePath,
      reportType: report.reportType,
      label: report.label,
    });
  }

  if (channel === "all" || channel === "dingtalk") {
    status.dingtalk = await sendDingTalk({
      filePath: report.filePath,
      reportType: report.reportType,
      label: report.label,
      filename: report.filename,
    });
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📋 发送汇总:`);
  console.log(`   邮件: ${status.email ? "✅" : (channel === "dingtalk" ? "⏭️  未执行" : "⏭️  跳过/失败")}`);
  console.log(`   钉钉: ${status.dingtalk ? "✅" : (channel === "email" ? "⏭️  未执行" : "⏭️  跳过/失败")}`);
  console.log(`${"=".repeat(60)}\n`);
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isDirectRun) {
  const options = parseNotifyArgs(process.argv);
  notifyReport(options).catch((error) => {
    console.error(`❌ 发送通知失败: ${error.message}`);
    process.exit(1);
  });
}

