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
    setBps(String(data.royaltyBps / 100));
    setRpcUrl(data.chain.rpcUrl);
    setChainId(String(data.chain.chainId));
    setExplorerUrl(data.chain.explorerUrl);
    setChainName(data.chain.chainName);
    setNativeSymbol(data.chain.nativeSymbol);
    setAdminWallet(data.adminWallet);
    setKycAuto(data.kyc.autoApprove);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Platform</p>
          <h1 className="font-display text-4xl italic">Configuration</h1>
        </div>
        <Button variant="outline" onClick={() => void navigate({ to: "/admin" })}>
          Dashboard
        </Button>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-center gap-2"><h2 className="font-display text-2xl italic">Setup status</h2><Hint>Connect database, metadata storage, and signer. Protect the database because it stores the operator key. The public platform file contains only network and admin bootstrap settings.</Hint></div>
        <p className="mt-1 text-sm text-muted">
          Order: Database → Pinata → Signer → optional Dev mode. Secrets stay in the connected
          database only. <span className="font-mono">config/platform.json</span> is public bootstrap:
          admin wallet, RPC, chain id, explorer. Anyone who can read that database can read the hot
          operator key — lock the database network down in production.
        </p>
        <ol className="mt-4 grid gap-2 text-sm">
          <li className={step === 1 ? "text-fg" : setup?.database ? "text-success" : "text-muted"}>
            1. Database {setup?.database ? "· ready" : "· paste a Postgres URL"} — secrets live here
            after connect
          </li>
          <li className={step === 2 ? "text-fg" : setup?.pinata ? "text-success" : "text-muted"}>
            2. Pinata {setup?.pinata ? "· ready" : "· save a JWT for posters"}
          </li>
          <li className={step === 3 ? "text-fg" : setup?.signer ? "text-success" : "text-muted"}>
            3. Signer key {setup?.signer ? "· ready" : "· generate or paste"} — operator private key,
            database only
          </li>
          <li className="text-muted">4. Optional — Dev mode deploys a fresh DxDAI bank on Chiado</li>
        </ol>
        <ul className="mt-4 grid gap-1 text-xs text-muted">
          <li>Operator key, Pinata JWT and DATABASE_URL are rows in the database, never sent back in full.</li>
          <li>
            KYC keys (KYC_AES_KEY, KYC_HMAC_PEPPER) and DATABASE_URL_KYC stay on the server. If the
            key env vars are empty, one pair is generated into the database and never shown again.
          </li>
          <li>A gitignored local pointer stores only the database URL so preview can reconnect. It does not store keys.</li>
          <li>Generating a new signer replaces the old key. The new key is not shown again.</li>
        </ul>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="font-display text-2xl italic">KYC private database</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Public tables store only a random reference and status. Name, ID number and nationality are
          AES-256-GCM ciphertext. Set <span className="font-mono">DATABASE_URL_KYC</span> to a second
          Neon project, or paste it here (stored in the business database, not in a file). Leave it
          empty and ciphertext stays in this database’s <span className="font-mono">kyc_private</span>{" "}
          table. Anyone who can read the database that holds the AES key can decrypt — restrict that
          network in production.
        </p>
        {infra ? (
          <p className="mt-3 font-mono text-xs text-muted">
            Store {infra.kyc.privateSource} · {infra.kyc.privateHost} · keys {infra.kyc.keySource}
            {infra.kyc.autoApprove ? " · auto-approve" : " · admin review"}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="kyc-url">DATABASE_URL_KYC</Label>
            <Input
              id="kyc-url"
              type="password"
              autoComplete="off"
              placeholder={
                infra?.kyc.privateSource === "shared"
                  ? "Optional second Postgres URL"
                  : `Saved on ${infra?.kyc.privateHost ?? "server"} · paste to replace`
              }
              value={kycUrl}
              onChange={(e) => setKycUrl(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={kycAuto} disabled={mainnet} onChange={(e) => setKycAuto(e.target.checked)} />
            Auto-approve submissions (otherwise they stay pending). Disabled on Gnosis mainnet.
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                void withBusy(setBusy, async () => {
                  setInfra(
                    await saveInfra({
                      data: {
                        kycAutoApprove: kycAuto,
                        ...(kycUrl.trim() ? { databaseUrlKyc: kycUrl.trim() } : {}),
                      },
                    }),
                  );
                  setKycUrl("");
                  toast.success("KYC settings saved");
                })
              }
            >
              Save KYC settings
            </Button>
            <Button
              variant="outline"
              disabled={busy || infra?.kyc.privateSource === "env"}
              onClick={() =>
                void withBusy(setBusy, async () => {
                  setInfra(await saveInfra({ data: { clearDatabaseUrlKyc: true, kycAutoApprove: kycAuto } }));
                  setKycUrl("");
                  toast.success("Cleared saved private URL");
                })
              }
            >
              Clear saved URL
            </Button>
          </div>
          {infra?.kyc.privateSource === "env" ? (
            <p className="text-xs text-muted">DATABASE_URL_KYC is set in the server environment and wins over the saved URL.</p>
          ) : null}
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-2xl italic">Database</h2>
          <p className="mt-1 text-sm text-muted">
            Index of events and contract addresses. Preview uses embedded Postgres until you paste a
            Neon URL. Money is on-chain.
          </p>
          {infra?.db.error ? <p className="mt-2 text-sm text-danger">{infra.db.error}</p> : null}
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="db-url">DATABASE_URL</Label>
              <Input
                id="db-url"
                type="password"
                autoComplete="off"
                placeholder={infra?.db.masked || "postgres://user:pass@host/db"}
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
          <h2 className="font-display text-2xl italic">Pinata</h2>
          <p className="mt-1 text-sm text-muted">JWT is stored in the database. Event posters use the returned IPFS URL.</p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label>Pinata JWT</Label>
              <Input
                type="password"
                autoComplete="off"
                placeholder={
                  infra?.chain.pinataMask ? `Saved ${infra.chain.pinataMask} · paste to replace` : "eyJ…"
                }
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
          </div>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-2xl italic">Network & signer</h2>
        <p className="mt-1 text-sm text-muted">Active network: <strong>{infra?.chain.chainName || chainName}</strong> · chain ID {infra?.chain.chainId ?? chainId}. Each network needs its own deployment and database.</p>
        {mainnet ? <p className="mt-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">Gnosis mainnet is selected. Dev mode, test DxDAI, and KYC auto-approval are disabled.</p> : null}
        <p className="mt-1 text-sm text-muted">
          RPC and admin address are public. The operator private key is written only to the
          database after it is connected.
        </p>
        {infra?.chain.error || infra?.chain.lastError ? <p className="mt-2 text-sm text-danger">{infra?.chain.error || infra?.chain.lastError}</p> : null}
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
              placeholder={
                infra?.chain.operatorMask
                  ? `Saved ${infra.chain.operatorMask} · paste to replace`
                  : "0x…"
              }
              value={operatorPk}
              onChange={(e) => setOperatorPk(e.target.value)}
            />
          </div>
        </div>
        {infra?.chain.operatorAddress ? (
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
                  infra?.chain.operatorKeySet &&
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
                toast.success("New signer saved in the database. Fund this address with Chiado xDAI.");
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
          <h2 className="font-display text-2xl italic">Dev mode</h2>
          <p className="mt-1 text-sm text-muted">
            On: deploys a fresh DxDAI bank (10,000). Off: native xDAI. Toggle off then on to recast.
          </p>
          <ChainDialog {...chain} onClose={chain.close} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={infra?.chain.devMode ? "sage" : "mist"}>
              {infra?.chain.devMode ? "dev on" : "native coin"}
            </Badge>
            {infra?.chain.demoBank ? (
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
            disabled={busy || !infra?.setup.signer || mainnet}
            onClick={() =>
              void withBusy(setBusy, async () => {
                const enabling = !infra?.chain.devMode;
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
                    return next.chain.devMode ? "A fresh 10,000 DxDAI bank is ready." : "The platform now uses native xDAI.";
                  },
                });
              })
            }
          >
            {infra?.chain.devMode ? "Turn off · use native xDAI" : "Mint 10,000 DxDAI"}
          </Button>
        </Card>

        <Card className="p-5">
          <Label>Secondary royalty (%)</Label>
          <p className="mt-1 text-xs text-muted">Taken from the seller on every resale, into that event’s vault.</p>
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
