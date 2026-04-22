import dayjs from "dayjs";

export const REPORT_TYPES = {
  DAILY: "daily",
  WEEKLY: "weekly",
};

const REPORT_CONFIG = {
  [REPORT_TYPES.DAILY]: {
    title: "科研 & 技术热点日报",
    summaryHeading: "今日总结",
    outputDir: "daily",
    icon: "🧠",
  },
  [REPORT_TYPES.WEEKLY]: {
    title: "科研 & 技术热点周报",
    summaryHeading: "本周总结",
    outputDir: "weekly",
    icon: "🧠",
  },
};

export function getReportConfig(reportType = REPORT_TYPES.DAILY) {
  return REPORT_CONFIG[reportType] || REPORT_CONFIG[REPORT_TYPES.DAILY];
}

export function getReportDirectory(reportType = REPORT_TYPES.DAILY) {
  return getReportConfig(reportType).outputDir;
}

export function getReportTitle(reportType = REPORT_TYPES.DAILY) {
  return getReportConfig(reportType).title;
}

export function getSummaryHeading(reportType = REPORT_TYPES.DAILY) {
  return getReportConfig(reportType).summaryHeading;
}

export function formatGeneratedAt(timestamp) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getSourceTypeLabel(sourceType = "unknown") {
  return sourceType === "arxiv" ? "arXiv（论文摘要）"
    : sourceType === "blog" ? "博客"
    : sourceType === "community" ? "社区精选"
    : sourceType === "news" ? "新闻"
    : "未知";
}

export function parseReportFile(type, name) {
  if (type === REPORT_TYPES.DAILY) {
    const match = name.match(/^(\d{4}-\d{2}-\d{2})-(morning|evening)\.md$/);
    if (!match) return null;
    return {
      slug: name.replace(/\.md$/, ""),
      label: `${match[1]} ${match[2] === "morning" ? "上午" : "晚上"}`,
      sortKey: `${match[1]}-${match[2]}`,
    };
  }

  if (type === REPORT_TYPES.WEEKLY) {
    const match = name.match(/^(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})\.md$/);
    if (!match) return null;
    return {
      slug: name.replace(/\.md$/, ""),
      label: `${match[1]} ~ ${match[2]}`,
      sortKey: match[2],
    };
  }

  return null;
}

function asShanghaiDay(referenceDate = dayjs()) {
  return dayjs(referenceDate).tz ? dayjs(referenceDate).tz("Asia/Shanghai") : dayjs(referenceDate);
}

export function getWeeklyDigestRange(referenceDate = dayjs()) {
  const current = asShanghaiDay(referenceDate).startOf("day");
  const weekday = current.day();
  const daysSinceFriday = (weekday + 2) % 7;
  const latestFriday = current.subtract(daysSinceFriday, "day");
  const previousSaturday = latestFriday.subtract(6, "day");

  return {
    weekStart: previousSaturday.format("YYYY-MM-DD"),
    weekEnd: latestFriday.format("YYYY-MM-DD"),
  };
}

export function matchesTargetDate(feedItem = {}, targetDate) {
  if (!targetDate) return true;

  const candidate = feedItem.isoDate || feedItem.pubDate || feedItem.published || feedItem.date;
  if (!candidate) return false;

  const parsed = dayjs(candidate);
  if (!parsed.isValid()) return false;

  return parsed.tz ? parsed.tz("Asia/Shanghai").format("YYYY-MM-DD") === targetDate
    : parsed.format("YYYY-MM-DD") === targetDate;
}

export function getDailyBackfillDates(startDate, endDate) {
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  if (!start.isValid() || !end.isValid()) {
    throw new Error("Invalid backfill date range, expected YYYY-MM-DD");
  }
  if (end.isBefore(start, "day")) {
    throw new Error("Backfill end date must be on or after start date");
  }

  const dates = [];
  let cursor = start.startOf("day");
  while (!cursor.isAfter(end, "day")) {
    dates.push(cursor.format("YYYY-MM-DD"));
    cursor = cursor.add(1, "day");
  }
  return dates;
}

export function normalizeTitle(title = "") {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildWeeklyFilename(weekStart, weekEnd) {
  return `${weekStart}_to_${weekEnd}.md`;
}
