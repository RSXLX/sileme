/**
 * KitePass API 服务
 * 与后端 KitePass API 交互
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface KitepassDeployResult {
  success: boolean;
  kitepassAddress?: string;
  txHash?: string;
  error?: string;
}

export interface KitepassStatusResult {
  success: boolean;
  address: string;
  balance?: string;
  symbol?: string;
  rules?: any[];
  error?: string;
}

export interface KitepassConfigureResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * 部署 KitePass 合约
 */
export async function deployKitepass(eoaAddress: string): Promise<KitepassDeployResult> {
  try {
    const response = await fetch(`${API_BASE}/api/kitepass/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eoaAddress }),
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to deploy KitePass' };
  }
}

/**
 * 配置 Spending Rules
 */
export async function configureSpendingRules(
  eoaAddress: string,
  kitepassAddress: string
): Promise<KitepassConfigureResult> {
  try {
    const response = await fetch(`${API_BASE}/api/kitepass/configure-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eoaAddress, kitepassAddress }),
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to configure rules' };
  }
}

/**
 * 查询 KitePass 状态
 */
export async function getKitepassStatus(address: string): Promise<KitepassStatusResult> {
  try {
    const response = await fetch(`${API_BASE}/api/kitepass/status/${address}`, {
      method: 'GET',
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, address, error: error.message || 'Failed to get status' };
  }
}

/**
 * 从 KitePass 提取资金
 */
export async function withdrawFromKitepass(
  eoaAddress: string,
  kitepassAddress: string,
  amount: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/kitepass/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eoaAddress, kitepassAddress, amount }),
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to withdraw' };
  }
}
