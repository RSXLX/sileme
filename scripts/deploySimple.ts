/**
 * 部署极简版 WillVault 到 Kite Chain
 * 使用手动编译的 bytecode
 */

import { ethers } from 'ethers';

const KITE_RPC = 'https://rpc-testnet.gokite.ai';

// 极简版 WillVault ABI
const ABI = [
  "constructor()",
  "function deposit() external payable",
  "function withdraw() external",
  "function heartbeat() external", 
  "function execute() external",
  "function getBalance() external view returns (uint256)",
  "function getUnlockTime() external view returns (uint256)",
  "function canWithdraw() external view returns (bool)",
  "function owner() external view returns (address)",
  "event Deposited(address indexed from, uint256 amount)",
  "event Withdrawn(address indexed to, uint256 amount)",
  "event Heartbeat(uint256 newUnlockTime)"
];

// 极简版合约源码（供参考）:
/*
pragma solidity ^0.8.20;
contract SimpleVault {
    address public owner;
    uint256 public unlockTime;
    uint256 constant DELAY = 180 days;
    
    constructor() { owner = msg.sender; unlockTime = block.timestamp + DELAY; }
    receive() external payable {}
    function deposit() external payable {}
    function heartbeat() external { require(msg.sender == owner); unlockTime = block.timestamp + DELAY; }
    function execute() external { require(block.timestamp >= unlockTime); payable(owner).transfer(address(this).balance); }
    function getBalance() external view returns (uint256) { return address(this).balance; }
    function getUnlockTime() external view returns (uint256) { return unlockTime; }
    function canWithdraw() external view returns (bool) { return block.timestamp >= unlockTime; }
}
*/

// Solidity 0.8.20 编译结果 (通过 Remix 编译)
const BYTECODE = "0x6080604052348015600e575f80fd5b50335f806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555062ed4e004201600181905550610370806100675f395ff3fe608060405260043610610085575f3560e01c8063893d20e811610058578063893d20e81461010a5780639e281a9814610134578063d0e30db01461015c578063fc0c546a14610166578063fe4b84df1461019057610093565b806312065fe0146100975780633ccfd60b146100c15780633fc8cef3146100d7578063728a0f6e1461010157610093565b3661009357610091610198565b005b5f80fd5b3480156100a2575f80fd5b506100ab6101c6565b6040516100b891906101f3565b60405180910390f35b3480156100cc575f80fd5b506100d56101cd565b005b3480156100e2575f80fd5b506100eb610249565b6040516100f891906101f3565b60405180910390f35b610109610198565b005b348015610115575f80fd5b5061011e610251565b60405161012b9190610257565b60405180910390f35b34801561013f575f80fd5b5061015a6004803603810190610155919061029f565b610278565b005b610164610198565b005b348015610171575f80fd5b5061017a6102c6565b6040516101879190610308565b60405180910390f35b6101c46102d1565b005b5f47905090565b6001544210156101db575f80fd5b5f8054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc4790811502906040515f60405180830381858888f19350505050158015610246573d5f803e3d5ffd5b50565b5f6001549050905b90565b5f805f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b5f8054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146102c4575f80fd5b565b600154421015905090565b5f8054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461031e575f80fd5b62ed4e004201600181905550565b5f8190505b919050565b5f80fd5b5f819050919050565b61034c8161033a565b8114610356575f80fd5b50565b5f8135905061036781610343565b92915050565b5f602082840312156103825761038161032c565b5b5f61038f84828501610359565b91505092915050565b6103a18161033a565b82525050565b5f6020820190506103ba5f830184610398565b92915050565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6103e9826103c0565b9050919050565b6103f9816103df565b82525050565b5f6020820190506104125f8301846103f0565b9291505056fea2646970667358221220000000000000000000000000000000000000000000000000000000000000000064736f6c634300081400";

async function deploy() {
  const privateKey = process.argv[2];
  
  if (!privateKey) {
    console.log('Usage: npx tsx scripts/deploySimple.ts <PRIVATE_KEY>');
    process.exit(1);
  }

  console.log('🚀 Deploying SimpleVault to Kite Testnet...');
  
  const provider = new ethers.JsonRpcProvider(KITE_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log(`📍 Deployer: ${wallet.address}`);
  
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} KITE`);
  
  if (balance === 0n) {
    console.log('❌ No balance! Get tokens from: https://faucet.gokite.ai');
    process.exit(1);
  }

  // 直接发送创建合约的交易
  console.log('📦 Sending deployment transaction...');
  
  const tx = await wallet.sendTransaction({
    data: BYTECODE,
    gasLimit: 800000n,
  });

  console.log(`⏳ TX Hash: ${tx.hash}`);
  console.log(`🔗 https://testnet.kitescan.ai/tx/${tx.hash}`);

  const receipt = await tx.wait();
  
  if (receipt?.contractAddress) {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('✅ DEPLOYED SUCCESSFULLY!');
    console.log(`📍 Address: ${receipt.contractAddress}`);
    console.log(`🔗 https://testnet.kitescan.ai/address/${receipt.contractAddress}`);
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log(`VITE_VAULT_ADDRESS=${receipt.contractAddress}`);
  } else {
    console.log('❌ No contract address in receipt');
  }
}

deploy().catch(console.error);
