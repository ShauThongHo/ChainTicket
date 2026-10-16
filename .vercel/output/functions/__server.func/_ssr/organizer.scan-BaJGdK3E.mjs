import { o as __toESM } from "../_runtime.mjs";
import { t as friendlyChainError } from "./chain-errors-Ngnean6G.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { T as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { Y as scanCheckIn, a as useSession } from "./router-BzXJkpoJ.mjs";
import { a as useChainRun, i as ChainDialog, n as Button, r as Card, t as AppShell } from "./card-DZLSP1m-.mjs";
import { t as Input } from "./input-DurNKGpM.mjs";
import { t as require_jsQR } from "../_libs/jsqr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/organizer.scan-BaJGdK3E.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_jsQR = /* @__PURE__ */ __toESM(require_jsQR());
function ScanPage() {
	const { me } = useSession();
	const videoRef = (0, import_react.useRef)(null);
	const canvasRef = (0, import_react.useRef)(null);
	const [manual, setManual] = (0, import_react.useState)("");
	const [last, setLast] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const chain = useChainRun();
	const lock = (0, import_react.useRef)(false);
	async function submit(payload) {
		if (lock.current) return;
		lock.current = true;
		setBusy(true);
		try {
			await chain.run({
				title: "Check in ticket",
				labels: [
					"Check ticket",
					"Record entry on-chain",
					"Save check-in"
				],
				task: async (advance) => {
					advance(1);
					const res = await scanCheckIn({ data: { payload } });
					advance(2);
					setLast(`IN · ${res.tokenId} · ${res.eventName}`);
					return `Entry confirmed for ticket ${res.tokenId}.`;
				},
				retry: () => void submit(payload)
			});
		} catch (e) {
			const msg = friendlyChainError(e);
			setLast(`DENY · ${msg}`);
			toast.error(msg);
		} finally {
			setBusy(false);
			setTimeout(() => {
				lock.current = false;
			}, 1200);
		}
	}
	(0, import_react.useEffect)(() => {
		if (!me?.isOrganizer && !me?.isAdmin) return;
		let stream = null;
		let raf = 0;
		let dead = false;
		async function start() {
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: "environment" },
					audio: false
				});
				const video = videoRef.current;
				if (!video) return;
				video.srcObject = stream;
				await video.play();
				const tick = () => {
					if (dead) return;
					const canvas = canvasRef.current;
					if (video && canvas && video.readyState >= 2) {
						canvas.width = video.videoWidth;
						canvas.height = video.videoHeight;
						const ctx = canvas.getContext("2d");
						if (ctx) {
							ctx.drawImage(video, 0, 0);
							const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
							const code = (0, import_jsQR.default)(img.data, img.width, img.height);
							if (code?.data.startsWith("CT1.")) submit(code.data);
						}
					}
					raf = requestAnimationFrame(tick);
				};
				raf = requestAnimationFrame(tick);
			} catch {}
		}
		start();
		return () => {
			dead = true;
			cancelAnimationFrame(raf);
			stream?.getTracks().forEach((t) => t.stop());
		};
	}, [me?.isOrganizer, me?.isAdmin]);
	if (!me?.isOrganizer && !me?.isAdmin) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Gate scanners are limited to approved organizers."
	}) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-4xl italic",
			children: "Gate scanner"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 max-w-xl text-sm text-muted",
			children: "Server auto-signs the Used state. Camera may be blocked in some embeds — paste the QR payload as a fallback."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					ref: videoRef,
					className: "aspect-[3/4] w-full bg-ink object-cover",
					muted: true,
					playsInline: true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
					ref: canvasRef,
					className: "hidden"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-wide text-muted",
						children: "Last result"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 font-mono text-sm",
						children: last ?? "Waiting for a live QR…"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChainDialog, {
						...chain,
						onClose: chain.close
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 grid gap-2",
				onSubmit: (e) => {
					e.preventDefault();
					if (manual.trim()) submit(manual.trim());
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: manual,
					onChange: (e) => setManual(e.target.value),
					placeholder: "CT1.ticket.bucket.hmac"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					disabled: busy,
					children: "Check in"
				})]
			})] })]
		})
	] });
}
//#endregion
export { ScanPage as component };
