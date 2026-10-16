import { o as __toESM } from "../_runtime.mjs";
import { t as friendlyChainError } from "./chain-errors-Ngnean6G.mjs";
import { c as shortAddr, n as cn } from "./utils-CSfacMs6.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { C as useNavigate, T as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { E as fetchMintProgress, a as useSession, et as uploadPoster, l as gatewayUrl, m as createEvent, o as explorerAddress } from "./router-BzXJkpoJ.mjs";
import { a as useChainRun, i as ChainDialog, n as Button, r as Card, t as AppShell } from "./card-DZLSP1m-.mjs";
import { t as Hint } from "./hint-duAhVNAG.mjs";
import { t as Input } from "./input-DurNKGpM.mjs";
import { t as Label } from "./label-DCFjKh4h.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/organizer.mint-BfUy9tw9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Textarea({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		className: cn("flex min-h-24 w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-fg", "placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", className),
		...props
	});
}
function localInput(d) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toBase64(buf) {
	const bytes = new Uint8Array(buf);
	const chunk = 32768;
	let binary = "";
	for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	return btoa(binary);
}
function MintPage() {
	const { me, config } = useSession();
	const navigate = useNavigate();
	const startDefault = (0, import_react.useMemo)(() => localInput(new Date(Date.now() + 54e5)), []);
	const endDefault = (0, import_react.useMemo)(() => localInput(new Date(Date.now() + 216e5)), []);
	const [name, setName] = (0, import_react.useState)("");
	const [venue, setVenue] = (0, import_react.useState)("");
	const [category, setCategory] = (0, import_react.useState)("Concert");
	const [posterUrl, setPosterUrl] = (0, import_react.useState)("");
	const [posterCid, setPosterCid] = (0, import_react.useState)("");
	const [uploading, setUploading] = (0, import_react.useState)(false);
	const [description, setDescription] = (0, import_react.useState)("");
	const [startsAt, setStartsAt] = (0, import_react.useState)(startDefault);
	const [endsAt, setEndsAt] = (0, import_react.useState)(endDefault);
	const [tiers, setTiers] = (0, import_react.useState)([{
		name: "General Admission",
		face: "40.00",
		supply: "12"
	}]);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [mintReceipt, setMintReceipt] = (0, import_react.useState)(null);
	const chain = useChainRun();
	const symbol = config?.nativeSymbol ?? "xDAI";
	async function onPoster(file) {
		setUploading(true);
		try {
			const base64 = toBase64(await file.arrayBuffer());
			const res = await uploadPoster({ data: {
				filename: file.name,
				contentType: file.type || "image/jpeg",
				base64
			} });
			setPosterUrl(res.url);
			setPosterCid(res.cid);
			toast.success("Poster pinned to IPFS");
		} catch (err) {
			toast.error(err instanceof Error ? friendlyChainError(err) : "Upload failed");
		} finally {
			setUploading(false);
		}
	}
	async function submit(e) {
		e.preventDefault();
		setBusy(true);
		const labels = [
			"Pin ticket artwork and details",
			"Create the event vault",
			"Create the ticket marketplace",
			"Link the vault and marketplace",
			"Create the ticket collection",
			"Link the collection",
			...config?.devMode && config.demoBank ? ["Register test coins"] : [],
			...tiers.flatMap((tier) => [`Write ${tier.name || "ticket"} metadata`, `Mint ${tier.name || "ticket"} supply`]),
			"Save event and ticket inventory"
		];
		try {
			await chain.run({
				title: "Creating your event",
				labels,
				doneLabel: "Back to workspace",
				onDone: () => navigate({ to: "/organizer" }),
				task: async (advance) => {
					setMintReceipt(null);
					advance(1);
					const jobId = crypto.randomUUID();
					const creating = createEvent({ data: {
						jobId,
						name,
						venue,
						category,
						posterUrl,
						description,
						startsAt: new Date(startsAt).toISOString(),
						endsAt: new Date(endsAt).toISOString(),
						tiers: tiers.map((t) => ({
							name: t.name,
							faceCents: Math.round(Number(t.face) * 100),
							supply: Number(t.supply)
						}))
					} });
					let createFinished = false;
					let mintResult = null;
					let mintError;
					creating.then((result) => {
						mintResult = result;
						createFinished = true;
					}, (error) => {
						mintError = error;
						createFinished = true;
					});
					while (!createFinished) {
						const progress = await fetchMintProgress({ data: { jobId } });
						advance(Math.min(progress.currentStep, labels.length - 1));
						if (progress.status === "failed") break;
						await new Promise((resolve) => setTimeout(resolve, 700));
					}
					if (mintError) throw mintError;
					const res = mintResult ?? await creating;
					advance(labels.length - 1);
					setMintReceipt({
						collection: res.collection,
						metadata: res.metadata
					});
					return `Your event is ready. Ticket collection ${shortAddr(res.collection)}.`;
				}
			});
		} catch (err) {
			toast.error(friendlyChainError(err));
		} finally {
			setBusy(false);
		}
	}
	if (!me?.isOrganizer) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Approved organizers only."
	}) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-4xl",
			children: "Create an event"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 max-w-xl text-sm text-muted",
			children: "Add the show and the tickets you want to sell."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChainDialog, {
			...chain,
			onClose: chain.close,
			successDetails: mintReceipt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-1 text-xs text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						className: "text-primary underline",
						href: explorerAddress(mintReceipt.collection, config?.explorerUrl ?? ""),
						target: "_blank",
						rel: "noreferrer",
						children: ["Collection ", shortAddr(mintReceipt.collection)]
					}),
					mintReceipt.metadata[0] ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						className: "text-primary underline",
						href: gatewayUrl(mintReceipt.metadata[0].tokenUri),
						target: "_blank",
						rel: "noreferrer",
						children: ["Open ticket details · token #", mintReceipt.metadata[0].tokenId]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Explorer images can take time to appear. Open the details to check the JSON and image." })
				]
			}) : null
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "mt-6 p-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-4",
				onSubmit: (e) => void submit(e),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Show name" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: name,
							onChange: (e) => setName(e.target.value),
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 md:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Venue" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: venue,
								onChange: (e) => setVenue(e.target.value),
								required: true
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Category" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: category,
								onChange: (e) => setCategory(e.target.value)
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, { children: ["Poster ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, { children: "Use a public image link or upload artwork. It will appear on the ticket and event page." })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "file",
								accept: "image/*",
								disabled: uploading,
								onChange: (e) => {
									const file = e.target.files?.[0];
									if (file) onPoster(file);
								}
							}),
							uploading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted",
								children: "Uploading to IPFS…"
							}) : null,
							posterUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "break-all font-mono text-xs text-muted",
								children: [posterCid ? `cid ${posterCid} · ` : "", posterUrl]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted",
								children: config?.pinataReady ? "Choose an image or paste a poster link." : "Paste a poster link, or ask an admin to enable uploads."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: posterUrl,
								onChange: (e) => setPosterUrl(e.target.value),
								placeholder: "https://… (optional if you already uploaded)"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 md:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Starts" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "datetime-local",
								value: startsAt,
								onChange: (e) => setStartsAt(e.target.value)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Ends" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "datetime-local",
								value: endsAt,
								onChange: (e) => setEndsAt(e.target.value)
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Description" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							value: description,
							onChange: (e) => setDescription(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Ticket types" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => setTiers((t) => [...t, {
								name: "New tier",
								face: "80.00",
								supply: "8"
							}]),
							children: "Add tier"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 grid gap-3",
						children: tiers.map((tier, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2 rounded-lg border border-border p-3 md:grid-cols-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: tier.name,
									onChange: (e) => setTiers((rows) => rows.map((r, idx) => idx === i ? {
										...r,
										name: e.target.value
									} : r)),
									placeholder: "Tier name"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: tier.face,
									onChange: (e) => setTiers((rows) => rows.map((r, idx) => idx === i ? {
										...r,
										face: e.target.value
									} : r)),
									placeholder: `Face ${symbol}`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: tier.supply,
										onChange: (e) => setTiers((rows) => rows.map((r, idx) => idx === i ? {
											...r,
											supply: e.target.value
										} : r)),
										placeholder: "Supply"
									}), tiers.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										type: "button",
										variant: "ghost",
										onClick: () => setTiers((rows) => rows.filter((_, idx) => idx !== i)),
										children: "Remove"
									}) : null]
								})
							]
						}, i))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: busy || uploading,
						children: busy ? "Creating event…" : "Create event"
					})
				]
			})
		})
	] });
}
//#endregion
export { MintPage as component };
