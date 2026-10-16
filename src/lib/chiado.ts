import { defineChain } from "viem";

export const CHIADO_ID = 10200;
export const CHIADO_HEX = "0x27d8";
export const CHIADO_RPC = "https://rpc.chiadochain.net";
export const CHIADO_EXPLORER = "https://gnosis-chiado.blockscout.com";
export const CHIADO_FAUCET = "https://faucet.chiadochain.net/";

export const chiadoChain = defineChain({
  id: CHIADO_ID,
  name: "Gnosis Chiado",
  nativeCurrency: { name: "Chiado xDAI", symbol: "XDAI", decimals: 18 },
  rpcUrls: {
    default: { http: [CHIADO_RPC] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: CHIADO_EXPLORER },
  },
});

export const CHIADO_ADD_PARAMS = {
  chainId: CHIADO_HEX,
  chainName: "Gnosis Chiado Testnet",
  nativeCurrency: { name: "Chiado xDAI", symbol: "XDAI", decimals: 18 },
  rpcUrls: [CHIADO_RPC],
  blockExplorerUrls: [CHIADO_EXPLORER],
};

export const LABS_WALLET = "0x1111111111111111111111111111111111111111";
export const FAN_WALLET = "0x2222222222222222222222222222222222222222";

export function explorerTx(hash: string, explorer = CHIADO_EXPLORER) {
  return `${explorer.replace(/\/$/, "")}/tx/${hash}`;
}

export function explorerAddress(addr: string, explorer = CHIADO_EXPLORER) {
  return `${explorer.replace(/\/$/, "")}/address/${addr}`;
}

export function isOnChainTx(ref: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(ref);
}
