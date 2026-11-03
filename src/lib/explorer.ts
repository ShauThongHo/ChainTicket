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

export function gatewayUrl(uri: string, preferredGateway?: string) {
  if (!uri) return "";
  const base = (preferredGateway || "https://dweb.link").replace(/\/+$/, "").replace(/\/ipfs$/i, "");
  if (uri.startsWith("ipfs://")) return `${base}/ipfs/${uri.slice(7).replace(/^ipfs\//, "")}`;
  const ipfsPath = uri.match(/^https?:\/\/[^/]+\/ipfs\/([^?#]+)/i);
  if (ipfsPath?.[1]) return `${base}/ipfs/${ipfsPath[1]}`;
  return uri;
}
