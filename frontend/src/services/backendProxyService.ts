/**
 * Backend Proxy Service
 * 前端调用后端 SDK API
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface AAAddressResponse {
  success: boolean;
  ownerAddress: string;
  aaAddress: string;
  error?: string;
}

export interface SpendingRulesResponse {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface VaultDeployResponse {
  success: boolean;
  vaultAddress?: string;
  error?: string;
}

export interface BackendConfig {
  network: string;
  rpc: string;
  chainId: number;
  settlementToken: string;
  version: string;
}

/**
 * 检查后端健康状态
 */
export const checkBackendHealth = async (): Promise<{ status: string; config: BackendConfig }> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`Backend health check failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('❌ Backend health check failed:', error);
    throw error;
  }
};

/**
 * 获取 Custody Wallet 地址（用于 ERC-20 approve）
 */
export const getCustodyAddress = async (): Promise<string> => {
  try {
    console.log(`📡 [Backend] Getting custody address for approve...`);
    
    const response = await fetch(`${BACKEND_URL}/api/custody/address`);
    if (!response.ok) {
      throw new Error(`Failed to get custody address: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }
    
    console.log(`✅ [Backend] Custody address: ${data.address}`);
    return data.address;
  } catch (error) {
    console.error('❌ Failed to get custody address:', error);
    throw error;
  }
};

/**
 * 获取 AA Wallet 地址
 * @param ownerAddress EOA 地址
 */
export const getAAAddressFromBackend = async (ownerAddress: string): Promise<AAAddressResponse> => {
  try {
    console.log(`📡 [Backend] Getting AA address for ${ownerAddress}...`);
    
    const response = await fetch(`${BACKEND_URL}/api/aa/address`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerAddress }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ [Backend] AA Address: ${data.aaAddress}`);
    } else {
      console.error(`❌ [Backend] Error: ${data.error}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('❌ [Backend] Request failed:', error);
    return {
      success: false,
      ownerAddress,
      aaAddress: ownerAddress, // Fallback to EOA
      error: error.message || 'Backend request failed',
    };
  }
};

/**
 * 配置 Spending Rules
 * ⚠️ 演示用：生产环境不应通过 API 传递私钥
 */
export const configureSpendingRulesViaBackend = async (params: {
  aaAddress: string;
  privateKey: string;
  dailyLimit?: string;
  perTxLimit?: string;
  validUntil?: number;
}): Promise<SpendingRulesResponse> => {
  try {
    console.log(`📡 [Backend] Configuring spending rules for ${params.aaAddress}...`);
    
    const response = await fetch(`${BACKEND_URL}/api/aa/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ [Backend] Spending rules configured: ${data.txHash}`);
    } else {
      console.error(`❌ [Backend] Error: ${data.error}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('❌ [Backend] Request failed:', error);
    return {
      success: false,
      error: error.message || 'Backend request failed',
    };
  }
};

/**
 * 部署 Vault
 * ⚠️ 演示用：生产环境不应通过 API 传递私钥
 */
export const deployVaultViaBackend = async (params: {
  aaAddress: string;
  privateKey: string;
}): Promise<VaultDeployResponse> => {
  try {
    console.log(`📡 [Backend] Deploying vault for ${params.aaAddress}...`);
    
    const response = await fetch(`${BACKEND_URL}/api/aa/vault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ [Backend] Vault deployed: ${data.vaultAddress}`);
    } else {
      console.error(`❌ [Backend] Error: ${data.error}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('❌ [Backend] Request failed:', error);
    return {
      success: false,
      error: error.message || 'Backend request failed',
    };
  }
};

/**
 * 检查后端是否可用
 */
export const isBackendAvailable = async (): Promise<boolean> => {
  try {
    await checkBackendHealth();
    return true;
  } catch {
    return false;
  }
};

// ==================== Will Authorization API ====================

export interface WillBeneficiary {
  address: string;
  percentage: number;
  name: string;
}

export interface WillAuthorizationParams {
  owner: string;
  beneficiaries: WillBeneficiary[];
  totalAmount: string;
  validUntil: number;
  signature: string;
  useStablecoin?: boolean;
  spendingLimits?: {
    perTxLimit?: string;
    dailyLimit?: string;
  };
}

export interface WillAuthorizationResponse {
  success: boolean;
  willId?: string;
  message?: string;
  error?: string;
}

export interface WillStatusResponse {
  success: boolean;
  will?: {
    willId: string;
    owner: string;
    beneficiaries: WillBeneficiary[];
    totalAmount: string;
    validUntil: number;
    createdAt: number;
    status: 'pending' | 'executed' | 'expired';
  };
  error?: string;
}

export interface WillExecutionResult {
  beneficiary: string;
  txHash: string;
  amount: string;
  status: 'confirmed' | 'failed';
  tokenSymbol?: string;
  error?: string;
}

export interface WillExecuteResponse {
  success: boolean;
  transactions?: WillExecutionResult[];
  deathTxHash?: string; // 死亡声明交易哈希
  message?: string;
  error?: string;
}

export interface WillConfigResponse {
  success: boolean;
  domain?: {
    name: string;
    version: string;
    chainId: number;
  };
  types?: object;
  settlementToken?: string;
  defaultLimits?: {
    perTxLimit: string;
    dailyLimit: string;
  };
  error?: string;
}

/**
 * 获取 Will EIP-712 配置
 */
export const getWillConfig = async (): Promise<WillConfigResponse> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/will/config`);
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 提交遗嘱授权
 */
export const submitWillAuthorization = async (params: WillAuthorizationParams): Promise<WillAuthorizationResponse> => {
  try {
    console.log(`📡 [Will] Submitting authorization for ${params.owner}...`);
    
    const response = await fetch(`${BACKEND_URL}/api/will/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ [Will] Authorization stored: ${data.willId}`);
    } else {
      console.error(`❌ [Will] Error: ${data.error}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('❌ [Will] Submit authorization failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 获取遗嘱状态
 */
export const getWillStatusFromBackend = async (owner: string): Promise<WillStatusResponse> => {
  try {
    console.log(`📡 [Will] Getting status for ${owner}...`);
    
    const response = await fetch(`${BACKEND_URL}/api/will/status/${encodeURIComponent(owner)}`);
    const data = await response.json();
    
    return data;
  } catch (error: any) {
    console.error('❌ [Will] Get status failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 执行遗嘱（后端代发交易）
 * @param willId 遗嘱ID
 * @param owner 遗嘱所有者地址
 * @param overrideBeneficiaries 可选：覆盖的受益人列表（用于 AI 加权调整后的分配）
 */
export const executeWillViaBackend = async (
  willId: string, 
  owner: string,
  overrideBeneficiaries?: WillBeneficiary[]
): Promise<WillExecuteResponse> => {
  try {
    console.log(`📡 [Will] Executing will ${willId}...`);
    if (overrideBeneficiaries) {
      console.log(`   📊 Using override beneficiaries: ${overrideBeneficiaries.length} recipients`);
    }
    
    const response = await fetch(`${BACKEND_URL}/api/will/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ willId, owner, overrideBeneficiaries }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ [Will] Executed successfully:`, data.transactions);
    } else {
      console.error(`❌ [Will] Execution failed: ${data.error}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('❌ [Will] Execute failed:', error);
    return { success: false, error: error.message };
  }
};
