import { o as __toESM } from "../_runtime.mjs";
import { t as friendlyChainError } from "./chain-errors-Ngnean6G.mjs";
import { a as paySymbol, c as shortAddr, i as formatAmount, t as checkInPct } from "./utils-CSfacMs6.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { C as useNavigate, T as require_jsx_runtime, _ as Outlet, m as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { F as freezeShow, H as retryPendingIndex, N as fetchSignerOps, P as fetchWithdrawals, S as fetchInfra, a as useSession, c as explorerTx, f as claimPlatformAdmin, g as dismissPendingIndex, h as decidePayout, j as fetchPendingIndex, l as gatewayUrl, o as explorerAddress, y as fetchAdminEvents } from "./router-BzXJkpoJ.mjs";
import { a as useChainRun, i as ChainDialog, n as Button, r as Card, t as AppShell } from "./card-DZLSP1m-.mjs";
import { t as Hint } from "./hint-duAhVNAG.mjs";
import { t as Badge } from "./badge-BKi_jLwJ.mjs";
import { t as PhaseBadge } from "./phase-badge-_EV5AMYv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-DHPNs5N5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AdminLayout() {
	if (useRouterState({ select: (s) => s.location.pathname }) !== "/admin") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDashboard, {});
}
function AdminDashboard() {
	const { me, refresh, config } = useSession();
	const navigate = useNavigate();
	const [infra, setInfra] = (0, import_react.useState)(null);
	const [events, setEvents] = (0, import_react.useState)([]);
	const [payouts, setPayouts] = (0, import_react.useState)([]);
	const [ops, setOps] = (0, import_react.useState)([]);
	const [pending, setPending] = (0, import_react.useState)([]);
	const [busy, setBusy] = (0, import_react.useState)(null);
	const chain = useChainRun();
	const symbol = paySymbol(config);
	const explorer = config?.explorerUrl ?? "";
	async function load() {
		const [data, evs, pays, signerOps, lagged] = await Promise.all([
			fetchInfra(),
			fetchAdminEvents(),
			fetchWithdrawals(),
			fetchSignerOps(),
			fetchPendingIndex()
		]);
		setInfra(data);
		setEvents(evs);
		setPayouts(pays);
		setOps(signerOps);
		setPending(lagged);
	}
	(0, import_react.useEffect)(() => {
		if (me?.isAdmin) load().catch((e) => toast.error(friendlyChainError(e)));
	}, [me?.isAdmin]);
	async function runOp(id, labels, fn) {
		setBusy(id);
		try {
			await chain.run({
				title: id.startsWith("frz-") ? "Update event access" : id.startsWith("payout-") || id.startsWith("reject-") ? "Review payout" : "Update event record",
				labels,
				task: async (tick) => {
					await fn(tick);
					return "The update is complete.";
				},
				retry: () => void runOp(id, labels, fn)
			});
		} catch (e) {
			toast.error(friendlyChainError(e));
		} finally {
			setBusy(null);
		}
	}
	if (!me) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Connect a wallet."
	}) });
	if (!me.isAdmin) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
		className: "font-display text-4xl italic",
		children: "Admin"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "mt-6 max-w-lg p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm",
			children: [
				"This wallet is not the platform admin. The bootstrap file holds only the ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "public" }),
				" ",
				"admin wallet address — never a private key. Put that address in before start, or save this wallet once if none is configured yet. Operator keys, Pinata JWT and the database URL are stored in the connected database from Configuration."
			]
		}), !config?.adminConfigured ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			className: "mt-4",
			onClick: () => void (async () => {
				await claimPlatformAdmin();
				await refresh();
				toast.success("Saved as platform admin");
				navigate({ to: "/admin" });
			})(),
			children: "Save this wallet as platform admin"
		}) : null]
	})] });
	const incomplete = infra && !infra.setup.complete;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs uppercase tracking-wide text-muted",
				children: "Platform"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-4xl italic",
				children: "Dashboard"
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						onClick: () => void navigate({ to: "/admin/kyc" }),
						children: "KYC"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						onClick: () => void navigate({ to: "/admin/organizers" }),
						children: "Organizers"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => void navigate({ to: "/admin/config" }),
						children: "Configuration"
					})
				]
			})]
		}),
		incomplete ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-6 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm",
				children: "First-run setup is incomplete. Order: Database → Pinata → Signer key. Optional: Dev mode (DxDAI). The bootstrap file is only the public admin address and RPC — secrets stay in the database."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-3",
				onClick: () => void navigate({ to: "/admin/config" }),
				children: "Open setup"
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-3 sm:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs uppercase tracking-wide text-muted",
							children: "Signer"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 font-mono text-sm",
							children: infra?.chain.operatorAddress ? shortAddr(infra.chain.operatorAddress) : "not set"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted",
							children: infra?.chain.lastAnchor ? `${infra.chain.lastAnchor.kind} · ${infra.chain.lastAnchor.hash.slice(0, 10)}…` : "no recent operator tx"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-wide text-muted",
						children: "Pending payouts"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 font-mono text-2xl tabular-nums",
						children: payouts.filter((p) => p.status === "pending" || p.status === "escalated").length
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs uppercase tracking-wide text-muted",
							children: "Chain index"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 font-mono text-2xl tabular-nums",
							children: pending.length
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted",
							children: "chain ok, index lagged"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-wide text-muted",
						children: "Events"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 font-mono text-2xl tabular-nums",
						children: events.length
					})]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChainDialog, {
			...chain,
			onClose: chain.close
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-10 font-display text-2xl italic",
			children: "Chain index"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-sm text-muted",
			children: "Chain is the source of truth. Rows here are receipts that landed on Chiado but failed to update the index. Retry replays the same verify + index path. Dismiss marks it resolved without changing tickets."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 divide-y divide-border rounded-xl border border-border",
			children: [pending.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-6 text-sm text-muted",
				children: "No pending index rows."
			}) : null, pending.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-3 px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: row.kind }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-xs text-muted",
								children: new Date(row.createdAt).toLocaleString()
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-mono text-xs",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								className: "text-primary underline",
								href: explorerTx(row.txHash, explorer),
								target: "_blank",
								rel: "noreferrer",
								children: [row.txHash.slice(0, 18), "…"]
							})
						}),
						row.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-danger",
							children: row.error
						}) : null
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						disabled: busy !== null,
						onClick: () => {
							if (!window.confirm("Replay this on-chain transaction into the index? The receipt is the source of truth.")) return;
							runOp(`retry-${row.id}`, [
								"Read receipt",
								"Wait one block",
								"Update index"
							], async (tick) => {
								tick(1);
								await retryPendingIndex({ data: { id: row.id } });
								tick(3);
								await load();
								toast.success("Index replayed from chain");
							});
						},
						children: "Retry index"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						disabled: busy !== null,
						onClick: () => {
							if (!window.confirm("Mark this as resolved without changing the index?")) return;
							runOp(`dismiss-${row.id}`, ["Mark resolved"], async (tick) => {
								tick(0);
								await dismissPendingIndex({ data: { id: row.id } });
								tick(1);
								await load();
								toast.success("Dismissed");
							});
						},
						children: "Dismiss"
					})]
				})]
			}, row.id))]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-10 font-display text-2xl italic",
			children: "Withdraw requests"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-sm text-muted",
			children: "Legacy requests keep their original rules. Version 4 events open a seven-day opposition window; requests with at least one third opposed can be escalated here with materials."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 divide-y divide-border rounded-xl border border-border",
			children: [payouts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-6 text-sm text-muted",
				children: "No requests yet."
			}) : null, payouts.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2 px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm",
						children: [
							p.eventName,
							" · ",
							formatAmount(p.amountCents, symbol)
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-mono text-xs text-muted",
						children: [
							shortAddr(p.organizerWallet),
							p.soldWeight || p.yesWeight ? ` · ${p.engineVersion && p.engineVersion >= 4 ? "opposed" : "support"} ${p.yesWeight}/${p.soldWeight}` : "",
							p.deadline ? ` · until ${new Date(p.deadline).toLocaleString()}` : ""
						]
					}),
					p.materialsUri ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						className: "font-mono text-xs text-primary underline",
						href: gatewayUrl(p.materialsUri),
						target: "_blank",
						rel: "noreferrer",
						children: "materials"
					}) : null
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: p.status === "done" ? "sage" : p.status === "rejected" ? "danger" : "mist",
						children: p.status
					}), p.status === "pending" || p.status === "escalated" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						disabled: busy !== null,
						onClick: () => void runOp(`payout-${p.id}`, [
							"Review request",
							"Withdraw on-chain",
							"Index"
						], async (tick) => {
							tick(1);
							await decidePayout({ data: {
								requestId: p.id,
								approve: true
							} });
							tick(3);
							await load();
							toast.success("Payout sent");
						}),
						children: "Approve"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						disabled: busy !== null,
						onClick: () => void runOp(`reject-${p.id}`, ["Reject request", "Update index"], async (tick) => {
							tick(0);
							await decidePayout({ data: {
								requestId: p.id,
								approve: false
							} });
							tick(2);
							await load();
							toast.success("Rejected — vault stays locked to holders");
						}),
						children: "Reject"
					})] }) : null]
				})]
			}, p.id))]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
			className: "mt-10 font-display text-2xl italic",
			children: ["All events ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, { children: "Freezing pauses buying, resale, transfers and withdrawals. Check-in stays available." })]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 max-w-2xl text-sm text-muted",
			children: "Freeze locks the marketplace, the vault, and the ERC-721 collection (no buy, list, transfer, or withdraw). Check-in can still run. Shows minted before the collection must be reminted."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid gap-3",
			children: [events.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "p-5 text-sm text-muted",
				children: "No events yet."
			}) : null, events.map((ev) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "p-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhaseBadge, { phase: ev.phase }),
								ev.frozen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: "danger",
									children: "Frozen"
								}) : null,
								ev.withdrawn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: "ink",
									children: "Withdrawn"
								}) : null,
								ev.engineVersion < 3 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "Legacy" }) : null,
								ev.engineVersion >= 3 && !ev.collectionAddress ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: "danger",
									children: "No NFT"
								}) : null,
								ev.withdrawRequest === "pending_vote" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, { children: [
									"Vote ",
									ev.proposalYes,
									"/",
									ev.proposalSold
								] }) : null,
								ev.withdrawRequest === "escalated" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: "danger",
									children: "Escalated"
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, { children: [checkInPct(ev.checkInRate), " checked in"] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "mt-1 font-display text-xl italic",
							children: ev.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-muted",
							children: [
								ev.venue,
								" · sold ",
								ev.sold,
								"/",
								ev.supply,
								" · gate ",
								ev.checkedIn,
								" · vault",
								" ",
								formatAmount(ev.lockedCents, symbol)
							]
						}),
						ev.marketplaceAddress ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 font-mono text-xs text-muted",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									className: "text-primary underline",
									href: explorerAddress(ev.marketplaceAddress, explorer),
									target: "_blank",
									rel: "noreferrer",
									children: ["market ", shortAddr(ev.marketplaceAddress)]
								}),
								" · ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									className: "text-primary underline",
									href: explorerAddress(ev.vaultAddress ?? "", explorer),
									target: "_blank",
									rel: "noreferrer",
									children: ["vault ", shortAddr(ev.vaultAddress ?? "")]
								}),
								ev.collectionAddress ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [" · ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									className: "text-primary underline",
									href: explorerAddress(ev.collectionAddress, explorer),
									target: "_blank",
									rel: "noreferrer",
									children: ["collection ", shortAddr(ev.collectionAddress)]
								})] }) : null
							]
						}) : null
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: ev.frozen ? "outline" : "danger",
						disabled: busy !== null,
						onClick: () => void runOp(`frz-${ev.id}`, [
							"Sign freeze",
							"Wait one block",
							"Update index"
						], async (tick) => {
							tick(0);
							await freezeShow({ data: {
								eventId: ev.id,
								on: !ev.frozen
							} });
							tick(3);
							await load();
							toast.success(ev.frozen ? "Unfrozen" : "Frozen");
						}),
						children: ev.frozen ? "Unfreeze" : "Freeze"
					})]
				})
			}, ev.id))]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-10 font-display text-2xl italic",
			children: "Signer operations"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-sm text-muted",
			children: "On-chain work the operator key has indexed: deploys, mints, check-ins, refunds, freezes, withdrawals. Click through to the explorer."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 divide-y divide-border rounded-xl border border-border",
			children: [ops.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-6 text-sm text-muted",
				children: "No indexed operations yet."
			}) : null, ops.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap justify-between gap-2 px-4 py-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					row.kind,
					" ",
					row.eventName ? `· ${row.eventName}` : "",
					" ",
					row.onChain ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: "sage",
						children: "on-chain"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "index" })
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs text-muted",
					children: row.onChain ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						className: "text-primary underline",
						href: explorerTx(row.ref, explorer),
						target: "_blank",
						rel: "noreferrer",
						children: [row.ref.slice(0, 12), "…"]
					}) : row.ref.slice(0, 18)
				})]
			}, row.id))]
		})
	] });
}
//#endregion
export { AdminLayout as component };
