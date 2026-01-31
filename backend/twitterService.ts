/**
 * Twitter API Service
 * 调用 RapidAPI Twitter API 获取用户的 following 和 followers
 * 硬编码 crypto_Reeeece 账号用于演示
 */

// RapidAPI 配置 (硬编码用于演示)
const RAPIDAPI_CONFIG = {
  host: 'twitter-api45.p.rapidapi.com',
  key: '1afb3a1619mshf23f1c3d558cf18p17cd92jsnf18642c155ee',
  baseUrl: 'https://twitter-api45.p.rapidapi.com',
};

// 演示用固定账号
const DEMO_SCREEN_NAME = 'crypto_Reeeece';

// Twitter 用户数据接口
export interface TwitterUser {
  user_id: string;
  screen_name: string;
  name: string;
  description: string;
  profile_image: string;
  statuses_count: number;
  followers_count: number;
  friends_count: number;
  media_count: number;
}

// 好友数据接口（包含钱包地址）
export interface Friend extends TwitterUser {
  wallet_address: string | null;
  owner_wallet: string;
  created_at: number;
  updated_at: number;
}

/**
 * 获取用户的 Following 列表
 */
async function fetchFollowing(): Promise<TwitterUser[]> {
  const url = `${RAPIDAPI_CONFIG.baseUrl}/following.php?screenname=${DEMO_SCREEN_NAME}`;
  
  console.log(`📡 [Twitter] Fetching following for @${DEMO_SCREEN_NAME}...`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPIDAPI_CONFIG.host,
      'x-rapidapi-key': RAPIDAPI_CONFIG.key,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (data.status !== 'ok' || !data.following) {
    console.warn('⚠️ [Twitter] No following data returned');
    return [];
  }
  
  const users: TwitterUser[] = data.following.map((user: any) => ({
    user_id: user.user_id || '',
    screen_name: user.screen_name || '',
    name: user.name || '',
    description: user.description || '',
    profile_image: user.profile_image || '',
    statuses_count: user.statuses_count || 0,
    followers_count: user.followers_count || 0,
    friends_count: user.friends_count || 0,
    media_count: user.media_count || 0,
  }));
  
  console.log(`✅ [Twitter] Found ${users.length} following`);
  return users;
}

/**
 * 获取用户的 Followers 列表
 */
async function fetchFollowers(): Promise<TwitterUser[]> {
  const url = `${RAPIDAPI_CONFIG.baseUrl}/followers.php?screenname=${DEMO_SCREEN_NAME}&blue_verified=0`;
  
  console.log(`📡 [Twitter] Fetching followers for @${DEMO_SCREEN_NAME}...`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPIDAPI_CONFIG.host,
      'x-rapidapi-key': RAPIDAPI_CONFIG.key,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (data.status !== 'ok' || !data.followers) {
    console.warn('⚠️ [Twitter] No followers data returned');
    return [];
  }
  
  const users: TwitterUser[] = data.followers.map((user: any) => ({
    user_id: user.user_id || '',
    screen_name: user.screen_name || '',
    name: user.name || '',
    description: user.description || '',
    profile_image: user.profile_image || '',
    statuses_count: user.statuses_count || 0,
    followers_count: user.followers_count || 0,
    friends_count: user.friends_count || 0,
    media_count: user.media_count || 0,
  }));
  
  console.log(`✅ [Twitter] Found ${users.length} followers`);
  return users;
}

/**
 * 计算互关好友（Following ∩ Followers）
 * 好友 = 我关注的人中，同时也关注我的人
 */
export async function calculateFriends(ownerWallet: string): Promise<Friend[]> {
  console.log(`🤝 [Twitter] Calculating friends for wallet ${ownerWallet.slice(0, 10)}...`);
  
  // 并行获取 following 和 followers
  const [following, followers] = await Promise.all([
    fetchFollowing(),
    fetchFollowers(),
  ]);
  
  // 创建 followers 的 user_id 集合用于快速查找
  const followerIds = new Set(followers.map(u => u.user_id));
  
  // 找出交集：我关注的人中，同时也关注我的人
  const mutualFriends = following.filter(user => followerIds.has(user.user_id));
  
  console.log(`✅ [Twitter] Found ${mutualFriends.length} mutual friends`);
  
  // 转换为 Friend 对象
  const now = Date.now();
  const friends: Friend[] = mutualFriends.map(user => ({
    ...user,
    wallet_address: null,
    owner_wallet: ownerWallet.toLowerCase(),
    created_at: now,
    updated_at: now,
  }));
  
  return friends;
}

/**
 * 获取好友列表（带缓存逻辑）
 * 如果数据库有缓存，直接返回；否则从 Twitter API 获取
 */
export async function getFriendsWithCache(
  ownerWallet: string,
  getCachedFriends: (wallet: string) => Friend[],
  saveFriends: (friends: Friend[]) => void,
  forceRefresh: boolean = false
): Promise<{ friends: Friend[]; cached: boolean }> {
  
  // 检查缓存
  if (!forceRefresh) {
    const cached = getCachedFriends(ownerWallet);
    if (cached.length > 0) {
      console.log(`📦 [Twitter] Using cached friends (${cached.length} entries)`);
      return { friends: cached, cached: true };
    }
  }
  
  // 从 Twitter API 获取
  const friends = await calculateFriends(ownerWallet);
  
  // 保存到数据库
  if (friends.length > 0) {
    saveFriends(friends);
    console.log(`💾 [Twitter] Saved ${friends.length} friends to database`);
  }
  
  return { friends, cached: false };
}
