import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Coins, Filter, MapPin, Search, ShieldCheck, Sparkles, Tag, Ticket, X } from "lucide-react";
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
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "resale">("all");
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

  // Extract categories dynamically
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((ev) => {
      if (selectedCategory !== "all" && ev.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (availabilityFilter === "available" && ev.available <= 0) {
        return false;
      }
      if (availabilityFilter === "resale" && (ev.sold === 0 || ev.phase !== "active")) {
        return false;
      }
      return true;
    });
  }, [items, selectedCategory, availabilityFilter]);

  return (
    <AppShell>
      {/* HERO SECTION */}
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-bg-elevated via-bg-elevated to-mist/40 p-6 md:p-10 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="mt-1 font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-fg">
              Shows worth <span className="italic text-primary font-normal">showing up for.</span>
            </h1>
          </div>

          {/* KEY PROTOCOL PILLARS */}
          <div className="flex flex-wrap gap-2 text-xs font-mono text-muted">
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated/80 px-3 py-1.5 shadow-2xs">
              <ShieldCheck className="size-3.5 text-primary" />
              <span>Anti-Scalp Cap</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated/80 px-3 py-1.5 shadow-2xs">
              <Ticket className="size-3.5 text-sage" />
              <span>1-Wallet-1-Ticket</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated/80 px-3 py-1.5 shadow-2xs">
              <Sparkles className="size-3.5 text-primary" />
              <span>Dynamic QR</span>
            </div>
          </div>
        </div>

        {/* DEV MODE CLAIM BANNER */}
        {me && config?.devMode ? (
          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Coins className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-fg">Testnet Faucet</p>
                  <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">DEV</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right font-mono text-xs">
                <span className="font-semibold text-primary">{formatAmount(me.spendableCents, symbol)}</span>
              </div>
              <Button
                variant="default"
                size="sm"
                disabled={claiming}
                onClick={() => void claim()}
                className="shadow-sm font-medium"
              >
                {claiming ? "Claiming…" : "Claim 100 DxDAI"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <ChainDialog {...chain} onClose={chain.close} />

      {/* SEARCH & FILTERS TOOLBAR */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="size-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by artist, show name, venue or city…"
              className="pl-10 pr-9 bg-bg-elevated border-border"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg p-0.5"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* AVAILABILITY FILTER SWITCHER */}
          <div className="flex items-center rounded-lg border border-border bg-bg-elevated p-1 text-xs">
            <button
              type="button"
              onClick={() => setAvailabilityFilter("all")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                availabilityFilter === "all" ? "bg-primary text-primary-fg shadow-2xs" : "text-muted hover:text-fg"
              }`}
            >
              All Shows
            </button>
            <button
              type="button"
              onClick={() => setAvailabilityFilter("available")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                availabilityFilter === "available" ? "bg-primary text-primary-fg shadow-2xs" : "text-muted hover:text-fg"
              }`}
            >
              Available
            </button>
            <button
              type="button"
              onClick={() => setAvailabilityFilter("resale")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                availabilityFilter === "resale" ? "bg-primary text-primary-fg shadow-2xs" : "text-muted hover:text-fg"
              }`}
            >
              Resale Pool
            </button>
          </div>
        </div>

        {/* CATEGORY PILLS */}
        {categories.length > 0 ? (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full px-3 py-1 font-medium transition-colors whitespace-nowrap border ${
                selectedCategory === "all"
                  ? "bg-ink text-paper border-ink"
                  : "bg-bg-elevated text-muted border-border hover:border-fg hover:text-fg"
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 font-medium transition-colors whitespace-nowrap border ${
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? "bg-ink text-paper border-ink"
                    : "bg-bg-elevated text-muted border-border hover:border-fg hover:text-fg"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* EVENT LISTINGS */}
      <div className="grid gap-5">
        {loading && !items.length ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-xl shimmer-box border border-border" />
            ))}
          </div>
        ) : null}

        {!loading && filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-bg-elevated p-12 text-center">
            <Ticket className="size-10 text-muted mx-auto mb-3 stroke-[1.5]" />
            <h3 className="font-display text-xl font-bold">No shows found</h3>
            <p className="mt-1 text-sm text-muted max-w-sm mx-auto">
              {q || selectedCategory !== "all" || availabilityFilter !== "all"
                ? "Try clearing your search query or adjusting filters."
                : "No live events are currently minted on the marketplace."}
            </p>
            {q || selectedCategory !== "all" || availabilityFilter !== "all" ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setQ("");
                  setSelectedCategory("all");
                  setAvailabilityFilter("all");
                }}
              >
                Reset filters
              </Button>
            ) : null}
          </div>
        ) : null}

        {filteredItems.map((ev) => (
          <EventRow key={ev.id} ev={ev} symbol={symbol} />
        ))}
      </div>
    </AppShell>
  );
}

function EventRow({ ev, symbol }: { ev: EventListItem; symbol: string }) {
  const soldOut = ev.available === 0;
  const soldPercent = ev.supply > 0 ? Math.min(100, Math.round((ev.sold / ev.supply) * 100)) : 0;
  const startDate = new Date(ev.startsAt);
  const monthName = startDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dayNum = startDate.getDate();
  const timeStr = startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: String(ev.id) }}
      className="ticket-pass card-hover group grid overflow-hidden rounded-xl border border-border bg-bg-elevated transition-all md:grid-cols-[240px_1fr_180px]"
    >
      {/* LEFT: EVENT POSTER & BADGES */}
      <div className="relative h-48 md:h-full w-full overflow-hidden bg-mist">
        {ev.posterUrl ? (
          <img
            src={ev.posterUrl}
            alt={ev.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-xs font-mono text-muted">
            <Ticket className="size-8 stroke-[1.5] text-muted/60 mb-1" />
            <span>Pass Preview</span>
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
          {ev.category ? <Badge className="backdrop-blur-md bg-ink/75 text-paper text-[10px] font-semibold">{ev.category}</Badge> : null}
          <PhaseBadge phase={ev.phase} />
        </div>
      </div>

      {/* CENTER: EVENT METADATA */}
      <div className="flex flex-col justify-between p-5 md:px-6">
        <div>
          {/* DATE & VENUE LINE */}
          <div className="flex items-center gap-3 text-xs text-muted font-medium">
            <div className="flex items-center gap-1 text-primary font-semibold">
              <Calendar className="size-3.5" />
              <span>{monthName} {dayNum} · {timeStr}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1 truncate">
              <MapPin className="size-3.5 text-muted" />
              <span className="truncate">{ev.venue}</span>
            </div>
          </div>

          {/* EVENT TITLE */}
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-fg group-hover:text-primary transition-colors">
            {ev.name}
          </h2>

          {/* STATUS WARNINGS / PILLS */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
            {ev.frozen ? <Badge tone="danger">Trading Paused</Badge> : null}
            {ev.engineVersion < 2 ? <Badge tone="danger">Legacy Contract</Badge> : null}
            {soldOut && ev.phase === "active" ? <Badge tone="danger">Sold Out</Badge> : null}
            {!soldOut && ev.sold > 0 && ev.phase === "active" ? (
              <Badge tone="sage" className="font-mono text-[10px]">Resale Enabled</Badge>
            ) : null}
          </div>
        </div>

        {/* PROGRESS BAR & INVENTORY */}
        <div className="mt-4 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between text-xs text-muted mb-1 font-mono">
            <span>Sold</span>
            <span className="font-semibold text-fg">{ev.sold} / {ev.supply} ({soldPercent}%)</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-mist overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${soldPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* RIGHT: TEAR-OFF COUPON STUB */}
      <div className="relative flex flex-col justify-between border-t md:border-t-0 md:border-l border-dashed border-border bg-mist/20 p-5 text-right">
        {/* Notch perforations for desktop */}
        <div className="hidden md:block absolute -left-2.5 -top-2.5 size-5 rounded-full bg-bg border border-border" />
        <div className="hidden md:block absolute -left-2.5 -bottom-2.5 size-5 rounded-full bg-bg border border-border" />

        <div className="text-left md:text-right">
          <p className="font-mono text-xl font-bold tabular-nums text-fg">
            {ev.minCents != null && ev.maxCents != null
              ? ev.minCents === ev.maxCents
                ? formatAmount(ev.minCents, symbol)
                : `${formatAmount(ev.minCents, symbol)} – ${formatAmount(ev.maxCents, symbol)}`
              : "No listings"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {ev.available > 0 ? (
              <span className="text-success font-semibold">{ev.available} left</span>
            ) : (
              <span className="text-danger font-semibold">Resale pool only</span>
            )}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 font-medium text-xs text-primary-fg shadow-xs transition-transform group-hover:translate-x-1">
            <span>Tickets</span>
            <span>→</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
