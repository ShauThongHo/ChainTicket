import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  MapPin,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Ticket,
  Vote,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PhaseBadge } from "@/components/phase-badge";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import artifacts from "@/lib/abi/core.json";
import { cancelListing, confirmVote, fetchMyTickets, fetchQr, quoteList, sellTicket } from "@/lib/api";
import { friendlyChainError } from "@/lib/chain-errors";
import { explorerToken, gatewayUrl } from "@/lib/explorer";
import type { MyTicket, QrPayload } from "@/lib/types";
import { formatAmount, paySymbol, priceBounds, shortAddr } from "@/lib/utils";

export const Route = createFileRoute("/my-tickets")({ component: MyTicketsPage });

function MyTicketsPage() {
  const { me, config } = useSession();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "listed" | "past">("all");
  const symbol = paySymbol(config);

  async function reload() {
    const rows = await fetchMyTickets();
    setTickets(rows);
  }

  useEffect(() => {
    if (me) void reload();
  }, [me]);

  useEffect(() => {
    if (!me) return;
    const id = setInterval(() => void reload(), 5000);
    return () => clearInterval(id);
  }, [me]);

  const upcomingCount = tickets.filter((t) => t.status === "owned" && t.phase === "active").length;
  const listedCount = tickets.filter((t) => t.status === "listed").length;
  const usedCount = tickets.filter((t) => t.status === "used" || t.status === "refunded" || t.phase === "ended").length;

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (activeTab === "active") return t.status === "owned" && t.phase === "active";
      if (activeTab === "listed") return t.status === "listed";
      if (activeTab === "past") return t.status === "used" || t.status === "refunded" || t.phase === "ended";
      return true;
    });
  }, [tickets, activeTab]);

  if (!me) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-dashed border-border bg-bg-elevated p-12 text-center my-8">
          <Wallet className="size-12 text-muted mx-auto mb-3 stroke-[1.2]" />
          <h2 className="font-display text-2xl font-bold">Connect Your Wallet</h2>
          <p className="mt-1 text-sm text-muted max-w-sm mx-auto">
            Connect your Web3 wallet to access your encrypted digital ticket vault and dynamic gate passes.
          </p>
          <div className="mt-5">
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg shadow-xs"
            >
              Browse Shows →
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* DIGITAL PASSBOOK HEADER */}
      <div className="mb-8 border-b border-border pb-6">
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-fg">
          Ticket Vault
        </h1>

        {/* STATS OVERVIEW CARDS */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Passes"
            value={String(tickets.length)}
            icon={<Ticket className="size-4 text-primary" />}
          />
          <StatCard
            label="Ready for Entry"
            value={String(upcomingCount)}
            icon={<QrCode className="size-4 text-success" />}
          />
          <StatCard
            label="Listed for Resale"
            value={String(listedCount)}
            icon={<Tag className="size-4 text-sage" />}
          />
          <StatCard
            label="Spendable Balance"
            value={formatAmount(me.spendableCents, symbol)}
            icon={<Wallet className="size-4 text-primary" />}
          />
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-elevated p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-md px-3.5 py-1.5 font-medium transition-colors ${
              activeTab === "all" ? "bg-primary text-primary-fg shadow-2xs font-semibold" : "text-muted hover:text-fg"
            }`}
          >
            All Passes ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`rounded-md px-3.5 py-1.5 font-medium transition-colors ${
              activeTab === "active" ? "bg-primary text-primary-fg shadow-2xs font-semibold" : "text-muted hover:text-fg"
            }`}
          >
            Entry Ready ({upcomingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("listed")}
            className={`rounded-md px-3.5 py-1.5 font-medium transition-colors ${
              activeTab === "listed" ? "bg-primary text-primary-fg shadow-2xs font-semibold" : "text-muted hover:text-fg"
            }`}
          >
            Listed ({listedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("past")}
            className={`rounded-md px-3.5 py-1.5 font-medium transition-colors ${
              activeTab === "past" ? "bg-primary text-primary-fg shadow-2xs font-semibold" : "text-muted hover:text-fg"
            }`}
          >
            History ({usedCount})
          </button>
        </div>

        <Link
          to="/marketplace"
          className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
        >
          <span>Find more shows</span>
          <span>→</span>
        </Link>
      </div>

      {/* TICKET PASS LISTINGS */}
      <div className="grid gap-6">
        {filteredTickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-bg-elevated p-12 text-center">
            <Ticket className="size-10 text-muted mx-auto mb-3 stroke-[1.5]" />
            <h3 className="font-display text-xl font-bold">No tickets in this section</h3>
            <p className="mt-1 text-sm text-muted max-w-sm mx-auto">
              {activeTab === "all"
                ? "You have not purchased any event tickets yet."
                : `You currently have no tickets matching the "${activeTab}" filter.`}
            </p>
            {activeTab === "all" ? (
              <Button asChild size="sm" className="mt-4">
                <Link to="/marketplace">Explore Shows</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setActiveTab("all")}
              >
                Show All Passes
              </Button>
            )}
          </div>
        ) : (
          filteredTickets.map((t) => (
            <TicketPassCard key={t.id} ticket={t} onChange={() => void reload()} />
          ))
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-4 bg-bg-elevated border-border flex flex-col justify-between">
      <div className="flex items-center justify-between text-muted">
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="mt-2">
        <p className="font-mono text-2xl font-bold tabular-nums text-fg">{value}</p>
        {sub ? <span className="text-[11px] font-mono text-muted">{sub}</span> : null}
      </div>
    </Card>
  );
}

function TicketPassCard({ ticket, onChange }: { ticket: MyTicket; onChange: () => void }) {
  const { sendUserCall, config } = useSession();
  const bounds = priceBounds(ticket.faceCents);
  const [price, setPrice] = useState(((bounds.min + bounds.max) / 2 / 100).toFixed(2));
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [art, setArt] = useState(ticket.posterUrl || "");
  const [busy, setBusy] = useState(false);
  const [showResaleDrawer, setShowResaleDrawer] = useState(false);
  const chain = useChainRun();
  const symbol = paySymbol(config);
  const live = ticket.phase === "active";
  const explorer = config?.explorerUrl ?? "";
  const market = ticket.marketplaceAddress || "";

  useEffect(() => {
    if (!ticket.tokenUri) return;
    let stop = false;
    fetch(gatewayUrl(ticket.tokenUri, config?.ipfsGateway))
      .then((r) => r.json())
      .then((json: { image?: string }) => {
        if (stop || typeof json.image !== "string" || !json.image) return;
        setArt(gatewayUrl(json.image, config?.ipfsGateway));
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [ticket.tokenUri, config?.ipfsGateway]);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const data = await fetchQr({ data: { ticketId: ticket.id } });
        if (stop) return;
        setQr(data);
        if (data.payload) {
          setImg(await QRCode.toDataURL(data.payload, { margin: 1, width: 280 }));
        } else {
          setImg(null);
        }
      } catch {
        if (!stop) setQr(null);
      }
    }
    void tick();
    const id = setInterval(() => void tick(), 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [ticket.id, ticket.status]);

  const unlockLabel = useMemo(() => {
    if (!qr?.unlocksAt) return null;
    const ms = new Date(qr.unlocksAt).getTime() - Date.now();
    if (ms <= 0) return "Unlocked";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `Unlocks in ${h}h ${m}m`;
  }, [qr]);

  async function list() {
    if (!ticket.chainId) {
      toast.error("Ticket is not confirmed on-chain.");
      return;
    }
    const cents = Math.round(Number(price) * 100);
    if (cents < bounds.min || cents > bounds.max) {
      toast.error(
        `Price must be within 90%~110% bound: ${formatAmount(bounds.min, symbol)} – ${formatAmount(bounds.max, symbol)}`,
      );
      return;
    }
    const labels = ["Check ticket price", "Confirm listing in your wallet", "Save your listing"];
    setBusy(true);
    try {
      await chain.run({
        title: "List ticket on secondary market",
        labels,
        task: async (advance) => {
          const quote = await quoteList({ data: { ticketId: ticket.id, priceCents: cents } });
          if (!quote.marketplace) throw new Error("No marketplace contract.");
          advance(1);
          const hash = await sendUserCall({
            to: quote.marketplace as `0x${string}`,
            abi: artifacts.EventMarketplace.abi,
            functionName: "list",
            args: [BigInt(quote.chainId), BigInt(quote.priceWei)],
          });
          advance(2);
          await sellTicket({ data: { ticketId: ticket.id, priceCents: cents, txHash: hash } });
          onChange();
          setShowResaleDrawer(false);
          return "Your ticket is now listed for resale.";
        },
        retry: () => void list(),
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    } finally {
      setBusy(false);
    }
  }

  async function delist() {
    if (!ticket.chainId || !market) return;
    setBusy(true);
    const labels = ["Confirm cancellation in your wallet", "Save the update"];
    try {
      await chain.run({
        title: "Remove your ticket listing",
        labels,
        task: async (advance) => {
          const hash = await sendUserCall({
            to: market as `0x${string}`,
            abi: artifacts.EventMarketplace.abi,
            functionName: "delist",
            args: [BigInt(ticket.chainId!)],
          });
          advance(1);
          await cancelListing({ data: { ticketId: ticket.id, txHash: hash } });
          onChange();
          return "Your ticket is back in your wallet as an active pass.";
        },
        retry: () => void delist(),
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    } finally {
      setBusy(false);
    }
  }

  async function vote() {
    if (!ticket.chainId || !market) {
      toast.error("This ticket has no marketplace vote.");
      return;
    }
    setBusy(true);
    const opposing = ticket.engineVersion >= 4;
    const labels = [
      opposing ? "Confirm your objection in your wallet" : "Confirm your support vote in your wallet",
      "Record your vote",
    ];
    try {
      await chain.run({
        title: opposing ? "Object to organizer payout" : "Vote on organizer payout",
        labels,
        task: async (advance) => {
          const hash = await sendUserCall({
            to: market as `0x${string}`,
            abi: artifacts.EventMarketplace.abi,
            functionName: "vote",
            args: [BigInt(ticket.chainId!)],
          });
          advance(1);
          await confirmVote({ data: { ticketId: ticket.id, txHash: hash } });
          onChange();
          return opposing
            ? "Your objection was recorded for this ticket."
            : "Your support vote was recorded.";
        },
        retry: () => void vote(),
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    } finally {
      setBusy(false);
    }
  }

  const canVote =
    ticket.proposal?.status === "pending_vote" &&
    !ticket.proposal.hasVoted &&
    (ticket.status === "owned" || ticket.status === "listed" || ticket.status === "used");

  const isListed = ticket.status === "listed";
  const isUsed = ticket.status === "used";

  return (
    <div className="ticket-pass overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-sm transition-all md:grid md:grid-cols-[280px_1fr]">
      {/* LEFT COLUMN: DYNAMIC GATE ACCESS HUB */}
      <div className="relative flex flex-col justify-between border-b md:border-b-0 md:border-r border-border bg-gradient-to-b from-mist/50 to-bg-elevated p-6 text-center">
        <div>
          {/* NFT ARTWORK CARD */}
          <div className="relative h-44 w-full overflow-hidden rounded-xl border border-border bg-bg shadow-2xs mb-4">
            {art ? (
              <img src={art} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-xs font-mono text-muted">
                <Ticket className="size-8 opacity-40 mb-1" />
                <span>Vaulted Pass Art</span>
              </div>
            )}
            <div className="absolute right-2 top-2 rounded bg-ink/80 px-2 py-0.5 font-mono text-[10px] text-paper">
              NFT #{ticket.chainId ?? "—"}
            </div>
          </div>

          {/* DYNAMIC QR CODE CONTAINER */}
          {img && !isListed ? (
            <div className="relative mx-auto size-48 rounded-xl border-2 border-primary/40 bg-paper p-3 shadow-md">
              <div className="scan-laser-line" />
              <img src={img} alt="Dynamic gate QR" className="size-full object-contain" />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-mono font-bold text-primary-fg shadow-xs">
                ROTATING CODE
              </div>
            </div>
          ) : isListed ? (
            <div className="rounded-xl border border-dashed border-sage/60 bg-sage/5 p-5 text-center">
              <Tag className="size-8 text-sage mx-auto mb-2" />
              <p className="font-semibold text-xs text-fg">Listed for Resale</p>
              <p className="text-[11px] text-muted mt-1">
                Entry barcode is locked while this pass is listed in the secondary pool.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-bg/60 p-5 text-center">
              <Lock className="size-8 text-muted mx-auto mb-2" />
              <p className="text-xs font-semibold text-fg">Gate Pass Locked</p>
              <p className="text-[11px] text-muted mt-1">
                {qr?.reason ?? "Unlocks automatically 2 hours before showtime to prevent scalper screenshots."}
              </p>
              {unlockLabel ? (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-mist/60 px-3 py-1 font-mono text-[11px] text-primary">
                  <Clock className="size-3" />
                  <span>{unlockLabel}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* SECURITY REMINDER */}
        <div className="mt-4 pt-3 border-t border-border/40 font-mono text-[10px] text-muted">
          <span>HMAC-SHA256 Encrypted Verification</span>
        </div>
      </div>

      {/* RIGHT COLUMN: PASS METADATA & OPERATIONS */}
      <div className="p-6 md:p-8 flex flex-col justify-between">
        <div>
          {/* HEADER BADGES */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <PhaseBadge phase={ticket.phase} />
              <Badge
                tone={
                  ticket.status === "used"
                    ? "ink"
                    : ticket.status === "listed"
                      ? "sage"
                      : ticket.status === "refunded"
                        ? "danger"
                        : "sage"
                }
                className="font-mono text-xs uppercase"
              >
                {ticket.status}
              </Badge>
              <Badge>{ticket.tierName}</Badge>
            </div>

            <div className="font-mono text-xs text-muted">
              Face: <strong className="text-fg">{formatAmount(ticket.faceCents, symbol)}</strong>
            </div>
          </div>

          {/* EVENT TITLE & LOGISTICS */}
          <h2 className="mt-3 font-display text-2xl sm:text-3xl font-bold tracking-tight text-fg">
            {ticket.eventName}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-mono text-muted">
            <div className="flex items-center gap-1.5 text-primary">
              <Calendar className="size-3.5" />
              <span>{new Date(ticket.startsAt).toLocaleString()}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              <span>{ticket.venue}</span>
            </div>
          </div>

          {/* TOKEN & CONTRACT REFERENCE */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-mono text-muted">
            {ticket.collectionAddress && ticket.chainId ? (
              <a
                className="inline-flex items-center gap-1 text-primary hover:underline"
                href={explorerToken(ticket.collectionAddress, ticket.chainId, explorer)}
                target="_blank"
                rel="noreferrer"
              >
                <span>Token #{ticket.chainId}</span>
                <ExternalLink className="size-3" />
              </a>
            ) : null}
            {ticket.tokenUri ? (
              <a
                className="inline-flex items-center gap-1 text-primary hover:underline"
                href={gatewayUrl(ticket.tokenUri, config?.ipfsGateway)}
                target="_blank"
                rel="noreferrer"
              >
                <span>Decentralized Metadata</span>
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>

          {/* GOVERNANCE PROPOSAL NOTICE */}
          {ticket.proposal ? (
            <div className="mt-5 rounded-xl border border-sage/40 bg-sage/5 p-4 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-fg">
                  <Vote className="size-4 text-sage" />
                  <span>
                    Organizer Payout Proposal ({ticket.proposal.status.replace("_", " ")})
                  </span>
                </div>
                {ticket.proposal.hasVoted ? (
                  <span className="rounded bg-success/20 px-2 py-0.5 font-mono text-[10px] font-bold text-success">
                    VOTED
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-muted text-[11px]">
                {ticket.engineVersion >= 4 ? "Objections recorded:" : "Support votes:"}{" "}
                <strong className="font-mono text-fg">{ticket.proposal.yesWeight} / {ticket.proposal.soldWeight}</strong>{" "}
                tickets (1/3 threshold triggers governance freeze).
              </p>
              {canVote ? (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void vote()}
                    className="font-bold border-sage/50 text-sage hover:bg-sage/10"
                  >
                    {busy ? "Broadcasting…" : "Submit Objection Vote"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* BOTTOM ACTION REGION */}
        <div className="mt-8 pt-5 border-t border-border/60">
          <ChainDialog {...chain} onClose={chain.close} />

          {/* WHEN LISTED: CANCEL LISTING */}
          {live && ticket.status === "listed" ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sage/30 bg-sage/5 p-4">
              <p className="text-sm font-semibold text-fg">
                Listed at {ticket.listPriceCents ? formatAmount(ticket.listPriceCents, symbol) : ""}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void delist()}
                className="border-border hover:bg-mist shadow-xs"
              >
                {busy ? "Processing…" : "Delist Pass"}
              </Button>
            </div>
          ) : null}

          {/* WHEN OWNED: SECONDARY RESALE DRAWER */}
          {live && ticket.status === "owned" && !showResaleDrawer ? (
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted font-mono">
                Secondary Cap: {formatAmount(bounds.min, symbol)} – {formatAmount(bounds.max, symbol)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResaleDrawer(true)}
                className="gap-1.5"
              >
                <Tag className="size-3.5" />
                <span>Resell Pass</span>
              </Button>
            </div>
          ) : null}

          {live && ticket.status === "owned" && showResaleDrawer ? (
            <div className="rounded-xl border border-border bg-mist/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-fg">
                  Secondary Listing (90%~110% Cap)
                </span>
                <button
                  type="button"
                  onClick={() => setShowResaleDrawer(false)}
                  className="text-xs text-muted hover:text-fg font-mono"
                >
                  Cancel
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Input
                    className="w-36 font-mono font-bold bg-bg-elevated"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">
                    {symbol}
                  </span>
                </div>

                {/* PRESET BOUND BUTTONS */}
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setPrice((bounds.min / 100).toFixed(2))}
                    className="rounded border border-border bg-bg-elevated px-2 py-1 text-muted hover:text-fg"
                  >
                    -10%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrice((ticket.faceCents / 100).toFixed(2))}
                    className="rounded border border-border bg-bg-elevated px-2 py-1 text-muted hover:text-fg"
                  >
                    Face
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrice((bounds.max / 100).toFixed(2))}
                    className="rounded border border-border bg-bg-elevated px-2 py-1 text-muted hover:text-fg"
                  >
                    +10%
                  </button>
                </div>

                <Button
                  variant="default"
                  size="sm"
                  disabled={busy}
                  onClick={() => void list()}
                  className="font-bold ml-auto shadow-xs"
                >
                  {busy ? "Broadcasting…" : "List Pass"}
                </Button>
              </div>
            </div>
          ) : null}

          {isUsed ? (
            <div className="rounded-xl border border-border bg-mist/20 p-3 text-xs text-muted flex items-center gap-2">
              <CheckCircle2 className="size-4 text-muted" />
              <span>This ticket has already been verified and checked in at the event venue.</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
