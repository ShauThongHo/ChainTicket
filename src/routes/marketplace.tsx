import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Copy, ExternalLink, Lock, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { FaucetClaimButton } from "@/components/faucet-claim";
import { PublicDarkShell } from "@/components/public-dark-shell";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import artifacts from "@/lib/abi/core.json";
import { buyNow, fetchEvent, fetchEvents, quoteBuy } from "@/lib/api";
import { isInventoryRace } from "@/lib/chain-errors";
import { explorerAddress, explorerToken, gatewayUrl, resolvePosterUrl } from "@/lib/explorer";
import { updateActiveChainRun } from "@/lib/tx-state";
import type { EventDetail, EventListItem } from "@/lib/types";
import { formatAmount, paySymbol, phaseLabel, shortAddr } from "@/lib/utils";

const marketplaceSearchSchema = z.object({
  eventId: z.coerce.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/marketplace")({
  validateSearch: (search) => marketplaceSearchSchema.parse(search),
  component: MarketplacePage,
});

const THEMES = ["emerald", "amber", "crimson", "cyan", "violet"] as const;
const DEFAULT_CATEGORIES = ["Concert", "Festival", "Club"] as const;
const STREAK_PALETTE = [
  { r: 110, g: 231, b: 183 },
  { r: 52, g: 211, b: 153 },
  { r: 251, g: 191, b: 36 },
  { r: 56, g: 189, b: 248 },
  { r: 244, g: 114, b: 182 },
];

type VirtualSlot = {
  el: HTMLElement;
  slotOffset: number;
  fixedIdx: number | null;
};

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

function smoothScrollToY(targetY: number, duration = 680) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  if (Math.abs(diff) < 4) return;
  let startTime: number | null = null;

  function step(timestamp: number) {
    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 4);
    window.scrollTo(0, startY + diff * ease);
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

function createCardElement(): HTMLElement {
  const el = document.createElement("article");
  el.className = "event-card";
  el.innerHTML = `
    <div class="card-halftone"></div>
    <div class="card-top">
      <div class="card-brand-mini"><i>CT</i><span class="c-pass"></span></div>
      <div class="card-badges">
        <span class="badge-tag c-cat"></span>
        <span class="badge-tag c-status"></span>
      </div>
    </div>
    <div class="card-mid">
      <div class="event-meta-line">
        <span class="c-date"></span><span>·</span><span class="c-venue"></span>
      </div>
      <h2 class="event-title c-title"></h2>
      <div class="event-venue-sub c-artist"></div>
    </div>
    <div class="card-bottom-panel">
      <div class="sold-row"><span>Sold</span><span class="c-sold"></span></div>
      <div class="progress-track"><div class="progress-fill c-bar"></div></div>
      <div class="price-action-row">
        <div>
          <div class="price-val c-price"></div>
          <div class="left-count c-left"></div>
        </div>
        <button type="button" class="btn-ticket">Tickets →</button>
      </div>
    </div>
  `;
  return el;
}

