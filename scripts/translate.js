import OpenAI from "openai";

const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1";
const BATCH_SIZE_LIMIT = 20000; // 每批最大字符数

/**
 * 判断文本是否主要是英文（ASCII 字母占比超过 60%）
 */
function isEnglishText(text) {
  if (!text || text.trim().length < 20) return false;
  // 只统计字母字符，忽略数字、标点和空格
  const letters = [...text].filter(c => /[a-zA-Z\u4e00-\u9fff]/.test(c));
  if (letters.length === 0) return false;
  const englishLetters = letters.filter(c => /[a-zA-Z]/.test(c)).length;
  return englishLetters / letters.length > 0.6;
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 调用 LLM 翻译单批文本，带重试
 */
async function callTranslateAPI(client, texts, maxRetries = 3) {
  const numberedTexts = texts.map((t, i) => `[${i}]\n${t.text}`).join("\n\n===SEPARATOR===\n\n");

  const prompt = `你是一个专业的英中翻译器。请将以下${texts.length}段英文文本逐条翻译为中文。

要求：
1. 保持专业术语准确，技术名词可保留英文原文并在括号内标注
2. 翻译自然流畅，符合中文表达习惯
3. 以 JSON 数组格式返回，数组长度必须为 ${texts.length}，每个元素是对应编号的翻译结果字符串
4. 仅返回 JSON 数组，不要有其他任何内容

输入文本：
${numberedTexts}

返回格式示例：["翻译1", "翻译2", ...]`;

  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        const delayMs = 2000 * Math.pow(2, attempt - 2);
        console.log(`      ⏳ 重试等待 ${delayMs / 1000}s (第${attempt}/${maxRetries}次)...`);
        await sleep(delayMs);
      }

      const response = await client.chat.completions.create({
        model: "deepseek-ai/DeepSeek-V3.2",
        messages: [{ role: "user", content: prompt }],
        stream: false,
        max_tokens: 16384,
        temperature: 0.2,
        top_p: 0.7,
        response_format: { type: "text" }
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) throw new Error("Empty translation response");

      // 解析 JSON，兼容 markdown 代码块
      let jsonStr = content;
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      const translations = JSON.parse(jsonStr);
      if (!Array.isArray(translations)) {
        throw new Error(`Expected array, got ${typeof translations}`);
      }

      // 容忍数量略有差异——取能匹配的部分
      if (translations.length < texts.length) {
        console.warn(`      ⚠️  翻译返回 ${translations.length} 条（期望 ${texts.length}），部分保留原文`);
      }

      return translations;
    } catch (error) {
      lastError = error;
      console.error(`      ❌ 翻译第${attempt}次尝试失败: ${error.message}`);
    }
  }
  throw lastError;
}

/**
 * 批量翻译新闻数据中的英文摘要和标题为中文
 * 原地修改 newsData 中的 title、snippet、fullContent 字段
 */
export async function translateSnippets(newsData) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    console.warn("⚠️  SILICONFLOW_API_KEY not set, skipping translation");
    return;
  }

  const client = new OpenAI({
    apiKey,
    baseURL: SILICONFLOW_API_URL,
    timeout: 300000,
    maxRetries: 0,
  });

  // 收集所有需要翻译的文本
  const toTranslate = [];

  for (const block of newsData) {
    for (const item of block.items) {
      // 翻译标题
      if (item.title && isEnglishText(item.title)) {
        toTranslate.push({ text: item.title, item, field: 'title' });
      }
      // 翻译摘要内容
      const content = item.fullContent || item.snippet;
      if (content && isEnglishText(content)) {
        const truncated = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
        toTranslate.push({
          text: truncated,
          item,
          field: item.fullContent ? 'fullContent' : 'snippet'
        });
      }
    }
  }

  if (toTranslate.length === 0) {
    console.log("ℹ️  没有需要翻译的英文内容");
    return;
  }

  console.log(`\n🌐 开始翻译 ${toTranslate.length} 条英文内容（标题+摘要）...`);

  // 分批
  const batches = [];
  let currentBatch = [];
  let currentSize = 0;

  for (const entry of toTranslate) {
    const entrySize = entry.text.length;
    if (currentSize + entrySize > BATCH_SIZE_LIMIT && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }
    currentBatch.push(entry);
    currentSize += entrySize;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);

  console.log(`   📦 分为 ${batches.length} 批处理`);

  let successCount = 0;
  let failCount = 0;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(`   🔄 翻译第 ${batchIdx + 1}/${batches.length} 批（${batch.length} 条）...`);

    try {
      const translations = await callTranslateAPI(client, batch);

      for (let i = 0; i < batch.length; i++) {
        const entry = batch[i];
        const translated = translations[i];
        if (translated && typeof translated === 'string' && translated.trim().length > 0) {
          entry.item[entry.field] = translated.trim();
          successCount++;
        } else {
          failCount++;
        }
      }

      console.log(`   ✅ 第 ${batchIdx + 1} 批翻译完成`);
    } catch (error) {
      failCount += batch.length;
      console.error(`   ❌ 第 ${batchIdx + 1} 批翻译失败: ${error.message}`);
      console.log(`   ⚠️  该批次保留原文`);
    }
  }

  console.log(`🌐 翻译完成：成功 ${successCount} 条，失败 ${failCount} 条\n`);
}
