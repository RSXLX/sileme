/**
 * Will Authorization Service
 * 遗嘱授权存储和执行服务
 * 
 * 功能：
 * - EIP-712 签名验证
 * - 遗嘱授权存储
 * - 支付额度控制 (perTxLimit, dailyLimit)
 * - 稳定币/原生币转账执行
 */

import { ethers } from 'ethers';
import { getAAWalletAddress } from './kiteSDKService';
import { 
  saveWill, 
  getWillById, 
  getWillByOwner, 
  updateWillStatus, 
  updateWillSpendingLimits,
  saveTransaction,
  getLinkedWalletsByWillId,
  saveLinkedWallet,
  LinkedWallet,
  StoredWillAuthorization,
  TransactionRecord 
} from './database';
import { 
  withdrawFunds as kitepassWithdraw, 
  getVaultBalance as kitepassGetBalance 
} from './kitepassService';

// Kite Testnet 配置
const KITE_RPC = 'https://rpc-testnet.gokite.ai';
const CHAIN_ID = 2368;

// Kite Settlement Token (USDT-like stablecoin)
const SETTLEMENT_TOKEN = process.env.SETTLEMENT_TOKEN || '0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63';

// 死亡证明合约地址 (部署后需更新)
const DEATH_CERTIFICATE_ADDRESS = process.env.DEATH_CERTIFICATE_ADDRESS || '';

// 死亡证明合约 ABI
const DEATH_CERTIFICATE_ABI = [
  'function recordDeath(bytes32 willId, address owner, uint256 beneficiaryCount, string message) external',
  'function getCertificate(bytes32 willId) view returns (address, uint256, uint256, string, address)',
  'function isDeceased(address owner) view returns (bool)',
  'function isRecorded(bytes32 willId) view returns (bool)',
];

// ERC-20 ABI (transfer + balanceOf + transferFrom + allowance)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// 支付额度控制
interface SpendingLimits {
  perTxLimit: string;    // 单笔限额 (wei)
  dailyLimit: string;    // 每日限额 (wei)
  dailySpent: string;    // 今日已花费 (wei)
  lastResetDate: string; // 上次重置日期 YYYY-MM-DD
}

// 存储结构 - Beneficiary 和 SpendingLimits 本地定义，StoredWillAuthorization 从 database.ts 导入
interface Beneficiary {
  address: string;
  percentage: number;
  name: string;
}

// ExecutionResult 结果结构
interface ExecutionResult {
  beneficiary: string;
  txHash: string;
  amount: string;
  status: 'confirmed' | 'failed';
  tokenSymbol: string;
  error?: string;
}

// 使用 SQLite 持久化存储 (替代内存 Map)
// 数据库操作通过 database.ts 模块进行

// 默认支付限额
const DEFAULT_SPENDING_LIMITS: SpendingLimits = {
  perTxLimit: ethers.parseEther('100').toString(),    // 单笔 100
  dailyLimit: ethers.parseEther('1000').toString(),   // 每日 1000
  dailySpent: '0',
  lastResetDate: new Date().toISOString().split('T')[0],
};

/**
 * 生成 Will ID
 */
