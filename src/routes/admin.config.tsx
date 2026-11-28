import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminAccessGate, AdminDarkShell } from "@/components/admin-dark-shell";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import {
  fetchInfra,
  makeOperatorKey,
  resetApplicationData,
  saveInfra,
  savePlatform,
  saveRoyalty,
  setDevMode,
  testChain,
  testDatabase,
} from "@/lib/api";
import { friendlyChainError } from "@/lib/chain-errors";
import { explorerAddress } from "@/lib/explorer";
import { isGnosisMainnet, NETWORK_PRESETS } from "@/lib/network-config";
import type { InfraStatus } from "@/lib/types";
import { shortAddr } from "@/lib/utils";

export const Route = createFileRoute("/admin/config")({ component: AdminConfig });

type SetupFolderKey = "kyc_db" | "main_db" | "ipfs" | "network" | "reset";

const POCKET_FOLDERS: readonly {
  key: SetupFolderKey;
  watermark: string;
  label: string;
}[] = [
  { key: "kyc_db", watermark: "KYC", label: "KYC Isolated Database" },
  { key: "main_db", watermark: "DB", label: "Database" },
  { key: "ipfs", watermark: "IPFS", label: "IPFS & Pinata" },
  { key: "network", watermark: "RPC", label: "Network & Signer" },
  { key: "reset", watermark: "RST", label: "Reset Application Data" },
];

const SHEET_THEME_CLASS: Record<SetupFolderKey, string> = {
  kyc_db: "",
  main_db: " theme-cyan",
  ipfs: " theme-violet",
  network: " theme-amber",
  reset: " theme-crimson",
};

