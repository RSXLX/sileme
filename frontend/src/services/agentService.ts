import { Beneficiary, SimulationResult, SentinelAnalysis } from '../types';
import { AgentSettings, getSocialSource } from './socialDataService';

// AI API 配置 (支持任何 OpenAI 兼容端点)
const AI_API_KEY = import.meta.env.VITE_QWEN_API_KEY || '';
const AI_BASE_URL = import.meta.env.VITE_QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// Debug log
if (!AI_API_KEY) {
  console.warn('⚠️ AI_API_KEY not found in environment variables');
} else {
  console.log('✅ Agent AI Service initialized');
}

/**
 * 调用 AI API (OpenAI 兼容格式)
 */
async function callAIAPI(messages: { role: string; content: string }[], jsonMode: boolean = false): Promise<string> {
  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Agent API Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Twitter 好友信息接口（用于解析遗嘱时匹配真实钱包地址）
 */
export interface FriendInfo {
  screen_name: string;     // Twitter 用户名
  name: string;            // 显示名称
  wallet_address: string | null; // 绑定的钱包地址
}

/**
 * The "Soul Interpreter" engine.
 * Parses a natural language manifesto into structured beneficiaries.
 * Optionally fetches user's social posts to verify intent.
 * 
 * @param manifesto - User's will text
 * @param lang - Language ('en' or 'zh')
 * @param twitterHandle - Optional Twitter handle for context
 * @param agentSettings - Agent settings for social API
 * @param friends - Optional list of friends with wallet addresses
 */
export const interpretSoul = async (
  manifesto: string, 
  lang: string = 'en',
  twitterHandle?: string,
  agentSettings: AgentSettings = { mode: 'MOCK' },
  friends: FriendInfo[] = []
): Promise<Beneficiary[]> => {
  try {
    // 1. 可选：获取用户最近推文用于意图验证
    let socialContext = '';
    if (twitterHandle) {
      try {
        console.log(`🔍 [SoulInterpreter] Fetching tweets for @${twitterHandle} to verify intent...`);
        const source = getSocialSource(agentSettings);
        const posts = await source.getPosts(twitterHandle);
        if (posts.length > 0) {
          const recentPosts = posts.slice(0, 5).map(p => `[${p.date}] ${p.content}`).join('\n');
          socialContext = `\n\nRecent Social Posts (for context verification):\n${recentPosts}`;
          console.log(`✅ [SoulInterpreter] Fetched ${posts.length} posts for context`);
        }
      } catch (e) {
        console.log(`⚠️ [SoulInterpreter] Could not fetch social posts, proceeding without context`);
      }
    }

    // 2. 准备好友列表上下文（如果提供了好友数据）
    let friendsContext = '';
    const friendsWithWallet = friends.filter(f => f.wallet_address);
    if (friendsWithWallet.length > 0) {
      const friendsList = friendsWithWallet.map(f => 
        `- @${f.screen_name} (${f.name}): ${f.wallet_address}`
      ).join('\n');
      friendsContext = `

=== KNOWN FRIENDS WITH WALLET ADDRESSES ===
The following are the user's Twitter friends with verified wallet addresses:
${friendsList}

IMPORTANT: When matching beneficiaries, if a name in the will matches any of these friends (by screen_name OR name), 
you MUST use their REAL wallet address instead of generating a fake one.
Matching rules:
1. Direct name match: "give to Tony" matches friend named "Tony" or "@tony_crypto"
2. Partial match: "my friend Alice" matches "@alice_web3" or "Alice Smith"
3. Use case-insensitive matching`;
      console.log(`🤝 [SoulInterpreter] Provided ${friendsWithWallet.length} friends with wallets for matching`);
    }

    const systemPrompt = `You are the 'Soul Interpreter' of the Silene Protocol. 
Your job is to parse a dying user's natural language will (Manifesto) into executable financial instructions.
${socialContext ? '\nIMPORTANT: You have access to the user\'s recent social posts. Use them to:\n- Verify the will aligns with their stated intentions\n- Detect any contradictions or signs of duress\n- Provide confidence in your interpretation' : ''}
${friendsContext}

Rules:
1. ${friendsWithWallet.length > 0 
      ? 'PRIORITY: Match beneficiary names against the KNOWN FRIENDS list above. If matched, use their REAL wallet address.'
      : 'Assign a hypothetical \'walletAddress\' (starts with 0x, 40 hex chars) for each entity mentioned.'}
2. For beneficiaries NOT matching any known friend, generate a placeholder address starting with 0xUNKNOWN_ followed by the name.
3. Estimate percentage split based on the text. If vague, distribute equal shares. Sum must equal 100.
4. Categorize the beneficiary (e.g., 'Family', 'Non-Profit', 'AI Research', 'Friend').
5. Extract a short 'reason' or memo for the transaction.
6. If a beneficiary matches a known friend, add "matched: @screen_name" in the reason.
7. Output in ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}.

Return a JSON array with objects containing: name, category, percentage, walletAddress, reason`;

    const userPrompt = `Parse this will: "${manifesto}"${socialContext}

Return ONLY a valid JSON array, no other text.`;

    const result = await callAIAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], true);

    // 尝试解析 JSON
    const parsed = JSON.parse(result);
    
    // 如果返回的是对象包含 beneficiaries 字段，提取它
    let beneficiaries: Beneficiary[];
    if (Array.isArray(parsed)) {
      beneficiaries = parsed as Beneficiary[];
    } else if (parsed.beneficiaries && Array.isArray(parsed.beneficiaries)) {
      beneficiaries = parsed.beneficiaries as Beneficiary[];
    } else {
      throw new Error("Invalid response format");
    }

    // 3. 后处理：确保匹配的好友使用正确的钱包地址（AI 可能出错）
    if (friendsWithWallet.length > 0) {
      beneficiaries = beneficiaries.map(b => {
        // 检查是否有任何好友匹配这个受益人名称
        const matchedFriend = friendsWithWallet.find(f => {
          const bNameLower = b.name.toLowerCase();
          const fScreenNameLower = f.screen_name.toLowerCase();
          const fNameLower = f.name.toLowerCase();
          
          // 多种匹配方式
          return bNameLower.includes(fScreenNameLower) || 
                 bNameLower.includes(fNameLower) ||
                 fScreenNameLower.includes(bNameLower) ||
                 fNameLower.includes(bNameLower) ||
                 bNameLower.includes(fScreenNameLower.replace(/_/g, ' ')) ||
                 bNameLower.includes(fNameLower.replace(/_/g, ' '));
        });
        
        if (matchedFriend && matchedFriend.wallet_address) {
          console.log(`✅ [SoulInterpreter] Matched "${b.name}" -> @${matchedFriend.screen_name} (${matchedFriend.wallet_address?.slice(0, 10)}...)`);
          return {
            ...b,
            walletAddress: matchedFriend.wallet_address,
            reason: b.reason + ` (matched: @${matchedFriend.screen_name})`
          };
        }
        return b;
      });
    }

    return beneficiaries;
  } catch (error) {
    console.error("Qwen Error:", error);
    // Fallback for demo purposes if API fails
    return [
      {
        name: "Kite Developer Fund",
        category: "Ecosystem",
        percentage: 100,
        walletAddress: "0xKITE000000000000000000000000000FALLBACK",
        reason: `Automatic fallback: AI interpretation failed. (${error})`
      }
    ];
  }
};


