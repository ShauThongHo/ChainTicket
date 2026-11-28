import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminAccessGate, AdminDarkShell } from "@/components/admin-dark-shell";
import { useSession } from "@/components/session";
import {
  fetchKycDetail,
  fetchKycPhoto,
  fetchKycQueue,
  fetchOrganizers,
  patchOrganizer,
  reviewKyc,
  saveOrganizer,
} from "@/lib/api";
import type { KycDetail, KycListRow, KycStatus, OrganizerRow } from "@/lib/types";
import { shortAddr } from "@/lib/utils";

type AdminFolder = "kyc" | "organizers";

function kycStatusBadgeClass(status: KycStatus) {
  if (status === "approved") return "badge-approved";
  if (status === "rejected" || status === "expired") return "badge-rejected";
  return "badge-pending";
}

export function AdminListDirectory({
  initialFolder = null,
}: {
  initialFolder?: AdminFolder | null;
}) {
  const { me, refresh } = useSession();

  const [activeFolder, setActiveFolder] = useState<AdminFolder | null>(initialFolder);
  const [printSeq, setPrintSeq] = useState(0);

  // KYC queue & filter state
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | KycStatus>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kycRows, setKycRows] = useState<KycListRow[]>([]);
  const [kycLoading, setKycLoading] = useState(false);

  // KYC detail modal & lightbox state
  const [detail, setDetail] = useState<KycDetail | null>(null);
  const [photo, setPhoto] = useState<{ contentType: string; base64: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [kycBusy, setKycBusy] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Organizers state
  const [orgRows, setOrgRows] = useState<OrganizerRow[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgBusy, setOrgBusy] = useState(false);
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    setActiveFolder(initialFolder);
  }, [initialFolder]);

  const loadKyc = useCallback(async () => {
    setKycLoading(true);
    try {
      const list = await fetchKycQueue({
        data: {
          q,
          status,
          from: from ? new Date(from).toISOString() : "",
          to: to ? new Date(`${to}T23:59:59`).toISOString() : "",
        },
      });
      setKycRows(list);
    } finally {
      setKycLoading(false);
    }
  }, [q, status, from, to]);

  const loadOrganizers = useCallback(async () => {
    setOrgLoading(true);
    try {
      setOrgRows(await fetchOrganizers());
    } finally {
      setOrgLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!me?.isAdmin) return;
    void loadKyc().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
    void loadOrganizers().catch((e) =>
      toast.error(e instanceof Error ? e.message : "Could not load organizers"),
    );
    // initial directory hydration — search submits explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.isAdmin]);

  useEffect(() => {
    function onReset() {
      setActiveFolder(null);
    }
    window.addEventListener("ct:admin-list-reset", onReset);
    return () => window.removeEventListener("ct:admin-list-reset", onReset);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (lightboxOpen) {
        setLightboxOpen(false);
      } else if (detail) {
        setDetail(null);
        setPhoto(null);
      } else if (activeFolder) {
        setActiveFolder(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen, detail, activeFolder]);

  function openFolder(folder: AdminFolder) {
    setActiveFolder(folder);
    setPrintSeq((n) => n + 1);
  }

  function closeFolders() {
    setActiveFolder(null);
  }

  async function openKycDetail(kycRef: string) {
    setKycBusy(true);
    setPhoto(null);
    setPhotoBusy(false);
    setLightboxOpen(false);
    try {
      const row = await fetchKycDetail({ data: { kycRef } });
      setDetail(row);
      setReason(row.rejectReason ?? "");
      if (row.hasPhoto) {
        setPhotoBusy(true);
        try {
          const pic = await fetchKycPhoto({ data: { kycRef } });
          setPhoto(pic);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not load the document photo");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open record");
    } finally {
      setPhotoBusy(false);
      setKycBusy(false);
    }
  }

  function closeKycDetail() {
    setLightboxOpen(false);
    setDetail(null);
    setPhoto(null);
  }

  async function decideKyc(approve: boolean) {
    if (!detail) return;
    if (!approve && !reason.trim()) {
      toast.error("A reject reason is required.");
      return;
    }
    setKycBusy(true);
    try {
      await reviewKyc({ data: { kycRef: detail.kycRef, approve, reason } });
      toast.success(approve ? "Approved" : "Rejected");
      closeKycDetail();
      await loadKyc();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setKycBusy(false);
    }
  }

  async function handleAddOrganizer(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.trim() || !name.trim()) {
      toast.error("Please enter both Organizer wallet and Label / name.");
      return;
    }
    setOrgBusy(true);
    try {
      await saveOrganizer({ data: { wallet: wallet.trim(), name: name.trim() } });
      toast.success("Organizer approved");
      setName("");
      setWallet("");
      await loadOrganizers();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setOrgBusy(false);
    }
  }

  async function handleToggleOrganizer(row: OrganizerRow) {
    setOrgBusy(true);
    try {
      const nextStatus = row.status === "approved" ? "revoked" : "approved";
      await patchOrganizer({ data: { wallet: row.wallet, status: nextStatus } });
      toast.success(nextStatus === "approved" ? "Organizer approved" : "Organizer revoked");
      await loadOrganizers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update organizer");
    } finally {
      setOrgBusy(false);
    }
  }

  if (!me || !me.isAdmin) {
    return (
      <AdminDarkShell>
        <AdminAccessGate />
      </AdminDarkShell>
    );
  }

  const photoDataUrl = photo ? `data:${photo.contentType};base64,${photo.base64}` : "";

  return (
    <AdminDarkShell>
      <main className={`admin-list-stage${activeFolder ? " folder-open" : ""}`}>
        {/* Initial centered hero header */}
        <div className="archive-hero-header">
          <div className="kicker-pill">
            Admin Compliance &amp; Registry · <span>2 Active Folders</span>
          </div>
          <h1 className="archive-title">
            Admin <em>Directory</em>
          </h1>
          <p className="archive-subtitle">
            Select a folder below to review anti-sybil KYC submissions or manage verified event
            organizers on-chain.
          </p>
        </div>

        {/* Thermal-receipt printer slot */}
        {activeFolder ? (
          <section className="receipt-printer-slot">
            <div className="receipt-clip-frame">
              <div
                key={`${activeFolder}-${printSeq}`}
                className={`receipt-paper-sheet receipt-printing-anim${
                  activeFolder === "organizers" ? " amber-sheet" : ""
                }`}
              >
                {activeFolder === "kyc" ? (
                  <>
                    <div className="receipt-top-bar">
                      <h2 className="receipt-title">KYC Submissions</h2>
                      <button
                        type="button"
                        className="btn-return-folders"
                        onClick={closeFolders}
                      >
                        ↓ Close Folder
                      </button>
                    </div>

                    <form
                      className="kyc-filter-box"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void loadKyc().catch((err) =>
                          toast.error(err instanceof Error ? err.message : "Search failed"),
                        );
                      }}
                    >
                      <div className="kyc-row-top">
                        <div className="f-group">
                          <label className="f-label" htmlFor="kyc-q">
                            Wallet or reference
                          </label>
                          <input
                            className="f-input"
                            id="kyc-q"
                            type="text"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="0x… or kyc ref"
                          />
                        </div>

                        <div className="f-group">
                          <label className="f-label" htmlFor="kyc-status">
                            Status
                          </label>
                          <select
                            className="f-select"
                            id="kyc-status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as "" | KycStatus)}
                          >
                            <option value="">Any</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="expired">Expired</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="btn-kyc-search"
                          disabled={kycBusy || kycLoading}
                        >
                          {kycLoading ? "Searching…" : "Search"}
                        </button>
                      </div>

                      <div className="kyc-row-bottom">
                        <div className="f-group">
                          <label className="f-label" htmlFor="kyc-from">
                            From
                          </label>
                          <input
                            className="f-input"
                            id="kyc-from"
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                          />
                        </div>
                        <div className="f-group">
                          <label className="f-label" htmlFor="kyc-to">
                            To
                          </label>
                          <input
                            className="f-input"
                            id="kyc-to"
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                          />
                        </div>
                      </div>
                    </form>

                    <div className="registry-rows-list">
                      {kycRows.length === 0 ? (
                        <div className="empty-list-note">
                          {kycLoading ? "Loading KYC submissions…" : "No matching KYC submissions found."}
                        </div>
                      ) : (
                        kycRows.map((row) => (
                          <div key={row.kycRef} className="registry-row-card">
                            <div>
                              <div className="reg-main-id">{shortAddr(row.wallet)}</div>
                              <div className="reg-sub-meta">
                                {row.kycRef.slice(0, 12)}… ·{" "}
                                {new Date(row.submittedAt).toLocaleString()}
                                {row.documentExpiresAt ? ` · exp ${row.documentExpiresAt}` : ""}
                              </div>
                            </div>
                            <div className="reg-actions-grp">
                              <span className={kycStatusBadgeClass(row.status)}>{row.status}</span>
                              <button
                                type="button"
                                className="btn-row-outline"
                                disabled={kycBusy}
                                onClick={() => void openKycDetail(row.kycRef)}
                              >
                                View
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="receipt-top-bar">
                      <h2 className="receipt-title">Verified Organizers</h2>
                      <button
                        type="button"
                        className="btn-return-folders"
                        onClick={closeFolders}
                      >
                        ↓ Close Folder
                      </button>
                    </div>

                    <form className="org-add-card" onSubmit={(e) => void handleAddOrganizer(e)}>
                      <div className="f-group">
                        <label className="f-label" htmlFor="newOrgWallet">
                          Organizer wallet
                        </label>
                        <input
                          className="f-input"
                          id="newOrgWallet"
                          type="text"
                          value={wallet}
                          onChange={(e) => setWallet(e.target.value)}
                          placeholder="0x…"
                        />
                      </div>

                      <div className="f-group">
                        <label className="f-label" htmlFor="newOrgLabel">
                          Label / name
                        </label>
                        <input
                          className="f-input"
                          id="newOrgLabel"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Venue company"
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn-add-organizer"
                        disabled={orgBusy}
                      >
                        {orgBusy ? "Saving…" : "Add Organizer"}
                      </button>
                    </form>

                    <div className="registry-rows-list">
                      {orgLoading && orgRows.length === 0 ? (
                        <div className="empty-list-note">Loading organizers…</div>
                      ) : orgRows.length === 0 ? (
                        <div className="empty-list-note">
                          No organizers yet. Add a wallet above.
                        </div>
                      ) : (
                        orgRows.map((row) => (
                          <div key={row.wallet} className="registry-row-card">
                            <div>
                              <div className="reg-main-id font-sans">{row.name}</div>
                              <div className="reg-sub-meta">{shortAddr(row.wallet)}</div>
                            </div>
                            <div className="reg-actions-grp">
                              <span
                                className={
                                  row.status === "approved"
                                    ? "badge-approved"
                                    : row.status === "revoked"
                                      ? "badge-rejected"
                                      : "badge-pending"
                                }
                              >
                                {row.status}
                              </span>
                              <span className="reg-sub-meta">{row.eventCount} events</span>
                              <button
                                type="button"
                                className="btn-row-outline"
                                disabled={orgBusy}
                                onClick={() => void handleToggleOrganizer(row)}
                              >
                                {row.status === "approved" ? "Revoke" : "Approve"}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {/* Stacked Physical Folders */}
        <section className="folders-stack-container">
          <div
            className={`file-folder folder-kyc${activeFolder === "kyc" ? " is-active-folder" : ""}`}
            onClick={() => openFolder(activeFolder === "kyc" ? "organizers" : "kyc")}
          >
            <div className="folder-tab-row">
              <div className="folder-tab">
                <span>KYC</span>
                <span className="tab-count-pill">{kycRows.length}</span>
              </div>
            </div>
            <div className="folder-body">
              <div className="folder-halftone" />
              <div className="folder-info-left">
                <h2 className="folder-heading">KYC Submissions</h2>
                <p className="folder-desc">
                  Inspect attendee anti-sybil verification records, AES-256-GCM credential hashes,
                  and document expiry statuses.
                </p>
              </div>
              <button
                type="button"
                className="folder-action-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  openFolder(activeFolder ? "organizers" : "kyc");
                }}
              >
                {activeFolder ? "Switch to Organizers ⇄" : "Open Folder →"}
              </button>
            </div>
          </div>

          <div
            className={`file-folder folder-organizers${
              activeFolder === "organizers" ? " is-active-folder" : ""
            }`}
            onClick={() => openFolder(activeFolder === "organizers" ? "kyc" : "organizers")}
          >
            <div className="folder-tab-row">
              <div className="folder-tab">
                <span>Organizers</span>
                <span className="tab-count-pill">{orgRows.length}</span>
              </div>
            </div>
            <div className="folder-body">
              <div className="folder-halftone" />
              <div className="folder-info-left">
                <h2 className="folder-heading">Verified Organizers</h2>
                <p className="folder-desc">
                  Whitelist new event organizer wallets or revoke on-chain event deployment
                  permissions.
                </p>
              </div>
              <button
                type="button"
                className="folder-action-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  openFolder(activeFolder ? "kyc" : "organizers");
                }}
              >
                {activeFolder ? "Switch to KYC ⇄" : "Open Folder →"}
              </button>

              <div className="folder-footer-strip">
                <span>ON-CHAIN REGISTRY ARCHIVE</span>
                <span>GNOSIS / DxDAI L2</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* KYC Decrypted Review Modal */}
      <div
        className={`kyc-modal-backdrop${detail ? " open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeKycDetail();
        }}
      >
        <div className="kyc-modal-card" role="dialog" aria-modal="true" aria-label="KYC submission detail">
          <button
            type="button"
            className="modal-close-x"
            title="Close"
            onClick={closeKycDetail}
          >
            ✕
          </button>

          {detail ? (
            <div className="kyc-view-grid">
              <div className="kyc-fields-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={kycStatusBadgeClass(detail.status)}>{detail.status}</span>
                </div>

                <div className="kyc-field-item">
                  <span className="kyc-field-lbl">Wallet Address</span>
                  <span className="kyc-field-val">{detail.wallet}</span>
                </div>

                <div className="kyc-field-item">
                  <span className="kyc-field-lbl">Ref</span>
                  <span className="kyc-field-val text-[#86efac]">{detail.kycRef}</span>
                </div>

                <div className="kyc-field-pair">
                  <div className="kyc-field-item">
                    <span className="kyc-field-lbl">Name</span>
                    <span className="kyc-field-val">{detail.fullName}</span>
                  </div>

                  <div className="kyc-field-item">
                    <span className="kyc-field-lbl">ID Number</span>
                    <span className="kyc-field-val">{detail.idNumber}</span>
                  </div>
                </div>

                <div className="kyc-field-pair">
                  <div className="kyc-field-item">
                    <span className="kyc-field-lbl">Nationality</span>
                    <span className="kyc-field-val">{detail.nationality}</span>
                  </div>

                  <div className="kyc-field-item">
                    <span className="kyc-field-lbl">Expiry date</span>
                    <span className="kyc-field-val">{detail.documentExpiresAt ?? "—"}</span>
                  </div>
                </div>

                <div className="f-group">
                  <label className="kyc-field-lbl" htmlFor="reject-reason">
                    Reject reason (required if rejecting)
                  </label>
                  <input
                    className="f-input"
                    id="reject-reason"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for rejection…"
                  />
                </div>

                <div className="kyc-decision-row">
                  <button
                    type="button"
                    className="btn-kyc-accept"
                    disabled={kycBusy}
                    onClick={() => void decideKyc(true)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-kyc-reject"
                    disabled={kycBusy}
                    onClick={() => void decideKyc(false)}
                  >
                    Reject
                  </button>
                </div>
              </div>

              {photoDataUrl ? (
                <div
                  className="kyc-photo-box"
                  title="Click to enlarge photo"
                  onClick={() => setLightboxOpen(true)}
                >
                  <img src={photoDataUrl} alt="Submitted credential scan" />
                  <span className="photo-zoom-badge">🔍 Click to enlarge</span>
                </div>
              ) : (
                <div className="kyc-photo-box is-static">
                  {photoBusy ? (
                    <span className="reg-sub-meta">Loading document photo…</span>
                  ) : detail.hasPhoto ? (
                    <span className="text-xs text-rose-300">
                      Document photo could not be loaded.
                    </span>
                  ) : (
                    <span className="reg-sub-meta">
                      No document photo stored for this record.
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Fullscreen Photo Lightbox */}
      <div
        className={`photo-lightbox-backdrop${lightboxOpen && photoDataUrl ? " open" : ""}`}
        onClick={() => setLightboxOpen(false)}
      >
        {photoDataUrl ? <img src={photoDataUrl} alt="Enlarged credential scan" /> : null}
        <div className="lightbox-hint">Click anywhere or press ESC to close enlarged preview</div>
      </div>
    </AdminDarkShell>
  );
}
