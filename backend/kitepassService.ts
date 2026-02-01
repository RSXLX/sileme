/**
 * KitePass 服务
 * 封装 gokite-aa-sdk 的 ClientAgentVault (KitePass) 操作
 * 
 * 功能：
 * - 部署 KitePass 代理合约
 * - 配置 Spending Rules
 * - 查看余额和规则
 * - 从金库提取资金
 */

import { GokiteAASDK, UserOperationRequest, SignFunction } from 'gokite-aa-sdk';
import { ethers } from 'ethers';
import { initKiteAA, createSignFunction, isAccountDeployed, getAAWalletAddress } from './kiteSDKService.js';

// 合约地址 (Kite Testnet)
const ADDRESSES = {
  SETTLEMENT_TOKEN: '0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63',
  SETTLEMENT_CONTRACT: '0x8d9FaD78d5Ce247aA01C140798B9558fd64a63E3',
  CLIENT_AGENT_VAULT_IMPL: '0xB5AAFCC6DD4DFc2B80fb8BCcf406E1a2Fd559e23',
};

const RPC_URL = 'https://rpc-testnet.gokite.ai';

/**
 * 获取透明代理字节码 (来自 SDK example.js)
 */
function getTransparentProxyBytecode(): string {
  return '0x60a0604052610b278038038061001481610293565b928339810160608282031261028e5761002c826102b8565b610038602084016102b8565b604084015190936001600160401b03821161028e570182601f8201121561028e5780519061006d610068836102cc565b610293565b938285526020838301011161028e5760005b828110610279575050602060009184010152803b15610258577f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc80546001600160a01b0319166001600160a01b0383169081179091557fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b600080a281511561023f5760008083602061013595519101845af43d15610237573d91610125610068846102cc565b9283523d6000602085013e6102e7565b505b604051906104918083016001600160401b0381118482101761022157602092849261067684396001600160a01b031681520301906000f080156102155760018060a01b031680608052600080516020610b07833981519152547f7e644d79422f17c01e4894b5f4f588d331ebfa28653d42ae832dc59e38c9798f6040805160018060a01b0384168152846020820152a181156101ff576001600160a01b03191617600080516020610b078339815191525560405161032d908161034982396080518160070152f35b633173bdd160e11b600052600060045260246000fd5b6040513d6000823e3d90fd5b634e487b7160e01b600052604160045260246000fd5b6060916102e7565b505034156101375763b398979f60e01b60005260046000fd5b634c9c8ce360e01b60009081526001600160a01b0391909116600452602490fd5b8060208092840101518282880101520161007f565b600080fd5b6040519190601f01601f191682016001600160401b0381118382101761022157604052565b51906001600160a01b038216820361028e57565b6001600160401b03811161022157601f01601f191660200190565b9061030d57508051156102fc57805190602001fd5b630a12f52160e11b60005260046000fd5b8151158061033f575b61031e575090565b639996b31560e01b60009081526001600160a01b0391909116600452602490fd5b50803b1561031656fe6080604052337f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031603610069576000356001600160e01b03191663278f794360e11b1461005f576334ad5dbb60e21b60005260046000fd5b610067610113565b005b7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc5460009081906001600160a01b0316368280378136915af43d6000803e156100b1573d6000f35b3d6000fd5b634e487b7160e01b600052604160045260246000fd5b6040519190601f01601f1916820167ffffffffffffffff8111838210176100f257604052565b6100b6565b67ffffffffffffffff81116100f257601f01601f191660200190565b3660041161019d57604036600319011261019d576004356001600160a01b0381169081900361019d576024359067ffffffffffffffff821161019d573660238301121561019d5781600401359061017161016c836100f7565b6100cc565b91808352366024828601011161019d57602081600092602461019b970183870137840101526101a2565b565b600080fd5b90813b15610239577f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc80546001600160a01b0319166001600160a01b0384169081179091557fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b600080a280511561021f5761021c9161025b565b50565b50503461022857565b63b398979f60e01b60005260046000fd5b50634c9c8ce360e01b60009081526001600160a01b0391909116600452602490fd5b60008061028f93602081519101845af43d15610292573d9161027f61016c846100f7565b9283523d6000602085013e610296565b90565b6060915b906102bc57508051156102ab57805190602001fd5b630a12f52160e11b60005260046000fd5b815115806102ee575b6102cd575090565b639996b31560e01b60009081526001600160a01b0391909116600452602490fd5b50803b156102c556fea2646970667358221220597147005a6fe654561cbab25a93153cc233180473a65a90bd427f0c1f41018764736f6c634300081c003360803460bc57601f61049138819003918201601f19168301916001600160401b0383118484101760c15780849260209460405283398101031260bc57516001600160a01b0381169081900360bc57801560a657600080546001600160a01b031981168317825560405192916001600160a01b03909116907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09080a36103b990816100d88239f35b631e4fbdf760e01b600052600060045260246000fd5b600080fd5b634e487b7160e01b600052604160045260246000fdfe6080604052600436101561001257600080fd5b6000803560e01c8063715018a6146102875780638da5cb5b146102605780639623609d1461012f578063ad3cb1cc146100e25763f2fde38b1461005457600080fd5b346100df5760203660031901126100df576004356001600160a01b038116908190036100dd5761008261035a565b80156100c95781546001600160a01b03198116821783556001600160a01b03167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e08380a380f35b631e4fbdf760e01b82526004829052602482fd5b505b80fd5b50346100df57806003193601126100df575061012b6040516101056040826102e1565b60058152640352e302e360dc1b6020820152604051918291602083526020830190610319565b0390f35b5060603660031901126100df576004356001600160a01b038116908190036100dd576024356001600160a01b038116908190036102405760443567ffffffffffffffff811161025c573660238201121561025c57806004013567ffffffffffffffff8111610248576040518593929091906101b4601f8301601f1916602001846102e1565b81835236602483830101116102445781859260246020930183860137830101526101dc61035a565b833b156102405761021293839260405180968194829363278f794360e11b84526004840152604060248401526044830190610319565b039134905af18015610233576102255780f35b61022e916102e1565b388180f35b50604051903d90823e3d90fd5b8280fd5b8480fd5b634e487b7160e01b85526041600452602485fd5b8380fd5b50346100df57806003193601126100df57546040516001600160a01b039091168152602090f35b50346100df57806003193601126100df576102a061035a565b80546001600160a01b03198116825581906001600160a01b03167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e08280a380f35b90601f8019910116810190811067ffffffffffffffff82111761030357604052565b634e487b7160e01b600052604160045260246000fd5b919082519283825260005b848110610345575050826000602080949584010152601f8019910116010190565b80602080928401015182828601015201610324565b6000546001600160a01b0316330361036e57565b63118cdaa760e01b6000523360045260246000fdfea26469706673582212207bc32ec723f6be34b228b59aef2ef61b4e6a8eb5bc67fcdd495248566e3b6e0c64736f6c634300081c0033b53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
}

