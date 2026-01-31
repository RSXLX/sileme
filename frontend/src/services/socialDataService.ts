export interface AgentSettings {
  socialApiKey?: string;
  socialApiEndpoint?: string;
  mode: 'MOCK' | 'REAL';
}

export interface SocialPost {
  content: string;
  date: string;
  id: string;
}

export interface SocialSource {
  getPosts(handle: string): Promise<SocialPost[]>;
}

export class MockSocialSource implements SocialSource {
  async getPosts(handle: string): Promise<SocialPost[]> {
    const isCompromised = handle.toLowerCase().includes("hacked");
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return [
      {
        id: 'mock-1',
        content: "Just minted a new NFT.",
        date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
      },
      {
        id: 'mock-2',
        content: "GM everyone.",
        date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
      },
      {
        id: 'mock-3',
        content: "Prices are looking good today.",
        date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
      },
      {
        id: 'mock-4',
        content: isCompromised ? "HELP I LOST MY WALLET" : "Building safely.",
        date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString()
      }
    ];
  }
}

// Demo 环境硬编码配置
const DEMO_CONFIG = {
  RAPIDAPI_KEY: '1afb3a1619mshf23f1c3d558cf18p17cd92jsnf18642c155ee',
  TWITTER_USER_ID: '1926557837527830528', // @crypto_Reeeece
  TWEET_COUNT: 20,
};

/**
 * Demo Twitter data source - 直接使用硬编码 API Key
 * 用于 Hackathon 演示，获取 @crypto_Reeeece 真实推文
 */
export class DemoTwitterSource implements SocialSource {
  async getPosts(handle: string): Promise<SocialPost[]> {
    console.log(`🔍 [DemoTwitter] Fetching ${DEMO_CONFIG.TWEET_COUNT} tweets for @crypto_Reeeece...`);

    try {
      const response = await fetch(
        `https://twitter241.p.rapidapi.com/user-tweets?user=${DEMO_CONFIG.TWITTER_USER_ID}&count=${DEMO_CONFIG.TWEET_COUNT}`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-host': 'twitter241.p.rapidapi.com',
            'x-rapidapi-key': DEMO_CONFIG.RAPIDAPI_KEY,
          }
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Twitter API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      
      // Parse the complex nested Twitter API response
      const entries = data?.result?.timeline?.instructions
        ?.find((i: any) => i.type === 'TimelineAddEntries')?.entries || [];

      const posts: SocialPost[] = [];

      for (const entry of entries) {
        // Handle different entry types
        const tweetResult = entry?.content?.itemContent?.tweet_results?.result;
        if (tweetResult?.legacy?.full_text) {
          posts.push({
            id: tweetResult.rest_id || entry.entryId,
            content: tweetResult.legacy.full_text,
            date: tweetResult.legacy.created_at || new Date().toISOString()
          });
        }
        
        // Handle conversation modules (threads)
        const items = entry?.content?.items;
        if (Array.isArray(items)) {
          for (const item of items) {
            const nestedTweet = item?.item?.itemContent?.tweet_results?.result;
            if (nestedTweet?.legacy?.full_text) {
              posts.push({
                id: nestedTweet.rest_id || item.entryId,
                content: nestedTweet.legacy.full_text,
                date: nestedTweet.legacy.created_at || new Date().toISOString()
              });
            }
          }
        }
      }

      console.log(`✅ [DemoTwitter] Fetched ${posts.length} real tweets`);
      return posts.slice(0, 20); // 返回最多20条

    } catch (error) {
      console.error("❌ [DemoTwitter] Real Twitter fetch failed:", error);
      throw error;
    }
  }
}

/**
 * Real Twitter data source using twitter241.p.rapidapi.com
 * Specifically configured for the Silene demo with @crypto_Reeeece
 */
export class Twitter241SocialSource implements SocialSource {
  private apiKey: string;
  private userId: string;

  constructor(apiKey: string, userId: string) {
    this.apiKey = apiKey;
    this.userId = userId || import.meta.env.VITE_TWITTER_USER_ID || '1926557837527830528';
  }

  async getPosts(handle: string): Promise<SocialPost[]> {
    if (!this.apiKey) {
      throw new Error("RapidAPI Key required for Real Mode");
    }

    console.log(`🔍 [Twitter241] Fetching tweets for user ID: ${this.userId}`);

    try {
      const response = await fetch(
        `https://twitter241.p.rapidapi.com/user-tweets?user=${this.userId}&count=20`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-host': 'twitter241.p.rapidapi.com',
            'x-rapidapi-key': this.apiKey,
          }
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Twitter API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      
      // Parse the complex nested Twitter API response
      const entries = data?.result?.timeline?.instructions
        ?.find((i: any) => i.type === 'TimelineAddEntries')?.entries || [];

      const posts: SocialPost[] = [];

      for (const entry of entries) {
        // Handle different entry types
        const tweetResult = entry?.content?.itemContent?.tweet_results?.result;
        if (tweetResult?.legacy?.full_text) {
          posts.push({
            id: tweetResult.rest_id || entry.entryId,
            content: tweetResult.legacy.full_text,
            date: tweetResult.legacy.created_at || new Date().toISOString()
          });
        }
        
        // Handle conversation modules (threads)
        const items = entry?.content?.items;
        if (Array.isArray(items)) {
          for (const item of items) {
            const nestedTweet = item?.item?.itemContent?.tweet_results?.result;
            if (nestedTweet?.legacy?.full_text) {
              posts.push({
                id: nestedTweet.rest_id || item.entryId,
                content: nestedTweet.legacy.full_text,
                date: nestedTweet.legacy.created_at || new Date().toISOString()
              });
            }
          }
        }
      }

      console.log(`✅ [Twitter241] Fetched ${posts.length} tweets`);
      return posts.slice(0, 10); // Limit to 10 for AI context window

    } catch (error) {
      console.error("❌ [Twitter241] Real Social Scan failed:", error);
      throw error;
    }
  }
}

/**
 * 获取社交数据源
 * Demo 模式下直接使用硬编码 API，无需配置
 */
export const getSocialSource = (settings: AgentSettings): SocialSource => {
  // Demo 模式：始终使用真实 Twitter API
  if (settings.mode === 'REAL') {
    // 优先使用 Demo 硬编码源
    return new DemoTwitterSource();
  }
  return new MockSocialSource();
};

