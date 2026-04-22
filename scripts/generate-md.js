import {
  REPORT_TYPES,
  formatGeneratedAt,
  getReportTitle,
  getSourceTypeLabel,
  getSummaryHeading,
} from "./report-utils.js";

function truncate(text = "", maxLength = 500) {
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text.trim();
}

const WEEKLY_HIGHLIGHT_LIMIT = 8;

function renderDaily(meta, data, summary) {
  let md = `# 🧠 ${getReportTitle(REPORT_TYPES.DAILY)}\n\n日期：${meta.date}${meta.timeSlotLabel ? ` ${meta.timeSlotLabel}` : ""}\n`;

  if (meta.generatedAt) {
    md += `生成时间：${formatGeneratedAt(meta.generatedAt)}\n\n`;
  } else {
    md += "\n";
  }

  if (summary) {
    md += `## 📝 ${getSummaryHeading(REPORT_TYPES.DAILY)}\n\n${summary}\n\n---\n\n`;
  }

  for (const block of data) {
    if (!block.items?.length) continue;

    md += `## 🔥 ${block.category}\n\n`;
    for (const item of block.items.slice(0, 5)) {
      md += `- **${item.title}**  \n`;
      md += `  来源：${item.source} (${getSourceTypeLabel(item.sourceType)})  \n`;

      const content = item.fullContent || item.snippet;
      if (content && content.trim().length > 0) {
        const contentType = item.contentType === "fulltext" ? "全文" : "RSS摘要";
        md += `  摘要（${contentType}）：${truncate(content.replace(/\n/g, " "))}\n`;
      }

      md += `  链接：${item.link}\n\n`;
    }
  }

  md += "---\n_自动生成 · GitHub Actions_\n";
  return md;
}

function renderWeekly(meta, data, summary) {
  let md = `# 🧠 ${getReportTitle(REPORT_TYPES.WEEKLY)}\n\n`;
  md += `周期：${meta.weekStart} ~ ${meta.weekEnd}\n`;
  if (meta.generatedAt) {
    md += `生成时间：${formatGeneratedAt(meta.generatedAt)}\n`;
  }
  if (typeof meta.sampleDays === "number") {
    md += `样本天数：${meta.sampleDays} 天\n`;
  }
  md += "\n";

  if (summary) {
    md += `## 📝 ${getSummaryHeading(REPORT_TYPES.WEEKLY)}\n\n${summary}\n\n---\n\n`;
  }

  if (data.highlights?.length) {
    md += "## 📌 本周重点\n\n";
    for (const item of data.highlights.slice(0, WEEKLY_HIGHLIGHT_LIMIT)) {
      md += `- **${item.title}**（${item.source}）\n`;
      md += `  出现次数：${item.occurrences}\n`;
      md += `  时间分布：${item.dates.join("、")}\n`;
      if (item.summary) md += `  摘要：${truncate(item.summary.replace(/\n/g, " "))}\n`;
      md += `  链接：${item.link}\n\n`;
    }
    md += "---\n\n";
  }

  for (const block of data.categoryBuckets || []) {
    if (!block.items?.length) continue;
    md += `## 🔥 ${block.category}\n\n`;
    for (const item of block.items) {
      md += `- **${item.title}**  \n`;
      md += `  来源：${item.source} (${getSourceTypeLabel(item.sourceType)})  \n`;
      md += `  出现次数：${item.occurrences}  \n`;
      if (item.summary) md += `  摘要：${truncate(item.summary.replace(/\n/g, " "))}\n`;
      md += `  链接：${item.link}\n\n`;
    }
  }

  md += "---\n_自动生成 · GitHub Actions_\n";
  return md;
}

export function generateMarkdown(reportTypeOrDate, metaOrData, dataOrSummary = null, summaryOrTimestamp = null, timestamp = null, timeSlotLabel = "") {
  if (reportTypeOrDate === REPORT_TYPES.DAILY || reportTypeOrDate === REPORT_TYPES.WEEKLY) {
    const reportType = reportTypeOrDate;
    const meta = metaOrData || {};
    const data = dataOrSummary || {};
    const summary = summaryOrTimestamp;

    return reportType === REPORT_TYPES.WEEKLY
      ? renderWeekly(meta, data, summary)
      : renderDaily(meta, data, summary);
  }

  return renderDaily({
    date: reportTypeOrDate,
    generatedAt: timestamp,
    timeSlotLabel,
  }, metaOrData || [], dataOrSummary);
}
