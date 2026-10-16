import { o as __toESM } from "../_runtime.mjs";
import { t as friendlyChainError } from "./chain-errors-Ngnean6G.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { a as paySymbol, c as shortAddr, i as formatAmount, n as cn } from "./utils-CSfacMs6.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { C as useNavigate, T as require_jsx_runtime, m as useRouterState, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { f as getAddress } from "../_libs/viem.mjs";
import { a as LoaderCircle, i as Menu, n as Wallet, s as Check, t as X } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as useSession, i as portalFor } from "./router-BzXJkpoJ.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/card-DZLSP1m-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STATUS = {
	pending: "Pending",
	processing: "In progress",
	success: "Done",
	error: "Failed"
};
function TxProgress({ steps, error }) {
	if (!steps.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
		className: "grid gap-3",
		children: steps.map((step, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "grid grid-cols-[1.25rem_1fr_auto] items-start gap-3 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepDot, { state: step.state }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: cn(step.state === "pending" && "text-muted", step.state === "processing" && "text-fg", step.state === "success" && "text-success", step.state === "error" && "text-danger"),
						children: step.label
					}),
					step.hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 font-mono text-xs text-muted",
						children: step.hint
					}) : null,
					step.state === "error" && error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-danger",
						children: error
					}) : null
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("font-mono text-[11px] tracking-wide", step.state === "pending" && "text-muted", step.state === "processing" && "text-fg", step.state === "success" && "text-success", step.state === "error" && "text-danger"),
					children: STATUS[step.state]
				})
			]
		}, `${step.label}-${i}`))
	});
}
function StepDot({ state }) {
	if (state === "processing") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "motion-spin size-4 animate-spin text-primary" });
	if (state === "success") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "grid size-4 place-items-center rounded-full bg-success text-paper",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3" })
	});
	if (state === "error") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-4 rounded-full bg-danger" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-4 rounded-full border border-border bg-mist" });
}
function markSteps(labels, active, error = false) {
	return labels.map((label, i) => {
		if (error && i === active) return {
			label,
			state: "error"
		};
		if (i < active) return {
			label,
			state: "success"
		};
		if (i === active) return {
			label,
			state: "processing"
		};
		return {
			label,
			state: "pending"
		};
	});
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-opacity duration-(--motion-quick,150ms) disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", {
	variants: {
		variant: {
			default: "bg-primary text-primary-fg hover:opacity-90",
			ink: "bg-ink text-paper hover:opacity-90",
			outline: "border border-border bg-bg-elevated text-fg hover:bg-mist",
			ghost: "text-fg hover:bg-mist",
			danger: "bg-danger text-paper hover:opacity-90"
		},
		size: {
			default: "h-11 rounded-md px-4 text-sm",
			sm: "h-9 rounded-sm px-3 text-sm",
			lg: "h-12 rounded-lg px-5 text-base",
			icon: "size-11 rounded-md"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		...props
	});
}
function ModalShell({ title, children, onClose, dismissible = true, isClosing = false }) {
	const [visible, setVisible] = (0, import_react.useState)(false);
	const timer = (0, import_react.useRef)(null);
	const closingRef = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		const frame = requestAnimationFrame(() => setVisible(true));
		return () => {
			cancelAnimationFrame(frame);
			if (timer.current) clearTimeout(timer.current);
		};
	}, []);
	const requestClose = (0, import_react.useCallback)(() => {
		if (!dismissible || !onClose || closingRef.current) return;
		closingRef.current = true;
		setVisible(false);
		timer.current = setTimeout(onClose, 180);
	}, [dismissible, onClose]);
	(0, import_react.useEffect)(() => {
		if (!dismissible || !onClose) return;
		function onKey(e) {
			if (e.key === "Escape") requestClose();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		dismissible,
		onClose,
		requestClose
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `chain-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] ${visible && !isClosing ? "is-visible" : ""}`,
		role: "presentation",
		onMouseDown: () => {
			requestClose();
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "modal-title",
			className: `chain-modal-panel w-full max-w-md border border-border bg-bg-elevated p-5 text-fg shadow-2xl shadow-ink/20 sm:p-6 ${visible && !isClosing ? "is-visible" : ""}`,
			onMouseDown: (e) => e.stopPropagation(),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				id: "modal-title",
				className: "font-display text-2xl",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4",
				children
			})]
		})
	});
}
function ChainDialog({ open, title, steps, error, summary, doneLabel = "Close", onDone, finish, onClose, onRetry, successDetails }) {
	const [closing, setClosing] = (0, import_react.useState)(false);
	if (!open) return null;
	const closeWithFade = () => {
		setClosing(true);
		setTimeout(onClose, 190);
	};
	const busy = steps.some((s) => s.state === "processing");
	const finished = Boolean(summary) && !error && !busy;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ModalShell, {
		title,
		onClose: closeWithFade,
		dismissible: !busy,
		isClosing: closing,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TxProgress, {
				steps,
				error
			}),
			finished && summary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm",
				children: summary
			}) : null,
			finished ? successDetails : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex flex-wrap gap-2",
				children: [
					finished ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => {
							setClosing(true);
							setTimeout(() => {
								onClose();
								(onDone ?? finish)?.();
							}, 190);
						},
						children: doneLabel
					}) : null,
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [onRetry ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: onRetry,
						disabled: busy,
						children: "Try again"
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						onClick: closeWithFade,
						children: "Close"
					})] }) : null,
					!finished && !error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						disabled: busy,
						onClick: closeWithFade,
						children: busy ? "Please wait" : "Close"
					}) : null
				]
			})
		]
	});
}
function LoadingVeil({ text }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModalShell, {
		title: "Loading your account",
		dismissible: false,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3 text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "motion-spin size-4 animate-spin text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: text })]
		})
	});
}
function useChainRun() {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [title, setTitle] = (0, import_react.useState)("");
	const [steps, setSteps] = (0, import_react.useState)([]);
	const [error, setError] = (0, import_react.useState)(null);
	const [summary, setSummary] = (0, import_react.useState)(null);
	const [doneLabel, setDoneLabel] = (0, import_react.useState)("Close");
	const [canRetry, setCanRetry] = (0, import_react.useState)(false);
	const doneRef = (0, import_react.useRef)(null);
	const retryRef = (0, import_react.useRef)(null);
	const stepRef = (0, import_react.useRef)(0);
	const close = (0, import_react.useCallback)(() => {
		setOpen(false);
		setSteps([]);
		setError(null);
		setSummary(null);
	}, []);
	return {
		open,
		title,
		steps,
		error,
		summary,
		doneLabel,
		canRetry,
		run: (0, import_react.useCallback)(async (opts) => {
			doneRef.current = opts.onDone ?? null;
			retryRef.current = opts.retry ?? null;
			stepRef.current = 0;
			setTitle(opts.title);
			setDoneLabel(opts.doneLabel ?? "Close");
			setCanRetry(Boolean(opts.retry));
			setError(null);
			setSummary(null);
			setSteps(markSteps(opts.labels, 0));
			setOpen(true);
			const advance = (index) => {
				stepRef.current = index;
				setSteps(markSteps(opts.labels, index));
			};
			try {
				const text = await opts.task(advance);
				setSteps(markSteps(opts.labels, opts.labels.length));
				setSummary(text);
				setError(null);
			} catch (e) {
				setSteps(markSteps(opts.labels, stepRef.current, true));
				setError(friendlyChainError(e));
				setSummary(null);
				opts.onError?.(e);
			}
		}, []),
		close,
		finish: (0, import_react.useCallback)(() => {
			const fn = doneRef.current;
			close();
			fn?.();
		}, [close]),
		retry: (0, import_react.useCallback)(() => {
			retryRef.current?.();
		}, [])
	};
}
function Brand() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/marketplace",
		className: "flex items-center gap-2 text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "stub-mark",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-xl",
			children: "ChainTicket"
		})]
	});
}
function AppShell({ children }) {
	const { me, config, disconnect, wallets, connectProvider, connectPreview, gate, requestConnect, cancelConnect, markAccountLoad } = useSession();
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [open, setOpen] = (0, import_react.useState)(false);
	const lastIdentity = (0, import_react.useRef)(null);
	const symbol = paySymbol(config);
	const veiled = gate !== "off";
	(0, import_react.useEffect)(() => {
		const identity = me ? `${me.address.toLowerCase()}:${me.role}` : null;
		const previous = lastIdentity.current;
		lastIdentity.current = identity;
		if (previous && identity && previous !== identity) navigate({ to: portalFor(me) });
		else if (previous && !identity && (pathname.startsWith("/admin") || pathname.startsWith("/organizer"))) navigate({ to: "/marketplace" });
	}, [
		me,
		navigate,
		pathname
	]);
	async function signOut() {
		disconnect();
		setOpen(false);
		await navigate({ to: "/marketplace" });
	}
	async function connect(fn) {
		markAccountLoad();
		try {
			const user = await fn();
			if (!user) {
				requestConnect();
				return;
			}
			const dest = portalFor(user);
			if (dest !== "/marketplace") await navigate({ to: dest });
			cancelConnect();
		} catch (e) {
			requestConnect();
			toast.error(e instanceof Error ? e.message : "Could not connect");
		}
	}
	const links = me?.role === "admin" ? [
		{
			to: "/admin",
			label: "Desk"
		},
		{
			to: "/admin/kyc",
			label: "KYC"
		},
		{
			to: "/admin/organizers",
			label: "Organizers"
		},
		{
			to: "/admin/config",
			label: "Setup"
		}
	] : me?.role === "organizer" ? [
		{
			to: "/organizer",
			label: "Shows"
		},
		{
			to: "/organizer/scan",
			label: "Gate"
		},
		{
			to: "/organizer/mint",
			label: "New show"
		}
	] : [{
		to: "/marketplace",
		label: "Shows"
	}, {
		to: "/my-tickets",
		label: "My tickets"
	}];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: veiled ? "pointer-events-none brightness-75 blur-[2px] transition-[filter] duration-200" : "transition-[filter] duration-200",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-30 border-b border-border bg-bg-elevated",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brand, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
								className: "hidden items-center gap-1 md:flex",
								children: links.map((l) => {
									const active = l.to === "/admin" || l.to === "/organizer" ? pathname === l.to : pathname === l.to || pathname.startsWith(`${l.to}/`);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: l.to,
										className: `border-b-2 px-3 py-2 text-sm ${active ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg"}`,
										children: l.label
									}, l.to);
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [me ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "hidden items-center gap-2 px-2 py-2 font-mono text-xs md:flex",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, { className: "size-3.5" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: shortAddr(getAddress(me.address)) }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted",
											children: me.role
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "text-muted hover:text-fg",
											onClick: () => void signOut(),
											children: "Sign out"
										})
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									onClick: requestConnect,
									children: "Connect wallet"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									size: "icon",
									className: "md:hidden",
									onClick: () => setOpen((v) => !v),
									children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
								})]
							})
						]
					}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "border-t border-border px-4 py-3 md:hidden",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1",
							children: [links.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: l.to,
								onClick: () => setOpen(false),
								className: "px-3 py-3 text-sm",
								children: l.label
							}, l.to)), me ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "px-3 py-2 font-mono text-xs text-muted",
								children: [
									shortAddr(me.address),
									" · ",
									formatAmount(me.spendableCents, symbol)
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								className: "mt-2",
								onClick: () => {
									setOpen(false);
									requestConnect();
								},
								children: "Connect wallet"
							})]
						})
					}) : null]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "mx-auto w-full max-w-6xl px-4 py-8",
					children
				})]
			}),
			gate === "pick" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ModalShell, {
				title: "Choose a wallet",
				onClose: cancelConnect,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Pick one to sign in. You can browse shows without it."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid gap-2",
					children: [wallets.length ? wallets.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "outline",
						className: "w-full justify-start",
						onClick: () => void connect(() => connectProvider(w.provider)),
						children: [w.icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: w.icon,
							alt: "",
							className: "size-5"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, { className: "size-4" }), w.name]
					}, w.uuid)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "No browser wallet found. Use a preview wallet instead."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => void connect(() => connectPreview()),
						children: "Preview wallet"
					})]
				})]
			}) : null,
			gate === "load" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingVeil, { text: "Loading your account…" }) : null
		]
	});
}
function Card({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("border border-border bg-bg-elevated", className),
		...props
	});
}
//#endregion
export { useChainRun as a, ChainDialog as i, Button as n, Card as r, AppShell as t };
