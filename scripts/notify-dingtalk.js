import crypto from "crypto";
import fs from "fs";
import fetch from "node-fetch";

/**
 * 从日报 markdown 中提取简述（取"今日总结"下的前 200 字左右）
 */
function extractBrief(filePath, maxLen = 200) {
  try {
    const md = fs.readFileSync(filePath, "utf-8");
    // 找到 "今日总结" 之后的正文段落
    const match = md.match(/##\s*📝?\s*今日总结[\s\S]*?\n#\s+.+\n\n([\s\S]*?)(?=\n##\s|\n---)/);
    if (!match) return "";
    // 清理 markdown 格式，取纯文本
    let text = match[1]
      .replace(/^###?\s*.+$/gm, "")     // 移除子标题
      .replace(/\*\*/g, "")              // 移除加粗
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 链接变纯文本
      .replace(/\n{2,}/g, "\n")
      .trim();
    if (text.length > maxLen) text = text.substring(0, maxLen) + "...";
    return text;
  } catch { return ""; }
}

/**
 * 发送钉钉机器人通知
 * @param {Object} options
 * @param {string} options.today - 日期 YYYY-MM-DD
 * @param {string} options.timeSlotLabel - 上午/晚上
 * @param {string} options.filename - 文件名（用于拼接预览链接）
 * @param {string} [options.filePath] - markdown 文件路径（用于提取简述）
 */
export async function sendDingTalk({ today, timeSlotLabel, filename, filePath }) {
  const webhook = process.env.DINGTALK_WEBHOOK;
  const secret = process.env.DINGTALK_SECRET;
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
  const previewLink = previewBase ? `${previewBase.replace(/\/$/, "")}/daily/${slug}` : null;

  const title = `📰 科研 & 技术热点日报 · ${today}`;
  const brief = filePath ? extractBrief(filePath) : "";

  let text = `### ${title}\n\n`;
  if (brief) {
    text += `${brief}\n\n`;
  }
  if (previewLink) {
    text += `📖 [点击查看完整日报](${previewLink})\n\n`;
  }
  text += `---\n`;
  text += `⏰ 生成时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`;

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
