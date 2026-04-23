import crypto from "crypto";
import fetch from "node-fetch";
import { extractBrief } from "./notify-utils.js";
import { REPORT_TYPES, getReportTitle, getReportDirectory } from "./report-utils.js";

function getFullReportLinkText(reportType) {
  return reportType === REPORT_TYPES.WEEKLY ? "点击查看完整周报" : "点击查看完整日报";
}

function buildDingTalkTitle(reportType, effectiveLabel) {
  return reportType === REPORT_TYPES.WEEKLY
    ? `📰 ${getReportTitle(reportType)}`
    : `📰 ${getReportTitle(reportType)} · ${effectiveLabel}`.trim();
}

export function resolveDingTalkConfig(reportType = REPORT_TYPES.DAILY) {
  const isWeekly = reportType === REPORT_TYPES.WEEKLY;
  return {
    webhook: isWeekly
      ? (process.env.DINGTALK_WEBHOOK_WEEKLY || process.env.DINGTALK_WEBHOOK)
      : (process.env.DINGTALK_WEBHOOK_DAILY || process.env.DINGTALK_WEBHOOK),
    secret: isWeekly
      ? (process.env.DINGTALK_SECRET_WEEKLY || process.env.DINGTALK_SECRET)
      : (process.env.DINGTALK_SECRET_DAILY || process.env.DINGTALK_SECRET),
  };
}

export function buildDingTalkMarkdown({ reportType = REPORT_TYPES.DAILY, effectiveLabel, previewLink, brief }) {
  const title = buildDingTalkTitle(reportType, effectiveLabel);
  let text = `### ${title}\n\n`;

  if (reportType === REPORT_TYPES.WEEKLY && effectiveLabel) {
    text += `🗓️ 周期：${effectiveLabel}\n\n`;
  }

  if (brief) {
    text += `${brief}\n\n`;
  }
  if (previewLink) {
    text += `📖 [${getFullReportLinkText(reportType)}](${previewLink})\n\n`;
  }
  text += `---\n`;
  text += `⏰ 生成时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`;

  return { title, text };
}

/**
 * 发送钉钉机器人通知
 * @param {Object} options
 * @param {string} [options.reportType] - daily/weekly
 * @param {string} [options.today] - 日期 YYYY-MM-DD
 * @param {string} [options.timeSlotLabel] - 上午/晚上
 * @param {string} [options.label] - 展示标签
 * @param {string} options.filename - 文件名（用于拼接预览链接）
 * @param {string} [options.filePath] - markdown 文件路径（用于提取简述）
 */
export async function sendDingTalk({ reportType = REPORT_TYPES.DAILY, today, timeSlotLabel, label, filename, filePath }) {
  const { webhook, secret } = resolveDingTalkConfig(reportType);
  const previewBase = process.env.DAILY_PREVIEW_URL;

  if (!webhook) {
    console.warn("⚠️  DINGTALK_WEBHOOK 未配置，跳过钉钉通知");
    return false;
  }

  console.log(`\n🔔 开始发送钉钉通知...`);

  // 加签
  let url = webhook;
  if (secret) {
    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${secret}`;
    const hmac = crypto.createHmac("sha256", secret).update(stringToSign).digest("base64");
    const sign = encodeURIComponent(hmac);
    url += `&timestamp=${timestamp}&sign=${sign}`;
  }

  // 拼接预览链接
  const slug = filename.replace(".md", "");
  const reportDir = getReportDirectory(reportType);
  const previewLink = previewBase ? `${previewBase.replace(/\/$/, "")}/${reportDir}/${slug}` : null;

  const effectiveLabel = label || [today, timeSlotLabel].filter(Boolean).join(" ");
  const brief = filePath ? extractBrief(filePath, reportType) : "";
  const { title, text } = buildDingTalkMarkdown({
    reportType,
    effectiveLabel,
    previewLink,
    brief,
  });

  const body = {
    msgtype: "markdown",
    markdown: { title, text },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await res.json();
  if (result.errcode === 0) {
    console.log(`   ✅ 钉钉通知发送成功`);
    return true;
  } else {
    console.error(`   ❌ 钉钉通知失败: ${result.errmsg} (errcode: ${result.errcode})`);
    return false;
  }
}

// CLI 测试入口
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const { config } = await import("dotenv");
  config();
  const today = new Date().toISOString().slice(0, 10);
  await sendDingTalk({ today, timeSlotLabel: "测试", filename: `${today}-morning.md` });
}
