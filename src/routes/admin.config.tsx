import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Hint } from "@/components/hint";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchInfra,
  makeOperatorKey,
  saveInfra,
  savePlatform,
  saveRoyalty,
  resetApplicationData,
  setDevMode,
  testChain,
  testDatabase,
} from "@/lib/api";
import { explorerAddress } from "@/lib/explorer";
import { friendlyChainError } from "@/lib/chain-errors";
import type { InfraStatus } from "@/lib/types";
import { shortAddr } from "@/lib/utils";
import { NETWORK_PRESETS, isGnosisMainnet } from "@/lib/network-config";

export const Route = createFileRoute("/admin/config")({ component: AdminConfig });

function AdminConfig() {
  const { me, config } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [infra, setInfra] = useState<InfraStatus | null>(null);
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

  if (!me?.isAdmin) {
    return (
      <AppShell>
        <p className="text-sm text-muted">Admin only.</p>
      </AppShell>
    );
  }

  const setup = infra?.setup;
  const step =
    !setup?.database ? 1 : !setup.pinata ? 2 : !setup.signer ? 3 : 0;

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-fg">
          System Configuration
        </h1>
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: "/admin" })}>
          Dashboard
        </Button>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-display text-xl font-bold tracking-tight text-fg">Setup Status</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-bg-elevated/60 p-3 flex items-center justify-between">
            <span className="text-xs font-semibold">1. Database</span>
            <Badge tone={setup?.database ? "sage" : "mist"}>{setup?.database ? "Connected" : "Required"}</Badge>
          </div>
          <div className="rounded-lg border border-border bg-bg-elevated/60 p-3 flex items-center justify-between">
            <span className="text-xs font-semibold">2. IPFS Storage</span>
            <Badge tone={setup?.pinata ? "sage" : "mist"}>{setup?.pinata ? "Connected" : "Required"}</Badge>
          </div>
          <div className="rounded-lg border border-border bg-bg-elevated/60 p-3 flex items-center justify-between">
            <span className="text-xs font-semibold">3. Signer Key</span>
            <Badge tone={setup?.signer ? "sage" : "mist"}>{setup?.signer ? "Ready" : "Required"}</Badge>
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight text-fg">KYC Isolated Database</h2>
          {infra?.kyc ? (
            <span className="font-mono text-xs text-muted">
              {infra.kyc.privateSource} · {infra.kyc.privateHost}
            </span>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="kyc-url">DATABASE_URL_KYC</Label>
            <Input
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={kycAuto} onChange={(e) => setKycAuto(e.target.checked)} />
            Auto-approve submissions (otherwise they stay pending).
          </label>
          {mainnet && kycAuto ? <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">Mainnet warning: every valid KYC submission will be marked approved automatically, without admin review.</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() => {
                if (mainnet && kycAuto && !infra?.kyc?.autoApprove && !window.confirm("Enable automatic KYC approval on Gnosis mainnet? New valid submissions will be approved without an administrator reviewing the identity documents.")) return;
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
            </Button>
            <Button
              variant="outline"
              disabled={busy || infra?.kyc?.privateSource === "env"}
              onClick={() =>
                void withBusy(setBusy, async () => {
                  const saved = await saveInfra({ data: { clearDatabaseUrlKyc: true, kycAutoApprove: kycAuto } });
                  setInfra(saved);
                  setKycAuto(saved.kyc.autoApprove);
                  setKycUrl("");
                  toast.success("Cleared saved private URL");
                })
              }
            >
              Clear saved URL
            </Button>
          </div>
          {infra?.kyc?.privateSource === "env" ? (
            <p className="text-xs text-muted">DATABASE_URL_KYC is set in the server environment and wins over the saved URL.</p>
          ) : null}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-xl font-bold tracking-tight text-fg">Database</h2>
          {infra?.db?.error ? <p className="mt-2 text-sm text-danger">{infra.db.error}</p> : null}
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="db-url">DATABASE_URL</Label>
              <Input
                id="db-url"
                type="password"
                autoComplete="off"
                placeholder={infra?.db?.masked || "postgres://user:pass@host/db"}
                value={databaseUrl}
                onChange={(e) => setDatabaseUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy || !databaseUrl.trim()}
                onClick={() =>
                  void withBusy(setBusy, async () => {
                    const r = await testDatabase({ data: { url: databaseUrl.trim() } });
                    toast.success(`Connected · ${r.version.split(" ").slice(0, 2).join(" ")}`);
                  })
                }
              >
                Test
              </Button>
              <Button
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
              </Button>
            </div>
            {infra ? (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-muted sm:grid-cols-3">
                {infra.db.tables.map((t) => (
                  <li key={t.name}>
                    {t.name} {t.n}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-xl font-bold tracking-tight text-fg">IPFS & Pinata</h2>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label>Pinata JWT</Label>
              <Input
                type="password"
                autoComplete="off"
                placeholder={infra?.chain?.pinataMask ? "eyJ••••" : "eyJ…"}
                value={pinataJwt}
                onChange={(e) => setPinataJwt(e.target.value)}
              />
            </div>
            <Button
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
            </Button>
            <div className="mt-2 grid gap-1.5">
              <Label htmlFor="ipfs-gateway">IPFS read gateway</Label>
              <Input
                id="ipfs-gateway"
                type="url"
                inputMode="url"
                placeholder="https://gateway.example.com"
                value={ipfsGateway}
                onChange={(e) => setIpfsGateway(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              disabled={busy || !ipfsGateway.trim()}
              onClick={() =>
                void withBusy(setBusy, async () => {
                  setInfra(await saveInfra({ data: { ipfsGateway: ipfsGateway.trim() } }));
                  toast.success("IPFS gateway saved");
                })
              }
            >
              Save gateway
            </Button>
          </div>
        </Card>
      </div>

      <Card className="mt-4 border-danger/40 p-5">
        <h2 className="font-display text-xl font-bold tracking-tight text-danger">Reset Application Data</h2>
        <p className="mt-1 text-xs text-muted">
          Permanently deletes app records, listings, and KYC data. On-chain contracts and balances remain untouched.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="grid min-w-64 flex-1 gap-1.5">
            <Label htmlFor="reset-phrase">Type RESET APPLICATION DATA to confirm</Label>
            <Input id="reset-phrase" value={resetPhrase} onChange={(e) => setResetPhrase(e.target.value)} autoComplete="off" />
          </div>
          <Button
            variant="danger"
            disabled={busy || resetPhrase !== "RESET APPLICATION DATA"}
            onClick={() => {
              if (!window.confirm("Permanently clear this installation's app and KYC data? On-chain activity will remain and cannot be rolled back by this reset.")) return;
              void withBusy(setBusy, async () => {
                const result = await resetApplicationData({ data: { confirmation: resetPhrase } });
                setResetPhrase("");
                await load();
                toast.success(`Application data reset · removed ${result.removedKycPhotos} KYC photo(s)`);
                if (result.photoCleanupWarning) toast.error(result.photoCleanupWarning);
              });
            }}
          >
            Clear app data
          </Button>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight text-fg">Network & Signer</h2>
          <span className="font-mono text-xs text-muted">
            {infra?.chain?.chainName || chainName} (ID {infra?.chain?.chainId ?? chainId})
          </span>
        </div>
        {infra?.chain?.error || infra?.chain?.lastError ? <p className="mt-2 text-sm text-danger">{infra?.chain?.error || infra?.chain?.lastError}</p> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="network-preset">Network preset</Label>
            <select id="network-preset" className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg" value={chainId === "100" ? "gnosis" : chainId === "10200" ? "chiado" : "custom"} onChange={(e) => { if (e.target.value === "chiado" || e.target.value === "gnosis") selectNetwork(e.target.value); }}>
              <option value="chiado">Gnosis Chiado · 10200</option>
              <option value="gnosis">Gnosis Mainnet · 100</option>
              <option value="custom">Custom network</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>Chain name</Label>
            <Input value={chainName} onChange={(e) => setChainName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Native symbol</Label>
            <Input value={nativeSymbol} onChange={(e) => setNativeSymbol(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Chain ID</Label>
            <Input value={chainId} onChange={(e) => setChainId(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>RPC URL</Label>
            <Input value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} />
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label>Explorer</Label>
            <Input value={explorerUrl} onChange={(e) => setExplorerUrl(e.target.value)} />
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label>Platform admin wallet</Label>
            <Input value={adminWallet} onChange={(e) => setAdminWallet(e.target.value)} />
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label>Operator private key</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder={infra?.chain?.operatorMask ? "0x••••" : "0x…"}
              value={operatorPk}
              onChange={(e) => setOperatorPk(e.target.value)}
            />
          </div>
        </div>
        {infra?.chain?.operatorAddress ? (
          <p className="mt-2 font-mono text-xs text-muted">
            Signer {shortAddr(infra.chain.operatorAddress)} ·{" "}
            {infra.chain.operatorBalance
              ? `${Number(infra.chain.operatorBalance).toFixed(4)} ${config?.nativeSymbol ?? "xDAI"}`
              : "balance unknown"}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void withBusy(setBusy, async () => {
                const ping = await testChain({ data: { rpcUrl, chainId: Number(chainId) } });
                if (!ping.connected) throw new Error(ping.lastError || `RPC chain ID mismatch (configured ${chainId}, received ${ping.chainId}).`);
                toast.success(`RPC live · block ${ping.blockNumber}`);
                await load();
              })
            }
          >
            Ping RPC
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void withBusy(setBusy, async () => {
                const ping = await testChain({ data: { rpcUrl, chainId: Number(chainId) } });
                if (!ping.connected) throw new Error(ping.lastError || `RPC chain ID mismatch (configured ${chainId}, received ${ping.chainId}).`);
                setInfra(await saveInfra({ data: { rpcUrl, chainId: Number(chainId), chainName, nativeSymbol, explorerUrl, operatorPk: operatorPk.trim() || undefined } }));
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
          </Button>
          <Button
            variant="outline"
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
                toast.success(`New signer saved in the database. Fund this address with ${nativeSymbol || "the native token"} on ${chainName || "the selected network"}.`);
              })
            }
          >
            Generate signer
          </Button>
        </div>
        {rotatedAddr ? (
          <p className="mt-2 font-mono text-xs text-muted">
            New signer {rotatedAddr}. Previous key no longer signs. The private key stays in the database.
          </p>
        ) : null}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-xl font-bold tracking-tight text-fg">Testnet Faucet</h2>
          <ChainDialog {...chain} onClose={chain.close} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={infra?.chain?.devMode ? "sage" : "mist"}>
              {infra?.chain?.devMode ? "Dev Active" : "Native xDAI"}
            </Badge>
            {infra?.chain?.demoBank ? (
              <a
                className="font-mono text-xs text-primary underline"
                href={explorerAddress(infra.chain.demoBank, infra.chain.explorerUrl)}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddr(infra.chain.demoBank)}
              </a>
            ) : null}
          </div>
          <Button
            className="mt-4"
            disabled={busy || !infra?.setup?.signer}
            onClick={() =>
              void withBusy(setBusy, async () => {
                const enabling = !infra?.chain?.devMode;
                if (enabling && mainnet && !window.confirm("Deploy a DxDAI contract on live Gnosis mainnet and switch app payment flows to that token? This sends a real mainnet transaction.")) return;
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
                    return next?.chain?.devMode ? "A fresh 10,000 DxDAI bank is ready." : "The platform now uses native xDAI.";
                  },
                });
              })
            }
          >
            {infra?.chain?.devMode ? "Use native xDAI" : "Mint 10,000 DxDAI"}
          </Button>
        </Card>

        <Card className="p-5">
          <Label className="text-sm font-semibold">Resale Royalty (%)</Label>
          <div className="mt-3 flex gap-2">
            <Input value={bps} onChange={(e) => setBps(e.target.value)} />
            <Button
              onClick={async () => {
                try {
                  await saveRoyalty({ data: { bps: Math.round(Number(bps) * 100) } });
                  toast.success("Royalty updated");
                } catch (e) {
                  toast.error(friendlyChainError(e));
                }
              }}
            >
              Update
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
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