/**
 * 解析合约创建事件
 */
async function parseContractCreatedEvent(transactionHash: string): Promise<string | null> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) return null;

    const contractCreatedEventSignature = ethers.id('ContractCreated(address)');
    for (const log of receipt.logs) {
      if (log.topics[0] === contractCreatedEventSignature) {
        const contractAddress = ethers.AbiCoder.defaultAbiCoder().decode(
          ['address'],
          log.topics[1]
        )[0];
        return contractAddress;
      }
    }
    return null;
  } catch (error) {
    console.error('Error parsing ContractCreated event:', error);
    return null;
  }
}

// ============================================================================
// Spending Rule 接口
// ============================================================================

export interface SpendingRule {
  timeWindow: bigint;           // 时间窗口 (秒)，0 = 单笔限制
  budget: bigint;               // 预算额度 (wei, 18 decimals)
  initialWindowStartTime: number; // 窗口起始时间 (Unix timestamp)
  targetProviders: string[];    // 目标服务商列表 (空 = 全部)
}

// ============================================================================
// KitePass 部署
// ============================================================================

/**
 * 部署 KitePass 合约
 * @param targetOwnerAddress 目标 AA 钱包的所有者地址（谁拥有这个 KitePass）
 * @param privateKey 签名私钥（必须用这个私钥对应的 EOA 发送 UserOperation）
 */
