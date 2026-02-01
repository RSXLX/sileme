/**
 * Silene Backend Server
 * Express API 代理，运行 gokite-aa-sdk
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import {
  getAAWalletAddress,
  getConfig,
  createSignFunction,
  sendUserOperation,
  sendUserOperationAndWait,
  estimateUserOperation,
  isAccountDeployed,
} from './kiteSDKService.js';
import {
  storeWillAuthorization,
  getWillStatus,
  executeWill,
  WILL_CONSTANTS,
} from './willService.js';
import {
  deployKitepass,
  configureSpendingRules,
  viewSpendingRules,
  getVaultBalance,
  withdrawFunds,
  getDefaultWillSpendingRules,
} from './kitepassService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    config: getConfig(),
  });
});

/**
 * 获取 Custody Wallet 地址（用于前端 ERC-20 approve）
 * GET /api/custody/address
 */
app.get('/api/custody/address', (req, res) => {
  try {
    const custodyPrivateKey = process.env.CUSTODY_PRIVATE_KEY;
    if (!custodyPrivateKey) {
      return res.status(500).json({
        success: false,
        error: 'Custody wallet not configured',
      });
    }
    
    const custodyWallet = new ethers.Wallet(custodyPrivateKey);
    console.log(`📍 [Custody] Address requested: ${custodyWallet.address}`);
    
    res.json({
      success: true,
      address: custodyWallet.address,
    });
  } catch (error: any) {
    console.error('Failed to get custody address:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 获取 AA Wallet 地址
 * POST /api/aa/address
 * Body: { ownerAddress: string, salt?: string }
 */
app.post('/api/aa/address', async (req, res) => {
  try {
    const { ownerAddress, salt } = req.body;
    
    if (!ownerAddress) {
      return res.status(400).json({ error: 'ownerAddress is required' });
    }
    
    console.log(`📥 Request: Get AA address for ${ownerAddress}`);
    
    const saltBigInt = salt ? BigInt(salt) : undefined;
    const aaAddress = await getAAWalletAddress(ownerAddress, saltBigInt);
    
    res.json({
      success: true,
      ownerAddress,
      aaAddress,
    });
  } catch (error: any) {
    console.error('Error getting AA address:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AA address',
    });
  }
});

/**
 * 检查账户是否已部署
 * POST /api/aa/deployed
 * Body: { accountAddress: string }
 */
app.post('/api/aa/deployed', async (req, res) => {
  try {
    const { accountAddress } = req.body;
    
    if (!accountAddress) {
      return res.status(400).json({ error: 'accountAddress is required' });
    }
    
    console.log(`📥 Request: Check if account is deployed: ${accountAddress}`);
    
    const deployed = await isAccountDeployed(accountAddress);
    
    res.json({
      success: true,
      accountAddress,
      deployed,
    });
  } catch (error: any) {
    console.error('Error checking deployment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check deployment',
    });
  }
});

/**
 * 发送 UserOperation
 * POST /api/aa/send
 * Body: { ownerAddress, target, value?, callData, privateKey, salt? }
 */
app.post('/api/aa/send', async (req, res) => {
  try {
    const { ownerAddress, target, value, callData, privateKey, salt } = req.body;
    
    if (!ownerAddress || !target || !privateKey) {
      return res.status(400).json({ error: 'ownerAddress, target, and privateKey are required' });
    }
    
    console.log(`📥 Request: Send UserOperation from ${ownerAddress} to ${target}`);
    
    const result = await sendUserOperation({
      ownerAddress,
      target,
      value: value ? BigInt(value) : undefined,
      callData: callData || '0x',
      privateKey,
      salt: salt ? BigInt(salt) : undefined,
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error sending UserOperation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send UserOperation',
    });
  }
});

/**
 * 发送 UserOperation 并等待完成
 * POST /api/aa/sendAndWait
 * Body: { ownerAddress, target, value?, callData, privateKey, salt? }
 */
app.post('/api/aa/sendAndWait', async (req, res) => {
  try {
    const { ownerAddress, target, value, callData, privateKey, salt } = req.body;
    
    if (!ownerAddress || !target || !privateKey) {
      return res.status(400).json({ error: 'ownerAddress, target, and privateKey are required' });
    }
    
    console.log(`📥 Request: Send UserOperation (with wait) from ${ownerAddress} to ${target}`);
    
    const result = await sendUserOperationAndWait({
      ownerAddress,
      target,
      value: value ? BigInt(value) : undefined,
      callData: callData || '0x',
      privateKey,
      salt: salt ? BigInt(salt) : undefined,
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error sending UserOperation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send UserOperation',
    });
  }
});

/**
 * 估算交易费用
 * POST /api/aa/estimate
 * Body: { ownerAddress, target, value?, callData? }
 */
app.post('/api/aa/estimate', async (req, res) => {
  try {
    const { ownerAddress, target, value, callData } = req.body;
    
    if (!ownerAddress || !target) {
      return res.status(400).json({ error: 'ownerAddress and target are required' });
    }
    
    console.log(`📥 Request: Estimate UserOperation for ${ownerAddress}`);
    
    const estimate = await estimateUserOperation(
      ownerAddress,
      target,
      value ? BigInt(value) : undefined,
      callData
    );
    
    // 序列化 BigInt 值为字符串
    const serializedEstimate = JSON.parse(JSON.stringify(estimate, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    ));
    
    res.json({
      success: true,
      estimate: serializedEstimate,
    });
  } catch (error: any) {
    console.error('Error estimating UserOperation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to estimate UserOperation',
    });
  }
});

// ==================== Will Authorization API ====================

/**
 * 获取 Will EIP-712 配置
 * GET /api/will/config
 */
app.get('/api/will/config', (req, res) => {
  res.json({
    success: true,
    domain: WILL_CONSTANTS.DOMAIN,
    types: WILL_CONSTANTS.TYPES,
    settlementToken: WILL_CONSTANTS.SETTLEMENT_TOKEN,
    defaultLimits: WILL_CONSTANTS.DEFAULT_LIMITS,
  });
});

/**
 * 存储遗嘱授权
 * POST /api/will/authorize
 * Body: { owner, beneficiaries, totalAmount, validUntil, signature }
 */
app.post('/api/will/authorize', async (req, res) => {
  try {
    const { owner, beneficiaries, totalAmount, validUntil, signature, useStablecoin, spendingLimits } = req.body;
    
    if (!owner || !beneficiaries || !totalAmount || !validUntil || !signature) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: owner, beneficiaries, totalAmount, validUntil, signature' 
      });
    }
    
    console.log(`📥 [Will] Authorize request from ${owner}`);
    console.log(`   💎 Token: ${useStablecoin ? 'Stablecoin' : 'Native KITE'}`);
    
    const result = storeWillAuthorization(owner, beneficiaries, totalAmount, validUntil, signature, useStablecoin ?? false, spendingLimits);
    
    if (result.success) {
      res.json({
        success: true,
        willId: result.willId,
        message: 'Authorization stored successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error('Error storing will authorization:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to store authorization',
    });
  }
});

