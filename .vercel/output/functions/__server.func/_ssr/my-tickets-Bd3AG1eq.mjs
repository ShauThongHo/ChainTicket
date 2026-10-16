import { o as __toESM } from "../_runtime.mjs";
import { t as friendlyChainError } from "./chain-errors-Ngnean6G.mjs";
import { a as paySymbol, i as formatAmount, s as priceBounds } from "./utils-CSfacMs6.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { T as require_jsx_runtime, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { B as quoteList, D as fetchMyTickets, M as fetchQr, X as sellTicket, a as useSession, d as cancelListing, l as gatewayUrl, p as confirmVote, s as explorerToken } from "./router-BzXJkpoJ.mjs";
import { a as useChainRun, i as ChainDialog, n as Button, r as Card, t as AppShell } from "./card-DZLSP1m-.mjs";
import { t as Badge } from "./badge-BKi_jLwJ.mjs";
import { t as PhaseBadge } from "./phase-badge-_EV5AMYv.mjs";
import { t as Input } from "./input-DurNKGpM.mjs";
import { t as core_default } from "./core-c-NHi4tD.mjs";
import { t as require_lib } from "../_libs/qrcode.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/my-tickets-Bd3AG1eq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_lib = /* @__PURE__ */ __toESM(require_lib());
function MyTicketsPage() {
	const { me, config } = useSession();
	const [tickets, setTickets] = (0, import_react.useState)([]);
	const symbol = paySymbol(config);
	async function reload() {
		const rows = await fetchMyTickets();
		setTickets(rows);
	}
	(0, import_react.useEffect)(() => {
		if (me) reload();
	}, [me]);
	const upcoming = tickets.filter((t) => t.status === "owned" || t.status === "listed").length;
	if (!me) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "text-sm text-muted",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/",
				className: "underline",
				children: "Connect a wallet"
			}),
			" ",
			"to see your collection."
		]
	}) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-4xl",
			children: "Your tickets"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-3 sm:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Held",
					value: String(tickets.length)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Live / listed",
					value: String(upcoming)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Balance",
					value: formatAmount(me.spendableCents, symbol)
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-8 grid gap-4",
			children: tickets.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					"No tickets yet.",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/marketplace",
						className: "underline",
						children: "Open the marketplace"
					})
				]
			}) : tickets.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TicketCard, {
				ticket: t,
				onChange: () => void reload()
			}, t.id))
		})
	] });
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs uppercase tracking-wide text-muted",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 font-mono text-xl tabular-nums",
			children: value
		})]
	});
}
function TicketCard({ ticket, onChange }) {
	const { sendUserCall, config } = useSession();
	const bounds = priceBounds(ticket.faceCents);
	const [price, setPrice] = (0, import_react.useState)(((bounds.min + bounds.max) / 2 / 100).toFixed(2));
	const [qr, setQr] = (0, import_react.useState)(null);
	const [img, setImg] = (0, import_react.useState)(null);
	const [art, setArt] = (0, import_react.useState)(ticket.posterUrl || "");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const chain = useChainRun();
	const symbol = paySymbol(config);
	const live = ticket.phase === "active";
	const explorer = config?.explorerUrl ?? "";
	const market = ticket.marketplaceAddress || "";
	(0, import_react.useEffect)(() => {
		if (!ticket.tokenUri) return;
		let stop = false;
		fetch(gatewayUrl(ticket.tokenUri)).then((r) => r.json()).then((json) => {
			if (stop || typeof json.image !== "string" || !json.image) return;
			setArt(gatewayUrl(json.image));
		}).catch(() => void 0);
		return () => {
			stop = true;
		};
	}, [ticket.tokenUri]);
	(0, import_react.useEffect)(() => {
		let stop = false;
		async function tick() {
			try {
				const data = await fetchQr({ data: { ticketId: ticket.id } });
				if (stop) return;
				setQr(data);
				if (data.payload) setImg(await import_lib.toDataURL(data.payload, {
					margin: 1,
					width: 280
				}));
				else setImg(null);
			} catch {
				if (!stop) setQr(null);
			}
		}
		tick();
		const id = setInterval(() => void tick(), 5e3);
		return () => {
			stop = true;
			clearInterval(id);
		};
	}, [ticket.id, ticket.status]);
	const unlockLabel = (0, import_react.useMemo)(() => {
		if (!qr?.unlocksAt) return null;
		const ms = new Date(qr.unlocksAt).getTime() - Date.now();
		if (ms <= 0) return "Unlocked";
		return `Unlocks in ${Math.floor(ms / 36e5)}h ${Math.floor(ms % 36e5 / 6e4)}m`;
	}, [qr]);
	async function list() {
		if (!ticket.chainId) {
			toast.error("Ticket is not on-chain.");
			return;
		}
		const cents = Math.round(Number(price) * 100);
		const labels = [
			"Check ticket price",
			"Confirm listing in your wallet",
			"Save your listing"
		];
		setBusy(true);
		try {
			await chain.run({
				title: "List your ticket",
				labels,
				task: async (advance) => {
					const quote = await quoteList({ data: {
						ticketId: ticket.id,
						priceCents: cents
					} });
					if (!quote.marketplace) throw new Error("No marketplace contract.");
					advance(1);
					const hash = await sendUserCall({
						to: quote.marketplace,
						abi: core_default.EventMarketplace.abi,
						functionName: "list",
						args: [BigInt(quote.chainId), BigInt(quote.priceWei)]
					});
					advance(2);
					await sellTicket({ data: {
						ticketId: ticket.id,
						priceCents: cents,
						txHash: hash
					} });
					onChange();
					return "Your ticket is now listed for sale.";
				},
				retry: () => void list()
			});
		} catch (e) {
			toast.error(friendlyChainError(e));
		} finally {
			setBusy(false);
		}
	}
	async function delist() {
		if (!ticket.chainId || !market) return;
		setBusy(true);
		const labels = ["Confirm cancellation in your wallet", "Save the update"];
		try {
			await chain.run({
				title: "Remove your ticket listing",
				labels,
				task: async (advance) => {
					const hash = await sendUserCall({
						to: market,
						abi: core_default.EventMarketplace.abi,
						functionName: "delist",
						args: [BigInt(ticket.chainId)]
					});
					advance(1);
					await cancelListing({ data: {
						ticketId: ticket.id,
						txHash: hash
					} });
					onChange();
					return "Your ticket is back in your wallet.";
				},
				retry: () => void delist()
			});
		} catch (e) {
			toast.error(friendlyChainError(e));
		} finally {
			setBusy(false);
		}
	}
	async function vote() {
		if (!ticket.chainId || !market) {
			toast.error("This ticket has no marketplace vote.");
			return;
		}
		setBusy(true);
		const opposing = ticket.engineVersion >= 4;
		const labels = [opposing ? "Confirm your objection in your wallet" : "Confirm your support vote in your wallet", "Record your vote"];
		try {
			await chain.run({
				title: opposing ? "Object to the payout" : "Vote on the payout",
				labels,
				task: async (advance) => {
					const hash = await sendUserCall({
						to: market,
						abi: core_default.EventMarketplace.abi,
						functionName: "vote",
						args: [BigInt(ticket.chainId)]
					});
					advance(1);
					await confirmVote({ data: {
						ticketId: ticket.id,
						txHash: hash
					} });
					onChange();
					return opposing ? "Your objection was recorded for this ticket." : "Your support vote was recorded.";
				},
				retry: () => void vote()
			});
		} catch (e) {
			toast.error(friendlyChainError(e));
		} finally {
			setBusy(false);
		}
	}
	const canVote = ticket.proposal?.status === "pending_vote" && !ticket.proposal.hasVoted && (ticket.status === "owned" || ticket.status === "listed" || ticket.status === "used");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "stub grid overflow-hidden pl-4 md:grid-cols-[220px_1fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col items-center gap-3 bg-mist p-5",
			children: [art ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: art,
				alt: "",
				className: "h-44 w-full rounded-md object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid h-44 w-full place-items-center rounded-md border border-dashed border-border text-xs text-muted",
				children: "NFT art"
			}), img ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: img,
				alt: "Dynamic gate QR",
				className: "size-28 rounded-md bg-paper p-2"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid w-full place-items-center rounded-md border border-dashed border-border bg-paper p-3 text-center text-xs text-muted",
				children: [qr?.reason ?? "QR locked until 2 hours before doors", unlockLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-2 block font-mono",
					children: unlockLabel
				}) : null]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhaseBadge, { phase: ticket.phase }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: ticket.status === "used" ? "ink" : "sage",
							children: ticket.status
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: ticket.tierName })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-2 font-display text-2xl italic",
					children: ticket.eventName
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted",
					children: [
						ticket.venue,
						" · ",
						new Date(ticket.startsAt).toLocaleString()
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 font-mono text-xs text-muted",
					children: [
						"NFT #",
						ticket.chainId ?? "—",
						" · face ",
						formatAmount(ticket.faceCents, symbol)
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 font-mono text-xs text-muted",
					children: [ticket.collectionAddress && ticket.chainId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						className: "text-primary underline",
						href: explorerToken(ticket.collectionAddress, ticket.chainId, explorer),
						target: "_blank",
						rel: "noreferrer",
						children: [
							"collection ",
							ticket.collectionAddress.slice(0, 8),
							"…"
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: ticket.tokenId }), ticket.tokenUri ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [" · ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						className: "text-primary underline",
						href: gatewayUrl(ticket.tokenUri),
						target: "_blank",
						rel: "noreferrer",
						children: "Open ticket details"
					})] }) : null]
				}),
				ticket.proposal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-sm text-muted",
					children: [
						ticket.engineVersion >= 4 ? "Payout objections" : "Payout support votes",
						" ",
						ticket.proposal.yesWeight,
						"/",
						ticket.proposal.soldWeight,
						ticket.proposal.hasVoted ? " · you voted" : "",
						" · ",
						ticket.proposal.status.replace("_", " ")
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChainDialog, {
					...chain,
					onClose: chain.close
				}),
				live && (ticket.status === "owned" || ticket.status === "listed") ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap items-end gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted",
						children: [
							"Resale ",
							formatAmount(bounds.min, symbol),
							" – ",
							formatAmount(bounds.max, symbol)
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1 w-36",
						value: price,
						onChange: (e) => setPrice(e.target.value)
					})] }), ticket.status === "listed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						disabled: busy,
						onClick: () => void delist(),
						children: busy ? "Sending…" : `Delist ${ticket.listPriceCents ? formatAmount(ticket.listPriceCents, symbol) : ""}`
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						disabled: busy,
						onClick: () => void list(),
						children: busy ? "Sending…" : "List in pool"
					})]
				}) : null,
				canVote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "mt-4",
					disabled: busy,
					onClick: () => void vote(),
					children: busy ? "Sending…" : "Vote to release vault"
				}) : null
			]
		})]
	});
}
//#endregion
export { MyTicketsPage as component };
