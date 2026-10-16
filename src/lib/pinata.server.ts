import { loadInfra } from "@/lib/infra.server";
import { getSql } from "@/lib/db";
import { verifyTicketMetadata } from "@/lib/ticket-metadata";

async function jwt() {
  const sql = await getSql();
  const infra = await loadInfra(sql);
  if (!infra.pinataJwt) throw new Error("Pinata JWT is not set. Add it in Admin.");
  return infra.pinataJwt;
}

export async function pinFile(opts: { filename: string; contentType: string; bytes: Buffer }) {
  const token = await jwt();
  const form = new FormData();
  const blob = new Blob([new Uint8Array(opts.bytes)], { type: opts.contentType || "application/octet-stream" });
  form.append("file", blob, opts.filename || "poster.jpg");
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as { IpfsHash?: string; error?: { reason?: string } };
  if (!res.ok || !json.IpfsHash) {
    if (res.status === 401 || res.status === 403) throw new Error("Pinata rejected the JWT. Check that it is valid and has permission to pin files.");
    throw new Error(json.error?.reason || `Pinata image upload failed (HTTP ${res.status}).`);
  }
  if (!/^[a-zA-Z0-9]{20,120}$/.test(json.IpfsHash)) throw new Error("Pinata returned an invalid image CID.");
  return {
    cid: json.IpfsHash,
    uri: `ipfs://${json.IpfsHash}`,
    url: `https://gateway.pinata.cloud/ipfs/${json.IpfsHash}`,
  };
}

export async function pinJson(content: Record<string, unknown>, name: string) {
  const token = await jwt();
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataContent: content,
      pinataMetadata: { name: name.slice(0, 80) || "chainticket.json" },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { IpfsHash?: string; error?: { reason?: string } };
  if (!res.ok || !json.IpfsHash) {
    if (res.status === 401 || res.status === 403) throw new Error("Pinata rejected the JWT. Check that it is valid and has permission to pin JSON.");
    throw new Error(json.error?.reason || `Pinata metadata upload failed (HTTP ${res.status}).`);
  }
  if (!/^[a-zA-Z0-9]{20,120}$/.test(json.IpfsHash)) throw new Error("Pinata returned an invalid metadata CID.");
  return {
    cid: json.IpfsHash,
    uri: `ipfs://${json.IpfsHash}`,
    url: `https://gateway.pinata.cloud/ipfs/${json.IpfsHash}`,
  };
}

export function toIpfsUri(url: string) {
  const m = url.match(/\/ipfs\/([^/?#]+)/i);
  if (m?.[1]) return `ipfs://${m[1]}`;
  if (url.startsWith("ipfs://")) return url;
  return url;
}

/** HTTPS gateway form. Explorers preview this; the CID is still in the path. */
export function toHttpsGateway(raw: string) {
  const url = raw.trim();
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    const cid = url.slice("ipfs://".length).replace(/^ipfs\//, "");
    return cid ? `https://gateway.pinata.cloud/ipfs/${cid}` : "";
  }
  const m = url.match(/\/ipfs\/([^/?#]+)/i);
  if (m?.[1]) return `https://gateway.pinata.cloud/ipfs/${m[1]}`;
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  return "";
}

export async function pinTicketMetadata(opts: {
  eventName: string;
  description: string;
  venue: string;
  tierName: string;
  faceCents: number;
  imageUrl: string;
}) {
  // Testnet explorers often skip ipfs:// art. `image` is an https URL a normal
  // browser can open. tokenURI itself is the gateway URL of this JSON (CID in the path).
  // Indexers on Chiado can still lag — a readable tokenURI is the check.
  let image = toHttpsGateway(opts.imageUrl);
  if (!image) {
    const label = opts.eventName.replace(/[<>&]/g, "") || "ChainTicket";
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#14110d"/>
        <text x="400" y="380" text-anchor="middle" fill="#f4efe4" font-size="36" font-family="serif">${label}</text>
        <text x="400" y="440" text-anchor="middle" fill="#c4b49a" font-size="22" font-family="sans-serif">${opts.tierName.replace(/[<>&]/g, "")}</text>
      </svg>`,
      "utf8",
    );
    const file = await pinFile({ filename: "ticket.svg", contentType: "image/svg+xml", bytes: svg });
    image = file.url;
  }
  const pinned = await pinJson(
    {
      name: `${opts.eventName} — ${opts.tierName}`,
      description:
        opts.description.trim() ||
        `${opts.eventName} at ${opts.venue}. Soulbound to the event marketplace — no private transfers.`,
      image,
      attributes: [
        { trait_type: "Event", value: opts.eventName },
        { trait_type: "Tier", value: opts.tierName },
        { trait_type: "Venue", value: opts.venue },
        { trait_type: "Face", value: (opts.faceCents / 100).toFixed(2) },
      ],
    },
    `${opts.eventName}-${opts.tierName}.json`,
  );
  await verifyTicketMetadata(pinned.url);
  return pinned;
}
