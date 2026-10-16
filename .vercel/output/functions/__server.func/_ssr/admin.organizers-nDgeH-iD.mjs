import { o as __toESM } from "../_runtime.mjs";
import { c as shortAddr } from "./utils-CSfacMs6.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { T as require_jsx_runtime, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { A as fetchOrganizers, K as saveOrganizer, L as patchOrganizer, a as useSession } from "./router-BzXJkpoJ.mjs";
import { n as Button, r as Card, t as AppShell } from "./card-DZLSP1m-.mjs";
import { t as Badge } from "./badge-BKi_jLwJ.mjs";
import { t as Input } from "./input-DurNKGpM.mjs";
import { t as Label } from "./label-DCFjKh4h.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.organizers-nDgeH-iD.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function OrganizersPage() {
	const { me, refresh } = useSession();
	const [rows, setRows] = (0, import_react.useState)([]);
	const [wallet, setWallet] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	async function reload() {
		setLoading(true);
		try {
			setRows(await fetchOrganizers());
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not load organizers");
		} finally {
			setLoading(false);
		}
	}
	(0, import_react.useEffect)(() => {
		if (me?.isAdmin) reload();
	}, [me?.isAdmin]);
	if (!me?.isAdmin) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Admin only."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		asChild: true,
		className: "mt-4",
		variant: "outline",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/admin",
			children: "Back to Admin"
		})
	})] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs uppercase tracking-wide text-muted",
					children: "Access"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-4xl italic",
					children: "Verified organizers"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 max-w-xl text-sm text-muted",
					children: "Paste a venue wallet and approve it. Connecting that wallet later opens the organizer dashboard automatically. The platform admin is not an organizer."
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				asChild: true,
				variant: "outline",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/admin",
					children: "Dashboard"
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "mt-6 max-w-xl p-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Organizer wallet" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: wallet,
							onChange: (e) => setWallet(e.target.value),
							placeholder: "0x…"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Label / name" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: name,
							onChange: (e) => setName(e.target.value),
							placeholder: "Venue company"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: async () => {
							try {
								await saveOrganizer({ data: {
									wallet,
									name
								} });
								toast.success("Organizer approved");
								setName("");
								setWallet("");
								await reload();
								await refresh();
							} catch (e) {
								toast.error(e instanceof Error ? e.message : "Failed");
							}
						},
						children: "Verify & add"
					})
				]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 divide-y divide-border rounded-xl border border-border",
			children: [
				loading && rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 py-6 text-sm text-muted",
					children: "Loading organizers…"
				}) : null,
				!loading && rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 py-6 text-sm text-muted",
					children: "No organizers yet. Add a wallet above."
				}) : null,
				rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: row.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-xs text-muted",
						children: shortAddr(row.wallet)
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: row.status === "approved" ? "sage" : "danger",
								children: row.status
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-xs text-muted",
								children: [row.eventCount, " events"]
							}),
							row.status === "approved" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: async () => {
									await patchOrganizer({ data: {
										wallet: row.wallet,
										status: "revoked"
									} });
									await reload();
								},
								children: "Revoke"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								onClick: async () => {
									await patchOrganizer({ data: {
										wallet: row.wallet,
										status: "approved"
									} });
									await reload();
								},
								children: "Approve"
							})
						]
					})]
				}, row.wallet))
			]
		})
	] });
}
//#endregion
export { OrganizersPage as component };
