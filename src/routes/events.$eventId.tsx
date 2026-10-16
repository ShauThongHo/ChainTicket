import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PhaseBadge } from "@/components/phase-badge";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import artifacts from "@/lib/abi/core.json";
import { buyNow, fetchEvent, quoteBuy } from "@/lib/api";
import { friendlyChainError, isInventoryRace } from "@/lib/chain-errors";
import { explorerAddress, explorerTx, explorerToken, gatewayUrl } from "@/lib/explorer";
import type { EventDetail } from "@/lib/types";
import { formatAmount, paySymbol, shortAddr } from "@/lib/utils";

export const Route = createFileRoute("/events/$eventId")({ component: EventPage });

function EventPage() {
  const { eventId } = Route.useParams();
  const id = Number(eventId);
  const { me, refreshBalance, config, sendUserCall, requestConnect } = useSession();
  const navigate = useNavigate();
  const chain = useChainRun();
  const [ev, setEv] = useState<EventDetail | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<{ collection: string | null; tokenId: string; tokenUri: string | null } | null>(null);
  const symbol = paySymbol(config);
  const explorer = config?.explorerUrl ?? "";

  useEffect(() => {
    void fetchEvent({ data: { id } }).then(setEv);
  }, [id]);

  async function buy(tierId: number) {
    if (!me) {
      requestConnect();
      return;
    }
    if (!me.kyc || me.kyc.status !== "approved") {
      if (me.kyc?.status === "expired") {
        toast.error("This ID has expired. Submit KYC again.");
      }
      navigate({ to: "/kyc", search: { next: `/events/${id}` } });
      return;
    }
    setBusy(tierId);
    const labels = ["Check price and stock", "Confirm payment in your wallet", "Wait for chain confirmation", "Save your ticket"];
    setReceipt(null);
    try {
      await chain.run({
        title: "Your ticket is on its way",
        labels,
        doneLabel: "View my tickets",
        onDone: () => navigate({ to: "/my-tickets" }),
        retry: () => void buy(tierId),
        onError: (error) => {
          if (isInventoryRace(error)) void fetchEvent({ data: { id } }).then(setEv).catch(() => undefined);
        },
        task: async (advance) => {
          const quote = await quoteBuy({ data: { tierId } });
          if (!quote.payNative) {
            if (quote.marketPull === false) {
              throw new Error(
                "This ticket window cannot take test coins. Ask an admin to turn Dev mode off and on, then publish the show again.",
              );
            }
            if (quote.dxdaiWei == null || BigInt(quote.dxdaiWei) < BigInt(quote.priceWei)) {
              throw new Error("Not enough test coins. Claim them on the shows page, then try again.");
            }
          }
          advance(1);
          const hash = await sendUserCall(
            {
              to: quote.marketplace as `0x${string}`,
              abi: artifacts.EventMarketplace.abi,
              functionName: "buy",
              args: [BigInt(quote.chainId)],
              value: quote.payNative ? BigInt(quote.priceWei) : 0n,
            },
            { onSubmitted: () => advance(2) },
          );
          advance(3);
          const res = await buyNow({ data: { tierId, txHash: hash, chainId: quote.chainId } });
          await refreshBalance(true);
          setReceipt({ collection: res.collectionAddress ?? null, tokenId: String(res.serial), tokenUri: res.tokenUri ?? null });
          return `Ticket saved at ${formatAmount(res.priceCents, symbol)}.`;
        },
      });
    } finally {
      setBusy(null);
    }
  }

  if (!ev) {
    return (
      <AppShell>
        <p className="text-sm text-muted">Loading event…</p>
      </AppShell>
    );
  }

  const stale = ev.engineVersion < 2;
  const closed = ev.phase !== "active";

  return (
    <AppShell>
      {ev.posterUrl ? (
        <img src={ev.posterUrl} alt="" className="h-56 w-full rounded-xl object-cover md:h-72" />
      ) : (
        <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border text-sm text-muted">
          No poster
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge>{ev.category}</Badge>
        <PhaseBadge phase={ev.phase} />
        {ev.frozen ? <Badge tone="danger">Frozen</Badge> : null}
      </div>
      <h1 className="mt-3 font-display text-4xl italic">{ev.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {new Date(ev.startsAt).toLocaleString()} — {new Date(ev.endsAt).toLocaleString()}
        <br />
        {ev.venue}
      </p>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed">{ev.description}</p>
      <details className="mt-4 max-w-2xl text-xs text-muted">
        <summary className="cursor-pointer">Event details</summary>
        <p className="mt-2">Organized by {ev.organizerName ?? shortAddr(ev.organizerWallet)} · resale royalty {(ev.royaltyBps / 100).toFixed(1)}%</p>
        <p className="mt-2 break-all font-mono">
        {ev.vaultAddress ? (
          <a
            className="text-primary underline"
            href={explorerAddress(ev.vaultAddress, explorer)}
            target="_blank"
            rel="noreferrer"
          >
            vault {shortAddr(ev.vaultAddress)}
          </a>
        ) : null}
        {ev.marketplaceAddress ? (
          <>
            {" · "}
            <a
              className="text-primary underline"
              href={explorerAddress(ev.marketplaceAddress, explorer)}
              target="_blank"
              rel="noreferrer"
            >
              marketplace {shortAddr(ev.marketplaceAddress)}
            </a>
          </>
        ) : null}
        {ev.collectionAddress ? (
          <>
            {" · "}
            <a
              className="text-primary underline"
              href={explorerAddress(ev.collectionAddress, explorer)}
              target="_blank"
              rel="noreferrer"
            >
              collection {shortAddr(ev.collectionAddress)}
            </a>
          </>
        ) : null}
        {ev.deployTx ? (
          <>
            {" · "}
            <a
              className="text-muted underline"
              href={explorerTx(ev.deployTx, explorer)}
              target="_blank"
              rel="noreferrer"
            >
              deploy tx
            </a>
          </>
        ) : null}
        </p>
      </details>
      {stale ? (
        <p className="mt-3 text-sm text-danger">
          This event was minted on the old operator-signed contract. Ask the organizer to mint a new
          event so your wallet can send buy() itself.
        </p>
      ) : null}
      {ev.engineVersion >= 3 && !ev.collectionAddress ? (
        <p className="mt-3 text-sm text-danger">
          This show has no ERC-721 collection. Ask the organizer to mint a new event.
        </p>
      ) : null}
      {ev.frozen ? (
        <p className="mt-3 text-sm text-danger">Trading is frozen by the platform admin.</p>
      ) : null}
      <ChainDialog {...chain} onClose={chain.close} successDetails={receipt ? (
        <div className="mt-3 grid gap-1 text-xs text-muted">
          {receipt.collection ? <a className="text-primary underline" href={explorerAddress(receipt.collection, explorer)} target="_blank" rel="noreferrer">Collection {shortAddr(receipt.collection)}</a> : null}
          {receipt.collection ? <a className="text-primary underline" href={explorerToken(receipt.collection, receipt.tokenId, explorer)} target="_blank" rel="noreferrer">Token #{receipt.tokenId} in explorer</a> : null}
          {receipt.tokenUri ? <a className="text-primary underline" href={gatewayUrl(receipt.tokenUri)} target="_blank" rel="noreferrer">Open ticket details</a> : null}
          <span>Explorer images can take time to appear. Open the details to check the JSON and image.</span>
        </div>
      ) : null} />

      <div className="mt-8 grid gap-4">
        {ev.tiers.map((tier) => (
          <Card key={tier.id} className="stub p-5 pl-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl italic">{tier.name}</h2>
                <details className="mt-1 text-xs text-muted"><summary className="cursor-pointer">Ticket details</summary><span className="mt-1 block break-all font-mono">{tier.contractAddress}</span></details>
            <p className="mt-2 text-sm text-muted">{tier.available} available · {formatAmount(tier.faceCents, symbol)}</p>
                <p className="mt-1 font-mono text-sm tabular-nums">
                  {tier.minCents != null && tier.maxCents != null
                    ? tier.minCents === tier.maxCents
                      ? `Pool ${formatAmount(tier.minCents, symbol)}`
                      : `Pool ${formatAmount(tier.minCents, symbol)} – ${formatAmount(tier.maxCents, symbol)}`
                    : "No live listings"}
                </p>
              </div>
              <Button
                disabled={busy !== null || !tier.available || closed || stale || ev.frozen}
                onClick={() => void buy(tier.id)}
              >
                {busy === tier.id ? "Sending…" : "Buy now"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        KYC approval is required to buy. Need test coins? Claim them on the shows page.{" "}
        <Link to="/kyc" className="underline">
          Open KYC
        </Link>
      </p>
    </AppShell>
  );
}