/**
 * 获取遗嘱状态
 * GET /api/will/status/:owner
 */
app.get('/api/will/status/:owner', (req, res) => {
  try {
    const { owner } = req.params;
    
    console.log(`📥 [Will] Status request for ${owner}`);
    
    const will = getWillStatus(owner);
    
    if (will) {
      res.json({
        success: true,
        will: {
          willId: will.willId,
          owner: will.owner,
          beneficiaries: will.beneficiaries,
          totalAmount: will.totalAmount,
          validUntil: will.validUntil,
          createdAt: will.createdAt,
          status: will.status,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No will found for this owner',
      });
    }
  } catch (error: any) {
    console.error('Error getting will status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get will status',
    });
  }
});

/**
 * 执行遗嘱
 * POST /api/will/execute
 * Body: { willId, owner, overrideBeneficiaries? }
 */
app.post('/api/will/execute', async (req, res) => {
  try {
    const { willId, owner, overrideBeneficiaries } = req.body;
    
    if (!willId || !owner) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: willId, owner' 
      });
    }
    
    const custodyPrivateKey = process.env.CUSTODY_PRIVATE_KEY;
    if (!custodyPrivateKey) {
      return res.status(500).json({
        success: false,
        error: 'Custody wallet not configured',
      });
    }
    
    console.log(`📥 [Will] Execute request for ${willId}`);
    if (overrideBeneficiaries) {
      console.log(`   📊 Using override beneficiaries: ${overrideBeneficiaries.length} recipients`);
    }
    
    const result = await executeWill(willId, owner, custodyPrivateKey, overrideBeneficiaries);
    
    if (result.success) {
      res.json({
        success: true,
        transactions: result.transactions,
        deathTxHash: result.deathTxHash, // 死亡声明交易哈希
        message: 'Will executed successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error('Error executing will:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute will',
    });
  }
});

