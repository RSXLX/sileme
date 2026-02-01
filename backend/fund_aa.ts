import { ethers } from 'ethers';
import dotenv from 'dotenv';

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
  const aaAddress = '0x48b7EA1C57Ba21B40d2bEe731a928F73CEee44d6';
  
  console.log('=== Funding AA Wallet ===');
  console.log(`EOA: ${signerEOA}`);
  console.log(`AA: ${aaAddress}`);
  
  // Check balances
  const eoaBalance = await provider.getBalance(signerEOA);
  const aaBalance = await provider.getBalance(aaAddress);
  
  console.log(`EOA Balance: ${ethers.formatEther(eoaBalance)} KITE`);
  console.log(`AA Balance: ${ethers.formatEther(aaBalance)} KITE`);
  
  // Transfer if AA needs funds
  if (aaBalance < ethers.parseEther('0.02')) {
    const transferAmount = ethers.parseEther('0.03');
    console.log(`\n💸 Transferring ${ethers.formatEther(transferAmount)} KITE to AA wallet...`);
    
    try {
      const tx = await wallet.sendTransaction({
        to: aaAddress,
        value: transferAmount
      });
      console.log(`Tx Hash: ${tx.hash}`);
      console.log('Waiting for confirmation...');
      await tx.wait();
      console.log('✅ Transfer confirmed!');
      
      const newAaBalance = await provider.getBalance(aaAddress);
      console.log(`New AA Balance: ${ethers.formatEther(newAaBalance)} KITE`);
    } catch (e: any) {
      console.error('❌ Transfer failed:', e.message);
      return;
    }
  } else {
    console.log('\n✅ AA wallet already has sufficient funds');
  }
  
  console.log('\n=== Ready for Deployment ===');
  console.log('You can now restart backend and click Deploy!');
}

main().catch(console.error);
