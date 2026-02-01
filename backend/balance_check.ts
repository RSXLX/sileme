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
  
  console.log('=== Balance Check ===');
  console.log(`Signer EOA: ${signerEOA}`);
  
  // Check Signer EOA balance
  const eoaBalance = await provider.getBalance(signerEOA);
  console.log(`EOA Balance: ${ethers.formatEther(eoaBalance)} KITE`);
  
  // AA Address (hardcoded for quick check)
  const aaAddress = '0x48b7EA1C57Ba21B40d2bEe731a928F73CEee44d6';
  console.log(`AA Address: ${aaAddress}`);
  
  // Check AA wallet balance
  const aaBalance = await provider.getBalance(aaAddress);
  console.log(`AA Balance: ${ethers.formatEther(aaBalance)} KITE`);
  
  // Check if deployed
  const code = await provider.getCode(aaAddress);
  console.log(`AA Deployed: ${code.length > 2 ? 'YES' : 'NO'}`);
  
  console.log('\\n=== Required for Self-Pay ===');
  console.log('Minimum needed: ~0.01 KITE in AA wallet');
  
  if (aaBalance < ethers.parseEther('0.01')) {
    console.log('\\n❌ AA wallet needs more funds!');
    if (eoaBalance < ethers.parseEther('0.02')) {
      console.log('❌ EOA also has insufficient funds to transfer!');
      console.log('ACTION REQUIRED: Please fund your EOA wallet with testnet KITE');
    } else {
      console.log('✅ EOA has funds, can transfer to AA');
    }
  } else {
    console.log('\\n✅ AA wallet has sufficient funds for Self-Pay');
  }
}

main().catch(console.error);
