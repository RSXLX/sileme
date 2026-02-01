/**
 * Kite AA SDK Service
 * 封装 gokite-aa-sdk 调用，运行在 Node.js 环境
 */

import { GokiteAASDK, UserOperationRequest, SignFunction } from 'gokite-aa-sdk';
import { ethers, Wallet } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Kite 配置
const KITE_CONFIG = {
  network: 'kite_testnet',
  rpc: process.env.KITE_RPC || 'https://rpc-testnet.gokite.ai',
  bundler: process.env.KITE_BUNDLER || 'https://bundler-service.staging.gokite.ai/rpc/',
  settlementToken: process.env.SETTLEMENT_TOKEN || '0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63',
  chainId: Number(process.env.KITE_CHAIN_ID) || 2368,
};

// GokiteAASDK 实例缓存
let kiteAAInstance: GokiteAASDK | null = null;

/**
 * 初始化 GokiteAASDK 实例
 */
export const initKiteAA = (): GokiteAASDK => {
  if (!kiteAAInstance) {
    kiteAAInstance = new GokiteAASDK(
      KITE_CONFIG.network,
      KITE_CONFIG.rpc,
      KITE_CONFIG.bundler
    );
    console.log('✅ GokiteAASDK initialized');
  }
  return kiteAAInstance;
};

/**
 * 创建签名函数（用于 AA Wallet 操作）
 * @param privateKey 用户私钥（后端临时持有，仅用于演示）
 */
export const createSignFunction = (privateKey: string): SignFunction => {
  const wallet = new Wallet(privateKey);
  
  return async (userOpHash: string): Promise<string> => {
    // 签名 userOpHash（bytes32 格式）
    const signature = await wallet.signMessage(ethers.getBytes(userOpHash));
    return signature;
  };
};

/**
 * 获取 AA Wallet 地址
 * @param ownerAddress EOA 地址
 * @param salt 可选的 salt 值
 */
export const getAAWalletAddress = async (ownerAddress: string, salt?: bigint): Promise<string> => {
  const kiteAA = initKiteAA();
  
  console.log(`📍 Calculating AA address for owner: ${ownerAddress}`);
  
  try {
    // 使用 SDK 的 getAccountAddress 方法计算 AA 地址
    // FIX: Use Salt=1 to rotate address (Old address 0x3CFd... points to wrong impl)
    const defaultSalt = BigInt(1);
    const aaAddress = kiteAA.getAccountAddress(ownerAddress, salt ?? defaultSalt);
    console.log(`✅ AA Wallet address: ${aaAddress} (Salt: ${salt ?? defaultSalt})`);
    return aaAddress;
  } catch (error) {
    console.error('❌ Failed to get AA address:', error);
    throw error;
  }
};

/**
 * 检查账户是否已部署
 */
export const isAccountDeployed = async (accountAddress: string): Promise<boolean> => {
  const kiteAA = initKiteAA();
  return await kiteAA.isAccountDeloyed(accountAddress);
};

/**
 * 发送 UserOperation
 */
export interface SendOperationParams {
  ownerAddress: string;
  target: string;
  value?: bigint;
  callData: string;
  privateKey: string;
  salt?: bigint;
}

export const sendUserOperation = async (
  params: SendOperationParams
): Promise<{ success: boolean; userOpHash?: string; error?: string }> => {
  const kiteAA = initKiteAA();
  
  console.log(`📤 Sending UserOperation from ${params.ownerAddress}`);
  console.log(`   - Target: ${params.target}`);
  console.log(`   - Value: ${params.value?.toString() ?? '0'}`);
  
  try {
    const request: UserOperationRequest = {
      target: params.target,
      value: params.value ?? BigInt(0),
      callData: params.callData,
      paymasterAndData: '0x', // Force Self-Pay to bypass AA33 error
    } as any;
    
    const signFn = createSignFunction(params.privateKey);
    
    const userOpHash = await kiteAA.sendUserOperation(
      params.ownerAddress,
      request,
      signFn,
      params.salt ?? BigInt(0)
    );
    
    console.log('✅ UserOperation sent:', userOpHash);
    
    return {
      success: true,
      userOpHash,
    };
  } catch (error: any) {
    console.error('❌ Failed to send UserOperation:', error);
    return {
      success: false,
      error: error.message || 'Failed to send UserOperation',
    };
  }
};

/**
 * 发送 UserOperation 并等待完成
 */
export const sendUserOperationAndWait = async (
  params: SendOperationParams
): Promise<{ success: boolean; userOpHash?: string; transactionHash?: string; status?: string; error?: string }> => {
  const kiteAA = initKiteAA();
  
  console.log(`📤 Sending UserOperation (with wait) from ${params.ownerAddress}`);
  
  try {
    const request: UserOperationRequest = {
      target: params.target,
      value: params.value ?? BigInt(0),
      callData: params.callData,
      paymasterAndData: '0x', // Force Self-Pay
    } as any;
    
    const signFn = createSignFunction(params.privateKey);
    
    const result = await kiteAA.sendUserOperationAndWait(
      params.ownerAddress,
      request,
      signFn,
      params.salt ?? BigInt(0)
    );
    
    console.log('✅ UserOperation completed:', result);
    console.log(`   📋 userOpHash (Bundler): ${result.userOpHash}`);
    console.log(`   🔗 transactionHash (On-chain): ${result.status?.transactionHash || 'N/A'}`);
    
    return {
      success: result.status.status === 'success',
      userOpHash: result.userOpHash,
      transactionHash: result.status?.transactionHash,  // 链上交易哈希
      status: result.status.status,
    };
  } catch (error: any) {
    console.error('❌ Failed to send UserOperation:', error);
    return {
      success: false,
      error: error.message || 'Failed to send UserOperation',
    };
  }
};


/**
 * 估算交易费用
 */
export const estimateUserOperation = async (
  ownerAddress: string,
  target: string,
  value?: bigint,
  callData?: string
) => {
  const kiteAA = initKiteAA();
  
  const request: UserOperationRequest = {
    target,
    value: value ?? BigInt(0),
    callData: callData || '0x',
    paymasterAndData: '0x', // Force Self-Pay
  } as any;
  
  return await kiteAA.estimateUserOperation(ownerAddress, request);
};

/**
 * 获取配置信息
 */
export const getConfig = () => ({
  ...KITE_CONFIG,
  version: '1.0.0',
});
