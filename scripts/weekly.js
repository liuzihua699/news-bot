import { config } from "dotenv";
config();

import { sendEmail } from "./notify-email.js";
import { sendDingTalk } from "./notify-dingtalk.js";
import { runWeeklyReport } from "./run-weekly.js";

console.log(`\n${"#".repeat(60)}`);
console.log(`#  周报全流程调度：生成 → 邮件 → 钉钉`);
console.log(`${"#".repeat(60)}\n`);

const status = { generate: false, email: false, dingtalk: false };

let result;
try {
  result = await runWeeklyReport();
  status.generate = true;
  console.log(`\n✅ [1/3] 周报生成成功: ${result.filePath}`);
} catch (error) {
  console.error(`\n❌ [1/3] 周报生成失败: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}

try {
  status.email = await sendEmail({
    filePath: result.filePath,
    reportType: result.reportType,
    label: result.label,
  });
  console.log(`${status.email ? "✅" : "⏭️ "} [2/3] 邮件${status.email ? "发送成功" : "已跳过（未配置）"}`);
} catch (error) {
  console.error(`❌ [2/3] 邮件发送失败: ${error.message}`);
}

try {
  status.dingtalk = await sendDingTalk({
    reportType: result.reportType,
    label: result.label,
    filename: result.filename,
    filePath: result.filePath,
  });
  console.log(`${status.dingtalk ? "✅" : "⏭️ "} [3/3] 钉钉${status.dingtalk ? "通知成功" : "已跳过（未配置）"}`);
} catch (error) {
  console.error(`❌ [3/3] 钉钉通知失败: ${error.message}`);
}

process.exit(status.generate ? 0 : 1);
