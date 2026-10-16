import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { fetchEvents, prepareBuyer } from "@/lib/api";
import { friendlyChainError } from "@/lib/chain-errors";
import type { EventListItem } from "@/lib/types";
import { formatAmount, paySymbol } from "@/lib/utils";

export const Route = createFileRoute("/marketplace")({ component: MarketplacePage });

function MarketplacePage() {
  const { me, config, sendUserCall, refreshBalance } = useSession();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const chain = useChainRun();
  const symbol = paySymbol(config);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      void fetchEvents({ data: { q } })
        .then((rows) => {
          if (live) setItems(rows);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, me?.address]);

  async function claim() {
    if (!config?.demoBank) {
      toast.error("Dev mode is off.");
      return;
    }
    setClaiming(true);
    try {
      await chain.run({
        title: "Claim test coins",
        labels: ["Check claim availability", "Confirm in your wallet", "Add coins to your balance"],
        doneLabel: "Close",
        task: async (advance) => {
          const prep = await prepareBuyer();
          if (prep.demo?.dripped) {
            await refreshBalance(true);
            return `You already claimed ${formatAmount(prep.demo.cents, "DxDAI")}.`;
          }
          advance(1);
          await sendUserCall({
            to: config.demoBank as `0x${string}`,
            abi: artifacts.DemoBank.abi,
            functionName: "claim",
            args: [],
          });
          advance(2);
          await refreshBalance(true);
          return "100 DxDAI was added to your wallet.";
        },
        retry: () => void claim(),
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    } finally {
      setClaiming(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-8 border-b border-border pb-6">
        <p className="text-sm text-muted">{config?.chainName ?? "Chiado"} · Find your next night out</p>
        <h1 className="mt-2 font-display text-5xl tracking-tight">Shows worth showing up for.</h1>
        <p className="mt-3 max-w-xl text-sm text-muted">Browse live events. Your ticket lives in your wallet.</p>
      </div>

      {me && config?.devMode ? (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted">
            Need test coins for a ticket? Claim 100 DxDAI here. A little xDAI covers network fees.
          </p>
          <Button variant="outline" disabled={claiming} onClick={() => void claim()}>
            {claiming ? "Claiming…" : "Claim 100 DxDAI"}
          </Button>
        </Card>
      ) : null}
      <ChainDialog {...chain} onClose={chain.close} />

      <div className="mt-6">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search shows or places"
        />
      </div>
      <div className="mt-6 grid gap-4">
        {loading && !items.length ? (
          <p className="text-sm text-muted">Loading the ledger…</p>
        ) : null}
        {!loading && items.length === 0 ? (
          <p className="text-sm text-muted">
            No shows are on sale right now.
          </p>
        ) : null}
        {items.map((ev) => (
          <EventRow key={ev.id} ev={ev} symbol={symbol} />
        ))}
      </div>
    </AppShell>
  );
}

function EventRow({ ev, symbol }: { ev: EventListItem; symbol: string }) {
  const soldOut = ev.available === 0;
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: String(ev.id) }}
      className="stub grid overflow-hidden rounded-r-xl border border-border bg-bg-elevated transition-colors hover:border-primary/50 md:grid-cols-[220px_1fr]"
    >
      {ev.posterUrl ? (
        <img src={ev.posterUrl} alt="" className="h-40 w-full object-cover md:h-full" />
      ) : (
        <div className="grid h-40 place-items-center bg-mist text-xs text-muted md:h-full">No poster</div>
      )}
      <div className="flex flex-col justify-between p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{ev.category}</Badge>
            <PhaseBadge phase={ev.phase} />
            {ev.frozen ? <Badge tone="danger">Paused</Badge> : null}
            {ev.engineVersion < 2 ? <Badge tone="danger">Tickets need update</Badge> : null}
            {soldOut && ev.phase === "active" ? <Badge tone="danger">Sold out</Badge> : null}
            {!soldOut && ev.sold > 0 && ev.phase === "active" ? (
              <Badge tone="sage">Resale live</Badge>
            ) : null}
          </div>
          <h2 className="mt-2 font-display text-2xl italic">{ev.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {new Date(ev.startsAt).toLocaleString()} · {ev.venue}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <p className="font-mono text-sm tabular-nums">
            {ev.minCents != null && ev.maxCents != null
              ? ev.minCents === ev.maxCents
                ? formatAmount(ev.minCents, symbol)
                : `${formatAmount(ev.minCents, symbol)} – ${formatAmount(ev.maxCents, symbol)}`
              : "No listings"}
          </p>
          <p className="text-xs text-muted">
            {ev.available} available · {ev.sold}/{ev.supply} sold
          </p>
        </div>
      </div>
    </Link>
  );
}
