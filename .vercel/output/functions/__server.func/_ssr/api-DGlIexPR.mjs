import { n as createServerFn, r as TSS_SERVER_FUNCTION, t as createMiddleware } from "./ssr.mjs";
import { c as string, i as boolean, n as _enum, r as array, s as object, t as number } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-DGlIexPR.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var walletMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
	let walletToken;
	if (typeof window !== "undefined") walletToken = localStorage.getItem("ct_session") ?? void 0;
	return next({ sendContext: { walletToken } });
}).server(async ({ next, context }) => {
	const { parseSessionToken } = await import("./session.server-U8N3VQgv.mjs").then((n) => n.i).then((n) => n.i);
	return next({ context: { wallet: parseSessionToken(context.walletToken) } });
});
function needWallet(wallet) {
	if (!wallet) throw new Error("Connect a wallet first.");
	return wallet;
}
var getNonce_createServerFn_handler = createServerRpc({
	id: "0aa128f44e37ba7661feddd968e7084bd024fbe4067317d40acb9f80c63120bb",
	name: "getNonce",
	filename: "src/lib/api.ts"
}, (opts) => getNonce.__executeServer(opts));
var getNonce = createServerFn({ method: "POST" }).handler(getNonce_createServerFn_handler, async () => {
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { issueNonce, loginMessage } = await import("./session.server-U8N3VQgv.mjs").then((n) => n.i).then((n) => n.i);
	const { boot } = await import("./engine.server-Cx2L_grV.mjs");
	const sql = await getSql();
	await boot(sql);
	const nonce = await issueNonce(sql);
	return {
		nonce,
		message: loginMessage(nonce)
	};
});
var verifyWallet_createServerFn_handler = createServerRpc({
	id: "0454c4bd8d650f0d68e87a97728d958ae3ad6646a5462060fdbb8a191aa19df5",
	name: "verifyWallet",
	filename: "src/lib/api.ts"
}, (opts) => verifyWallet.__executeServer(opts));
var verifyWallet = createServerFn({ method: "POST" }).validator(object({
	address: string(),
	signature: string(),
	nonce: string()
})).handler(verifyWallet_createServerFn_handler, async ({ data }) => {
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { consumeNonce, signSessionToken, verifyLoginSignature } = await import("./session.server-U8N3VQgv.mjs").then((n) => n.i).then((n) => n.i);
	await consumeNonce(await getSql(), data.nonce);
	const wallet = await verifyLoginSignature({
		address: data.address,
		signature: data.signature,
		nonce: data.nonce
	});
	return {
		token: signSessionToken(wallet),
		address: wallet
	};
});
var fetchMe_createServerFn_handler = createServerRpc({
	id: "c14007cac95ee9de5072cd82a3a383b762adb9ecd2dbc8a2c5885fe10cf50e88",
	name: "fetchMe",
	filename: "src/lib/api.ts"
}, (opts) => fetchMe.__executeServer(opts));
var fetchMe = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(fetchMe_createServerFn_handler, async ({ context }) => {
	if (!context.wallet) return null;
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { getMe } = await import("./engine.server-Cx2L_grV.mjs");
	return getMe(await getSql(), context.wallet);
});
var fetchSpendable_createServerFn_handler = createServerRpc({
	id: "ae9635df2c25aac87ee58fb3bd4dda80c1fa7a935f68b062bf61231559d5e0f7",
	name: "fetchSpendable",
	filename: "src/lib/api.ts"
}, (opts) => fetchSpendable.__executeServer(opts));
var fetchSpendable = createServerFn({ method: "GET" }).middleware([walletMiddleware]).validator(object({ fresh: boolean().optional() })).handler(fetchSpendable_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { spendableBalance } = await import("./engine.server-Cx2L_grV.mjs");
	return spendableBalance(await getSql(), wallet, Boolean(data.fresh));
});
var fetchEvents_createServerFn_handler = createServerRpc({
	id: "6a9fbd3c326c5fe198ece527d7ab93f544651d70c4e0ccd1cfd47f0611178bfd",
	name: "fetchEvents",
	filename: "src/lib/api.ts"
}, (opts) => fetchEvents.__executeServer(opts));
var fetchEvents = createServerFn({ method: "GET" }).middleware([walletMiddleware]).validator(object({ q: string().optional() })).handler(fetchEvents_createServerFn_handler, async ({ context, data }) => {
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { listEvents } = await import("./engine.server-Cx2L_grV.mjs");
	return listEvents(await getSql(), data.q ?? "", context.wallet);
});
var fetchEvent_createServerFn_handler = createServerRpc({
	id: "ef0728cd73d3c53169b54866f4be32051f7c09513443188c560f61651ff1a32f",
	name: "fetchEvent",
	filename: "src/lib/api.ts"
}, (opts) => fetchEvent.__executeServer(opts));
var fetchEvent = createServerFn({ method: "GET" }).validator(object({ id: number() })).handler(fetchEvent_createServerFn_handler, async ({ data }) => {
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { getEvent } = await import("./engine.server-Cx2L_grV.mjs");
	return getEvent(await getSql(), data.id);
});
var saveKyc_createServerFn_handler = createServerRpc({
	id: "1114592a1f58614a898e9421618f4ad7e882cd6980cd50a0ad6460f8666221f7",
	name: "saveKyc",
	filename: "src/lib/api.ts"
}, (opts) => saveKyc.__executeServer(opts));
var saveKyc = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	fullName: string().trim().min(2).max(120),
	idNumber: string().trim().min(4).max(64),
	nationality: string().trim().min(2).max(80),
	documentExpiresAt: string().regex(/^\d{4}-\d{2}-\d{2}$/),
	photoBase64: string().min(32).max(8e6),
	contentType: _enum(["image/jpeg", "image/png"])
})).handler(saveKyc_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { submitKyc } = await import("./engine.server-Cx2L_grV.mjs");
	return submitKyc(await getSql(), wallet, data);
});
var buyNow_createServerFn_handler = createServerRpc({
	id: "e001ed70e32594e0b931d124f8e61b0350bb91ac053ee3ec7d3937b7d02b1e9b",
	name: "buyNow",
	filename: "src/lib/api.ts"
}, (opts) => buyNow.__executeServer(opts));
var buyNow = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	tierId: number(),
	txHash: string(),
	chainId: number()
})).handler(buyNow_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { confirmBuy } = await import("./engine.server-Cx2L_grV.mjs");
	return confirmBuy(await getSql(), wallet, data.tierId, data.txHash, data.chainId);
});
var quoteBuy_createServerFn_handler = createServerRpc({
	id: "cddafa20bdfb9c1c360a55b163dd918c77f96896c7e3dcd242a81d921539f2fe",
	name: "quoteBuy",
	filename: "src/lib/api.ts"
}, (opts) => quoteBuy.__executeServer(opts));
var quoteBuy = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ tierId: number() })).handler(quoteBuy_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { quoteBuy } = await import("./engine.server-Cx2L_grV.mjs");
	return quoteBuy(await getSql(), wallet, data.tierId);
});
var sellTicket_createServerFn_handler = createServerRpc({
	id: "d5c4cfe7ffdc490aa4147ea01135eddb6ff975bed008cf516dc1129527400499",
	name: "sellTicket",
	filename: "src/lib/api.ts"
}, (opts) => sellTicket.__executeServer(opts));
var sellTicket = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	ticketId: number(),
	priceCents: number(),
	txHash: string()
})).handler(sellTicket_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { listResale } = await import("./engine.server-Cx2L_grV.mjs");
	return listResale(await getSql(), wallet, data.ticketId, data.priceCents, data.txHash);
});
var quoteList_createServerFn_handler = createServerRpc({
	id: "027910004badc6ba55af40f4657e0796a7333ffe459790813b7ecc6117012d9b",
	name: "quoteList",
	filename: "src/lib/api.ts"
}, (opts) => quoteList.__executeServer(opts));
var quoteList = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	ticketId: number(),
	priceCents: number()
})).handler(quoteList_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { quoteList } = await import("./engine.server-Cx2L_grV.mjs");
	return quoteList(await getSql(), wallet, data.ticketId, data.priceCents);
});
var cancelListing_createServerFn_handler = createServerRpc({
	id: "ceb756da76e02c4bf8acadc21f3809c9da3e3923fdc84d487345bd94cb10363a",
	name: "cancelListing",
	filename: "src/lib/api.ts"
}, (opts) => cancelListing.__executeServer(opts));
var cancelListing = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	ticketId: number(),
	txHash: string()
})).handler(cancelListing_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { delistTicket } = await import("./engine.server-Cx2L_grV.mjs");
	await delistTicket(await getSql(), wallet, data.ticketId, data.txHash);
	return { ok: true };
});
var fetchMyTickets_createServerFn_handler = createServerRpc({
	id: "e6ecb2638e217a6b264b7c52aa022a698ac7faa0d5b09c68308fb515a75e8546",
	name: "fetchMyTickets",
	filename: "src/lib/api.ts"
}, (opts) => fetchMyTickets.__executeServer(opts));
var fetchMyTickets = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(fetchMyTickets_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { myTickets } = await import("./engine.server-Cx2L_grV.mjs");
	return myTickets(await getSql(), wallet);
});
var fetchQr_createServerFn_handler = createServerRpc({
	id: "4d4fd0799331109c8c7b0b97ad6f5d242a188c73564731233a9d60f26fa08e3a",
	name: "fetchQr",
	filename: "src/lib/api.ts"
}, (opts) => fetchQr.__executeServer(opts));
var fetchQr = createServerFn({ method: "GET" }).middleware([walletMiddleware]).validator(object({ ticketId: number() })).handler(fetchQr_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { issueQr } = await import("./engine.server-Cx2L_grV.mjs");
	return issueQr(await getSql(), wallet, data.ticketId);
});
var scanCheckIn_createServerFn_handler = createServerRpc({
	id: "eb9070306b2d0648450a5ef177f5f0d8c91a95fb4cbc874126c46abfa4f8194b",
	name: "scanCheckIn",
	filename: "src/lib/api.ts"
}, (opts) => scanCheckIn.__executeServer(opts));
var scanCheckIn = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ payload: string() })).handler(scanCheckIn_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { checkIn } = await import("./engine.server-Cx2L_grV.mjs");
	return checkIn(await getSql(), wallet, data.payload);
});
var createEvent_createServerFn_handler = createServerRpc({
	id: "30b7faef73d7dee894fca6220158f37081a146ecd7c90e0cc988aa4fce56ac9c",
	name: "createEvent",
	filename: "src/lib/api.ts"
}, (opts) => createEvent.__executeServer(opts));
var createEvent = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	name: string(),
	description: string(),
	venue: string(),
	category: string(),
	posterUrl: string(),
	startsAt: string(),
	endsAt: string(),
	jobId: string().min(1).max(80),
	tiers: array(object({
		name: string(),
		faceCents: number(),
		supply: number()
	}))
})).handler(createEvent_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const { boot, mintEvent, failMintJob } = await import("./engine.server-Cx2L_grV.mjs");
	await boot(sql);
	await sql`insert into mint_jobs (id, organizer_wallet, status) values (${data.jobId}, ${wallet}, 'pending')`;
	try {
		return await mintEvent(sql, wallet, data, data.jobId);
	} catch (err) {
		await failMintJob(sql, wallet, data.jobId, err instanceof Error ? err.message : "Event creation failed.");
		throw err;
	}
});
var fetchMintProgress_createServerFn_handler = createServerRpc({
	id: "f9f309785a57687fd5c06b3638d5c20a226d00937904b43d33ff9242b9aab4cd",
	name: "fetchMintProgress",
	filename: "src/lib/api.ts"
}, (opts) => fetchMintProgress.__executeServer(opts));
var fetchMintProgress = createServerFn({ method: "GET" }).middleware([walletMiddleware]).validator(object({ jobId: string().min(1).max(80) })).handler(fetchMintProgress_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { mintJobProgress } = await import("./engine.server-Cx2L_grV.mjs");
	return mintJobProgress(await getSql(), wallet, data.jobId);
});
var fetchOrganizer_createServerFn_handler = createServerRpc({
	id: "26bcfc58e8d1a182b5bc747c037f6fc752f1977285bfd5d5a7f8f92b598cfb87",
	name: "fetchOrganizer",
	filename: "src/lib/api.ts"
}, (opts) => fetchOrganizer.__executeServer(opts));
var fetchOrganizer = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(fetchOrganizer_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { organizerEvents } = await import("./engine.server-Cx2L_grV.mjs");
	return { events: await organizerEvents(await getSql(), wallet) };
});
var fetchOrganizerEventLedger_createServerFn_handler = createServerRpc({
	id: "2b62d9b9a565cbaf4490e709f10c5caadb27512b083c3d9f68d8e21cf6dc1bdf",
	name: "fetchOrganizerEventLedger",
	filename: "src/lib/api.ts"
}, (opts) => fetchOrganizerEventLedger.__executeServer(opts));
var fetchOrganizerEventLedger = createServerFn({ method: "GET" }).middleware([walletMiddleware]).validator(object({ eventId: number() })).handler(fetchOrganizerEventLedger_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { organizerEventLedger } = await import("./engine.server-Cx2L_grV.mjs");
	return organizerEventLedger(await getSql(), wallet, data.eventId);
});
var refundEvent_createServerFn_handler = createServerRpc({
	id: "0ad9622f9b5abe78e9b9c691246bdd9294abb9fa210c973191ac242ba5229f86",
	name: "refundEvent",
	filename: "src/lib/api.ts"
}, (opts) => refundEvent.__executeServer(opts));
var refundEvent = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ eventId: number() })).handler(refundEvent_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { cancelEvent } = await import("./engine.server-Cx2L_grV.mjs");
	await cancelEvent(await getSql(), wallet, data.eventId);
	return { ok: true };
});
var withdrawEvent_createServerFn_handler = createServerRpc({
	id: "82f57b86f291e471c7e9f227a06cade6461e9d95f96c7edba6371d7a10d8f7de",
	name: "withdrawEvent",
	filename: "src/lib/api.ts"
}, (opts) => withdrawEvent.__executeServer(opts));
var withdrawEvent = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ eventId: number() })).handler(withdrawEvent_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { withdrawVault } = await import("./engine.server-Cx2L_grV.mjs");
	return { ref: await withdrawVault(await getSql(), wallet, data.eventId) };
});
var fetchRoyalty_createServerFn_handler = createServerRpc({
	id: "821f0461e569c0802835426279bc1b04d052e4640ba165bbf6fff65ee7abf890",
	name: "fetchRoyalty",
	filename: "src/lib/api.ts"
}, (opts) => fetchRoyalty.__executeServer(opts));
var fetchRoyalty = createServerFn({ method: "GET" }).handler(fetchRoyalty_createServerFn_handler, async () => {
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { royaltyBps, adminCount, listAdmins } = await import("./engine.server-Cx2L_grV.mjs");
	const sql = await getSql();
	return {
		royaltyBps: await royaltyBps(sql),
		adminCount: await adminCount(sql),
		admins: await listAdmins(sql)
	};
});
var saveRoyalty_createServerFn_handler = createServerRpc({
	id: "b5dc51908e0d9f2e7265a709d9e22b1236b625943c59df92118a9e3c77df5ee3",
	name: "saveRoyalty",
	filename: "src/lib/api.ts"
}, (opts) => saveRoyalty.__executeServer(opts));
var saveRoyalty = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ bps: number() })).handler(saveRoyalty_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { setRoyalty } = await import("./engine.server-Cx2L_grV.mjs");
	await setRoyalty(await getSql(), wallet, data.bps);
	return { ok: true };
});
var saveOrganizer_createServerFn_handler = createServerRpc({
	id: "b000eb76f71546044b842cdecb14cb71c5103298f56b135a48feda181fdcce84",
	name: "saveOrganizer",
	filename: "src/lib/api.ts"
}, (opts) => saveOrganizer.__executeServer(opts));
var saveOrganizer = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	wallet: string(),
	name: string()
})).handler(saveOrganizer_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { addOrganizer } = await import("./engine.server-Cx2L_grV.mjs");
	await addOrganizer(await getSql(), wallet, data.wallet, data.name);
	return { ok: true };
});
var patchOrganizer_createServerFn_handler = createServerRpc({
	id: "3424ede6dcab9b184d400fc8599ab42ae0ed8a960df8fbb551f66fdb49cd1463",
	name: "patchOrganizer",
	filename: "src/lib/api.ts"
}, (opts) => patchOrganizer.__executeServer(opts));
var patchOrganizer = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	wallet: string(),
	status: _enum([
		"approved",
		"revoked",
		"pending"
	])
})).handler(patchOrganizer_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { setOrganizerStatus } = await import("./engine.server-Cx2L_grV.mjs");
	await setOrganizerStatus(await getSql(), wallet, data.wallet, data.status);
	return { ok: true };
});
var fetchOrganizers_createServerFn_handler = createServerRpc({
	id: "e7386c5d391fc8e545bd27d988c82bf5ca6a0abfe5c90d670e96b44022b438a1",
	name: "fetchOrganizers",
	filename: "src/lib/api.ts"
}, (opts) => fetchOrganizers.__executeServer(opts));
var fetchOrganizers = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(fetchOrganizers_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { listOrganizers } = await import("./engine.server-Cx2L_grV.mjs");
	return listOrganizers(await getSql(), wallet);
});
var fetchInfra_createServerFn_handler = createServerRpc({
	id: "3be1b4b84fb73ef0e0b1b59caa4ef0e8666dc889f24bacf453c4a65a8e605281",
	name: "fetchInfra",
	filename: "src/lib/api.ts"
}, (opts) => fetchInfra.__executeServer(opts));
var fetchInfra = createServerFn({ method: "POST" }).middleware([walletMiddleware]).handler(fetchInfra_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { getInfraStatus } = await import("./engine.server-Cx2L_grV.mjs");
	return getInfraStatus(await getSql(), wallet);
});
var saveInfra_createServerFn_handler = createServerRpc({
	id: "3721a49e1b31090084c00d98c0bf2b1dc6967a0c847394eb3a4a9ea7a1a4f438",
	name: "saveInfra",
	filename: "src/lib/api.ts"
}, (opts) => saveInfra.__executeServer(opts));
var saveInfra = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	databaseUrl: string().optional(),
	rpcUrl: string().optional(),
	chainId: number().optional(),
	explorerUrl: string().optional(),
	operatorPk: string().optional(),
	pinataJwt: string().optional(),
	clearOperatorPk: boolean().optional(),
	clearDatabaseUrl: boolean().optional(),
	clearPinata: boolean().optional(),
	devMode: boolean().optional(),
	databaseUrlKyc: string().optional(),
	clearDatabaseUrlKyc: boolean().optional(),
	kycAutoApprove: boolean().optional()
})).handler(saveInfra_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { applyInfra } = await import("./engine.server-Cx2L_grV.mjs");
	return applyInfra(await getSql(), wallet, data);
});
var testDatabase_createServerFn_handler = createServerRpc({
	id: "ed27693d6a4e76070f4796e867f31b6966dfef37786e50e9701e1c4c6840ed5b",
	name: "testDatabase",
	filename: "src/lib/api.ts"
}, (opts) => testDatabase.__executeServer(opts));
var testDatabase = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ url: string() })).handler(testDatabase_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { probeDatabaseUrl } = await import("./engine.server-Cx2L_grV.mjs");
	return probeDatabaseUrl(wallet, data.url);
});
var testChain_createServerFn_handler = createServerRpc({
	id: "aa9c8e8c0da272bde3d0f5e13f316228d2487a522580172e978cc5ac7c8464c8",
	name: "testChain",
	filename: "src/lib/api.ts"
}, (opts) => testChain.__executeServer(opts));
var testChain = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	rpcUrl: string().optional(),
	chainId: number().optional()
})).handler(testChain_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { getMe } = await import("./engine.server-Cx2L_grV.mjs");
	if (!(await getMe(await getSql(), wallet)).isAdmin) throw new Error("Admin only.");
	const { pingChain } = await import("./chain.server-u4NE0w9L.mjs");
	return pingChain(data.rpcUrl, data.chainId);
});
var makeOperatorKey_createServerFn_handler = createServerRpc({
	id: "f2810f75e2a93ab310597d182bf06863c98e3954bc064c9dc3527cd12b302a1b",
	name: "makeOperatorKey",
	filename: "src/lib/api.ts"
}, (opts) => makeOperatorKey.__executeServer(opts));
var makeOperatorKey = createServerFn({ method: "POST" }).middleware([walletMiddleware]).handler(makeOperatorKey_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { getMe, applyInfra } = await import("./engine.server-Cx2L_grV.mjs");
	if (!(await getMe(await getSql(), wallet)).isAdmin) throw new Error("Admin only.");
	const { generateOperatorKey, operatorAddressOf } = await import("./chain.server-u4NE0w9L.mjs");
	const pk = await generateOperatorKey();
	await applyInfra(await getSql(), wallet, { operatorPk: pk });
	return {
		address: await operatorAddressOf(pk),
		rotated: true
	};
});
var fetchKycQueue_createServerFn_handler = createServerRpc({
	id: "b80d6f4501578c1d2bd8eb1355323bf42bf8774c3235e3dda74b927142d6c8af",
	name: "fetchKycQueue",
	filename: "src/lib/api.ts"
}, (opts) => fetchKycQueue.__executeServer(opts));
var fetchKycQueue = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	q: string().optional(),
	status: string().optional(),
	from: string().optional(),
	to: string().optional()
})).handler(fetchKycQueue_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { getMe } = await import("./engine.server-Cx2L_grV.mjs");
	const sql = await getSql();
	if (!(await getMe(sql, wallet)).isAdmin) throw new Error("Admin only.");
	const { listKyc } = await import("./kyc-store.server-CUUjK3BO.mjs");
	return listKyc(sql, data);
});
var fetchKycDetail_createServerFn_handler = createServerRpc({
	id: "f614ff6566254bae7ce4d8c1b1555553c4b2ffac78d50235dd66e1a9e497268e",
	name: "fetchKycDetail",
	filename: "src/lib/api.ts"
}, (opts) => fetchKycDetail.__executeServer(opts));
var fetchKycDetail = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ kycRef: string() })).handler(fetchKycDetail_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { getMe } = await import("./engine.server-Cx2L_grV.mjs");
	const sql = await getSql();
	if (!(await getMe(sql, wallet)).isAdmin) throw new Error("Admin only.");
	const { kycDetail } = await import("./kyc-store.server-CUUjK3BO.mjs");
	return kycDetail(sql, wallet, data.kycRef);
});
var fetchKycPhoto_createServerFn_handler = createServerRpc({
	id: "c6d25f642de7ed9047ee8b3e3c8f66d46231e116b1a9097e214c67e05ad6039a",
	name: "fetchKycPhoto",
	filename: "src/lib/api.ts"
}, (opts) => fetchKycPhoto.__executeServer(opts));
var fetchKycPhoto = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ kycRef: string().min(8).max(80) })).handler(fetchKycPhoto_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { getMe } = await import("./engine.server-Cx2L_grV.mjs");
	const sql = await getSql();
	if (!(await getMe(sql, wallet)).isAdmin) throw new Error("Admin only.");
	const { kycPhoto } = await import("./kyc-store.server-CUUjK3BO.mjs");
	return kycPhoto(sql, wallet, data.kycRef);
});
var reviewKyc_createServerFn_handler = createServerRpc({
	id: "f4221b67b704c195cb8cb660785d2e630e368e3a92b91d0094d84a86328d1421",
	name: "reviewKyc",
	filename: "src/lib/api.ts"
}, (opts) => reviewKyc.__executeServer(opts));
var reviewKyc = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	kycRef: string(),
	approve: boolean(),
	reason: string().optional()
})).handler(reviewKyc_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { getMe } = await import("./engine.server-Cx2L_grV.mjs");
	const sql = await getSql();
	if (!(await getMe(sql, wallet)).isAdmin) throw new Error("Admin only.");
	const { reviewKyc: decide } = await import("./kyc-store.server-CUUjK3BO.mjs");
	return decide(sql, wallet, data.kycRef, data.approve, data.reason ?? "");
});
var fetchPublicConfig_createServerFn_handler = createServerRpc({
	id: "e51382297ea4bb30897d2ce5bd9aaccb850580b54a0589b50093ae72f2f90bea",
	name: "fetchPublicConfig",
	filename: "src/lib/api.ts"
}, (opts) => fetchPublicConfig.__executeServer(opts));
var fetchPublicConfig = createServerFn({ method: "GET" }).handler(fetchPublicConfig_createServerFn_handler, async () => {
	const { publicConfig } = await import("./engine.server-Cx2L_grV.mjs");
	return publicConfig();
});
var setDevMode_createServerFn_handler = createServerRpc({
	id: "4ba192dac753e6d8521b6e0e1dcfb0a370e887d0499fd141700faa6f4adda6d1",
	name: "setDevMode",
	filename: "src/lib/api.ts"
}, (opts) => setDevMode.__executeServer(opts));
var setDevMode = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ on: boolean() })).handler(setDevMode_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { enableDevMode } = await import("./engine.server-Cx2L_grV.mjs");
	return enableDevMode(await getSql(), wallet, data.on);
});
var dripFunds_createServerFn_handler = createServerRpc({
	id: "ba12b8b27799fff6cecd823ccc6decd61b8993d8276b2b1d660792790890e506",
	name: "dripFunds",
	filename: "src/lib/api.ts"
}, (opts) => dripFunds.__executeServer(opts));
var dripFunds = createServerFn({ method: "POST" }).middleware([walletMiddleware]).handler(dripFunds_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { dripDemo } = await import("./chain.server-u4NE0w9L.mjs");
	return { tx: await dripDemo(wallet) };
});
var prepareBuyer_createServerFn_handler = createServerRpc({
	id: "3984c3dba78308e8b548e094a9466e3d97566dfe2073c83c8c5404b3d407b163",
	name: "prepareBuyer",
	filename: "src/lib/api.ts"
}, (opts) => prepareBuyer.__executeServer(opts));
var prepareBuyer = createServerFn({ method: "POST" }).middleware([walletMiddleware]).handler(prepareBuyer_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { loadInfra } = await import("./infra.server-dbfo18Hy.mjs");
	const { ensureNativeGas, demoStatus } = await import("./chain.server-u4NE0w9L.mjs");
	let gasTx = null;
	let gasError = null;
	try {
		gasTx = await ensureNativeGas(wallet) ?? null;
	} catch (e) {
		gasError = e instanceof Error ? e.message : "Gas top-up failed";
	}
	const infra = await loadInfra(await getSql());
	let demo = null;
	if (infra.devMode && infra.demoBank) try {
		demo = await demoStatus(infra.demoBank, wallet);
	} catch {
		demo = null;
	}
	return {
		gasTx,
		gasError,
		demoBank: infra.demoBank || null,
		devMode: Boolean(infra.devMode),
		demo
	};
});
var freezeShow_createServerFn_handler = createServerRpc({
	id: "cdbdfcac609ca3aa42682cee74bc944cbd60b0c15324e45903295af4b5cff690",
	name: "freezeShow",
	filename: "src/lib/api.ts"
}, (opts) => freezeShow.__executeServer(opts));
var freezeShow = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	eventId: number(),
	on: boolean()
})).handler(freezeShow_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { freezeEvent } = await import("./engine.server-Cx2L_grV.mjs");
	return freezeEvent(await getSql(), wallet, data.eventId, data.on);
});
var fetchWithdrawals_createServerFn_handler = createServerRpc({
	id: "a04bdde8e1d824e973df250515dfb2928858062f7c10ce6d43f362f9287b9d98",
	name: "fetchWithdrawals",
	filename: "src/lib/api.ts"
}, (opts) => fetchWithdrawals.__executeServer(opts));
var fetchWithdrawals = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(fetchWithdrawals_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { listWithdrawRequests } = await import("./engine.server-Cx2L_grV.mjs");
	return listWithdrawRequests(await getSql(), wallet);
});
var decidePayout_createServerFn_handler = createServerRpc({
	id: "a8f590d1b16b85804aab1c60a197b0bf40466e778d7e2280f1142e735f95bedc",
	name: "decidePayout",
	filename: "src/lib/api.ts"
}, (opts) => decidePayout.__executeServer(opts));
var decidePayout = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	requestId: number(),
	approve: boolean()
})).handler(decidePayout_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { decideWithdraw } = await import("./engine.server-Cx2L_grV.mjs");
	return decideWithdraw(await getSql(), wallet, data.requestId, data.approve);
});
var confirmVote_createServerFn_handler = createServerRpc({
	id: "0ea67d5dab8ed63f7786c64924a12540c416aa85014933ea67daa1e025522297",
	name: "confirmVote",
	filename: "src/lib/api.ts"
}, (opts) => confirmVote.__executeServer(opts));
var confirmVote = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	ticketId: number(),
	txHash: string()
})).handler(confirmVote_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { confirmVote } = await import("./engine.server-Cx2L_grV.mjs");
	return confirmVote(await getSql(), wallet, data.ticketId, data.txHash);
});
var escalatePayout_createServerFn_handler = createServerRpc({
	id: "bb09c3f548cf039f7a17f4ddef4f8f19545138410df019add6c191360e5287bb",
	name: "escalatePayout",
	filename: "src/lib/api.ts"
}, (opts) => escalatePayout.__executeServer(opts));
var escalatePayout = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	eventId: number(),
	materialsUri: string()
})).handler(escalatePayout_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { escalateWithdraw } = await import("./engine.server-Cx2L_grV.mjs");
	return escalateWithdraw(await getSql(), wallet, data.eventId, data.materialsUri);
});
var executePayout_createServerFn_handler = createServerRpc({
	id: "e4f253f27c762325922cffa5430f5a927e7388d9d0223ad3b2d5ed9c8e858640",
	name: "executePayout",
	filename: "src/lib/api.ts"
}, (opts) => executePayout.__executeServer(opts));
var executePayout = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ eventId: number() })).handler(executePayout_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { executeGovWithdraw } = await import("./engine.server-Cx2L_grV.mjs");
	return executeGovWithdraw(await getSql(), wallet, data.eventId);
});
var fetchSignerOps_createServerFn_handler = createServerRpc({
	id: "ae8de9662a19ef1de0cf149b929dd83703bab73f025decfbdad38a2efaf7ee92",
	name: "fetchSignerOps",
	filename: "src/lib/api.ts"
}, (opts) => fetchSignerOps.__executeServer(opts));
var fetchSignerOps = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(fetchSignerOps_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { adminSignerOps } = await import("./engine.server-Cx2L_grV.mjs");
	return adminSignerOps(await getSql(), wallet);
});
var fetchPendingIndex_createServerFn_handler = createServerRpc({
	id: "9db42d2ac9c8ae7f4714c22097af9373837e9c3398411bb64c481051d5bcb18d",
	name: "fetchPendingIndex",
	filename: "src/lib/api.ts"
}, (opts) => fetchPendingIndex.__executeServer(opts));
var fetchPendingIndex = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(fetchPendingIndex_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { listPendingIndex } = await import("./engine.server-Cx2L_grV.mjs");
	return listPendingIndex(await getSql(), wallet);
});
var retryPendingIndex_createServerFn_handler = createServerRpc({
	id: "2429e35b6afadd29ff2adff242b3d43768eba95e62768d18c6ce2b047815e9d6",
	name: "retryPendingIndex",
	filename: "src/lib/api.ts"
}, (opts) => retryPendingIndex.__executeServer(opts));
var retryPendingIndex = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ id: number() })).handler(retryPendingIndex_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { replayPendingIndex } = await import("./engine.server-Cx2L_grV.mjs");
	return replayPendingIndex(await getSql(), wallet, data.id);
});
var dismissPendingIndex_createServerFn_handler = createServerRpc({
	id: "ae1432ef5e1cbcda0561c9894c640f2d0bc8b26b50f0033cb08fac78a056a045",
	name: "dismissPendingIndex",
	filename: "src/lib/api.ts"
}, (opts) => dismissPendingIndex.__executeServer(opts));
var dismissPendingIndex = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ id: number() })).handler(dismissPendingIndex_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { dismissPendingIndex } = await import("./engine.server-Cx2L_grV.mjs");
	return dismissPendingIndex(await getSql(), wallet, data.id);
});
var uploadPoster_createServerFn_handler = createServerRpc({
	id: "9ee29411a041c34a69aa31c202544a54aed5f307c98b9ec826ab8673e68b5105",
	name: "uploadPoster",
	filename: "src/lib/api.ts"
}, (opts) => uploadPoster.__executeServer(opts));
var uploadPoster = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	filename: string(),
	contentType: string(),
	base64: string()
})).handler(uploadPoster_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { getMe } = await import("./engine.server-Cx2L_grV.mjs");
	const me = await getMe(await getSql(), wallet);
	if (!me.isOrganizer && !me.isAdmin) throw new Error("Organizers only.");
	const { pinFile } = await import("./pinata.server-BOywXToV.mjs");
	const bytes = Buffer.from(data.base64, "base64");
	if (bytes.length > 4e6) throw new Error("Image must be under 4MB.");
	return pinFile({
		filename: data.filename,
		contentType: data.contentType,
		bytes
	});
});
var fetchAdminEvents_createServerFn_handler = createServerRpc({
	id: "bee80f40c43ca5c64f3dee8c298d4450e0d6732f0c8e7a0d20f6539077aee707",
	name: "fetchAdminEvents",
	filename: "src/lib/api.ts"
}, (opts) => fetchAdminEvents.__executeServer(opts));
var fetchAdminEvents = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(fetchAdminEvents_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { adminAllEvents, getMe } = await import("./engine.server-Cx2L_grV.mjs");
	if (!(await getMe(await getSql(), wallet)).isAdmin) throw new Error("Admin only.");
	return adminAllEvents(await getSql());
});
var savePlatform_createServerFn_handler = createServerRpc({
	id: "bda5b7ab3106117df7e5a392bd9352d508f66509749ffdc30798fff94340d329",
	name: "savePlatform",
	filename: "src/lib/api.ts"
}, (opts) => savePlatform.__executeServer(opts));
var savePlatform = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	adminWallet: string().optional(),
	chainName: string().optional(),
	nativeSymbol: string().optional(),
	rpcUrl: string().optional(),
	chainId: number().optional(),
	explorerUrl: string().optional()
})).handler(savePlatform_createServerFn_handler, async ({ context, data }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { savePlatformFile } = await import("./engine.server-Cx2L_grV.mjs");
	return savePlatformFile(await getSql(), wallet, data);
});
var claimPlatformAdmin_createServerFn_handler = createServerRpc({
	id: "3751fb2f2d8716b10ffc0bf1be35a824684cab6b40914334aeacae165646bede",
	name: "claimPlatformAdmin",
	filename: "src/lib/api.ts"
}, (opts) => claimPlatformAdmin.__executeServer(opts));
var claimPlatformAdmin = createServerFn({ method: "POST" }).middleware([walletMiddleware]).handler(claimPlatformAdmin_createServerFn_handler, async ({ context }) => {
	const wallet = needWallet(context.wallet);
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { setPlatformAdmin } = await import("./engine.server-Cx2L_grV.mjs");
	return setPlatformAdmin(await getSql(), wallet, wallet);
});
//#endregion
export { buyNow_createServerFn_handler, cancelListing_createServerFn_handler, claimPlatformAdmin_createServerFn_handler, confirmVote_createServerFn_handler, createEvent_createServerFn_handler, decidePayout_createServerFn_handler, dismissPendingIndex_createServerFn_handler, dripFunds_createServerFn_handler, escalatePayout_createServerFn_handler, executePayout_createServerFn_handler, fetchAdminEvents_createServerFn_handler, fetchEvent_createServerFn_handler, fetchEvents_createServerFn_handler, fetchInfra_createServerFn_handler, fetchKycDetail_createServerFn_handler, fetchKycPhoto_createServerFn_handler, fetchKycQueue_createServerFn_handler, fetchMe_createServerFn_handler, fetchMintProgress_createServerFn_handler, fetchMyTickets_createServerFn_handler, fetchOrganizerEventLedger_createServerFn_handler, fetchOrganizer_createServerFn_handler, fetchOrganizers_createServerFn_handler, fetchPendingIndex_createServerFn_handler, fetchPublicConfig_createServerFn_handler, fetchQr_createServerFn_handler, fetchRoyalty_createServerFn_handler, fetchSignerOps_createServerFn_handler, fetchSpendable_createServerFn_handler, fetchWithdrawals_createServerFn_handler, freezeShow_createServerFn_handler, getNonce_createServerFn_handler, makeOperatorKey_createServerFn_handler, patchOrganizer_createServerFn_handler, prepareBuyer_createServerFn_handler, quoteBuy_createServerFn_handler, quoteList_createServerFn_handler, refundEvent_createServerFn_handler, retryPendingIndex_createServerFn_handler, reviewKyc_createServerFn_handler, saveInfra_createServerFn_handler, saveKyc_createServerFn_handler, saveOrganizer_createServerFn_handler, savePlatform_createServerFn_handler, saveRoyalty_createServerFn_handler, scanCheckIn_createServerFn_handler, sellTicket_createServerFn_handler, setDevMode_createServerFn_handler, testChain_createServerFn_handler, testDatabase_createServerFn_handler, uploadPoster_createServerFn_handler, verifyWallet_createServerFn_handler, withdrawEvent_createServerFn_handler };
