import fs from "fs";
import path from "path";

import { canFetchFullText } from "./sources.js";
import { normalizeTitle } from "./report-utils.js";

const WEEKLY_CATEGORY_RECOMMENDATION_LIMIT = 8;

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(ext) && !name.startsWith("."))
    .sort();
}

function parseDateFromName(name) {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})-(morning|evening)\.(json|md)$/);
  return match ? { date: match[1], timeSlot: match[2] } : null;
}

function inRange(date, weekStart, weekEnd) {
  return date >= weekStart && date <= weekEnd;
}

function parseDailyMarkdown(fileContent, fileName) {
  const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})-(morning|evening)\.md$/);
  const date = dateMatch?.[1] || "";
  const timeSlot = dateMatch?.[2] || "";
  const generatedAtMatch = fileContent.match(/^生成时间：(.+)$/m);
  const categoryMatches = [...fileContent.matchAll(/^## 🔥 (.+)$/gm)];
  const categories = [];

  for (let index = 0; index < categoryMatches.length; index += 1) {
    const current = categoryMatches[index];
    const next = categoryMatches[index + 1];
    const start = current.index + current[0].length;
    const end = next ? next.index : fileContent.indexOf("\n---", start);
    const block = fileContent.slice(start, end === -1 ? undefined : end).trim();
    const items = [...block.matchAll(/- \*\*(.+?)\*\*\s+\n  来源：(.+?) \((.+?)\)\s+\n(?:  摘要（.+?）：(.+)\n)?  链接：(.+)/g)]
      .map((match) => ({
        title: match[1].trim(),
        source: match[2].trim(),
        sourceType: sourceTypeFromLabel(match[3].trim()),
        snippet: (match[4] || "").trim(),
        fullContent: "",
        contentType: "rss-snippet",
        link: match[5].trim(),
      }));

    categories.push({
      category: current[1].trim(),
      items,
    });
  }

  return {
    reportType: "daily",
    date,
    timeSlot,
    generatedAt: generatedAtMatch?.[1] || null,
    categories,
  };
}

function sourceTypeFromLabel(label) {
  if (label.includes("arXiv")) return "arxiv";
  if (label.includes("博客")) return "blog";
  if (label.includes("社区")) return "community";
  if (label.includes("新闻")) return "news";
  return "unknown";
}

function readDailyArchive(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildHighlightKey(item) {
  if (item.link && item.link !== "#") return item.link.trim();
  return `title:${normalizeTitle(item.title)}`;
}

function summarizeItemContent(item) {
  return (item.fullContent || item.snippet || "").replace(/\s+/g, " ").trim();
}

function sortHighlights(a, b) {
  if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
  return b.latestDate.localeCompare(a.latestDate);
}

export async function buildWeeklyDataset({
  weekStart,
  weekEnd,
  dailyDataDir = path.join(process.cwd(), "daily-data"),
  dailyDir = path.join(process.cwd(), "daily"),
  fetchMissingContent = async () => null,
} = {}) {
  const archiveCandidates = listFiles(dailyDataDir, ".json")
    .map((name) => ({ name, parsed: parseDateFromName(name) }))
    .filter((entry) => entry.parsed && inRange(entry.parsed.date, weekStart, weekEnd));

  let dailyReports = archiveCandidates.map(({ name }) => readDailyArchive(path.join(dailyDataDir, name)));

  if (dailyReports.length === 0) {
    const markdownCandidates = listFiles(dailyDir, ".md")
      .map((name) => ({ name, parsed: parseDateFromName(name) }))
      .filter((entry) => entry.parsed && inRange(entry.parsed.date, weekStart, weekEnd));

    dailyReports = markdownCandidates.map(({ name }) => {
      const fullPath = path.join(dailyDir, name);
      return parseDailyMarkdown(fs.readFileSync(fullPath, "utf8"), name);
    });
  }

  const merged = new Map();
  const categoryMap = new Map();
  const sourceMap = new Map();
  let totalItems = 0;
  let supplementalFetches = 0;

  for (const report of dailyReports) {
    for (const block of report.categories || []) {
      for (const item of block.items || []) {
        totalItems += 1;
        const key = buildHighlightKey(item);
        const content = summarizeItemContent(item);
        let summary = content;

        if (!summary && item.link && canFetchFullText(item.link)) {
          const supplemental = await fetchMissingContent(item.link);
          if (supplemental) {
            summary = supplemental.replace(/\s+/g, " ").trim();
            supplementalFetches += 1;
          }
        }

        const existing = merged.get(key);
        const date = report.date;
        const occurrencePayload = {
          date,
          timeSlot: report.timeSlot,
        };

        if (!existing) {
          merged.set(key, {
            key,
            title: item.title,
            link: item.link,
            source: item.source,
            sourceType: item.sourceType,
            summary,
            category: block.category,
            occurrences: 1,
            dates: [date],
            timeSlots: [report.timeSlot].filter(Boolean),
            latestDate: date,
            firstSeen: occurrencePayload,
          });
        } else {
          existing.occurrences += 1;
          if (!existing.dates.includes(date)) existing.dates.push(date);
          if (report.timeSlot && !existing.timeSlots.includes(report.timeSlot)) existing.timeSlots.push(report.timeSlot);
          if (date > existing.latestDate) existing.latestDate = date;
          if (!existing.summary && summary) existing.summary = summary;
        }

        const categoryItems = categoryMap.get(block.category) || [];
        categoryMap.set(block.category, categoryItems);

        const sourceEntry = sourceMap.get(item.source) || { source: item.source, count: 0 };
        sourceEntry.count += 1;
        sourceMap.set(item.source, sourceEntry);
      }
    }
  }

  const highlights = [...merged.values()].sort(sortHighlights);
  for (const item of highlights) {
    const bucket = categoryMap.get(item.category);
    if (bucket && !bucket.some((entry) => entry.key === item.key)) bucket.push(item);
  }

  const categoryBuckets = [...categoryMap.entries()]
    .map(([category, items]) => ({
      category,
      items: items.sort(sortHighlights).slice(0, WEEKLY_CATEGORY_RECOMMENDATION_LIMIT),
    }))
    .sort((a, b) => b.items.length - a.items.length);

  const sourceStats = [...sourceMap.values()].sort((a, b) => b.count - a.count);

  return {
    meta: {
      reportType: "weekly",
      weekStart,
      weekEnd,
      sampleDays: new Set(dailyReports.map((report) => report.date)).size,
      reportCount: dailyReports.length,
      totalItems,
      generatedFrom: dailyReports.length > 0 ? (archiveCandidates.length > 0 ? "daily-data" : "daily-markdown") : "empty",
      incompleteWeek: new Set(dailyReports.map((report) => report.date)).size < 7,
      supplementalFetches,
    },
    highlights,
    categoryBuckets,
    sourceStats,
    duplicatesMerged: Math.max(0, totalItems - highlights.length),
  };
}
