import { o as __toESM } from "../_runtime.mjs";
import { t as friendlyChainError } from "./chain-errors-Ngnean6G.mjs";
import { a as paySymbol, i as formatAmount } from "./utils-CSfacMs6.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { T as require_jsx_runtime, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { R as prepareBuyer, a as useSession, x as fetchEvents } from "./router-BzXJkpoJ.mjs";
import { a as useChainRun, i as ChainDialog, n as Button, r as Card, t as AppShell } from "./card-DZLSP1m-.mjs";
import { t as Badge } from "./badge-BKi_jLwJ.mjs";
import { t as PhaseBadge } from "./phase-badge-_EV5AMYv.mjs";
import { t as Input } from "./input-DurNKGpM.mjs";
import { t as core_default } from "./core-c-NHi4tD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/marketplace-D_wwO9WV.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function MarketplacePage() {
	const { me, config, sendUserCall, refreshBalance } = useSession();
	const [q, setQ] = (0, import_react.useState)("");
	const [items, setItems] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [claiming, setClaiming] = (0, import_react.useState)(false);
	const chain = useChainRun();
	const symbol = paySymbol(config);
	(0, import_react.useEffect)(() => {
		let live = true;
		const t = setTimeout(() => {
			fetchEvents({ data: { q } }).then((rows) => {
				if (live) setItems(rows);
			}).finally(() => {
				if (live) setLoading(false);
			});
		}, 120);
		return () => {
			live = false;
			clearTimeout(t);
		};
	}, [q, me?.address]);
	async function claim() {
		if (!config?.demoBank) {
			toast.error("Dev mode is off.");
			return;
		}
		setClaiming(true);
		try {
			await chain.run({
				title: "Claim test coins",
				labels: [
					"Check claim availability",
					"Confirm in your wallet",
					"Add coins to your balance"
				],
				doneLabel: "Close",
				task: async (advance) => {
					const prep = await prepareBuyer();
					if (prep.demo?.dripped) {
						await refreshBalance(true);
						return `You already claimed ${formatAmount(prep.demo.cents, "DxDAI")}.`;
					}
					advance(1);
					await sendUserCall({
						to: config.demoBank,
						abi: core_default.DemoBank.abi,
						functionName: "claim",
						args: []
					});
					advance(2);
					await refreshBalance(true);
					return "100 DxDAI was added to your wallet.";
				},
				retry: () => void claim()
			});
		} catch (e) {
			toast.error(friendlyChainError(e));
		} finally {
			setClaiming(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-8 border-b border-border pb-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted",
					children: [config?.chainName ?? "Chiado", " · Find your next night out"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 font-display text-5xl tracking-tight",
					children: "Shows worth showing up for."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 max-w-xl text-sm text-muted",
					children: "Browse live events. Your ticket lives in your wallet."
				})
			]
		}),
		me && config?.devMode ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-6 flex flex-wrap items-center justify-between gap-3 p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Need test coins for a ticket? Claim 100 DxDAI here. A little xDAI covers network fees."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "outline",
				disabled: claiming,
				onClick: () => void claim(),
				children: claiming ? "Claiming…" : "Claim 100 DxDAI"
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChainDialog, {
			...chain,
			onClose: chain.close
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Search shows or places"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-4",
			children: [
				loading && !items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Loading the ledger…"
				}) : null,
				!loading && items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "No shows are on sale right now."
				}) : null,
				items.map((ev) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EventRow, {
					ev,
					symbol
				}, ev.id))
			]
		})
	] });
}
function EventRow({ ev, symbol }) {
	const soldOut = ev.available === 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/events/$eventId",
		params: { eventId: String(ev.id) },
		className: "stub grid overflow-hidden rounded-r-xl border border-border bg-bg-elevated transition-colors hover:border-primary/50 md:grid-cols-[220px_1fr]",
		children: [ev.posterUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: ev.posterUrl,
			alt: "",
			className: "h-40 w-full object-cover md:h-full"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid h-40 place-items-center bg-mist text-xs text-muted md:h-full",
			children: "No poster"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col justify-between p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: ev.category }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhaseBadge, { phase: ev.phase }),
						ev.frozen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: "danger",
							children: "Paused"
						}) : null,
						ev.engineVersion < 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: "danger",
							children: "Tickets need update"
						}) : null,
						soldOut && ev.phase === "active" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: "danger",
							children: "Sold out"
						}) : null,
						!soldOut && ev.sold > 0 && ev.phase === "active" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: "sage",
							children: "Resale live"
						}) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-2 font-display text-2xl italic",
					children: ev.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted",
					children: [
						new Date(ev.startsAt).toLocaleString(),
						" · ",
						ev.venue
					]
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-sm tabular-nums",
					children: ev.minCents != null && ev.maxCents != null ? ev.minCents === ev.maxCents ? formatAmount(ev.minCents, symbol) : `${formatAmount(ev.minCents, symbol)} – ${formatAmount(ev.maxCents, symbol)}` : "No listings"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted",
					children: [
						ev.available,
						" available · ",
						ev.sold,
						"/",
						ev.supply,
						" sold"
					]
				})]
			})]
		})]
	});
}
//#endregion
export { MarketplacePage as component };
