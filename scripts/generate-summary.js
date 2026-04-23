import OpenAI from "openai";

const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1";

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 调用 LLM API 生成摘要（单次尝试）
 */
async function callLLMAPI(client, prompt, attempt = 1) {
  try {
    const response = await client.chat.completions.create({
      model: "deepseek-ai/DeepSeek-V3.2",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      stream: false,
      max_tokens: 32767,
      thinking_budget: 32767,
      min_p: 0.05,
      temperature: 0.5,
      top_p: 0.7,
      top_k: 50,
      frequency_penalty: 0.5,
      n: 1,
      response_format: {
        type: "text"
      }
    });

    const summary = response.choices[0]?.message?.content?.trim();
    
    if (summary) {
      return summary;
    } else {
      throw new Error("Empty response from LLM API");
    }
  } catch (error) {
    // 详细的错误信息
    let errorMsg = error.message || 'Unknown error';
    
    if (error.status) {
      errorMsg += ` (HTTP ${error.status})`;
    }
    
    if (error.response) {
      const responseData = error.response;
      if (responseData.status) {
        errorMsg += ` - Status: ${responseData.status}`;
      }
      if (responseData.data) {
        try {
          const errorData = typeof responseData.data === 'string' 
            ? JSON.parse(responseData.data) 
            : responseData.data;
          if (errorData.error) {
            errorMsg += ` - ${JSON.stringify(errorData.error)}`;
          }
        } catch (e) {
          errorMsg += ` - Response: ${JSON.stringify(responseData.data).substring(0, 200)}`;
        }
      }
    }
    
    // OpenAI SDK 错误处理
    if (error.statusCode) {
      errorMsg += ` (Status Code: ${error.statusCode})`;
    }
    
    throw new Error(errorMsg);
  }
}