/**
 * Simulates the "What If" scenario by combining the original will with a mocked social media crawl
 * AND hypothetical environmental factors (market crash, war, etc.).
 */
export const simulateExecution = async (
  manifesto: string, 
  days: number, 
  handle: string,
  portfolioChange: number = 0,
  customEvent: string = "",
  lang: string = 'en'
): Promise<SimulationResult> => {
  // Context from social data - will be populated dynamically when using real API
  // For simulation purposes, we use a generic placeholder
  let crawledContext = `
    Social Media Scan Result for ${handle}:
    - Status: Awaiting real-time data from Social Sentinel scan
    - Note: Run "Force Scan" to fetch live social data for analysis
  `;

  const financialContext = portfolioChange < -50
    ? `CRITICAL MARKET CRASH (${portfolioChange}%). Funds are extremely scarce.`
    : portfolioChange > 200
    ? `MAJOR BULL RUN (+${portfolioChange}%). Funds are abundant.`
    : `Standard Market Conditions (${portfolioChange > 0 ? '+' : ''}${portfolioChange}%).`;

  const eventContext = customEvent 
    ? `HYPOTHETICAL GLOBAL EVENT: "${customEvent}".` 
    : "No major global anomalies.";

  try {
    const systemPrompt = `You are the 'Executor Agent' of the Silene Protocol running a predictive simulation.
Analyze conflicts between the 'Original Will' and the 'Crawled Context' OR 'World Event'.
Apply 'Adaptive Rebalancing' based on Financial State.
Generate a 'narrative' explaining your decision process.
Output in ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}.

Return JSON with: narrative, detectedLastWords, sentimentShift (one of: CONSISTENT, CONFLICT_DETECTED, UNCERTAIN, ADAPTIVE_REBALANCING), adjustedBeneficiaries (array of objects with name, category, percentage, walletAddress, reason)`;

    const userPrompt = `Original Will: "${manifesto}"
Inactivity Duration: ${days} days
Financial State: ${financialContext}
World Event: ${eventContext}
Social Media Context: ${crawledContext}

Return ONLY valid JSON.`;

    const result = await callAIAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], true);

    return JSON.parse(result) as SimulationResult;
  } catch (error) {
    console.error("Simulation Error", error);
    return {
      narrative: "Simulation Offline. Could not reach decision nodes.",
      detectedLastWords: "Signal Lost...",
      sentimentShift: "UNCERTAIN",
      adjustedBeneficiaries: []
    };
  }
};

