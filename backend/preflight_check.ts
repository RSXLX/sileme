import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { getAAWalletAddress } from './kiteSDKService.js';

dotenv.config();

const RPC_URL = process.env.KITE_RPC || 'https://rpc-testnet.gokite.ai';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const privateKey = process.env.CUSTODY_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('❌ No CUSTODY_PRIVATE_KEY found');
    return;
  }
  
  const wallet = new ethers.Wallet(privateKey, provider);
  const signerEOA = wallet.address;
  
  console.log('=== Pre-flight Check ===');
  console.log(`Signer EOA: ${signerEOA}`);
  
  // Get AA address (Salt=1)
  const aaAddress = await getAAWalletAddress(signerEOA);
  console.log(`AA Address (Salt=1): ${aaAddress}`);
  
  // Check AA wallet code (deployed?)
  const code = await provider.getCode(aaAddress);
  const isDeployed = code.length > 2;
  console.log(`AA Deployed: ${isDeployed ? '✅ YES' : '❌ NO'}`);
  
  // Check AA wallet balance
  const aaBalance = await provider.getBalance(aaAddress);
  console.log(`AA Balance: ${ethers.formatEther(aaBalance)} KITE`);
  
  // Check Signer EOA balance
  const eoaBalance = await provider.getBalance(signerEOA);
  console.log(`EOA Balance: ${ethers.formatEther(eoaBalance)} KITE`);
  
  // Minimum balance check
  const minBalance = ethers.parseEther('0.01');
  if (aaBalance < minBalance && !isDeployed) {
    console.log('\\n⚠️ AA wallet needs funding for Self-Pay deployment!');
    console.log(`   Transferring 0.02 KITE from EOA to AA...`);
    
    try {
      const tx = await wallet.sendTransaction({
        to: aaAddress,
        value: ethers.parseEther('0.02')
      });
      console.log(`   Tx sent: ${tx.hash}`);
      await tx.wait();
      console.log('   ✅ Funding complete!');
      
      const newBalance = await provider.getBalance(aaAddress);
      console.log(`   New AA Balance: ${ethers.formatEther(newBalance)} KITE`);
    } catch (e: any) {
      console.error('   ❌ Funding failed:', e.message);
    }
  } else if (isDeployed) {
    console.log('\\n✅ AA wallet already deployed - deploy will skip');
  } else {
    console.log('\\n✅ AA wallet has sufficient balance for Self-Pay');
  }
  
  console.log('\\n=== Pre-flight Check Complete ===');
}

main().catch(console.error);