// ==================== KitePass API (ClientAgentVault) ====================

/**
 * 部署 KitePass 合约
 * POST /api/kitepass/deploy
 * Body: { eoaAddress: string }
 */
app.post('/api/kitepass/deploy', async (req, res) => {
  try {
    const { eoaAddress } = req.body;
    
    if (!eoaAddress) {
      return res.status(400).json({
        success: false,
        error: 'eoaAddress is required',
      });
    }
    
    const custodyPrivateKey = process.env.CUSTODY_PRIVATE_KEY;
    if (!custodyPrivateKey) {
      return res.status(500).json({
        success: false,
        error: 'Custody wallet not configured',
      });
    }
    
    console.log(`🚀 [KitePass] Deploy request for EOA: ${eoaAddress}`);
    
    const result = await deployKitepass(eoaAddress, custodyPrivateKey);
    res.json(result);
  } catch (error: any) {
    console.error('Error deploying KitePass:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to deploy KitePass',
    });
  }
});

/**
 * 配置 Spending Rules
 * POST /api/kitepass/configure-rules
 * Body: { eoaAddress: string, kitepassAddress: string, rules?: SpendingRule[] }
 */
app.post('/api/kitepass/configure-rules', async (req, res) => {
  try {
    const { eoaAddress, kitepassAddress, rules } = req.body;
    
    if (!eoaAddress || !kitepassAddress) {
      return res.status(400).json({
        success: false,
        error: 'eoaAddress and kitepassAddress are required',
      });
    }
    
    const custodyPrivateKey = process.env.CUSTODY_PRIVATE_KEY;
    if (!custodyPrivateKey) {
      return res.status(500).json({
        success: false,
        error: 'Custody wallet not configured',
      });
    }
    
    console.log(`⚙️ [KitePass] Configure rules for: ${kitepassAddress}`);
    
    const result = await configureSpendingRules(
      eoaAddress,
      kitepassAddress,
      custodyPrivateKey,
      rules
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error configuring spending rules:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to configure spending rules',
    });
  }
});

/**
 * 查询金库状态 (余额 + 规则)
 * GET /api/kitepass/status/:address
 */
app.get('/api/kitepass/status/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    console.log(`📊 [KitePass] Status query for: ${address}`);
    
    const [balanceResult, rulesResult] = await Promise.all([
      getVaultBalance(address),
      viewSpendingRules(address),
    ]);
    
    res.json({
      success: balanceResult.success && rulesResult.success,
      address,
      balance: balanceResult.balance,
      symbol: balanceResult.symbol,
      rules: rulesResult.rules,
      error: balanceResult.error || rulesResult.error,
    });
  } catch (error: any) {
    console.error('Error getting KitePass status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get KitePass status',
    });
  }
});

/**
 * 从金库提取资金
 * POST /api/kitepass/withdraw
 * Body: { eoaAddress: string, kitepassAddress: string, amount: string }
 */
app.post('/api/kitepass/withdraw', async (req, res) => {
  try {
    const { eoaAddress, kitepassAddress, amount } = req.body;
    
    if (!eoaAddress || !kitepassAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'eoaAddress, kitepassAddress, and amount are required',
      });
    }
    
    const custodyPrivateKey = process.env.CUSTODY_PRIVATE_KEY;
    if (!custodyPrivateKey) {
      return res.status(500).json({
        success: false,
        error: 'Custody wallet not configured',
      });
    }
    
    console.log(`💸 [KitePass] Withdraw ${amount} from: ${kitepassAddress}`);
    
    const result = await withdrawFunds(
      eoaAddress,
      kitepassAddress,
      amount,
      custodyPrivateKey
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error withdrawing from KitePass:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to withdraw from KitePass',
    });
  }
});