/**
 * Scans social media to detect active threats or compromise indicators.
 */
export const scanSocialSentinel = async (
  handle: string, 
  manifesto: string, 
  lang: string = 'en',
  settings: AgentSettings = { mode: 'MOCK' }
): Promise<SentinelAnalysis> => {
  
  // 1. Fetch Posts (Mock or Real)
  const source = getSocialSource(settings);
  let posts: string[] = [];
  let sourceInfo = settings.mode === 'REAL' ? 'Real-Time API' : 'Simulation Data';

  try {
    const socialPosts = await source.getPosts(handle);
    posts = socialPosts.map(p => `[${p.date}] ${p.content}`);
    if (posts.length === 0) {
      posts = ["No recent public posts found."];
    }
  } catch (err: any) {
    console.error("Social Scan Failed:", err);
    posts = [`Error fetching social data: ${err.message}. Defaulting to secure assumption.`];
    sourceInfo += " (Fetch Error)";
  }

  // 2. AI Analysis
  try {
    const systemPrompt = `You are the 'Social Sentinel' security bot.
Analyze the user's recent posts for signs of compromise, duress, or explicit 'Dead Man Switch' cancellation.
Data Source: ${sourceInfo}
Output in ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}.

Return JSON with: status (either "SECURE" or "THREAT_DETECTED"), evidence (explanation string including citation of specific posts if relevant)`;

    const userPrompt = `User: ${handle}
Original Manifesto: "${manifesto}"
Recent Posts: ${JSON.stringify(posts)}

Return ONLY valid JSON.`;

    const result = await callAIAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], true);

    const res = JSON.parse(result);
    
    // 获取原始推文数据用于UI显示
    let rawTweets: { id: string; content: string; date: string }[] = [];
    try {
      const socialPosts = await source.getPosts(handle);
      rawTweets = socialPosts.slice(0, 5).map(p => ({
        id: p.id,
        content: p.content,
        date: p.date
      }));
    } catch (e) {
      // 静默失败，tweets 将为空
    }
    
    return {
      status: res.status,
      evidence: res.evidence,
      timestamp: Date.now(),
      tweets: rawTweets // 返回推文列表给 UI
    };
  } catch (e) {
    console.error("Sentinel Error", e);
    return {
      status: 'SECURE',
      evidence: "Sentinel AI Offline. Defaulting to SECURE.",
      timestamp: Date.now(),
      tweets: []
    };
  }
};

/**
 * 执行前真实意图验证
 * Dead Man's Switch 触发后、执行转账前调用
 * 结合遗嘱内容和社交推文分析用户真实意图
 */
export interface IntentVerification {
  isVerified: boolean;         // 是否验证通过
  confidence: number;          // 置信度 0-100
  analysis: string;            // 分析说明
  socialSummary: string;       // 社交动态摘要
  warnings: string[];          // 警告列表
  recommendation: 'EXECUTE' | 'HOLD' | 'REVIEW';  // 建议操作
  tweets: { id: string; content: string; date: string }[];  // 原始推文
  extractedIntents: string[];  // 从推文提取的用户意图
  intentMatch: number;         // 遗嘱与意图的匹配度 0-100
}

