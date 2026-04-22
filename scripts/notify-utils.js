import fs from "fs";

import { REPORT_TYPES, getSummaryHeading } from "./report-utils.js";

export function extractBrief(filePath, reportType = REPORT_TYPES.DAILY, maxLen = 200) {
  try {
    const md = fs.readFileSync(filePath, "utf-8");
    const summaryHeading = getSummaryHeading(reportType);
    const escapedHeading = summaryHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = md.match(new RegExp(`##\\s*📝?\\s*${escapedHeading}\\s*\\n\\n([\\s\\S]*?)(?=\\n##\\s|\\n---)`, "m"));
    if (!match) return "";

    let text = match[1]
      .replace(/^###?\s*.+$/gm, "")
      .replace(/\*\*/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n{2,}/g, "\n")
      .trim();

    if (text.length > maxLen) text = `${text.slice(0, maxLen)}...`;
    return text;
  } catch {
    return "";
  }
}
