/**
 * WillVault Service
 * 前端与 WillVault 智能合约交互
 */

import { ethers, Contract, BrowserProvider, Signer } from 'ethers';

// Kite Testnet 配置
const KITE_RPC = 'https://rpc-testnet.gokite.ai';
const EXPLORER_URL = 'https://testnet.kitescan.ai';

// WillVault ABI (简化版)
const WILL_VAULT_ABI = [
  "constructor()",
  "function deposit() external payable",
  "function setBeneficiaries(tuple(address wallet, uint256 percentage, string name)[] memory _beneficiaries) external",
  "function setInactivityPeriod(uint256 _seconds) external",
  "function seal() external",
  "function heartbeat() external",
  "function execute() external",
  "function getBalance() external view returns (uint256)",
  "function getBeneficiaryCount() external view returns (uint256)",
  "function getStatus() external view returns (bool isSealed, bool isExecuted, uint256 balance, uint256 unlockTime, uint256 lastHeartbeat, uint256 timeUntilUnlock)",
  "function canExecute() external view returns (bool)",
  "function owner() external view returns (address)",
  "event Deposited(address indexed from, uint256 amount)",
  "event WillSealed(uint256 unlockTime)",
  "event Heartbeat(uint256 timestamp)",
  "event WillExecuted(uint256 totalDistributed)",
  "event FundsDistributed(address indexed beneficiary, uint256 amount)"
];

// 受益人结构
export interface VaultBeneficiary {
  wallet: string;
  percentage: number;
  name: string;
}

// 金库状态
export interface VaultStatus {
  isSealed: boolean;
  isExecuted: boolean;
  balance: string;
  unlockTime: number;
  lastHeartbeat: number;
  timeUntilUnlock: number;
}

/**
 * 获取 WillVault 合约实例
 */
export const getVaultContract = (
  vaultAddress: string,
  signerOrProvider: Signer | BrowserProvider
): Contract => {
  return new Contract(vaultAddress, WILL_VAULT_ABI, signerOrProvider);
};

/**
 * 存入资金到金库
 */
export const depositToVault = async (
  vaultAddress: string,
  amount: string,
  signer: Signer
): Promise<{ success: boolean; txHash?: string; error?: string }> => {
  try {
    console.log(`💰 Depositing ${amount} wei to vault ${vaultAddress}...`);
    
    const vault = getVaultContract(vaultAddress, signer);
    const tx = await vault.deposit({ value: BigInt(amount) });
    
    console.log(`⏳ TX sent: ${tx.hash}`);
    await tx.wait();
    
    console.log(`✅ Deposit confirmed: ${tx.hash}`);
    return {
      success: true,
      txHash: tx.hash,
    };
  } catch (error: any) {
    console.error('❌ Deposit failed:', error);
    return {
      success: false,
      error: error.message || 'Deposit failed',
    };
  }
};

/**
 * 设置受益人
 */
export const setBeneficiaries = async (
  vaultAddress: string,
  beneficiaries: VaultBeneficiary[],
  signer: Signer
): Promise<{ success: boolean; txHash?: string; error?: string }> => {
  try {
    console.log(`👥 Setting ${beneficiaries.length} beneficiaries...`);
    
    const vault = getVaultContract(vaultAddress, signer);
    const tx = await vault.setBeneficiaries(beneficiaries);
    
    await tx.wait();
    
    console.log(`✅ Beneficiaries set: ${tx.hash}`);
    return {
      success: true,
      txHash: tx.hash,
    };
  } catch (error: any) {
    console.error('❌ Set beneficiaries failed:', error);
    return {
      success: false,
      error: error.message || 'Set beneficiaries failed',
    };
  }
};

/**
 * 封存遗嘱
 */
export const sealVault = async (
  vaultAddress: string,
  signer: Signer
): Promise<{ success: boolean; txHash?: string; error?: string }> => {
  try {
    console.log(`🔏 Sealing vault ${vaultAddress}...`);
    
    const vault = getVaultContract(vaultAddress, signer);
    const tx = await vault.seal();
    
    await tx.wait();
    
    console.log(`✅ Vault sealed: ${tx.hash}`);
    return {
      success: true,
      txHash: tx.hash,
    };
  } catch (error: any) {
    console.error('❌ Seal failed:', error);
    return {
      success: false,
      error: error.message || 'Seal failed',
    };
  }
};

/**
 * 发送心跳
 */
export const sendHeartbeat = async (
  vaultAddress: string,
  signer: Signer
): Promise<{ success: boolean; txHash?: string; error?: string }> => {
  try {
    console.log(`💓 Sending heartbeat to vault ${vaultAddress}...`);
    
    const vault = getVaultContract(vaultAddress, signer);
    const tx = await vault.heartbeat();
    
    await tx.wait();
    
    console.log(`✅ Heartbeat sent: ${tx.hash}`);
    return {
      success: true,
      txHash: tx.hash,
    };
  } catch (error: any) {
    console.error('❌ Heartbeat failed:', error);
    return {
      success: false,
      error: error.message || 'Heartbeat failed',
    };
  }
};

/**
 * 执行遗嘱分配
 */
export const executeVault = async (
  vaultAddress: string,
  signer: Signer
): Promise<{ success: boolean; txHash?: string; error?: string }> => {
  try {
    console.log(`☠️ Executing vault ${vaultAddress}...`);
    
    const vault = getVaultContract(vaultAddress, signer);
    const tx = await vault.execute();
    
    await tx.wait();
    
    console.log(`✅ Vault executed: ${tx.hash}`);
    return {
      success: true,
      txHash: tx.hash,
    };
  } catch (error: any) {
    console.error('❌ Execute failed:', error);
    return {
      success: false,
      error: error.message || 'Execute failed',
    };
  }
};

/**
 * 获取金库状态
 */
export const getVaultStatus = async (
  vaultAddress: string,
  provider: BrowserProvider
): Promise<VaultStatus> => {
  const vault = getVaultContract(vaultAddress, provider);
  
  const [isSealed, isExecuted, balance, unlockTime, lastHeartbeat, timeUntilUnlock] = 
    await vault.getStatus();
  
  return {
    isSealed,
    isExecuted,
    balance: balance.toString(),
    unlockTime: Number(unlockTime),
    lastHeartbeat: Number(lastHeartbeat),
    timeUntilUnlock: Number(timeUntilUnlock),
  };
};

/**
 * 检查是否可以执行
 */
export const canExecuteVault = async (
  vaultAddress: string,
  provider: BrowserProvider
): Promise<boolean> => {
  const vault = getVaultContract(vaultAddress, provider);
  return await vault.canExecute();
};

/**
 * 获取金库余额
 */
export const getVaultBalance = async (
  vaultAddress: string,
  provider: BrowserProvider
): Promise<string> => {
  const vault = getVaultContract(vaultAddress, provider);
  const balance = await vault.getBalance();
  return balance.toString();
};

/**
 * 获取 Explorer URL
 */
export const getVaultExplorerUrl = (vaultAddress: string): string => {
  return `${EXPLORER_URL}/address/${vaultAddress}`;
};