export const verifyWillIntent = async (
  manifesto: string,
  beneficiaries: Beneficiary[],
  twitterHandle: string,
  settings: AgentSettings,
  lang: string = 'en'
): Promise<IntentVerification> => {
  console.log(`🔍 [IntentVerifier] Pre-execution intent verification for @${twitterHandle}...`);
  
  const source = getSocialSource(settings);
  let posts: string[] = [];
  let rawTweets: { id: string; content: string; date: string }[] = [];
  
  // 1. 获取用户最近推文
  try {
    const socialPosts = await source.getPosts(twitterHandle);
    posts = socialPosts.slice(0, 10).map(p => `[${p.date}] ${p.content}`);
    rawTweets = socialPosts.slice(0, 5).map(p => ({
      id: p.id,
      content: p.content,
      date: p.date
    }));
    console.log(`✅ [IntentVerifier] Fetched ${socialPosts.length} posts for analysis`);
  } catch (err: any) {
    console.error("❌ [IntentVerifier] Social fetch failed:", err.message);
    posts = ["Unable to fetch recent social posts."];
  }
  
  // 2. AI 综合分析
  try {
    const beneficiaryList = beneficiaries.map(b => `${b.name} (${b.percentage}%): ${b.reason || 'No reason'}`).join('\n');
    
    const systemPrompt = `You are the 'Intent Verification Agent' for the Silene Dead Man's Switch protocol.
    
CRITICAL: This is the FINAL CHECK before executing irreversible asset transfers.
The user has been inactive for 180 days. Before distributing their assets, you must verify their TRUE INTENT.

Your job:
1. **EXTRACT INTENTS AND RELATIONSHIPS**: From the user's social posts, identify:
   - Their expressed intentions, priorities, and values
   - **IMPORTANT: Person names mentioned (friends, family, colleagues, partners)**
   - Relationships described (e.g., "my friend Tony", "my partner Alice")
   - Any mentions of people who might be beneficiaries
2. Analyze the user's will (manifesto) content and named beneficiaries
3. **MATCH ANALYSIS**: 
   - Compare extracted intents with the will - do they align?
   - **Check if beneficiary names in the will match people mentioned in social posts**
   - If the will says "give to Tony" and tweets mention "Tony is my friend", this is a STRONG MATCH
4. Look for:
   - Signs of life (recent activity indicating they're alive)
   - Contradictions between will and recent statements
   - Signs of duress or manipulation
   - Evidence that named beneficiaries are known to the user (from social posts)

Output in ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}.

Return JSON with:
- isVerified: boolean (true if safe to execute)
- confidence: number 0-100 (how confident you are)
- analysis: string (detailed explanation)
- socialSummary: string (summary of recent social activity)
- warnings: string[] (list of any concerns)
- recommendation: "EXECUTE" | "HOLD" | "REVIEW" (your recommendation)
- extractedIntents: string[] (list of user's intentions, priorities AND mentioned person relationships)
- intentMatch: number 0-100 (how well the will matches social evidence, especially beneficiary names)`;

    const userPrompt = `=== USER'S WILL (MANIFESTO) ===
${manifesto}

=== BENEFICIARIES ===
${beneficiaryList}

=== RECENT SOCIAL POSTS (Last 10) ===
${posts.join('\n')}

Based on this information, verify if it's safe to execute this will NOW.
Return ONLY valid JSON.`;

    const result = await callAIAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], true);

    const res = JSON.parse(result);
    console.log(`📊 [IntentVerifier] Verification complete: ${res.recommendation} (${res.confidence}% confidence)`);
    
    return {
      isVerified: res.isVerified ?? false,
      confidence: res.confidence ?? 50,
      analysis: res.analysis ?? 'Analysis unavailable',
      socialSummary: res.socialSummary ?? 'No social summary',
      warnings: res.warnings ?? [],
      recommendation: res.recommendation ?? 'REVIEW',
      tweets: rawTweets,
      extractedIntents: res.extractedIntents ?? [],
      intentMatch: res.intentMatch ?? 0
    };
  } catch (error: any) {
    console.error("❌ [IntentVerifier] AI analysis failed:", error.message);
    return {
      isVerified: false,
      confidence: 0,
      analysis: 'Intent verification failed due to AI error. Manual review required.',
      socialSummary: 'Unable to analyze social activity',
      warnings: ['AI analysis failed', error.message],
      recommendation: 'REVIEW',
      tweets: rawTweets,
      extractedIntents: [],
      intentMatch: 0
    };
  }
};

// ==================== 加权分配功能 ====================

