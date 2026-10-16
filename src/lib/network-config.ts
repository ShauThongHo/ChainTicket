export const CHIADO_CHAIN_ID = 10200;
export const GNOSIS_MAINNET_CHAIN_ID = 100;

export const NETWORK_PRESETS = {
  chiado: { chainId: CHIADO_CHAIN_ID, chainName: "Gnosis Chiado", nativeSymbol: "XDAI", rpcUrl: "https://rpc.chiadochain.net", explorerUrl: "https://gnosis-chiado.blockscout.com" },
  gnosis: { chainId: GNOSIS_MAINNET_CHAIN_ID, chainName: "Gnosis", nativeSymbol: "xDAI", rpcUrl: "https://rpc.gnosischain.com", explorerUrl: "https://gnosisscan.io" },
} as const;

export function isGnosisMainnet(chainId: number) {
  return chainId === GNOSIS_MAINNET_CHAIN_ID;
}

export function assertChainIdMatches(expected: number, actual: number) {
  if (expected !== actual) {
    throw new Error(`Configured network expects chain ID ${expected}, but RPC reports ${actual}. No on-chain write was sent. Correct the Admin network settings.`);
  }
}

export function assertNetworkChangeAllowed(current: number, next: number, eventCount: number) {
  if (current !== next && eventCount > 0) {
    throw new Error(`This database already contains events for chain ID ${current}. Use a separate deployment and database for chain ID ${next}.`);
  }
}
