import { config } from "dotenv";
config();

import { run } from "./run.js";
import { sendEmail } from "./notify-email.js";
import { sendDingTalk } from "./notify-dingtalk.js";

console.log(`\n${"#".repeat(60)}`);
console.log(`#  日报全流程调度：生成 → 邮件 → 钉钉`);
console.log(`${"#".repeat(60)}\n`);

const status = { generate: false, email: false, dingtalk: false };

// Step 1: 生成日报
let result;
try {
  result = await run();
  status.generate = true;
  console.log(`\n✅ [1/3] 日报生成成功: ${result.filePath}`);
} catch (error) {
  console.error(`\n❌ [1/3] 日报生成失败: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}

// Step 2: 发送邮件
try {
  status.email = await sendEmail({
    filePath: result.filePath,
    today: result.today,
    timeSlotLabel: result.timeSlotLabel,
  });
  console.log(`${status.email ? "✅" : "⏭️ "} [2/3] 邮件${status.email ? "发送成功" : "已跳过（未配置）"}`);
} catch (error) {
  console.error(`❌ [2/3] 邮件发送失败: ${error.message}`);
}

// Step 3: 钉钉通知
try {
  status.dingtalk = await sendDingTalk({
    today: result.today,
    timeSlotLabel: result.timeSlotLabel,
    filename: result.filename,
    filePath: result.filePath,
  });
  console.log(`${status.dingtalk ? "✅" : "⏭️ "} [3/3] 钉钉${status.dingtalk ? "通知成功" : "已跳过（未配置）"}`);
} catch (error) {
  console.error(`❌ [3/3] 钉钉通知失败: ${error.message}`);
}

// 汇总
console.log(`\n${"=".repeat(60)}`);
console.log(`📋 执行汇总:`);
console.log(`   日报生成: ${status.generate ? "✅" : "❌"}`);
console.log(`   邮件发送: ${status.email ? "✅" : "⏭️  跳过/失败"}`);
console.log(`   钉钉通知: ${status.dingtalk ? "✅" : "⏭️  跳过/失败"}`);
console.log(`${"=".repeat(60)}\n`);

process.exit(status.generate ? 0 : 1);
