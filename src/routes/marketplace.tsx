import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Coins, Copy, ExternalLink, Lock, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PhaseBadge } from "@/components/phase-badge";
import { PublicDarkShell } from "@/components/public-dark-shell";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import artifacts from "@/lib/abi/core.json";
import { buyNow, fetchEvent, fetchEvents, prepareBuyer, quoteBuy } from "@/lib/api";
import { friendlyChainError, isInventoryRace } from "@/lib/chain-errors";
import { explorerAddress, explorerToken, gatewayUrl } from "@/lib/explorer";
import { updateActiveChainRun } from "@/lib/tx-state";
import type { EventDetail, EventListItem } from "@/lib/types";
import { formatAmount, paySymbol, phaseLabel, shortAddr } from "@/lib/utils";

export const Route = createFileRoute("/marketplace")({ component: MarketplacePage });

const THEMES = ["emerald", "cyan", "amber", "violet", "crimson"] as const;
const STREAK_PALETTE = [
  { r: 110, g: 231, b: 183 },
  { r: 52, g: 211, b: 153 },
  { r: 251, g: 191, b: 36 },
  { r: 56, g: 189, b: 248 },
  { r: 244, g: 114, b: 182 },
];

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function themeForEvent(id: number) {
  return THEMES[Math.abs(id) % THEMES.length];
}

function formatCardDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = String(d.getDate()).padStart(2, "0");
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${month} ${day} · ${time}`;
}

function MarketplacePage() {
  const { me, config, sendUserCall, refreshBalance, requestConnect } = useSession();
  const navigate = useNavigate();
  const chain = useChainRun();
  const symbol = paySymbol(config);
  const explorer = config?.explorerUrl ?? "";

  const [q, setQ] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "resale">("all");
  const [items, setItems] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [contractsOpen, setContractsOpen] = useState(false);
  const [buyingTierId, setBuyingTierId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<{
    collection: string | null;
    tokenId: string;
    tokenUri: string | null;
  } | null>(null);

  // Carousel state & refs
  const [centerRound, setCenterRound] = useState(0);
  const [activeDotIdx, setActiveDotIdx] = useState(0);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const speedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detailOuterRef = useRef<HTMLElement | null>(null);
  const slotRefs = useRef<Map<string, HTMLElement>>(new Map());

  const targetOffsetRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const slideVelocityRef = useRef(0);
  const centerRoundRef = useRef(0);
  const activeDotIdxRef = useRef(0);
  const isDraggingRef = useRef(false);
  const wasDraggedRef = useRef(false);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const selectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      void fetchEvents({ data: { q } })
        .then((rows) => {
          if (live) setItems(rows);
        })
        .catch(() => undefined)
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, me?.address]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [items]);

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

  const filteredRef = useRef<EventListItem[]>(filteredItems);
  filteredRef.current = filteredItems;
  const isLoopMode = filteredItems.length >= 3;
  const isLoopRef = useRef(isLoopMode);
  isLoopRef.current = isLoopMode;

  const clampOffset = useCallback((val: number) => {
    if (isLoopRef.current) return val;
    const maxIdx = Math.max(0, filteredRef.current.length - 1);
    return Math.max(0, Math.min(maxIdx, val));
  }, []);

  // Reset carousel position when filtered list changes
  useEffect(() => {
    targetOffsetRef.current = 0;
    currentOffsetRef.current = 0;
    centerRoundRef.current = 0;
    activeDotIdxRef.current = 0;
    setCenterRound(0);
    setActiveDotIdx(0);
    if (selectedEventId != null && !filteredItems.some((e) => e.id === selectedEventId)) {
      setSelectedEventId(null);
      setDetail(null);
    }
  }, [filteredItems.length, selectedCategory, availabilityFilter, q]);

  const smoothScrollToDetail = useCallback(() => {
    const el = detailOuterRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - 92;
      const startY = window.scrollY;
      const diff = targetY - startY;
      if (Math.abs(diff) < 4) return;
      let startTime: number | null = null;
      const duration = 680;
      function step(ts: number) {
        if (startTime === null) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        window.scrollTo(0, startY + diff * ease);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, []);

  const loadAndOpenEvent = useCallback(
    (eventId: number, shouldScroll: boolean) => {
      setSelectedEventId(eventId);
      setContractsOpen(false);
      setDetail((prev) => (prev?.id === eventId ? prev : null));
      setDetailLoading(true);
      void fetchEvent({ data: { id: eventId } })
        .then((res) => {
          if (selectedIdRef.current === eventId) setDetail(res);
        })
        .catch(() => {
          toast.error("Could not load event details.");
        })
        .finally(() => {
          if (selectedIdRef.current === eventId) setDetailLoading(false);
        });
      if (shouldScroll) smoothScrollToDetail();
    },
    [smoothScrollToDetail],
  );

  // Main 60fps carousel physics + speed-streak canvas loop
  useEffect(() => {
    const speedCanvas = speedCanvasRef.current;
    const viewport = viewportRef.current;
    const sCtx = speedCanvas?.getContext("2d") ?? null;

    let sWidth = viewport?.clientWidth || window.innerWidth;
    let sHeight = viewport?.clientHeight || 460;
    let sDpr = Math.min(window.devicePixelRatio || 1, 2);

    function resizeSpeedCanvas() {
      if (!speedCanvas || !viewport || !sCtx) return;
      sDpr = Math.min(window.devicePixelRatio || 1, 2);
      sWidth = viewport.clientWidth;
      sHeight = viewport.clientHeight;
      speedCanvas.width = sWidth * sDpr;
      speedCanvas.height = sHeight * sDpr;
      sCtx.setTransform(sDpr, 0, 0, sDpr, 0, 0);
    }

    window.addEventListener("resize", resizeSpeedCanvas);
    resizeSpeedCanvas();

    const streaks = Array.from({ length: 38 }, () => {
      const col = STREAK_PALETTE[Math.floor(Math.random() * STREAK_PALETTE.length)];
      const depth = Math.random();
      return {
        x: Math.random() * sWidth,
        y: sHeight * (0.2 + Math.random() * 0.6),
        baseLen: 140 + depth * 280,
        thickness: 2 + depth * 14,
        alpha: 0.08 + depth * 0.24,
        color: col,
        depth,
      };
    });

    let smoothVel = 0;
    let smoothEnergy = 0;
    let rafId = 0;

    function tick() {
      const list = filteredRef.current;
      const loop = isLoopRef.current;

      if (list.length > 0) {
        const prevOffset = currentOffsetRef.current;
        currentOffsetRef.current += (targetOffsetRef.current - currentOffsetRef.current) * 0.11;
        slideVelocityRef.current = currentOffsetRef.current - prevOffset;

        const nextRound = Math.round(currentOffsetRef.current);
        if (nextRound !== centerRoundRef.current) {
          centerRoundRef.current = nextRound;
          setCenterRound(nextRound);
        }

        const nextActiveDot = loop ? mod(nextRound, list.length) : clampOffset(nextRound);
        if (nextActiveDot !== activeDotIdxRef.current) {
          activeDotIdxRef.current = nextActiveDot;
          setActiveDotIdx(nextActiveDot);
        }

        const cardSpacing = 310;
        const slotKeys = loop
          ? [-3, -2, -1, 0, 1, 2, 3].map((s) => ({ key: `s:${s}`, virtualIdx: nextRound + s }))
          : list.map((_, idx) => ({ key: `f:${idx}`, virtualIdx: idx }));

        for (const { key, virtualIdx } of slotKeys) {
          const el = slotRefs.current.get(key);
          if (!el) continue;

          const dist = virtualIdx - currentOffsetRef.current;
          const absDist = Math.abs(dist);

          const x = dist * cardSpacing + Math.sign(dist) * Math.pow(absDist, 1.35) * 18;
          const y = absDist * 10 - (absDist < 0.5 ? (1 - absDist * 2) * 10 : 0);
          const rotY = Math.max(-28, Math.min(28, -dist * 11));

          const scaleX = absDist > 1.15 ? 1 + (absDist - 1.15) * 0.28 : 1 - absDist * 0.03;
          const scaleY =
            absDist > 1.15
              ? Math.max(0.75, 0.96 - (absDist - 1.15) * 0.14)
              : 1.03 - absDist * 0.05;

          const blurPx = absDist > 1.1 ? Math.min(14, (absDist - 1.1) * 9.5) : 0;
          const opacity =
            absDist > 2.35
              ? 0
              : absDist > 1.1
                ? Math.max(0.12, 1 - (absDist - 1.1) * 0.68)
                : 1;

          el.style.transform = `translate3d(${x}px, ${y}px, 0) rotateY(${rotY}deg) scale(${scaleX}, ${scaleY})`;
          el.style.filter = blurPx > 0.1 ? `blur(${blurPx.toFixed(1)}px)` : "none";
          el.style.opacity = opacity.toFixed(2);
          el.style.zIndex = String(Math.round(20 - absDist * 5));
          el.style.pointerEvents = absDist > 1.6 ? "none" : "auto";
        }
      }

      // Render inertia speed streaks
      if (sCtx) {
        sCtx.clearRect(0, 0, sWidth, sHeight);
        smoothVel += (slideVelocityRef.current - smoothVel) * 0.16;
        const targetEnergy = Math.min(1, Math.abs(smoothVel) * 26);
        const lerpRate = targetEnergy > smoothEnergy ? 0.14 : 0.055;
        smoothEnergy += (targetEnergy - smoothEnergy) * lerpRate;

        if (smoothEnergy >= 0.006) {
          sCtx.save();
          sCtx.globalCompositeOperation = "lighter";
          const directionalPush = -smoothVel * 360;

          for (const st of streaks) {
            st.x += directionalPush * (0.4 + st.depth * 0.8);
            const dynamicLen = st.baseLen * (0.5 + smoothEnergy * 1.6);

            if (st.x - dynamicLen > sWidth + 140) st.x = -dynamicLen - 80;
            else if (st.x + dynamicLen < -140) st.x = sWidth + dynamicLen + 80;

            const x0 = st.x - dynamicLen * 0.5;
            const x1 = st.x + dynamicLen * 0.5;
            const easedAlpha = st.alpha * (smoothEnergy * smoothEnergy);
            const { r, g, b } = st.color;

            const haloGrad = sCtx.createLinearGradient(x0, st.y, x1, st.y);
            haloGrad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0)`);
            haloGrad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${easedAlpha * 0.35})`);
            haloGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${easedAlpha * 0.55})`);
            haloGrad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${easedAlpha * 0.35})`);
            haloGrad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0)`);

            sCtx.fillStyle = haloGrad;
            sCtx.beginPath();
            sCtx.roundRect(x0, st.y - st.thickness, dynamicLen, st.thickness * 2, st.thickness);
            sCtx.fill();

            const coreGrad = sCtx.createLinearGradient(
              x0 + dynamicLen * 0.15,
              st.y,
              x1 - dynamicLen * 0.15,
              st.y,
            );
            coreGrad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0)`);
            coreGrad.addColorStop(0.5, `rgba(255, 255, 255, ${easedAlpha * 0.65})`);
            coreGrad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0)`);

            sCtx.fillStyle = coreGrad;
            sCtx.beginPath();
            sCtx.roundRect(
              x0 + dynamicLen * 0.15,
              st.y - st.thickness * 0.22,
              dynamicLen * 0.7,
              st.thickness * 0.44,
              st.thickness * 0.22,
            );
            sCtx.fill();
          }

          sCtx.restore();
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeSpeedCanvas);
    };
  }, [clampOffset]);

  // Pointer & horizontal wheel scrubbing on carousel viewport
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;

    function syncDetailToSnap() {
      const list = filteredRef.current;
      if (selectedIdRef.current == null || list.length === 0) return;
      const newIdx = isLoopRef.current ? mod(targetOffsetRef.current, list.length) : targetOffsetRef.current;
      const newItem = list[newIdx];
      if (newItem && newItem.id !== selectedIdRef.current) {
        loadAndOpenEvent(newItem.id, false);
      }
    }

    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("button") || filteredRef.current.length <= 1) return;
      isDraggingRef.current = true;
      wasDraggedRef.current = false;
      startXRef.current = e.clientX;
      startOffsetRef.current = targetOffsetRef.current;
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - startXRef.current;
      if (Math.abs(dx) > 5) wasDraggedRef.current = true;
      const raw = startOffsetRef.current - dx / 290;
      if (isLoopRef.current) {
        targetOffsetRef.current = raw;
      } else {
        const maxIdx = Math.max(0, filteredRef.current.length - 1);
        targetOffsetRef.current = Math.max(-0.18, Math.min(maxIdx + 0.18, raw));
      }
    }

    function onPointerUp() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      targetOffsetRef.current = clampOffset(Math.round(targetOffsetRef.current));
      syncDetailToSnap();
    }

    function onWheel(e: WheelEvent) {
      if (filteredRef.current.length <= 1) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        const raw = targetOffsetRef.current + e.deltaX * 0.0032;
        targetOffsetRef.current = isLoopRef.current ? raw : clampOffset(raw);
        if (wheelTimer) clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => {
          targetOffsetRef.current = clampOffset(Math.round(targetOffsetRef.current));
          syncDetailToSnap();
        }, 130);
      }
    }

    viewport.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      if (wheelTimer) clearTimeout(wheelTimer);
      viewport.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("wheel", onWheel);
    };
  }, [clampOffset, loadAndOpenEvent]);

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

  async function buy(tierId: number) {
    if (!detail) return;
    if (!me) {
      requestConnect();
      return;
    }
    if (!me.kyc || me.kyc.status !== "approved") {
      if (me.kyc?.status === "expired") {
        toast.error("Your KYC credential has expired. Please resubmit verification.");
      }
      await navigate({ to: "/kyc", search: { next: `/events/${detail.id}` } });
      return;
    }
    setBuyingTierId(tierId);
    const labels = [
      "Check price and stock",
      "Confirm payment in your wallet",
      "Wait for chain confirmation",
      "Save your ticket",
    ];
    setReceipt(null);
    const eventId = detail.id;
    try {
      await chain.run({
        title: "Your ticket pass is on its way",
        labels,
        doneLabel: "View in My Tickets",
        onDone: () => void navigate({ to: "/my-tickets" }),
        retry: () => void buy(tierId),
        onError: (error) => {
          if (isInventoryRace(error)) {
            void fetchEvent({ data: { id: eventId } })
              .then((fresh) => {
                if (selectedIdRef.current === eventId) setDetail(fresh);
              })
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
              throw new Error("Not enough test coins. Claim 100 DxDAI on the marketplace, then try again.");
            }
          }
          advance(1);
          updateActiveChainRun({ resumePayload: { action: "buyNow", data: { tierId, chainId: quote.chainId } } });
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
          // Refresh event inventory
          void fetchEvent({ data: { id: eventId } }).then((fresh) => {
            if (selectedIdRef.current === eventId) setDetail(fresh);
          });
          void fetchEvents({ data: { q } }).then(setItems);
          return `Ticket pass saved at ${formatAmount(res.priceCents, symbol)}.`;
        },
      });
    } finally {
      setBuyingTierId(null);
    }
  }

  function copyText(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  }

  function renderSlots() {
    if (loading && !items.length) {
      return <div className="empty-msg">Loading live shows from chain…</div>;
    }
    if (filteredItems.length === 0) {
      return (
        <div className="empty-msg flex flex-col items-center gap-3">
          <span>No matching shows found on-chain.</span>
          {q || selectedCategory !== "all" || availabilityFilter !== "all" ? (
            <Button
              variant="outline"
              size="sm"
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
      );
    }

    const slotDescriptors = isLoopMode
      ? [-3, -2, -1, 0, 1, 2, 3].map((s) => {
          const virtualIdx = centerRound + s;
          const dataIdx = mod(virtualIdx, filteredItems.length);
          return { key: `s:${s}`, virtualIdx, ev: filteredItems[dataIdx] };
        })
      : filteredItems.map((ev, idx) => ({ key: `f:${idx}`, virtualIdx: idx, ev }));

    return slotDescriptors.map(({ key, virtualIdx, ev }) => {
      const pct = ev.supply > 0 ? Math.min(100, Math.round((ev.sold / ev.supply) * 100)) : 0;
      const soldOut = ev.available === 0;
      const statusText = ev.frozen
        ? "Frozen"
        : ev.phase !== "active"
          ? phaseLabel(ev.phase)
          : soldOut
            ? "Sold Out"
            : "On Sale";
      const statusCls =
        ev.frozen || ev.phase !== "active" || soldOut
          ? ev.sold > 0 && ev.phase === "active" && !ev.frozen
            ? "status-resale"
            : "status-ended"
          : "status-live";

      const priceText =
        ev.minCents != null && ev.maxCents != null
          ? ev.minCents === ev.maxCents
            ? formatAmount(ev.minCents, symbol)
            : `${formatAmount(ev.minCents, symbol)} – ${formatAmount(ev.maxCents, symbol)}`
          : "No listings";

      return (
        <article
          key={key}
          ref={(el) => {
            if (el) slotRefs.current.set(key, el);
            else slotRefs.current.delete(key);
          }}
          className={`event-card${selectedEventId === ev.id ? " selected-card" : ""}`}
          data-theme={themeForEvent(ev.id)}
          onClick={() => {
            if (wasDraggedRef.current) return;
            targetOffsetRef.current = virtualIdx;
            if (selectedEventId === ev.id) {
              setSelectedEventId(null);
              setDetail(null);
            } else {
              loadAndOpenEvent(ev.id, true);
            }
          }}
        >
          {ev.posterUrl ? <img src={ev.posterUrl} alt="" className="card-poster-bg" /> : null}
          <div className="card-halftone" />
          <div className="card-top">
            <div className="card-brand-mini">
              <i>CT</i>
              <span>Pass #{String(ev.id).padStart(2, "0")}</span>
            </div>
            <div className="card-badges">
              {ev.category ? <span className="badge-tag">{ev.category}</span> : null}
              <span className={`badge-tag ${statusCls}`}>{statusText}</span>
            </div>
          </div>

          <div className="card-mid">
            <div className="event-meta-line">
              <span>📅 {formatCardDate(ev.startsAt)}</span>
              <span>·</span>
              <span>📍 {ev.venue || "TBA"}</span>
            </div>
            <h2 className="event-title">{ev.name}</h2>
            <div className="event-venue-sub">
              {ev.engineVersion < 2
                ? "Legacy Contract"
                : !soldOut && ev.sold > 0 && ev.phase === "active"
                  ? "Primary & Resale Pool"
                  : ev.collectionAddress
                    ? shortAddr(ev.collectionAddress)
                    : "Verified On-Chain"}
            </div>
          </div>

          <div className="card-bottom-panel">
            <div className="sold-row">
              <span>Sold</span>
              <span>
                {ev.sold} / {ev.supply} ({pct}%)
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="price-action-row">
              <div>
                <div className="price-val">{priceText}</div>
                <div className="left-count">
                  {ev.available > 0 ? `${ev.available} left` : "Resale pool only"}
                </div>
              </div>
              <button
                type="button"
                className="btn-ticket"
                onClick={(e) => {
                  e.stopPropagation();
                  targetOffsetRef.current = virtualIdx;
                  loadAndOpenEvent(ev.id, true);
                }}
              >
                Tickets →
              </button>
            </div>
          </div>
        </article>
      );
    });
  }

  const selectedSummary =
    selectedEventId != null
      ? items.find((item) => item.id === selectedEventId) ?? null
      : null;

  return (
    <PublicDarkShell>
      <main className="marketplace-shell">
        <section className="hero-top">
          <div className="kicker-pill">
            Primary &amp; Verified Secondary Market · <span>Zero Scalper Markup</span>
          </div>
          <h1>Explore Live Shows</h1>
          <div className="subtitle">Curated Experiences Verified On-Chain</div>
          <p className="hero-desc">
            Discover upcoming concerts, underground club nights, and global festivals. Click any
            card below to inspect smart contract terms, admission tiers, and live resale
            availability.
          </p>

          {me && config?.devMode ? (
            <div className="faucet-glass-bar">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-[#6ee7b7]/15 text-[#6ee7b7]">
                  <Coins className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Testnet Faucet</span>
                    <span className="rounded bg-[#6ee7b7]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#6ee7b7]">
                      DEV
                    </span>
                  </div>
                  <p className="font-mono text-xs text-white/60">
                    Balance: {formatAmount(me.spendableCents, symbol)}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                disabled={claiming}
                onClick={() => void claim()}
                className="font-semibold"
              >
                {claiming ? "Claiming…" : "Claim 100 DxDAI"}
              </Button>
            </div>
          ) : null}

          <div className="search-morph-area">
            <div
              className={`morph-pill${searchExpanded ? " expanded" : ""}`}
              onClick={() => {
                if (searchExpanded) return;
                setSearchExpanded(true);
                setTimeout(() => searchInputRef.current?.focus(), 180);
              }}
            >
              <div className="pill-closed-face">
                <span>Search shows &amp; filter</span>
                <span className="circle-arrow">→</span>
              </div>

              <div className="pill-open-face">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by artist, show name, venue or city..."
                />
                <button
                  type="button"
                  className="close-search-btn"
                  title="Close search"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchExpanded(false);
                    if (q) setQ("");
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className={`filter-drawer${searchExpanded ? " open" : ""}`}>
              <div>
                <div className="filter-strip">
                  <button
                    type="button"
                    className={`filter-chip${selectedCategory === "all" ? " active" : ""}`}
                    onClick={() => setSelectedCategory("all")}
                  >
                    All Categories
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`filter-chip${
                        selectedCategory.toLowerCase() === cat.toLowerCase() ? " active" : ""
                      }`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`filter-chip${availabilityFilter === "available" ? " active" : ""}`}
                    onClick={() =>
                      setAvailabilityFilter((cur) => (cur === "available" ? "all" : "available"))
                    }
                  >
                    Available
                  </button>
                  <button
                    type="button"
                    className={`filter-chip${availabilityFilter === "resale" ? " active" : ""}`}
                    onClick={() =>
                      setAvailabilityFilter((cur) => (cur === "resale" ? "all" : "resale"))
                    }
                  >
                    Resale Pool
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="carousel-viewport" ref={viewportRef}>
          <canvas id="speed-canvas" ref={speedCanvasRef} />
          <div className="edge-vignette" />
          <div className="cards-stage-inner">{renderSlots()}</div>
        </section>

        {filteredItems.length > 1 ? (
          <div className="segment-bar-wrap">
            {filteredItems.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className={`segment-pill${activeDotIdx === idx ? " active" : ""}`}
                title={item.name}
                onClick={() => {
                  if (isLoopMode) {
                    const curMod = mod(Math.round(targetOffsetRef.current), filteredItems.length);
                    let diff = idx - curMod;
                    if (diff > filteredItems.length / 2) diff -= filteredItems.length;
                    if (diff < -filteredItems.length / 2) diff += filteredItems.length;
                    targetOffsetRef.current = Math.round(targetOffsetRef.current) + diff;
                  } else {
                    targetOffsetRef.current = idx;
                  }
                  if (selectedEventId != null) {
                    loadAndOpenEvent(item.id, false);
                  }
                }}
              />
            ))}
          </div>
        ) : null}

        {selectedEventId != null ? (
          <section className="detail-drawer-outer open" ref={detailOuterRef}>
            <div className="detail-drawer-inner">
              <div className="detail-content-stage" key={selectedEventId}>
                {detail ? (
                  <DetailContent
                    detail={detail}
                    symbol={symbol}
                    explorer={explorer}
                    chainName={config?.chainName || "Gnosis Chiado"}
                    me={me}
                    busyTierId={buyingTierId}
                    contractsOpen={contractsOpen}
                    onToggleContracts={() => setContractsOpen((v) => !v)}
                    onClose={() => {
                      setSelectedEventId(null);
                      setDetail(null);
                    }}
                    onCopy={copyText}
                    onBuy={(tierId) => void buy(tierId)}
                  />
                ) : (
                  <div className="detail-hero-card p-8 text-center">
                    <p className="font-mono text-sm text-white/70">
                      {detailLoading
                        ? `Retrieving ${selectedSummary?.name ?? "event"} and on-chain tiers…`
                        : "Event details unavailable."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

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
      </main>
    </PublicDarkShell>
  );
}

function DetailContent({
  detail,
  symbol,
  explorer,
  chainName,
  me,
  busyTierId,
  contractsOpen,
  onToggleContracts,
  onClose,
  onCopy,
  onBuy,
}: {
  detail: EventDetail;
  symbol: string;
  explorer: string;
  chainName: string;
  me: ReturnType<typeof useSession>["me"];
  busyTierId: number | null;
  contractsOpen: boolean;
  onToggleContracts: () => void;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
  onBuy: (tierId: number) => void;
}) {
  const startDate = new Date(detail.startsAt);
  const endDate = new Date(detail.endsAt);
  const stale = detail.engineVersion < 2;
  const closed = detail.phase !== "active";

  return (
    <>
      <div className="detail-hero-card">
        <div className="detail-banner" data-theme={themeForEvent(detail.id)}>
          {detail.posterUrl ? (
            <img
              src={detail.posterUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-lighten"
            />
          ) : null}
          <button type="button" className="detail-close-btn" onClick={onClose}>
            ✕ Close Details
          </button>
          <div className="relative z-2 mb-3 flex flex-wrap items-center gap-2">
            <span className="detail-cat-pill !mb-0">{detail.category || "Live Event"}</span>
            <PhaseBadge phase={detail.phase} />
            {detail.frozen ? <Badge tone="danger">Trading Paused</Badge> : null}
          </div>
          <h2 className="detail-title">{detail.name}</h2>
          <div className="detail-meta-row">
            <span>
              📅{" "}
              {startDate.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span>·</span>
            <span>
              🕒 {startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
              {endDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
            <span>·</span>
            <span>📍 {detail.venue || "TBA"}</span>
          </div>
        </div>

        <div className="detail-organizer-bar">
          <div className="org-left">
            {detail.description ? <div className="org-summary">{detail.description}</div> : null}
            <div className="org-meta">
              <span>
                Organized by{" "}
                <strong>{detail.organizerName ?? shortAddr(detail.organizerWallet)}</strong>
              </span>
              <span>·</span>
              <span className="royalty-tag">
                🛡 Resale Creator Royalty: {(detail.royaltyBps / 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <button type="button" className="btn-contracts" onClick={onToggleContracts}>
            {contractsOpen ? "▼ On-Chain Contracts" : "▶ On-Chain Contracts"}
          </button>
        </div>

        {contractsOpen ? (
          <div className="contract-info-box">
            {detail.collectionAddress ? (
              <span className="inline-flex items-center gap-1.5">
                Ticket NFT (ERC-721):{" "}
                <a
                  href={explorerAddress(detail.collectionAddress, explorer)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-[#86efac] hover:underline"
                >
                  {shortAddr(detail.collectionAddress)}
                  <ExternalLink className="size-3" />
                </a>
                <button
                  type="button"
                  onClick={() => onCopy(detail.collectionAddress!, "Collection Address")}
                  className="text-white/50 hover:text-white"
                  title="Copy address"
                >
                  <Copy className="size-3" />
                </button>
              </span>
            ) : null}

            {detail.marketplaceAddress ? (
              <span className="inline-flex items-center gap-1.5">
                Marketplace Escrow:{" "}
                <a
                  href={explorerAddress(detail.marketplaceAddress, explorer)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-[#86efac] hover:underline"
                >
                  {shortAddr(detail.marketplaceAddress)}
                  <ExternalLink className="size-3" />
                </a>
                <button
                  type="button"
                  onClick={() => onCopy(detail.marketplaceAddress!, "Marketplace Address")}
                  className="text-white/50 hover:text-white"
                  title="Copy address"
                >
                  <Copy className="size-3" />
                </button>
              </span>
            ) : null}

            {detail.vaultAddress ? (
              <span className="inline-flex items-center gap-1.5">
                Vault:{" "}
                <a
                  href={explorerAddress(detail.vaultAddress, explorer)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-[#86efac] hover:underline"
                >
                  {shortAddr(detail.vaultAddress)}
                  <ExternalLink className="size-3" />
                </a>
                <button
                  type="button"
                  onClick={() => onCopy(detail.vaultAddress!, "Vault Address")}
                  className="text-white/50 hover:text-white"
                  title="Copy address"
                >
                  <Copy className="size-3" />
                </button>
              </span>
            ) : null}

            <span>
              Chain: <strong style={{ color: "#ffffff" }}>{chainName}</strong>
            </span>
          </div>
        ) : null}
      </div>

      {stale ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            This event was minted on an earlier contract version. Direct wallet purchase is
            disabled.
          </span>
        </div>
      ) : null}

      {detail.frozen ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <Lock className="size-4 shrink-0" />
          <span>
            Trading and primary issuance on this event are currently frozen by platform governance.
          </span>
        </div>
      ) : null}

      <div className="passes-header">
        <h3>Admission Passes</h3>
        <span>
          {detail.tiers.length} Tier{detail.tiers.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="passes-list">
        {detail.tiers.map((tier) => {
          const isSoldOut = tier.available <= 0;
          const isLocked = busyTierId !== null || isSoldOut || closed || stale || detail.frozen;

          return (
            <div key={tier.id} className="pass-ticket-row">
              <div className="pass-left">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="pass-tier-name !mb-0">{tier.name}</div>
                  {tier.available > 0 && tier.available <= 10 ? (
                    <Badge tone="danger" className="text-[10px] font-mono">
                      Only {tier.available} Left
                    </Badge>
                  ) : null}
                </div>
                <div className="pass-sub-info mt-2">
                  {tier.available > 0 ? (
                    <span className="rem-green">{tier.available} remaining</span>
                  ) : (
                    <span className="text-rose-300 font-semibold">Sold Out</span>
                  )}
                  {tier.minCents != null ? (
                    <>
                      {" "}
                      · Resale: {formatAmount(tier.minCents, symbol)}
                      {tier.maxCents != null && tier.maxCents !== tier.minCents
                        ? `–${formatAmount(tier.maxCents, symbol)}`
                        : ""}
                    </>
                  ) : null}
                </div>
              </div>

              <div className="pass-right">
                <div className="pass-price">{formatAmount(tier.faceCents, symbol)}</div>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => onBuy(tier.id)}
                  className={`btn-buy-pass${isLocked ? " disabled" : ""}`}
                >
                  {busyTierId === tier.id
                    ? "Processing…"
                    : isSoldOut
                      ? "Sold Out"
                      : closed
                        ? phaseLabel(detail.phase)
                        : stale || detail.frozen
                          ? "Unavailable"
                          : !me
                            ? "Connect to Buy"
                            : !me.kyc || me.kyc.status !== "approved"
                              ? "KYC Required"
                              : "Buy Now →"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