export async function deployKitepass(
  targetOwnerAddress: string,
  privateKey: string
): Promise<{ success: boolean; kitepassAddress?: string; txHash?: string; error?: string }> {
  const sdk = initKiteAA();
  
  // 关键修复：从私钥获取 EOA 地址，用于发送 UserOperation
  // AA 规范要求：签名私钥必须对应发送操作的 ownerAddress
  const signerWallet = new ethers.Wallet(privateKey);
  const signerEOA = signerWallet.address;
  
  // 使用签名者的 AA 地址部署 KitePass
  // FIX: Use shared helper to ensure Salt=1 is applied
  const aaAddress = await getAAWalletAddress(signerEOA);
  const signFunction = createSignFunction(privateKey);

  console.log(`🚀 Deploying KitePass...`);
  console.log(`   Signer EOA: ${signerEOA}`);
  console.log(`   AA Address: ${aaAddress}`);
  console.log(`   Target Owner: ${targetOwnerAddress}`);

  try {
    // Check if already deployed
    const isDeployed = await isAccountDeployed(aaAddress);
    if (isDeployed) {
      console.log(`✅ KitePass already deployed: ${aaAddress}`);
      return {
        success: true,
        kitepassAddress: aaAddress,
        txHash: '0x0000000000000000000000000000000000000000000000000000000000000000', // Dummy hash
      };
    }

    // 准备初始化数据
    const initializeCallData = ethers.Interface.from([
      'function initialize(address allowedToken, address owner)'
    ]).encodeFunctionData('initialize', [
      ADDRESSES.SETTLEMENT_TOKEN,
      aaAddress
    ]);

    // 创建 KitePass 部署字节码
    const proxyConstructorData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'bytes'],
      [ADDRESSES.CLIENT_AGENT_VAULT_IMPL, aaAddress, initializeCallData]
    );
    const transparentProxyBytecode = getTransparentProxyBytecode();
    const fullInitCode = transparentProxyBytecode + proxyConstructorData.slice(2);

    const deployRequest: UserOperationRequest = {
      target: aaAddress,
      value: 0n,
      callData: ethers.Interface.from([
        'function performCreate(uint256 value, bytes calldata initCode) returns (address)'
      ]).encodeFunctionData('performCreate', [0n, fullInitCode]),
      paymasterAndData: '0x', // Force Self-Pay to bypass AA33 Paymaster rejection
    } as any;

    console.log('📦 Sending deploy UserOperation...');
    // 关键：使用 signerEOA (私钥对应地址) 而不是 targetOwnerAddress
    const result = await sdk.sendUserOperationAndWait(
      signerEOA,
      deployRequest,
      signFunction,
      undefined, // salt
      '0x'       // paymasterAddress = '0x' to disable Paymaster (Self-Pay mode)
    );

    if (result.status.status === 'success') {
      const kitepassAddress = await parseContractCreatedEvent(result.status.transactionHash!);
      console.log(`✅ KitePass deployed: ${kitepassAddress}`);
      return {
        success: true,
        kitepassAddress: kitepassAddress || undefined,
        txHash: result.status.transactionHash,
      };
    } else {
      console.error('❌ Deploy failed:', result.status.reason);
      return {
        success: false,
        error: result.status.reason || 'Deploy failed',
      };
    }
  } catch (error: any) {
    console.error('❌ Deploy error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during deploy',
    };
  }
}

// ============================================================================
// Spending Rules 配置
// ============================================================================

/**
 * 生成默认遗嘱 Spending Rules
 */
export function getDefaultWillSpendingRules(): SpendingRule[] {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayStartTimestamp = Math.floor(todayStart.getTime() / 1000);

  return [
    // 单笔限额 - 10000 USDT
    {
      timeWindow: 0n,
      budget: ethers.parseUnits('10000', 18),
      initialWindowStartTime: 0,
      targetProviders: [],
    },
    // 每日限额 - 100000 USDT (允许一天内全部执行)
    {
      timeWindow: BigInt(86400),
      budget: ethers.parseUnits('100000', 18),
      initialWindowStartTime: todayStartTimestamp,
      targetProviders: [],
    },
  ];
}

/**
 * 配置 Spending Rules
 * @param _targetEoaAddress 目标 EOA 地址（未使用，保持 API 兼容）
 * @param kitepassAddress KitePass 合约地址
 * @param privateKey 签名私钥（必须与发送操作的 ownerAddress 匹配）
 * @param rules Spending Rules (留空则使用默认遗嘱规则)
 */
export async function configureSpendingRules(
  _targetEoaAddress: string,
  kitepassAddress: string,
  privateKey: string,
  rules?: SpendingRule[]
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const sdk = initKiteAA();
  
  // 从私钥获取对应的 EOA 地址
  const signerWallet = new ethers.Wallet(privateKey);
  const signerEOA = signerWallet.address;
  const signFunction = createSignFunction(privateKey);

  const rulesToSet = rules || getDefaultWillSpendingRules();

  console.log(`⚙️ Configuring Spending Rules for KitePass: ${kitepassAddress}`);
  console.log(`   Signer EOA: ${signerEOA}`);
  console.log(`   Rules count: ${rulesToSet.length}`);

  try {
    const configureRequest: UserOperationRequest = {
      target: kitepassAddress,
      value: 0n,
      callData: ethers.Interface.from([
        'function setSpendingRules(tuple(uint256 timeWindow, uint160 budget, uint96 initialWindowStartTime, bytes32[] targetProviders)[] calldata rules)'
      ]).encodeFunctionData('setSpendingRules', [rulesToSet]),
      paymasterAndData: '0x', // Force Self-Pay to bypass AA33 Paymaster rejection
    } as any;

    const result = await sdk.sendUserOperationAndWait(
      signerEOA,
      configureRequest,
      signFunction,
      undefined, // salt
      '0x'       // paymasterAddress = '0x' to disable Paymaster (Self-Pay mode)
    );

    if (result.status.status === 'success') {
      console.log(`✅ Spending Rules configured: ${result.status.transactionHash}`);
      return {
        success: true,
        txHash: result.status.transactionHash,
      };
    } else {
      console.error('❌ Configure failed:', result.status.reason);
      return {
        success: false,
        error: result.status.reason || 'Configure failed',
      };
    }
  } catch (error: any) {
    console.error('❌ Configure error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during configure',
    };
  }
}

