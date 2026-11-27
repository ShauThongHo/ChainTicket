import { createFileRoute, Link } from "@tanstack/react-router";
import QRCode from "qrcode";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { toast } from "sonner";
import { FaucetClaimButton } from "@/components/faucet-claim";
import { PublicDarkShell } from "@/components/public-dark-shell";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import artifacts from "@/lib/abi/core.json";
import { cancelListing, confirmVote, fetchMyTickets, fetchQr, quoteList, sellTicket } from "@/lib/api";
import { friendlyChainError } from "@/lib/chain-errors";
import { explorerToken, gatewayUrl, resolvePosterUrl } from "@/lib/explorer";
import { updateActiveChainRun } from "@/lib/tx-state";
import type { MyTicket, QrPayload } from "@/lib/types";
import { formatAmount, paySymbol, priceBounds } from "@/lib/utils";

export const Route = createFileRoute("/my-tickets")({ component: MyTicketsPage });

const THEMES = ["emerald", "amber", "crimson", "cyan", "violet"] as const;
const LOOP_STRIDE = 300;
const CARD_WIDTH = 280;

type FolderKind = "unused" | "used";

function themeForTicket(eventId: number) {
  return THEMES[Math.abs(eventId) % THEMES.length];
}

function isPastTicket(t: MyTicket) {
  return t.status === "used" || t.status === "refunded" || t.phase === "ended" || t.phase === "cancelled";
}

function ticketStatusInfo(t: MyTicket) {
  if (t.status === "listed") return { label: "Listed", badgeClass: "listed" };
  if (t.status === "used") return { label: "Used", badgeClass: "ended" };
  if (t.status === "refunded") return { label: "Refunded", badgeClass: "danger" };
  if (t.phase === "cancelled") return { label: "Cancelled", badgeClass: "danger" };
  if (t.phase === "ended") return { label: "Ended", badgeClass: "ended" };
  return { label: "Active", badgeClass: "active" };
}

function ticketArtCaption(t: MyTicket) {
  if (t.status === "listed") return "SECONDARY POOL · ESCROWED";
  if (t.status === "used") return "CHECKED IN · ARCHIVED";
  if (t.status === "refunded") return "REFUNDED · SETTLED";
  if (t.phase === "cancelled") return "EVENT CANCELLED";
  if (t.phase === "ended") return "NFT PASS · ADMIT ONE";
  return `${t.tierName.toUpperCase()} · GATE PASS`;
}

function ticketDisplayPrice(t: MyTicket, symbol: string) {
  if (t.status === "listed" && t.listPriceCents != null) {
    return formatAmount(t.listPriceCents, symbol);
  }
  return formatAmount(t.faceCents, symbol);
}

function computeCardFlipTransform(
  cardEl: HTMLElement | null,
  modalEl: HTMLElement | null,
  rotX = -16,
  rotY = 14,
) {
  if (!cardEl || !modalEl) {
    return `perspective(1200px) translate3d(0px, 24px, 0px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(0.62)`;
  }
  const src = cardEl.getBoundingClientRect();
  const dst = modalEl.getBoundingClientRect();
  if (!dst.width || !dst.height) {
    return `perspective(1200px) translate3d(0px, 24px, 0px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(0.62)`;
  }

  const srcCx = src.left + src.width / 2;
  const srcCy = src.top + src.height / 2;
  const dstCx = dst.left + dst.width / 2;
  const dstCy = dst.top + dst.height / 2;

  const dx = srcCx - dstCx;
  const dy = srcCy - dstCy;
  const uniformScale = Math.max(
    0.42,
    Math.min(0.75, (src.width / dst.width + src.height / dst.height) / 2),
  );

  return `perspective(1200px) translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${uniformScale.toFixed(3)})`;
}