function MarketplacePage() {
  const { me, config, sendUserCall, refreshBalance, requestConnect } = useSession();
  const { eventId: initialEventId } = Route.useSearch();
  const navigate = useNavigate();
  const chain = useChainRun();
  const symbol = paySymbol(config);
  const explorer = config?.explorerUrl ?? "";

  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [items, setItems] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [drawerItem, setDrawerItem] = useState<EventListItem | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [contractsOpen, setContractsOpen] = useState(false);
  const [buyingTierId, setBuyingTierId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<{
    collection: string | null;
    tokenId: string;
    tokenUri: string | null;
  } | null>(null);

  // Exact DOM refs matching Redesigned_UI HTML/JS
  const marketplaceMainRef = useRef<HTMLElement | null>(null);
  const morphPillRef = useRef<HTMLDivElement | null>(null);
  const filterDrawerRef = useRef<HTMLDivElement | null>(null);
  const filterStripRef = useRef<HTMLDivElement | null>(null);
  const closeSearchBtnRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const cardsStageRef = useRef<HTMLDivElement | null>(null);
  const segmentBarRef = useRef<HTMLDivElement | null>(null);
  const speedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detailOuterRef = useRef<HTMLElement | null>(null);
  const detailInnerRef = useRef<HTMLDivElement | null>(null);
  const detailStageRef = useRef<HTMLDivElement | null>(null);

  // Carousel & Drawer runtime state refs (60fps imperative loop, zero React drag re-renders)
  const isSearchExpandedRef = useRef(false);
  const filteredRef = useRef<EventListItem[]>([]);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  const virtualSlotsRef = useRef<VirtualSlot[]>([]);
  const segmentPillsRef = useRef<HTMLButtonElement[]>([]);
  const lastActiveDataIdxRef = useRef(-1);
  const isLoopModeRef = useRef(true);
  const targetOffsetRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const slideVelocityRef = useRef(0);

  const isDraggingRef = useRef(false);
  const wasDraggedRef = useRef(false);
  const suppressNextContextMenuRef = useRef(false);
  const dragPointerButtonRef = useRef(0);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);

  const selectedIdRef = useRef<number | null>(null);
  const isDetailOpenRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heightSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDrawerTransitionRef = useRef<"open" | "swap" | null>(null);
  const pendingScrollRef = useRef(false);
  const prefetchedDetailRef = useRef<{ id: number; data: EventDetail | null; done: boolean } | null>(
    null,
  );
  const consumedAutoEventIdRef = useRef<number | null>(null);
  const autoFocusCancelRef = useRef<(() => void) | null>(null);
  const arrivalPrefetchRef = useRef<{
    id: number;
    data: EventDetail | null;
    done: boolean;
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    let live = true;
    void fetchEvents({ data: { q: "" } })
      .then((rows) => {
        if (live) setItems(rows);
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [me?.address]);

  const categories = useMemo(() => {
    const out: string[] = [...DEFAULT_CATEGORIES];
    const seen = new Set(out.map((c) => c.toLowerCase()));
    items.forEach((item) => {
      if (item.category && !seen.has(item.category.toLowerCase())) {
        seen.add(item.category.toLowerCase());
        out.push(item.category);
      }
    });
    return out;
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((ev) => {
      const matchQ =
        !query ||
        ev.name.toLowerCase().includes(query) ||
        (ev.venue || "").toLowerCase().includes(query) ||
        (ev.category || "").toLowerCase().includes(query) ||
        (ev.collectionAddress || "").toLowerCase().includes(query);
      const matchC =
        selectedCategory === "All" ||
        (ev.category || "").toLowerCase() === selectedCategory.toLowerCase();
      return matchQ && matchC;
    });
  }, [items, q, selectedCategory]);

  filteredRef.current = filteredItems;

  const clampOffset = useCallback((val: number) => {
    if (isLoopModeRef.current) return val;
    const maxIdx = Math.max(0, filteredRef.current.length - 1);
    return Math.max(0, Math.min(maxIdx, val));
  }, []);

  // Re-sync detail height cleanly whenever async tiers / contracts box change height while open
  const settleDetailHeight = useCallback(() => {
    const outer = detailOuterRef.current;
    const inner = detailInnerRef.current;
    if (!outer || !inner || !isDetailOpenRef.current) return;
    if (outer.style.height === "auto") return;
    outer.style.height = inner.scrollHeight + "px";
  }, []);

  const closeEventDetail = useCallback(() => {
    const outer = detailOuterRef.current;
    if (!outer || !isDetailOpenRef.current) return;
    if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    if (heightSettleTimerRef.current) clearTimeout(heightSettleTimerRef.current);

    arrivalPrefetchRef.current = null;
    selectedIdRef.current = null;
    isDetailOpenRef.current = false;
    pendingDrawerTransitionRef.current = null;

    outer.style.height = outer.offsetHeight + "px";
    void outer.offsetHeight;

    outer.classList.remove("open");
    outer.style.height = "0px";

    closeTimerRef.current = setTimeout(() => {
      if (!isDetailOpenRef.current) {
        setDrawerItem(null);
        setDetail(null);
        setContractsOpen(false);
      }
    }, 680);
  }, []);

  const openEventDetail = useCallback(
    (item: EventListItem, shouldScroll = true) => {
      const outer = detailOuterRef.current;
      if (!outer) return;

      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
      if (heightSettleTimerRef.current) clearTimeout(heightSettleTimerRef.current);

      const isDifferentEvent = selectedIdRef.current !== item.id;
      selectedIdRef.current = item.id;

      const arrivalPf =
        arrivalPrefetchRef.current &&
        arrivalPrefetchRef.current.id === item.id &&
        !arrivalPrefetchRef.current.failed
          ? arrivalPrefetchRef.current
          : null;
      arrivalPrefetchRef.current = null;

      if (arrivalPf) {
        prefetchedDetailRef.current = arrivalPf;
      } else {
        const fetchState = { id: item.id, data: null as EventDetail | null, done: false };
        prefetchedDetailRef.current = fetchState;

        void fetchEvent({ data: { id: item.id } })
          .then((res) => {
            fetchState.data = res;
            fetchState.done = true;
            if (selectedIdRef.current === item.id && pendingDrawerTransitionRef.current !== "swap") {
              setDetail(res);
            }
          })
          .catch(() => {
            fetchState.done = true;
            if (selectedIdRef.current === item.id) {
              toast.error("Could not load event details.");
            }
          })
          .finally(() => {
            if (selectedIdRef.current === item.id) setDetailLoading(false);
          });
      }

      if (isDetailOpenRef.current && isDifferentEvent) {
        const prevH = outer.offsetHeight;
        outer.style.height = prevH + "px";

        const oldStage = detailStageRef.current;
        if (oldStage) oldStage.classList.add("swapping");

        swapTimerRef.current = setTimeout(() => {
          setContractsOpen(false);
          const ready = prefetchedDetailRef.current;
          if (ready && ready.id === item.id) {
            setDetail(ready.data);
            setDetailLoading(!ready.done);
          } else {
            setDetail(null);
            setDetailLoading(true);
          }
          pendingDrawerTransitionRef.current = "swap";
          pendingScrollRef.current = false;
          setDrawerItem(item);
        }, 240);
      } else if (!isDetailOpenRef.current) {
        isDetailOpenRef.current = true;
        setContractsOpen(false);
        if (arrivalPf) {
          setDetail(arrivalPf.done ? arrivalPf.data : null);
          setDetailLoading(!arrivalPf.done);
        } else {
          setDetail((prev) => (prev?.id === item.id ? prev : null));
          setDetailLoading(true);
        }
        pendingDrawerTransitionRef.current = "open";
        pendingScrollRef.current = shouldScroll;
        setDrawerItem(item);
      }
    },
    [],
  );

  // Execute exact physical drawer height expansion & .swapping cross-fade on commit
  useLayoutEffect(() => {
    const mode = pendingDrawerTransitionRef.current;
    if (!mode || !drawerItem) return;
    pendingDrawerTransitionRef.current = null;

    const outer = detailOuterRef.current;
    const inner = detailInnerRef.current;
    const stage = detailStageRef.current;
    if (!outer || !inner) return;

    if (mode === "swap") {
      if (stage) {
        stage.classList.add("swapping");
        void stage.offsetHeight;
        requestAnimationFrame(() => {
          stage.classList.remove("swapping");
        });
      }
      const nextH = inner.scrollHeight;
      outer.style.height = nextH + "px";
      if (heightSettleTimerRef.current) clearTimeout(heightSettleTimerRef.current);
      heightSettleTimerRef.current = setTimeout(() => {
        if (isDetailOpenRef.current) outer.style.height = "auto";
      }, 680);
    } else if (mode === "open") {
      outer.style.height = "0px";
      void outer.offsetHeight;
      const targetH = inner.scrollHeight;
      outer.classList.add("open");
      outer.style.height = targetH + "px";

      if (heightSettleTimerRef.current) clearTimeout(heightSettleTimerRef.current);
      heightSettleTimerRef.current = setTimeout(() => {
        if (isDetailOpenRef.current) outer.style.height = "auto";
      }, 680);

      if (pendingScrollRef.current) {
        pendingScrollRef.current = false;
        const rect = outer.getBoundingClientRect();
        const targetScrollY = window.scrollY + rect.top - 92;
        smoothScrollToY(targetScrollY, 720);
      }
    }
  }, [drawerItem]);

  useEffect(() => {
    settleDetailHeight();
  }, [detail, detailLoading, contractsOpen, settleDetailHeight]);

  // Helper: populate & bind imperative event card DOM node (1:1 port of populateCard)
  const populateCard = useCallback(
    (el: HTMLElement, item: EventListItem, virtualIdx: number) => {
      el.classList.toggle("selected-card", selectedIdRef.current === item.id);

      const sym = symbolRef.current;
      const sig = `${item.id}|${item.sold}|${item.supply}|${item.available}|${item.phase}|${item.frozen}|${item.minCents}|${item.maxCents}|${sym}`;
      if (el.dataset.boundSig === sig && el.dataset.vIdx === String(virtualIdx)) return;

      el.dataset.boundSig = sig;
      el.dataset.vIdx = String(virtualIdx);
      el.dataset.theme = themeForEvent(item.id);

      const pct = item.supply > 0 ? Math.min(100, Math.round((item.sold / item.supply) * 100)) : 0;
      const leftTickets = Math.max(0, item.available);
      const soldOut = item.available === 0;
      const statusText = item.frozen
        ? "Frozen"
        : item.phase !== "active"
          ? phaseLabel(item.phase)
          : soldOut
            ? "Sold Out"
            : "On Sale";
      const statusCls =
        item.frozen || item.phase !== "active" || soldOut
          ? item.sold > 0 && item.phase === "active" && !item.frozen
            ? "status-resale"
            : "status-ended"
          : "status-live";

      const priceText =
        item.minCents != null && item.maxCents != null
          ? item.minCents === item.maxCents
            ? formatAmount(item.minCents, sym)
            : `${formatAmount(item.minCents, sym)} – ${formatAmount(item.maxCents, sym)}`
          : "No listings";

      const subText =
        item.engineVersion < 2
          ? "Legacy Contract"
          : !soldOut && item.sold > 0 && item.phase === "active"
            ? "Primary & Resale Pool"
            : item.collectionAddress
              ? shortAddr(item.collectionAddress)
              : "Verified On-Chain";

      const passEl = el.querySelector(".c-pass");
      const catEl = el.querySelector(".c-cat") as HTMLElement | null;
      const statusEl = el.querySelector(".c-status") as HTMLElement | null;
      const dateEl = el.querySelector(".c-date");
      const venueEl = el.querySelector(".c-venue");
      const titleEl = el.querySelector(".c-title");
      const artistEl = el.querySelector(".c-artist");
      const soldEl = el.querySelector(".c-sold");
      const barEl = el.querySelector(".c-bar") as HTMLElement | null;
      const priceEl = el.querySelector(".c-price");
      const leftEl = el.querySelector(".c-left");
      const btnTicket = el.querySelector(".btn-ticket") as HTMLButtonElement | null;

      if (passEl) passEl.textContent = `Pass #${String(item.id).padStart(2, "0")}`;
      if (catEl) {
        catEl.textContent = item.category || "";
        catEl.style.display = item.category ? "" : "none";
      }
      if (statusEl) {
        statusEl.textContent = statusText;
        statusEl.className = `badge-tag c-status ${statusCls}`;
      }
      if (dateEl) dateEl.textContent = `📅 ${formatCardDate(item.startsAt)}`;
      if (venueEl) venueEl.textContent = `📍 ${item.venue || "TBA"}`;
      if (titleEl) titleEl.textContent = item.name;
      if (artistEl) artistEl.textContent = subText;
      if (soldEl) soldEl.textContent = `${item.sold} / ${item.supply} (${pct}%)`;
      if (barEl) barEl.style.width = `${pct}%`;
      if (priceEl) priceEl.textContent = priceText;
      if (leftEl) leftEl.textContent = item.available > 0 ? `${leftTickets} left` : "Resale pool only";

      el.onclick = () => {
        if (wasDraggedRef.current) return;
        autoFocusCancelRef.current?.();
        targetOffsetRef.current = virtualIdx;
        if (selectedIdRef.current === item.id && isDetailOpenRef.current) {
          closeEventDetail();
        } else {
          openEventDetail(item, true);
        }
      };

      if (btnTicket) {
        btnTicket.onclick = (e) => {
          e.stopPropagation();
          autoFocusCancelRef.current?.();
          targetOffsetRef.current = virtualIdx;
          openEventDetail(item, true);
        };
      }
    },
    [closeEventDetail, openEventDetail],
  );

  const filteredIdsKey = useMemo(() => filteredItems.map((e) => e.id).join(","), [filteredItems]);

  // Rebuild segment bar + virtual DOM card slots when matching event list structure changes
  useEffect(() => {
    const cardsStage = cardsStageRef.current;
    const segmentBar = segmentBarRef.current;
    if (!cardsStage || !segmentBar) return;

    const list = filteredRef.current;
    cardsStage.innerHTML = "";
    virtualSlotsRef.current = [];
    segmentBar.innerHTML = "";
    segmentPillsRef.current = [];
    lastActiveDataIdxRef.current = -1;

    if (loading && !items.length) {
      cardsStage.innerHTML = `<div class="empty-msg">Loading live shows from chain…</div>`;
      return;
    }

    if (list.length > 1) {
      list.forEach((item, idx) => {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "segment-pill";
        pill.title = item.name;
        pill.addEventListener("click", () => {
          autoFocusCancelRef.current?.();
          const currentList = filteredRef.current;
          const liveItem = currentList[idx] ?? item;
          if (isLoopModeRef.current) {
            const curMod = mod(Math.round(targetOffsetRef.current), currentList.length);
            let diff = idx - curMod;
            if (diff > currentList.length / 2) diff -= currentList.length;
            if (diff < -currentList.length / 2) diff += currentList.length;
            targetOffsetRef.current = Math.round(targetOffsetRef.current) + diff;
          } else {
            targetOffsetRef.current = idx;
          }

          if (isDetailOpenRef.current) {
            openEventDetail(liveItem, false);
          }
        });
        segmentBar.appendChild(pill);
        segmentPillsRef.current.push(pill);
      });
    }

    if (list.length === 0) {
      cardsStage.innerHTML = `<div class="empty-msg">No matching shows found on-chain.</div>`;
      closeEventDetail();
      return;
    }

    targetOffsetRef.current = 0;
    currentOffsetRef.current = 0;
    isLoopModeRef.current = list.length >= 3;

    if (isLoopModeRef.current) {
      for (let s = -3; s <= 3; s++) {
        const el = createCardElement();
        cardsStage.appendChild(el);
        virtualSlotsRef.current.push({ el, slotOffset: s, fixedIdx: null });
      }
    } else {
      list.forEach((_, idx) => {
        const el = createCardElement();
        cardsStage.appendChild(el);
        virtualSlotsRef.current.push({ el, slotOffset: 0, fixedIdx: idx });
      });
    }

    if (selectedIdRef.current != null && !list.some((ev) => ev.id === selectedIdRef.current)) {
      closeEventDetail();
    }
  }, [filteredIdsKey, loading, items.length, closeEventDetail, openEventDetail]);

  // Auto-scroll carousel to ?eventId=... (e.g. from Home holo-ticket) and simulate clicking it
  useEffect(() => {
    if (initialEventId == null) {
      consumedAutoEventIdRef.current = null;
      return;
    }
    if (consumedAutoEventIdRef.current === initialEventId) return;
    if (loading || items.length === 0) return;

    const list = filteredRef.current;
    const targetIdx = list.findIndex((ev) => ev.id === initialEventId);
    if (targetIdx === -1) {
      if (q === "" && selectedCategory === "All") {
        consumedAutoEventIdRef.current = initialEventId;
      }
      return;
    }

    const targetItem = list[targetIdx];
    const n = list.length;
    const isLoop = n >= 3;
    let targetOffset = targetIdx;
    let startOffset = 0;

    if (isLoop) {
      let diff = targetIdx;
      if (diff > n / 2) diff -= n;
      if (diff < -n / 2) diff += n;
      targetOffset = diff;
      if (diff === 0) {
        startOffset = -2;
      } else if (Math.abs(diff) > 4) {
        startOffset = targetOffset - Math.sign(diff) * 3;
      } else {
        startOffset = 0;
      }
    } else if (n === 2) {
      targetOffset = targetIdx;
      startOffset = targetIdx === 0 ? 1 : 0;
    } else {
      targetOffset = 0;
      startOffset = -0.6;
    }

    currentOffsetRef.current = startOffset;
    targetOffsetRef.current = startOffset;

    const pf = { id: targetItem.id, data: null as EventDetail | null, done: false, failed: false };
    arrivalPrefetchRef.current = pf;
    void fetchEvent({ data: { id: targetItem.id } })
      .then((res) => {
        pf.data = res;
        pf.done = true;
        if (selectedIdRef.current === targetItem.id && pendingDrawerTransitionRef.current !== "swap") {
          setDetail(res);
          setDetailLoading(false);
        }
      })
      .catch(() => {
        pf.done = true;
        pf.failed = true;
        if (selectedIdRef.current === targetItem.id) {
          setDetailLoading(false);
          toast.error("Could not load event details.");
        }
      });

    let cancelled = false;
    let launchTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let watchRaf = 0;

    const cancel = (markConsumed: boolean) => {
      if (cancelled) return;
      cancelled = true;
      if (markConsumed) {
        consumedAutoEventIdRef.current = initialEventId;
      }
      if (launchTimer) clearTimeout(launchTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (watchRaf) cancelAnimationFrame(watchRaf);
      autoFocusCancelRef.current = null;
    };

    autoFocusCancelRef.current = () => cancel(true);

    const triggerOpen = () => {
      if (cancelled) return;
      cancel(true);
      targetOffsetRef.current = targetOffset;
      if (!(selectedIdRef.current === targetItem.id && isDetailOpenRef.current)) {
        openEventDetail(targetItem, true);
      }
    };

    launchTimer = setTimeout(() => {
      if (cancelled) return;
      targetOffsetRef.current = targetOffset;
      const glideStart = performance.now();

      const watchSettle = () => {
        if (cancelled) return;
        const remaining = Math.abs(targetOffset - currentOffsetRef.current);
        const elapsed = performance.now() - glideStart;
        if ((remaining < 0.08 && elapsed >= 220) || elapsed >= 950) {
          triggerOpen();
          return;
        }
        watchRaf = requestAnimationFrame(watchSettle);
      };

      watchRaf = requestAnimationFrame(watchSettle);
      fallbackTimer = setTimeout(triggerOpen, 1000);
    }, 90);

    return () => cancel(false);
  }, [initialEventId, filteredIdsKey, loading, items.length, q, selectedCategory, openEventDetail]);

  // Exact port of Search Morph Bar vanilla JS interactions (lines 1383-1422)
  useEffect(() => {
    const morphPill = morphPillRef.current;
    const filterDrawer = filterDrawerRef.current;
    const filterStrip = filterStripRef.current;
    const closeSearchBtn = closeSearchBtnRef.current;
    const searchInput = searchInputRef.current;
    if (!morphPill || !filterDrawer || !filterStrip || !closeSearchBtn || !searchInput) return;

    let openTimer: ReturnType<typeof setTimeout> | null = null;
    let focusTimer: ReturnType<typeof setTimeout> | null = null;

    function onMorphClick() {
      autoFocusCancelRef.current?.();
      if (isSearchExpandedRef.current) return;
      isSearchExpandedRef.current = true;
      morphPill!.classList.add("expanded");

      filterDrawer!.style.height = filterStrip!.scrollHeight + "px";
      filterDrawer!.classList.add("open");
      if (openTimer) clearTimeout(openTimer);
      openTimer = setTimeout(() => {
        if (isSearchExpandedRef.current) filterDrawer!.style.height = "auto";
      }, 450);

      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => searchInput!.focus(), 180);
    }

    function onCloseClick(e: MouseEvent) {
      e.stopPropagation();
      if (!isSearchExpandedRef.current) return;
      isSearchExpandedRef.current = false;

      filterDrawer!.style.height = filterDrawer!.offsetHeight + "px";
      void filterDrawer!.offsetHeight;
      filterDrawer!.classList.remove("open");
      filterDrawer!.style.height = "0px";

      morphPill!.classList.remove("expanded");

      if (searchInput!.value !== "") {
        setQ("");
      }
    }

    morphPill.addEventListener("click", onMorphClick);
    closeSearchBtn.addEventListener("click", onCloseClick);
    return () => {
      if (openTimer) clearTimeout(openTimer);
      if (focusTimer) clearTimeout(focusTimer);
      morphPill.removeEventListener("click", onMorphClick);
      closeSearchBtn.removeEventListener("click", onCloseClick);
    };
  }, []);

  // Prevent text highlighting when dragging with mouse on Marketplace desktop
  useEffect(() => {
    const mainEl = marketplaceMainRef.current;
    if (!mainEl) return;
    function onSelectStart(e: Event) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
    }
    mainEl.addEventListener("selectstart", onSelectStart);
    return () => {
      mainEl.removeEventListener("selectstart", onSelectStart);
    };
  }, []);

  // Main 60fps imperative DOM updateCardTransforms() + renderSpeedStreaks() animation loop
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

    function updateCardTransforms() {
      const list = filteredRef.current;
      const virtualSlots = virtualSlotsRef.current;
      const isLoopMode = isLoopModeRef.current;
      if (list.length === 0 || virtualSlots.length === 0) return;

      const prevOffset = currentOffsetRef.current;
      currentOffsetRef.current += (targetOffsetRef.current - currentOffsetRef.current) * 0.11;
      slideVelocityRef.current = currentOffsetRef.current - prevOffset;

      const centerRound = Math.round(currentOffsetRef.current);
      const activeDataIdx = isLoopMode
        ? mod(centerRound, list.length)
        : clampOffset(centerRound);

      if (activeDataIdx !== lastActiveDataIdxRef.current) {
        lastActiveDataIdxRef.current = activeDataIdx;
        segmentPillsRef.current.forEach((pill, idx) => {
          pill.classList.toggle("active", idx === activeDataIdx);
        });
      }

      const cardSpacing = 310;

      virtualSlots.forEach(({ el, slotOffset, fixedIdx }) => {
        const virtualIdx = isLoopMode ? centerRound + slotOffset : (fixedIdx ?? 0);
        const dataIdx = isLoopMode ? mod(virtualIdx, list.length) : (fixedIdx ?? 0);
        const item = list[dataIdx];
        if (!item) return;

        populateCard(el, item, virtualIdx);

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
      });
    }

    function renderSpeedStreaks() {
      if (!sCtx) return;
      sCtx.clearRect(0, 0, sWidth, sHeight);

      smoothVel += (slideVelocityRef.current - smoothVel) * 0.16;

      const targetEnergy = Math.min(1, Math.abs(smoothVel) * 26);
      const lerpRate = targetEnergy > smoothEnergy ? 0.14 : 0.055;
      smoothEnergy += (targetEnergy - smoothEnergy) * lerpRate;

      if (smoothEnergy < 0.006) return;

      sCtx.save();
      sCtx.globalCompositeOperation = "lighter";
      const directionalPush = -smoothVel * 360;

      streaks.forEach((st) => {
        st.x += directionalPush * (0.4 + st.depth * 0.8);

        const dynamicLen = st.baseLen * (0.5 + smoothEnergy * 1.6);

        if (st.x - dynamicLen > sWidth + 140) {
          st.x = -dynamicLen - 80;
        } else if (st.x + dynamicLen < -140) {
          st.x = sWidth + dynamicLen + 80;
        }

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
      });

      sCtx.restore();
    }

    function animate() {
      updateCardTransforms();
      renderSpeedStreaks();
      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeSpeedCanvas);
    };
  }, [clampOffset, populateCard]);

  // Pointer & horizontal wheel scrubbing on carousel viewport (exact JS port + desktop no-highlight)
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let wheelTimeout: ReturnType<typeof setTimeout> | null = null;

    function syncDetailToSnap() {
      const list = filteredRef.current;
      if (!isDetailOpenRef.current || list.length === 0) return;
      const newIdx = isLoopModeRef.current
        ? mod(targetOffsetRef.current, list.length)
        : targetOffsetRef.current;
      const newItem = list[newIdx];
      if (newItem && newItem.id !== selectedIdRef.current) {
        openEventDetail(newItem, false);
      }
    }

    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("button") || filteredRef.current.length <= 1) return;
      autoFocusCancelRef.current?.();
      if (e.pointerType === "mouse") {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
      }
      isDraggingRef.current = true;
      wasDraggedRef.current = false;
      suppressNextContextMenuRef.current = false;
      dragPointerButtonRef.current = e.button;
      startXRef.current = e.clientX;
      startOffsetRef.current = targetOffsetRef.current;
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - startXRef.current;
      if (Math.abs(dx) > 5) {
        wasDraggedRef.current = true;
        if (dragPointerButtonRef.current === 2) {
          suppressNextContextMenuRef.current = true;
        }
      }
      const raw = startOffsetRef.current - dx / 290;
      if (isLoopModeRef.current) {
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

    function onContextMenu(e: MouseEvent) {
      if (suppressNextContextMenuRef.current || isDraggingRef.current) {
        e.preventDefault();
        suppressNextContextMenuRef.current = false;
      }
    }

    function onWheel(e: WheelEvent) {
      if (filteredRef.current.length <= 1) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        autoFocusCancelRef.current?.();
        const raw = targetOffsetRef.current + e.deltaX * 0.0032;
        targetOffsetRef.current = isLoopModeRef.current ? raw : clampOffset(raw);
        if (wheelTimeout) clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => {
          targetOffsetRef.current = clampOffset(Math.round(targetOffsetRef.current));
          syncDetailToSnap();
        }, 130);
      }
    }

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", onPointerUp);
    viewport.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      if (wheelTimeout) clearTimeout(wheelTimeout);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onPointerUp);
      viewport.removeEventListener("wheel", onWheel);
    };
  }, [clampOffset, openEventDetail]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
      if (heightSettleTimerRef.current) clearTimeout(heightSettleTimerRef.current);
    };
  }, []);

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
              throw new Error(
                "Not enough test coins. Claim 100 DxDAI on the marketplace, then try again.",
              );
            }
          }
          advance(1);
          updateActiveChainRun({
            resumePayload: { action: "buyNow", data: { tierId, chainId: quote.chainId } },
          });
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
          void fetchEvent({ data: { id: eventId } }).then((fresh) => {
            if (selectedIdRef.current === eventId) setDetail(fresh);
          });
          void fetchEvents({ data: { q: "" } }).then(setItems);
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

  return (
    <PublicDarkShell
      navRightPrefix={<FaucetClaimButton chain={chain} />}
      mobileMenuExtra={<FaucetClaimButton chain={chain} mobile />}
    >
      <main
        ref={marketplaceMainRef}
        className="marketplace-shell"
        onDragStart={(e) => e.preventDefault()}
      >
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

          <div className="search-morph-area">
            <div className="morph-pill" id="morphPill" ref={morphPillRef}>
              <div className="pill-closed-face" id="pillClosedFace">
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
                  id="searchInput"
                  type="text"
                  value={q}
                  onChange={(e) => {
                    autoFocusCancelRef.current?.();
                    setQ(e.target.value);
                  }}
                  placeholder="Search by artist, show name, venue or city..."
                />
                <button
                  ref={closeSearchBtnRef}
                  id="closeSearchBtn"
                  type="button"
                  className="close-search-btn"
                  title="Close search"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="filter-drawer" id="filterDrawer" ref={filterDrawerRef}>
              <div className="filter-strip" id="filterStrip" ref={filterStripRef}>
                <button
                  type="button"
                  className={`filter-chip${selectedCategory === "All" ? " active" : ""}`}
                  onClick={() => {
                    autoFocusCancelRef.current?.();
                    setSelectedCategory("All");
                  }}
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
                    onClick={() => {
                      autoFocusCancelRef.current?.();
                      setSelectedCategory(cat);
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="carousel-viewport" id="carouselViewport" ref={viewportRef}>
          <canvas id="speed-canvas" ref={speedCanvasRef} />
          <div className="edge-vignette" />
          <div className="cards-stage-inner" id="cardsStage" ref={cardsStageRef} />
        </section>

        <div className="segment-bar-wrap" id="segmentBar" ref={segmentBarRef} />

        <section className="detail-drawer-outer" id="detailOuter" ref={detailOuterRef}>
          <div className="detail-drawer-inner" id="detailInner" ref={detailInnerRef}>
            {drawerItem ? (
              <div
                className="detail-content-stage"
                id="detailContentStage"
                ref={detailStageRef}
                key={drawerItem.id}
              >
                <DetailContent
                  summary={drawerItem}
                  detail={detail}
                  detailLoading={detailLoading}
                  symbol={symbol}
                  explorer={explorer}
                  ipfsGateway={config?.ipfsGateway}
                  chainName={config?.chainName || "Gnosis Chiado"}
                  me={me}
                  busyTierId={buyingTierId}
                  contractsOpen={contractsOpen}
                  onToggleContracts={() => setContractsOpen((v) => !v)}
                  onClose={closeEventDetail}
                  onCopy={copyText}
                  onBuy={(tierId) => void buy(tierId)}
                />
              </div>
            ) : null}
          </div>
        </section>

        <ChainDialog
          {...chain}
          onClose={chain.close}
          successDetails={
            receipt ? (
              <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-4 text-xs text-fg">
                <div className="mb-2 flex items-center gap-2 font-bold text-success">
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
  summary,
  detail,
  detailLoading,
  symbol,
  explorer,
  ipfsGateway,
  chainName,
  me,
  busyTierId,
  contractsOpen,
  onToggleContracts,
  onClose,
  onCopy,
  onBuy,
}: {
  summary: EventListItem;
  detail: EventDetail | null;
  detailLoading: boolean;
  symbol: string;
  explorer: string;
  ipfsGateway?: string;
  chainName: string;
  me: ReturnType<typeof useSession>["me"];
  busyTierId: number | null;
  contractsOpen: boolean;
  onToggleContracts: () => void;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
  onBuy: (tierId: number) => void;
}) {
  const active = detail ?? summary;
  const posterSrc = active.posterUrl ? resolvePosterUrl(active.posterUrl, ipfsGateway) : "";
  const startDate = new Date(active.startsAt);
  const endDate = new Date(detail?.endsAt ?? active.startsAt);
  const stale = active.engineVersion < 2;
  const closed = active.phase !== "active";

  return (
    <>
      <div className="detail-hero-card">
        <div className="detail-banner" data-theme={themeForEvent(active.id)}>
          {posterSrc ? (
            <>
              <img
                src={posterSrc}
                alt={active.name}
                className="detail-banner-poster"
                draggable={false}
                onError={(e) => {
                  const img = e.currentTarget;
                  const match = posterSrc.match(/\/ipfs\/([^?#]+)/i);
                  const fallback = match?.[1] ? `https://gateway.pinata.cloud/ipfs/${match[1]}` : "";
                  if (fallback && img.getAttribute("src") !== fallback && img.dataset.retried !== "1") {
                    img.dataset.retried = "1";
                    img.src = fallback;
                    return;
                  }
                  img.style.display = "none";
                }}
              />
              <div className="detail-banner-scrim" />
            </>
          ) : null}
          <button type="button" className="detail-close-btn" onClick={onClose}>
            ✕ Close Details
          </button>
          <span className="detail-cat-pill">{active.category || "Live Event"}</span>
          <h2 className="detail-title">{active.name}</h2>
          <div className="detail-meta-row">
            <span>
              📅{" "}
              {startDate.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span>·</span>
            <span>
              🕒 {startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              {detail?.endsAt
                ? ` - ${endDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : ""}
            </span>
            <span>·</span>
            <span>📍 {active.venue || "TBA"}</span>
          </div>
        </div>

        <div className="detail-organizer-bar">
          <div className="org-left">
            {detail?.description ? <div className="org-summary">{detail.description}</div> : null}
            <div className="org-meta">
              <span>
                Organized by{" "}
                <strong>
                  {detail?.organizerName ??
                    (detail?.organizerWallet
                      ? shortAddr(detail.organizerWallet)
                      : active.collectionAddress
                        ? shortAddr(active.collectionAddress)
                        : "On-Chain Event")}
                </strong>
              </span>
              {detail ? (
                <>
                  <span>·</span>
                  <span className="royalty-tag">
                    🛡 Resale Creator Royalty: {(detail.royaltyBps / 100).toFixed(1)}%
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <button type="button" className="btn-contracts" onClick={onToggleContracts}>
            {contractsOpen ? "▼ On-Chain Contracts" : "▶ On-Chain Contracts"}
          </button>
        </div>

        <div className={`contract-info-box${contractsOpen ? " show" : ""}`}>
          {active.collectionAddress ? (
            <span className="inline-flex items-center gap-1.5">
              Ticket NFT (ERC-721):{" "}
              <a
                href={explorerAddress(active.collectionAddress, explorer)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold text-[#86efac] hover:underline"
              >
                {shortAddr(active.collectionAddress)}
                <ExternalLink className="size-3" />
              </a>
              <button
                type="button"
                onClick={() => onCopy(active.collectionAddress!, "Collection Address")}
                className="text-white/50 hover:text-white"
                title="Copy address"
              >
                <Copy className="size-3" />
              </button>
            </span>
          ) : null}

          {detail?.marketplaceAddress ? (
            <span className="inline-flex items-center gap-1.5">
              Resale Pool Escrow:{" "}
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

          <span>
            Chain: <strong style={{ color: "#ffffff" }}>{chainName}</strong>
          </span>
        </div>
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

      {active.frozen ? (
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
          {detail
            ? `${detail.tiers.length} Tier${detail.tiers.length !== 1 ? "s" : ""}`
            : detailLoading
              ? "Syncing Tiers…"
              : "0 Tiers"}
        </span>
      </div>

      <div className="passes-list">
        {detail ? (
          detail.tiers.map((tier) => {
            const isSoldOut = tier.available <= 0;
            const isLocked = busyTierId !== null || isSoldOut || closed || stale || active.frozen;

            return (
              <div key={tier.id} className="pass-ticket-row">
                <div className="pass-left">
                  <div className="pass-tier-name">{tier.name}</div>
                  <div className="pass-sub-info">
                    {tier.available > 0 ? (
                      <span className="rem-green">{tier.available} remaining</span>
                    ) : (
                      <span className="font-semibold text-rose-300">Sold Out</span>
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
                          ? phaseLabel(active.phase)
                          : stale || active.frozen
                            ? "Unavailable"
                            : !me
                              ? "Connect to Buy"
                              : !me.kyc || me.kyc.status !== "approved"
                                ? "KYC Required"
                                : "Buy Pass →"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="pass-ticket-row">
            <div className="pass-left">
              <div className="pass-tier-name">
                {detailLoading ? "Loading tiers…" : "Unavailable"}
              </div>
              <div className="pass-sub-info">Retrieving smart contract inventory</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