// ==================== Transaction Query API ====================

import { 
  getAllTransactions, 
  getTransactionsByWallet, 
  getTransactionsByWillId,
  getTransactionByHash,
  getFriendsByOwner,
  saveFriends,
  updateFriendWallet,
  clearFriends,
  FriendRecord,
  // 多钱包关联
  saveLinkedWallet,
  getLinkedWalletsByWillId,
  getAllLinkedWalletsByWillId,
  getLinkedWallet,
  removeLinkedWallet,
  LinkedWallet,
} from './database.js';
import { calculateFriends, Friend } from './twitterService.js';

/**
 * 获取所有交易记录
 * GET /api/transactions
 */
app.get('/api/transactions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const transactions = getAllTransactions(limit);
    
    res.json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error: any) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 按钱包地址查询交易
 * GET /api/transactions/wallet/:address
 */
app.get('/api/transactions/wallet/:address', (req, res) => {
  try {
    const { address } = req.params;
    console.log(`📥 [Transactions] Query by wallet: ${address}`);
    
    const transactions = getTransactionsByWallet(address);
    
    res.json({
      success: true,
      wallet: address,
      count: transactions.length,
      transactions,
    });
  } catch (error: any) {
    console.error('Error getting transactions by wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 按遗嘱ID查询交易
 * GET /api/transactions/will/:willId
 */
app.get('/api/transactions/will/:willId', (req, res) => {
  try {
    const { willId } = req.params;
    console.log(`📥 [Transactions] Query by willId: ${willId}`);
    
    const transactions = getTransactionsByWillId(willId);
    
    res.json({
      success: true,
      willId,
      count: transactions.length,
      transactions,
    });
  } catch (error: any) {
    console.error('Error getting transactions by willId:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Linked Wallets API (多钱包聚合分配) ====================

/**
 * 添加关联钱包
 * POST /api/will/:willId/wallets
 * Body: { address, signature }
 */
app.post('/api/will/:willId/wallets', (req, res) => {
  try {
    const { willId } = req.params;
    const { address, signature } = req.body;
    
    if (!address || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: address, signature',
      });
    }
    
    console.log(`📥 [LinkedWallet] Add wallet ${address.slice(0, 10)}... to will ${willId}`);
    
    // 检查是否已存在
    const existing = getLinkedWallet(willId, address);
    if (existing && existing.status === 'approved') {
      return res.json({
        success: true,
        wallet: existing,
        message: 'Wallet already linked',
      });
    }
    
    // 保存关联钱包
    const wallet: LinkedWallet = {
      willId,
      address: address.toLowerCase(),
      signature,
      approvedAt: Date.now(),
      status: 'approved',
    };
    
    saveLinkedWallet(wallet);
    
    res.json({
      success: true,
      wallet,
      message: 'Wallet linked successfully',
    });
  } catch (error: any) {
    console.error('Error adding linked wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 获取遗嘱的所有关联钱包
 * GET /api/will/:willId/wallets
 */
app.get('/api/will/:willId/wallets', (req, res) => {
  try {
    const { willId } = req.params;
    const includeAll = req.query.all === 'true';
    
    console.log(`📥 [LinkedWallet] Query wallets for will ${willId}`);
    
    const wallets = includeAll 
      ? getAllLinkedWalletsByWillId(willId)
      : getLinkedWalletsByWillId(willId);
    
    res.json({
      success: true,
      willId,
      count: wallets.length,
      wallets,
    });
  } catch (error: any) {
    console.error('Error getting linked wallets:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 移除关联钱包
 * DELETE /api/will/:willId/wallets/:address
 */
app.delete('/api/will/:willId/wallets/:address', (req, res) => {
  try {
    const { willId, address } = req.params;
    
    console.log(`📥 [LinkedWallet] Remove wallet ${address.slice(0, 10)}... from will ${willId}`);
    
    removeLinkedWallet(willId, address);
    
    res.json({
      success: true,
      message: 'Wallet removed from will',
    });
  } catch (error: any) {
    console.error('Error removing linked wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Friends API ====================

/**
 * 获取好友列表
 * GET /api/friends/:ownerWallet
 */
app.get('/api/friends/:ownerWallet', async (req, res) => {
  try {
    const { ownerWallet } = req.params;
    console.log(`📥 [Friends] Query for wallet: ${ownerWallet.slice(0, 10)}...`);
    
    // 先从数据库获取缓存
    let friends = getFriendsByOwner(ownerWallet);
    let cached = true;
    
    // 如果没有缓存，从 Twitter API 获取
    if (friends.length === 0) {
      console.log(`🔄 [Friends] No cache, fetching from Twitter API...`);
      const twitterFriends = await calculateFriends(ownerWallet);
      
      if (twitterFriends.length > 0) {
        // 转换为 FriendRecord 并保存
        const records: FriendRecord[] = twitterFriends.map(f => ({
          user_id: f.user_id,
          screen_name: f.screen_name,
          name: f.name,
          description: f.description,
          profile_image: f.profile_image,
          statuses_count: f.statuses_count,
          followers_count: f.followers_count,
          friends_count: f.friends_count,
          media_count: f.media_count,
          wallet_address: null,
          owner_wallet: ownerWallet.toLowerCase(),
          created_at: Date.now(),
          updated_at: Date.now(),
        }));
        
        saveFriends(records);
        friends = records;
      }
      cached = false;
    }
    
    res.json({
      success: true,
      count: friends.length,
      friends,
      cached,
    });
  } catch (error: any) {
    console.error('Error getting friends:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 刷新好友列表（强制从 Twitter API 重新获取）
 * POST /api/friends/refresh
 * Body: { ownerWallet: string }
 */
app.post('/api/friends/refresh', async (req, res) => {
  try {
    const { ownerWallet } = req.body;
    
    if (!ownerWallet) {
      return res.status(400).json({
        success: false,
        error: 'ownerWallet is required',
      });
    }
    
    console.log(`🔄 [Friends] Force refresh for wallet: ${ownerWallet.slice(0, 10)}...`);
    
    // 清空缓存
    clearFriends(ownerWallet);
    
    // 从 Twitter API 获取
    const twitterFriends = await calculateFriends(ownerWallet);
    
    // 保存到数据库
    const records: FriendRecord[] = twitterFriends.map(f => ({
      user_id: f.user_id,
      screen_name: f.screen_name,
      name: f.name,
      description: f.description,
      profile_image: f.profile_image,
      statuses_count: f.statuses_count,
      followers_count: f.followers_count,
      friends_count: f.friends_count,
      media_count: f.media_count,
      wallet_address: null,
      owner_wallet: ownerWallet.toLowerCase(),
      created_at: Date.now(),
      updated_at: Date.now(),
    }));
    
    if (records.length > 0) {
      saveFriends(records);
    }
    
    res.json({
      success: true,
      count: records.length,
      friends: records,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error refreshing friends:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 更新好友钱包地址
 * PATCH /api/friends/:userId/wallet
 * Body: { wallet_address: string }
 */
app.patch('/api/friends/:userId/wallet', (req, res) => {
  try {
    const { userId } = req.params;
    const { wallet_address } = req.body;
    
    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        error: 'wallet_address is required',
      });
    }
    
    console.log(`📝 [Friends] Update wallet for user ${userId}: ${wallet_address.slice(0, 10)}...`);
    
    updateFriendWallet(userId, wallet_address);
    
    res.json({
      success: true,
      userId,
      wallet_address,
      message: 'Friend wallet updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating friend wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Silene Backend running on http://localhost:${PORT}`);
  console.log(`📋 Kite Config:`, getConfig());
  console.log(`📝 Will API: /api/will/authorize, /api/will/execute, /api/will/status`);
  console.log(`📊 Transaction API: /api/transactions, /api/transactions/wallet/:address`);
  console.log(`🤝 Friends API: /api/friends/:wallet, /api/friends/refresh, /api/friends/:userId/wallet`);
});
