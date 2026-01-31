/**
 * 编译并部署 DeathCertificateRegistry 合约到 Kite Testnet
 * 
 * 使用方法:
 *   node deploy.js
 */

const solc = require('solc');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Kite Testnet 配置
const KITE_RPC = 'https://rpc-testnet.gokite.ai';

// 部署者私钥
const DEPLOYER_PRIVATE_KEY = '3cdf8ed8657b4dbb0cb06b231a90f2caa272a936e26dfacf93df5024d5d857fc';

async function main() {
  console.log('🚀 Compiling and Deploying DeathCertificateRegistry...\n');

  // 读取合约源码
  const contractPath = path.join(__dirname, '..', 'contracts', 'DeathCertificateRegistry.sol');
  const source = fs.readFileSync(contractPath, 'utf8');

  console.log('📝 Compiling contract...');

  // 编译合约
  const input = {
    language: 'Solidity',
    sources: {
      'DeathCertificateRegistry.sol': {
        content: source
      }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['*']
        }
      },
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  // 检查编译错误
  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      console.error('❌ Compilation errors:');
      errors.forEach(e => console.error(e.formattedMessage));
      process.exit(1);
    }
  }

  const contract = output.contracts['DeathCertificateRegistry.sol']['DeathCertificateRegistry'];
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  console.log('✅ Compilation successful!\n');

  // 创建 provider 和 wallet
  const provider = new ethers.JsonRpcProvider(KITE_RPC);
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

  console.log(`📍 Network: Kite Testnet`);
  console.log(`👛 Deployer: ${wallet.address}`);

  // 检查余额
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} KITE\n`);

  if (balance === 0n) {
    throw new Error('Deployer has no KITE balance!');
  }

  // 创建合约工厂
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  // 部署合约
  console.log('📝 Deploying contract...');
  const deployedContract = await factory.deploy(wallet.address);

  console.log(`⏳ TX Hash: ${deployedContract.deploymentTransaction()?.hash}`);
  console.log('⏳ Waiting for confirmation...\n');

  await deployedContract.waitForDeployment();
  const contractAddress = await deployedContract.getAddress();

  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ Contract deployed successfully!');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // 验证部署
  const admin = await deployedContract.admin();
  const recorder = await deployedContract.recorder();
  console.log(`👤 Admin: ${admin}`);
  console.log(`📝 Recorder: ${recorder}\n`);

  console.log('🔧 Next steps:');
  console.log(`   1. Add to backend/.env: DEATH_CERTIFICATE_ADDRESS=${contractAddress}`);
  console.log('   2. Restart backend service');
  console.log('   3. Test will execution\n');

  // 保存部署信息
  const deployInfo = {
    network: 'kite-testnet',
    contract: 'DeathCertificateRegistry',
    address: contractAddress,
    deployer: wallet.address,
    txHash: deployedContract.deploymentTransaction()?.hash,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(
    path.join(__dirname, 'deploy-result.json'),
    JSON.stringify(deployInfo, null, 2)
  );
  console.log('📄 Deploy info saved to scripts/deploy-result.json');
}

main().catch((error) => {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
});