export function buildDailySummaryPrompt(newsData, timestamp, options = {}) {
  const reportDate = options.reportDate || new Date(timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
  const isHistorical = Boolean(options.isHistorical);

  const basePromptPrefix = `当前时间戳：${timestamp}
报告目标日期：${reportDate}

以下是 ${reportDate} 收集的科研与技术热点新闻：

`;

  const basePromptSuffix = `

请为以上新闻生成一份简洁的日报总结，包括：
1. 当日最重要的技术趋势和热点（分点描述）
2. 值得关注的研究方向或突破
3. 中文技术社区热议话题（知乎热门讨论、阮一峰博客观点、美团技术实践等）
4. 简要的分析或展望
5. 对于开发者、研究人员、学生等不同角色，给出不同的建议和指导

要求：语言专业，并且要富含技术性，可以有趣味性，但要符合事实，要用通俗易懂的语言。
注意区分国际前沿动态和国内技术实践，两者兼顾。用中文输出，800-1500字左右，根据实际情况调整。
严格要求：
- 只输出“总结正文”，不要再写总标题
- 不要输出“报告日期”“分析时间”“生成时间”“UTC”等头部元信息
- 不要写落款、免责声明、括号说明或“本报告基于……”
- 直接从正文分析开始，使用二级/三级标题即可`;

  const historicalNote = isHistorical
    ? `\n重要：这是一份历史回刷日报。请把 ${reportDate} 视为“当日/今日”，不要使用当前真实日期，不要写“今天是当前时间戳对应的日期”。`
    : "";

/**
 * 带重试的 LLM 摘要生成
 */
  const basePromptLength = (basePromptPrefix + historicalNote + basePromptSuffix).length;
  const MAX_TOTAL_LENGTH = 60000;
  const availableLength = MAX_TOTAL_LENGTH - basePromptLength;

  console.log(`   📏 基础提示词长度: ${basePromptLength} 字符`);
  console.log(`   📏 可用新闻内容长度: ${availableLength} 字符`);

  const newsItems = [];
  for (const block of newsData) {
    if (block.items.length === 0) continue;

    block.items.slice(0, 5).forEach((item) => {
      const content = item.fullContent || item.snippet || "";
      let trimmedContent = "";
      let contentType = "";

      if (content && content.trim().length > 50) {
        trimmedContent = content.length > 800
          ? content.substring(0, 800).trim() + "..."
          : content.trim();
        trimmedContent = trimmedContent.replace(/\n/g, " ");
        contentType = item.contentType === "fulltext" ? "全文" : "RSS摘要";
      }

      newsItems.push({
        category: block.category,
        title: item.title || "Untitled",
        source: item.source,
        link: item.link || "#",
        content: trimmedContent,
        contentType,
        hasContent: trimmedContent.length > 0,
      });
    });
  }

  let newsContentFramework = "日报新闻内容：\n\n";
  let currentCategory = "";
  let itemIndex = 1;

  for (let idx = 0; idx < newsItems.length; idx += 1) {
    const item = newsItems[idx];

    if (item.category !== currentCategory) {
      newsContentFramework += `【${item.category}】\n`;
      currentCategory = item.category;
      itemIndex = 1;
    }

    newsContentFramework += `\n${itemIndex}. ${item.title} (来源: ${item.source})\n`;
    newsContentFramework += `   内容（${item.contentType || "无"}）: `;
    newsContentFramework += `{CONTENT_${idx}}\n`;
    itemIndex += 1;
  }

  const frameworkLength = newsContentFramework.length;
  const totalContentPlaceholderLength = newsItems.reduce((sum, item, idx) => sum + `{CONTENT_${idx}}`.length, 0);
  const actualAvailableLength = availableLength - frameworkLength + totalContentPlaceholderLength;
  console.log(`   📏 新闻框架长度: ${frameworkLength} 字符`);
  console.log(`   📏 实际可用于新闻内容的长度: ${actualAvailableLength} 字符`);

  const totalContentLength = newsItems.reduce((sum, item) => sum + item.content.length, 0);
  console.log(`   📏 所有新闻内容总长度: ${totalContentLength} 字符`);

  let newsContent = newsContentFramework;

  if (totalContentLength > actualAvailableLength) {
    const reductionRatio = actualAvailableLength / totalContentLength;
    console.log(`   ⚠️  内容超限，需要缩减至 ${actualAvailableLength.toFixed(0)} 字符（缩减比例: ${(reductionRatio * 100).toFixed(1)}%）`);

    newsItems.forEach((item, idx) => {
      const originalLength = item.content.length;
      const targetLength = Math.floor(originalLength * reductionRatio);
      const truncatedContent = item.content.substring(0, Math.max(100, targetLength - 10)).trim() + "...";
      const placeholder = `{CONTENT_${idx}}`;
      newsContent = newsContent.replace(placeholder, truncatedContent);
      console.log(`      - 新闻 ${idx + 1}: ${originalLength} → ${truncatedContent.length} 字符`);
    });
  } else {
    newsItems.forEach((item, idx) => {
      const placeholder = `{CONTENT_${idx}}`;
      const contentToInsert = item.hasContent ? item.content : "(仅标题，无详细内容)";
      newsContent = newsContent.replace(placeholder, contentToInsert);
    });
  }

  return {
    prompt: basePromptPrefix + newsContent + historicalNote + basePromptSuffix,
    maxTotalLength: MAX_TOTAL_LENGTH,
  };
}

/**
 * 带重试的 LLM 摘要生成
 */
export async function generateSummary(newsData, timestamp, maxRetries = 5, options = {}) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  const totalItems = newsData.reduce((sum, block) => sum + (block.items?.length || 0), 0);

  if (totalItems === 0) {
    console.warn("⚠️  No news items collected, skipping summary generation");
    return null;
  }
  
  if (!apiKey) {
    console.warn("⚠️  SILICONFLOW_API_KEY not set, skipping summary generation");
    return null;
  }

  // 初始化 OpenAI 客户端，使用硅基流动的 API 端点
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: SILICONFLOW_API_URL,
    timeout: 600000,  // 10分钟超时（600秒），允许LLM有足够时间生成长内容
    maxRetries: 0,   // 禁用 OpenAI SDK 自己的重试，我们自己控制
  });

  const { prompt, maxTotalLength: MAX_TOTAL_LENGTH } = buildDailySummaryPrompt(newsData, timestamp, options);
  
  console.log(`   📏 最终 Prompt 长度: ${prompt.length} 字符 (限制: ${MAX_TOTAL_LENGTH} 字符)`);
  
  if (prompt.length > MAX_TOTAL_LENGTH) {
    console.error(`   ❌ 警告: Prompt 仍然超过限制 (${prompt.length} > ${MAX_TOTAL_LENGTH})`);
    // 强制截断
    const truncatedPrompt = prompt.substring(0, MAX_TOTAL_LENGTH - 100) + '\n\n(内容已强制截断)';
    console.log(`   ⚠️  已强制截断至 ${truncatedPrompt.length} 字符`);
    
    // 使用截断后的 prompt 继续重试逻辑
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const delayMs = Math.min(2000 * Math.pow(2, attempt - 2), 30000);
          console.log(`   ⏳ 等待 ${delayMs / 1000} 秒后重试 (第 ${attempt}/${maxRetries} 次尝试)...`);
          await sleep(delayMs);
        }
        
        console.log(`   🔄 尝试生成摘要 (第 ${attempt}/${maxRetries} 次，使用截断后的 prompt)...`);
        const summary = await callLLMAPI(client, truncatedPrompt, attempt);
        console.log(`   ✅ 摘要生成成功 (${summary.length} 字符)`);
        return summary;
      } catch (error) {
        lastError = error;
        console.error(`   ❌ 第 ${attempt}/${maxRetries} 次尝试失败:`, error.message);
        if (attempt === maxRetries) {
          console.error(`   ⚠️  所有尝试均失败`);
          return null;
        }
      }
    }
    return null;
  }

  // 重试逻辑
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        // 指数退避：2秒、4秒、8秒、16秒、32秒，最大30秒
        const delayMs = Math.min(2000 * Math.pow(2, attempt - 2), 30000);
        console.log(`   ⏳ 等待 ${delayMs / 1000} 秒后重试 (第 ${attempt}/${maxRetries} 次尝试)...`);
        await sleep(delayMs);
      }
      
      console.log(`   🔄 尝试生成摘要 (第 ${attempt}/${maxRetries} 次)...`);
      const summary = await callLLMAPI(client, prompt, attempt);
      
      console.log(`   ✅ 摘要生成成功 (${summary.length} 字符)`);
      return summary;
      
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries;
      
      console.error(`   ❌ 第 ${attempt}/${maxRetries} 次尝试失败:`, error.message);
      
      // 如果是最后一次尝试，不继续
      if (isLastAttempt) {
        console.error(`   ⚠️  所有 ${maxRetries} 次尝试均失败，放弃生成摘要`);
        console.error(`   📋 最后错误详情: ${error.message}`);
        
        // 如果是 400 错误，可能是请求参数问题，给出提示
        if (error.message.includes('400')) {
          console.error(`   💡 提示: 400 错误通常表示请求参数有问题，可能是:`);
          console.error(`      - prompt 过长（当前 ${prompt.length} 字符）`);
          console.error(`      - max_tokens 或 thinking_budget 设置过大`);
          console.error(`      - API 参数不合法`);
        } else if (error.message.includes('429')) {
          console.error(`   💡 提示: 429 错误表示请求频率过高，请稍后再试`);
        } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
          console.error(`   💡 提示: 服务器错误，可能是 API 服务暂时不可用`);
        }
        
        return null;
      }
    }
  }
  
  return null;
}
