export type TicketMetadataShape = { name?: unknown; image?: unknown; [key: string]: unknown };
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function publicUrl(value: string) {
  if (value.startsWith("ipfs://")) {
    const cid = value.slice(7).replace(/^ipfs\//, "");
    if (!/^[a-zA-Z0-9]{20,120}$/.test(cid)) throw new Error("Metadata contains an invalid IPFS image CID.");
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname.endsWith(".local") || /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) {
    throw new Error("Metadata image must use a publicly reachable HTTPS URL.");
  }
  return url.toString();
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
  throw new Error(`Public gateway could not read ${url} (${message}). Check Pinata pin status and gateway availability.`);
}

export async function verifyTicketMetadata(uri: string, fetcher: FetchLike = fetch, options: { attempts?: number; delayMs?: number } = {}) {
  if (!/^https:\/\/gateway\.pinata\.cloud\/ipfs\/[a-zA-Z0-9]{20,120}(?:[/?#].*)?$/.test(uri)) {
    throw new Error(`Pinata returned an invalid metadata URI: ${uri}`);
  }
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 350;
  const response = await fetchRetry(fetcher, uri, attempts, delayMs);
  let metadata: TicketMetadataShape;
  try { metadata = await response.json() as TicketMetadataShape; }
  catch { throw new Error(`Pinned metadata is not valid JSON: ${uri}`); }
  if (typeof metadata.name !== "string" || !metadata.name.trim()) throw new Error(`Pinned metadata JSON is missing a non-empty name: ${uri}`);
  if (typeof metadata.image !== "string" || !metadata.image.trim()) throw new Error(`Pinned metadata JSON is missing a non-empty image: ${uri}`);
  const imageUrl = publicUrl(metadata.image);
  const image = await fetchRetry(fetcher, imageUrl, attempts, delayMs);
  const contentType = image.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) throw new Error(`Metadata image URL did not return an image (Content-Type: ${contentType || "missing"}): ${imageUrl}`);
  if ((await image.arrayBuffer()).byteLength === 0) throw new Error(`Metadata image URL returned an empty image: ${imageUrl}`);
  return { uri, metadata, imageUrl };
}
