import { o as __toESM } from "../_runtime.mjs";
import { c as shortAddr } from "./utils-CSfacMs6.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { C as useNavigate, T as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { C as fetchKycDetail, T as fetchKycQueue, U as reviewKyc, a as useSession, w as fetchKycPhoto } from "./router-BzXJkpoJ.mjs";
import { n as Button, r as Card, t as AppShell } from "./card-DZLSP1m-.mjs";
import { t as Badge } from "./badge-BKi_jLwJ.mjs";
import { t as Input } from "./input-DurNKGpM.mjs";
import { t as Label } from "./label-DCFjKh4h.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.kyc-Cgk702bk.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AdminKyc() {
	const { me } = useSession();
	const navigate = useNavigate();
	const [q, setQ] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("");
	const [from, setFrom] = (0, import_react.useState)("");
	const [to, setTo] = (0, import_react.useState)("");
	const [rows, setRows] = (0, import_react.useState)([]);
	const [detail, setDetail] = (0, import_react.useState)(null);
	const [photo, setPhoto] = (0, import_react.useState)(null);
	const [photoBusy, setPhotoBusy] = (0, import_react.useState)(false);
	const [reason, setReason] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function load() {
		const list = await fetchKycQueue({ data: {
			q,
			status,
			from: from ? new Date(from).toISOString() : "",
			to: to ? (/* @__PURE__ */ new Date(`${to}T23:59:59`)).toISOString() : ""
		} });
		setRows(list);
	}
	(0, import_react.useEffect)(() => {
		if (me?.isAdmin) load().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
	}, [me?.isAdmin]);
	if (!me?.isAdmin) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Admin only."
	}) });
	async function openDetail(kycRef) {
		setBusy(true);
		setPhoto(null);
		setPhotoBusy(false);
		try {
			const row = await fetchKycDetail({ data: { kycRef } });
			setDetail(row);
			setReason(row.rejectReason ?? "");
			if (row.hasPhoto) {
				setPhotoBusy(true);
				try {
					const pic = await fetchKycPhoto({ data: { kycRef } });
					setPhoto(pic);
				} catch (e) {
					toast.error(e instanceof Error ? e.message : "Could not load the document photo");
				}
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not open record");
		} finally {
			setPhotoBusy(false);
			setBusy(false);
		}
	}
	async function decide(approve) {
		if (!detail) return;
		setBusy(true);
		try {
			await reviewKyc({ data: {
				kycRef: detail.kycRef,
				approve,
				reason
			} });
			toast.success(approve ? "Approved" : "Rejected");
			setDetail(null);
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Update failed");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs uppercase tracking-wide text-muted",
				children: "Platform"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-4xl italic",
				children: "KYC review"
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "outline",
				onClick: () => void navigate({ to: "/admin" }),
				children: "Dashboard"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 max-w-2xl text-sm text-muted",
			children: "The list is the public index only: wallet, reference, status. Identity is decrypted when you open a row, and that view is written to the audit log. Do not use real documents in this demo."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "mt-6 p-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 md:grid-cols-4",
				onSubmit: (e) => {
					e.preventDefault();
					load().catch((err) => toast.error(err instanceof Error ? err.message : "Search failed"));
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5 md:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "kyc-q",
							children: "Wallet or reference"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "kyc-q",
							value: q,
							onChange: (e) => setQ(e.target.value),
							placeholder: "0x… or kyc ref"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "kyc-status",
							children: "Status"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							id: "kyc-status",
							className: "h-10 rounded-md border border-border bg-paper px-3 text-sm",
							value: status,
							onChange: (e) => setStatus(e.target.value),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "",
									children: "Any"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "pending",
									children: "Pending"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "approved",
									children: "Approved"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "rejected",
									children: "Rejected"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "expired",
									children: "Expired"
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-end",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: busy,
							children: "Search"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "kyc-from",
							children: "From"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "kyc-from",
							type: "date",
							value: from,
							onChange: (e) => setFrom(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "kyc-to",
							children: "To"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "kyc-to",
							type: "date",
							value: to,
							onChange: (e) => setTo(e.target.value)
						})]
					})
				]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 divide-y divide-border rounded-xl border border-border",
			children: [rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-6 text-sm text-muted",
				children: "No KYC rows."
			}) : null, rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-sm",
					children: shortAddr(row.wallet)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-mono text-xs text-muted",
					children: [
						row.kycRef.slice(0, 12),
						"… · ",
						new Date(row.submittedAt).toLocaleString(),
						row.documentExpiresAt ? ` · exp ${row.documentExpiresAt}` : ""
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: row.status === "approved" ? "sage" : row.status === "rejected" || row.status === "expired" ? "danger" : "mist",
						children: row.status
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						disabled: busy,
						onClick: () => void openDetail(row.kycRef),
						children: "View"
					})]
				})]
			}, row.kycRef))]
		}),
		detail ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl italic",
						children: "Decrypted record"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: detail.status })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 font-mono text-xs text-muted",
					children: [
						detail.wallet,
						" · ref ",
						detail.kycRef
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
					className: "mt-4 grid gap-2 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs text-muted",
							children: "Name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: detail.fullName })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs text-muted",
							children: "Nationality"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: detail.nationality })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs text-muted",
							children: "ID number"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
							className: "font-mono",
							children: detail.idNumber
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs text-muted",
							children: "Document expiry"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
							className: "font-mono",
							children: detail.documentExpiresAt ?? "—"
						})] })
					]
				}),
				photo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					alt: "Submitted document",
					className: "mt-4 max-h-80 rounded-md border border-border bg-paper object-contain",
					src: `data:${photo.contentType};base64,${photo.base64}`
				}) : photoBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-xs text-muted",
					children: "Loading document photo…"
				}) : detail.hasPhoto ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-xs text-danger",
					children: "Document photo could not be loaded."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-xs text-muted",
					children: "No document photo stored for this record."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "reject-reason",
						children: "Reject reason"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "reject-reason",
						value: reason,
						onChange: (e) => setReason(e.target.value)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							disabled: busy,
							onClick: () => void decide(true),
							children: "Approve"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							disabled: busy,
							onClick: () => void decide(false),
							children: "Reject"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => {
								setDetail(null);
								setPhoto(null);
							},
							children: "Close"
						})
					]
				})
			]
		}) : null
	] });
}
//#endregion
export { AdminKyc as component };
