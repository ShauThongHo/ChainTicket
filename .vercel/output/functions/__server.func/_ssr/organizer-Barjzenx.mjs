import { o as __toESM } from "../_runtime.mjs";
import { t as friendlyChainError } from "./chain-errors-Ngnean6G.mjs";
import { a as paySymbol, c as shortAddr, i as formatAmount, t as checkInPct } from "./utils-CSfacMs6.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { T as require_jsx_runtime, _ as Outlet, m as useRouterState, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { O as fetchOrganizer, V as refundEvent, _ as escalatePayout, a as useSession, c as explorerTx, et as uploadPoster, k as fetchOrganizerEventLedger, l as gatewayUrl, o as explorerAddress, tt as withdrawEvent, v as executePayout } from "./router-BzXJkpoJ.mjs";
import { a as useChainRun, i as ChainDialog, n as Button, r as Card, t as AppShell } from "./card-DZLSP1m-.mjs";
import { t as Hint } from "./hint-duAhVNAG.mjs";
import { t as Badge } from "./badge-BKi_jLwJ.mjs";
import { t as PhaseBadge } from "./phase-badge-_EV5AMYv.mjs";
import { t as Input } from "./input-DurNKGpM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/organizer-Barjzenx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function OrganizerLayout() {
	if (useRouterState({ select: (s) => s.location.pathname }) !== "/organizer") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrganizerHome, {});
}
function OrganizerHome() {
	const { me, config } = useSession();
	const [events, setEvents] = (0, import_react.useState)([]);
	const chain = useChainRun();
	const symbol = paySymbol(config);
	const explorer = config?.explorerUrl ?? "";
	async function reload() {
		const data = await fetchOrganizer();
		setEvents(data.events);
	}
	(0, import_react.useEffect)(() => {
		if (me?.isOrganizer) reload();
	}, [me?.isOrganizer]);
	if (!me) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Connect a wallet."
	}) });
	if (!me.isOrganizer) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
		className: "font-display text-4xl italic",
		children: "Organizer portal"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "mt-3 max-w-lg text-sm text-muted",
		children: [
			"This wallet is not on the organizer list. Ask the platform admin to verify",
			" ",
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono",
				children: me.address
			}),
			"."
		]
	})] });
	const locked = events.reduce((s, e) => s + e.lockedCents, 0);
	const activeCount = events.filter((e) => e.phase === "active").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-4xl italic",
				children: me.organizerName
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "outline",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/organizer/scan",
						children: "Scan tickets"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/organizer/mint",
						children: "New event"
					})
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-3 sm:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Locked in vaults"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 font-mono text-2xl tabular-nums",
						children: formatAmount(locked, symbol)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Active events"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 font-mono text-2xl tabular-nums",
						children: activeCount
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Withdrawable ledger"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 font-mono text-2xl tabular-nums",
						children: formatAmount(me.spendableCents, symbol)
					})]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChainDialog, {
			...chain,
			onClose: chain.close
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
			className: "mt-10 flex items-center gap-2 font-display text-2xl italic",
			children: ["Your events ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, { children: "New events use a seven-day objection window after the show. One third or more opposition sends the request to Admin review. Older events keep their original support vote." })]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid gap-3",
			children: [events.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5 text-sm text-muted",
				children: ["No shows yet. ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/organizer/mint",
					className: "underline",
					children: "Create an event"
				})]
			}) : null, events.map((ev) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrganizerEventCard, {
				ev,
				explorer,
				symbol,
				onDone: () => void reload(),
				runChain: (title, labels, task) => chain.run({
					title,
					labels,
					task: async (advance) => {
						await task(advance);
						return "The update is complete.";
					}
				})
			}, ev.id))]
		})
	] });
}
function readBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const raw = String(reader.result || "");
			const i = raw.indexOf(",");
			resolve(i >= 0 ? raw.slice(i + 1) : raw);
		};
		reader.onerror = () => reject(/* @__PURE__ */ new Error("Could not read that file."));
		reader.readAsDataURL(file);
	});
}
function OrganizerEventCard({ ev, explorer, symbol, onDone, runChain }) {
	const [materials, setMaterials] = (0, import_react.useState)("");
	const [file, setFile] = (0, import_react.useState)(null);
	const [ledger, setLedger] = (0, import_react.useState)([]);
	const [ledgerLoaded, setLedgerLoaded] = (0, import_react.useState)(false);
	const gov = ev.engineVersion >= 3;
	const opposition = ev.engineVersion >= 4;
	const open = ev.withdrawRequest === "pending" || ev.withdrawRequest === "pending_vote" || ev.withdrawRequest === "passed" || ev.withdrawRequest === "escalated";
	const deadlinePassed = ev.proposalDeadline ? Date.now() >= new Date(ev.proposalDeadline).getTime() : false;
	const need = opposition ? Math.ceil(ev.proposalSold / 3) : Math.ceil(ev.proposalSold * 2 / 3);
	const ended = Date.now() >= new Date(ev.endsAt).getTime();
	async function requestWithdraw() {
		const labels = gov ? [
			"Open holder vote",
			"Wait one block",
			"Index proposal"
		] : ["Submit request", "Wait for admin"];
		try {
			await runChain("Request a payout", labels, async (tick) => {
				tick(0);
				const res = await withdrawEvent({ data: { eventId: ev.id } });
				tick(labels.length);
				if ((res.ref && typeof res.ref === "object" && "status" in res.ref ? String(res.ref.status) : "") === "passed") toast.success("Vote passed. You can now withdraw.");
				else if (gov) toast.success("Holder vote opened.");
				else toast.success("Payout request sent for review.");
				onDone();
			});
		} catch (e) {
			toast.error(friendlyChainError(e));
		}
	}
	async function execute() {
		const labels = [
			"Execute withdraw",
			"Wait one block",
			"Index"
		];
		try {
			await runChain("Withdraw event funds", labels, async (tick) => {
				tick(1);
				await executePayout({ data: { eventId: ev.id } });
				tick(3);
				toast.success("Funds sent to your wallet.");
				onDone();
			});
		} catch (e) {
			toast.error(friendlyChainError(e));
		}
	}
	async function escalate() {
		const labels = [
			"Pin materials",
			"Escalate on-chain",
			"Index"
		];
		try {
			await runChain("Send payout for review", labels, async (tick) => {
				let uri = materials.trim();
				if (file) {
					const base64 = await readBase64(file);
					uri = (await uploadPoster({ data: {
						filename: file.name,
						contentType: file.type || "application/octet-stream",
						base64
					} })).uri;
				}
				if (!uri) throw new Error("Add a payout document first.");
				tick(1);
				await escalatePayout({ data: {
					eventId: ev.id,
					materialsUri: uri
				} });
				tick(3);
				toast.success("Sent to admin for review.");
				onDone();
			});
		} catch (e) {
			toast.error(friendlyChainError(e));
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
							ev.withdrawRequest === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "Admin review" }) : null,
							ev.withdrawRequest === "pending_vote" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "Voting" }) : null,
							ev.withdrawRequest === "passed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "sage",
								children: opposition ? "Vote window passed" : "2/3 reached"
							}) : null,
							ev.withdrawRequest === "escalated" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "danger",
								children: "Escalated"
							}) : null,
							ev.engineVersion < 3 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "Legacy payout" }) : null,
							gov && !ev.collectionAddress ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "danger",
								children: "No NFT — remint"
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
								tone: "sage",
								children: [checkInPct(ev.checkInRate), " checked in"]
							})
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
							"/",
							ev.sold || 0,
							" · vault",
							" ",
							formatAmount(ev.lockedCents, symbol)
						]
					}),
					ev.withdrawRequest === "pending_vote" || ev.withdrawRequest === "passed" || ev.withdrawRequest === "escalated" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted",
						children: [
							opposition ? "Opposed" : "Support",
							" ",
							ev.proposalYes,
							"/",
							ev.proposalSold,
							ev.proposalSold > 0 ? opposition ? ` · admin review at ${need}+` : ` · need ${need}` : " · no holders",
							ev.proposalDeadline ? ` · deadline ${new Date(ev.proposalDeadline).toLocaleString()}` : ""
						]
					}) : null,
					ev.materialsUri ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 font-mono text-xs",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							className: "text-primary underline",
							href: gatewayUrl(ev.materialsUri),
							target: "_blank",
							rel: "noreferrer",
							children: "payout materials"
						})
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 font-mono text-xs text-muted",
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
								children: ["market ", shortAddr(ev.marketplaceAddress)]
							})] }) : null,
							ev.collectionAddress ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [" · ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								className: "text-primary underline",
								href: explorerAddress(ev.collectionAddress, explorer),
								target: "_blank",
								rel: "noreferrer",
								children: ["collection ", shortAddr(ev.collectionAddress)]
							})] }) : null
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							disabled: ended || ev.cancelled,
							onClick: async () => {
								const labels = [
									"Confirm event cancellation",
									"Refund ticket holders",
									"Save updates"
								];
								try {
									await runChain("Cancel event and refund tickets", labels, async (tick) => {
										tick(1);
										await refundEvent({ data: { eventId: ev.id } });
										tick(3);
										toast.success("Refunds sent to ticket holders.");
										onDone();
									});
								} catch (e) {
									toast.error(friendlyChainError(e));
								}
							},
							children: "Cancel & refund"
						}),
						!open && !ev.withdrawn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							disabled: !ended || ev.frozen || gov && !ev.collectionAddress,
							onClick: () => void requestWithdraw(),
							children: gov ? "Open holder vote" : "Request withdraw"
						}) : null,
						!ended && !ev.withdrawn ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "basis-full text-right text-xs text-muted",
							children: [
								"Withdrawals unlock ",
								new Date(ev.endsAt).toLocaleString(),
								"."
							]
						}) : null,
						(ev.withdrawRequest === "passed" || opposition && ev.withdrawRequest === "pending_vote" && deadlinePassed && (ev.proposalSold === 0 || ev.proposalYes * 3 < ev.proposalSold)) && !ev.withdrawn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							disabled: ev.frozen,
							onClick: () => void execute(),
							children: "Execute withdraw"
						}) : null
					]
				})]
			}),
			gov && ev.withdrawRequest === "pending_vote" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-2 border-t border-border pt-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: deadlinePassed ? opposition ? ev.proposalSold > 0 && ev.proposalYes * 3 >= ev.proposalSold ? "The 7-day window ended with at least one third opposed. Upload payout materials for Admin review." : "The 7-day window ended below the objection threshold. Withdraw the funds when ready." : "The vote missed 2/3. Upload payout materials for Admin review." : opposition ? "Ticket holders can oppose for 7 days. At one third or more, Admin reviews the payout." : "Voting is open. Escalate unlocks only after the deadline."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "file",
						accept: "image/*,.pdf,.txt",
						disabled: !deadlinePassed || opposition && ev.proposalSold > 0 && ev.proposalYes * 3 < ev.proposalSold,
						onChange: (e) => setFile(e.target.files?.[0] ?? null)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "or paste ipfs://… materials URI",
						value: materials,
						disabled: !deadlinePassed || opposition && ev.proposalSold > 0 && ev.proposalYes * 3 < ev.proposalSold,
						onChange: (e) => setMaterials(e.target.value)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						disabled: !deadlinePassed || ev.frozen || opposition && (ev.proposalSold === 0 || ev.proposalYes * 3 < ev.proposalSold),
						onClick: () => void escalate(),
						children: "Escalate to admin"
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "mt-4 border-t border-border pt-3",
				onToggle: (event) => {
					if (event.currentTarget.open && !ledgerLoaded) {
						setLedgerLoaded(true);
						fetchOrganizerEventLedger({ data: { eventId: ev.id } }).then(setLedger).catch((error) => {
							setLedgerLoaded(false);
							toast.error(friendlyChainError(error));
						});
					}
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
					className: "cursor-pointer text-sm font-medium",
					children: ["Event history ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-muted",
						children: [
							"(",
							ledger.length,
							")"
						]
					})]
				}), ledger.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "pt-3 text-xs text-muted",
					children: "No recorded activity yet."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 divide-y divide-border",
					children: ledger.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap justify-between gap-2 py-2 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							row.kind,
							" · ",
							new Date(row.createdAt).toLocaleString()
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono text-muted",
							children: [
								formatAmount(row.amountCents, symbol),
								" · ",
								row.onChain ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									className: "text-primary underline",
									href: explorerTx(row.ref, explorer),
									target: "_blank",
									rel: "noreferrer",
									children: [row.ref.slice(0, 12), "…"]
								}) : row.ref.slice(0, 18)
							]
						})]
					}, row.id))
				})]
			})
		]
	});
}
//#endregion
export { OrganizerLayout as component };
