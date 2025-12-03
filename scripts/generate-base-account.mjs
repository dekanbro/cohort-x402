import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

async function main() {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);

  console.log('New Base account generated');
  console.log('Address:', account.address);
  console.log('Private key (keep this secret!):', pk);
  console.log('');
  console.log('Next steps:');
  console.log('- Send ~0.00001 ETH on Base to this address for gas.');
  console.log('- Send ~0.01 USDC on Base to this address for payments.');
  console.log('- Add the private key to your env, for example:');
  console.log('    AGENT_PRIVATE_KEY=', pk);
}

main().catch((err) => {
  console.error('Failed to generate account', err);
  process.exit(1);
});