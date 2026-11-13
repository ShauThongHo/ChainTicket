import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Info,
  Lock,
  MapPin,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
} from "lucide-react";
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
import { isInventoryRace } from "@/lib/chain-errors";
import { explorerAddress, explorerToken, explorerTx, gatewayUrl } from "@/lib/explorer";
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
  const [receipt, setReceipt] = useState<{
    collection: string | null;
    tokenId: string;
    tokenUri: string | null;
  } | null>(null);
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
        toast.error("Your KYC credential has expired. Please resubmit verification.");
      }
      navigate({ to: "/kyc", search: { next: `/events/${id}` } });
      return;
    }
    setBusy(tierId);
    const labels = [
      "Check price and stock",
      "Confirm payment in your wallet",
      "Wait for chain confirmation",
      "Save your ticket",
    ];
    setReceipt(null);
    try {
      await chain.run({
        title: "Your ticket pass is on its way",
        labels,
        doneLabel: "View in My Tickets",
        onDone: () => navigate({ to: "/my-tickets" }),
        retry: () => void buy(tierId),
        onError: (error) => {
          if (isInventoryRace(error)) {
            void fetchEvent({ data: { id } })
              .then(setEv)
              .catch(() => undefined);
          }
        },
        task: async (advance) => {
          const quote = await quoteBuy({ data: { tierId } });
          if (!quote.payNative) {
            if (quote.marketPull === false) {
              throw new Error(
                "This ticket window cannot take test coins. Ask an admin to toggle Dev mode and republish the event.",
              );
            }
            if (quote.dxdaiWei == null || BigInt(quote.dxdaiWei) < BigInt(quote.priceWei)) {
              throw new Error("Not enough test coins. Claim 100 DxDAI on the shows page, then try again.");
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
          setReceipt({
            collection: res.collectionAddress ?? null,
            tokenId: String(res.serial),
            tokenUri: res.tokenUri ?? null,
          });
          return `Ticket pass saved at ${formatAmount(res.priceCents, symbol)}.`;
        },
      });
    } finally {
      setBusy(null);
    }
  }

  function copyText(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  }

  if (!ev) {
    return (
      <AppShell>
        <div className="py-16 text-center">
          <div className="mx-auto size-12 rounded-xl shimmer-box mb-4" />
          <p className="font-mono text-sm text-muted">Retrieving event and ledger details…</p>
        </div>
      </AppShell>
    );
  }

  const stale = ev.engineVersion < 2;
  const closed = ev.phase !== "active";
  const startDate = new Date(ev.startsAt);
  const endDate = new Date(ev.endsAt);

  return (
    <AppShell>
      {/* TOP NAVIGATION BREADCRUMB */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Marketplace</span>
        </Link>
        <div className="flex items-center gap-2">
          {ev.category ? <Badge>{ev.category}</Badge> : null}
          <PhaseBadge phase={ev.phase} />
          {ev.frozen ? <Badge tone="danger">Trading Paused</Badge> : null}
        </div>
      </div>

      {/* EVENT SHOWCASE HERO BANNER */}
      <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-sm">
        <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden bg-mist">
          {ev.posterUrl ? (
            <img src={ev.posterUrl} alt={ev.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-muted">
              <Ticket className="size-16 stroke-[1.2] opacity-40 mb-2" />
              <span className="font-mono text-sm">No Poster Artwork Uploaded</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />

          {/* OVERLAY METADATA */}
          <div className="absolute bottom-6 left-6 right-6 text-paper">
            <span className="inline-block rounded bg-primary px-2.5 py-0.5 font-mono text-xs font-semibold text-primary-fg shadow-xs">
              {ev.category || "Live Event"}
            </span>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              {ev.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-mono text-paper/85">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-4 text-sage" />
                <span>{startDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <Clock className="size-4 text-sage" />
                <span>{startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – {endDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <MapPin className="size-4 text-sage" />
                <span>{ev.venue}</span>
              </div>
            </div>
          </div>
        </div>

        {/* DETAILS STRIP */}
        <div className="grid border-t border-border bg-mist/20 p-5 md:grid-cols-[1fr_auto] gap-4 items-center">
          <div>
            <p className="text-sm text-fg leading-relaxed max-w-2xl">{ev.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="font-semibold text-fg">
                Organized by {ev.organizerName ?? shortAddr(ev.organizerWallet)}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-primary">
                <ShieldCheck className="size-3.5" />
                Resale Creator Royalty: {(ev.royaltyBps / 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* BLOCKCHAIN AUDIT ACCORDION */}
          <details className="rounded-xl border border-border bg-bg-elevated p-3 text-xs">
            <summary className="cursor-pointer font-mono font-medium text-primary hover:underline">
              On-Chain Contract Contracts
            </summary>
            <div className="mt-3 space-y-2 font-mono text-[11px] text-muted">
              {ev.vaultAddress ? (
                <div className="flex items-center justify-between gap-3">
                  <span>Vault:</span>
                  <div className="flex items-center gap-1">
                    <a
                      href={explorerAddress(ev.vaultAddress, explorer)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {shortAddr(ev.vaultAddress)}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyText(ev.vaultAddress!, "Vault Address")}
                      className="text-muted hover:text-fg"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                </div>
              ) : null}

              {ev.marketplaceAddress ? (
                <div className="flex items-center justify-between gap-3">
                  <span>Market:</span>
                  <div className="flex items-center gap-1">
                    <a
                      href={explorerAddress(ev.marketplaceAddress, explorer)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {shortAddr(ev.marketplaceAddress)}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyText(ev.marketplaceAddress!, "Marketplace Address")}
                      className="text-muted hover:text-fg"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                </div>
              ) : null}

              {ev.collectionAddress ? (
                <div className="flex items-center justify-between gap-3">
                  <span>ERC-721:</span>
                  <div className="flex items-center gap-1">
                    <a
                      href={explorerAddress(ev.collectionAddress, explorer)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {shortAddr(ev.collectionAddress)}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyText(ev.collectionAddress!, "Collection Address")}
                      className="text-muted hover:text-fg"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        </div>
      </div>

      {/* SYSTEM WARNING NOTICES */}
      {stale ? (
        <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs text-danger flex items-center gap-2.5">
          <ShieldAlert className="size-4 shrink-0" />
          <span>This event was minted on an earlier contract version. Direct wallet purchase is disabled.</span>
        </div>
      ) : null}
      {ev.frozen ? (
        <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs text-danger flex items-center gap-2.5">
          <Lock className="size-4 shrink-0" />
          <span>Trading and primary issuance on this event are currently frozen by platform governance.</span>
        </div>
      ) : null}

      {/* TICKET PASSES SELECTION SECTION */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-fg">
            Admission Passes
          </h2>
          <span className="font-mono text-xs text-muted">
            {ev.tiers.length} Tier{ev.tiers.length > 1 ? "s" : ""}
          </span>
        </div>

        {/* TICKET TIERS GRID */}
        <div className="grid gap-4">
          {ev.tiers.map((tier) => {
            const isSoldOut = tier.available <= 0;
            const isLocked = busy !== null || isSoldOut || closed || stale || ev.frozen;

            return (
              <div
                key={tier.id}
                className="ticket-pass group grid overflow-hidden rounded-xl border border-border bg-bg-elevated transition-all md:grid-cols-[1fr_220px]"
              >
                {/* TIER INFORMATION */}
                <div className="p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-2xl font-bold italic tracking-tight text-fg">
                        {tier.name}
                      </h3>
                      {tier.available > 0 && tier.available <= 10 ? (
                        <Badge tone="danger" className="text-[10px] font-mono">
                          Only {tier.available} Left
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs font-mono">
                      {tier.available > 0 ? (
                        <span className="text-success font-semibold">{tier.available} remaining</span>
                      ) : (
                        <span className="text-danger font-semibold">Sold Out</span>
                      )}
                      {tier.minCents != null ? (
                        <>
                          <span className="text-muted">•</span>
                          <span className="text-muted">
                            Resale: {formatAmount(tier.minCents, symbol)}
                            {tier.maxCents != null && tier.maxCents !== tier.minCents
                              ? `–${formatAmount(tier.maxCents, symbol)}`
                              : ""}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* TEAR-OFF COUPON PURCHASE STUB */}
                <div className="relative flex flex-col justify-between border-t md:border-t-0 md:border-l border-dashed border-border bg-mist/25 p-6 text-center md:text-right">
                  {/* Decorative circular notch punches */}
                  <div className="hidden md:block absolute -left-2.5 -top-2.5 size-5 rounded-full bg-bg border border-border" />
                  <div className="hidden md:block absolute -left-2.5 -bottom-2.5 size-5 rounded-full bg-bg border border-border" />

                  <div>
                    <p className="font-mono text-2xl font-bold tabular-nums text-primary">
                      {formatAmount(tier.faceCents, symbol)}
                    </p>
                  </div>

                  <div className="mt-4">
                    <Button
                      variant={isSoldOut ? "outline" : "default"}
                      size="default"
                      className="w-full font-bold shadow-xs transition-transform active:scale-98"
                      disabled={isLocked}
                      onClick={() => void buy(tier.id)}
                    >
                      {busy === tier.id ? (
                        <span className="flex items-center gap-2">
                          <span className="size-3 rounded-full border-2 border-primary-fg border-t-transparent animate-spin" />
                          Processing…
                        </span>
                      ) : isSoldOut ? (
                        "Sold Out"
                      ) : !me ? (
                        "Connect to Buy"
                      ) : !me.kyc || me.kyc.status !== "approved" ? (
                        "KYC Required"
                      ) : (
                        "Buy Now →"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* THREE PROTOCOL PILLARS */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-elevated/60 px-4 py-3 text-xs text-muted">
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span>1-Wallet-1-Ticket Enforced</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-elevated/60 px-4 py-3 text-xs text-muted">
          <Sparkles className="size-4 text-sage shrink-0" />
          <span>90%~110% Resale Price Cap</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-elevated/60 px-4 py-3 text-xs text-muted">
          <QrCode className="size-4 text-primary shrink-0" />
          <span>Dynamic Anti-Screenshot QR</span>
        </div>
      </div>

      {/* CHAIN TRANSACTION PROGRESS MODAL */}
      <ChainDialog
        {...chain}
        onClose={chain.close}
        successDetails={
          receipt ? (
            <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-4 text-xs text-fg">
              <div className="flex items-center gap-2 text-success font-bold mb-2">
                <CheckCircle2 className="size-4" />
                <span>Ticket Minted and Vaulted Successfully!</span>
              </div>
              <div className="space-y-1 font-mono text-[11px] text-muted">
                {receipt.collection ? (
                  <div className="flex justify-between">
                    <span>ERC-721 Collection:</span>
                    <a
                      className="text-primary underline"
                      href={explorerAddress(receipt.collection, explorer)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddr(receipt.collection)}
                    </a>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span>Token Pass ID:</span>
                  <a
                    className="text-primary underline"
                    href={explorerToken(receipt.collection ?? "", receipt.tokenId, explorer)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    #{receipt.tokenId}
                  </a>
                </div>
                {receipt.tokenUri ? (
                  <div className="flex justify-between">
                    <span>Decentralized Metadata:</span>
                    <a
                      className="text-primary underline"
                      href={gatewayUrl(receipt.tokenUri, config?.ipfsGateway)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      IPFS Gateway ↗
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null
        }
      />
    </AppShell>
  );
}
