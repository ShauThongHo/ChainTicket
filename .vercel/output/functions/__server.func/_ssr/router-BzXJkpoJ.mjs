import { o as __toESM } from "../_runtime.mjs";
import { t as friendlyChainError } from "./chain-errors-Ngnean6G.mjs";
import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { T as require_jsx_runtime, _ as Outlet, b as createRootRoute, f as Scripts, g as createRouter, p as HeadContent, v as lazyRouteComponent, w as useRouter, y as createFileRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as getServerFnById, n as createServerFn, r as TSS_SERVER_FUNCTION, t as createMiddleware } from "./ssr.mjs";
import { a as literal, c as string, i as boolean, l as union, n as _enum, o as number, r as array, s as object, t as number$1 } from "../_libs/zod.mjs";
import { a as createWalletClient, c as defineChain, i as custom, n as generatePrivateKey, o as createPublicClient, r as http, t as privateKeyToAccount } from "../_libs/viem.mjs";
import { r as TriangleAlert } from "../_libs/lucide-react.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-BzXJkpoJ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var walletMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
	let walletToken;
	if (typeof window !== "undefined") walletToken = localStorage.getItem("ct_session") ?? void 0;
	return next({ sendContext: { walletToken } });
}).server(async ({ next, context }) => {
	const { parseSessionToken } = await import("./session.server-U8N3VQgv.mjs").then((n) => n.i).then((n) => n.i);
	return next({ context: { wallet: parseSessionToken(context.walletToken) } });
});
var getNonce = createServerFn({ method: "POST" }).handler(createSsrRpc("0aa128f44e37ba7661feddd968e7084bd024fbe4067317d40acb9f80c63120bb"));
var verifyWallet = createServerFn({ method: "POST" }).validator(object({
	address: string(),
	signature: string(),
	nonce: string()
})).handler(createSsrRpc("0454c4bd8d650f0d68e87a97728d958ae3ad6646a5462060fdbb8a191aa19df5"));
var fetchMe = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(createSsrRpc("c14007cac95ee9de5072cd82a3a383b762adb9ecd2dbc8a2c5885fe10cf50e88"));
var fetchSpendable = createServerFn({ method: "GET" }).middleware([walletMiddleware]).validator(object({ fresh: boolean().optional() })).handler(createSsrRpc("ae9635df2c25aac87ee58fb3bd4dda80c1fa7a935f68b062bf61231559d5e0f7"));
var fetchEvents = createServerFn({ method: "GET" }).middleware([walletMiddleware]).validator(object({ q: string().optional() })).handler(createSsrRpc("6a9fbd3c326c5fe198ece527d7ab93f544651d70c4e0ccd1cfd47f0611178bfd"));
var fetchEvent = createServerFn({ method: "GET" }).validator(object({ id: number$1() })).handler(createSsrRpc("ef0728cd73d3c53169b54866f4be32051f7c09513443188c560f61651ff1a32f"));
var saveKyc = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	fullName: string().trim().min(2).max(120),
	idNumber: string().trim().min(4).max(64),
	nationality: string().trim().min(2).max(80),
	documentExpiresAt: string().regex(/^\d{4}-\d{2}-\d{2}$/),
	photoBase64: string().min(32).max(8e6),
	contentType: _enum(["image/jpeg", "image/png"])
})).handler(createSsrRpc("1114592a1f58614a898e9421618f4ad7e882cd6980cd50a0ad6460f8666221f7"));
var buyNow = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	tierId: number$1(),
	txHash: string(),
	chainId: number$1()
})).handler(createSsrRpc("e001ed70e32594e0b931d124f8e61b0350bb91ac053ee3ec7d3937b7d02b1e9b"));
var quoteBuy = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ tierId: number$1() })).handler(createSsrRpc("cddafa20bdfb9c1c360a55b163dd918c77f96896c7e3dcd242a81d921539f2fe"));
var sellTicket = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	ticketId: number$1(),
	priceCents: number$1(),
	txHash: string()
})).handler(createSsrRpc("d5c4cfe7ffdc490aa4147ea01135eddb6ff975bed008cf516dc1129527400499"));
var quoteList = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	ticketId: number$1(),
	priceCents: number$1()
})).handler(createSsrRpc("027910004badc6ba55af40f4657e0796a7333ffe459790813b7ecc6117012d9b"));
var cancelListing = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	ticketId: number$1(),
	txHash: string()
})).handler(createSsrRpc("ceb756da76e02c4bf8acadc21f3809c9da3e3923fdc84d487345bd94cb10363a"));
var fetchMyTickets = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(createSsrRpc("e6ecb2638e217a6b264b7c52aa022a698ac7faa0d5b09c68308fb515a75e8546"));
var fetchQr = createServerFn({ method: "GET" }).middleware([walletMiddleware]).validator(object({ ticketId: number$1() })).handler(createSsrRpc("4d4fd0799331109c8c7b0b97ad6f5d242a188c73564731233a9d60f26fa08e3a"));
var scanCheckIn = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ payload: string() })).handler(createSsrRpc("eb9070306b2d0648450a5ef177f5f0d8c91a95fb4cbc874126c46abfa4f8194b"));
var createEvent = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	name: string(),
	description: string(),
	venue: string(),
	category: string(),
	posterUrl: string(),
	startsAt: string(),
	endsAt: string(),
	jobId: string().min(1).max(80),
	tiers: array(object({
		name: string(),
		faceCents: number$1(),
		supply: number$1()
	}))
})).handler(createSsrRpc("30b7faef73d7dee894fca6220158f37081a146ecd7c90e0cc988aa4fce56ac9c"));
var fetchMintProgress = createServerFn({ method: "GET" }).middleware([walletMiddleware]).validator(object({ jobId: string().min(1).max(80) })).handler(createSsrRpc("f9f309785a57687fd5c06b3638d5c20a226d00937904b43d33ff9242b9aab4cd"));
var fetchOrganizer = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(createSsrRpc("26bcfc58e8d1a182b5bc747c037f6fc752f1977285bfd5d5a7f8f92b598cfb87"));
var fetchOrganizerEventLedger = createServerFn({ method: "GET" }).middleware([walletMiddleware]).validator(object({ eventId: number$1() })).handler(createSsrRpc("2b62d9b9a565cbaf4490e709f10c5caadb27512b083c3d9f68d8e21cf6dc1bdf"));
var refundEvent = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ eventId: number$1() })).handler(createSsrRpc("0ad9622f9b5abe78e9b9c691246bdd9294abb9fa210c973191ac242ba5229f86"));
var withdrawEvent = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ eventId: number$1() })).handler(createSsrRpc("82f57b86f291e471c7e9f227a06cade6461e9d95f96c7edba6371d7a10d8f7de"));
createServerFn({ method: "GET" }).handler(createSsrRpc("821f0461e569c0802835426279bc1b04d052e4640ba165bbf6fff65ee7abf890"));
var saveRoyalty = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ bps: number$1() })).handler(createSsrRpc("b5dc51908e0d9f2e7265a709d9e22b1236b625943c59df92118a9e3c77df5ee3"));
var saveOrganizer = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	wallet: string(),
	name: string()
})).handler(createSsrRpc("b000eb76f71546044b842cdecb14cb71c5103298f56b135a48feda181fdcce84"));
var patchOrganizer = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	wallet: string(),
	status: _enum([
		"approved",
		"revoked",
		"pending"
	])
})).handler(createSsrRpc("3424ede6dcab9b184d400fc8599ab42ae0ed8a960df8fbb551f66fdb49cd1463"));
var fetchOrganizers = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(createSsrRpc("e7386c5d391fc8e545bd27d988c82bf5ca6a0abfe5c90d670e96b44022b438a1"));
var fetchInfra = createServerFn({ method: "POST" }).middleware([walletMiddleware]).handler(createSsrRpc("3be1b4b84fb73ef0e0b1b59caa4ef0e8666dc889f24bacf453c4a65a8e605281"));
var saveInfra = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	databaseUrl: string().optional(),
	rpcUrl: string().optional(),
	chainId: number$1().optional(),
	explorerUrl: string().optional(),
	operatorPk: string().optional(),
	pinataJwt: string().optional(),
	clearOperatorPk: boolean().optional(),
	clearDatabaseUrl: boolean().optional(),
	clearPinata: boolean().optional(),
	devMode: boolean().optional(),
	databaseUrlKyc: string().optional(),
	clearDatabaseUrlKyc: boolean().optional(),
	kycAutoApprove: boolean().optional()
})).handler(createSsrRpc("3721a49e1b31090084c00d98c0bf2b1dc6967a0c847394eb3a4a9ea7a1a4f438"));
var testDatabase = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ url: string() })).handler(createSsrRpc("ed27693d6a4e76070f4796e867f31b6966dfef37786e50e9701e1c4c6840ed5b"));
var testChain = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	rpcUrl: string().optional(),
	chainId: number$1().optional()
})).handler(createSsrRpc("aa9c8e8c0da272bde3d0f5e13f316228d2487a522580172e978cc5ac7c8464c8"));
var makeOperatorKey = createServerFn({ method: "POST" }).middleware([walletMiddleware]).handler(createSsrRpc("f2810f75e2a93ab310597d182bf06863c98e3954bc064c9dc3527cd12b302a1b"));
var fetchKycQueue = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	q: string().optional(),
	status: string().optional(),
	from: string().optional(),
	to: string().optional()
})).handler(createSsrRpc("b80d6f4501578c1d2bd8eb1355323bf42bf8774c3235e3dda74b927142d6c8af"));
var fetchKycDetail = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ kycRef: string() })).handler(createSsrRpc("f614ff6566254bae7ce4d8c1b1555553c4b2ffac78d50235dd66e1a9e497268e"));
var fetchKycPhoto = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ kycRef: string().min(8).max(80) })).handler(createSsrRpc("c6d25f642de7ed9047ee8b3e3c8f66d46231e116b1a9097e214c67e05ad6039a"));
var reviewKyc = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	kycRef: string(),
	approve: boolean(),
	reason: string().optional()
})).handler(createSsrRpc("f4221b67b704c195cb8cb660785d2e630e368e3a92b91d0094d84a86328d1421"));
var fetchPublicConfig = createServerFn({ method: "GET" }).handler(createSsrRpc("e51382297ea4bb30897d2ce5bd9aaccb850580b54a0589b50093ae72f2f90bea"));
var setDevMode = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ on: boolean() })).handler(createSsrRpc("4ba192dac753e6d8521b6e0e1dcfb0a370e887d0499fd141700faa6f4adda6d1"));
createServerFn({ method: "POST" }).middleware([walletMiddleware]).handler(createSsrRpc("ba12b8b27799fff6cecd823ccc6decd61b8993d8276b2b1d660792790890e506"));
var prepareBuyer = createServerFn({ method: "POST" }).middleware([walletMiddleware]).handler(createSsrRpc("3984c3dba78308e8b548e094a9466e3d97566dfe2073c83c8c5404b3d407b163"));
var freezeShow = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	eventId: number$1(),
	on: boolean()
})).handler(createSsrRpc("cdbdfcac609ca3aa42682cee74bc944cbd60b0c15324e45903295af4b5cff690"));
var fetchWithdrawals = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(createSsrRpc("a04bdde8e1d824e973df250515dfb2928858062f7c10ce6d43f362f9287b9d98"));
var decidePayout = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	requestId: number$1(),
	approve: boolean()
})).handler(createSsrRpc("a8f590d1b16b85804aab1c60a197b0bf40466e778d7e2280f1142e735f95bedc"));
var confirmVote = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	ticketId: number$1(),
	txHash: string()
})).handler(createSsrRpc("0ea67d5dab8ed63f7786c64924a12540c416aa85014933ea67daa1e025522297"));
var escalatePayout = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	eventId: number$1(),
	materialsUri: string()
})).handler(createSsrRpc("bb09c3f548cf039f7a17f4ddef4f8f19545138410df019add6c191360e5287bb"));
var executePayout = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ eventId: number$1() })).handler(createSsrRpc("e4f253f27c762325922cffa5430f5a927e7388d9d0223ad3b2d5ed9c8e858640"));
var fetchSignerOps = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(createSsrRpc("ae8de9662a19ef1de0cf149b929dd83703bab73f025decfbdad38a2efaf7ee92"));
var fetchPendingIndex = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(createSsrRpc("9db42d2ac9c8ae7f4714c22097af9373837e9c3398411bb64c481051d5bcb18d"));
var retryPendingIndex = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ id: number$1() })).handler(createSsrRpc("2429e35b6afadd29ff2adff242b3d43768eba95e62768d18c6ce2b047815e9d6"));
var dismissPendingIndex = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({ id: number$1() })).handler(createSsrRpc("ae1432ef5e1cbcda0561c9894c640f2d0bc8b26b50f0033cb08fac78a056a045"));
var uploadPoster = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	filename: string(),
	contentType: string(),
	base64: string()
})).handler(createSsrRpc("9ee29411a041c34a69aa31c202544a54aed5f307c98b9ec826ab8673e68b5105"));
var fetchAdminEvents = createServerFn({ method: "GET" }).middleware([walletMiddleware]).handler(createSsrRpc("bee80f40c43ca5c64f3dee8c298d4450e0d6732f0c8e7a0d20f6539077aee707"));
var savePlatform = createServerFn({ method: "POST" }).middleware([walletMiddleware]).validator(object({
	adminWallet: string().optional(),
	chainName: string().optional(),
	nativeSymbol: string().optional(),
	rpcUrl: string().optional(),
	chainId: number$1().optional(),
	explorerUrl: string().optional()
})).handler(createSsrRpc("bda5b7ab3106117df7e5a392bd9352d508f66509749ffdc30798fff94340d329"));
var claimPlatformAdmin = createServerFn({ method: "POST" }).middleware([walletMiddleware]).handler(createSsrRpc("3751fb2f2d8716b10ffc0bf1be35a824684cab6b40914334aeacae165646bede"));
function explorerTx(hash, explorer) {
	return `${explorer.replace(/\/$/, "")}/tx/${hash}`;
}
function explorerAddress(addr, explorer) {
	return `${explorer.replace(/\/$/, "")}/address/${addr}`;
}
function explorerToken(collection, tokenId, explorer) {
	return `${explorer.replace(/\/$/, "")}/token/${collection}/instance/${tokenId}`;
}
function toChainHex(id) {
	return `0x${id.toString(16)}`;
}
function gatewayUrl(uri) {
	if (!uri) return "";
	if (uri.startsWith("ipfs://")) return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`;
	return uri;
}
var PREVIEW_KEY = "ct_preview_pk";
var SESSION_KEY = "ct_session";
var MODE_KEY = "ct_wallet_mode";
var injectedProvider = null;
function rememberInjected(provider) {
	injectedProvider = provider;
}
function discoverWallets() {
	if (typeof window === "undefined") return [];
	const found = /* @__PURE__ */ new Map();
	const onAnnounce = (event) => {
		const detail = event.detail;
		if (!detail?.provider) return;
		found.set(detail.info.uuid, {
			uuid: detail.info.uuid,
			name: detail.info.name,
			icon: detail.info.icon,
			provider: detail.provider
		});
	};
	window.addEventListener("eip6963:announceProvider", onAnnounce);
	window.dispatchEvent(new Event("eip6963:requestProvider"));
	window.removeEventListener("eip6963:announceProvider", onAnnounce);
	if (found.size === 0) {
		const eth = window.ethereum;
		if (eth) found.set("injected", {
			uuid: "injected",
			name: "Browser wallet",
			provider: eth
		});
	}
	return [...found.values()];
}
function currentProvider() {
	if (injectedProvider) return injectedProvider;
	if (typeof window !== "undefined" && localStorage.getItem(MODE_KEY) === "injected") return discoverWallets()[0]?.provider ?? null;
	return null;
}
function chainOf(net) {
	return defineChain({
		id: net.chainId,
		name: net.chainName || "Ticket network",
		nativeCurrency: {
			name: net.nativeSymbol,
			symbol: net.nativeSymbol,
			decimals: 18
		},
		rpcUrls: { default: { http: [net.rpcUrl] } },
		blockExplorers: { default: {
			name: "Explorer",
			url: net.explorerUrl
		} }
	});
}
async function switchNetwork(provider, net) {
	const chainId = toChainHex(net.chainId);
	try {
		await provider.request({
			method: "wallet_switchEthereumChain",
			params: [{ chainId }]
		});
	} catch (err) {
		if (err.code === 4902) {
			await provider.request({
				method: "wallet_addEthereumChain",
				params: [{
					chainId,
					chainName: net.chainName,
					nativeCurrency: {
						name: net.nativeSymbol,
						symbol: net.nativeSymbol,
						decimals: 18
					},
					rpcUrls: [net.rpcUrl],
					blockExplorerUrls: [net.explorerUrl]
				}]
			});
			return;
		}
		throw err;
	}
}
async function connectInjected(provider, net) {
	rememberInjected(provider);
	await switchNetwork(provider, net).catch(() => void 0);
	const client = createWalletClient({ transport: custom(provider) });
	const address = (await client.requestAddresses())[0];
	if (!address) throw new Error("No account returned.");
	return {
		client,
		address,
		chainId: net.chainId
	};
}
function getPreviewAccount() {
	rememberInjected(null);
	let pk = localStorage.getItem(PREVIEW_KEY);
	if (!pk) {
		pk = generatePrivateKey();
		localStorage.setItem(PREVIEW_KEY, pk);
	}
	return privateKeyToAccount(pk);
}
async function sendUserCall(net, call, hooks) {
	try {
		const chain = chainOf(net);
		const publicClient = createPublicClient({
			chain,
			transport: http(net.rpcUrl, { timeout: 4e4 })
		});
		const provider = currentProvider();
		const mode = typeof window !== "undefined" ? localStorage.getItem(MODE_KEY) : null;
		let hash;
		if (mode === "injected" && provider) {
			const wallet = createWalletClient({
				chain,
				transport: custom(provider)
			});
			const [account] = await wallet.getAddresses();
			if (!account) throw new Error("Connect a wallet first.");
			hash = await wallet.writeContract({
				address: call.to,
				abi: call.abi,
				functionName: call.functionName,
				args: call.args,
				value: call.value,
				account,
				chain
			});
		} else {
			const pk = typeof window !== "undefined" ? localStorage.getItem(PREVIEW_KEY) : null;
			if (!pk) throw new Error("Connect a wallet first.");
			const account = privateKeyToAccount(pk);
			hash = await createWalletClient({
				account,
				chain,
				transport: http(net.rpcUrl, { timeout: 4e4 })
			}).writeContract({
				address: call.to,
				abi: call.abi,
				functionName: call.functionName,
				args: call.args,
				value: call.value,
				account,
				chain
			});
		}
		hooks?.onSubmitted?.(hash);
		if ((await publicClient.waitForTransactionReceipt({
			hash,
			timeout: 18e4,
			confirmations: 1
		})).status !== "success") throw new Error("Sold out or this listing is no longer active. Refresh and try again.");
		return hash;
	} catch (err) {
		throw new Error(friendlyChainError(err));
	}
}
function saveSession(token, mode = "preview") {
	localStorage.setItem(SESSION_KEY, token);
	localStorage.setItem(MODE_KEY, mode);
}
function clearSession() {
	localStorage.removeItem(SESSION_KEY);
	localStorage.removeItem(MODE_KEY);
	injectedProvider = null;
}
function readSession() {
	return localStorage.getItem(SESSION_KEY);
}
function restoreWallet() {
	if (typeof window === "undefined") return;
	if (localStorage.getItem(MODE_KEY) === "preview" && localStorage.getItem(PREVIEW_KEY)) getPreviewAccount();
}
var Ctx = (0, import_react.createContext)(null);
function portalFor(user) {
	if (user.role === "admin") return "/admin";
	if (user.role === "organizer") return "/organizer";
	return "/marketplace";
}
function SessionProvider({ children }) {
	const [me, setMe] = (0, import_react.useState)(null);
	const [config, setConfig] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [wallets, setWallets] = (0, import_react.useState)([]);
	const [gate, setGate] = (0, import_react.useState)("off");
	const activeProvider = (0, import_react.useRef)(null);
	const [providerVersion, setProviderVersion] = (0, import_react.useState)(0);
	const refresh = (0, import_react.useCallback)(async () => {
		if (!readSession()) {
			setMe(null);
			setLoading(false);
			return null;
		}
		try {
			const data = await fetchMe();
			setMe(data);
			return data;
		} catch {
			clearSession();
			setMe(null);
			return null;
		} finally {
			setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		setWallets(discoverWallets());
		restoreWallet();
		fetchPublicConfig().then(setConfig).catch(() => void 0);
		refresh();
	}, [refresh]);
	const refreshBalance = (0, import_react.useCallback)(async (fresh = false) => {
		if (!readSession()) return;
		try {
			const bal = await fetchSpendable({ data: { fresh } });
			setMe((cur) => cur ? {
				...cur,
				spendableCents: bal.cents
			} : cur);
		} catch {}
	}, []);
	(0, import_react.useEffect)(() => {
		if (!me?.address) return;
		refreshBalance(false);
	}, [me?.address, refreshBalance]);
	const loginWithSigner = (0, import_react.useCallback)(async (address, sign, mode) => {
		const { nonce, message } = await getNonce();
		const { token } = await verifyWallet({ data: {
			address,
			signature: await sign(message),
			nonce
		} });
		saveSession(token, mode);
		return refresh();
	}, [refresh]);
	const connectProvider = (0, import_react.useCallback)(async (provider) => {
		activeProvider.current = provider;
		setProviderVersion((version) => version + 1);
		const net = config ?? await fetchPublicConfig();
		setConfig(net);
		const { client, address } = await connectInjected(provider, net);
		return await loginWithSigner(address, (message) => client.signMessage({
			account: address,
			message
		}), "injected");
	}, [config, loginWithSigner]);
	const connectPreview = (0, import_react.useCallback)(async () => {
		activeProvider.current = null;
		const account = getPreviewAccount();
		return await loginWithSigner(account.address, (message) => account.signMessage({ message }), "preview");
	}, [loginWithSigner]);
	(0, import_react.useEffect)(() => {
		const provider = activeProvider.current;
		if (!provider?.on) return;
		const onAccountsChanged = (accounts) => {
			if (typeof (Array.isArray(accounts) ? accounts[0] : null) !== "string") {
				clearSession();
				setMe(null);
				setGate("off");
				return;
			}
			setGate("load");
			connectProvider(provider).then((user) => {
				setGate(user ? "off" : "pick");
			}).catch(() => {
				clearSession();
				setMe(null);
				setGate("pick");
			});
		};
		provider.on("accountsChanged", onAccountsChanged);
		return () => provider.removeListener?.("accountsChanged", onAccountsChanged);
	}, [connectProvider, providerVersion]);
	const disconnect = (0, import_react.useCallback)(() => {
		clearSession();
		activeProvider.current = null;
		setMe(null);
	}, []);
	const sendUserCall$1 = (0, import_react.useCallback)(async (call, hooks) => {
		const net = config ?? await fetchPublicConfig();
		if (!config) setConfig(net);
		return sendUserCall(net, call, hooks);
	}, [config]);
	const requestConnect = (0, import_react.useCallback)(() => {
		setWallets(discoverWallets());
		setGate("pick");
	}, []);
	const cancelConnect = (0, import_react.useCallback)(() => setGate("off"), []);
	const markAccountLoad = (0, import_react.useCallback)(() => setGate("load"), []);
	const value = (0, import_react.useMemo)(() => ({
		me,
		config,
		loading,
		wallets,
		refresh,
		refreshBalance,
		connectProvider,
		connectPreview,
		disconnect,
		sendUserCall: sendUserCall$1,
		portalFor,
		gate,
		requestConnect,
		cancelConnect,
		markAccountLoad
	}), [
		me,
		config,
		loading,
		wallets,
		refresh,
		refreshBalance,
		connectProvider,
		connectPreview,
		disconnect,
		sendUserCall$1,
		gate,
		requestConnect,
		cancelConnect,
		markAccountLoad
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ctx.Provider, {
		value,
		children
	});
}
function useSession() {
	const ctx = (0, import_react.useContext)(Ctx);
	if (!ctx) throw new Error("useSession");
	return ctx;
}
var styles_default = "/assets/styles-BVeEpDPP.css";
var APP_NAME = "ChainTicket";
var Route$12 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Fair event tickets as vaulted NFTs — capped resale, dynamic QR gate."
			},
			{
				name: "theme-color",
				content: "#1c4f9c"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SessionProvider, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
				position: "top-center",
				richColors: true
			})] }) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var $$splitComponentImporter$11 = () => import("./routes-VKI9Q1Uc.mjs");
var Route$11 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
var $$splitComponentImporter$10 = () => import("./admin-DHPNs5N5.mjs");
var Route$10 = createFileRoute("/admin")({ component: lazyRouteComponent($$splitComponentImporter$10, "component") });
var $$splitComponentImporter$9 = () => import("./kyc-D1vrA6il.mjs");
var searchSchema = object({ next: string().optional() });
var Route$9 = createFileRoute("/kyc")({
	validateSearch: (s) => searchSchema.parse(s),
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("./marketplace-D_wwO9WV.mjs");
var Route$8 = createFileRoute("/marketplace")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./my-tickets-Bd3AG1eq.mjs");
var Route$7 = createFileRoute("/my-tickets")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./organizer-Barjzenx.mjs");
var Route$6 = createFileRoute("/organizer")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./admin.config-BkhD1SWv.mjs");
var Route$5 = createFileRoute("/admin/config")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./admin.kyc-Cgk702bk.mjs");
var Route$4 = createFileRoute("/admin/kyc")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./admin.organizers-nDgeH-iD.mjs");
var Route$3 = createFileRoute("/admin/organizers")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./events._eventId-Bkhu2smv.mjs");
var Route$2 = createFileRoute("/events/$eventId")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./organizer.mint-BfUy9tw9.mjs");
var Route$1 = createFileRoute("/organizer/mint")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./organizer.scan-BaJGdK3E.mjs");
var Route = createFileRoute("/organizer/scan")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var IndexRoute = Route$11.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$12
});
var AdminRoute = Route$10.update({
	id: "/admin",
	path: "/admin",
	getParentRoute: () => Route$12
});
var KycRoute = Route$9.update({
	id: "/kyc",
	path: "/kyc",
	getParentRoute: () => Route$12
});
var MarketplaceRoute = Route$8.update({
	id: "/marketplace",
	path: "/marketplace",
	getParentRoute: () => Route$12
});
var MyTicketsRoute = Route$7.update({
	id: "/my-tickets",
	path: "/my-tickets",
	getParentRoute: () => Route$12
});
var OrganizerRoute = Route$6.update({
	id: "/organizer",
	path: "/organizer",
	getParentRoute: () => Route$12
});
var AdminConfigRoute = Route$5.update({
	id: "/config",
	path: "/config",
	getParentRoute: () => AdminRoute
});
var AdminKycRoute = Route$4.update({
	id: "/kyc",
	path: "/kyc",
	getParentRoute: () => AdminRoute
});
var AdminOrganizersRoute = Route$3.update({
	id: "/organizers",
	path: "/organizers",
	getParentRoute: () => AdminRoute
});
var EventsEventIdRoute = Route$2.update({
	id: "/events/$eventId",
	path: "/events/$eventId",
	getParentRoute: () => Route$12
});
var OrganizerMintRoute = Route$1.update({
	id: "/mint",
	path: "/mint",
	getParentRoute: () => OrganizerRoute
});
var OrganizerScanRoute = Route.update({
	id: "/scan",
	path: "/scan",
	getParentRoute: () => OrganizerRoute
});
var AdminRouteChildren = {
	AdminConfigRoute,
	AdminKycRoute,
	AdminOrganizersRoute
};
var AdminRouteWithChildren = AdminRoute._addFileChildren(AdminRouteChildren);
var OrganizerRouteChildren = {
	OrganizerMintRoute,
	OrganizerScanRoute
};
var rootRouteChildren = {
	IndexRoute,
	AdminRoute: AdminRouteWithChildren,
	KycRoute,
	MarketplaceRoute,
	MyTicketsRoute,
	OrganizerRoute: OrganizerRoute._addFileChildren(OrganizerRouteChildren),
	EventsEventIdRoute
};
var routeTree = Route$12._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { testDatabase as $, fetchOrganizers as A, quoteList as B, fetchKycDetail as C, fetchMyTickets as D, fetchMintProgress as E, freezeShow as F, saveKyc as G, retryPendingIndex as H, makeOperatorKey as I, saveRoyalty as J, saveOrganizer as K, patchOrganizer as L, fetchQr as M, fetchSignerOps as N, fetchOrganizer as O, fetchWithdrawals as P, testChain as Q, prepareBuyer as R, fetchInfra as S, fetchKycQueue as T, reviewKyc as U, refundEvent as V, saveInfra as W, sellTicket as X, scanCheckIn as Y, setDevMode as Z, escalatePayout as _, useSession as a, fetchEvent as b, explorerTx as c, cancelListing as d, uploadPoster as et, claimPlatformAdmin as f, dismissPendingIndex as g, decidePayout as h, portalFor as i, fetchPendingIndex as j, fetchOrganizerEventLedger as k, gatewayUrl as l, createEvent as m, Route$2 as n, explorerAddress as o, confirmVote as p, savePlatform as q, Route$9 as r, explorerToken as s, router_exports as t, withdrawEvent as tt, buyNow as u, executePayout as v, fetchKycPhoto as w, fetchEvents as x, fetchAdminEvents as y, quoteBuy as z };
