export type TicketMetadataShape = { name?: unknown; image?: unknown; [key: string]: unknown };
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// Multiple independent public gateways avoid making Pinata's shared gateway
// the only read path. Keep canonical IPFS URIs in metadata and tokenURI.
const IPFS_GATEWAY_BASES = [
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];
const CID_RE = /^[a-zA-Z0-9]{20,120}$/;

function ipfsCid(value: string): string | null {
  if (value.startsWith("ipfs://")) {
    const cid = value.slice("ipfs://".length).replace(/^ipfs\//, "").split(/[/?#]/, 1)[0] ?? "";
    return CID_RE.test(cid) ? cid : null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const match = url.pathname.match(/^\/ipfs\/([^/]+)(?:\/|$)/i);
    return match && CID_RE.test(match[1]!) ? match[1]! : null;
  } catch {
    return null;
  }
}

function gatewayUrls(cid: string, preferredGateway?: string) {
  const bases = [
    preferredGateway?.trim().replace(/\/+$/, "").replace(/\/ipfs$/i, ""),
    ...IPFS_GATEWAY_BASES.map((base) => base.replace(/\/ipfs\/$/i, "")),
  ].filter((base): base is string => Boolean(base));
  return [...new Set(bases)].map((base) => `${base}/ipfs/${cid}`);
}

async function fetchRetry(fetcher: FetchLike, url: string, attempts: number, delayMs: number) {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
      if (response.ok) return response;
      last = new Error(`HTTP ${response.status}`);
    } catch (error) { last = error; }
    if (i + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const message = last instanceof Error ? last.message : "gateway unavailable";
  throw new Error(`IPFS gateway could not read ${url} (${message}). Check that the CID is pinned and the gateway is reachable.`);
}

async function fetchIpfs(fetcher: FetchLike, cid: string, attempts: number, delayMs: number, preferredGateway?: string) {
  let last: unknown;
  for (const url of gatewayUrls(cid, preferredGateway)) {
    try {
      return { response: await fetchRetry(fetcher, url, attempts, delayMs), url };
    } catch (error) {
      last = error;
    }
  }
  const message = last instanceof Error ? last.message : "all configured gateways failed";
  throw new Error(`Could not retrieve IPFS CID ${cid} from the configured gateways. ${message}`);
}

async function fetchContent(fetcher: FetchLike, uri: string, attempts: number, delayMs: number, preferredGateway?: string) {
  const cid = ipfsCid(uri);
  if (cid) return fetchIpfs(fetcher, cid, attempts, delayMs, preferredGateway);
  const url = new URL(uri);
  if (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname.endsWith(".local") || /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) {
    throw new Error("Metadata image must use an IPFS URI or publicly reachable HTTPS URL.");
  }
  return { response: await fetchRetry(fetcher, url.toString(), attempts, delayMs), url: url.toString() };
}

export async function verifyTicketMetadata(uri: string, fetcher: FetchLike = fetch, options: { attempts?: number; delayMs?: number; preferredGateway?: string } = {}) {
  if (!ipfsCid(uri)) throw new Error(`Pinata returned an invalid metadata URI: ${uri}`);
  const attempts = options.attempts ?? 2;
  const delayMs = options.delayMs ?? 350;
  const { response, url } = await fetchIpfs(fetcher, ipfsCid(uri)!, attempts, delayMs, options.preferredGateway);
  let metadata: TicketMetadataShape;
  try { metadata = await response.json() as TicketMetadataShape; }
  catch { throw new Error(`Pinned metadata is not valid JSON: ${uri}`); }
  if (typeof metadata.name !== "string" || !metadata.name.trim()) throw new Error(`Pinned metadata JSON is missing a non-empty name: ${uri}`);
  if (typeof metadata.image !== "string" || !metadata.image.trim()) throw new Error(`Pinned metadata JSON is missing a non-empty image: ${uri}`);
  const image = await fetchContent(fetcher, metadata.image, attempts, delayMs, options.preferredGateway);
  const contentType = image.response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) throw new Error(`Metadata image URL did not return an image (Content-Type: ${contentType || "missing"}): ${image.url}`);
  if ((await image.response.arrayBuffer()).byteLength === 0) throw new Error(`Metadata image URL returned an empty image: ${image.url}`);
  return { uri, metadata, metadataUrl: url, imageUrl: image.url };
}
