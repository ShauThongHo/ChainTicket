import { o as __toESM } from "../_runtime.mjs";
import { n as isInventoryRace } from "./chain-errors-Ngnean6G.mjs";
import { a as paySymbol, c as shortAddr, i as formatAmount } from "./utils-CSfacMs6.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { C as useNavigate, T as require_jsx_runtime, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as useSession, b as fetchEvent, c as explorerTx, l as gatewayUrl, n as Route$2, o as explorerAddress, s as explorerToken, u as buyNow, z as quoteBuy } from "./router-BzXJkpoJ.mjs";
import { a as useChainRun, i as ChainDialog, n as Button, r as Card, t as AppShell } from "./card-DZLSP1m-.mjs";
import { t as Badge } from "./badge-BKi_jLwJ.mjs";
import { t as PhaseBadge } from "./phase-badge-_EV5AMYv.mjs";
import { t as core_default } from "./core-c-NHi4tD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/events._eventId-Bkhu2smv.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function EventPage() {
	const { eventId } = Route$2.useParams();
	const id = Number(eventId);
	const { me, refreshBalance, config, sendUserCall, requestConnect } = useSession();
	const navigate = useNavigate();
	const chain = useChainRun();
	const [ev, setEv] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(null);
	const [receipt, setReceipt] = (0, import_react.useState)(null);
	const symbol = paySymbol(config);
	const explorer = config?.explorerUrl ?? "";
	(0, import_react.useEffect)(() => {
		fetchEvent({ data: { id } }).then(setEv);
	}, [id]);
	async function buy(tierId) {
		if (!me) {
			requestConnect();
			return;
		}
		if (!me.kyc || me.kyc.status !== "approved") {
			if (me.kyc?.status === "expired") toast.error("This ID has expired. Submit KYC again.");
			navigate({
				to: "/kyc",
				search: { next: `/events/${id}` }
			});
			return;
		}
		setBusy(tierId);
		const labels = [
			"Check price and stock",
			"Confirm payment in your wallet",
			"Wait for chain confirmation",
			"Save your ticket"
		];
		setReceipt(null);
		try {
			await chain.run({
				title: "Your ticket is on its way",
				labels,
				doneLabel: "View my tickets",
				onDone: () => navigate({ to: "/my-tickets" }),
				retry: () => void buy(tierId),
				onError: (error) => {
					if (isInventoryRace(error)) fetchEvent({ data: { id } }).then(setEv).catch(() => void 0);
				},
				task: async (advance) => {
					const quote = await quoteBuy({ data: { tierId } });
					if (!quote.payNative) {
						if (quote.marketPull === false) throw new Error("This ticket window cannot take test coins. Ask an admin to turn Dev mode off and on, then publish the show again.");
						if (quote.dxdaiWei == null || BigInt(quote.dxdaiWei) < BigInt(quote.priceWei)) throw new Error("Not enough test coins. Claim them on the shows page, then try again.");
					}
					advance(1);
					const hash = await sendUserCall({
						to: quote.marketplace,
						abi: core_default.EventMarketplace.abi,
						functionName: "buy",
						args: [BigInt(quote.chainId)],
						value: quote.payNative ? BigInt(quote.priceWei) : 0n
					}, { onSubmitted: () => advance(2) });
					advance(3);
					const res = await buyNow({ data: {
						tierId,
						txHash: hash,
						chainId: quote.chainId
					} });
					await refreshBalance(true);
					setReceipt({
						collection: res.collectionAddress ?? null,
						tokenId: String(res.serial),
						tokenUri: res.tokenUri ?? null
					});
					return `Ticket saved at ${formatAmount(res.priceCents, symbol)}.`;
				}
			});
		} finally {
			setBusy(null);
		}
	}
	if (!ev) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Loading event…"
	}) });
	const stale = ev.engineVersion < 2;
	const closed = ev.phase !== "active";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		ev.posterUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: ev.posterUrl,
			alt: "",
			className: "h-56 w-full rounded-xl object-cover md:h-72"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid h-40 place-items-center rounded-xl border border-dashed border-border text-sm text-muted",
			children: "No poster"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 flex flex-wrap items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: ev.category }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhaseBadge, { phase: ev.phase }),
				ev.frozen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "danger",
					children: "Frozen"
				}) : null
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "mt-3 font-display text-4xl italic",
			children: ev.name
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-2 text-sm text-muted",
			children: [
				new Date(ev.startsAt).toLocaleString(),
				" — ",
				new Date(ev.endsAt).toLocaleString(),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
				ev.venue
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 max-w-2xl text-sm leading-relaxed",
			children: ev.description
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
			className: "mt-4 max-w-2xl text-xs text-muted",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
					className: "cursor-pointer",
					children: "Event details"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2",
					children: [
						"Organized by ",
						ev.organizerName ?? shortAddr(ev.organizerWallet),
						" · resale royalty ",
						(ev.royaltyBps / 100).toFixed(1),
						"%"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 break-all font-mono",
					children: [
						ev.vaultAddress ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							className: "text-primary underline",
							href: explorerAddress(ev.vaultAddress, explorer),
							target: "_blank",
							rel: "noreferrer",
							children: ["vault ", shortAddr(ev.vaultAddress)]
						}) : null,
						ev.marketplaceAddress ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [" · ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							className: "text-primary underline",
							href: explorerAddress(ev.marketplaceAddress, explorer),
							target: "_blank",
							rel: "noreferrer",
							children: ["marketplace ", shortAddr(ev.marketplaceAddress)]
						})] }) : null,
						ev.collectionAddress ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [" · ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							className: "text-primary underline",
							href: explorerAddress(ev.collectionAddress, explorer),
							target: "_blank",
							rel: "noreferrer",
							children: ["collection ", shortAddr(ev.collectionAddress)]
						})] }) : null,
						ev.deployTx ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [" · ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							className: "text-muted underline",
							href: explorerTx(ev.deployTx, explorer),
							target: "_blank",
							rel: "noreferrer",
							children: "deploy tx"
						})] }) : null
					]
				})
			]
		}),
		stale ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-danger",
			children: "This event was minted on the old operator-signed contract. Ask the organizer to mint a new event so your wallet can send buy() itself."
		}) : null,
		ev.engineVersion >= 3 && !ev.collectionAddress ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-danger",
			children: "This show has no ERC-721 collection. Ask the organizer to mint a new event."
		}) : null,
		ev.frozen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-danger",
			children: "Trading is frozen by the platform admin."
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChainDialog, {
			...chain,
			onClose: chain.close,
			successDetails: receipt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-1 text-xs text-muted",
				children: [
					receipt.collection ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						className: "text-primary underline",
						href: explorerAddress(receipt.collection, explorer),
						target: "_blank",
						rel: "noreferrer",
						children: ["Collection ", shortAddr(receipt.collection)]
					}) : null,
					receipt.collection ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						className: "text-primary underline",
						href: explorerToken(receipt.collection, receipt.tokenId, explorer),
						target: "_blank",
						rel: "noreferrer",
						children: [
							"Token #",
							receipt.tokenId,
							" in explorer"
						]
					}) : null,
					receipt.tokenUri ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						className: "text-primary underline",
						href: gatewayUrl(receipt.tokenUri),
						target: "_blank",
						rel: "noreferrer",
						children: "Open ticket details"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Explorer images can take time to appear. Open the details to check the JSON and image." })
				]
			}) : null
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-8 grid gap-4",
			children: ev.tiers.map((tier) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "stub p-5 pl-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-2xl italic",
							children: tier.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
							className: "mt-1 text-xs text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
								className: "cursor-pointer",
								children: "Ticket details"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 block break-all font-mono",
								children: tier.contractAddress
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm text-muted",
							children: [
								tier.available,
								" available · ",
								formatAmount(tier.faceCents, symbol)
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-mono text-sm tabular-nums",
							children: tier.minCents != null && tier.maxCents != null ? tier.minCents === tier.maxCents ? `Pool ${formatAmount(tier.minCents, symbol)}` : `Pool ${formatAmount(tier.minCents, symbol)} – ${formatAmount(tier.maxCents, symbol)}` : "No live listings"
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						disabled: busy !== null || !tier.available || closed || stale || ev.frozen,
						onClick: () => void buy(tier.id),
						children: busy === tier.id ? "Sending…" : "Buy now"
					})]
				})
			}, tier.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-4 text-xs text-muted",
			children: [
				"KYC approval is required to buy. Need test coins? Claim them on the shows page.",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/kyc",
					className: "underline",
					children: "Open KYC"
				})
			]
		})
	] });
}
//#endregion
export { EventPage as component };
