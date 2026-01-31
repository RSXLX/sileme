/**
 * WillVault 快速部署脚本
 * 直接使用 ethers.js 部署简化版合约
 */

import { ethers } from 'ethers';

// Kite Testnet 配置
const KITE_RPC = 'https://rpc-testnet.gokite.ai';
const CHAIN_ID = 2368;

// 简化版 WillVault 合约 (内联)
// 为了快速部署，使用简化的合约代码
const SIMPLE_VAULT_BYTECODE = `0x608060405234801561000f575f80fd5b50336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055504260018190555062ed4e00600281905550610924806100705f395ff3fe60806040526004361061009b575f3560e01c8063893d20e811610063578063893d20e81461014d5780639714378c14610177578063b6b55f25146101a1578063d0e30db0146101bd578063f7260d3e146101c7578063fc0c546a146101f157610142565b806312065fe0146101465780633ccfd60b14610170578063412753581461017a57806359818ff1146101845780637e8afa331461018e57610142565b36610142575f805f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055504260018190555062ed4e00600154016002819055507f90890809c654f11d6e72a28fa60149770a0d11ec6c92319d6ceb2bb0a4ea1a1530346040516101359291906106ad565b60405180910390a1005b5f80fd5b610146610219565b005b348015610157575f80fd5b50610160610220565b60405161016d91906106d4565b60405180910390f35b610178610228565b005b610182610228565b005b61018c6102c7565b005b348015610199575f80fd5b506101a2610366565b005b6101bb60048036038101906101b69190610720565b610405565b005b6101c5610405565b005b3480156101d2575f80fd5b506101db6104a1565b6040516101e891906106d4565b60405180910390f35b3480156101fc575f80fd5b50610205610220565b60405161021291906106d4565b60405180910390f35b5f47905090565b5f4790505b90565b5f8054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461027e575f80fd5b5f4790505f8054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc8290811502906040515f60405180830381858888f193505050505050565b5f8054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461031d575f80fd5b4260018190555062ed4e006001540160028190555060017f90890809c654f11d6e72a28fa60149770a0d11ec6c92319d6ceb2bb0a4ea1a15334260405161035f9291906106ad565b60405180910390a1565b5f8054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146103bf575f80fd5b6002544210156103cd575f80fd5b5f4790505f8054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc8290811502906040515f60405180830381858888f193505050505050565b5f8054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461045b575f80fd5b4260018190555062ed4e006001540160028190555060017f90890809c654f11d6e72a28fa60149770a0d11ec6c92319d6ceb2bb0a4ea1a1530346040516104979291906106ad565b60405180910390a1565b5f60025490509056fea2646970667358221220c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c464736f6c634300081c0033`;

// 简化版 ABI
const SIMPLE_VAULT_ABI = [
  "function deposit() external payable",
  "function withdraw() external",
  "function heartbeat() external",
  "function execute() external",
  "function getBalance() external view returns (uint256)",
  "function unlockTime() external view returns (uint256)",
  "function owner() external view returns (address)",
  "event Deposited(address indexed from, uint256 amount, uint256 timestamp)"
];

async function deploy() {
  const privateKey = process.argv[2] || process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.log('Usage: npx tsx scripts/quickDeploy.ts <PRIVATE_KEY>');
    process.exit(1);
  }

  console.log('🚀 Deploying SimpleVault to Kite Testnet...');
  console.log(`📡 RPC: ${KITE_RPC}`);
  
  // 创建 provider 和 wallet
  const provider = new ethers.JsonRpcProvider(KITE_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log(`📍 Deployer: ${wallet.address}`);
  
  // 检查网络
  const network = await provider.getNetwork();
  console.log(`🌐 Network: Chain ID ${network.chainId}`);
  
  // 检查余额
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} KITE`);
  
  if (balance === 0n) {
    console.error('❌ No KITE balance!');
    console.log('🔗 Get testnet tokens from: https://faucet.gokite.ai');
    process.exit(1);
  }
  
  // 部署合约
  console.log('📦 Deploying contract...');
  
  const factory = new ethers.ContractFactory(SIMPLE_VAULT_ABI, SIMPLE_VAULT_BYTECODE, wallet);
  
  try {
    const contract = await factory.deploy({
      gasLimit: 500000n,
    });
    
    console.log(`⏳ TX Hash: ${contract.deploymentTransaction()?.hash}`);
    console.log(`🔗 TX Explorer: https://testnet.kitescan.ai/tx/${contract.deploymentTransaction()?.hash}`);
    
    console.log('⏳ Waiting for confirmation...');
    await contract.waitForDeployment();
    
    const address = await contract.getAddress();
    
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('✅ CONTRACT DEPLOYED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════');
    console.log(`📍 Contract Address: ${address}`);
    console.log(`🔗 Explorer: https://testnet.kitescan.ai/address/${address}`);
    console.log('═══════════════════════════════════════════');
    
    // 保存地址
    console.log('');
    console.log('💡 Add this to your .env.local:');
    console.log(`VITE_VAULT_ADDRESS=${address}`);
    
  } catch (error: any) {
    console.error('❌ Deployment failed:', error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.log('🔗 Get testnet tokens from: https://faucet.gokite.ai');
    }
  }
}

deploy();