function generateWillId(): string {
  return `will_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * EIP-712 域定义
 */
const WILL_AUTHORIZATION_DOMAIN = {
  name: 'Silene Will',
  version: '1',
  chainId: CHAIN_ID,
};

/**
 * EIP-712 类型定义
 */
const WILL_AUTHORIZATION_TYPES = {
  WillAuthorization: [
    { name: 'owner', type: 'address' },
    { name: 'beneficiaries', type: 'string' },
    { name: 'totalAmount', type: 'uint256' },
    { name: 'validUntil', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

/**
 * 验证 EIP-712 签名
 */
export function verifyWillAuthorization(
  owner: string,
  beneficiaries: Beneficiary[],
  totalAmount: string,
  validUntil: number,
  signature: string
): boolean {
  try {
    // 1. 规范化 beneficiaries 数据结构 (避免 JSON.stringify 顺序不一致导致的哈希不同)
    const canonicalBeneficiaries = beneficiaries.map(b => ({
      address: b.address,
      name: b.name,
      percentage: Number(b.percentage) // Ensure number
    }));

    const beneficiariesStr = JSON.stringify(canonicalBeneficiaries);
    
    const message = {
      owner,
      beneficiaries: beneficiariesStr,
      totalAmount: BigInt(totalAmount), // Match Frontend BigInt
      validUntil: BigInt(validUntil),
      nonce: 0,
    };

    console.log(`🔐 [Verify] Message Hash Inputs:`, { 
      owner, 
      beneficiariesStr, // Log the exact string
      totalAmount: message.totalAmount.toString(),
      validUntil: message.validUntil.toString()
    });

    const recoveredAddress = ethers.verifyTypedData(
      WILL_AUTHORIZATION_DOMAIN,
      WILL_AUTHORIZATION_TYPES,
      message,
      signature
    );

    return recoveredAddress.toLowerCase() === owner.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * 检查支付额度
 */
function checkSpendingLimits(will: StoredWillAuthorization, amount: bigint): { allowed: boolean; reason?: string } {
  const limits = will.spendingLimits;
  const today = new Date().toISOString().split('T')[0];
  
  // 重置每日限额
  if (limits.lastResetDate !== today) {
    limits.dailySpent = '0';
    limits.lastResetDate = today;
  }
  
  // 检查单笔限额
  const perTxLimit = BigInt(limits.perTxLimit);
  if (amount > perTxLimit) {
    return { allowed: false, reason: `Exceeds per-transaction limit: ${ethers.formatEther(perTxLimit)}` };
  }
  
  // 检查每日限额
  const dailyLimit = BigInt(limits.dailyLimit);
  const dailySpent = BigInt(limits.dailySpent);
  if (dailySpent + amount > dailyLimit) {
    return { allowed: false, reason: `Exceeds daily limit: ${ethers.formatEther(dailyLimit)}` };
  }
  
  return { allowed: true };
}

/**
 * 更新已花费金额
 */
function updateDailySpent(will: StoredWillAuthorization, amount: bigint): void {
  const currentSpent = BigInt(will.spendingLimits.dailySpent);
  will.spendingLimits.dailySpent = (currentSpent + amount).toString();
}

/**
 * 存储遗嘱授权
 */
export function storeWillAuthorization(
  owner: string,
  beneficiaries: Beneficiary[],
  totalAmount: string,
  validUntil: number,
  signature: string,
  useStablecoin: boolean = true,
  customLimits?: Partial<SpendingLimits>
): { success: boolean; willId?: string; error?: string } {
  try {
    // 验证签名
    const isValid = verifyWillAuthorization(owner, beneficiaries, totalAmount, validUntil, signature);
    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }

    // 检查是否已存在
    const existingWill = getWillByOwner(owner);
    if (existingWill && existingWill.status === 'pending') {
      // 更新现有授权
      const updatedWill: StoredWillAuthorization = {
        ...existingWill,
        beneficiaries,
        totalAmount,
        validUntil,
        signature,
        createdAt: Date.now(),
        useStablecoin,
      };
      saveWill(updatedWill);
      console.log(`📝 [WillService] Updated will: ${existingWill.willId}`);
      return { success: true, willId: existingWill.willId };
    }

    // 合并自定义限额
    const spendingLimits: SpendingLimits = {
      ...DEFAULT_SPENDING_LIMITS,
      ...customLimits,
    };

    // 创建新授权
    const willId = generateWillId();
    const will: StoredWillAuthorization = {
      willId,
      owner,
      beneficiaries,
      totalAmount,
      validUntil,
      signature,
      createdAt: Date.now(),
      status: 'pending',
      useStablecoin,
      spendingLimits,
      // KitePass 相关 (默认禁用)
      useKitepass: false,
      spendingRulesConfigured: false,
    };

    saveWill(will);

    // 自动将 owner 作为第一个关联钱包 (多钱包聚合分配功能)
    saveLinkedWallet({
      willId,
      address: owner,
      signature,
      approvedAt: Date.now(),
      status: 'approved',
    });

    console.log(`📝 [WillService] Stored new will: ${willId} for owner: ${owner}`);
    console.log(`   🔗 Auto-linked primary wallet: ${owner}`);
    console.log(`   📊 Spending limits: perTx=${ethers.formatEther(spendingLimits.perTxLimit)}, daily=${ethers.formatEther(spendingLimits.dailyLimit)}`);
    console.log(`   💰 Token: ${useStablecoin ? 'Stablecoin (USDT)' : 'Native KITE'}`);
    return { success: true, willId };
  } catch (error: any) {
    console.error('Failed to store will:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取遗嘱状态
 */
export function getWillStatus(owner: string): StoredWillAuthorization | null {
  return getWillByOwner(owner);
}

/**
 * 执行遗嘱 - 支持稳定币和原生币，支持多钱包聚合分配
 * @param overrideBeneficiaries 可选：覆盖的受益人列表（用于 AI 加权调整后的分配）
 */
export async function executeWill(
  willId: string,
  owner: string,
  custodyPrivateKey: string,
  overrideBeneficiaries?: Beneficiary[]
): Promise<{ success: boolean; transactions?: ExecutionResult[]; deathTxHash?: string; error?: string }> {
  try {
    // 获取遗嘱 (从数据库)
    const will = getWillById(willId);
    if (!will) {
      return { success: false, error: 'Will not found' };
    }

    // 验证所有者
    if (will.owner.toLowerCase() !== owner.toLowerCase()) {
      return { success: false, error: 'Owner mismatch' };
    }

    // 验证状态
    if (will.status !== 'pending') {
      return { success: false, error: `Will already ${will.status}` };
    }

    // 如果有覆盖的受益人列表，使用它替换原始列表
    if (overrideBeneficiaries && overrideBeneficiaries.length > 0) {
      console.log(`📊 [WillService] Using override beneficiaries: ${overrideBeneficiaries.length} recipients`);
      will.beneficiaries = overrideBeneficiaries;
    }

    console.log(`🚀 [WillService] Executing will: ${willId}`);
    console.log(`   💎 Token type: ${will.useStablecoin ? 'Stablecoin' : 'Native KITE'}`);
    console.log(`   🏦 KitePass mode: ${will.useKitepass ? 'Enabled' : 'Disabled'}`);
    console.log(`   👥 Beneficiaries: ${will.beneficiaries.map(b => b.name).join(', ')}`);

    // ====== 模式分支：KitePass vs Approve ======
    if (will.useKitepass && will.kitepassAddress) {
      console.log(`   ➡️ Using KitePass execution mode`);
      return await executeWithKitepass(will, custodyPrivateKey);
    }

    console.log(`   ➡️ Using Approve execution mode (fallback)`);

    // 创建托管钱包 (需要在死亡声明之前创建)
    const provider = new ethers.JsonRpcProvider(KITE_RPC);
    const custodyWallet = new ethers.Wallet(custodyPrivateKey, provider);
    console.log(`💼 [WillService] Custody wallet: ${custodyWallet.address}`);

    // ====== Gas 余额检查 ======
    const custodyBalance = await provider.getBalance(custodyWallet.address);
    const minGasRequired = ethers.parseEther('0.05'); // 最低需要 0.05 KITE 用于 gas
    console.log(`⛽ [WillService] Custody wallet gas balance: ${ethers.formatEther(custodyBalance)} KITE`);
    
    if (custodyBalance < minGasRequired) {
      console.error(`❌ [WillService] Insufficient gas in custody wallet!`);
      console.error(`   Required: ${ethers.formatEther(minGasRequired)} KITE`);
      console.error(`   Available: ${ethers.formatEther(custodyBalance)} KITE`);
      return { 
        success: false, 
        error: `Custody wallet has insufficient gas. Required: ${ethers.formatEther(minGasRequired)} KITE, Available: ${ethers.formatEther(custodyBalance)} KITE` 
      };
    }
    console.log(`✅ [WillService] Gas check passed`);


    // ====== 死亡声明上链 (直接调用 DeathCertificateRegistry 合约) ======
    let deathTxHash: string | undefined;
    try {
      if (!DEATH_CERTIFICATE_ADDRESS) {
        console.warn('⚠️ [WillService] Death certificate contract not configured, skipping on-chain record');
      } else {
        console.log('☠️ [WillService] Recording death to DeathCertificateRegistry contract...');
        
        const deathContract = new ethers.Contract(
          DEATH_CERTIFICATE_ADDRESS,
          DEATH_CERTIFICATE_ABI,
          custodyWallet
        );

        // 将 willId 转换为 bytes32 (使用 keccak256 哈希)
        const willIdBytes32 = ethers.id(will.willId);
        const deathMessage = `Silene Protocol: Death confirmed for will ${will.willId}`;

        // 直接调用合约 (不使用 AA SDK，避免轮询超时)
        const tx = await deathContract.recordDeath(
          willIdBytes32,
          will.owner,
          will.beneficiaries.length,
          deathMessage
        );

        console.log(`⏳ [WillService] Death TX sent: ${tx.hash}`);
        const receipt = await tx.wait();
        deathTxHash = receipt.hash;
        
        console.log(`💀 [WillService] Death confirmed on-chain!`);
        console.log(`   🔗 transactionHash: ${deathTxHash}`);
        
        // 持久化死亡声明交易
        saveTransaction({
          txHash: deathTxHash!,
          willId: will.willId,
          owner: will.owner,
          beneficiaryAddress: DEATH_CERTIFICATE_ADDRESS,
          beneficiaryName: 'Death Certificate Registry',
          amount: '0',
          tokenSymbol: 'KITE',
          txType: 'DEATH_DECLARATION',
          status: 'confirmed',
          createdAt: Date.now(),
        });
      }
    } catch (deathError: any) {
      console.warn('⚠️ [WillService] Death declaration error (non-blocking):', deathError.message);
    }


    // ====== 多钱包聚合分配 ======
    // 获取所有已授权的关联钱包
    let linkedWallets = getLinkedWalletsByWillId(willId);
    
    // 如果没有关联钱包，使用主钱包 (兼容旧数据)
    if (linkedWallets.length === 0) {
      console.log(`📦 [WillService] No linked wallets found, using primary owner: ${will.owner}`);
      linkedWallets = [{
        willId,
        address: will.owner,
        signature: will.signature,
        approvedAt: will.createdAt,
        status: 'approved' as const,
      }];
    } else {
      console.log(`📦 [WillService] Found ${linkedWallets.length} linked wallets`);
    }

    const results: ExecutionResult[] = [];
    const tokenContract = new ethers.Contract(SETTLEMENT_TOKEN, ERC20_ABI, custodyWallet);
    const tokenSymbol = will.useStablecoin ? await tokenContract.symbol() : 'KITE';
    const tokenDecimals = will.useStablecoin ? await tokenContract.decimals() : 18;

    // 遍历每个关联钱包
    for (const linkedWallet of linkedWallets) {
      console.log(`\n🔗 [WillService] Processing wallet: ${linkedWallet.address}`);
      
      try {
        // 获取该钱包的余额
        let walletBalance: bigint;
        if (will.useStablecoin) {
          walletBalance = await tokenContract.balanceOf(linkedWallet.address);
          console.log(`   💰 Balance: ${ethers.formatUnits(walletBalance, tokenDecimals)} ${tokenSymbol}`);
        } else {
          const rawBalance = await provider.getBalance(linkedWallet.address);
          // 预留 gas 费用 (每个受益人需要约 21000 gas × gasPrice)
          // 预留 0.01 KITE 用于支付所有转账的 gas
          const gasReserve = ethers.parseEther('0.01');
          walletBalance = rawBalance > gasReserve ? rawBalance - gasReserve : 0n;
          console.log(`   💰 Balance: ${ethers.formatEther(rawBalance)} KITE (reserving ${ethers.formatEther(gasReserve)} for gas)`);
          console.log(`   💵 Distributable: ${ethers.formatEther(walletBalance)} KITE`);
        }

        if (walletBalance === 0n) {
          console.log(`   ⏩ Skipping wallet (zero balance or insufficient for gas)`);
          continue;
        }

        // 如果是稳定币，检查授权额度
        if (will.useStablecoin) {
          const allowance = await tokenContract.allowance(linkedWallet.address, custodyWallet.address);
          console.log(`   📝 Allowance: ${ethers.formatUnits(allowance, tokenDecimals)} ${tokenSymbol}`);
          
          if (allowance === 0n) {
            console.log(`   ⏩ Skipping wallet (no allowance)`);
            continue;
          }
        }

        // 按比例分配给每个受益人
        for (const beneficiary of will.beneficiaries) {
          // 百分比可能是小数（如 36.3%），乘以10转为整数后计算
          const percentageScaled = Math.round(beneficiary.percentage * 10);
          const amount = (walletBalance * BigInt(percentageScaled)) / 1000n;
          
          if (amount === 0n) {
            console.log(`   ⏩ Skip ${beneficiary.name}: amount is 0`);
            continue;
          }

          // 检查支付额度
          const limitCheck = checkSpendingLimits(will, amount);
          if (!limitCheck.allowed) {
            console.log(`   ⚠️ Spending limit exceeded for ${beneficiary.name}: ${limitCheck.reason}`);
            results.push({
              beneficiary: beneficiary.name,
              txHash: '',
              amount: amount.toString(),
              status: 'failed',
              tokenSymbol,
              error: limitCheck.reason,
            });
            continue;
          }

          console.log(`   💸 Sending ${will.useStablecoin ? ethers.formatUnits(amount, tokenDecimals) : ethers.formatEther(amount)} ${tokenSymbol} to ${beneficiary.name}`);

          try {
            let txHash = '';
            
            if (will.useStablecoin) {
              // ERC-20 TransferFrom - 使用预授权从用户钱包拉取资金
              // 确保地址格式正确（禁用 ENS 解析）
              const fromAddr = ethers.getAddress(linkedWallet.address);
              const toAddr = ethers.getAddress(beneficiary.address);
              const tx = await tokenContract.transferFrom(fromAddr, toAddr, amount);
              console.log(`      ⏳ TX Sent: ${tx.hash}`);
              const receipt = await tx.wait();
              txHash = receipt.hash;
            } else {
              // 原生币：仍使用 Custody EOA 直接转账（需要用户预存）
              // 注意：这里无法从用户钱包直接转账原生币，需要用户预存到 custody
              console.log(`      🔄 Sending Native KITE directly from Custody EOA...`);
              // 确保地址格式正确（禁用 ENS 解析）
              const toAddress = ethers.getAddress(beneficiary.address);
              const tx = await custodyWallet.sendTransaction({
                to: toAddress,
                value: amount
              });
              console.log(`      ⏳ TX Sent: ${tx.hash}`);
              const receipt = await tx.wait();
              txHash = receipt?.hash || tx.hash;
            }

            console.log(`      ✅ TX Confirmed: ${txHash}`);

            // 更新已花费金额
            updateDailySpent(will, amount);

            // 持久化交易记录到数据库 (记录来源钱包)
            saveTransaction({
              txHash: txHash,
              willId: will.willId,
              owner: linkedWallet.address, // 记录实际来源钱包
              beneficiaryAddress: beneficiary.address,
              beneficiaryName: beneficiary.name,
              amount: amount.toString(),
              tokenSymbol,
              txType: 'DISTRIBUTION',
              status: 'confirmed',
              createdAt: Date.now(),
            });

            results.push({
              beneficiary: beneficiary.name,
              txHash: txHash,
              amount: amount.toString(),
              status: 'confirmed',
              tokenSymbol,
            });
          } catch (txError: any) {
            console.error(`      ❌ TX Failed for ${beneficiary.name}:`, txError.message);
            results.push({
              beneficiary: beneficiary.name,
              txHash: '',
              amount: amount.toString(),
              status: 'failed',
              tokenSymbol,
              error: txError.message,
            });
          }
        }
      } catch (walletError: any) {
        console.error(`   ❌ Failed to process wallet ${linkedWallet.address}:`, walletError.message);
      }
    }

    // 更新状态 (持久化到数据库)
    updateWillStatus(willId, 'executed');
    console.log(`\n✅ [WillService] Will executed: ${willId}`);
    console.log(`   📊 Total transactions: ${results.length}`);
    console.log(`   ✅ Successful: ${results.filter(r => r.status === 'confirmed').length}`);
    console.log(`   ❌ Failed: ${results.filter(r => r.status === 'failed').length}`);

    return { success: true, transactions: results, deathTxHash };
  } catch (error: any) {
    console.error('Failed to execute will:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 使用 KitePass (ClientAgentVault) 执行遗嘱分配
 * 通过 withdrawFunds 直接从金库向受益人转账
 */
async function executeWithKitepass(
  will: StoredWillAuthorization,
  custodyPrivateKey: string
): Promise<{ success: boolean; transactions?: ExecutionResult[]; deathTxHash?: string; error?: string }> {
  console.log(`🏦 [KitePass] Executing will with KitePass mode: ${will.willId}`);
  
  const provider = new ethers.JsonRpcProvider(KITE_RPC);
  const custodyWallet = new ethers.Wallet(custodyPrivateKey, provider);

  // ====== Gas 余额检查 ======
  const custodyBalance = await provider.getBalance(custodyWallet.address);
  const minGasRequired = ethers.parseEther('0.05'); // 最低需要 0.05 KITE 用于 gas
  console.log(`⛽ [KitePass] Custody wallet gas balance: ${ethers.formatEther(custodyBalance)} KITE`);
  
  if (custodyBalance < minGasRequired) {
    console.error(`❌ [KitePass] Insufficient gas in custody wallet!`);
    return { 
      success: false, 
      error: `Custody wallet has insufficient gas. Required: ${ethers.formatEther(minGasRequired)} KITE, Available: ${ethers.formatEther(custodyBalance)} KITE` 
    };
  }
  console.log(`✅ [KitePass] Gas check passed`);

  
  // ====== 死亡声明上链 ======
  let deathTxHash: string | undefined;
  try {
    if (DEATH_CERTIFICATE_ADDRESS) {
      console.log('☠️ [KitePass] Recording death to DeathCertificateRegistry...');
      
      const deathContract = new ethers.Contract(
        DEATH_CERTIFICATE_ADDRESS,
        DEATH_CERTIFICATE_ABI,
        custodyWallet
      );

      const willIdBytes32 = ethers.id(will.willId);
      const deathMessage = `Silene Protocol (KitePass): Death confirmed for will ${will.willId}`;

      const tx = await deathContract.recordDeath(
        willIdBytes32,
        will.owner,
        will.beneficiaries.length,
        deathMessage
      );

      console.log(`⏳ [KitePass] Death TX sent: ${tx.hash}`);
      const receipt = await tx.wait();
      deathTxHash = receipt.hash;
      
      console.log(`💀 [KitePass] Death confirmed on-chain: ${deathTxHash}`);
      
      saveTransaction({
        txHash: deathTxHash!,
        willId: will.willId,
        owner: will.owner,
        beneficiaryAddress: DEATH_CERTIFICATE_ADDRESS,
        beneficiaryName: 'Death Certificate Registry',
        amount: '0',
        tokenSymbol: 'KITE',
        txType: 'DEATH_DECLARATION',
        status: 'confirmed',
        createdAt: Date.now(),
      });
    }
  } catch (deathError: any) {
    console.warn('⚠️ [KitePass] Death declaration error (non-blocking):', deathError.message);
  }

  // ====== 从 KitePass 金库分配资产 ======
  const results: ExecutionResult[] = [];
  
  try {
    // 获取金库余额
    const balanceResult = await kitepassGetBalance(will.kitepassAddress!);
    if (!balanceResult.success || !balanceResult.balance) {
      console.error('❌ [KitePass] Failed to get vault balance');
      return { success: false, error: 'Failed to get KitePass vault balance' };
    }
    
    const vaultBalance = ethers.parseUnits(balanceResult.balance, 6); // USDT 6 decimals
    console.log(`💰 [KitePass] Vault balance: ${balanceResult.balance} USDT`);
    
    if (vaultBalance === 0n) {
      console.warn('⚠️ [KitePass] Vault is empty, nothing to distribute');
      updateWillStatus(will.willId, 'executed');
      return { success: true, transactions: [], deathTxHash };
    }

    // 按比例分配给每个受益人
    for (const beneficiary of will.beneficiaries) {
      // 百分比可能是小数（如 36.3%），乘以10转为整数后计算
      const percentageScaled = Math.round(beneficiary.percentage * 10);
      const amount = (vaultBalance * BigInt(percentageScaled)) / 1000n;
      const amountFormatted = ethers.formatUnits(amount, 6);
      
      if (amount === 0n) {
        console.log(`   ⏩ Skip ${beneficiary.name}: amount is 0`);
        continue;
      }

      console.log(`   💸 [KitePass] Withdrawing ${amountFormatted} USDT to ${beneficiary.name}`);

      try {
        const withdrawResult = await kitepassWithdraw(
          will.owner,
          will.kitepassAddress!,
          amountFormatted,
          custodyPrivateKey
        );

        if (withdrawResult.success && withdrawResult.txHash) {
          console.log(`      ✅ TX Confirmed: ${withdrawResult.txHash}`);
          
          saveTransaction({
            txHash: withdrawResult.txHash,
            willId: will.willId,
            owner: will.kitepassAddress!, // 来源是 KitePass
            beneficiaryAddress: beneficiary.address,
            beneficiaryName: beneficiary.name,
            amount: amount.toString(),
            tokenSymbol: 'USDT',
            txType: 'DISTRIBUTION',
            status: 'confirmed',
            createdAt: Date.now(),
          });

          results.push({
            beneficiary: beneficiary.name,
            txHash: withdrawResult.txHash,
            amount: amount.toString(),
            status: 'confirmed',
            tokenSymbol: 'USDT',
          });
        } else {
          console.error(`      ❌ Withdraw failed: ${withdrawResult.error}`);
          results.push({
            beneficiary: beneficiary.name,
            txHash: '',
            amount: amount.toString(),
            status: 'failed',
            tokenSymbol: 'USDT',
            error: withdrawResult.error,
          });
        }
      } catch (txError: any) {
        console.error(`      ❌ TX Failed for ${beneficiary.name}:`, txError.message);
        results.push({
          beneficiary: beneficiary.name,
          txHash: '',
          amount: amount.toString(),
          status: 'failed',
          tokenSymbol: 'USDT',
          error: txError.message,
        });
      }
    }
  } catch (error: any) {
    console.error('❌ [KitePass] Distribution error:', error);
    return { success: false, error: error.message };
  }

  // 更新状态
  updateWillStatus(will.willId, 'executed');
  console.log(`✅ [KitePass] Will executed: ${will.willId}`);
  console.log(`   📊 Total transactions: ${results.length}`);
  console.log(`   ✅ Successful: ${results.filter(r => r.status === 'confirmed').length}`);
  console.log(`   ❌ Failed: ${results.filter(r => r.status === 'failed').length}`);

  return { success: true, transactions: results, deathTxHash };
}

/**
 * 导出常量供前端使用
 */
export const WILL_CONSTANTS = {
  DOMAIN: WILL_AUTHORIZATION_DOMAIN,
  TYPES: WILL_AUTHORIZATION_TYPES,
  SETTLEMENT_TOKEN,
  DEFAULT_LIMITS: {
    perTxLimit: DEFAULT_SPENDING_LIMITS.perTxLimit,
    dailyLimit: DEFAULT_SPENDING_LIMITS.dailyLimit,
  },
};
