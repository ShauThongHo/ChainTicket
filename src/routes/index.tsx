import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicDarkShell } from "@/components/public-dark-shell";
import { useSession } from "@/components/session";
import { fetchHomeOverview } from "@/lib/api";
import type { HomeOverview } from "@/lib/types";
import { formatAmount, paySymbol, shortAddr } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: HomePage });

function formatEventDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function activityVerb(kind: string) {
  switch (kind) {
    case "buy_primary":
      return "claimed pass for";
    case "buy_resale":
      return "bought resale pass for";
    case "list":
      return "listed pass for";
    case "checkin":
      return "checked in at";
    case "mint":
      return "minted show";
    default:
      return "interacted with";
  }
}

function HomePage() {
  const { config } = useSession();
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const symbol = paySymbol(config);

  useEffect(() => {
    let live = true;
    void fetchHomeOverview()
      .then((data) => {
        if (live) setOverview(data);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const featured = overview?.featured ?? null;
  const activity = overview?.latestActivity ?? null;

  const ticketInnerContent = (
    <>
      <div className="ticket-banner">
        <div className="banner-top">
          <span className="pass-id">
            {featured
              ? featured.sampleChainId != null
                ? `NFT PASS #${String(featured.sampleChainId).padStart(4, "0")}`
                : `EVENT #${String(featured.id).padStart(4, "0")}`
              : "ON-CHAIN PASS"}
          </span>
          <span className="chain-pill">
            {featured
              ? featured.phase === "active"
                ? "VERIFIED"
                : featured.phase.toUpperCase()
              : "READY"}
          </span>
        </div>
        <div>
          <div className="event-name">
            {featured
              ? featured.name
              : overview
                ? "No Live Shows Yet"
                : "Syncing Shows…"}
          </div>
          <div className="event-loc">
            {featured
              ? `${featured.venue || "TBA"} · ${formatEventDate(featured.startsAt)}`
              : overview
                ? "Explore the marketplace or mint an event"
                : `Connected to ${config?.chainName || "Gnosis Chiado"}`}
          </div>
        </div>
      </div>

      <div className="ticket-body">
        <div className="info-grid">
          <div>
            <div className="info-label">ACCESS TIER</div>
            <div className="info-value">{featured?.topTierName || "—"}</div>
          </div>
          <div>
            <div className="info-label">ENTRY PRICE</div>
            <div className="info-value">
              {featured?.minCents != null ? formatAmount(featured.minCents, symbol) : "—"}
            </div>
          </div>
          <div>
            <div className="info-label">ORGANIZER</div>
            <div className="info-value">
              {featured
                ? featured.organizerName || shortAddr(featured.organizerWallet)
                : "—"}
            </div>
          </div>
          <div>
            <div className="info-label">RESALE CAP</div>
            <div className="info-value">110% MAX</div>
          </div>
        </div>

        <div className="ticket-tear" />

        <div className="ticket-footer">
          <div className="qr-mini" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="verify-status">
            <div className="verify-hash">
              {featured?.deployTx
                ? `TX: ${shortAddr(featured.deployTx)}`
                : featured?.collectionAddress
                  ? `NFT: ${shortAddr(featured.collectionAddress)}`
                  : "ERC-721 Vault"}
            </div>
            <div className="verify-ok">
              {featured
                ? `● ${featured.available} / ${featured.supply} Available`
                : `● ${config?.chainName || "Gnosis Chiado"} Ready`}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <PublicDarkShell homeViewport>
      <main className="hero-main">
        <div className="hero-left">
          <div className="kicker-row">
            Your Ticket, Your <span className="kicker-badge">On-Chain Proof</span>
          </div>
          <h1>
            Shows worth
            <br />
            <span>showing up for.</span>
          </h1>
          <p className="hero-desc">
            Mint, transfer, and verify event passes with zero scalper bots and instant
            cryptographic authenticity at every gate.
          </p>

          <div className="trust-strip">
            <div className="trust-item">
              <i>✓</i> Anti-Scalp Cap
            </div>
            <div className="trust-item">
              <i>✓</i> 1-Wallet-1-Ticket
            </div>
            <div className="trust-item">
              <i>✓</i> Dynamic QR
            </div>
          </div>

          <div className="cta-buttons">
            <Link to="/marketplace" className="btn-primary">
              Explore Events →
            </Link>
          </div>

          <div className="metrics-row">
            <div>
              <div className="metric-val">
                {overview ? overview.stats.passesMinted.toLocaleString() : "—"}
              </div>
              <div className="metric-label">Passes Minted</div>
            </div>
            <div>
              <div className="metric-val">
                {overview ? overview.stats.liveEvents.toLocaleString() : "—"}
              </div>
              <div className="metric-label">Live Shows</div>
            </div>
            <div>
              <div className="metric-val">
                {overview ? overview.stats.passesClaimed.toLocaleString() : "—"}
              </div>
              <div className="metric-label">Passes Claimed</div>
            </div>
          </div>
        </div>

        <div className="hero-right">
          {featured ? (
            <Link
              to="/marketplace"
              search={{ eventId: featured.id }}
              className="holo-ticket"
            >
              {ticketInnerContent}
            </Link>
          ) : (
            <Link to="/marketplace" className="holo-ticket">
              {ticketInnerContent}
            </Link>
          )}
        </div>
      </main>

      <footer className="bottom-dock">
        <div className="chains-supported">
          <span>Active Network</span>
          <div className="chain-tags">
            <span>{config?.chainName || "Gnosis Chiado"}</span>
            <span>Chain {config?.chainId ?? 10200}</span>
            <span>{symbol}</span>
            <span>ERC-721</span>
          </div>
        </div>

        <div className="live-feed-pill">
          <span className="status-dot" />
          {activity ? (
            <span>
              Latest:{" "}
              <strong>{activity.actor ? shortAddr(activity.actor) : "Vault"}</strong>{" "}
              {activityVerb(activity.kind)} {activity.eventName || "event"}
            </span>
          ) : (
            <span>On-Chain Ledger: Waiting for first ticket activity</span>
          )}
        </div>
      </footer>
    </PublicDarkShell>
  );
}
