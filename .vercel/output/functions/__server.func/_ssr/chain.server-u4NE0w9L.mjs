import { a as createWalletClient, c as defineChain, l as parseEventLogs, n as generatePrivateKey, o as createPublicClient, r as http, t as privateKeyToAccount, u as formatEther } from "../_libs/viem.mjs";
import { t as core_default } from "./core-c-NHi4tD.mjs";
import { r as readPlatform } from "./platform-ITGl4Pv_.mjs";
import { r as getSql } from "./db-6MgyDrQq.mjs";
import { loadInfra } from "./infra.server-dbfo18Hy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/receipt-CWkbS5fG.js
/** Wait for inclusion in one block — do not sit on extra confirmations. */
var RECEIPT_TIMEOUT_MS = 18e4;
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/chain.server-u4NE0w9L.js
var globalRef = globalThis;
async function cfg() {
	const sql = await getSql();
	const infra = await loadInfra(sql);
	const file = readPlatform();
	return {
		...infra,
		rpcUrl: infra.rpcUrl || file.rpcUrl,
		chainId: infra.chainId || file.chainId,
		explorerUrl: infra.explorerUrl || file.explorerUrl,
		nativeSymbol: file.nativeSymbol
	};
}
function chainOf(chainId, rpcUrl, explorerUrl) {
	const file = readPlatform();
	return defineChain({
		id: chainId,
		name: file.chainName || "Ticket network",
		nativeCurrency: {
			name: file.nativeSymbol,
			symbol: file.nativeSymbol,
			decimals: 18
		},
		rpcUrls: { default: { http: [rpcUrl] } },
		blockExplorers: { default: {
			name: "Explorer",
			url: explorerUrl || file.explorerUrl
		} }
	});
}
async function readClient() {
	const c = await cfg();
	const chain = chainOf(c.chainId, c.rpcUrl, c.explorerUrl);
	return {
		c,
		chain,
		publicClient: createPublicClient({
			chain,
			transport: http(c.rpcUrl, { timeout: 2e4 })
		})
	};
}
async function clients() {
	const base = await readClient();
	if (!base.c.operatorPk) throw new Error("Set an operator private key in Admin before writing on-chain.");
	const account = privateKeyToAccount(base.c.operatorPk);
	const wallet = createWalletClient({
		account,
		chain: base.chain,
		transport: http(base.c.rpcUrl, { timeout: 4e4 })
	});
	return {
		...base,
		account,
		wallet
	};
}
async function pingChain(rpcUrl, chainId) {
	const sql = await getSql();
	const infra = await loadInfra(sql);
	const file = readPlatform();
	const rpc = rpcUrl || infra.rpcUrl || file.rpcUrl;
	const id = chainId || infra.chainId || file.chainId;
	const client = createPublicClient({
		chain: chainOf(id, rpc, infra.explorerUrl || file.explorerUrl),
		transport: http(rpc, { timeout: 1e4 })
	});
	const [blockNumber, netId] = await Promise.all([client.getBlockNumber(), client.getChainId()]);
	let operatorAddress = null;
	let operatorBalance = null;
	if (infra.operatorPk) {
		const account = privateKeyToAccount(infra.operatorPk);
		operatorAddress = account.address;
		const wei = await client.getBalance({ address: account.address });
		operatorBalance = formatEther(wei);
	}
	globalRef.__ctLastChainError__ = null;
	return {
		connected: true,
		rpcUrl: rpc,
		chainId: netId,
		blockNumber: Number(blockNumber),
		operatorAddress,
		operatorBalance,
		explorerUrl: infra.explorerUrl || file.explorerUrl,
		lastError: null,
		lastAnchor: globalRef.__ctLastAnchor__ ?? null,
		demoBank: infra.demoBank || null,
		devMode: infra.devMode
	};
}
async function generateOperatorKey() {
	return generatePrivateKey();
}
async function operatorAddressOf(pk) {
	return privateKeyToAccount(pk).address;
}
function lastChainError() {
	return globalRef.__ctLastChainError__ ?? null;
}
function lastAnchor() {
	return globalRef.__ctLastAnchor__ ?? null;
}
function note(hash, kind) {
	globalRef.__ctLastAnchor__ = {
		hash,
		at: (/* @__PURE__ */ new Date()).toISOString(),
		kind
	};
	globalRef.__ctLastChainError__ = null;
	return hash;
}
async function wait(publicClient, hash) {
	const receipt = await publicClient.waitForTransactionReceipt({
		hash,
		timeout: RECEIPT_TIMEOUT_MS,
		confirmations: 1
	});
	if (receipt.status !== "success") throw new Error("On-chain transaction reverted.");
	return receipt;
}
function centsToWei(cents) {
	return BigInt(cents) * 10n ** 16n;
}
async function deployDemoBank(admin) {
	const { account, wallet, publicClient } = await clients();
	const hash = await wallet.deployContract({
		abi: core_default.DemoBank.abi,
		bytecode: core_default.DemoBank.bytecode,
		args: [admin, account.address],
		account
	});
	const receipt = await wait(publicClient, hash);
	if (!receipt.contractAddress) throw new Error("DxDAI bank deploy returned no address.");
	note(hash, "demo_bank");
	return {
		address: receipt.contractAddress,
		tx: hash
	};
}
async function assertDemoBank(bank) {
	const { publicClient } = await readClient();
	let name = "";
	try {
		name = await publicClient.readContract({
			address: bank,
			abi: core_default.DemoBank.abi,
			functionName: "name"
		});
	} catch {
		throw new Error("Saved DemoBank is not a readable DxDAI contract. Turn Dev mode off then on to mint a fresh bank.");
	}
	if (name !== "Demo xDAI") throw new Error(`Saved bank is "${name}", not DxDAI. Turn Dev mode off then on so a new 10,000 DxDAI pool is minted.`);
}
async function deployEventContracts(opts) {
	const { account, wallet, publicClient } = await clients();
	if (opts.bank) await assertDemoBank(opts.bank);
	await opts.onStep?.(1);
	const vaultHash = await wallet.deployContract({
		abi: core_default.EventVault.abi,
		bytecode: core_default.EventVault.bytecode,
		args: [
			opts.organizer,
			account.address,
			BigInt(opts.endsAtSec)
		],
		account
	});
	const vault = (await wait(publicClient, vaultHash)).contractAddress;
	if (!vault) throw new Error("Vault deploy returned no address.");
	await opts.onStep?.(2);
	const mktHash = await wallet.deployContract({
		abi: core_default.EventMarketplace.abi,
		bytecode: core_default.EventMarketplace.bytecode,
		args: [
			opts.organizer,
			vault,
			account.address,
			opts.bank ?? "0x0000000000000000000000000000000000000000",
			opts.royaltyBps,
			BigInt(opts.endsAtSec)
		],
		account
	});
	const marketplace = (await wait(publicClient, mktHash)).contractAddress;
	if (!marketplace) throw new Error("Marketplace deploy returned no address.");
	await opts.onStep?.(3);
	const bindHash = await wallet.writeContract({
		address: vault,
		abi: core_default.EventVault.abi,
		functionName: "setMarketplace",
		args: [marketplace],
		account
	});
	await wait(publicClient, bindHash);
	const colName = (opts.name || "ChainTicket").slice(0, 40);
	await opts.onStep?.(4);
	const colHash = await wallet.deployContract({
		abi: core_default.TicketCollection.abi,
		bytecode: core_default.TicketCollection.bytecode,
		args: [
			colName,
			"CTIX",
			opts.organizer,
			account.address,
			marketplace
		],
		account
	});
	const collection = (await wait(publicClient, colHash)).contractAddress;
	if (!collection) throw new Error("Ticket collection deploy returned no address.");
	await opts.onStep?.(5);
	await wait(publicClient, await wallet.writeContract({
		address: marketplace,
		abi: core_default.EventMarketplace.abi,
		functionName: "setCollection",
		args: [collection],
		account
	}));
	if (opts.bank) try {
		await opts.onStep?.(6);
		await wait(publicClient, await wallet.writeContract({
			address: opts.bank,
			abi: core_default.DemoBank.abi,
			functionName: "setMarket",
			args: [marketplace, true],
			account
		}));
	} catch (err) {
		const msg = err instanceof Error ? err.message : "setMarket reverted";
		throw new Error(`DemoBank setMarket failed (${msg}). Turn Dev mode off then on to mint a fresh DxDAI bank, then mint the event again.`);
	}
	note(colHash, "collection");
	return {
		vault,
		marketplace,
		collection,
		vaultTx: vaultHash,
		marketTx: mktHash,
		collectionTx: colHash,
		bindTx: bindHash
	};
}
async function setTierUriOnChain(opts) {
	const { account, wallet, publicClient } = await clients();
	const hash = await wallet.writeContract({
		address: opts.marketplace,
		abi: core_default.EventMarketplace.abi,
		functionName: "setTierURI",
		args: [opts.tierId, opts.uri],
		account
	});
	await wait(publicClient, hash);
	note(hash, "uri");
	return hash;
}
async function mintTierOnChain(opts) {
	const { account, wallet, publicClient } = await clients();
	const hash = await wallet.writeContract({
		address: opts.marketplace,
		abi: core_default.EventMarketplace.abi,
		functionName: "mintTier",
		args: [
			opts.tierId,
			opts.supply,
			centsToWei(opts.faceCents)
		],
		account
	});
	await wait(publicClient, hash);
	note(hash, "mint");
	return hash;
}
async function verifyUserBuy(opts) {
	const { publicClient } = await readClient();
	const receipt = await wait(publicClient, opts.txHash);
	if (receipt.from.toLowerCase() !== opts.buyer.toLowerCase()) throw new Error("Buy transaction was not sent from your wallet.");
	if ((receipt.to ?? "").toLowerCase() !== opts.marketplace.toLowerCase()) throw new Error("Buy transaction did not hit this event’s marketplace.");
	const match = parseEventLogs({
		abi: core_default.EventMarketplace.abi,
		logs: receipt.logs,
		eventName: "Bought"
	}).find((l) => Number(l.args.id) === opts.ticketId);
	if (!match) throw new Error("On-chain Bought event not found for this ticket.");
	note(opts.txHash, "buy");
	return {
		hash: opts.txHash,
		id: Number(match.args.id),
		priceWei: match.args.price,
		priceCents: Number(match.args.price / 10n ** 16n),
		primary: Boolean(match.args.primary)
	};
}
async function verifyUserList(opts) {
	const { publicClient } = await readClient();
	const receipt = await wait(publicClient, opts.txHash);
	if (receipt.from.toLowerCase() !== opts.seller.toLowerCase()) throw new Error("List transaction was not sent from your wallet.");
	if (!parseEventLogs({
		abi: core_default.EventMarketplace.abi,
		logs: receipt.logs,
		eventName: "Listed"
	}).some((l) => Number(l.args.id) === opts.ticketId)) throw new Error("On-chain Listed event not found.");
	note(opts.txHash, "list");
	return opts.txHash;
}
async function verifyUserDelist(opts) {
	const { publicClient } = await readClient();
	const receipt = await wait(publicClient, opts.txHash);
	if (receipt.from.toLowerCase() !== opts.owner.toLowerCase()) throw new Error("Delist transaction was not sent from your wallet.");
	if (!parseEventLogs({
		abi: core_default.EventMarketplace.abi,
		logs: receipt.logs,
		eventName: "Delisted"
	}).some((l) => Number(l.args.id) === opts.ticketId)) throw new Error("On-chain Delisted event not found.");
	note(opts.txHash, "delist");
	return opts.txHash;
}
async function verifyCheckIn(opts) {
	const { publicClient } = await readClient();
	const receipt = await wait(publicClient, opts.txHash);
	if ((receipt.to ?? "").toLowerCase() !== opts.marketplace.toLowerCase()) throw new Error("Check-in transaction did not hit this event’s marketplace.");
	if (!parseEventLogs({
		abi: core_default.EventMarketplace.abi,
		logs: receipt.logs,
		eventName: "CheckedIn"
	}).some((l) => Number(l.args.id) === opts.ticketId)) throw new Error("On-chain CheckedIn event not found.");
	note(opts.txHash, "checkin");
	return opts.txHash;
}
async function submitCheckIn(opts) {
	const { account, wallet, publicClient } = await clients();
	const hash = await wallet.writeContract({
		address: opts.marketplace,
		abi: core_default.EventMarketplace.abi,
		functionName: "checkIn",
		args: [BigInt(opts.id)],
		account
	});
	await wait(publicClient, hash);
	note(hash, "checkin");
	return hash;
}
async function submitCancel(opts) {
	const { account, wallet, publicClient } = await clients();
	const mark = await wallet.writeContract({
		address: opts.marketplace,
		abi: core_default.EventMarketplace.abi,
		functionName: "markCancelled",
		account
	});
	await wait(publicClient, mark);
	const hashes = [mark];
	for (const id of opts.ids) {
		const hash = await wallet.writeContract({
			address: opts.marketplace,
			abi: core_default.EventMarketplace.abi,
			functionName: "refundFace",
			args: [BigInt(id)],
			account
		});
		await wait(publicClient, hash);
		hashes.push(hash);
	}
	note(hashes[hashes.length - 1], "refund");
	return hashes;
}
async function submitWithdraw(vault, token) {
	const { account, wallet, publicClient } = await clients();
	const hash = token ? await wallet.writeContract({
		address: vault,
		abi: core_default.EventVault.abi,
		functionName: "withdrawToken",
		args: [token],
		account
	}) : await wallet.writeContract({
		address: vault,
		abi: core_default.EventVault.abi,
		functionName: "withdraw",
		account
	});
	await wait(publicClient, hash);
	note(hash, "withdraw");
	return hash;
}
async function submitFrozen(opts) {
	const { account, wallet, publicClient } = await clients();
	const a = await wallet.writeContract({
		address: opts.marketplace,
		abi: core_default.EventMarketplace.abi,
		functionName: "setFrozen",
		args: [opts.on],
		account
	});
	await wait(publicClient, a);
	const b = await wallet.writeContract({
		address: opts.vault,
		abi: core_default.EventVault.abi,
		functionName: "setFrozen",
		args: [opts.on],
		account
	});
	await wait(publicClient, b);
	let collectionTx = null;
	if (opts.collection) {
		collectionTx = await wallet.writeContract({
			address: opts.collection,
			abi: core_default.TicketCollection.abi,
			functionName: "setFrozen",
			args: [opts.on],
			account
		});
		await wait(publicClient, collectionTx);
	}
	note(collectionTx ?? b, opts.on ? "freeze" : "unfreeze");
	return {
		marketTx: a,
		vaultTx: b,
		collectionTx
	};
}
async function readOwnerOf(collection, id) {
	const { publicClient } = await readClient();
	return await publicClient.readContract({
		address: collection,
		abi: core_default.TicketCollection.abi,
		functionName: "ownerOf",
		args: [BigInt(id)]
	});
}
async function readVaultGov(vault, engineVersion = 3) {
	const { publicClient } = await readClient();
	const read = (functionName) => publicClient.readContract({
		address: vault,
		abi: core_default.EventVault.abi,
		functionName
	});
	const [govLocked, withdrawAllowed, escalated, yesWeight, soldWeight, voteDeadline, materialsURI, withdrawn, frozen] = await Promise.all([
		read("govLocked"),
		read("withdrawAllowed"),
		read("escalated"),
		read(engineVersion >= 4 ? "objectionWeight" : "yesWeight"),
		read("soldWeight"),
		read("voteDeadline"),
		read("materialsURI"),
		read("withdrawn"),
		read("frozen")
	]);
	return {
		govLocked,
		withdrawAllowed,
		escalated,
		yesWeight: Number(yesWeight),
		objectionWeight: engineVersion >= 4 ? Number(yesWeight) : 0,
		soldWeight: Number(soldWeight),
		voteDeadline: Number(voteDeadline),
		materialsURI,
		withdrawn,
		frozen
	};
}
async function submitRequestWithdraw(marketplace) {
	const { account, wallet, publicClient } = await clients();
	const hash = await wallet.writeContract({
		address: marketplace,
		abi: core_default.EventMarketplace.abi,
		functionName: "requestWithdraw",
		account
	});
	await wait(publicClient, hash);
	note(hash, "withdraw_request");
	return hash;
}
async function submitExecuteWithdraw(opts) {
	const { account, wallet, publicClient } = await clients();
	const hash = await wallet.writeContract({
		address: opts.marketplace,
		abi: core_default.EventMarketplace.abi,
		functionName: "executeWithdraw",
		args: [opts.token ?? "0x0000000000000000000000000000000000000000"],
		account
	});
	await wait(publicClient, hash);
	note(hash, "withdraw");
	return hash;
}
async function submitEscalate(opts) {
	const { account, wallet, publicClient } = await clients();
	const hash = await wallet.writeContract({
		address: opts.marketplace,
		abi: core_default.EventMarketplace.abi,
		functionName: "escalate",
		args: [opts.uri],
		account
	});
	await wait(publicClient, hash);
	note(hash, "escalate");
	return hash;
}
async function submitAdminDecide(opts) {
	const { account, wallet, publicClient } = await clients();
	const decide = await wallet.writeContract({
		address: opts.vault,
		abi: core_default.EventVault.abi,
		functionName: "adminDecide",
		args: [opts.approve],
		account
	});
	await wait(publicClient, decide);
	if (!opts.approve) {
		note(decide, "withdraw_reject");
		return {
			decideTx: decide,
			withdrawTx: null
		};
	}
	const withdrawTx = opts.token ? await wallet.writeContract({
		address: opts.vault,
		abi: core_default.EventVault.abi,
		functionName: "withdrawToken",
		args: [opts.token],
		account
	}) : await wallet.writeContract({
		address: opts.vault,
		abi: core_default.EventVault.abi,
		functionName: "withdraw",
		account
	});
	await wait(publicClient, withdrawTx);
	note(withdrawTx, "withdraw");
	return {
		decideTx: decide,
		withdrawTx
	};
}
async function verifyUserVote(opts) {
	const { publicClient } = await readClient();
	const receipt = await wait(publicClient, opts.txHash);
	if (receipt.from.toLowerCase() !== opts.voter.toLowerCase()) throw new Error("Vote transaction was not sent from your wallet.");
	if (!parseEventLogs({
		abi: core_default.EventMarketplace.abi,
		logs: receipt.logs,
		eventName: "Voted"
	}).some((l) => Number(l.args.id) === opts.ticketId)) throw new Error("On-chain Voted event not found for this ticket.");
	note(opts.txHash, "vote");
	return opts.txHash;
}
async function bankBalance(bank, holder) {
	const { publicClient } = await readClient();
	return await publicClient.readContract({
		address: bank,
		abi: core_default.DemoBank.abi,
		functionName: "balanceOf",
		args: [holder]
	});
}
/** DxDAI has no ERC-20 allowance. Markets pull only if the operator allow-listed them. */
async function marketPullAllowed(bank, market) {
	const { publicClient } = await readClient();
	return await publicClient.readContract({
		address: bank,
		abi: core_default.DemoBank.abi,
		functionName: "markets",
		args: [market]
	});
}
async function demoStatus(bank, holder) {
	const { publicClient } = await readClient();
	const [dripped, balance] = await Promise.all([publicClient.readContract({
		address: bank,
		abi: core_default.DemoBank.abi,
		functionName: "dripped",
		args: [holder]
	}), publicClient.readContract({
		address: bank,
		abi: core_default.DemoBank.abi,
		functionName: "balanceOf",
		args: [holder]
	})]);
	return {
		dripped,
		balance: balance.toString(),
		cents: Number(balance / 10n ** 16n)
	};
}
async function ensureNativeGas(to) {
	const { account, wallet, publicClient } = await clients();
	const bal = await publicClient.getBalance({ address: to });
	const min = 2n * 10n ** 16n;
	const topup = 5n * 10n ** 16n;
	if (bal >= min) return null;
	if (await publicClient.getBalance({ address: account.address }) < topup + min) throw new Error("Operator wallet needs testnet xDAI so preview wallets can pay gas.");
	const hash = await wallet.sendTransaction({
		account,
		to,
		value: topup
	});
	await wait(publicClient, hash);
	note(hash, "gas");
	return hash;
}
async function dripDemo(to, amountWei = 100n * 10n ** 18n) {
	const sql = await getSql();
	const infra = await loadInfra(sql);
	if (!infra.devMode || !infra.demoBank) throw new Error("Dev mode is off.");
	await assertDemoBank(infra.demoBank);
	const { account, wallet, publicClient } = await clients();
	const hash = await wallet.writeContract({
		address: infra.demoBank,
		abi: core_default.DemoBank.abi,
		functionName: "drip",
		args: [to, amountWei],
		account
	});
	await wait(publicClient, hash);
	note(hash, "drip");
	return hash;
}
//#endregion
export { bankBalance, centsToWei, demoStatus, deployDemoBank, deployEventContracts, dripDemo, ensureNativeGas, generateOperatorKey, lastAnchor, lastChainError, marketPullAllowed, mintTierOnChain, operatorAddressOf, pingChain, readOwnerOf, readVaultGov, setTierUriOnChain, submitAdminDecide, submitCancel, submitCheckIn, submitEscalate, submitExecuteWithdraw, submitFrozen, submitRequestWithdraw, submitWithdraw, verifyCheckIn, verifyUserBuy, verifyUserDelist, verifyUserList, verifyUserVote };
