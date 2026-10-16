import { o as __toESM } from "../_runtime.mjs";
import { t as friendlyChainError } from "./chain-errors-Ngnean6G.mjs";
import { c as shortAddr } from "./utils-CSfacMs6.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { C as useNavigate, T as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { $ as testDatabase, I as makeOperatorKey, J as saveRoyalty, Q as testChain, S as fetchInfra, W as saveInfra, Z as setDevMode, a as useSession, o as explorerAddress, q as savePlatform } from "./router-BzXJkpoJ.mjs";
import { a as useChainRun, i as ChainDialog, n as Button, r as Card, t as AppShell } from "./card-DZLSP1m-.mjs";
import { t as Hint } from "./hint-duAhVNAG.mjs";
import { t as Badge } from "./badge-BKi_jLwJ.mjs";
import { t as Input } from "./input-DurNKGpM.mjs";
import { t as Label } from "./label-DCFjKh4h.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.config-BkhD1SWv.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AdminConfig() {
	const { me, config } = useSession();
	const navigate = useNavigate();
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [infra, setInfra] = (0, import_react.useState)(null);
	const [databaseUrl, setDatabaseUrl] = (0, import_react.useState)("");
	const [rpcUrl, setRpcUrl] = (0, import_react.useState)("");
	const [chainId, setChainId] = (0, import_react.useState)("");
	const [explorerUrl, setExplorerUrl] = (0, import_react.useState)("");
	const [chainName, setChainName] = (0, import_react.useState)("");
	const [nativeSymbol, setNativeSymbol] = (0, import_react.useState)("");
	const [adminWallet, setAdminWallet] = (0, import_react.useState)("");
	const [operatorPk, setOperatorPk] = (0, import_react.useState)("");
	const [pinataJwt, setPinataJwt] = (0, import_react.useState)("");
	const [bps, setBps] = (0, import_react.useState)("10");
	const [rotatedAddr, setRotatedAddr] = (0, import_react.useState)(null);
	const [kycUrl, setKycUrl] = (0, import_react.useState)("");
	const [kycAuto, setKycAuto] = (0, import_react.useState)(false);
	const chain = useChainRun();
	async function load() {
		const data = await fetchInfra();
		setInfra(data);
		setBps(String(data.royaltyBps / 100));
		setRpcUrl(data.chain.rpcUrl);
		setChainId(String(data.chain.chainId));
		setExplorerUrl(data.chain.explorerUrl);
		setChainName(data.chain.chainName);
		setNativeSymbol(data.chain.nativeSymbol);
		setAdminWallet(data.adminWallet);
		setKycAuto(data.kyc.autoApprove);
	}
	(0, import_react.useEffect)(() => {
		if (me?.isAdmin) load().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
	}, [me?.isAdmin]);
	if (!me?.isAdmin) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Admin only."
	}) });
	const setup = infra?.setup;
	const step = !setup?.database ? 1 : !setup.pinata ? 2 : !setup.signer ? 3 : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs uppercase tracking-wide text-muted",
				children: "Platform"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-4xl italic",
				children: "Configuration"
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "outline",
				onClick: () => void navigate({ to: "/admin" }),
				children: "Dashboard"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-6 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl italic",
						children: "Setup status"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, { children: "Connect database, metadata storage, and signer. Protect the database because it stores the operator key. The public platform file contains only network and admin bootstrap settings." })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted",
					children: [
						"Order: Database → Pinata → Signer → optional Dev mode. Secrets stay in the connected database only. ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono",
							children: "config/platform.json"
						}),
						" is public bootstrap: admin wallet, RPC, chain id, explorer. Anyone who can read that database can read the hot operator key — lock the database network down in production."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
					className: "mt-4 grid gap-2 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: step === 1 ? "text-fg" : setup?.database ? "text-success" : "text-muted",
							children: [
								"1. Database ",
								setup?.database ? "· ready" : "· paste a Postgres URL",
								" — secrets live here after connect"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: step === 2 ? "text-fg" : setup?.pinata ? "text-success" : "text-muted",
							children: ["2. Pinata ", setup?.pinata ? "· ready" : "· save a JWT for posters"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: step === 3 ? "text-fg" : setup?.signer ? "text-success" : "text-muted",
							children: [
								"3. Signer key ",
								setup?.signer ? "· ready" : "· generate or paste",
								" — operator private key, database only"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "text-muted",
							children: "4. Optional — Dev mode deploys a fresh DxDAI bank on Chiado"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-4 grid gap-1 text-xs text-muted",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Operator key, Pinata JWT and DATABASE_URL are rows in the database, never sent back in full." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "KYC keys (KYC_AES_KEY, KYC_HMAC_PEPPER) and DATABASE_URL_KYC stay on the server. If the key env vars are empty, one pair is generated into the database and never shown again." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "A gitignored local pointer stores only the database URL so preview can reconnect. It does not store keys." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Generating a new signer replaces the old key. The new key is not shown again." })
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-6 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl italic",
					children: "KYC private database"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 max-w-2xl text-sm text-muted",
					children: [
						"Public tables store only a random reference and status. Name, ID number and nationality are AES-256-GCM ciphertext. Set ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono",
							children: "DATABASE_URL_KYC"
						}),
						" to a second Neon project, or paste it here (stored in the business database, not in a file). Leave it empty and ciphertext stays in this database’s ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono",
							children: "kyc_private"
						}),
						" ",
						"table. Anyone who can read the database that holds the AES key can decrypt — restrict that network in production."
					]
				}),
				infra ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 font-mono text-xs text-muted",
					children: [
						"Store ",
						infra.kyc.privateSource,
						" · ",
						infra.kyc.privateHost,
						" · keys ",
						infra.kyc.keySource,
						infra.kyc.autoApprove ? " · auto-approve" : " · admin review"
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "kyc-url",
								children: "DATABASE_URL_KYC"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "kyc-url",
								type: "password",
								autoComplete: "off",
								placeholder: infra?.kyc.privateSource === "shared" ? "Optional second Postgres URL" : `Saved on ${infra?.kyc.privateHost ?? "server"} · paste to replace`,
								value: kycUrl,
								onChange: (e) => setKycUrl(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex items-center gap-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: kycAuto,
								onChange: (e) => setKycAuto(e.target.checked)
							}), "Auto-approve submissions (otherwise they stay pending). Env KYC_AUTO_APPROVE overrides this."]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								disabled: busy,
								onClick: () => void withBusy(setBusy, async () => {
									setInfra(await saveInfra({ data: {
										kycAutoApprove: kycAuto,
										...kycUrl.trim() ? { databaseUrlKyc: kycUrl.trim() } : {}
									} }));
									setKycUrl("");
									toast.success("KYC settings saved");
								}),
								children: "Save KYC settings"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "outline",
								disabled: busy || infra?.kyc.privateSource === "env",
								onClick: () => void withBusy(setBusy, async () => {
									setInfra(await saveInfra({ data: {
										clearDatabaseUrlKyc: true,
										kycAutoApprove: kycAuto
									} }));
									setKycUrl("");
									toast.success("Cleared saved private URL");
								}),
								children: "Clear saved URL"
							})]
						}),
						infra?.kyc.privateSource === "env" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "DATABASE_URL_KYC is set in the server environment and wins over the saved URL."
						}) : null
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl italic",
						children: "Database"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Index of events and contract addresses. Preview uses embedded Postgres until you paste a Neon URL. Money is on-chain."
					}),
					infra?.db.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-danger",
						children: infra.db.error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "db-url",
									children: "DATABASE_URL"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "db-url",
									type: "password",
									autoComplete: "off",
									placeholder: infra?.db.masked || "postgres://user:pass@host/db",
									value: databaseUrl,
									onChange: (e) => setDatabaseUrl(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									disabled: busy || !databaseUrl.trim(),
									onClick: () => void withBusy(setBusy, async () => {
										const r = await testDatabase({ data: { url: databaseUrl.trim() } });
										toast.success(`Connected · ${r.version.split(" ").slice(0, 2).join(" ")}`);
									}),
									children: "Test"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									disabled: busy || !databaseUrl.trim(),
									onClick: () => void withBusy(setBusy, async () => {
										setInfra(await saveInfra({ data: { databaseUrl: databaseUrl.trim() } }));
										setDatabaseUrl("");
										toast.success("Database saved");
									}),
									children: "Save"
								})]
							}),
							infra ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-muted sm:grid-cols-3",
								children: infra.db.tables.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
									t.name,
									" ",
									t.n
								] }, t.name))
							}) : null
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl italic",
						children: "Pinata"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "JWT is stored in the database. Event posters use the returned IPFS URL."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Pinata JWT" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "password",
								autoComplete: "off",
								placeholder: infra?.chain.pinataMask ? `Saved ${infra.chain.pinataMask} · paste to replace` : "eyJ…",
								value: pinataJwt,
								onChange: (e) => setPinataJwt(e.target.value)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							disabled: busy || !pinataJwt.trim(),
							onClick: () => void withBusy(setBusy, async () => {
								setInfra(await saveInfra({ data: { pinataJwt: pinataJwt.trim() } }));
								setPinataJwt("");
								toast.success("Pinata saved");
							}),
							children: "Save Pinata"
						})]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl italic",
					children: "Network & signer"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "RPC and admin address are public. The operator private key is written only to the database after it is connected."
				}),
				infra?.chain.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-danger",
					children: infra.chain.error
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid gap-3 md:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Chain name" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: chainName,
								onChange: (e) => setChainName(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Native symbol" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: nativeSymbol,
								onChange: (e) => setNativeSymbol(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Chain ID" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: chainId,
								onChange: (e) => setChainId(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "RPC URL" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: rpcUrl,
								onChange: (e) => setRpcUrl(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5 md:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Explorer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: explorerUrl,
								onChange: (e) => setExplorerUrl(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5 md:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Platform admin wallet" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: adminWallet,
								onChange: (e) => setAdminWallet(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5 md:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Operator private key" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "password",
								autoComplete: "off",
								placeholder: infra?.chain.operatorMask ? `Saved ${infra.chain.operatorMask} · paste to replace` : "0x…",
								value: operatorPk,
								onChange: (e) => setOperatorPk(e.target.value)
							})]
						})
					]
				}),
				infra?.chain.operatorAddress ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 font-mono text-xs text-muted",
					children: [
						"Signer ",
						shortAddr(infra.chain.operatorAddress),
						" ·",
						" ",
						infra.chain.operatorBalance ? `${Number(infra.chain.operatorBalance).toFixed(4)} ${config?.nativeSymbol ?? "xDAI"}` : "balance unknown"
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							disabled: busy,
							onClick: () => void withBusy(setBusy, async () => {
								const ping = await testChain({ data: {
									rpcUrl,
									chainId: Number(chainId)
								} });
								toast.success(`RPC live · block ${ping.blockNumber}`);
								await load();
							}),
							children: "Ping RPC"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							disabled: busy,
							onClick: () => void withBusy(setBusy, async () => {
								await savePlatform({ data: {
									adminWallet,
									chainName,
									nativeSymbol,
									rpcUrl,
									chainId: Number(chainId),
									explorerUrl
								} });
								setInfra(await saveInfra({ data: {
									rpcUrl,
									chainId: Number(chainId),
									explorerUrl,
									operatorPk: operatorPk.trim() || void 0
								} }));
								setOperatorPk("");
								toast.success("Saved to database");
							}),
							children: "Save network"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							disabled: busy,
							onClick: () => void withBusy(setBusy, async () => {
								if (infra?.chain.operatorKeySet && !window.confirm("Replace the operator key? The previous key stops signing immediately. The new key is stored in the database and will not be shown.")) return;
								const made = await makeOperatorKey();
								setRotatedAddr(made.address);
								setOperatorPk("");
								await load();
								toast.success("New signer saved in the database. Fund this address with Chiado xDAI.");
							}),
							children: "Generate signer"
						})
					]
				}),
				rotatedAddr ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 font-mono text-xs text-muted",
					children: [
						"New signer ",
						rotatedAddr,
						". Previous key no longer signs. The private key stays in the database."
					]
				}) : null
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl italic",
						children: "Dev mode"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "On: deploys a fresh DxDAI bank (10,000). Off: native xDAI. Toggle off then on to recast."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChainDialog, {
						...chain,
						onClose: chain.close
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: infra?.chain.devMode ? "sage" : "mist",
							children: infra?.chain.devMode ? "dev on" : "native coin"
						}), infra?.chain.demoBank ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							className: "font-mono text-xs text-primary underline",
							href: explorerAddress(infra.chain.demoBank, infra.chain.explorerUrl),
							target: "_blank",
							rel: "noreferrer",
							children: shortAddr(infra.chain.demoBank)
						}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-4",
						disabled: busy || !infra?.setup.signer,
						onClick: () => void withBusy(setBusy, async () => {
							const enabling = !infra?.chain.devMode;
							await chain.run({
								title: enabling ? "Turn on test coins" : "Turn off test coins",
								labels: enabling ? [
									"Create test coin bank",
									"Wait for chain confirmation",
									"Save bank address"
								] : ["Turn off test coins", "Clear bank address"],
								task: async (advance) => {
									advance(1);
									const next = await setDevMode({ data: { on: enabling } });
									advance(2);
									setInfra(next);
									return next.chain.devMode ? "A fresh 10,000 DxDAI bank is ready." : "The platform now uses native xDAI.";
								}
							});
						}),
						children: infra?.chain.devMode ? "Turn off · use native xDAI" : "Mint 10,000 DxDAI"
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Secondary royalty (%)" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted",
						children: "Taken from the seller on every resale, into that event’s vault."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: bps,
							onChange: (e) => setBps(e.target.value)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: async () => {
								try {
									await saveRoyalty({ data: { bps: Math.round(Number(bps) * 100) } });
									toast.success("Royalty updated");
								} catch (e) {
									toast.error(friendlyChainError(e));
								}
							},
							children: "Update"
						})]
					})
				]
			})]
		})
	] });
}
async function withBusy(setBusy, fn) {
	setBusy(true);
	try {
		await fn();
	} catch (e) {
		toast.error(friendlyChainError(e));
	} finally {
		setBusy(false);
	}
}
//#endregion
export { AdminConfig as component };