function AdminConfig() {
  const { me, config } = useSession();
  const [busy, setBusy] = useState(false);
  const [infra, setInfra] = useState<InfraStatus | null>(null);
  const [activeFolder, setActiveFolder] = useState<SetupFolderKey | null>(null);

  const [databaseUrl, setDatabaseUrl] = useState("");
  const [rpcUrl, setRpcUrl] = useState("");
  const [chainId, setChainId] = useState("");
  const [explorerUrl, setExplorerUrl] = useState("");
  const [chainName, setChainName] = useState("");
  const [nativeSymbol, setNativeSymbol] = useState("");
  const [adminWallet, setAdminWallet] = useState("");
  const [operatorPk, setOperatorPk] = useState("");
  const [pinataJwt, setPinataJwt] = useState("");
  const [ipfsGateway, setIpfsGateway] = useState("https://dweb.link");
  const [resetPhrase, setResetPhrase] = useState("");
  const [bps, setBps] = useState("10");
  const [rotatedAddr, setRotatedAddr] = useState<string | null>(null);
  const [kycUrl, setKycUrl] = useState("");
  const [kycAuto, setKycAuto] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);

  const chain = useChainRun();
  const mainnet = isGnosisMainnet(Number(chainId));

  function selectNetwork(key: "chiado" | "gnosis") {
    const preset = NETWORK_PRESETS[key];
    setChainName(preset.chainName);
    setNativeSymbol(preset.nativeSymbol);
    setChainId(String(preset.chainId));
    setRpcUrl(preset.rpcUrl);
    setExplorerUrl(preset.explorerUrl);
  }

  async function load() {
    const data = await fetchInfra();
    setInfra(data);
    setBps(String((data?.royaltyBps ?? 0) / 100));
    if (data?.chain) {
      setRpcUrl(data.chain.rpcUrl ?? "");
      setChainId(String(data.chain.chainId ?? ""));
      setExplorerUrl(data.chain.explorerUrl ?? "");
      setChainName(data.chain.chainName ?? "");
      setNativeSymbol(data.chain.nativeSymbol ?? "");
      setIpfsGateway(data.chain.ipfsGateway ?? "");
    }
    setAdminWallet(data?.adminWallet ?? "");
    setKycAuto(data?.kyc?.autoApprove ?? false);
  }

  useEffect(() => {
    if (me?.isAdmin) void load().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, [me?.isAdmin]);

  useEffect(() => {
    if (!activeFolder) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        setActiveFolder(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeFolder, busy]);

  if (!me || !me.isAdmin) {
    return (
      <AdminDarkShell>
        <AdminAccessGate />
      </AdminDarkShell>
    );
  }

  const setup = infra?.setup;

  return (
    <AdminDarkShell>
      <main className="setup-dashboard-shell">
        <div className="setup-left-col">
          {/* Top Setup Status 3 Cards */}
          <section className="setup-status-section">
            <div className="section-heading-row">
              <h1>Setup Status</h1>
            </div>

            <div className="status-cards-grid">
              <div className="status-metric-card">
                <span className="status-metric-title">1. Database</span>
                <span className={`status-pill-badge${setup?.database ? "" : " warn"}`}>
                  {setup?.database ? "Connected" : "Required"}
                </span>
              </div>

              <div className="status-metric-card">
                <span className="status-metric-title">2. IPFS Storage</span>
                <span className={`status-pill-badge${setup?.pinata ? "" : " warn"}`}>
                  {setup?.pinata ? "Connected" : "Required"}
                </span>
              </div>

              <div className="status-metric-card">
                <span className="status-metric-title">3. Signer Key</span>
                <span className={`status-pill-badge${setup?.signer ? "" : " warn"}`}>
                  {setup?.signer ? "Ready" : "Required"}
                </span>
              </div>
            </div>
          </section>

          {/* 5 3D Frosted Glass Pocket Folders */}
          <section className="pocket-folders-shelf" aria-label="Configuration modules">
            {POCKET_FOLDERS.map((folder) => (
              <button
                key={folder.key}
                type="button"
                className={`pocket-folder-item${activeFolder === folder.key ? " is-active" : ""}`}
                data-folder={folder.key}
                onClick={() => setActiveFolder(folder.key)}
              >
                <div className="pocket-3d-box">
                  <div className="pocket-back" />
                  <div className="pocket-docs-stack">
                    <div className="mini-doc-card doc-left">
                      <span className="w-mid" />
                      <span className="w-short" />
                    </div>
                    <div className="mini-doc-card doc-right">
                      <span className="w-short" />
                      <span className="w-mid" />
                    </div>
                    <div className="mini-doc-card doc-center">
                      <span className="w-mid" />
                      <span className="w-short" />
                      <span />
                    </div>
                  </div>
                  <div className="pocket-front-glass">
                    <span className="pocket-watermark">{folder.watermark}</span>
                  </div>
                </div>
                <span className="pocket-folder-label">{folder.label}</span>
              </button>
            ))}
          </section>
        </div>

        {/* Right Side Column: Testnet Faucet + Resale Royalty */}
        <aside className="setup-right-col">
          <section className="side-widget-card">
            <h2 className="side-widget-title">Testnet Faucet</h2>
            <div className="faucet-status-row">
              <span className={`badge-dev-active${infra?.chain?.devMode ? "" : " warn"}`}>
                {infra?.chain?.devMode ? "Dev Active" : "Native xDAI"}
              </span>
              {infra?.chain?.demoBank ? (
                <div className="inline-flex items-center gap-1.5">
                  <a
                    className="faucet-addr-link"
                    href={explorerAddress(infra.chain.demoBank, infra.chain.explorerUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortAddr(infra.chain.demoBank)}
                  </a>
                  <button
                    type="button"
                    className={`btn-copy-mini${copiedBank ? " copied" : ""}`}
                    title="Copy faucet address"
                    onClick={() => {
                      navigator.clipboard?.writeText(infra.chain.demoBank!).catch(() => undefined);
                      setCopiedBank(true);
                      toast.success(`Copied faucet address ${shortAddr(infra.chain.demoBank!)}`);
                      setTimeout(() => setCopiedBank(false), 1200);
                    }}
                  >
                    {copiedBank ? "✓" : "⧉"}
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="btn-use-native"
              disabled={busy || !infra?.setup?.signer}
              onClick={() =>
                void withBusy(setBusy, async () => {
                  const enabling = !infra?.chain?.devMode;
                  if (
                    enabling &&
                    mainnet &&
                    !window.confirm(
                      "Deploy a DxDAI contract on live Gnosis mainnet and switch app payment flows to that token? This sends a real mainnet transaction.",
                    )
                  ) {
                    return;
                  }
                  await chain.run({
                    title: enabling ? "Turn on test coins" : "Turn off test coins",
                    labels: enabling
                      ? ["Create test coin bank", "Wait for chain confirmation", "Save bank address"]
                      : ["Turn off test coins", "Clear bank address"],
                    task: async (advance) => {
                      advance(1);
                      const next = await setDevMode({ data: { on: enabling } });
                      advance(2);
                      setInfra(next);
                      return next?.chain?.devMode
                        ? "A fresh 10,000 DxDAI bank is ready."
                        : "The platform now uses native xDAI.";
                    },
                  });
                })
              }
            >
              {infra?.chain?.devMode ? "Use native xDAI" : "Mint 10,000 DxDAI"}
            </button>
          </section>

          <section className="side-widget-card">
            <h2 className="side-widget-title">Resale Royalty (%)</h2>
            <div className="royalty-input-row">
              <input
                className="f-input"
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={bps}
                onChange={(e) => setBps(e.target.value)}
                aria-label="Resale Royalty (%)"
              />
              <button
                type="button"
                className="btn-solid-mint"
                disabled={busy}
                onClick={async () => {
                  try {
                    await saveRoyalty({ data: { bps: Math.round(Number(bps) * 100) } });
                    toast.success("Royalty updated");
                    await load();
                  } catch (e) {
                    toast.error(friendlyChainError(e));
                  }
                }}
              >
                Update
              </button>
            </div>
          </section>
        </aside>
      </main>

      {/* Centered Pocket Folder Configuration Modal */}
      <div
        className={`folder-modal-backdrop${activeFolder ? " open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) setActiveFolder(null);
        }}
      >
        <div
          className={`receipt-paper-sheet${activeFolder ? SHEET_THEME_CLASS[activeFolder] : ""}`}
          role="dialog"
          aria-modal="true"
        >
          {activeFolder ? (
            <button
              type="button"
              className="btn-close-sheet"
              title="Close"
              onClick={() => setActiveFolder(null)}
            >
              ✕
            </button>
          ) : null}

          {activeFolder === "kyc_db" ? (
            <>
              <div className="sheet-header-row">
                <h2 className="sheet-title">KYC Isolated Database</h2>
                {infra?.kyc ? (
                  <span className="sheet-endpoint-meta">
                    {infra.kyc.privateSource} · {infra.kyc.privateHost}
                  </span>
                ) : null}
              </div>

              <div className="form-stack">
                <div className="f-group">
                  <label className="f-label" htmlFor="kyc-url">
                    DATABASE_URL_KYC
                  </label>
                  <input
                    className="f-input"
                    id="kyc-url"
                    type="password"
                    autoComplete="off"
                    placeholder={
                      infra?.kyc?.privateSource === "shared"
                        ? "postgres://user:pass@host/db"
                        : "postgres://••••"
                    }
                    value={kycUrl}
                    onChange={(e) => setKycUrl(e.target.value)}
                  />
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={kycAuto}
                    onChange={(e) => setKycAuto(e.target.checked)}
                  />
                  <span>Auto-approve submissions (otherwise they stay pending).</span>
                </label>

                {mainnet && kycAuto ? (
                  <p className="sheet-inline-alert">
                    Mainnet warning: every valid KYC submission will be marked approved automatically,
                    without admin review.
                  </p>
                ) : null}

                <div className="btn-row-wrap">
                  <button
                    type="button"
                    className="btn-solid-mint"
                    disabled={busy}
                    onClick={() => {
                      if (
                        mainnet &&
                        kycAuto &&
                        !infra?.kyc?.autoApprove &&
                        !window.confirm(
                          "Enable automatic KYC approval on Gnosis mainnet? New valid submissions will be approved without an administrator reviewing the identity documents.",
                        )
                      ) {
                        return;
                      }
                      void withBusy(setBusy, async () => {
                        const saved = await saveInfra({
                          data: {
                            kycAutoApprove: kycAuto,
                            ...(kycUrl.trim() ? { databaseUrlKyc: kycUrl.trim() } : {}),
                          },
                        });
                        setInfra(saved);
                        setKycAuto(saved.kyc.autoApprove);
                        setKycUrl("");
                        toast.success("KYC settings saved");
                      });
                    }}
                  >
                    Save KYC settings
                  </button>

                  <button
                    type="button"
                    className="btn-outline-glass"
                    disabled={busy || infra?.kyc?.privateSource === "env"}
                    onClick={() =>
                      void withBusy(setBusy, async () => {
                        const saved = await saveInfra({
                          data: { clearDatabaseUrlKyc: true, kycAutoApprove: kycAuto },
                        });
                        setInfra(saved);
                        setKycAuto(saved.kyc.autoApprove);
                        setKycUrl("");
                        toast.success("Cleared saved private URL");
                      })
                    }
                  >
                    Clear saved URL
                  </button>
                </div>

                {infra?.kyc?.privateSource === "env" ? (
                  <p className="signer-sub-meta">
                    DATABASE_URL_KYC is set in the server environment and wins over the saved URL.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {activeFolder === "main_db" ? (
            <>
              <div className="sheet-header-row">
                <h2 className="sheet-title">Database</h2>
              </div>

              <div className="form-stack">
                {infra?.db?.error ? (
                  <p className="sheet-inline-alert">{infra.db.error}</p>
                ) : null}

                <div className="f-group">
                  <label className="f-label" htmlFor="db-url">
                    DATABASE_URL
                  </label>
                  <input
                    className="f-input"
                    id="db-url"
                    type="password"
                    autoComplete="off"
                    placeholder={infra?.db?.masked || "postgres://user:pass@host/db"}
                    value={databaseUrl}
                    onChange={(e) => setDatabaseUrl(e.target.value)}
                  />
                </div>

                <div className="btn-row-wrap">
                  <button
                    type="button"
                    className="btn-outline-glass"
                    disabled={busy || !databaseUrl.trim()}
                    onClick={() =>
                      void withBusy(setBusy, async () => {
                        const r = await testDatabase({ data: { url: databaseUrl.trim() } });
                        toast.success(`Connected · ${r.version.split(" ").slice(0, 2).join(" ")}`);
                      })
                    }
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    className="btn-solid-mint"
                    disabled={busy || !databaseUrl.trim()}
                    onClick={() =>
                      void withBusy(setBusy, async () => {
                        setInfra(await saveInfra({ data: { databaseUrl: databaseUrl.trim() } }));
                        setDatabaseUrl("");
                        toast.success("Database saved");
                      })
                    }
                  >
                    Save
                  </button>
                </div>

                {infra?.db?.tables ? (
                  <div className="db-tables-stats-grid">
                    {infra.db.tables.map((t) => (
                      <div key={t.name} className="db-stat-cell">
                        <span>{t.name}</span>
                        <strong>{t.n}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {activeFolder === "ipfs" ? (
            <>
              <div className="sheet-header-row">
                <h2 className="sheet-title">IPFS &amp; Pinata</h2>
              </div>

              <div className="form-stack">
                <div className="f-group">
                  <label className="f-label" htmlFor="pinata-jwt-input">
                    Pinata JWT
                  </label>
                  <input
                    className="f-input"
                    id="pinata-jwt-input"
                    type="password"
                    autoComplete="off"
                    placeholder={infra?.chain?.pinataMask ? "eyJ••••" : "eyJ…"}
                    value={pinataJwt}
                    onChange={(e) => setPinataJwt(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn-solid-mint btn-full-width"
                  disabled={busy || !pinataJwt.trim()}
                  onClick={() =>
                    void withBusy(setBusy, async () => {
                      setInfra(await saveInfra({ data: { pinataJwt: pinataJwt.trim() } }));
                      setPinataJwt("");
                      toast.success("Pinata saved");
                    })
                  }
                >
                  Save Pinata
                </button>

                <div className="f-group mt-1">
                  <label className="f-label" htmlFor="ipfs-gateway">
                    IPFS read gateway
                  </label>
                  <input
                    className="f-input"
                    id="ipfs-gateway"
                    type="url"
                    inputMode="url"
                    placeholder="https://gateway.example.com"
                    value={ipfsGateway}
                    onChange={(e) => setIpfsGateway(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn-outline-glass btn-full-width"
                  disabled={busy || !ipfsGateway.trim()}
                  onClick={() =>
                    void withBusy(setBusy, async () => {
                      setInfra(await saveInfra({ data: { ipfsGateway: ipfsGateway.trim() } }));
                      toast.success("IPFS gateway saved");
                    })
                  }
                >
                  Save gateway
                </button>
              </div>
            </>
          ) : null}

          {activeFolder === "network" ? (
            <>
              <div className="sheet-header-row">
                <h2 className="sheet-title">Network &amp; Signer</h2>
                <span className="sheet-endpoint-meta">
                  {infra?.chain?.chainName || chainName} (ID {infra?.chain?.chainId ?? chainId})
                </span>
              </div>

              <div className="form-stack">
                {infra?.chain?.error || infra?.chain?.lastError ? (
                  <p className="sheet-inline-alert">
                    {infra.chain.error || infra.chain.lastError}
                  </p>
                ) : null}

                <div className="f-group">
                  <label className="f-label" htmlFor="network-preset">
                    Network preset
                  </label>
                  <select
                    className="f-select"
                    id="network-preset"
                    value={chainId === "100" ? "gnosis" : chainId === "10200" ? "chiado" : "custom"}
                    onChange={(e) => {
                      if (e.target.value === "chiado" || e.target.value === "gnosis") {
                        selectNetwork(e.target.value);
                      }
                    }}
                  >
                    <option value="chiado">Gnosis Chiado · 10200</option>
                    <option value="gnosis">Gnosis Mainnet · 100</option>
                    <option value="custom">Custom network</option>
                  </select>
                </div>

                <div className="form-grid-2">
                  <div className="f-group">
                    <label className="f-label" htmlFor="chain-name-input">
                      Chain name
                    </label>
                    <input
                      className="f-input"
                      id="chain-name-input"
                      type="text"
                      value={chainName}
                      onChange={(e) => setChainName(e.target.value)}
                    />
                  </div>

                  <div className="f-group">
                    <label className="f-label" htmlFor="native-symbol-input">
                      Native symbol
                    </label>
                    <input
                      className="f-input"
                      id="native-symbol-input"
                      type="text"
                      value={nativeSymbol}
                      onChange={(e) => setNativeSymbol(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="f-group">
                    <label className="f-label" htmlFor="chain-id-input">
                      Chain ID
                    </label>
                    <input
                      className="f-input"
                      id="chain-id-input"
                      type="text"
                      value={chainId}
                      onChange={(e) => setChainId(e.target.value)}
                    />
                  </div>

                  <div className="f-group">
                    <label className="f-label" htmlFor="rpc-url-input">
                      RPC URL
                    </label>
                    <input
                      className="f-input"
                      id="rpc-url-input"
                      type="text"
                      value={rpcUrl}
                      onChange={(e) => setRpcUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div className="f-group">
                  <label className="f-label" htmlFor="explorer-input">
                    Explorer
                  </label>
                  <input
                    className="f-input"
                    id="explorer-input"
                    type="text"
                    value={explorerUrl}
                    onChange={(e) => setExplorerUrl(e.target.value)}
                  />
                </div>

                <div className="f-group">
                  <label className="f-label" htmlFor="admin-wallet-input">
                    Platform admin wallet
                  </label>
                  <input
                    className="f-input"
                    id="admin-wallet-input"
                    type="text"
                    value={adminWallet}
                    onChange={(e) => setAdminWallet(e.target.value)}
                  />
                </div>

                <div className="f-group">
                  <label className="f-label" htmlFor="operator-pk-input">
                    Operator private key
                  </label>
                  <input
                    className="f-input"
                    id="operator-pk-input"
                    type="password"
                    autoComplete="off"
                    placeholder={infra?.chain?.operatorMask ? "0x••••" : "0x…"}
                    value={operatorPk}
                    onChange={(e) => setOperatorPk(e.target.value)}
                  />
                </div>

                {infra?.chain?.operatorAddress ? (
                  <div className="signer-sub-meta">
                    Signer {shortAddr(infra.chain.operatorAddress)} ·{" "}
                    {infra.chain.operatorBalance
                      ? `${Number(infra.chain.operatorBalance).toFixed(4)} ${config?.nativeSymbol ?? "xDAI"}`
                      : "balance unknown"}
                  </div>
                ) : null}

                <div className="btn-row-wrap">
                  <button
                    type="button"
                    className="btn-outline-glass"
                    disabled={busy}
                    onClick={() =>
                      void withBusy(setBusy, async () => {
                        const ping = await testChain({
                          data: { rpcUrl, chainId: Number(chainId) },
                        });
                        if (!ping.connected) {
                          throw new Error(
                            ping.lastError ||
                              `RPC chain ID mismatch (configured ${chainId}, received ${ping.chainId}).`,
                          );
                        }
                        toast.success(`RPC live · block ${ping.blockNumber}`);
                        await load();
                      })
                    }
                  >
                    Ping RPC
                  </button>

                  <button
                    type="button"
                    className="btn-solid-mint"
                    disabled={busy}
                    onClick={() =>
                      void withBusy(setBusy, async () => {
                        const ping = await testChain({
                          data: { rpcUrl, chainId: Number(chainId) },
                        });
                        if (!ping.connected) {
                          throw new Error(
                            ping.lastError ||
                              `RPC chain ID mismatch (configured ${chainId}, received ${ping.chainId}).`,
                          );
                        }
                        setInfra(
                          await saveInfra({
                            data: {
                              rpcUrl,
                              chainId: Number(chainId),
                              chainName,
                              nativeSymbol,
                              explorerUrl,
                              operatorPk: operatorPk.trim() || undefined,
                            },
                          }),
                        );
                        await savePlatform({
                          data: {
                            adminWallet,
                            chainName,
                            nativeSymbol,
                            rpcUrl,
                            chainId: Number(chainId),
                            explorerUrl,
                          },
                        });
                        setOperatorPk("");
                        toast.success("Saved to database");
                      })
                    }
                  >
                    Save network
                  </button>

                  <button
                    type="button"
                    className="btn-outline-glass"
                    disabled={busy}
                    onClick={() =>
                      void withBusy(setBusy, async () => {
                        if (
                          infra?.chain?.operatorKeySet &&
                          !window.confirm(
                            "Replace the operator key? The previous key stops signing immediately. The new key is stored in the database and will not be shown.",
                          )
                        ) {
                          return;
                        }
                        const made = await makeOperatorKey();
                        setRotatedAddr(made.address);
                        setOperatorPk("");
                        await load();
                        toast.success(
                          `New signer saved in the database. Fund this address with ${
                            nativeSymbol || "the native token"
                          } on ${chainName || "the selected network"}.`,
                        );
                      })
                    }
                  >
                    Generate signer
                  </button>
                </div>

                {rotatedAddr ? (
                  <p className="signer-sub-meta">
                    New signer {rotatedAddr}. Previous key no longer signs. The private key stays in
                    the database.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {activeFolder === "reset" ? (
            <>
              <div className="sheet-header-row">
                <h2 className="sheet-title text-[#fda4af]">Reset Application Data</h2>
              </div>

              <div className="form-stack">
                <p className="text-[0.84rem] leading-[1.6] text-white/70">
                  Permanently deletes app records, listings, and KYC data. On-chain contracts and
                  balances remain untouched.
                </p>

                <div className="f-group">
                  <label className="f-label" htmlFor="reset-phrase">
                    Type RESET APPLICATION DATA to confirm
                  </label>
                  <div className="reset-inline-row">
                    <input
                      className="f-input"
                      id="reset-phrase"
                      type="text"
                      autoComplete="off"
                      placeholder="RESET APPLICATION DATA"
                      value={resetPhrase}
                      onChange={(e) => setResetPhrase(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-solid-crimson"
                      disabled={busy || resetPhrase !== "RESET APPLICATION DATA"}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Permanently clear this installation's app and KYC data? On-chain activity will remain and cannot be rolled back by this reset.",
                          )
                        ) {
                          return;
                        }
                        void withBusy(setBusy, async () => {
                          const result = await resetApplicationData({
                            data: { confirmation: resetPhrase },
                          });
                          setResetPhrase("");
                          await load();
                          toast.success(
                            `Application data reset · removed ${result.removedKycPhotos} KYC photo(s)`,
                          );
                          if (result.photoCleanupWarning) toast.error(result.photoCleanupWarning);
                        });
                      }}
                    >
                      Clear app data
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <ChainDialog
        {...chain}
        onClose={chain.close}
        explorerUrl={infra?.chain?.explorerUrl || config?.explorerUrl || ""}
      />
    </AdminDarkShell>
  );
}

async function withBusy(setBusy: (v: boolean) => void, fn: () => Promise<void>) {
  setBusy(true);
  try {
    await fn();
  } catch (e) {
    toast.error(friendlyChainError(e));
  } finally {
    setBusy(false);
  }
}
