export function explorerTx(hash: string, explorer: string) {
  return `${explorer.replace(/\/$/, "")}/tx/${hash}`;
}

export function explorerAddress(addr: string, explorer: string) {
  return `${explorer.replace(/\/$/, "")}/address/${addr}`;
}

export function explorerToken(collection: string, tokenId: number | string, explorer: string) {
  return `${explorer.replace(/\/$/, "")}/token/${collection}/instance/${tokenId}`;
}

export function isOnChainTx(ref: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(ref);
}

export function toChainHex(id: number) {
  return `0x${id.toString(16)}`;
}

export function gatewayUrl(uri: string) {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`;
  return uri;
}