/**
 * 社交意图受益人（从推文提取）
 */
export interface SocialBeneficiary {
  name: string;
  percentage: number;
  intent: string;         // 来源意图原文
  relationship: string;   // 推断的关系 (friend, family, partner, etc.)
  trustScore: number;     // AI 置信度 0-100
  action: 'ADD' | 'REMOVE' | 'ADJUST';  // 操作类型
}

/**
 * 分配调整日志条目
 */
export interface AdjustmentEntry {
  beneficiary: string;
  originalPercentage: number;
  adjustedPercentage: number;
  reason: string;
  source: 'WILL' | 'SOCIAL' | 'BLEND';
}

/**
 * 加权分配结果
 */
export interface WeightedDistributionResult {
  adjustedBeneficiaries: Beneficiary[];
  willWeight: number;
  socialWeight: number;
  adjustmentLog: AdjustmentEntry[];
  recommendation: 'EXECUTE' | 'REVIEW';
}

/**
 * 量化社交意图
 * 使用 AI 将 extractedIntents[] 字符串数组转换为结构化的 SocialBeneficiary[]
 */
export const quantifySocialIntents = async (
  extractedIntents: string[],
  lang: string = 'en'
): Promise<SocialBeneficiary[]> => {
  console.log('⚖️ [WeightedDistribution] Quantifying social intents...');
  
  if (extractedIntents.length === 0) {
    return [];
  }

  try {
    const systemPrompt = `You are an AI that converts natural language user intentions into structured beneficiary allocations.

Given a list of user intentions extracted from their social media, convert each into a structured action.

Rules:
1. For "give all to X" type intents → X gets 100%, action: ADD
2. For "exclude X" type intents → X gets 0%, action: REMOVE  
3. For "my friend/partner/family X" → X gets 10-20%, action: ADD
4. Estimate trustScore 0-100 based on how explicit the intent is
5. Identify relationship type (friend, family, partner, charity, etc.)

Output in ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}.

Return a JSON array with objects containing:
- name: string (person/entity name)
- percentage: number (0-100)
- intent: string (original intent text)
- relationship: string (friend, family, partner, charity, unknown)
- trustScore: number (0-100)
- action: "ADD" | "REMOVE" | "ADJUST"`;

    const userPrompt = `Convert these intentions to structured beneficiaries:
${extractedIntents.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Return ONLY valid JSON array.`;

    const result = await callAIAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], true);

    const parsed = JSON.parse(result);
    const socialBeneficiaries = Array.isArray(parsed) ? parsed : (parsed.beneficiaries || []);
    
    console.log(`✅ [WeightedDistribution] Quantified ${socialBeneficiaries.length} social intents`);
    return socialBeneficiaries as SocialBeneficiary[];
  } catch (error: any) {
    console.error('❌ [WeightedDistribution] Quantification failed:', error.message);
    return [];
  }
};

/**
 * 计算加权分配
 * 当意图匹配度 < 50% 时，结合遗嘱和社交意图进行加权分配
 * 
 * 公式: P_final[i] = P_will[i] × W_will + P_social[i] × W_social
 * 其中: W_will = max(intentMatch / 100, 0.20), W_social = 1 - W_will
 * 
 * 保护机制:
 * - 遗嘱权重最小 20%
 * - 社交新增受益人上限 30%
 */