// ============================================================================
// 只读操作
// ============================================================================

/**
 * 查看 Spending Rules
 */
export async function viewSpendingRules(
  kitepassAddress: string
): Promise<{ success: boolean; rules?: any[]; error?: string }> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(
      kitepassAddress,
      ['function getSpendingRules() view returns (tuple(tuple(uint256 timeWindow, uint160 budget, uint96 initialWindowStartTime, bytes32[] targetProviders) rule, tuple(uint128 amountUsed, uint128 currentTimeWindowStartTime) usage)[])'],
      provider
    );

    const spendingRules = await contract.getSpendingRules();
    return {
      success: true,
      rules: spendingRules.map((rule: any, index: number) => ({
        index,
        timeWindow: Number(rule.rule.timeWindow),
        budget: ethers.formatUnits(rule.rule.budget, 18),
        used: ethers.formatUnits(rule.usage.amountUsed, 18),
        providersCount: rule.rule.targetProviders.length,
      })),
    };
  } catch (error: any) {
    console.error('❌ View rules error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 查询金库余额
 */
export async function getVaultBalance(
  kitepassAddress: string,
  tokenAddress: string = ADDRESSES.SETTLEMENT_TOKEN
): Promise<{ success: boolean; balance?: string; symbol?: string; error?: string }> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function balanceOf(address account) view returns (uint256)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
      ],
      provider
    );

    const [balance, symbol, decimals] = await Promise.all([
      tokenContract.balanceOf(kitepassAddress),
      tokenContract.symbol(),
      tokenContract.decimals(),
    ]);

    return {
      success: true,
      balance: ethers.formatUnits(balance, decimals),
      symbol,
    };
  } catch (error: any) {
    console.error('❌ Get balance error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// 资金提取
// ============================================================================

/**
 * 从 KitePass 提取资金
 */
export async function withdrawFunds(
  _targetEoaAddress: string,
  kitepassAddress: string,
  amount: string,
  privateKey: string,
  tokenAddress: string = ADDRESSES.SETTLEMENT_TOKEN
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const sdk = initKiteAA();
  
  // 从私钥获取对应的 EOA 地址
  const signerWallet = new ethers.Wallet(privateKey);
  const signerEOA = signerWallet.address;
  const signFunction = createSignFunction(privateKey);

  console.log(`💸 Withdrawing ${amount} from KitePass: ${kitepassAddress}`);
  console.log(`   Signer EOA: ${signerEOA}`);

  try {
    const withdrawRequest: UserOperationRequest = {
      target: kitepassAddress,
      value: 0n,
      callData: ethers.Interface.from([
        'function withdrawFunds(address token, uint256 amount)'
      ]).encodeFunctionData('withdrawFunds', [
        tokenAddress,
        ethers.parseUnits(amount, 18)
      ])
    };

    const result = await sdk.sendUserOperationAndWait(
      signerEOA,
      withdrawRequest,
      signFunction
    );

    if (result.status.status === 'success') {
      console.log(`✅ Withdraw success: ${result.status.transactionHash}`);
      return {
        success: true,
        txHash: result.status.transactionHash,
      };
    } else {
      console.error('❌ Withdraw failed:', result.status.reason);
      return {
        success: false,
        error: result.status.reason || 'Withdraw failed',
      };
    }
  } catch (error: any) {
    console.error('❌ Withdraw error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during withdraw',
    };
  }
}

/**
 * 批量转账给受益人
 */
export async function withdrawToBeneficiaries(
  eoaAddress: string,
  kitepassAddress: string,
  beneficiaries: { address: string; amount: string }[],
  privateKey: string
): Promise<{ success: boolean; transactions: { address: string; txHash?: string; amount: string; error?: string }[] }> {
  const results: { address: string; txHash?: string; amount: string; error?: string }[] = [];

  for (const beneficiary of beneficiaries) {
    console.log(`📤 Transferring ${beneficiary.amount} to ${beneficiary.address}`);
    
    const result = await withdrawFunds(
      eoaAddress,
      kitepassAddress,
      beneficiary.amount,
      privateKey
    );

    results.push({
      address: beneficiary.address,
      amount: beneficiary.amount,
      txHash: result.txHash,
      error: result.error,
    });

    // 如果有失败，继续处理下一个
    if (!result.success) {
      console.warn(`⚠️ Failed to transfer to ${beneficiary.address}: ${result.error}`);
    }
  }

  const allSuccess = results.every(r => !r.error);
  return {
    success: allSuccess,
    transactions: results,
  };
}
