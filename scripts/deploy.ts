/**
 * WillVault 部署脚本
 * 使用 ethers.js 直接部署合约到 Kite Testnet
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Kite Testnet 配置
const KITE_RPC = 'https://rpc-testnet.gokite.ai';
const CHAIN_ID = 2368;

// ABI 和 Bytecode (编译后填入)
// 使用 solc 编译: npx solc --bin --abi contracts/WillVault.sol
const CONTRACT_ABI = [
  "constructor()",
  "function deposit() external payable",
  "function setBeneficiaries(tuple(address wallet, uint256 percentage, string name)[] memory _beneficiaries) external",
  "function setInactivityPeriod(uint256 _seconds) external",
  "function seal() external",
  "function heartbeat() external",
  "function execute() external",
  "function getBalance() external view returns (uint256)",
  "function getBeneficiaryCount() external view returns (uint256)",
  "function getStatus() external view returns (bool, bool, uint256, uint256, uint256, uint256)",
  "function canExecute() external view returns (bool)",
  "event Deposited(address indexed from, uint256 amount)",
  "event WillSealed(uint256 unlockTime)",
  "event Heartbeat(uint256 timestamp)",
  "event WillExecuted(uint256 totalDistributed)",
  "event FundsDistributed(address indexed beneficiary, uint256 amount)"
];

// 占位符 - 需要用 solc 编译后的 bytecode 替换
const CONTRACT_BYTECODE = "0x"; // TODO: 编译后填入

async function deploy(privateKey: string) {
  console.log('🚀 Deploying WillVault to Kite Testnet...');
  
  // 创建 provider 和 wallet
  const provider = new ethers.JsonRpcProvider(KITE_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log(`📍 Deployer address: ${wallet.address}`);
  
  // 检查余额
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} KITE`);
  
  if (balance === 0n) {
    console.error('❌ No KITE balance. Get testnet tokens from: https://faucet.gokite.ai');
    process.exit(1);
  }
  
  // 创建合约工厂
  const factory = new ethers.ContractFactory(CONTRACT_ABI, CONTRACT_BYTECODE, wallet);
  
  console.log('📦 Deploying contract...');
  const contract = await factory.deploy();
  
  console.log(`⏳ Waiting for deployment... TX: ${contract.deploymentTransaction()?.hash}`);
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log(`✅ WillVault deployed at: ${address}`);
  console.log(`🔗 Explorer: https://testnet.kitescan.ai/address/${address}`);
  
  // 保存部署信息
  const deployInfo = {
    address,
    network: 'kite_testnet',
    chainId: CHAIN_ID,
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
    txHash: contract.deploymentTransaction()?.hash,
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'deployed.json'),
    JSON.stringify(deployInfo, null, 2)
  );
  
  console.log('💾 Deployment info saved to contracts/deployed.json');
  
  return address;
}

// 从命令行获取私钥
const privateKey = process.argv[2];
if (!privateKey) {
  console.log('Usage: npx tsx scripts/deploy.ts <PRIVATE_KEY>');
  console.log('⚠️ Never share your private key!');
  process.exit(1);
}

deploy(privateKey).catch(console.error);
