import { r as getSql } from "./db-6MgyDrQq.mjs";
import { loadInfra } from "./infra.server-dbfo18Hy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pinata.server-BOywXToV.js
async function jwt() {
	const sql = await getSql();
	const infra = await loadInfra(sql);
	if (!infra.pinataJwt) throw new Error("Pinata JWT is not set. Add it in Admin.");
	return infra.pinataJwt;
}
async function pinFile(opts) {
	const token = await jwt();
	const form = new FormData();
	const blob = new Blob([new Uint8Array(opts.bytes)], { type: opts.contentType || "application/octet-stream" });
	form.append("file", blob, opts.filename || "poster.jpg");
	const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
		method: "POST",
		headers: { Authorization: `Bearer ${token}` },
		body: form
	});
	const json = await res.json();
	if (!res.ok || !json.IpfsHash) throw new Error(json.error?.reason || "Pinata upload failed.");
	return {
		cid: json.IpfsHash,
		uri: `ipfs://${json.IpfsHash}`,
		url: `https://gateway.pinata.cloud/ipfs/${json.IpfsHash}`
	};
}
async function pinJson(content, name) {
	const token = await jwt();
	const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			pinataContent: content,
			pinataMetadata: { name: name.slice(0, 80) || "chainticket.json" }
		})
	});
	const json = await res.json();
	if (!res.ok || !json.IpfsHash) throw new Error(json.error?.reason || "Pinata JSON pin failed.");
	return {
		cid: json.IpfsHash,
		uri: `ipfs://${json.IpfsHash}`,
		url: `https://gateway.pinata.cloud/ipfs/${json.IpfsHash}`
	};
}
/** HTTPS gateway form. Explorers preview this; the CID is still in the path. */
function toHttpsGateway(raw) {
	const url = raw.trim();
	if (!url) return "";
	if (url.startsWith("ipfs://")) {
		const cid = url.slice(7).replace(/^ipfs\//, "");
		return cid ? `https://gateway.pinata.cloud/ipfs/${cid}` : "";
	}
	const m = url.match(/\/ipfs\/([^/?#]+)/i);
	if (m?.[1]) return `https://gateway.pinata.cloud/ipfs/${m[1]}`;
	if (url.startsWith("https://") || url.startsWith("http://")) return url;
	return "";
}
async function pinTicketMetadata(opts) {
	let image = toHttpsGateway(opts.imageUrl);
	if (!image) {
		const label = opts.eventName.replace(/[<>&]/g, "") || "ChainTicket";
		image = (await pinFile({
			filename: "ticket.svg",
			contentType: "image/svg+xml",
			bytes: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#14110d"/>
        <text x="400" y="380" text-anchor="middle" fill="#f4efe4" font-size="36" font-family="serif">${label}</text>
        <text x="400" y="440" text-anchor="middle" fill="#c4b49a" font-size="22" font-family="sans-serif">${opts.tierName.replace(/[<>&]/g, "")}</text>
      </svg>`, "utf8")
		})).url;
	}
	return pinJson({
		name: `${opts.eventName} — ${opts.tierName}`,
		description: opts.description.trim() || `${opts.eventName} at ${opts.venue}. Soulbound to the event marketplace — no private transfers.`,
		image,
		attributes: [
			{
				trait_type: "Event",
				value: opts.eventName
			},
			{
				trait_type: "Tier",
				value: opts.tierName
			},
			{
				trait_type: "Venue",
				value: opts.venue
			},
			{
				trait_type: "Face",
				value: (opts.faceCents / 100).toFixed(2)
			}
		]
	}, `${opts.eventName}-${opts.tierName}.json`);
}
//#endregion
export { pinFile, pinTicketMetadata };