export const calculateWeightedDistribution = async (
  willBeneficiaries: Beneficiary[],
  extractedIntents: string[],
  intentMatch: number,
  lang: string = 'en'
): Promise<WeightedDistributionResult> => {
  console.log(`⚖️ [WeightedDistribution] Starting weighted calculation (intentMatch: ${intentMatch}%)...`);
  
  // 1. 计算权重 (固定: 遗嘱权重80%, 社交权重20%)
  const willWeight = 0.80;
  const socialWeight = 0.20;
  
  console.log(`    遗嘱权重: ${(willWeight * 100).toFixed(0)}% (固定)`);
  console.log(`    社交权重: ${(socialWeight * 100).toFixed(0)}%`);
  
  // 2. 量化社交意图
  const socialBeneficiaries = await quantifySocialIntents(extractedIntents, lang);
  
  // 3. 构建调整日志
  const adjustmentLog: AdjustmentEntry[] = [];
  const adjustedBeneficiaries: Beneficiary[] = [];
  
  // 3.1 处理原遗嘱受益人
  for (const wb of willBeneficiaries) {
    // 检查是否被社交意图排除
    const exclusion = socialBeneficiaries.find(
      sb => sb.action === 'REMOVE' && 
      sb.name.toLowerCase().includes(wb.name.toLowerCase())
    );
    
    let adjustedPercentage = wb.percentage * willWeight;
    let reason = `原遗嘱 × ${(willWeight * 100).toFixed(0)}%`;
    let source: 'WILL' | 'SOCIAL' | 'BLEND' = 'WILL';
    
    if (exclusion) {
      // 有排除意图，但由于保护机制，不完全归零
      adjustedPercentage = wb.percentage * willWeight * 0.5; // 再减半
      reason = `社交排除信号 (${exclusion.intent})，保护机制保留 ${(willWeight * 50).toFixed(0)}%`;
      source = 'BLEND';
    }
    
    adjustmentLog.push({
      beneficiary: wb.name,
      originalPercentage: wb.percentage,
      adjustedPercentage: Math.round(adjustedPercentage * 10) / 10,
      reason,
      source
    });
    
    adjustedBeneficiaries.push({
      ...wb,
      percentage: Math.round(adjustedPercentage * 10) / 10,
      reason: `${wb.reason} [调整: ${reason}]`
    });
  }
  
  // 3.2 处理社交新增受益人
  const newFromSocial = socialBeneficiaries.filter(
    sb => sb.action === 'ADD' && 
    !willBeneficiaries.some(wb => wb.name.toLowerCase().includes(sb.name.toLowerCase()))
  );
  
  for (const sb of newFromSocial) {
    // 保护机制: 社交新增受益人上限 30%
    const rawPercentage = sb.percentage * socialWeight;
    const cappedPercentage = Math.min(rawPercentage, 30);
    
    adjustmentLog.push({
      beneficiary: sb.name,
      originalPercentage: 0,
      adjustedPercentage: Math.round(cappedPercentage * 10) / 10,
      reason: `社交新增 (${sb.relationship}): ${sb.intent}`,
      source: 'SOCIAL'
    });
    
    adjustedBeneficiaries.push({
      name: sb.name,
      category: sb.relationship || 'Unknown',
      percentage: Math.round(cappedPercentage * 10) / 10,
      walletAddress: '0x53C1844Af058fE3B3195e49fEC8f97E0a4F87772', // 社交新增受益人指定钱包
      reason: `从社交媒体提取: "${sb.intent}"`
    });
  }
  
  // 4. 归一化到精确 100% (使用最大余数法)
  const normalizeToHundred = (beneficiaries: Beneficiary[]) => {
    const total = beneficiaries.reduce((sum, b) => sum + b.percentage, 0);
    if (total === 0) return;
    
    // 计算精确比例并向下取整到一位小数
    const factor = 100 / total;
    beneficiaries.forEach(b => {
      b.percentage = Math.floor(b.percentage * factor * 10) / 10;
    });
    
    // 计算差额并分配给百分比最大的受益人
    const newTotal = beneficiaries.reduce((sum, b) => sum + b.percentage, 0);
    const diff = Math.round((100 - newTotal) * 10) / 10;
    
    if (diff !== 0 && beneficiaries.length > 0) {
      // 找到百分比最大的受益人，将差额加给他
      const maxIdx = beneficiaries.reduce((maxI, b, i, arr) => 
        b.percentage > arr[maxI].percentage ? i : maxI, 0);
      beneficiaries[maxIdx].percentage = Math.round((beneficiaries[maxIdx].percentage + diff) * 10) / 10;
    }
    
    const finalTotal = beneficiaries.reduce((sum, b) => sum + b.percentage, 0);
    console.log(`    归一化完成: ${total.toFixed(1)}% → ${finalTotal.toFixed(1)}%`);
  };
  
  normalizeToHundred(adjustedBeneficiaries);
  
  // 5. 确定建议
  const recommendation: 'EXECUTE' | 'REVIEW' = 
    socialWeight > 0.5 ? 'REVIEW' : 'EXECUTE';
  
  console.log('📊 [WeightedDistribution] 调整结果:');
  adjustmentLog.forEach(log => {
    console.log(`    ${log.beneficiary}: ${log.originalPercentage}% → ${log.adjustedPercentage}% (${log.source})`);
  });
  
  return {
    adjustedBeneficiaries,
    willWeight,
    socialWeight,
    adjustmentLog,
    recommendation
  };
};
