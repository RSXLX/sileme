
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL = process.env.KITE_RPC || 'https://rpc-testnet.gokite.ai';
const NEW_ADDRESS = '0x48b7EA1C57Ba21B40d2bEe731a928F73CEee44d6'; // The Salt=1 address

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  console.log(`Checking status for NEW Address: ${NEW_ADDRESS}`);
  
  const code = await provider.getCode(NEW_ADDRESS);
  console.log(`Code Length: ${code.length}`);
  
  if (code.length > 2) {
      console.log('✅ Account IS deployed on-chain.');
  } else {
      console.log('❌ Account is NOT deployed.');
  }

  const balance = await provider.getBalance(NEW_ADDRESS);
  console.log(`Balance: ${ethers.formatEther(balance)} KITE`);
}

main().catch(console.error);