function MyTicketsPage() {
  const { me, config } = useSession();
  const chain = useChainRun();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const symbol = paySymbol(config);

  const [openFolder, setOpenFolder] = useState<FolderKind | null>(null);
  const [animatePopKey, setAnimatePopKey] = useState(0);
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);

  const [inspectedTicketId, setInspectedTicketId] = useState<number | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const lastClickedCardRef = useRef<HTMLElement | null>(null);
  const detailCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Desktop carousel refs (60fps imperative loop + mouse left/right drag without text highlight)
  const desktopViewportRef = useRef<HTMLDivElement | null>(null);
  const loopCardRefs = useRef<(HTMLElement | null)[]>([]);
  const loopScrollXRef = useRef(0);
  const isLoopPausedRef = useRef(false);
  const isLoopDraggingRef = useRef(false);
  const wasLoopDraggedRef = useRef(false);
  const dragPointerButtonRef = useRef(0);
  const suppressNextContextMenuRef = useRef(false);
  const loopDragStartXRef = useRef(0);
  const loopDragStartScrollRef = useRef(0);

  const [walletLayoutVars, setWalletLayoutVars] = useState({ cardH: 235, overlap: -110 });

  const reload = useCallback(async () => {
    try {
      const rows = await fetchMyTickets();
      setTickets(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!me) {
      setTickets([]);
      setOpenFolder(null);
      setMobileOverlayOpen(false);
      setInspectedTicketId(null);
      setDetailModalOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    void reload();
    const id = setInterval(() => void reload(), 5000);
    return () => clearInterval(id);
  }, [me, reload]);

  const unusedPasses = useMemo(() => tickets.filter((t) => !isPastTicket(t)), [tickets]);
  const usedPasses = useMemo(() => tickets.filter(isPastTicket), [tickets]);
  const activeFolderTickets = useMemo(() => {
    if (openFolder === "unused") return unusedPasses;
    if (openFolder === "used") return usedPasses;
    return [];
  }, [openFolder, unusedPasses, usedPasses]);

  const inspectedTicket = useMemo(
    () => tickets.find((t) => t.id === inspectedTicketId) ?? null,
    [tickets, inspectedTicketId],
  );

  // Desktop marquee repeats >= 2 items to >= 6 slots like the prototype; 1 item stays centered cleanly
  const desktopDisplayCards = useMemo(() => {
    if (activeFolderTickets.length === 0) return [];
    if (activeFolderTickets.length === 1) return [activeFolderTickets[0]];
    const repeated: MyTicket[] = [];
    while (repeated.length < 6) {
      repeated.push(...activeFolderTickets);
    }
    return repeated;
  }, [activeFolderTickets]);

  const shouldLoopScroll = desktopDisplayCards.length >= 4;

  // Reset scroll offset on intentional folder open / switch, preserving offset during 5s polling
  useEffect(() => {
    loopScrollXRef.current = 0;
  }, [animatePopKey]);

  // Mobile card stack geometry calculation
  const syncMobileWalletVars = useCallback((count: number) => {
    if (typeof window === "undefined") return;
    const availableH = Math.max(460, window.innerHeight - 124);
    const cardH = Math.min(265, Math.max(205, Math.round(availableH * 0.43)));
    let step = count > 1 ? Math.floor((availableH - cardH) / (count - 1)) : 0;
    step = Math.min(cardH - 22, Math.max(82, step));
    const overlap = count > 1 ? -(cardH - step) : 0;
    setWalletLayoutVars({ cardH, overlap });
  }, []);

  useEffect(() => {
    if (!mobileOverlayOpen) return;
    syncMobileWalletVars(activeFolderTickets.length);
    const onResize = () => syncMobileWalletVars(activeFolderTickets.length);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mobileOverlayOpen, activeFolderTickets.length, syncMobileWalletVars]);

  // Continuous 60fps desktop loop animation
  useEffect(() => {
    if (!me || !openFolder || desktopDisplayCards.length === 0) return;

    let rafId = 0;
    const totalWidth = desktopDisplayCards.length * LOOP_STRIDE;

    function updatePositions() {
      const vpWidth = desktopViewportRef.current?.clientWidth || 1120;
      if (shouldLoopScroll && !isLoopPausedRef.current && !isLoopDraggingRef.current) {
        loopScrollXRef.current += 0.55;
      }

      const contentWidth =
        desktopDisplayCards.length === 1
          ? CARD_WIDTH
          : totalWidth;
      const centerOffset = Math.max(0, (vpWidth - contentWidth) / 2);

      loopCardRefs.current.forEach((card, i) => {
        if (!card) return;
        let x: number;
        if (shouldLoopScroll) {
          x = i * LOOP_STRIDE - loopScrollXRef.current;
          x = ((x % totalWidth) + totalWidth) % totalWidth;
          if (x > totalWidth - LOOP_STRIDE) {
            x -= totalWidth;
          }
        } else {
          x = i * LOOP_STRIDE;
        }
        card.style.transform = `translate3d(${(x + centerOffset).toFixed(1)}px, 0, 0)`;
      });
    }

    function tick() {
      updatePositions();
      rafId = requestAnimationFrame(tick);
    }

    updatePositions();
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [me, openFolder, desktopDisplayCards.length, shouldLoopScroll]);

  // Desktop viewport drag (left & right mouse buttons without highlight) & horizontal wheel
  useEffect(() => {
    const viewport = desktopViewportRef.current;
    if (!viewport || !me) return;

    function onPointerDown(e: PointerEvent) {
      if (!shouldLoopScroll) return;
      if (e.pointerType === "mouse") {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
      }
      isLoopDraggingRef.current = true;
      wasLoopDraggedRef.current = false;
      suppressNextContextMenuRef.current = false;
      dragPointerButtonRef.current = e.button;
      loopDragStartXRef.current = e.clientX;
      loopDragStartScrollRef.current = loopScrollXRef.current;
    }

    function onPointerMove(e: PointerEvent) {
      if (!isLoopDraggingRef.current) return;
      const dx = e.clientX - loopDragStartXRef.current;
      if (Math.abs(dx) > 5) {
        wasLoopDraggedRef.current = true;
        if (dragPointerButtonRef.current === 2) {
          suppressNextContextMenuRef.current = true;
        }
      }
      loopScrollXRef.current = loopDragStartScrollRef.current - dx;
    }

    function onPointerUp() {
      isLoopDraggingRef.current = false;
    }

    function onContextMenu(e: MouseEvent) {
      if (suppressNextContextMenuRef.current || isLoopDraggingRef.current) {
        e.preventDefault();
        suppressNextContextMenuRef.current = false;
      }
    }

    function onWheel(e: WheelEvent) {
      if (!shouldLoopScroll) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        loopScrollXRef.current += e.deltaX;
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
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onPointerUp);
      viewport.removeEventListener("wheel", onWheel);
    };
  }, [me, shouldLoopScroll]);

  const closeDetailModal = useCallback(() => {
    if (!detailModalOpen) return;
    if (detailCloseTimerRef.current) clearTimeout(detailCloseTimerRef.current);
    setDetailModalOpen(false);
    isLoopPausedRef.current = false;
    detailCloseTimerRef.current = setTimeout(() => {
      setInspectedTicketId(null);
    }, 340);
  }, [detailModalOpen]);

  const openDetailModal = useCallback((ticketId: number, cardEl: HTMLElement | null) => {
    if (detailCloseTimerRef.current) clearTimeout(detailCloseTimerRef.current);
    lastClickedCardRef.current = cardEl;
    isLoopPausedRef.current = true;
    setInspectedTicketId(ticketId);
    setDetailModalOpen(true);
  }, []);

  useEffect(() => {
    return () => {
      if (detailCloseTimerRef.current) clearTimeout(detailCloseTimerRef.current);
    };
  }, []);

  // Escape closes top overlay cleanly unless a ChainDialog transaction is open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || chain.open) return;
      if (detailModalOpen) {
        closeDetailModal();
      } else {
        setMobileOverlayOpen(false);
        setOpenFolder(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chain.open, detailModalOpen, closeDetailModal]);

  function openDesktopFolder(folderType: FolderKind) {
    setOpenFolder(folderType);
    setAnimatePopKey((k) => k + 1);
  }

  function handleFolderClick(folderType: FolderKind) {
    const isDesktop = typeof window !== "undefined" ? window.innerWidth >= 821 : true;
    if (isDesktop) {
      if (openFolder) {
        openDesktopFolder(openFolder === "unused" ? "used" : "unused");
        return;
      }
      openDesktopFolder(folderType);
    } else {
      const targetList = folderType === "unused" ? unusedPasses : usedPasses;
      syncMobileWalletVars(targetList.length);
      setOpenFolder(folderType);
      requestAnimationFrame(() => setMobileOverlayOpen(true));
    }
  }

  function closeDesktopFan() {
    setOpenFolder(null);
  }

  function closeMobileOverlay() {
    setMobileOverlayOpen(false);
  }

  if (!me) {
    return (
      <PublicDarkShell
      navRightPrefix={<FaucetClaimButton chain={chain} />}
      mobileMenuExtra={<FaucetClaimButton chain={chain} mobile />}
    >
        <main className="vault-shell">
          <section className="glass-vault-panel">
            <div className="wallet-icon-box">
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
              </svg>
            </div>

            <h2 className="vault-title">Connect Your Wallet</h2>
            <p className="vault-desc">
              Connect your Web3 wallet to access your encrypted digital ticket vault and dynamic
              gate passes.
            </p>

            <div className="vault-actions">
              <Link to="/marketplace" className="btn-browse-shows">
                Browse Shows →
              </Link>
            </div>
          </section>
        </main>
      </PublicDarkShell>
    );
  }

  const desktopFolderLabel =
    openFolder === "unused"
      ? `Unused Passes (${unusedPasses.length}) · Click any pass to inspect`
      : `Used & History (${usedPasses.length}) · Click any pass to inspect`;

  return (
    <PublicDarkShell
      navRightPrefix={<FaucetClaimButton chain={chain} />}
      mobileMenuExtra={<FaucetClaimButton chain={chain} mobile />}
    >
      <main
        className={`archive-stage${openFolder && !mobileOverlayOpen ? " desktop-folder-open" : ""}`}
        id="archiveStage"
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="archive-hero-header">
          <div className="kicker-pill">
            Encrypted On-Chain Vault ·{" "}
            <span>
              {loading
                ? "Syncing Passes..."
                : `${tickets.length} Verified Pass${tickets.length === 1 ? "" : "es"}`}
            </span>
          </div>
          <h1 className="archive-title">
            Ticket <em>Archive</em>
          </h1>
          <p className="archive-subtitle">
            Select a folder below to inspect your unused gate passes or review past show history and
            organizer payout governance.
          </p>
        </div>

        {/* Desktop Carousel Fan Stage */}
        <section className="desktop-fan-stage" id="desktopFanStage">
          <div className="desktop-fan-toolbar">
            <span className="desktop-folder-badge" id="desktopFolderLabel">
              {desktopFolderLabel}
            </span>
            <button
              className="btn-desktop-collapse"
              id="desktopCollapseBtn"
              type="button"
              onClick={closeDesktopFan}
            >
              ↓ Return to Folders
            </button>
          </div>

          <div
            ref={desktopViewportRef}
            className={`desktop-carousel-viewport${desktopDisplayCards.length === 0 ? " is-empty-track" : ""}`}
            id="desktopCarouselViewport"
            onMouseEnter={() => {
              isLoopPausedRef.current = true;
            }}
            onMouseLeave={() => {
              if (!detailModalOpen) isLoopPausedRef.current = false;
              isLoopDraggingRef.current = false;
            }}
          >
            {desktopDisplayCards.length === 0 ? (
              <div className="archive-empty-track">
                <p className="text-sm text-white/65">
                  {loading
                    ? "Loading your passes..."
                    : openFolder === "unused"
                      ? "You do not have any upcoming or active passes yet."
                      : "You do not have any past or used passes yet."}
                </p>
                <Link to="/marketplace" className="folder-action-pill">
                  Explore Marketplace →
                </Link>
              </div>
            ) : (
              <div className="desktop-carousel-track" id="desktopCarouselTrack">
                {desktopDisplayCards.map((item, idx) => {
                  const { label } = ticketStatusInfo(item);
                  return (
                    <article
                      key={`${openFolder}-${item.id}-${idx}-${animatePopKey}`}
                      ref={(el) => {
                        loopCardRefs.current[idx] = el;
                      }}
                      className={`desktop-loop-card${animatePopKey > 0 ? " popping-out" : ""}`}
                      data-theme={themeForTicket(item.eventId)}
                      data-key={`${item.id}`}
                      style={{ animationDelay: `${Math.min(idx, 4) * 0.06}s` }}
                      onClick={(e) => {
                        if (wasLoopDraggedRef.current) return;
                        openDetailModal(item.id, e.currentTarget);
                      }}
                    >
                      <div className="folder-halftone" />
                      <div>
                        <div className="wcard-header">
                          <div>
                            <div className="wcard-brand">
                              NFT #{item.chainId ?? item.serial} · {label}
                            </div>
                            <h3 className="wcard-title">{item.eventName}</h3>
                          </div>
                          <span className="wcard-tier-pill">{item.tierName}</span>
                        </div>

                        <div className="wcard-sub-meta">
                          <span>📅 {new Date(item.startsAt).toLocaleString()}</span>
                        </div>
                        <div className="wcard-sub-meta">
                          <span>📍 {item.venue || "TBA"}</span>
                        </div>
                      </div>

                      <div className="compact-card-footer">
                        <strong style={{ color: "#ffffff" }}>
                          {ticketDisplayPrice(item, symbol)}
                        </strong>
                        <span className="compact-inspect-cue">Details ↗</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <svg className="fan-beams-svg" viewBox="0 0 960 64" preserveAspectRatio="none">
            <defs>
              <linearGradient id="beamGradL" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0.06" />
              </linearGradient>
              <linearGradient id="beamGradR" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0.06" />
              </linearGradient>
            </defs>
            <line
              x1="120"
              y1="2"
              x2="290"
              y2="62"
              stroke="url(#beamGradL)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <line
              x1="840"
              y1="2"
              x2="670"
              y2="62"
              stroke="url(#beamGradR)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
          </svg>
        </section>

        {/* Two Stacked Frosted Folders */}
        <section className="folders-stack-container">
          <div
            className={`file-folder folder-unused${openFolder === "unused" && !mobileOverlayOpen ? " is-active-folder" : ""}`}
            id="folderUnused"
            onClick={() => handleFolderClick("unused")}
          >
            <div className="folder-tab-row">
              <div className="folder-tab">
                <span>Unused Passes</span>
                <span className="tab-count-pill" id="unusedCountBadge">
                  {unusedPasses.length}
                </span>
              </div>
            </div>
            <div className="folder-body">
              <div className="folder-halftone" />
              <div className="folder-info-left">
                <h2 className="folder-heading">Active &amp; Upcoming Passes</h2>
                <p className="folder-desc">
                  Valid ERC-721 event tickets ready for venue gate scanning with HMAC-SHA256
                  rotating QR codes or verified resale listing.
                </p>
              </div>
              <button
                className="folder-action-pill"
                id="unusedHintPill"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    typeof window !== "undefined" &&
                    window.innerWidth >= 821 &&
                    openFolder !== null
                  ) {
                    openDesktopFolder("used");
                  } else {
                    handleFolderClick("unused");
                  }
                }}
              >
                {openFolder && !mobileOverlayOpen ? "Switch to Used & History ⇄" : "Open Passes →"}
              </button>
            </div>
          </div>

          <div
            className={`file-folder folder-used${openFolder === "used" && !mobileOverlayOpen ? " is-active-folder" : ""}`}
            id="folderUsed"
            onClick={() => handleFolderClick("used")}
          >
            <div className="folder-tab-row">
              <div className="folder-tab">
                <span>Used &amp; History</span>
                <span className="tab-count-pill" id="usedCountBadge">
                  {usedPasses.length}
                </span>
              </div>
            </div>
            <div className="folder-body">
              <div className="folder-halftone" />
              <div className="folder-info-left">
                <h2 className="folder-heading">Past Events &amp; Payout Governance</h2>
                <p className="folder-desc">
                  Completed event stubs, locked gate passes, and active organizer payout proposals
                  open for attendee objection voting.
                </p>
              </div>
              <button
                className="folder-action-pill"
                id="usedHintPill"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    typeof window !== "undefined" &&
                    window.innerWidth >= 821 &&
                    openFolder !== null
                  ) {
                    openDesktopFolder("unused");
                  } else {
                    handleFolderClick("used");
                  }
                }}
              >
                {openFolder && !mobileOverlayOpen
                  ? "Switch to Unused Passes ⇄"
                  : "Open Passes →"}
              </button>

              <div className="folder-footer-strip">
                <span>HMAC-SHA256 VERIFIED ARCHIVE</span>
                <span>{config?.chainName ? `${config.chainName.toUpperCase()} / ${symbol}` : "GNOSIS / DxDAI L2"}</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile Fullscreen Card Stack Overlay */}
      <div
        className={`wallet-overlay${mobileOverlayOpen ? " open" : ""}`}
        id="walletOverlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeMobileOverlay();
        }}
      >
        <button
          className="btn-wallet-close"
          id="closeWalletBtn"
          type="button"
          title="Back to Folders"
          onClick={closeMobileOverlay}
        >
          ✕
        </button>

        <div
          className="wallet-cards-stack"
          id="walletCardsStack"
          style={
            {
              "--wallet-card-h": `${walletLayoutVars.cardH}px`,
              "--wallet-overlap": `${walletLayoutVars.overlap}px`,
            } as CSSProperties
          }
        >
          {mobileOverlayOpen && activeFolderTickets.length === 0 ? (
            <div className="archive-empty-track my-auto max-h-[260px]">
              <p className="text-sm text-white/65">
                {loading
                  ? "Loading your passes..."
                  : openFolder === "unused"
                    ? "You do not have any unused passes yet."
                    : "You do not have any past event passes yet."}
              </p>
            </div>
          ) : (
            activeFolderTickets.map((item, index) => {
              const { label } = ticketStatusInfo(item);
              return (
                <article
                  key={`mobile-${openFolder}-${item.id}`}
                  className="wallet-pass-card"
                  data-theme={themeForTicket(item.eventId)}
                  data-key={`${item.id}`}
                  style={{ animationDelay: `${index * 0.045}s` }}
                  onClick={(e) => openDetailModal(item.id, e.currentTarget)}
                >
                  <div className="folder-halftone" />
                  <div>
                    <div className="wcard-header">
                      <div>
                        <div className="wcard-brand">
                          NFT #{item.chainId ?? item.serial} · {label}
                        </div>
                        <h3 className="wcard-title">{item.eventName}</h3>
                      </div>
                      <span className="wcard-tier-pill">{item.tierName}</span>
                    </div>

                    <div className="wcard-sub-meta">
                      <span>📅 {new Date(item.startsAt).toLocaleString()}</span>
                    </div>
                    <div className="wcard-sub-meta">
                      <span>📍 {item.venue || "TBA"}</span>
                    </div>
                  </div>

                  <div className="wcard-compact-footer">
                    <strong style={{ color: "#ffffff" }}>
                      {ticketDisplayPrice(item, symbol)}
                    </strong>
                    <span className="wcard-inspect-cue">Details ↗</span>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <Link to="/marketplace" className="wallet-bottom-link">
          Explore more shows in Marketplace →
        </Link>
      </div>

      {/* 3D Flip Pass Detail Modal */}
      <PassDetailModal
        ticket={inspectedTicket}
        open={detailModalOpen}
        anchorCardRef={lastClickedCardRef}
        symbol={symbol}
        explorer={config?.explorerUrl ?? ""}
        ipfsGateway={config?.ipfsGateway}
        chain={chain}
        onChanged={() => void reload()}
        onClose={closeDetailModal}
      />

      <ChainDialog {...chain} onClose={chain.close} />
    </PublicDarkShell>
  );
}

function PassDetailModal({
  ticket,
  open,
  anchorCardRef,
  symbol,
  explorer,
  ipfsGateway,
  chain,
  onChanged,
  onClose,
}: {
  ticket: MyTicket | null;
  open: boolean;
  anchorCardRef: React.RefObject<HTMLElement | null>;
  symbol: string;
  explorer: string;
  ipfsGateway?: string;
  chain: ReturnType<typeof useChainRun>;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { sendUserCall } = useSession();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const resellInputRef = useRef<HTMLInputElement | null>(null);

  const [art, setArt] = useState("");
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [isResellOpen, setIsResellOpen] = useState(false);
  const [resellPrice, setResellPrice] = useState("");

  const ticketId = ticket?.id ?? null;
  const posterUrl = ticket?.posterUrl ?? "";
  const tokenUri = ticket?.tokenUri ?? null;
  const ticketStatus = ticket?.status ?? null;
  const ticketPhase = ticket?.phase ?? null;

  // Resolve poster artwork (from posterUrl or decentralized metadata) for Detail Modal only
  useEffect(() => {
    if (ticketId === null) {
      setArt("");
      return;
    }
    const direct = resolvePosterUrl(posterUrl, ipfsGateway);
    setArt(direct);
    if (direct || !tokenUri) return;

    let stop = false;
    fetch(gatewayUrl(tokenUri, ipfsGateway))
      .then((r) => r.json())
      .then((json: { image?: string }) => {
        if (stop || typeof json.image !== "string" || !json.image) return;
        setArt(resolvePosterUrl(json.image, ipfsGateway));
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [ticketId, posterUrl, tokenUri, ipfsGateway]);

  // Dynamic QR polling while modal is open for active owned tickets
  useEffect(() => {
    if (ticketId === null || !open || ticketStatus !== "owned" || ticketPhase !== "active") {
      setQr(null);
      setQrImg(null);
      return;
    }
    let stop = false;
    const currentTicketId = ticketId;
    async function tick() {
      try {
        const data = await fetchQr({ data: { ticketId: currentTicketId } });
        if (stop) return;
        setQr(data);
        if (data.payload) {
          setQrImg(await QRCode.toDataURL(data.payload, { margin: 1, width: 280 }));
        } else {
          setQrImg(null);
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
  }, [ticketId, ticketStatus, ticketPhase, open]);

  // Reset resell inline state when inspecting a different pass
  useEffect(() => {
    setIsResellOpen(false);
    setResellPrice("");
  }, [ticketId, open]);

  // 3D FLIP entrance & exit transition anchored to clicked card
  useLayoutEffect(() => {
    const modal = modalRef.current;
    if (!modal || ticketId === null) return;

    if (open) {
      modal.style.transition = "none";
      modal.style.transform = computeCardFlipTransform(anchorCardRef.current, modal, -18, 16);
      modal.style.opacity = "0";
      void modal.offsetHeight;

      const rafId = requestAnimationFrame(() => {
        modal.style.transition =
          "transform 0.44s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)";
        modal.style.transform =
          "perspective(1200px) translate3d(0px, 0px, 0px) rotateX(0deg) rotateY(0deg) scale(1)";
        modal.style.opacity = "1";
      });
      return () => cancelAnimationFrame(rafId);
    }

    const endTransform = computeCardFlipTransform(anchorCardRef.current, modal, 14, -14);
    modal.style.transition =
      "transform 0.32s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.24s ease";
    modal.style.transform = endTransform;
    modal.style.opacity = "0";
  }, [open, ticketId, anchorCardRef]);

  const unlockLabel = useMemo(() => {
    if (!qr?.unlocksAt) return null;
    const ms = new Date(qr.unlocksAt).getTime() - Date.now();
    if (ms <= 0) return "Unlocked";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `Unlocks in ${h}h ${m}m`;
  }, [qr]);

  if (!ticket) {
    return (
      <div className="pass-detail-backdrop" id="passDetailBackdrop">
        <div className="pass-detail-modal" id="passDetailModal" ref={modalRef} role="dialog" aria-modal="true" />
      </div>
    );
  }

  const bounds = priceBounds(ticket.faceCents);
  const minDx = +(bounds.min / 100).toFixed(2);
  const maxDx = +(bounds.max / 100).toFixed(2);
  const faceDx = +(ticket.faceCents / 100).toFixed(2);

  const numericResell = parseFloat(resellPrice);
  const parsedCents = Math.round(numericResell * 100);
  const isResellValid =
    Number.isFinite(numericResell) && parsedCents >= bounds.min && parsedCents <= bounds.max;
  const isMinusActive = isResellValid && Math.abs(numericResell - minDx) < 0.005;
  const isFaceActive = isResellValid && Math.abs(numericResell - faceDx) < 0.005;
  const isPlusActive = isResellValid && Math.abs(numericResell - maxDx) < 0.005;

  const live = ticket.phase === "active";
  const market = ticket.marketplaceAddress || "";
  const { label: statusLabel, badgeClass } = ticketStatusInfo(ticket);
  const canVote =
    ticket.proposal?.status === "pending_vote" &&
    !ticket.proposal.hasVoted &&
    (ticket.status === "owned" || ticket.status === "listed" || ticket.status === "used");
  const opposing = ticket.engineVersion >= 4;

  function openResellForm() {
    setIsResellOpen(true);
    setResellPrice(faceDx.toFixed(2));
    requestAnimationFrame(() => {
      resellInputRef.current?.focus();
      resellInputRef.current?.select();
    });
  }

  async function listPass() {
    if (!ticket) return;
    if (!ticket.chainId) {
      toast.error("Ticket is not confirmed on-chain.");
      return;
    }
    if (!isResellValid) {
      toast.error(
        `Price must be within 90%~110% bound: ${formatAmount(bounds.min, symbol)} – ${formatAmount(bounds.max, symbol)}`,
      );
      return;
    }
    setBusy(true);
    try {
      await chain.run({
        title: "List ticket on secondary market",
        labels: ["Check ticket price", "Confirm listing in your wallet", "Save your listing"],
        task: async (advance) => {
          const quote = await quoteList({ data: { ticketId: ticket.id, priceCents: parsedCents } });
          if (!quote.marketplace) throw new Error("No marketplace contract.");
          advance(1);
          updateActiveChainRun({
            resumePayload: {
              action: "sellTicket",
              data: { ticketId: ticket.id, priceCents: parsedCents },
            },
          });
          const hash = await sendUserCall({
            to: quote.marketplace as `0x${string}`,
            abi: artifacts.EventMarketplace.abi,
            functionName: "list",
            args: [BigInt(quote.chainId), BigInt(quote.priceWei)],
          });
          advance(2);
          await sellTicket({
            data: { ticketId: ticket.id, priceCents: parsedCents, txHash: hash },
          });
          setIsResellOpen(false);
          onChanged();
          return "Your ticket is now listed for resale.";
        },
        retry: () => void listPass(),
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    } finally {
      setBusy(false);
    }
  }

  async function delistPass() {
    if (!ticket || !ticket.chainId || !market) return;
    setBusy(true);
    try {
      await chain.run({
        title: "Remove your ticket listing",
        labels: ["Confirm cancellation in your wallet", "Save the update"],
        task: async (advance) => {
          advance(0);
          updateActiveChainRun({
            resumePayload: { action: "cancelListing", data: { ticketId: ticket.id } },
          });
          const hash = await sendUserCall({
            to: market as `0x${string}`,
            abi: artifacts.EventMarketplace.abi,
            functionName: "delist",
            args: [BigInt(ticket.chainId!)],
          });
          advance(1);
          await cancelListing({ data: { ticketId: ticket.id, txHash: hash } });
          onChanged();
          return "Your ticket is back in your wallet as an active pass.";
        },
        retry: () => void delistPass(),
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    } finally {
      setBusy(false);
    }
  }

  async function voteProposal() {
    if (!ticket || !ticket.chainId || !market) {
      toast.error("This ticket has no marketplace vote.");
      return;
    }
    setBusy(true);
    const labels = [
      opposing
        ? "Confirm your objection in your wallet"
        : "Confirm your support vote in your wallet",
      "Record your vote",
    ];
    try {
      await chain.run({
        title: opposing ? "Object to organizer payout" : "Vote on organizer payout",
        labels,
        task: async (advance) => {
          advance(0);
          updateActiveChainRun({
            resumePayload: { action: "confirmVote", data: { ticketId: ticket.id } },
          });
          const hash = await sendUserCall({
            to: market as `0x${string}`,
            abi: artifacts.EventMarketplace.abi,
            functionName: "vote",
            args: [BigInt(ticket.chainId!)],
          });
          advance(1);
          await confirmVote({ data: { ticketId: ticket.id, txHash: hash } });
          onChanged();
          return opposing
            ? "Your objection was recorded for this ticket."
            : "Your support vote was recorded.";
        },
        retry: () => void voteProposal(),
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    } finally {
      setBusy(false);
    }
  }

  let leftGateContent: React.ReactNode;
  if (ticket.status === "listed") {
    leftGateContent = (
      <div className="dmodal-gate-box resale-box">
        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
          <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
        </svg>
        <div className="text-[0.84rem] font-semibold text-[#fde68a]">Listed for Resale</div>
        <div className="text-[0.72rem] leading-[1.45] text-white/56">
          Entry barcode is locked while this pass is listed in the secondary pool.
        </div>
      </div>
    );
  } else if (ticket.status === "owned" && ticket.phase === "active" && qrImg) {
    leftGateContent = (
      <div className="dmodal-gate-box ready-box">
        <div className="dmodal-qr-frame">
          <div className="scan-laser-line" />
          <img src={qrImg} alt="Dynamic gate QR" />
        </div>
        <div className="text-[0.84rem] font-semibold text-[#86efac]">Dynamic QR Active</div>
        <div className="text-[0.7rem] text-white/55">Refreshes every 15s</div>
      </div>
    );
  } else if (ticket.status === "owned" && ticket.phase === "active") {
    leftGateContent = (
      <div className="dmodal-gate-box">
        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <div className="text-[0.84rem] font-semibold text-white">Gate Pass Locked</div>
        <div className="text-[0.72rem] text-white/52">
          {qr?.reason ?? "QR unlocks 2 hours before doors."}
        </div>
        {unlockLabel ? <span className="unlock-countdown-pill">🕒 {unlockLabel}</span> : null}
      </div>
    );
  } else {
    leftGateContent = (
      <div className="dmodal-gate-box">
        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <div className="text-[0.84rem] font-semibold text-white">Gate Pass Locked</div>
        <div className="text-[0.72rem] text-white/52">
          {ticket.status === "used"
            ? "Checked in at the venue."
            : ticket.status === "refunded"
              ? "Ticket refunded."
              : ticket.phase === "cancelled"
                ? "Event has been cancelled."
                : "Event has ended."}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pass-detail-backdrop${open ? " open" : ""}`}
      id="passDetailBackdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="pass-detail-modal"
        id="passDetailModal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
      >
        <button
          className="modal-close-btn"
          type="button"
          onClick={onClose}
          title="Close"
        >
          ✕
        </button>

        <div className="dmodal-left">
          <div className="dmodal-art" data-theme={themeForTicket(ticket.eventId)}>
            {art ? (
              <>
                <img
                  src={art}
                  alt={ticket.eventName}
                  className="dmodal-art-poster"
                  draggable={false}
                  onError={(e) => {
                    const imgEl = e.currentTarget;
                    const match = art.match(/\/ipfs\/([^?#]+)/i);
                    const fallback = match?.[1]
                      ? `https://gateway.pinata.cloud/ipfs/${match[1]}`
                      : "";
                    if (
                      fallback &&
                      imgEl.getAttribute("src") !== fallback &&
                      imgEl.dataset.retried !== "1"
                    ) {
                      imgEl.dataset.retried = "1";
                      imgEl.src = fallback;
                      return;
                    }
                    imgEl.style.display = "none";
                  }}
                />
                <div className="dmodal-art-scrim" />
              </>
            ) : null}
            <div className="folder-halftone" />
            <span className="nft-corner-tag">NFT #{ticket.chainId ?? ticket.serial}</span>
            <span className="art-caption">{ticketArtCaption(ticket)}</span>
          </div>

          {leftGateContent}

          <div className="hmac-footer">HMAC-SHA256 Encrypted Verification</div>
        </div>

        <div className="dmodal-right">
          <div>
            <div className="dmodal-top-row">
              <div className="tag-row">
                <span className={`d-badge ${badgeClass}`}>{statusLabel}</span>
                <span className="d-badge owned">{ticket.status.toUpperCase()}</span>
                <span className="d-badge tier">{ticket.tierName}</span>
              </div>
              <div className="face-price-text">
                Face: <strong>{formatAmount(ticket.faceCents, symbol)}</strong>
              </div>
            </div>

            <h2 className="dmodal-title">{ticket.eventName}</h2>

            <div className="dmodal-meta-line">
              <span>📅 {new Date(ticket.startsAt).toLocaleString()}</span>
              <span>·</span>
              <span>📍 {ticket.venue || "TBA"}</span>
            </div>

            <div className="dmodal-links-line">
              {ticket.collectionAddress && ticket.chainId ? (
                <a
                  href={explorerToken(ticket.collectionAddress, ticket.chainId, explorer)}
                  target="_blank"
                  rel="noreferrer"
                  className="chain-ext-link"
                >
                  Token #{ticket.chainId} ↗
                </a>
              ) : null}
              {ticket.tokenUri ? (
                <a
                  href={gatewayUrl(ticket.tokenUri, ipfsGateway)}
                  target="_blank"
                  rel="noreferrer"
                  className="chain-ext-link"
                >
                  Decentralized Metadata ↗
                </a>
              ) : null}
            </div>
          </div>

          {/* Right Bottom Action / Proposal Area */}
          {ticket.proposal ? (
            <div className="dmodal-proposal-card">
              <div className="proposal-title-row">
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span>
                  Organizer Payout Proposal ({ticket.proposal.status.replace("_", " ")})
                </span>
              </div>
              <div className="proposal-sub-desc">
                {opposing ? "Objections recorded:" : "Support votes:"}{" "}
                <strong>
                  {ticket.proposal.yesWeight} / {ticket.proposal.soldWeight}
                </strong>{" "}
                tickets (1/3 threshold triggers governance freeze).
              </div>
              {canVote || ticket.proposal.hasVoted ? (
                <div className="proposal-btn-wrap">
                  <button
                    className={`btn-modal-amber${ticket.proposal.hasVoted ? " voted" : ""}`}
                    type="button"
                    disabled={busy || ticket.proposal.hasVoted}
                    onClick={() => void voteProposal()}
                  >
                    {ticket.proposal.hasVoted
                      ? opposing
                        ? "✓ Objection Vote Recorded"
                        : "✓ Support Vote Recorded"
                      : busy
                        ? "Broadcasting…"
                        : opposing
                          ? "Submit Objection Vote"
                          : "Submit Support Vote"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {live && ticket.status === "listed" ? (
            <div className="dmodal-action-box resale-highlight">
              <span className="font-mono text-[0.88rem] text-white">
                Listed at{" "}
                <strong className="text-[#fde68a]">
                  {ticket.listPriceCents != null ? formatAmount(ticket.listPriceCents, symbol) : ""}
                </strong>
              </span>
              <button
                className="btn-modal-outline"
                type="button"
                disabled={busy}
                onClick={() => void delistPass()}
              >
                {busy ? "Processing…" : "Delist Pass"}
              </button>
            </div>
          ) : live && ticket.status === "owned" ? (
            isResellOpen ? (
              <div className="resell-inline-panel" id="resellInlinePanel">
                <div className="resell-panel-header">
                  <span className="resell-panel-title">Secondary Listing (90%~110% Cap)</span>
                  <button
                    className="btn-resell-cancel"
                    type="button"
                    onClick={() => setIsResellOpen(false)}
                  >
                    Cancel
                  </button>
                </div>

                <div className="resell-controls-row">
                  <div className="resell-left-controls">
                    <div
                      className={`resell-price-box${isResellValid ? "" : " invalid"}`}
                      id="resellPriceBox"
                    >
                      <input
                        ref={resellInputRef}
                        className="resell-price-input"
                        id="resellPriceInput"
                        type="number"
                        step="0.01"
                        min={minDx}
                        max={maxDx}
                        value={resellPrice}
                        onChange={(e) => setResellPrice(e.target.value)}
                      />
                      <span className="resell-currency-unit">{symbol}</span>
                    </div>

                    <div className="resell-preset-grp">
                      <button
                        className={`btn-resell-preset${isMinusActive ? " active" : ""}`}
                        id="presetMinusBtn"
                        type="button"
                        onClick={() => setResellPrice(minDx.toFixed(2))}
                      >
                        -10%
                      </button>
                      <button
                        className={`btn-resell-preset${isFaceActive ? " active" : ""}`}
                        id="presetFaceBtn"
                        type="button"
                        onClick={() => setResellPrice(faceDx.toFixed(2))}
                      >
                        Face
                      </button>
                      <button
                        className={`btn-resell-preset${isPlusActive ? " active" : ""}`}
                        id="presetPlusBtn"
                        type="button"
                        onClick={() => setResellPrice(maxDx.toFixed(2))}
                      >
                        +10%
                      </button>
                    </div>
                  </div>

                  <button
                    className="btn-list-pass-submit"
                    id="confirmListPassBtn"
                    type="button"
                    disabled={busy || !isResellValid}
                    onClick={() => void listPass()}
                  >
                    {busy ? "Broadcasting…" : "List Pass"}
                  </button>
                </div>

                <div
                  className={`resell-cap-hint${isResellValid ? "" : " error"}`}
                  id="resellCapHint"
                >
                  {isResellValid
                    ? `Allowed price range: ${formatAmount(bounds.min, symbol)} – ${formatAmount(bounds.max, symbol)}`
                    : `Price must be between ${formatAmount(bounds.min, symbol)} and ${formatAmount(bounds.max, symbol)}`}
                </div>
              </div>
            ) : (
              <div className="dmodal-footer-bar">
                <span className="cap-label">
                  Secondary Cap: {formatAmount(bounds.min, symbol)} –{" "}
                  {formatAmount(bounds.max, symbol)}
                </span>
                <button className="btn-modal-outline" type="button" onClick={openResellForm}>
                  🏷 Resell Pass
                </button>
              </div>
            )
          ) : !ticket.proposal ? (
            <div className="dmodal-footer-bar">
              <span className="cap-label">
                {ticket.status === "used"
                  ? "This ticket has been verified and checked in at the venue."
                  : ticket.status === "refunded"
                    ? "Refund settled on-chain."
                    : ticket.phase === "cancelled"
                      ? "Event cancelled."
                      : "On-Chain Attendance Verified"}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
