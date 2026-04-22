import fs from "fs";
import { marked } from "marked";
import nodemailer from "nodemailer";
import { REPORT_TYPES, getReportTitle } from "./report-utils.js";

/**
 * 发送报告邮件
 * @param {Object} options
 * @param {string} options.filePath - markdown 文件路径
 * @param {string} [options.reportType] - daily/weekly
 * @param {string} [options.today] - 日期 YYYY-MM-DD
 * @param {string} [options.timeSlotLabel] - 上午/晚上
 * @param {string} [options.label] - 展示标签
 */
export async function sendEmail({ filePath, reportType = REPORT_TYPES.DAILY, today, timeSlotLabel, label }) {
  const host = process.env.EMAIL_SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_SMTP_PORT || "465");
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  const recipients = process.env.EMAIL_RECIPIENTS;

  if (!user || !pass || !recipients) {
    console.warn("⚠️  邮件配置不完整（需要 EMAIL_USER, EMAIL_PASSWORD, EMAIL_RECIPIENTS），跳过邮件发送");
    return false;
  }

  const recipientList = recipients.split(",").map(s => s.trim()).filter(Boolean);
  if (recipientList.length === 0) {
    console.warn("⚠️  EMAIL_RECIPIENTS 为空，跳过邮件发送");
    return false;
  }

  console.log(`\n📧 开始发送邮件...`);
  console.log(`   收件人: ${recipientList.join(", ")}`);

  const md = fs.readFileSync(filePath, "utf-8");
  const htmlBody = marked.parse(md);
  const subjectLabel = label || [today, timeSlotLabel].filter(Boolean).join(" ");
  const subject = `${getReportTitle(reportType)} · ${subjectLabel}`.trim();

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;max-width:860px;margin:auto;padding:20px;line-height:1.8;color:#333;font-size:15px}
h1{font-size:1.6em;border-bottom:2px solid #4361ee;padding-bottom:10px}
h2{font-size:1.3em;margin-top:1.8em;border-bottom:1px solid #eee;padding-bottom:6px}
h3{font-size:1.1em;margin-top:1.4em}
a{color:#4361ee;text-decoration:none}
a:hover{text-decoration:underline}
hr{border:none;border-top:1px solid #e5e5e5;margin:2em 0}
code{background:#f4f4f4;padding:2px 5px;border-radius:3px;font-size:0.9em}
pre{background:#f4f4f4;padding:14px;border-radius:6px;overflow-x:auto;font-size:13px}
blockquote{border-left:3px solid #4361ee;background:#f8f9fc;padding:10px 16px;margin:1em 0;color:#555}
strong{color:#222}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #e5e5e5;padding:8px 12px;text-align:left}
th{background:#f8f8f8}
</style></head><body>${htmlBody}</body></html>`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: user,
    to: recipientList.join(", "),
    subject,
    html,
  });

  console.log(`   ✅ 邮件发送成功`);
  return true;
}

// CLI 测试入口
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const { config } = await import("dotenv");
  config();
  const today = new Date().toISOString().slice(0, 10);
  const fs = await import("fs");
  const path = await import("path");
  const dir = path.join(process.cwd(), "daily");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort().reverse();
  if (files.length === 0) { console.log("没有日报文件"); process.exit(1); }
  await sendEmail({ filePath: path.join(dir, files[0]), today, timeSlotLabel: "测试" });
}
