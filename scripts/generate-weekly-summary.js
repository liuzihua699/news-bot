import OpenAI from "openai";

const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWeeklyLLM(client, prompt) {
  const response = await client.chat.completions.create({
    model: "deepseek-ai/DeepSeek-V3.2",
    messages: [{ role: "user", content: prompt }],
    stream: false,
    max_tokens: 32767,
    thinking_budget: 32767,
    min_p: 0.05,
    temperature: 0.5,
    top_p: 0.7,
    top_k: 50,
    frequency_penalty: 0.4,
    n: 1,
    response_format: { type: "text" },
  });

  return response.choices[0]?.message?.content?.trim() || null;
}

function buildFallbackSummary(dataset) {
  const topCategories = dataset.categoryBuckets
    .slice(0, 3)
    .map((bucket) => `${bucket.category}（${bucket.items.length} 条代表项）`);
  const topHighlights = dataset.highlights
    .slice(0, 3)
    .map((item) => `${item.title}（${item.occurrences} 次）`);

  const parts = [
    `本周统计区间为 ${dataset.meta.weekStart} 至 ${dataset.meta.weekEnd}，共覆盖 ${dataset.meta.sampleDays} 天样本，累计整理 ${dataset.meta.totalItems} 条原始日报条目，去重后保留 ${dataset.highlights.length} 个独立热点。`,
  ];

  if (topCategories.length > 0) {
    parts.push(`从分类分布看，最活跃的方向集中在 ${topCategories.join("、")}。`);
  }

  if (topHighlights.length > 0) {
    parts.push(`重复出现频率最高的主题包括 ${topHighlights.join("、")}，说明这些议题在一周内持续受到关注。`);
  }

  if (dataset.meta.incompleteWeek) {
    parts.push("由于本周样本天数不足 7 天，结论更适合作为方向性观察，而不是完整周度判断。");
  } else {
    parts.push("整体上，这份周报更适合先看趋势判断，再回到分类精选核对具体信息源。");
  }

  return parts.join("\n\n");
}

function buildPrompt(dataset, timestamp) {
  const highlights = dataset.highlights.slice(0, 12).map((item, index) => (
    `${index + 1}. ${item.title}
来源：${item.source}
分类：${item.category}
出现次数：${item.occurrences}
出现日期：${item.dates.join("、")}
摘要：${item.summary || "无"}
链接：${item.link || "#"}`
  )).join("\n\n");

  const categories = dataset.categoryBuckets.map((bucket) => (
    `- ${bucket.category}：${bucket.items.length} 条代表项`
  )).join("\n");

  const sources = dataset.sourceStats.slice(0, 10).map((item) => (
    `- ${item.source}：${item.count} 条`
  )).join("\n");

  return `当前时间戳：${timestamp}

以下是 ${dataset.meta.weekStart} 到 ${dataset.meta.weekEnd} 的科研与技术热点周报输入材料。

样本信息：
- 样本天数：${dataset.meta.sampleDays}
- 日报文件数：${dataset.meta.reportCount}
- 原始条目数：${dataset.meta.totalItems}
- 去重后热点数：${dataset.highlights.length}
- 合并重复数：${dataset.duplicatesMerged}
- 是否缺样本：${dataset.meta.incompleteWeek ? "是" : "否"}

分类分布：
${categories || "- 暂无"}

来源分布：
${sources || "- 暂无"}

重点候选：
${highlights || "暂无重点候选"}

请生成一份中文周报总结，采用“趋势分析 + 分类精选”的混合写法，要求：
1. 先给出本周总览，用 1 段话说明本周技术主线。
2. 提炼 3-5 个核心趋势，每个趋势写明：发生了什么、为什么重要、有哪些值得持续关注的变化。
3. 区分国际前沿动态与国内工程/社区实践，不要混成流水账。
4. 给开发者、研究人员、学生分别提供简洁建议。
5. 不要逐条复述所有新闻；重复报道只能算一个趋势信号。
6. 用中文输出，保持专业、清晰、克制，篇幅控制在 1200-2200 字。`;
}

export async function generateWeeklySummary(dataset, timestamp, maxRetries = 5) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    console.warn("⚠️  SILICONFLOW_API_KEY not set, using fallback weekly summary");
    return buildFallbackSummary(dataset);
  }

  const client = new OpenAI({
    apiKey,
    baseURL: SILICONFLOW_API_URL,
    timeout: 600000,
    maxRetries: 0,
  });

  const prompt = buildPrompt(dataset, timestamp);
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      if (attempt > 1) {
        const delayMs = Math.min(2000 * Math.pow(2, attempt - 2), 30000);
        console.log(`   ⏳ 等待 ${delayMs / 1000} 秒后重试周报摘要 (第 ${attempt}/${maxRetries} 次)...`);
        await sleep(delayMs);
      }

      console.log(`   🔄 尝试生成周报摘要 (第 ${attempt}/${maxRetries} 次)...`);
      const summary = await callWeeklyLLM(client, prompt);
      if (summary) return summary;
      throw new Error("Empty response from weekly LLM API");
    } catch (error) {
      lastError = error;
      console.error(`   ❌ 周报摘要生成失败 (第 ${attempt}/${maxRetries} 次): ${error.message}`);
    }
  }

  console.error(`   ⚠️  周报摘要全部重试失败，使用 fallback：${lastError?.message || "Unknown error"}`);
  return buildFallbackSummary(dataset);
}
