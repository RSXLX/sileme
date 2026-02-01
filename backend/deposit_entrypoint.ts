import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.KITE_RPC || 'https://rpc-testnet.gokite.ai';
const ENTRY_POINT = '0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108';
const AA_ADDRESS = '0x48b7EA1C57Ba21B40d2bEe731a928F73CEee44d6';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const privateKey = process.env.CUSTODY_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('❌ No CUSTODY_PRIVATE_KEY found');
    return;
  }
  
  const wallet = new ethers.Wallet(privateKey, provider);
  const signerEOA = wallet.address;
  
  console.log('=== EntryPoint Deposit for AA21 Fix ===');
  console.log(`EOA: ${signerEOA}`);
  console.log(`AA: ${AA_ADDRESS}`);
  console.log(`EntryPoint: ${ENTRY_POINT}`);
  
  // Check current deposit
  const entryPoint = new ethers.Contract(ENTRY_POINT, [
    'function balanceOf(address account) view returns (uint256)',
    'function depositTo(address account) payable'
  ], wallet);
  
  const currentDeposit = await entryPoint.balanceOf(AA_ADDRESS);
  console.log(`\nCurrent AA deposit in EntryPoint: ${ethers.formatEther(currentDeposit)} KITE`);
  
  // Calculate deposit amount (0.05 KITE should be enough for gas)
  const depositAmount = ethers.parseEther('0.05');
  
  if (currentDeposit < depositAmount / 2n) {
    console.log(`\n💰 Depositing ${ethers.formatEther(depositAmount)} KITE to EntryPoint for AA wallet...`);
    
    try {
      const tx = await entryPoint.depositTo(AA_ADDRESS, { value: depositAmount });
      console.log(`Tx Hash: ${tx.hash}`);
      console.log('Waiting for confirmation...');
      await tx.wait();
      console.log('✅ Deposit confirmed!');
      
      const newDeposit = await entryPoint.balanceOf(AA_ADDRESS);
      console.log(`New AA deposit in EntryPoint: ${ethers.formatEther(newDeposit)} KITE`);
    } catch (e: any) {
      console.error('❌ Deposit failed:', e.message);
      return;
    }
  } else {
    console.log('✅ AA already has sufficient deposit in EntryPoint');
  }
  
  console.log('\n=== Ready for Deployment ===');
  console.log('Restart backend and click Deploy!');
}

main().catch(console.error);
