import fs from "fs";

import { REPORT_TYPES, getSummaryHeading } from "./report-utils.js";

function getDefaultBriefLength(reportType) {
  return reportType === REPORT_TYPES.WEEKLY ? 500 : 200;
}

function stripDailySummaryPreamble(text) {
  return text
    .replace(/^科研与技术热点日报总结\s*\n?/m, "")
    .replace(/^\d{4}年\d{1,2}月\d{1,2}日\s*(?:科研与技术热点|科技热点)总结\s*\n?/m, "")
    .replace(/^报告日期[:：].*\n?/gm, "")
    .replace(/^分析时间[:：].*\n?/gm, "")
    .replace(/^生成时间[:：].*\n?/gm, "")
    .trim();
}

export function extractBrief(filePath, reportType = REPORT_TYPES.DAILY, maxLen = getDefaultBriefLength(reportType)) {
  try {
    const md = fs.readFileSync(filePath, "utf-8");
    const summaryHeading = getSummaryHeading(reportType);
    const escapedHeading = summaryHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = reportType === REPORT_TYPES.WEEKLY
      ? new RegExp(`##\\s*📝?\\s*${escapedHeading}\\s*\\n\\n([\\s\\S]*?)(?=\\n---\\n\\n##\\s)`, "m")
      : new RegExp(`##\\s*📝?\\s*${escapedHeading}\\s*\\n\\n([\\s\\S]*?)(?=\\n---\\n\\n##\\s)`, "m");
    const match = md.match(pattern);
    if (!match) return "";

    let text = match[1]
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/^\s*---+\s*$/gm, "")
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/\*\*/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n{2,}/g, "\n")
      .trim();

    if (reportType === REPORT_TYPES.WEEKLY) {
      text = text.replace(/^科研与技术热点周报（[^）]+）\s*\n?/, "").trim();
    } else {
      text = stripDailySummaryPreamble(text);
    }

    if (text.length > maxLen) text = `${text.slice(0, maxLen)}...`;
    return text;
  } catch {
    return "";
  }
}
