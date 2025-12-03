// Minimal Base chain definition to avoid relying on viem's exported chains
export const baseChain = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.base.org'] } },
  testnet: false,
};

export default baseChain;
