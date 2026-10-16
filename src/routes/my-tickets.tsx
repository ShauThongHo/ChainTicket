import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
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
import { formatAmount, paySymbol, priceBounds } from "@/lib/utils";

export const Route = createFileRoute("/my-tickets")({ component: MyTicketsPage });

function MyTicketsPage() {
  const { me, config } = useSession();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const symbol = paySymbol(config);

  async function reload() {
    const rows = await fetchMyTickets();
    setTickets(rows);
  }

  useEffect(() => {
    if (me) void reload();
  }, [me]);

  const upcoming = tickets.filter((t) => t.status === "owned" || t.status === "listed").length;

  if (!me) {
    return (
      <AppShell>
        <p className="text-sm text-muted">
          <Link to="/" className="underline">
            Connect a wallet
          </Link>{" "}
          to see your collection.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="font-display text-4xl">Your tickets</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Held" value={String(tickets.length)} />
        <Stat label="Live / listed" value={String(upcoming)} />
        <Stat label="Balance" value={formatAmount(me.spendableCents, symbol)} />
      </div>
      <div className="mt-8 grid gap-4">
        {tickets.length === 0 ? (
          <p className="text-sm text-muted">
            No tickets yet.{" "}
            <Link to="/marketplace" className="underline">
              Open the marketplace
            </Link>
          </p>
        ) : (
          tickets.map((t) => <TicketCard key={t.id} ticket={t} onChange={() => void reload()} />)
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums">{value}</p>
    </Card>
  );
}

function TicketCard({ ticket, onChange }: { ticket: MyTicket; onChange: () => void }) {
  const { sendUserCall, config } = useSession();
  const bounds = priceBounds(ticket.faceCents);
  const [price, setPrice] = useState(((bounds.min + bounds.max) / 2 / 100).toFixed(2));
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [art, setArt] = useState(ticket.posterUrl || "");
  const [busy, setBusy] = useState(false);
  const chain = useChainRun();
  const symbol = paySymbol(config);
  const live = ticket.phase === "active";
  const explorer = config?.explorerUrl ?? "";
  const market = ticket.marketplaceAddress || "";

  useEffect(() => {
    if (!ticket.tokenUri) return;
    let stop = false;
    fetch(gatewayUrl(ticket.tokenUri))
      .then((r) => r.json())
      .then((json: { image?: string }) => {
        if (stop || typeof json.image !== "string" || !json.image) return;
        setArt(gatewayUrl(json.image));
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [ticket.tokenUri]);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const data = await fetchQr({ data: { ticketId: ticket.id } });
        if (stop) return;
        setQr(data);
        if (data.payload) {
          setImg(await QRCode.toDataURL(data.payload, { margin: 1, width: 280 }));
        } else setImg(null);
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
      toast.error("Ticket is not on-chain.");
      return;
    }
    const cents = Math.round(Number(price) * 100);
    const labels = ["Check ticket price", "Confirm listing in your wallet", "Save your listing"];
    setBusy(true);
    try {
      await chain.run({ title: "List your ticket", labels, task: async (advance) => {
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
        return "Your ticket is now listed for sale.";
      }, retry: () => void list() });
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
      await chain.run({ title: "Remove your ticket listing", labels, task: async (advance) => {
        const hash = await sendUserCall({ to: market as `0x${string}`, abi: artifacts.EventMarketplace.abi, functionName: "delist", args: [BigInt(ticket.chainId!)] });
        advance(1);
        await cancelListing({ data: { ticketId: ticket.id, txHash: hash } });
        onChange();
        return "Your ticket is back in your wallet.";
      }, retry: () => void delist() });
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
    const labels = [opposing ? "Confirm your objection in your wallet" : "Confirm your support vote in your wallet", "Record your vote"];
    try {
      await chain.run({ title: opposing ? "Object to the payout" : "Vote on the payout", labels, task: async (advance) => {
        const hash = await sendUserCall({ to: market as `0x${string}`, abi: artifacts.EventMarketplace.abi, functionName: "vote", args: [BigInt(ticket.chainId!)] });
        advance(1);
        await confirmVote({ data: { ticketId: ticket.id, txHash: hash } });
        onChange();
        return opposing ? "Your objection was recorded for this ticket." : "Your support vote was recorded.";
      }, retry: () => void vote() });
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

  return (
    <Card className="stub grid overflow-hidden pl-4 md:grid-cols-[220px_1fr]">
      <div className="flex flex-col items-center gap-3 bg-mist p-5">
        {art ? (
          <img src={art} alt="" className="h-44 w-full rounded-md object-cover" />
        ) : (
          <div className="grid h-44 w-full place-items-center rounded-md border border-dashed border-border text-xs text-muted">
            NFT art
          </div>
        )}
        {img ? (
          <img src={img} alt="Dynamic gate QR" className="size-28 rounded-md bg-paper p-2" />
        ) : (
          <div className="grid w-full place-items-center rounded-md border border-dashed border-border bg-paper p-3 text-center text-xs text-muted">
            {qr?.reason ?? "QR locked until 2 hours before doors"}
            {unlockLabel ? <span className="mt-2 block font-mono">{unlockLabel}</span> : null}
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          <PhaseBadge phase={ticket.phase} />
          <Badge tone={ticket.status === "used" ? "ink" : "sage"}>{ticket.status}</Badge>
          <Badge>{ticket.tierName}</Badge>
        </div>
        <h2 className="mt-2 font-display text-2xl italic">{ticket.eventName}</h2>
        <p className="mt-1 text-sm text-muted">
          {ticket.venue} · {new Date(ticket.startsAt).toLocaleString()}
        </p>
        <p className="mt-2 font-mono text-xs text-muted">
          NFT #{ticket.chainId ?? "—"} · face {formatAmount(ticket.faceCents, symbol)}
        </p>
        <p className="mt-1 font-mono text-xs text-muted">
          {ticket.collectionAddress && ticket.chainId ? (
            <a
              className="text-primary underline"
              href={explorerToken(ticket.collectionAddress, ticket.chainId, explorer)}
              target="_blank"
              rel="noreferrer"
            >
              collection {ticket.collectionAddress.slice(0, 8)}…
            </a>
          ) : (
            <span>{ticket.tokenId}</span>
          )}
          {ticket.tokenUri ? (
            <>
              {" · "}
              <a className="text-primary underline" href={gatewayUrl(ticket.tokenUri)} target="_blank" rel="noreferrer">
                Open ticket details
              </a>
            </>
          ) : null}
        </p>
        {ticket.proposal ? (
          <p className="mt-2 text-sm text-muted">
            {ticket.engineVersion >= 4 ? "Payout objections" : "Payout support votes"} {ticket.proposal.yesWeight}/{ticket.proposal.soldWeight}
            {ticket.proposal.hasVoted ? " · you voted" : ""} · {ticket.proposal.status.replace("_", " ")}
          </p>
        ) : null}
        <ChainDialog {...chain} onClose={chain.close} />
        {live && (ticket.status === "owned" || ticket.status === "listed") ? (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <p className="text-xs text-muted">
                Resale {formatAmount(bounds.min, symbol)} – {formatAmount(bounds.max, symbol)}
              </p>
              <Input
                className="mt-1 w-36"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            {ticket.status === "listed" ? (
              <Button variant="outline" disabled={busy} onClick={() => void delist()}>
                {busy ? "Sending…" : `Delist ${ticket.listPriceCents ? formatAmount(ticket.listPriceCents, symbol) : ""}`}
              </Button>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => void list()}>
                {busy ? "Sending…" : "List in pool"}
              </Button>
            )}
          </div>
        ) : null}
        {canVote ? (
          <Button className="mt-4" disabled={busy} onClick={() => void vote()}>
            {busy ? "Sending…" : "Vote to release vault"}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
